// Initialize Socket.IO and editor variables
var socket = io();
var editor;
let compileTimeout;
let realtimeEnabled = false;
let currentFile = ""; // currently open file
let contextMenuTarget = null;

// Toggle the file explorer sidebar
function toggleSidebar() {
  document.getElementById('file-explorer').classList.toggle('hidden');
}

// Update compile button visibility (only for .tex files)
function updateCompileButtonVisibility() {
  const compileBtn = document.getElementById("compile-btn");
  compileBtn.style.display = currentFile && currentFile.endsWith(".tex") ? "inline-block" : "none";
}

// Hide the custom context menu
function hideContextMenu() {
  document.getElementById('context-menu').classList.add('hidden');
  contextMenuTarget = null;
}

// Show the custom context menu at (x, y)
function showContextMenu(x, y) {
  const menu = document.getElementById('context-menu');
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.remove('hidden');
}

// Handle context menu clicks
document.getElementById('context-menu').addEventListener('click', function(e) {
  const action = e.target.getAttribute('data-action');
  if (!action || !contextMenuTarget) return;
  const itemPath = contextMenuTarget.dataset.path;
  if (action === "rename") {
    const newName = prompt("Enter new name:", contextMenuTarget.textContent.trim());
    if (newName && newName !== contextMenuTarget.textContent.trim()) {
      let parts = itemPath.split('/');
      parts[parts.length - 1] = newName;
      const newPath = parts.join('/');
      fetch('/api/file/rename', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ oldPath: itemPath, newPath: newPath })
      })
      .then(response => {
        if (!response.ok) throw new Error("Rename failed");
        return response.json();
      })
      .then(() => {
        fetchFileTree(() => {
          if (currentFile === itemPath) {
            currentFile = newPath;
            loadFile(newPath);
          }
        });
      })
      .catch(err => alert("Error renaming item: " + err.message));
    }
  } else if (action === "delete") {
    if (confirm("Are you sure you want to delete this item?")) {
      fetch('/api/file?path=' + encodeURIComponent(itemPath), { method: 'DELETE' })
      .then(response => {
        if (!response.ok) throw new Error("Deletion failed");
        return response.json();
      })
      .then(() => {
        fetchFileTree(() => {
          if (currentFile === itemPath) {
            currentFile = "";
            if (editor) editor.setValue("");
            updateCompileButtonVisibility();
          }
        });
      })
      .catch(err => alert("Error deleting item: " + err.message));
    }
  }
  hideContextMenu();
});

// Hide context menu on clicking outside
document.addEventListener('click', function(e) {
  hideContextMenu();
});

// Initialize toggles for ignore warnings and realtime
document.addEventListener("DOMContentLoaded", function(){
  const ignoreCheckbox = document.getElementById('ignore-warnings');
  const ignoreIndicator = document.getElementById('ignore-warnings-indicator');
  const savedIgnore = localStorage.getItem("ignoreWarnings") === "true";
  ignoreCheckbox.checked = savedIgnore;
  if (savedIgnore) {
    ignoreIndicator.classList.add('translate-x-5', 'bg-green-500');
    ignoreIndicator.classList.remove('bg-white');
  } else {
    ignoreIndicator.classList.remove('translate-x-5', 'bg-green-500');
    ignoreIndicator.classList.add('bg-white');
  }
  ignoreCheckbox.addEventListener('change', function () {
    if (this.checked) {
      ignoreIndicator.classList.add('translate-x-5', 'bg-green-500');
      ignoreIndicator.classList.remove('bg-white');
    } else {
      ignoreIndicator.classList.remove('translate-x-5', 'bg-green-500');
      ignoreIndicator.classList.add('bg-white');
    }
    localStorage.setItem("ignoreWarnings", this.checked);
  });
});

// Fetch the file tree from the API
function fetchFileTree(callback) {
  fetch('/api/files')
    .then(response => response.json())
    .then(data => {
      renderFileTree(data, document.getElementById('file-tree'));
      if (callback) callback(data);
    })
    .catch(err => console.error("Error fetching file tree:", err));
}

