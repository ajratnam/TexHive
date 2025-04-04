import React, { useState, useEffect } from 'react';

function FileExplorer() {
  const [fileTree, setFileTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, target: null });

  useEffect(() => {
    fetch('/api/files')
      .then(response => response.json())
      .then(data => setFileTree(data))
      .catch(err => console.error("Error fetching file tree:", err));
  }, []);

  const handleFileClick = (file) => {
    setSelectedFile(file);
    // Load file content logic here
  };

  const handleContextMenu = (event, file) => {
    event.preventDefault();
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, target: file });
  };

  const handleContextMenuAction = (action) => {
    if (!contextMenu.target) return;
    const filePath = contextMenu.target.path;
    if (action === "rename") {
      const newName = prompt("Enter new name:", contextMenu.target.name);
      if (newName && newName !== contextMenu.target.name) {
        const newPath = filePath.replace(/[^/]+$/, newName);
        fetch('/api/file/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: filePath, newPath: newPath })
        })
          .then(response => {
            if (!response.ok) throw new Error("Rename failed");
            return response.json();
          })
          .then(() => {
            setFileTree(prevTree => {
              // Update file tree logic here
              return prevTree;
            });
          })
          .catch(err => alert("Error renaming item: " + err.message));
      }
    } else if (action === "delete") {
      if (confirm("Are you sure you want to delete this item?")) {
        fetch('/api/file?path=' + encodeURIComponent(filePath), { method: 'DELETE' })
          .then(response => {
            if (!response.ok) throw new Error("Deletion failed");
            return response.json();
          })
          .then(() => {
            setFileTree(prevTree => {
              // Update file tree logic here
              return prevTree;
            });
          })
          .catch(err => alert("Error deleting item: " + err.message));
      }
    }
    setContextMenu({ visible: false, x: 0, y: 0, target: null });
  };

  const renderFileTree = (tree) => {
    return tree.map(item => (
      <li key={item.path} onClick={() => handleFileClick(item)} onContextMenu={(e) => handleContextMenu(e, item)}>
        {item.isDirectory ? (
          <span className="folder">{item.name}</span>
        ) : (
          <span className="file">{item.name}</span>
        )}
        {item.children && <ul>{renderFileTree(item.children)}</ul>}
      </li>
    ));
  };

  return (
    <div id="file-explorer">
      <h2>Files</h2>
      <ul>{renderFileTree(fileTree)}</ul>
      {contextMenu.visible && (
        <div id="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="menu-item" onClick={() => handleContextMenuAction("rename")}>Rename</div>
          <div className="menu-item" onClick={() => handleContextMenuAction("delete")}>Delete</div>
        </div>
      )}
    </div>
  );
}

export default FileExplorer;
