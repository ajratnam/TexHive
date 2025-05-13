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

// Initialize current user when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getCurrentUser();
}); 