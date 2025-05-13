// Function to close collaborators dialog
function closeCollaboratorsDialog() {
    const dialog = document.getElementById('collaborators-dialog');
    if (dialog) {
        dialog.close();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const projectListContainer = document.getElementById('project-list');
    const newProjectBtn = document.getElementById('new-project-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    const contextMenu = document.getElementById('context-menu'); // Get the context menu element
    let projectContextMenuTarget = null; // Variable to store the card that was right-clicked
    let currentUser = null;

    // Add a class to body to help hide editor-specific header items via CSS
    document.body.classList.add('on-projects-page');

    // Get current user information
    async function getCurrentUser() {
        try {
            const token = document.cookie.split('; ').find(row => row.startsWith('token=')).split('=')[1];
            const response = await fetch('/verify-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            if (!response.ok) throw new Error('Failed to verify token');
            const data = await response.json();
            currentUser = { uid: data.uid };
            return currentUser;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }

    currentUser = await getCurrentUser();

    // --- Context Menu Handling ---

    // Show the custom context menu
    function showContextMenu(x, y) {
        if (!contextMenu) return;
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.classList.remove('hidden');
    }

    // Hide the custom context menu
    function hideContextMenu() {
        if (!contextMenu) return;
        contextMenu.classList.add('hidden');
        projectContextMenuTarget = null; // Clear the target when hiding
    }

    // Hide context menu on clicking anywhere else on the page
    document.addEventListener('click', (event) => {
        // Only hide if the click is outside the context menu itself
        if (contextMenu && !contextMenu.contains(event.target)) {
           hideContextMenu();
        }
    });

    // Prevent default right-click menu on the context menu itself
    if (contextMenu) {
        contextMenu.addEventListener('contextmenu', (e) => e.preventDefault());
    }


    // --- Function to fetch projects ---
    async function fetchProjects() {
        showLoading(true);
        showEmptyState(false);
        projectListContainer.innerHTML = ''; // Clear existing projects

        try {
            const response = await fetch('/api/files'); // Fetch root level items
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const fileTree = await response.json();
            const projects = fileTree.filter(item => item.isDirectory); // Filter for directories (projects)
            renderProjects(projects);

        } catch (error) {
            console.error("Error fetching projects:", error);
            projectListContainer.innerHTML = `<p class="text-red-500 col-span-full">Error loading projects. Please try again later.</p>`;
            showEmptyState(false);
        } finally {
            showLoading(false);
        }
    }

    // --- Function to render projects ---
    function renderProjects(projects) {
        projectListContainer.innerHTML = '';
        if (!projects || projects.length === 0) {
            showEmptyState(true);
            return;
        }
        showEmptyState(false);
        projects.forEach(project => {
            const card = createProjectCard(project);
            projectListContainer.appendChild(card);
        });
    }

    // --- Function to create a single project card element ---
    function createProjectCard(project) {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.setAttribute('data-project-name', project.name);
        card.setAttribute('data-project-path', project.path);
        
        const cardContent = document.createElement('div');
        cardContent.className = 'flex justify-between items-center';
        
        // Left content with project name
        const leftContent = document.createElement('div');
        leftContent.className = 'flex-1';
        leftContent.innerHTML = `
            <h3 class="text-lg font-semibold mb-1">${project.name}</h3>
        `;
        
        // Buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'flex space-x-2';
        
        // Share button
        const shareButton = document.createElement('button');
        shareButton.className = 'px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm flex items-center';
        shareButton.innerHTML = `
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
        `;
        shareButton.onclick = async (e) => {
            e.stopPropagation(); // Prevent navigation to editor
            try {
                const response = await fetch('/api/share-project', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        projectName: project.name,
                        projectPath: project.path 
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to share project');
                }
                
                const data = await response.json();
                const shareUrl = window.location.origin + '/join-project/' + data.shareHash;
                
                // Create a temporary input to copy the URL
                const tempInput = document.createElement('input');
                tempInput.value = shareUrl;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                
                alert('Share link copied to clipboard: ' + shareUrl);
            } catch (error) {
                console.error('Error sharing project:', error);
                alert('Failed to share project. Please try again.');
            }
        };

        // Collaborators button
        const collabButton = document.createElement('button');
        collabButton.className = 'px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm flex items-center';
        collabButton.innerHTML = `
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Collaborators
        `;
        collabButton.onclick = (e) => {
            e.stopPropagation(); // Prevent navigation to editor
            showCollaboratorsDialog(project.name, project.path);
        };

        // Add buttons to container
        buttonsContainer.appendChild(shareButton);
        buttonsContainer.appendChild(collabButton);

        // Add all elements to the card
        cardContent.appendChild(leftContent);
        cardContent.appendChild(buttonsContainer);
        card.appendChild(cardContent);

        // Click listener to navigate to editor
        card.addEventListener('click', () => {
            window.location.href = `/editor?project=${encodeURIComponent(project.path)}`;
        });

        // Right-click listener for context menu
        card.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            projectContextMenuTarget = card;
            showContextMenu(event.pageX, event.pageY);
        });

        return card;
    }

    // --- Function to handle new project creation ---
    async function createNewProject() {
        const projectName = prompt("Enter a name for the new project:");
        if (projectName && projectName.trim() !== "") {
            const cleanProjectName = projectName.trim();
            showLoading(true);
            try {
                const response = await fetch('/api/folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: cleanProjectName }), // Create at root
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Failed to create project: ${errorData.error || response.statusText}`);
                }
                await fetchProjects(); // Refresh list
            } catch (error) {
                console.error("Error creating project:", error);
                alert(`Could not create project: ${error.message}`);
                showLoading(false);
            }
        } else if (projectName !== null) {
            alert("Project name cannot be empty.");
        }
    }

    // --- Helper functions for UI states ---
    function showLoading(isLoading) {
        loadingIndicator.classList.toggle('hidden', !isLoading);
        if (newProjectBtn) newProjectBtn.disabled = isLoading;
    }

    function showEmptyState(isEmpty) {
        emptyState.classList.toggle('hidden', !isEmpty);
    }

    // --- Event Listeners ---
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', createNewProject);
    }

    // --- Context Menu Action Handler ---
    if (contextMenu) {
        contextMenu.addEventListener('click', async (e) => {
            const action = e.target.getAttribute('data-action');
            if (!action || !projectContextMenuTarget) {
                hideContextMenu(); // Hide if clicked outside an action item or no target
                return;
            }

            const projectPath = projectContextMenuTarget.dataset.projectPath;
            const currentName = projectContextMenuTarget.dataset.projectName; // Get name for prompts

            hideContextMenu(); // Hide menu immediately after action selected

            if (action === "rename") {
                const newName = prompt(`Enter new name for project "${currentName}":`, currentName);

                // Proceed only if a new name was entered and it's different
                if (newName && newName.trim() !== "" && newName.trim() !== currentName) {
                    const cleanNewName = newName.trim();
                    showLoading(true); // Show loading indicator during API call
                    try {
                        const response = await fetch('/api/file/rename', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            // Assuming API takes old path (which is just the folder name for root projects)
                            // and new path (which is just the new folder name)
                            // Adjust if your API expects full paths differently
                            body: JSON.stringify({ oldPath: projectPath, newPath: cleanNewName })
                        });

                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(`Rename failed: ${errorData.error || response.statusText}`);
                        }
                        await fetchProjects(); // Refresh project list on success
                    } catch (err) {
                        console.error("Error renaming project:", err);
                        alert("Error renaming project: " + err.message);
                        showLoading(false); // Hide loading on error
                    }
                } else if (newName && newName.trim() === currentName) {
                    // No change, do nothing
                } else if (newName !== null) { // User entered empty string
                    alert("New project name cannot be empty.");
                } // If newName is null, user cancelled prompt

            } else if (action === "delete") {
                if (confirm(`Are you sure you want to delete the project "${currentName}"?\nThis action cannot be undone.`)) {
                    showLoading(true); // Show loading indicator
                    try {
                        const response = await fetch('/api/file?path=' + encodeURIComponent(projectPath), {
                            method: 'DELETE'
                        });

                        if (!response.ok) {
                           const errorData = await response.json().catch(() => ({}));
                            throw new Error(`Deletion failed: ${errorData.error || response.statusText}`);
                        }
                        await fetchProjects(); // Refresh project list on success
                    } catch (err) {
                        console.error("Error deleting project:", err);
                        alert("Error deleting project: " + err.message);
                        showLoading(false); // Hide loading on error
                    }
                }
            }
        });
    }

    // Function to update collaborator access level
    async function updateCollaboratorAccess(shareHash, collaboratorUid, accessLevel) {
        try {
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

            // Refresh the collaborators dialog
            const dialog = document.getElementById('collaborators-dialog');
            if (dialog) {
                // Get the current project name and path from the dialog's data attributes
                const projectName = dialog.getAttribute('data-project-name');
                const projectPath = dialog.getAttribute('data-project-path');
                
                // Close and reopen the dialog with updated data
                dialog.close();
                await showCollaboratorsDialog(projectName, projectPath);
            }
        } catch (error) {
            console.error('Error updating collaborator access:', error);
            alert('Failed to update collaborator access. Please try again.');
        }
    }

    // Function to show collaborators dialog
    async function showCollaboratorsDialog(projectName, projectPath) {
        try {
            const dialog = document.getElementById('collaborators-dialog');
            if (!dialog) {
                console.error('Collaborators dialog not found');
                return;
            }

            const sessionData = JSON.parse(sessionStorage.getItem('userDetails'));
            const currentUserId = sessionData.uid;

            // Store project info in dialog's data attributes
            dialog.setAttribute('data-project-name', projectName);
            dialog.setAttribute('data-project-path', projectPath);

            const response = await fetch('/api/share-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectName: projectName,
                    projectPath: projectPath 
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to get project information');
            }
            
            const data = await response.json();
            const shareHash = data.shareHash;
            
            // Get collaborators
            const collabResponse = await fetch(`/api/project/collaborators?hash=${shareHash}`);
            if (!collabResponse.ok) {
                throw new Error('Failed to fetch collaborators');
            }
            
            const collabData = await collabResponse.json();
            const isCurrentUserOwner = collabData.owner.uid === currentUserId;
            
            // Update owner info
            const ownerInfo = document.getElementById('owner-info');
            ownerInfo.innerHTML = `
                <div class="flex items-center justify-between border-b border-gray-700 pb-2">
                    <span>${collabData.owner.uid === currentUserId ? 'Me' : (collabData.owner.name || collabData.owner.email)}</span>
                    <span class="text-blue-400">Owner</span>
                </div>
            `;
            
            // Update collaborators list
            const collaboratorsList = document.getElementById('collaborators-list');
            const noCollaborators = document.getElementById('no-collaborators');
            
            // Clear existing content
            collaboratorsList.innerHTML = '';
            
            if (!collabData.collaborators || collabData.collaborators.length === 0) {
                noCollaborators.style.display = 'block';
            } else {
                noCollaborators.style.display = 'none';
                
                // Add each collaborator
                collabData.collaborators.forEach(collab => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between py-2 border-b border-gray-700';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = collab.uid === currentUserId ? 'Me' : (collab.name || collab.email);
                    
                    const accessDiv = document.createElement('div');
                    accessDiv.className = 'flex items-center space-x-3';
                    
                    if (isCurrentUserOwner) {
                        const select = document.createElement('select');
                        select.className = 'bg-[#2d2d2d] text-white border border-gray-700 rounded px-2 py-1';
                        
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
                    } else {
                        const accessSpan = document.createElement('span');
                        accessSpan.className = 'text-gray-400';
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
            alert('Failed to load collaborators');
        }
    }

    // --- Initial Load ---
    fetchProjects();

    // Cleanup the body class when navigating away
    window.addEventListener('beforeunload', () => {
        document.body.classList.remove('on-projects-page');
    });
});