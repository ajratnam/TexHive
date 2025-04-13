import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import * as monaco from 'monaco-editor';

const socket = io();

function Editor() {
  const [editor, setEditor] = useState(null);
  const [currentFile, setCurrentFile] = useState('');
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [compileTimeout, setCompileTimeout] = useState(null);

  useEffect(() => {
    const editorInstance = monaco.editor.create(document.getElementById('editor-container'), {
      value: '',
      language: 'latex',
      theme: window.initialMonacoTheme,
      minimap: { enabled: false },
      automaticLayout: false,
    });

    editorInstance.getModel().onDidChangeContent(() => {
      socket.emit('update_text', { content: editorInstance.getValue(), path: currentFile });
      if (realtimeEnabled) {
        clearTimeout(compileTimeout);
        setCompileTimeout(setTimeout(compileLatex, 1000));
      }
    });

    setEditor(editorInstance);

    return () => {
      editorInstance.dispose();
    };
  }, [currentFile, realtimeEnabled, compileTimeout]);

  const loadFile = (path) => {
    fetch(`/api/file?path=${encodeURIComponent(path)}`)
      .then((response) => {
        if (!response.ok) throw new Error('File not found or error reading file');
        return response.json();
      })
      .then((data) => {
        setCurrentFile(data.path);
        if (editor) editor.setValue(data.content);
        compileLatex();
      })
      .catch((err) => alert('Could not load file: ' + err.message));
  };

  const compileLatex = () => {
    document.getElementById('pdf-loading').style.display = 'flex';
    const ignoreWarnings = document.getElementById('ignore-warnings').checked;
    socket.emit('compile_latex', { ignoreWarnings, path: currentFile });
  };

  return <div id="editor-container" className="pane"></div>;
}

export default Editor;
