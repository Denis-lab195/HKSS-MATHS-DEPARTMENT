// Teacher Module - Handles all teacher functionality
const TeacherDashboard = (function() {
    let myTrendChart = null;
    const pendingMarks = new Map();

    async function loadTeacherDashboard() {
        const currentUser = Auth.getCurrentUser();
        UIManager.buildTeacherSidebar();
        UIManager.showSection('teacher-dashboard-section');
        document.getElementById('teacherClass').textContent = `Class: ${currentUser.assignedClass}`;
        await loadTeacherStats();
    }

    async function loadTeacherStats() {
        const currentUser = Auth.getCurrentUser();
        try {
            // Get ONLY students from teacher's assigned class
            const studentsSnapshot = await db.collection('students')
                .where('form', '==', currentUser.assignedClass)
                .get();
            document.getElementById('myStudentsCount').textContent = studentsSnapshot.size;

            const weeksSnapshot = await db.collection('weeks').get();
            document.getElementById('myWeeksCount').textContent = weeksSnapshot.size;

            // Calculate class average from ONLY teacher's students
            let totalMarks = 0;
            let studentCount = 0;
            
            // Get all marks
            const marksSnapshot = await db.collection('marks').get();
            
            for (const doc of marksSnapshot.docs) {
                const mark = doc.data();
                // Only include if student belongs to teacher's class
                const studentDoc = await db.collection('students').doc(mark.studentId).get();
                if (studentDoc.exists && studentDoc.data().form === currentUser.assignedClass) {
                    totalMarks += mark.marks;
                    studentCount++;
                }
            }
            
            const avgScore = studentCount > 0 ? (totalMarks / studentCount).toFixed(1) : 0;
            document.getElementById('myClassAvg').textContent = avgScore + '%';
        } catch (error) {
            console.error('Error loading teacher stats:', error);
        }
    }

    async function loadTeacherWeeks() {
        try {
            let snapshot;
            try {
                // Try with orderBy first
                snapshot = await db.collection('weeks').orderBy('term').orderBy('weekNumber').get();
            } catch (indexError) {
                console.log('Index not ready, falling back to simple query');
                // Fallback to simple query
                snapshot = await db.collection('weeks').get();
            }
            
            let options = '<option value="">Select Week</option>';
            
            if (!snapshot.empty) {
                // Sort manually if needed
                let weeks = [];
                snapshot.forEach(doc => {
                    weeks.push({ id: doc.id, ...doc.data() });
                });
                
                // Manual sorting
                weeks.sort((a, b) => {
                    if (a.term !== b.term) return a.term - b.term;
                    return a.weekNumber - b.weekNumber;
                });
                
                weeks.forEach(week => {
                    options += `<option value="${week.id}">Term ${week.term} Week ${week.weekNumber} - ${week.description || ''}</option>`;
                });
            }
            
            document.getElementById('teacherWeekSelect').innerHTML = options;
            document.getElementById('teacherAnalysisWeekSelect').innerHTML = options;
        } catch (error) {
            console.error('Error loading weeks:', error);
            Swal.fire('Error', 'Failed to load weeks', 'error');
        }
    }

    async function loadMyStudentsForMarks() {
        const weekId = document.getElementById('teacherWeekSelect').value;
        const currentUser = Auth.getCurrentUser();
        
        if (!weekId) {
            Swal.fire('Info', 'Please select a week first', 'info');
            return;
        }

        try {
            // Get ONLY students from teacher's assigned class
            const studentsSnapshot = await db.collection('students')
                .where('form', '==', currentUser.assignedClass)
                .orderBy('admNo')
                .get();

            if (studentsSnapshot.empty) {
                document.getElementById('teacherMarksTableBody').innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center">
                            <div class="alert alert-info mb-0">
                                <i class="fas fa-info-circle me-2"></i>
                                No students found in your class (${currentUser.assignedClass})
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            let html = '';
            let hasMarks = false;
            
            for (const doc of studentsSnapshot.docs) {
                const student = doc.data();
                
                // Check if marks exist for this student and week
                const marksSnapshot = await db.collection('marks')
                    .where('studentId', '==', doc.id)
                    .where('weekId', '==', weekId)
                    .get();
                
                const existingMark = !marksSnapshot.empty ? marksSnapshot.docs[0].data().marks : '';
                if (existingMark) hasMarks = true;
                
                html += `
                    <tr>
                        <td>${student.admNo || ''}</td>
                        <td>${student.name || ''}</td>
                        <td>${student.gender === 'M' ? 'Male' : 'Female'}</td>
                        <td>
                            <input type="number" class="form-control mark-input" 
                                   data-student-id="${doc.id}"
                                   data-student-name="${student.name}"
                                   min="0" max="100" 
                                   value="${existingMark}"
                                   onchange="TeacherDashboard.updateMark('${doc.id}', this.value)"
                                   placeholder="0-100">
                        </td>
                        <td>
                            <span class="badge ${existingMark ? 'bg-success' : 'bg-warning'} mark-status" id="status-${doc.id}">
                                ${existingMark ? 'Saved' : 'Pending'}
                            </span>
                        </td>
                    </tr>
                `;
            }
            
            document.getElementById('teacherMarksTableBody').innerHTML = html;
            
            // Show class info
            Swal.fire({
                icon: 'info',
                title: 'Class Loaded',
                html: `
                    <strong>Class:</strong> ${currentUser.assignedClass}<br>
                    <strong>Students:</strong> ${studentsSnapshot.size}<br>
                    <strong>Marks entered:</strong> ${hasMarks ? 'Yes' : 'No'}
                `,
                timer: 2000,
                showConfirmButton: false
            });
            
        } catch (error) {
            console.error('Error loading students:', error);
            Swal.fire('Error', 'Failed to load students', 'error');
        }
    }

    function updateMark(studentId, value) {
        const weekId = document.getElementById('teacherWeekSelect').value;
        const currentUser = Auth.getCurrentUser();
        
        if (!weekId) return;
        
        if (value === '') {
            pendingMarks.delete(`${weekId}_${studentId}`);
            document.getElementById(`status-${studentId}`).textContent = 'Pending';
            document.getElementById(`status-${studentId}`).className = 'badge bg-warning mark-status';
            return;
        }
        
        const markValue = parseInt(value);
        if (markValue >= 0 && markValue <= 100) {
            pendingMarks.set(`${weekId}_${studentId}`, {
                studentId: studentId, 
                weekId: weekId, 
                marks: markValue,
                teacherId: currentUser.id,
                teacherName: currentUser.name,
                class: currentUser.assignedClass
            });
            
            // Update status indicator
            document.getElementById(`status-${studentId}`).textContent = 'Unsaved';
            document.getElementById(`status-${studentId}`).className = 'badge bg-info mark-status';
        } else {
            Swal.fire('Warning', 'Marks must be between 0 and 100', 'warning');
        }
    }

    async function saveAllMarks() {
        const weekId = document.getElementById('teacherWeekSelect').value;
        const currentUser = Auth.getCurrentUser();
        
        if (!weekId) {
            Swal.fire('Error', 'Please select a week', 'error');
            return;
        }

        if (pendingMarks.size === 0) {
            Swal.fire('Info', 'No new marks to save', 'info');
            return;
        }

        // Confirm before saving
        const confirmResult = await Swal.fire({
            title: 'Save Marks?',
            html: `You are about to save <strong>${pendingMarks.size}</strong> marks for <strong>${currentUser.assignedClass}</strong>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#800000',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, save them!'
        });

        if (!confirmResult.isConfirmed) return;

        try {
            const batch = db.batch();
            let savedCount = 0;

            for (const [key, markData] of pendingMarks) {
                if (markData.weekId === weekId) {
                    // Check if marks already exist
                    const marksSnapshot = await db.collection('marks')
                        .where('studentId', '==', markData.studentId)
                        .where('weekId', '==', weekId)
                        .get();

                    if (!marksSnapshot.empty) {
                        // Update existing marks
                        batch.update(marksSnapshot.docs[0].ref, {
                            marks: markData.marks,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedBy: currentUser.name,
                            class: currentUser.assignedClass
                        });
                    } else {
                        // Create new marks
                        const newMarkRef = db.collection('marks').doc();
                        batch.set(newMarkRef, {
                            studentId: markData.studentId,
                            weekId: markData.weekId,
                            marks: markData.marks,
                            class: currentUser.assignedClass,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            enteredBy: currentUser.name,
                            teacherId: currentUser.id
                        });
                    }
                    savedCount++;
                }
            }

            await batch.commit();
            
            // Clear pending marks for this week
            for (const [key, markData] of pendingMarks) {
                if (markData.weekId === weekId) {
                    pendingMarks.delete(key);
                }
            }
            
            Swal.fire('Success', `Saved ${savedCount} marks for ${currentUser.assignedClass}!`, 'success');
            
            // Update status indicators to "Saved"
            document.querySelectorAll('.mark-status').forEach(el => {
                if (el.textContent === 'Unsaved') {
                    el.textContent = 'Saved';
                    el.className = 'badge bg-success mark-status';
                }
            });
            
            // Refresh the marks display
            loadMyStudentsForMarks();
            
        } catch (error) {
            console.error('Error saving marks:', error);
            Swal.fire('Error', 'Failed to save marks. Please try again.', 'error');
        }
    }

    async function loadTeacherWeeksForAnalysis() {
        try {
            const snapshot = await db.collection('weeks').orderBy('term').orderBy('weekNumber').get();
            let options = '<option value="">Select Week</option>';
            
            snapshot.forEach(doc => {
                const week = doc.data();
                options += `<option value="${doc.id}">Term ${week.term} Week ${week.weekNumber}</option>`;
            });
            
            document.getElementById('teacherAnalysisWeekSelect').innerHTML = options;
        } catch (error) {
            console.error('Error loading weeks:', error);
        }
    }

    async function loadMyClassAnalysis() {
        const weekId = document.getElementById('teacherAnalysisWeekSelect').value;
        const currentUser = Auth.getCurrentUser();
        
        if (!weekId) {
            Swal.fire('Info', 'Please select a week', 'info');
            return;
        }

        try {
            // Get ONLY students from teacher's assigned class
            const studentsSnapshot = await db.collection('students')
                .where('form', '==', currentUser.assignedClass)
                .get();
            
            const studentIds = studentsSnapshot.docs.map(doc => doc.id);
            
            if (studentIds.length === 0) {
                document.getElementById('myMeanScore').textContent = '-';
                document.getElementById('myMedianScore').textContent = '-';
                document.getElementById('myRangeScore').textContent = '-';
                document.getElementById('myTotalStudents').textContent = '0';
                document.getElementById('myLeaderboardBody').innerHTML = '<tr><td colspan="4" class="text-center">No students in your class</td></tr>';
                return;
            }
            
            const marks = [];
            const marksData = [];
            
            for (const studentId of studentIds) {
                const marksSnapshot = await db.collection('marks')
                    .where('studentId', '==', studentId)
                    .where('weekId', '==', weekId)
                    .get();
                
                if (!marksSnapshot.empty) {
                    const mark = marksSnapshot.docs[0].data().marks;
                    marks.push(mark);
                    marksData.push({
                        studentId: studentId,
                        marks: mark
                    });
                }
            }

            if (marks.length === 0) {
                document.getElementById('myMeanScore').textContent = '-';
                document.getElementById('myMedianScore').textContent = '-';
                document.getElementById('myRangeScore').textContent = '-';
                document.getElementById('myTotalStudents').textContent = studentIds.length;
                
                document.getElementById('myLeaderboardBody').innerHTML = '<tr><td colspan="4" class="text-center">No marks entered for this week</td></tr>';
                return;
            }

            // Calculate statistics
            const mean = (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(1);
            const sorted = [...marks].sort((a, b) => a - b);
            const median = marks.length % 2 === 0 
                ? ((sorted[marks.length/2 - 1] + sorted[marks.length/2]) / 2).toFixed(1)
                : sorted[Math.floor(marks.length/2)].toFixed(1);
            const range = (Math.max(...marks) - Math.min(...marks)).toFixed(1);

            document.getElementById('myMeanScore').textContent = mean + '%';
            document.getElementById('myMedianScore').textContent = median + '%';
            document.getElementById('myRangeScore').textContent = range + '%';
            document.getElementById('myTotalStudents').textContent = studentIds.length;

            await loadMyLeaderboard(weekId, studentIds);
            await loadMyTrend(weekId);

            // Show summary
            Swal.fire({
                icon: 'success',
                title: 'Analysis Complete',
                html: `
                    <strong>Class:</strong> ${currentUser.assignedClass}<br>
                    <strong>Students with marks:</strong> ${marks.length}/${studentIds.length}<br>
                    <strong>Mean Score:</strong> ${mean}%
                `,
                timer: 3000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error('Error loading analysis:', error);
            Swal.fire('Error', 'Failed to load analysis', 'error');
        }
    }

    async function loadMyLeaderboard(weekId, studentIds) {
        try {
            const leaderboard = [];
            
            for (const studentId of studentIds) {
                const marksSnapshot = await db.collection('marks')
                    .where('studentId', '==', studentId)
                    .where('weekId', '==', weekId)
                    .get();
                
                if (!marksSnapshot.empty) {
                    const mark = marksSnapshot.docs[0].data().marks;
                    const studentDoc = await db.collection('students').doc(studentId).get();
                    
                    if (studentDoc.exists) {
                        leaderboard.push({
                            name: studentDoc.data().name,
                            admNo: studentDoc.data().admNo,
                            marks: mark
                        });
                    }
                }
            }

            leaderboard.sort((a, b) => b.marks - a.marks);

            let html = '';
            if (leaderboard.length === 0) {
                html = '<tr><td colspan="4" class="text-center">No marks entered yet</td></tr>';
            } else {
                leaderboard.slice(0, 10).forEach((student, index) => {
                    const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'bg-secondary';
                    html += `
                        <tr>
                            <td>
                                <span class="badge-rank ${rankClass}">
                                    ${index + 1}
                                </span>
                            </td>
                            <td>${student.name}</td>
                            <td>${student.admNo}</td>
                            <td><strong>${student.marks}%</strong></td>
                        </tr>
                    `;
                });
            }
            
            document.getElementById('myLeaderboardBody').innerHTML = html;
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }

    async function loadMyTrend(currentWeekId) {
        const currentUser = Auth.getCurrentUser();
        
        try {
            const weeksSnapshot = await db.collection('weeks').orderBy('term').orderBy('weekNumber').get();
            const weeks = [];
            const averages = [];
            
            // Get only students from teacher's class
            const studentsSnapshot = await db.collection('students')
                .where('form', '==', currentUser.assignedClass)
                .get();
            
            const studentIds = studentsSnapshot.docs.map(doc => doc.id);
            
            if (studentIds.length === 0) return;
            
            for (const weekDoc of weeksSnapshot.docs) {
                const week = weekDoc.data();
                const marks = [];
                
                for (const studentId of studentIds) {
                    const marksSnapshot = await db.collection('marks')
                        .where('studentId', '==', studentId)
                        .where('weekId', '==', weekDoc.id)
                        .get();
                    
                    if (!marksSnapshot.empty) {
                        marks.push(marksSnapshot.docs[0].data().marks);
                    }
                }
                
                if (marks.length > 0) {
                    const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
                    weeks.push(`Term ${week.term} Wk ${week.weekNumber}`);
                    averages.push(avg);
                }
            }

            const ctx = document.getElementById('myTrendChart').getContext('2d');
            
            if (myTrendChart) {
                myTrendChart.destroy();
            }
            
            if (weeks.length > 0) {
                myTrendChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: weeks,
                        datasets: [{
                            label: `${currentUser.assignedClass} Average`,
                            data: averages,
                            borderColor: '#800000',
                            backgroundColor: 'rgba(128,0,0,0.1)',
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: '#800000',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { 
                            legend: { 
                                display: true,
                                labels: {
                                    color: '#800000',
                                    font: {
                                        weight: 'bold'
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                title: {
                                    display: true,
                                    text: 'Average Score (%)'
                                }
                            }
                        }
                    }
                });
            } else {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }

        } catch (error) {
            console.error('Error loading trend:', error);
        }
    }

    // Validate marks before saving
    function validateMarks() {
        const invalidMarks = [];
        document.querySelectorAll('.mark-input').forEach(input => {
            const value = parseInt(input.value);
            if (input.value && (isNaN(value) || value < 0 || value > 100)) {
                invalidMarks.push(input.dataset.studentName);
            }
        });
        
        if (invalidMarks.length > 0) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Marks',
                html: `Please check marks for:<br>${invalidMarks.join('<br>')}<br>Marks must be between 0-100`,
            });
            return false;
        }
        return true;
    }

    // Expose functions globally for onclick handlers
    return {
        loadTeacherDashboard: loadTeacherDashboard,
        loadTeacherStats: loadTeacherStats,
        loadTeacherWeeks: loadTeacherWeeks,
        loadMyStudentsForMarks: loadMyStudentsForMarks,
        updateMark: updateMark,
        saveAllMarks: saveAllMarks,
        loadTeacherWeeksForAnalysis: loadTeacherWeeksForAnalysis,
        loadMyClassAnalysis: loadMyClassAnalysis,
        validateMarks: validateMarks
    };
})();

// Make TeacherDashboard globally available
window.TeacherDashboard = TeacherDashboard;

// Global functions for onclick handlers
window.loadMyStudentsForMarks = function() {
    TeacherDashboard.loadMyStudentsForMarks();
};

window.saveAllMarks = function() {
    TeacherDashboard.saveAllMarks();
};

window.loadMyClassAnalysis = function() {
    TeacherDashboard.loadMyClassAnalysis();
};