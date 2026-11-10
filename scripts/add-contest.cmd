@echo off
setlocal
cd /d "%~dp0.."

if "%~1"=="" (
  echo usage: scripts\add-contest.cmd ^<official.html^> [output.csv]
  echo.
  echo   step 1 of the add-contest workflow: convert an official award-list HTML
  echo   into CSV. See .agents\skills\add-contest\SKILL.md for the full procedure.
  exit /b 1
)

if "%~2"=="" (
  python "generator\tools\excel_html_to_csv.py" "%~1"
) else (
  python "generator\tools\excel_html_to_csv.py" "%~1" "%~2"
)
if errorlevel 1 (
  echo.
  echo [ERROR] conversion failed.
  exit /b 1
)

echo.
echo next steps ^(see .agents\skills\add-contest\SKILL.md^):
echo   2. split the CSV by award level ^(grep -n for 金牌/银牌/... then sed -n^)
echo   3. append records to data\raw.txt ^(9 fields: contest,level,name,grade,school,score,province,gender,identifier^)
echo   4. append the contest entry to data\contests.json
echo   5. run: python generator\main.py --export-unknown-schools
echo      then fix data\school.txt until dist\unknown-schools.txt is empty
echo   6. rebuild: start-local.cmd --regen
echo.
echo to pull upstream data instead of crawling: scripts\sync-upstream-data.py

endlocal
