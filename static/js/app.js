// Initialize Socket.IO with reconnection options
const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Socket connection event handlers
socket.on('connect', () => {
    console.log('Socket connected');
});

socket.on('disconnect', () => {
    console.log('Socket disconnected');
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
});

// Join project room when connected
const params = new URLSearchParams(window.location.search);
const project = params.get('project');
if (project) {
    socket.emit('join_project', { projectName: project });
}

// Clean up when leaving the page
window.addEventListener('beforeunload', function() {
    if (project) {
        socket.emit('leave_project', { projectName: project });
    }
});

var editor;
let compileTimeout;
let realtimeEnabled = false;
let currentFile = ""; // currently open file
let contextMenuTarget = null;
const ZOOM_STEP = 1.1;
let userAccessLevel = null; // Store user's access level
let isApplyingExternalChange = false; // Flag to prevent infinite loops
let humanizePopup = null; // Store reference to humanize popup
let lastHumanizedSelection = null; // Store last humanized selection
let isHumanizing = false; // Flag to track if humanization is in progress

// Create humanize popup element
function createHumanizePopup() {
    const popup = document.createElement('div');
    popup.id = 'humanize-popup';
    popup.className = 'fixed bg-gray-800 text-white px-3 py-1 rounded shadow-lg z-50 hidden';
    popup.innerHTML = `
        <button id="humanize-btn" class="text-sm hover:text-blue-400 transition-colors">
            Humanize
        </button>
    `;
    document.body.appendChild(popup);
    return popup;
}

// Create humanize result dialog
function createHumanizeDialog() {
    // Remove existing dialog if it exists
    const existingDialog = document.getElementById('humanize-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }

    const dialog = document.createElement('div');
    dialog.id = 'humanize-dialog';
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
    dialog.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <h3 class="text-xl font-semibold mb-4">Humanized Text</h3>
            <div class="mb-4">
                <p class="text-sm text-gray-400 mb-2">Original:</p>
                <div id="original-text" class="bg-gray-700 p-3 rounded mb-4"></div>
                <p class="text-sm text-gray-400 mb-2">Humanized:</p>
                <div id="humanized-text" class="bg-gray-700 p-3 rounded"></div>
            </div>
            <div class="flex justify-end space-x-3">
                <button id="reject-humanize" class="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                    Reject
                </button>
                <button id="accept-humanize" class="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition-colors">
                    Accept
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    return dialog;
}

// Show humanize popup at selection position
function showHumanizePopup(x, y) {
    if (!humanizePopup) {
        humanizePopup = createHumanizePopup();
    }
    humanizePopup.style.left = `${x}px`;
    humanizePopup.style.top = `${y}px`;
    humanizePopup.classList.remove('hidden');
}

// Hide humanize popup
function hideHumanizePopup() {
    if (humanizePopup) {
        humanizePopup.classList.add('hidden');
    }
}

// Show humanize result dialog
function showHumanizeDialog(originalText, humanizedText) {
    console.log('Showing dialog with:', { originalText, humanizedText });
    
    // Create dialog if it doesn't exist
    let dialog = document.getElementById('humanize-dialog');
    if (!dialog) {
        dialog = createHumanizeDialog();
    }
    
    // Update dialog content
    const originalElement = document.getElementById('original-text');
    const humanizedElement = document.getElementById('humanized-text');
    
    if (originalElement && humanizedElement) {
        originalElement.textContent = originalText;
        humanizedElement.textContent = humanizedText;
        dialog.classList.remove('hidden');
    } else {
        console.error('Dialog elements not found');
        // Try recreating the dialog
        dialog = createHumanizeDialog();
        const newOriginalElement = document.getElementById('original-text');
        const newHumanizedElement = document.getElementById('humanized-text');
        if (newOriginalElement && newHumanizedElement) {
            newOriginalElement.textContent = originalText;
            newHumanizedElement.textContent = humanizedText;
            dialog.classList.remove('hidden');
        } else {
            console.error('Failed to create dialog elements');
            alert('Failed to show humanization results. Please try again.');
        }
    }
}

// Hide humanize result dialog
function hideHumanizeDialog() {
    const dialog = document.getElementById('humanize-dialog');
    if (dialog) {
        dialog.classList.add('hidden');
    }
}

// Handle text selection
function handleTextSelection(e) {
    if (!editor || userAccessLevel === 'viewer') return;
    
    const selection = editor.getSelection();
    if (selection && !selection.isEmpty()) {
        const selectedText = editor.getModel().getValueInRange(selection);
        // Count words (split by whitespace and filter out empty strings)
        const wordCount = selectedText.trim().split(/\s+/).filter(word => word.length > 0).length;
        
        // Only show humanize option if word count is at least 30
        if (wordCount >= 30) {
            const position = editor.getPosition();
            const coordinates = editor.getScrolledVisiblePosition(position);
            const editorElement = document.getElementById('editor-container');
            const editorRect = editorElement.getBoundingClientRect();
            
            showHumanizePopup(
                editorRect.left + coordinates.left,
                editorRect.top + coordinates.top - 30
            );
        } else {
            hideHumanizePopup();
        }
    } else {
        hideHumanizePopup();
    }
}

// Check if text has minimum required words
function hasMinimumWordCount(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length >= 30;
}

// Handle humanize button click
async function handleHumanize() {
    if (!editor || isHumanizing) return;
    
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return;
    
    const selectedText = editor.getModel().getValueInRange(selection);
    console.log('Selected text:', selectedText);
    
    // Check minimum word count
    if (!hasMinimumWordCount(selectedText)) {
        alert('Please select at least 30 words to use the humanize feature.');
        return;
    }
    
    lastHumanizedSelection = selection;
    isHumanizing = true;
    
    try {
        // Show loading state
        const humanizeBtn = document.getElementById('humanize-btn');
        humanizeBtn.textContent = 'Humanizing...';
        humanizeBtn.disabled = true;
        
        // Call backend endpoint instead of microservice directly
        const response = await fetch('/api/humanize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: selectedText })
        });
        
        if (!response.ok) {
            throw new Error('Humanization failed');
        }
        
        const result = await response.json();
        console.log('Humanization result:', result);
        
        // Check if we have the humanized text in the response
        if (!result || !result.humanized_text) {
            throw new Error('Invalid response from humanization service');
        }
        
        // Show result dialog
        hideHumanizePopup();
        showHumanizeDialog(selectedText, result.humanized_text);
        
    } catch (error) {
        console.error('Error during humanization:', error);
        alert('Failed to humanize text. Please try again.');
    } finally {
        isHumanizing = false;
        const humanizeBtn = document.getElementById('humanize-btn');
        humanizeBtn.textContent = 'Humanize';
        humanizeBtn.disabled = false;
    }
}

