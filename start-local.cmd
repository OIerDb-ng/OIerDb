@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   OIerDb LexRank - local preview
echo ============================================
echo.
echo   Ranking model: secondary development by Yanhao Xiang, 2026-11-10
echo   Based on OIerDb (c) Baoshuo, released under GNU AGPL-3.0.
echo   This modified version is licensed under AGPL-3.0 as well.
echo.
echo   start-local.cmd            use existing generator\dist
echo   start-local.cmd --regen     regenerate data, then serve
echo   start-local.cmd --refresh   sync upstream data/, regenerate, then serve
echo.

rem ---- 1. dependencies ----
set COREPACK_ENABLE_DOWNLOAD_PROMPT=0
if not exist "node_modules\vite\bin\vite.js" goto install
rem workspace junctions break when the repo directory is moved or renamed
powershell -NoProfile -Command "if ((Test-Path 'node_modules\@oierdb\parser') -and -not (Test-Path 'node_modules\@oierdb\parser\index.ts')) { exit 1 } else { exit 0 }"
if errorlevel 1 goto install
echo [1/4] dependencies: OK
goto data

:install
echo [1/4] installing / repairing dependencies ^(first run 1-2 min^)...
if exist "node_modules\@oierdb\parser" cmd /c rmdir "node_modules\@oierdb\parser"
if exist "node_modules\@oierdb\core" cmd /c rmdir "node_modules\@oierdb\core"
call corepack yarn install
if errorlevel 1 (
  echo.
  echo [ERROR] yarn install failed. Need Node.js ^>=18 and network access.
  pause
  exit /b 1
)

:data

rem ---- 2. data ----
if /i "%~1"=="--refresh" goto refresh
if /i "%~1"=="--regen" goto regen
if not exist "generator\dist\result.txt" goto regen
echo [2/4] generated data: OK  ^(rebuild: --regen, sync upstream: --refresh^)
goto deploy

:refresh
echo [2/4] syncing upstream data\ from OIerDb-ng/OIerDb ...
python scripts\sync-upstream-data.py
if errorlevel 1 (
  echo.
  echo [ERROR] upstream sync failed.
  pause
  exit /b 1
)
goto regen

:regen
echo [2/4] running generator ^(3-6 min^)...
pushd generator
python main.py --lex-rank
if errorlevel 1 (
  popd
  echo.
  echo [ERROR] generator failed. Need Python with pypinyin and tqdm.
  pause
  exit /b 1
)
popd

:deploy
echo [3/4] copying data to apps\frontend-legacy\public\data ...
python generator\make_local_data.py
if errorlevel 1 (
  echo.
  echo [ERROR] failed to prepare local data.
  pause
  exit /b 1
)

echo.
echo [4/4] starting dev server: http://localhost:5178/oiers
echo       close this window to stop.
echo.
start "" powershell -NoProfile -Command "Start-Sleep 6; Start-Process 'http://localhost:5178/oiers'"

pushd "%~dp0apps\frontend-legacy"
rem use node directly: corepack/yarn mis-resolves paths containing non-ASCII chars
node "%~dp0node_modules\vite\bin\vite.js" --port 5178
popd

endlocal
