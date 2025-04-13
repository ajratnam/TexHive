import React from 'react';

function ContextMenu({ visible, x, y, onRename, onDelete }) {
  if (!visible) return null;

  return (
    <div id="context-menu" style={{ top: y, left: x }}>
      <div className="menu-item" onClick={onRename}>Rename</div>
      <div className="menu-item" onClick={onDelete}>Delete</div>
    </div>
  );
}

export default ContextMenu;