// Handle accept/reject of humanized text
function handleHumanizeResult(accepted) {
    console.log('Handling humanize result, accepted:', accepted);
    console.log('Last selection:', lastHumanizedSelection);
    
    if (!editor || !lastHumanizedSelection) {
        console.error('Editor or selection not available');
        return;
    }
    
    if (accepted) {
        const humanizedText = document.getElementById('humanized-text').textContent;
        console.log('Humanized text to insert:', humanizedText);
        
        try {
            // Create a new edit operation
            const editOperation = {
                range: lastHumanizedSelection,
                text: humanizedText,
                forceMoveMarkers: true
            };
            
            console.log('Edit operation:', editOperation);
            
            // Apply the edit
            const result = editor.executeEdits('humanize', [editOperation]);
            console.log('Edit result:', result);
            
            if (!result) {
                throw new Error('Edit operation failed');
            }
            
            // Emit the change to other users
            const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
            const userId = sessionData.uid;
            const params = new URLSearchParams(window.location.search);
            const project = params.get('project');
            
            socket.emit('update_text', { 
                content: editor.getValue(), 
                path: currentFile, 
                uid: userId, 
                project: project 
            });
        } catch (error) {
            console.error('Error applying edit:', error);
            alert('Failed to apply humanized text. Please try again.');
        }
    }
    
    hideHumanizeDialog();
    lastHumanizedSelection = null;
}

