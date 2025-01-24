import { memo, useEffect, useState } from 'react';
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
  onChange = () => {},
}) => {
  const [theme, setTheme] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'vs-dark'
      : 'light'
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      setTheme(event.matches ? 'vs-dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const handleEditorBeforeMount = (monaco: Monaco) => {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(jsExtraLib);
  };

  let saveTimeout: NodeJS.Timeout;
  const handleEditorChange = (value: string | undefined) => {
    onChange(value);
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (value != null) {
        localStorage.setItem(storageKey, value);
      }
    }, 300);
  };

  return (
    <div className={styles.filterEditor}>
      <MonacoEditor
        height="200px"
        language="javascript"
        defaultValue={localStorage.getItem(storageKey) || defaultValue}
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
