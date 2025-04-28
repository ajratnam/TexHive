document.addEventListener('DOMContentLoaded', () => {
  const projectListContainer = document.getElementById('project-list');
  const newProjectBtn = document.getElementById('new-project-btn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const emptyState = document.getElementById('empty-state');

  // Add a class to body to help hide editor-specific header items via CSS
  document.body.classList.add('on-projects-page');

  // --- Function to fetch projects ---
  async function fetchProjects() {
    showLoading(true);
    showEmptyState(false);
    projectListContainer.innerHTML = ''; // Clear existing projects

    try {
      // Assume API returns top-level folders/projects for the logged-in user
      // The backend needs to handle authentication to return user-specific projects
      const response = await fetch('/api/files'); // Use your existing file list endpoint
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fileTree = await response.json();

      // Filter for top-level directories (these are our "projects")
      const projects = fileTree.filter(item => item.isDirectory);

      renderProjects(projects);

    } catch (error) {
      console.error("Error fetching projects:", error);
      projectListContainer.innerHTML = `<p class="text-red-500 col-span-full">Error loading projects. Please try again later.</p>`; // Span across grid columns
      showEmptyState(false); // Hide default empty state if there's an error
    } finally {
      showLoading(false);
    }
  }

  // --- Function to render projects ---
  function renderProjects(projects) {
    projectListContainer.innerHTML = ''; // Clear previous content

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
    card.dataset.projectName = project.name; // Store name for potential future use
    card.dataset.projectPath = project.path; // Store path for navigation/API calls

    // Basic card content
    const nameElement = document.createElement('h3');
    nameElement.className = 'text-xl font-semibold mb-2 truncate'; // Truncate long names
    nameElement.textContent = project.name;
    nameElement.title = project.name; // Show full name on hover if truncated

    // Optional: Add last modified date if available from API
    // const modifiedElement = document.createElement('p');
    // modifiedElement.className = 'text-sm text-gray-400';
    // modifiedElement.textContent = `Last modified: ${project.lastModified || 'N/A'}`;

    card.appendChild(nameElement);
    // card.appendChild(modifiedElement);

    // --- Add click listener to navigate to editor ---
    card.addEventListener('click', () => {
      // Navigate to the main editor page.
      // The editor's file explorer should show this project folder.
      // Optionally, pass project info via query params if editor needs it
      window.location.href = `/editor?project=${encodeURIComponent(project.path)}`; // Navigate to editor, file explorer will show root
    });

    return card;
  }

  // --- Function to handle new project creation ---
  async function createNewProject() {
    const projectName = prompt("Enter a name for the new project:");

    if (projectName && projectName.trim() !== "") {
      const cleanProjectName = projectName.trim();
      showLoading(true); // Show loading while creating

      try {
        // Use the existing folder creation endpoint
        const response = await fetch('/api/folder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // Assuming the API expects just the folder name at the root
          body: JSON.stringify({ path: cleanProjectName }),
        });

        if (!response.ok) {
           const errorData = await response.json().catch(() => ({})); // Try to get error details
           throw new Error(`Failed to create project: ${errorData.error || response.statusText}`);
        }

        // Refresh the project list after successful creation
        await fetchProjects();

      } catch (error) {
        console.error("Error creating project:", error);
        alert(`Could not create project: ${error.message}`);
        showLoading(false); // Hide loading on error
      }
      // Loading is hidden by fetchProjects on success
    } else if (projectName !== null) { // Handle empty input vs Cancel
        alert("Project name cannot be empty.");
    }
  }

  // --- Helper functions for UI states ---
  function showLoading(isLoading) {
    loadingIndicator.classList.toggle('hidden', !isLoading);
    // Optionally disable button while loading
    if (newProjectBtn) newProjectBtn.disabled = isLoading;
  }

  function showEmptyState(isEmpty) {
    emptyState.classList.toggle('hidden', !isEmpty);
  }

  // --- Event Listeners ---
  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', createNewProject);
  }

  // --- Initial Load ---
  // Check if Firebase auth is ready before fetching, or rely on the check in projects.html
  fetchProjects();

  // Cleanup the body class when navigating away (optional, depends on SPA behavior)
  window.addEventListener('beforeunload', () => {
    document.body.classList.remove('on-projects-page');
  });
});