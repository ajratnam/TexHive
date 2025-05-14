// Get current user information
let currentUser = null;

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

// Function to show collaborators in a dialog
async function showCollaboratorsDialog() {
    try {
        // Get the project name from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const projectName = urlParams.get('project');
        
        if (!projectName) {
            throw new Error('No project selected');
        }

        // First get the share hash
        const response = await fetch('/api/share-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                projectName: projectName,
                projectPath: projectName 
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to get project information');
        }
        
        const data = await response.json();
        const shareHash = data.shareHash;
        
        // Fetch collaborators
        const collabResponse = await fetch(`/api/project/collaborators?hash=${shareHash}`);
        if (!collabResponse.ok) {
            throw new Error('Failed to fetch collaborators');
        }
        
        const collabData = await collabResponse.json();
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'dialog-overlay';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h2 class="text-xl font-bold">Project Collaborators</h2>
                    <button class="text-gray-500 hover:text-gray-700" onclick="this.closest('.dialog-overlay').remove()">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div class="dialog-body">
                    <div class="mb-4">
                        <h3 class="font-semibold mb-2">Owner</h3>
                        <div class="collaborator-item">
                            <span>${collabData.owner.uid === currentUser.uid ? 'Me' : (collabData.owner.name || collabData.owner.email)}</span>
                            <span class="text-sm text-gray-600">Owner</span>
                        </div>
                    </div>
                    <div>
                        <h3 class="font-semibold mb-2">Collaborators</h3>
                        <div class="collaborator-list">
                            ${collabData.collaborators.length === 0 ? 
                                '<p class="text-gray-500 p-2">No collaborators yet.</p>' : 
                                collabData.collaborators.map(collab => `
                                    <div class="collaborator-item">
                                        <span>${collab.uid === currentUser.uid ? 'Me' : (collab.name || collab.email)}</span>
                                        <span class="text-sm text-gray-600">${collab.access_level}</span>
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded" 
                            onclick="this.closest('.dialog-overlay').remove()">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
    } catch (error) {
        console.error('Error showing collaborators:', error);
        alert('Failed to load collaborators');
    }
}

// Initialize current user when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getCurrentUser();
    
    // Add click handler for collaborators button
    const collaboratorsBtn = document.getElementById('collaborators-btn');
    if (collaboratorsBtn) {
        collaboratorsBtn.onclick = showCollaboratorsDialog;
    }
}); 