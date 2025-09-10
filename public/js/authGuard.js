// Simple auth protection - redirects to sign-in if not authenticated
async function protectPage() {    
    try {
        await Clerk.load();
        
        // If no session, redirect to sign-in
        if (!Clerk.user) {
            Clerk.redirectToSignIn({ redirectUrl: '/dev/auth/' });
            return;
        }
        
        console.log('User authenticated:', Clerk.user?.fullName);
    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = '/dev/auth/';
    }
}

// Auto-protect page when it loads
window.addEventListener('load', protectPage);