// Recursively render the file tree
function renderFileTree(tree, container) {
  const ul = document.createElement('ul');
  tree.forEach(item => {
    const li = document.createElement('li');
    li.dataset.path = item.path;
    if (item.isDirectory) {
      li.textContent = item.name;
      li.classList.add('folder');
      li.addEventListener('click', function(e) {
        e.stopPropagation();
        const nestedUl = this.querySelector('ul');
        if (nestedUl) nestedUl.classList.toggle('hidden');
      });
      li.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        contextMenuTarget = li;
        showContextMenu(e.pageX, e.pageY);
      });
      if (item.children && item.children.length > 0) {
        const nestedUl = document.createElement('ul');
        renderFileTree(item.children, nestedUl);
        li.appendChild(nestedUl);
      }
    } else {
      li.textContent = item.name;
      li.classList.add('file');
      li.addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelectorAll('#file-explorer .selected').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        loadFile(li.dataset.path);
      });
      li.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        contextMenuTarget = li;
        showContextMenu(e.pageX, e.pageY);
      });
    }
    ul.appendChild(li);
  });
  container.innerHTML = '';
  container.appendChild(ul);
}

// New File button event handler
document.getElementById('new-file-button').addEventListener('click', function () {
  const newFileName = prompt("Enter new file name (e.g., newfile.tex):");
  if (newFileName) {
    fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newFileName, content: "" })
    })
    .then(response => {
      if (!response.ok) throw new Error("Could not create file.");
      return response.json();
    })
    .then(() => {
      loadFile(newFileName);
      fetchFileTree();
    })
    .catch(err => alert("Error creating file: " + err.message));
  }
});

// New Folder button event handler
document.getElementById('new-folder-button').addEventListener('click', function () {
  let basePath = "";
  const selected = document.querySelector('#file-explorer .selected');
  if (selected && selected.classList.contains('folder')) {
    basePath = selected.dataset.path + "/";
  }
  const folderName = prompt("Enter new folder name:");
  if (folderName) {
    const fullPath = basePath + folderName;
    fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fullPath })
    })
    .then(response => {
      if (!response.ok) throw new Error("Could not create folder.");
      return response.json();
    })
    .then(() => fetchFileTree())
    .catch(err => alert("Error creating folder: " + err.message));
  }
});

// Helper function: find first .tex file in the tree
function findFirstTexFile(tree) {
  for (let item of tree) {
    if (!item.isDirectory && item.name.toLowerCase().endsWith('.tex')) return item.path;
    if (item.isDirectory && item.children) {
      const found = findFirstTexFile(item.children);
      if (found) return found;
    }
  }
  return null;
}

// Initialize the editor with a .tex file (or create a default one)
function initializeEditorWithTexFile(treeData) {
  const texFile = findFirstTexFile(treeData);
  if (texFile) {
    currentFile = texFile;
    loadFile(currentFile);
  } else {
    currentFile = "document.tex";
    const baseContent = '\\documentclass{article}\n\\begin{document}\nHello, LaTeX!\n\\end{document}';
    fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentFile, content: baseContent })
    })
    .then(response => {
      if (!response.ok) throw new Error("Could not create document.tex");
      return response.json();
    })
    .then(() => {
      fetchFileTree(() => loadFile(currentFile));
    })
    .catch(err => alert("Error creating document.tex: " + err.message));
  }
}

// Load file content into the editor
function loadFile(path) {
  fetch('/api/file?path=' + encodeURIComponent(path))
    .then(response => {
      if (!response.ok) throw new Error("File not found or error reading file");
      return response.json();
    })
    .then(data => {
      currentFile = data.path;
      if (editor) editor.setValue(data.content);
      document.querySelectorAll('#file-explorer .selected').forEach(el => el.classList.remove('selected'));
      const target = document.querySelector(`#file-explorer li[data-path="${data.path}"]`);
      if (target) target.classList.add('selected');
      updateCompileButtonVisibility();
      compileLatex();
    })
    .catch(err => alert("Could not load file: " + err.message));
}

