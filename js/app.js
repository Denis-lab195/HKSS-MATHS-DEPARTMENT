// Main Application Entry Point
document.addEventListener('DOMContentLoaded', function() {
    console.log('Application loaded. Please create the required indexes in Firebase Console.');
    
    // Make modules globally available for onclick handlers
    window.Auth = Auth;
    window.AdminDashboard = AdminDashboard;
    window.TeacherDashboard = TeacherDashboard;
    window.UIManager = UIManager;
    
    // Expose specific functions for onclick handlers
    window.handleLogin = Auth.handleLogin;
    window.logout = Auth.logout;
    
    // Admin functions
    window.showAddTeacherModal = AdminDashboard.showAddTeacherModal;
    window.showCreateWeekModal = AdminDashboard.showCreateWeekModal;
    window.showAddStudentModal = AdminDashboard.showAddStudentModal;
    window.showBulkUploadSection = AdminDashboard.showBulkUploadSection;
    window.uploadBulkStudents = AdminDashboard.uploadBulkStudents;
    window.filterStudents = AdminDashboard.filterStudents;
    window.saveTeacher = AdminDashboard.saveTeacher;
    window.saveNewStudent = AdminDashboard.saveNewStudent;
    window.saveNewWeek = AdminDashboard.saveNewWeek;
    
    // Teacher functions
    window.loadMyStudentsForMarks = TeacherDashboard.loadMyStudentsForMarks;
    window.updateMark = TeacherDashboard.updateMark;this.activeElement
    window.saveAllMarks = TeacherDashboard.saveAllMarks;
    window.loadMyClassAnalysis = TeacherDashboard.loadMyClassAnalysis;
});