// Initialize humanize feature
function initializeHumanizeFeature() {
    if (!editor) return;
    
    // Create dialog elements on initialization
    createHumanizeDialog();
    
    // Add selection change listener
    editor.onDidChangeCursorSelection(handleTextSelection);
    
    // Add click outside listener to hide popup
    document.addEventListener('click', (e) => {
        if (!humanizePopup?.contains(e.target)) {
            hideHumanizePopup();
        }
    });
    
    // Add humanize button click handler
    document.addEventListener('click', (e) => {
        if (e.target.id === 'humanize-btn') {
            handleHumanize();
        }
    });
    
    // Add accept/reject handlers
    document.addEventListener('click', (e) => {
        if (e.target.id === 'accept-humanize') {
            handleHumanizeResult(true);
        } else if (e.target.id === 'reject-humanize') {
            handleHumanizeResult(false);
        }
    });
}

// Listen for real-time text updates
socket.on('text_updated', function(data) {
    // Only update if we're viewing the same file
    if (data.path === currentFile) {
        isApplyingExternalChange = true;
        if (editor && userAccessLevel !== 'viewer') {
            // Get the current cursor position and selections
            const position = editor.getPosition();
            const selections = editor.getSelections();
            
            // Update the content
            editor.setValue(data.content);
            
            // Restore cursor position and selections
            if (position) {
                editor.setPosition(position);
            }
            if (selections) {
                editor.setSelections(selections);
            }
        } else if (userAccessLevel === 'viewer') {
            // Update the read-only view
            const preElement = document.querySelector('#editor-container pre');
            if (preElement) {
                preElement.textContent = data.content;
            }
        }
        isApplyingExternalChange = false;
        
        // If realtime compilation is enabled, trigger a compile
        if (realtimeEnabled) {
            clearTimeout(compileTimeout);
            compileTimeout = setTimeout(compileLatex, 1000);
        }
    }
});

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
  
  if (userAccessLevel === 'viewer') {
    alert('You do not have permission to modify files in view-only mode.');
    hideContextMenu();
    return;
  }

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
      // Only add context menu for editors and owners
      if (userAccessLevel !== 'viewer') {
        li.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          e.stopPropagation();
          contextMenuTarget = li;
          showContextMenu(e.pageX, e.pageY);
        });
      }
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
      // Only add context menu for editors and owners
      if (userAccessLevel !== 'viewer') {
        li.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          e.stopPropagation();
          contextMenuTarget = li;
          showContextMenu(e.pageX, e.pageY);
        });
      }
    }
    ul.appendChild(li);
  });
  container.innerHTML = '';
  container.appendChild(ul);
}

// New File button event handler
document.getElementById('new-file-button').addEventListener('click', function () {
  if (userAccessLevel === 'viewer') {
    alert('You do not have permission to create new files in view-only mode.');
    return;
  }
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
  if (userAccessLevel === 'viewer') {
    alert('You do not have permission to create new folders in view-only mode.');
    return;
  }
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
    // Look for main.tex in the root directory
    currentFile = "main.tex";
    loadFile(currentFile);
    compileLatex();
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
      
      if (userAccessLevel === 'viewer') {
        // For viewers, just display the content in a read-only format
        const editorContainer = document.getElementById('editor-container');
        editorContainer.innerHTML = `
          <div class="h-full bg-[#1e1e1e] text-white p-4 overflow-auto">
            <div class="mb-4 pb-2 border-b border-gray-700">
              <h2 class="text-lg font-semibold">${path}</h2>
              <div class="flex items-center text-sm text-gray-400">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                View-Only Access
              </div>
            </div>
            <pre class="font-mono whitespace-pre-wrap">${data.content}</pre>
          </div>
        `;
      } else if (editor) {
        editor.setValue(data.content);
      }
      
      document.querySelectorAll('#file-explorer .selected').forEach(el => el.classList.remove('selected'));
      const target = document.querySelector(`#file-explorer li[data-path="${data.path}"]`);
      if (target) target.classList.add('selected');
    })
    .catch(err => alert("Could not load file: " + err.message))
    .then(() => {
      updateCompileButtonVisibility();
    });
}

