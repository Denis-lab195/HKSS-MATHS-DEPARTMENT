// UI Module - Handles all UI-related functions
const UIManager = (function() {
    function showMainApp(user) {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('loggedInUser').textContent = user.name;
        updateDateTime();
        setupRealtimeListeners();
    }

    function showLoginPage() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }

    function showSection(sectionId) {
        document.querySelectorAll('.content-section').forEach(el => {
            el.style.display = 'none';
        });
        
        const selectedSection = document.getElementById(sectionId);
        if (selectedSection) {
            selectedSection.style.display = 'block';
        }
        
        document.querySelectorAll('.sidebar-custom .nav-link').forEach(link => {
            link.classList.remove('active');
        });
    }
    function buildAdminSidebar() {
        const sidebar = document.getElementById('sidebarNav');
        sidebar.innerHTML = `
            <li class="nav-item">
                <a class="nav-link active" onclick="UIManager.showSection('dashboard-section'); AdminDashboard.loadDashboardStats()">
                    <i class="fas fa-tachometer-alt"></i> Dashboard
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" onclick="UIManager.showSection('admin-dashboard-section'); AdminDashboard.loadAdminDashboardData()">
                    <i class="fas fa-user-cog"></i> Admin Panel
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" onclick="UIManager.showSection('complete-analytics-section'); initAnalyticsControls(); displayStoredAnalytics()">
                    <i class="fas fa-chart-pie"></i> Complete Analytics
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" onclick="UIManager.showSection('cat-analytics-section'); loadCATAnalytics()">
                    <i class="fas fa-calendar-alt"></i> CAT Analysis
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" onclick="UIManager.showSection('students-section'); AdminDashboard.loadStudents()">
                    <i class="fas fa-users"></i> Students
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" onclick="UIManager.showSection('bulkUpload-section')">
                    <i class="fas fa-upload"></i> Bulk Upload
                </a>
            </li>
        `;
    
    
    }
    function buildTeacherSidebar() {
        const sidebar = document.getElementById('sidebarNav');
        sidebar.innerHTML = `
            <li class="nav-item">
                <a class="nav-link active" onclick="UIManager.showSection('teacher-dashboard-section'); TeacherDashboard.loadTeacherStats()">
                    <i class="fas fa-tachometer-alt"></i> My Dashboard
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" onclick="UIManager.showSection('enter-marks-section'); TeacherDashboard.loadTeacherWeeks()">
                    <i class="fas fa-edit"></i> Enter Marks
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" onclick="UIManager.showSection('teacher-analytics-section'); teacherViewAnalytics()">
                    <i class="fas fa-chart-pie"></i> Class Analytics
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" onclick="UIManager.showSection('teacher-cat-analytics-section'); teacherViewCATAnalytics()">
                    <i class="fas fa-calendar-alt"></i> CAT Analysis
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" onclick="UIManager.showSection('my-class-analysis-section'); TeacherDashboard.loadTeacherWeeksForAnalysis()">
                    <i class="fas fa-chart-line"></i> Detailed Analysis
                </a>
            </li>
        `;
    }

    function updateDateTime() {
        const now = new Date();
        document.getElementById('currentDateTime').textContent = now.toLocaleString();
        setTimeout(updateDateTime, 1000);
    }

    function clearModalFields(modalId) {
        const modal = document.getElementById(modalId);
        const inputs = modal.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.type !== 'button' && input.type !== 'submit') {
                if (input.tagName === 'SELECT') {
                    input.selectedIndex = 0;
                } else {
                    input.value = '';
                }
            }
        });
    }

    // Return public methods
    return {
        showMainApp: showMainApp,
        showLoginPage: showLoginPage,
        showSection: showSection,
        buildAdminSidebar: buildAdminSidebar,
        buildTeacherSidebar: buildTeacherSidebar,
        updateDateTime: updateDateTime,
        clearModalFields: clearModalFields
    };
})();

// Utility functions
const Utils = {
    readExcelFile: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsBinaryString(file);
        });
    }
};

// Make globally available
window.UIManager = UIManager;
window.Utils = Utils;

// Setup realtime listeners function
function setupRealtimeListeners() {
    try {
        const userType = window.Auth ? window.Auth.getCurrentUserType() : null;
        
        if (window.db) {
            window.db.collection('students').onSnapshot(() => {
                if (userType === 'admin') {
                    if (window.AdminDashboard) {
                        window.AdminDashboard.loadDashboardStats();
                        if (document.getElementById('students-section') && 
                            document.getElementById('students-section').style.display !== 'none') {
                            window.AdminDashboard.loadStudents();
                        }
                    }
                }
            });

            window.db.collection('marks').onSnapshot(() => {
                if (userType === 'teacher') {
                    if (window.TeacherDashboard && 
                        document.getElementById('my-class-analysis-section') && 
                        document.getElementById('my-class-analysis-section').style.display !== 'none') {
                        window.TeacherDashboard.loadMyClassAnalysis();
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error setting up listeners:', error);
    }
}