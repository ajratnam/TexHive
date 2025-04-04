import React from 'react';
import FileExplorer from './components/FileExplorer';
import Editor from './components/Editor';
import PdfViewer from './components/PdfViewer';
import Header from './components/Header';
import ContextMenu from './components/ContextMenu';
import ThemeSelector from './components/ThemeSelector';
import './styles/custom.css';
import './styles/theme.css';

function App() {
  return (
    <div className="App">
      <Header />
      <div id="main-container" className="flex h-[calc(100vh-64px)]">
        <FileExplorer />
        <div id="content-container" className="flex-1">
          <div id="split-container" className="h-full">
            <Editor />
            <PdfViewer />
          </div>
        </div>
      </div>
      <ContextMenu />
      <ThemeSelector />
    </div>
  );
}

export default App;