// Function to check user's access level
async function checkUserAccess() {
    try {
        const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
        const currentUserId = sessionData.uid;
        const params = new URLSearchParams(window.location.search);
        const project = params.get('project');

        // Get share hash
        const shareResponse = await fetch('/api/share-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                projectName: project,
                projectPath: project 
            })
        });
        
        if (!shareResponse.ok) {
            throw new Error('Failed to get project information');
        }
        
        const { shareHash } = await shareResponse.json();
        
        // Get collaborators
        const collabResponse = await fetch(`/api/project/collaborators?hash=${shareHash}`);
        if (!collabResponse.ok) {
            throw new Error('Failed to fetch collaborators');
        }
        
        const data = await collabResponse.json();
        
        // Check if user is owner
        if (data.owner.uid === currentUserId) {
            userAccessLevel = 'owner';
        } else {
            // Check if user is a collaborator
            const collaborator = data.collaborators.find(c => c.uid === currentUserId);
            if (collaborator) {
                userAccessLevel = collaborator.access_level;
            } else {
                userAccessLevel = null;
            }
        }

        // Apply access restrictions
        if (editor && userAccessLevel === 'viewer') {
            // Set editor to read-only mode
            editor.updateOptions({ 
                readOnly: true,
                domReadOnly: true,
                cursorBlinking: 'solid'
            });
            
            // Add visual indicator for read-only mode
            const editorContainer = document.getElementById('editor-container');
            const readOnlyIndicator = document.createElement('div');
            readOnlyIndicator.className = 'absolute top-2 right-2 flex items-center bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm';
            readOnlyIndicator.innerHTML = `
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                View Only
            `;
            editorContainer.appendChild(readOnlyIndicator);
        }

        // Hide/show buttons based on access level
        if (userAccessLevel === 'viewer') {
            // Disable new file and folder buttons visually
            document.getElementById('new-file-button')?.classList.add('opacity-50', 'cursor-not-allowed');
            document.getElementById('new-folder-button')?.classList.add('opacity-50', 'cursor-not-allowed');
            
            // Disable realtime toggle
            const realtimeToggle = document.getElementById('realtime-toggle');
            if (realtimeToggle) {
                realtimeToggle.disabled = true;
                realtimeToggle.parentElement.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }

    } catch (error) {
        console.error('Error checking user access:', error);
    }
}