// Initialize Monaco editor
require(['vs/editor/editor.main'], function () {
  monaco.languages.register({id: 'latex'});
  monaco.languages.setMonarchTokensProvider('latex', {
    tokenizer: {
      root: [
        [/%.*$/, "comment"],
        [/\\[a-zA-Z]+/, "keyword"],
        [/\\./, "keyword"],
        [/\$[^$]*\$/, "string"],
        [/[{}]/, "delimiter"],
      ]
    }
  });
  editor = monaco.editor.create(document.getElementById('editor-container'), {
    value: '\\documentclass{article}\n\\begin{document}\nHello, LaTeX!\n\\end{document}',
    language: 'latex',
    theme: window.initialMonacoTheme,
    minimap: {enabled: false},
    automaticLayout: false
  });
  editor.getModel().onDidChangeContent(() => {
    socket.emit('update_text', { content: editor.getValue(), path: currentFile });
    if (realtimeEnabled) {
      clearTimeout(compileTimeout);
      compileTimeout = setTimeout(compileLatex, 1000);
    }
  });
  socket.emit('update_text', { content: editor.getValue(), path: currentFile });
  updateEditorTheme(window.initialMonacoTheme);
  fetchFileTree(initializeEditorWithTexFile);
});

// Compile LaTeX and show the spinner overlay
function compileLatex() {
  document.getElementById('pdf-loading').style.display = "flex";
  let ignoreWarnings = document.getElementById('ignore-warnings').checked;
  socket.emit('compile_latex', { ignoreWarnings: ignoreWarnings, path: currentFile });
}

// Handle compilation results
socket.on('compilation_done', function (data) {
  const pdfContainer = document.getElementById('pdf-container');
  const pdfLoading = document.getElementById('pdf-loading');
  if (data.status === 'success') {
    const pdfFileName = currentFile.replace(/\.tex$/, '.pdf');
    let iframe = document.getElementById('pdf-viewer');
    if (!iframe) {
      pdfContainer.innerHTML = `<iframe id="pdf-viewer" src="/pdf?file=${encodeURIComponent(pdfFileName)}#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>`;
      pdfContainer.appendChild(pdfLoading);
    } else {
      iframe.src = '/pdf?file=' + encodeURIComponent(pdfFileName) + '&ts=' + new Date().getTime() + '#toolbar=0';
    }
    iframe = document.getElementById('pdf-viewer');
    iframe.onload = function() {
      document.getElementById('pdf-loading').style.display = "none";
    };
  } else {
    pdfContainer.innerHTML = `
      <div style="
          height: 100%;
          width: 100%;
          box-sizing: border-box;
          padding: 20px;
          overflow-y: auto;
          color: #ffaaaa;
          font-family: monospace;
          background: var(--bg-color);
      ">
        <h2 style="color: #ff5555;">Compilation Error</h2>
        <pre style="white-space: pre-wrap;">${data.logs}</pre>
      </div>
    `;
    document.getElementById('pdf-loading').style.display = "none";
  }
});

// Toggle realtime compilation
function toggleRealtime() {
  realtimeEnabled = document.getElementById('realtime-toggle').checked;
  localStorage.setItem("realtime", realtimeEnabled);
  let indicator = document.getElementById('toggle-indicator');
  if (realtimeEnabled) {
    indicator.classList.add('translate-x-5', 'bg-green-500');
    indicator.classList.remove('bg-white');
  } else {
    indicator.classList.remove('translate-x-5', 'bg-green-500');
    indicator.classList.add('bg-white');
  }
}

// Initialize Split.js to divide the editor and PDF panes
require(['split'], function (Split) {
  Split(['#editor-container', '#pdf-container'], {
    sizes: [50, 50],
    minSize: 300,
    gutterSize: 5,
    onDrag: function () {
      if (editor) editor.layout();
    }
  });
});
