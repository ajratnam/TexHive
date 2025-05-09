// Initialize Socket.IO and editor variables
var socket = io();
var editor;
let compileTimeout;
let realtimeEnabled = false;
let currentFile = ""; // currently open file
let contextMenuTarget = null;
const ZOOM_STEP = 1.1;

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
    compileLatex();
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
      compileLatex();
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
    })
    .catch(err => alert("Could not load file: " + err.message))
      .then(() => {
        updateCompileButtonVisibility();
      });
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
  const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
  const userId = sessionData.uid;
  const params = new URLSearchParams(window.location.search);
  const project = params.get('project');
  editor.getModel().onDidChangeContent(() => {
    socket.emit('update_text', { content: editor.getValue(), path: currentFile, uid: userId, project: project });
    if (realtimeEnabled) {
      clearTimeout(compileTimeout);
      compileTimeout = setTimeout(compileLatex, 1000);
    }
  });
  socket.emit('update_text', { content: editor.getValue(), path: currentFile, uid: userId, project: project });
  updateEditorTheme(window.initialMonacoTheme);
  fetchFileTree(initializeEditorWithTexFile);
});

// Compile LaTeX and show the spinner overlay
function compileLatex() {
  document.getElementById('pdf-loading').style.display = "flex";
  let ignoreWarnings = document.getElementById('ignore-warnings').checked;
  const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
  const userId = sessionData.uid;
  const params = new URLSearchParams(window.location.search);
  const project = params.get('project');
  socket.emit('compile_latex', { ignoreWarnings: ignoreWarnings, path: currentFile, uid: userId, project: project });
}

// Handle compilation results and render PDF interactively using PDF.js's PDFViewer
socket.on('compilation_done', function (data) {
  const pdfContainer = document.getElementById('pdf-container');
  const pdfLoading = document.getElementById('pdf-loading');

  if (data.status === 'success') {
    const pdfFileName = currentFile.replace(/\.tex$/, '.pdf');
    const pdfUrl = '/pdf?file=' + encodeURIComponent(pdfFileName);

    // Create a viewer container with a nested "pdfViewer" element.
    // The outer container is used by the PDFViewer as its "container" option,
    // and the inner element is passed as the "viewer" option.
    pdfContainer.innerHTML = `
      <div id="pdf-loading" class="hidden">
        <div class="loader"></div>
      </div>
      <div id="viewerContainer" class="viewerContainer">
        <div id="pdfViewer" class="pdfViewer"></div>
      </div>
    `;

    var containerElement = document.getElementById('viewerContainer');
    var viewerElement = document.getElementById('pdfViewer');

    // Create an EventBus and a LinkService (required by PDFViewer)
    var eventBus = new pdfjsViewer.EventBus();
    var pdfLinkService = new pdfjsViewer.PDFLinkService({
      eventBus: eventBus
    });

    // Create a PDFViewer instance with both container and viewer options
    var pdfViewer = new pdfjsViewer.PDFViewer({
      container: containerElement,
      viewer: viewerElement,
      eventBus: eventBus,
      linkService: pdfLinkService
    });
    pdfLinkService.setViewer(pdfViewer);

    // Load and render the PDF document
    pdfjsLib.getDocument(pdfUrl).promise.then(function(pdfDocument) {
      pdfViewer.setDocument(pdfDocument);
      pdfLinkService.setDocument(pdfDocument, null);
      pdfLoading.style.display = "none";
    }).catch(function(err) {
      console.error("Error rendering PDF: ", err);
      pdfContainer.innerHTML = '<div id="pdf-loading" class="hidden"><div class="loader"></div></div><div style="padding:20px; color:red;">Error loading PDF</div>';
      pdfLoading.style.display = "none";
    });

    let pdfScale = pdfViewer.currentScale || 1;
    containerElement.addEventListener("wheel", function (event) {
      if (event.ctrlKey) {
        event.preventDefault();

        const oldScale = pdfScale;
        pdfScale *= event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        pdfScale = Math.min(Math.max(pdfScale, 0.25), 5);

        const rect = containerElement.getBoundingClientRect();
        const scrollLeft = containerElement.scrollLeft;
        const scrollTop = containerElement.scrollTop;

        // Mouse position relative to container scroll
        const x = event.clientX - rect.left + scrollLeft;
        const y = event.clientY - rect.top + scrollTop;

        // Apply zoom
        pdfViewer.currentScale = pdfScale;

        // Adjust scroll to keep mouse position in place
        const scaleRatio = pdfScale / oldScale;
        containerElement.scrollLeft = x * scaleRatio - (event.clientX - rect.left);
        containerElement.scrollTop = y * scaleRatio - (event.clientY - rect.top);
      }
    }, { passive: false });

  } else {
    pdfContainer.innerHTML = `
      <div id="pdf-loading" class="hidden">
        <div class="loader"></div>
      </div>
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
    pdfLoading.style.display = "none";
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

// Share project function
async function shareProject() {
  const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
  const userId = sessionData.uid;
  const params = new URLSearchParams(window.location.search);
  const project = params.get('project');

  try {
    const response = await fetch('/api/share-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        projectName: project,
        projectPath: project
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to share project');
    }
    
    const data = await response.json();
    const shareUrl = window.location.origin + '/join-project/' + data.shareHash;
    
    // Copy to clipboard
    await navigator.clipboard.writeText(shareUrl);
    alert('Share link copied to clipboard: ' + shareUrl);
  } catch (error) {
    console.error('Error sharing project:', error);
    alert('Failed to share project. Please try again.');
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
