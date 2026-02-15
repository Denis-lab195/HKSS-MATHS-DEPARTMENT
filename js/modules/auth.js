// Auth Module - Handles login, logout, and user session
const Auth = (function() {
    let currentUser = null;
    let currentUserType = null;

    function handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const userType = document.getElementById('userType').value;

        if (userType === 'admin') {
            if (username === 'admin' && password === 'admin') {
                currentUser = { name: 'Admin', type: 'admin' };
                currentUserType = 'admin';
                UIManager.showMainApp(currentUser);
                AdminDashboard.loadAdminDashboard();
            } else {
                Swal.fire('Error', 'Invalid admin credentials', 'error');
            }
        } else {
            loginTeacher(username, password);
        }
    }

    async function loginTeacher(username, password) {
        try {
            const teachersSnapshot = await db.collection('teachers')
                .where('username', '==', username)
                .where('password', '==', password)
                .get();

            if (!teachersSnapshot.empty) {
                const teacherDoc = teachersSnapshot.docs[0];
                currentUser = {
                    id: teacherDoc.id,
                    ...teacherDoc.data(),
                    type: 'teacher'
                };
                currentUserType = 'teacher';
                UIManager.showMainApp(currentUser);
                TeacherDashboard.loadTeacherDashboard();
            } else {
                Swal.fire('Error', 'Invalid teacher credentials', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            Swal.fire('Error', 'Login failed', 'error');
        }
    }

    function logout() {
        currentUser = null;
        currentUserType = null;
        UIManager.showLoginPage();
    }

    function getCurrentUser() {
        return currentUser;
    }

    function getCurrentUserType() {
        return currentUserType;
    }

    return {
        handleLogin,
        logout,
        getCurrentUser,
        getCurrentUserType
    };
})();