// Function to apply access restrictions based on user's role
function applyAccessRestrictions() {
    if (!editor) return;

    if (userAccessLevel === 'viewer') {
        // Disable editing
        editor.updateOptions({ readOnly: true });
        
        // Disable new file and folder buttons visually
        document.getElementById('new-file-button')?.classList.add('opacity-50', 'cursor-not-allowed');
        document.getElementById('new-folder-button')?.classList.add('opacity-50', 'cursor-not-allowed');
        
        // Disable context menu for files/folders
        const fileExplorer = document.getElementById('file-explorer');
        if (fileExplorer) {
            fileExplorer.querySelectorAll('li').forEach(item => {
                item.removeEventListener('contextmenu', showContextMenu);
            });
        }
        
        // Disable realtime toggle (viewers can't control realtime)
        const realtimeToggle = document.getElementById('realtime-toggle');
        if (realtimeToggle) {
            realtimeToggle.disabled = true;
            realtimeToggle.parentElement.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } else {
        // Enable all features for editors and owners
        editor.updateOptions({ readOnly: false });
        
        // Enable new file and folder buttons visually
        document.getElementById('new-file-button')?.classList.remove('opacity-50', 'cursor-not-allowed');
        document.getElementById('new-folder-button')?.classList.remove('opacity-50', 'cursor-not-allowed');
        
        // Enable realtime toggle
        const realtimeToggle = document.getElementById('realtime-toggle');
        if (realtimeToggle) {
            realtimeToggle.disabled = false;
            realtimeToggle.parentElement.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
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

    // Create editor with initial read-only state
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: '\\documentclass{article}\n\\begin{document}\nHello, LaTeX!\n\\end{document}',
        language: 'latex',
        theme: window.initialMonacoTheme,
        minimap: {enabled: false},
        automaticLayout: false,
        readOnly: true // Start as read-only until access is checked
    });

    // Initialize humanize feature after editor is created
    initializeHumanizeFeature();

    // Check user access and set up editor accordingly
    checkUserAccess().then(() => {
        const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
        const userId = sessionData.uid;
        const params = new URLSearchParams(window.location.search);
        const project = params.get('project');

        if (userAccessLevel !== 'viewer') {
            // Enable editing for non-viewers
            editor.updateOptions({ readOnly: false });
            
            // Set up content change handlers
            editor.getModel().onDidChangeContent(() => {
                // Only emit if the change wasn't from an external update
                if (!isApplyingExternalChange) {
                    socket.emit('update_text', { 
                        content: editor.getValue(), 
                        path: currentFile, 
                        uid: userId, 
                        project: project 
                    });
                    if (realtimeEnabled) {
                        clearTimeout(compileTimeout);
                        compileTimeout = setTimeout(compileLatex, 1000);
                    }
                }
            });
        }

        updateEditorTheme(window.initialMonacoTheme);
        fetchFileTree(initializeEditorWithTexFile);
    });
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

// Function to close collaborators dialog
function closeCollaboratorsDialog() {
    const dialog = document.getElementById('collaborators-dialog');
    if (dialog) {
        dialog.close();
    }
}

// Listen for access level changes
socket.on('access_level_changed', async function(data) {
    try {
        // Get current user's ID
        const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
        const currentUserId = sessionData.uid;
        
        if (data.collaboratorUid === currentUserId) {
            console.log('Access level changed for current user:', data.newAccessLevel);
            
            // Show notification to the user
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50';
            notification.innerHTML = `Your access level has been changed to: ${data.newAccessLevel}`;
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => notification.remove(), 3000);
            
            // Reload the page to apply new permissions
            window.location.reload();
        } else {
            // If the collaborators dialog is open, refresh it
            const dialog = document.getElementById('collaborators-dialog');
            if (dialog && dialog.open) {
                await showCollaborators();
            }
        }
    } catch (error) {
        console.error('Error handling access level change:', error);
    }
});

// Listen for collaborator removal
socket.on('collaborator_removed', async function(data) {
    try {
        // Get current user's ID
        const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
        const currentUserId = sessionData.uid;
        
        if (data.collaboratorUid === currentUserId) {
            console.log('User has been removed from project');
            
            // Show notification to the user
            alert('You have been removed from this project: ' + data.projectName);
            
            // Redirect to home page
            window.location.href = '/';
        } else {
            // If the collaborators dialog is open, refresh it
            const dialog = document.getElementById('collaborators-dialog');
            if (dialog && dialog.open) {
                await showCollaborators();
            }
        }
    } catch (error) {
        console.error('Error handling collaborator removal:', error);
    }
});

// Function to update collaborator access level
async function updateCollaboratorAccess(shareHash, collaboratorUid, accessLevel) {
    try {
        // Emit socket event immediately for real-time update
        socket.emit('update_access_level', {
            shareHash: shareHash,
            collaboratorUid: collaboratorUid,
            newAccessLevel: accessLevel,
            projectName: new URLSearchParams(window.location.search).get('project')
        });

        const response = await fetch('/api/project/collaborator', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                hash: shareHash,
                collaboratorUid: collaboratorUid,
                accessLevel: accessLevel
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update collaborator access');
        }
    } catch (error) {
        console.error('Error updating collaborator access:', error);
        alert('Failed to update collaborator access. Please try again.');
    }
}

// Function to remove collaborator
async function removeCollaborator(shareHash, collaboratorUid) {
    try {
        const response = await fetch('/api/project/collaborator', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                hash: shareHash,
                collaboratorUid: collaboratorUid
            })
        });

        if (!response.ok) {
            throw new Error('Failed to remove collaborator');
        }

        // Get project name from URL
        const projectName = new URLSearchParams(window.location.search).get('project');

        // Emit socket event for real-time update
        socket.emit('collaborator_removed', {
            shareHash: shareHash,
            collaboratorUid: collaboratorUid,
            projectName: projectName
        });

        // Remove the collaborator's element from the UI immediately
        const collaboratorElement = document.querySelector(`div[data-uid="${collaboratorUid}"]`);
        if (collaboratorElement) {
            collaboratorElement.remove();
        }

        // Check if there are any collaborators left
        const collaboratorsList = document.getElementById('collaborators-list');
        const noCollaborators = document.getElementById('no-collaborators');
        if (collaboratorsList && collaboratorsList.children.length === 0) {
            noCollaborators.style.display = 'block';
        }
    } catch (error) {
        console.error('Error removing collaborator:', error);
        alert('Failed to remove collaborator. Please try again.');
    }
}

