/**
 * AuthManager - Handles authentication flow and token verification
 */
class AuthManager {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * Initialize the authentication process
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            await Clerk.load();
            this.isInitialized = true;
            await this.handleAuthentication();
        } catch (error) {
            console.error("Authentication initialization error:", error);
            this.redirectToDashboard();
        }
    }

    /**
     * Handle the authentication flow
     */
    async handleAuthentication() {
        try {
            // Get the active session
            const session = Clerk.session;
            if (!session) {
                console.log("No active session found, redirecting to dashboard");
                this.redirectToDashboard();
                return;
            }

            // Get session token
            const sessionToken = await session.getToken();

            // Get user information
            const user = Clerk.user;
            const userId = user.id;
            const fullName = user.fullName;
            const email = user.emailAddress;

            // Send sessionToken to backend for verification
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({
                    userId,
                    fullName,
                    email
                })
            });

            const data = await response.json();

            if (data.authenticated) {
                console.log('Authentication successful, redirecting to dashboard...');
                this.redirectToDashboard();
            } else {
                console.error('Authentication failed:', data.error);
                this.redirectToDashboard();
            }

        } catch (error) {
            console.error("Authentication error:", error);
            this.redirectToDashboard();
        }
    }

    /**
     * Redirect to dashboard
     */
    redirectToDashboard() {
        window.location.href = '/dev/index.html';
    }
}

// Initialize auth manager when DOM is loaded
window.addEventListener("load", () => {
    const authManager = new AuthManager();
    authManager
        .initialize()
        .then(async () => {
            if (!Clerk.user) {
                try {
                    await Clerk.redirectToSignIn({
                        redirectUrl: '/dev/auth/'
                    });
                } catch (err) {
                    console.error("Failed to redirect to sign-in:", err);
                    this.notificationManager.showNotification("Error starting sign-in process", "error");
                }
            }
        })


});
