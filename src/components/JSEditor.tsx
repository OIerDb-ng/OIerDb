/* eslint-disable react/prop-types */
import { memo, useEffect, useState, useRef, useCallback } from 'react';
import MonacoEditor, { Monaco } from '@monaco-editor/react';
import styles from './JSEditor.module.less';

interface JSEditorProps {
  storageKey: string;
  defaultValue?: string;
  jsExtraLib?: string;
  onChange?: React.Dispatch<React.SetStateAction<string>>;
}

const JSEditor: React.FC<JSEditorProps> = ({
  storageKey,
  defaultValue = '',
  jsExtraLib = '',
  onChange,
}) => {
  const [theme, setTheme] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'vs-dark'
      : 'light'
  );

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const handleChange = useCallback(
    (value: string | undefined) => onChange?.(value),
    [onChange]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'vs-dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const handleEditorBeforeMount = (monaco: Monaco) => {
    if (jsExtraLib.trim()) {
      monaco.languages.typescript.javascriptDefaults.addExtraLib(jsExtraLib);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    handleChange(value);
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = setTimeout(() => {
      if (value != null) {
        try {
          localStorage.setItem(storageKey, value);
        } catch {
          console.error('Failed to save to localStorage');
        }
      }
    }, 300);
  };

  const getStoredValue = (key: string, fallback: string) => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <div className={styles.jsEditorContainer}>
      <MonacoEditor
        height="200px"
        language="javascript"
        defaultValue={getStoredValue(storageKey, defaultValue)}
        onChange={handleEditorChange}
        beforeMount={handleEditorBeforeMount}
        theme={theme}
        options={{
          minimap: { enabled: false },
          tabSize: 2,
          fontSize: 14,
          lineNumbers: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
};

export default memo(JSEditor);