// Function to show collaborators dialog
async function showCollaborators() {
    const dialog = document.getElementById('collaborators-dialog');
    if (!dialog) {
        console.error('Collaborators dialog not found');
        return;
    }

    try {
        const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
        const currentUserId = sessionData.uid;
        const params = new URLSearchParams(window.location.search);
        const project = params.get('project');

        // Get share hash
        const shareResponse = await fetch('/api/share-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                projectName: project,
                projectPath: project
            })
        });
        
        if (!shareResponse.ok) {
            throw new Error('Failed to get project information');
        }
        
        const { shareHash } = await shareResponse.json();
        
        // Get collaborators
        const collabResponse = await fetch(`/api/project/collaborators?hash=${shareHash}`);
        if (!collabResponse.ok) {
            throw new Error('Failed to fetch collaborators');
        }
        
        const data = await collabResponse.json();
        const isCurrentUserOwner = data.owner.uid === currentUserId;
        
        // Update owner info
        const ownerInfo = document.getElementById('owner-info');
        ownerInfo.innerHTML = `
            <div class="flex items-center justify-between border-b border-gray-700 pb-2">
                <span>${isCurrentUserOwner ? 'Me' : (data.owner.name || data.owner.email)}</span>
                <span class="text-blue-400">Owner</span>
            </div>
        `;
        
        // Update collaborators list
        const collaboratorsList = document.getElementById('collaborators-list');
        const noCollaborators = document.getElementById('no-collaborators');
        
        // Clear existing content
        collaboratorsList.innerHTML = '';
        
        if (!data.collaborators || data.collaborators.length === 0) {
            noCollaborators.style.display = 'block';
        } else {
            noCollaborators.style.display = 'none';
            
            // Add each collaborator
            data.collaborators.forEach(collab => {
                const div = document.createElement('div');
                div.className = 'flex items-center justify-between py-2 border-b border-gray-700';
                div.setAttribute('data-uid', collab.uid); // Add data-uid attribute for easy updates
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = collab.uid === currentUserId ? 'Me' : (collab.name || collab.email);
                
                const accessDiv = document.createElement('div');
                accessDiv.className = 'flex items-center space-x-3';
                
                if (isCurrentUserOwner) {
                    const select = document.createElement('select');
                    select.className = 'bg-[#2d2d2d] text-white border border-gray-700 rounded px-2 py-1 cursor-pointer';
                    
                    const viewerOption = document.createElement('option');
                    viewerOption.value = 'viewer';
                    viewerOption.textContent = 'Viewer';
                    viewerOption.selected = collab.access_level === 'viewer';
                    
                    const editorOption = document.createElement('option');
                    editorOption.value = 'editor';
                    editorOption.textContent = 'Editor';
                    editorOption.selected = collab.access_level === 'editor';
                    
                    select.appendChild(viewerOption);
                    select.appendChild(editorOption);
                    
                    select.addEventListener('change', () => {
                        updateCollaboratorAccess(shareHash, collab.uid, select.value);
                    });
                    
                    accessDiv.appendChild(select);

                    // Add remove button for owner
                    const removeButton = document.createElement('button');
                    removeButton.className = 'ml-2 text-gray-500 hover:text-gray-300 transition-colors duration-200 focus:outline-none';
                    removeButton.innerHTML = `
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    `;
                    removeButton.addEventListener('click', () => {
                        if (confirm('Are you sure you want to remove this collaborator?')) {
                            removeCollaborator(shareHash, collab.uid);
                        }
                    });
                    accessDiv.appendChild(removeButton);
                } else {
                    const accessSpan = document.createElement('span');
                    accessSpan.className = 'text-gray-400 access-level';
                    accessSpan.textContent = collab.access_level === 'viewer' ? 'Viewer' : 'Editor';
                    accessDiv.appendChild(accessSpan);
                }
                
                div.appendChild(nameSpan);
                div.appendChild(accessDiv);
                collaboratorsList.appendChild(div);
            });
        }
        
        // Show the dialog
        dialog.showModal();
        
    } catch (error) {
        console.error('Error showing collaborators:', error);
        alert('Failed to load collaborators. Please try again.');
    }
}

// Add this CSS to make the dialog look better
const style = document.createElement('style');
style.textContent = `
    dialog {
        border: none;
        padding: 0;
        border-radius: 0.5rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 90vw;
    }

    dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.5);
    }

    dialog[open] {
        animation: show-dialog 0.3s ease normal;
    }

    @keyframes show-dialog {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

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
