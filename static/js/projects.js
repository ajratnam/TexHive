document.addEventListener('DOMContentLoaded', () => {
    const projectListContainer = document.getElementById('project-list');
    const newProjectBtn = document.getElementById('new-project-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    const contextMenu = document.getElementById('context-menu'); // Get the context menu element
    let projectContextMenuTarget = null; // Variable to store the card that was right-clicked

    // Add a class to body to help hide editor-specific header items via CSS
    document.body.classList.add('on-projects-page');

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
        card.dataset.projectName = project.name;
        card.dataset.projectPath = project.path;

        const cardContent = document.createElement('div');
        cardContent.className = 'flex justify-between items-start';

        const leftContent = document.createElement('div');
        leftContent.className = 'flex-grow';

        const nameElement = document.createElement('h3');
        nameElement.className = 'text-xl font-semibold mb-2 truncate';
        nameElement.textContent = project.name;
        nameElement.title = project.name;
        leftContent.appendChild(nameElement);

        const shareButton = document.createElement('button');
        shareButton.className = 'px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm';
        shareButton.textContent = 'Share';
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

        cardContent.appendChild(leftContent);
        cardContent.appendChild(shareButton);
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


    // --- Initial Load ---
    fetchProjects();

    // Cleanup the body class when navigating away
    window.addEventListener('beforeunload', () => {
        document.body.classList.remove('on-projects-page');
    });
});