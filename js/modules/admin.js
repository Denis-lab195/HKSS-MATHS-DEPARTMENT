// Admin Module - Handles all admin functionality
const AdminDashboard = (function() {
    async function loadAdminDashboard() {
        UIManager.buildAdminSidebar();
        UIManager.showSection('admin-dashboard-section');
        await loadAdminDashboardData();
    }

    async function loadAdminDashboardData() {
        await loadDashboardStats();
        await loadTeachers();
        await loadWeeks();
    }

    async function loadDashboardStats() {
        try {
            const studentsSnapshot = await db.collection('students').get();
            const teachersSnapshot = await db.collection('teachers').get();
            const weeksSnapshot = await db.collection('weeks').get();
            const marksSnapshot = await db.collection('marks').get();

            document.getElementById('totalStudents').textContent = studentsSnapshot.size;
            document.getElementById('totalTeachers').textContent = teachersSnapshot.size;
            document.getElementById('totalWeeks').textContent = weeksSnapshot.size;

            let totalMarks = 0;
            marksSnapshot.forEach(doc => totalMarks += doc.data().marks);
            const avgScore = marksSnapshot.size > 0 ? (totalMarks / marksSnapshot.size).toFixed(1) : 0;
            document.getElementById('avgScore').textContent = avgScore + '%';
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async function loadTeachers() {
        try {
            const snapshot = await db.collection('teachers').get();
            let html = '';
            
            if (snapshot.empty) {
                html = '<p class="text-center">No teachers added yet</p>';
            } else {
                snapshot.forEach(doc => {
                    const teacher = doc.data();
                    html += `
                        <div class="col-md-4">
                            <div class="teacher-card">
                                <div class="teacher-avatar">
                                    <i class="fas fa-chalkboard-teacher"></i>
                                </div>
                                <h5>${teacher.name || ''}</h5>
                                <p class="mb-2"><i class="fas fa-envelope me-2"></i>${teacher.email || ''}</p>
                                <p class="mb-2"><i class="fas fa-phone me-2"></i>${teacher.phone || ''}</p>
                                <p class="mb-2"><strong>Class:</strong> <span class="class-badge">${teacher.assignedClass || ''}</span></p>
                                <p class="mb-2"><strong>Username:</strong> ${teacher.username || ''}</p>
                                <button class="btn btn-sm btn-danger mt-2" onclick="AdminDashboard.deleteTeacher('${doc.id}')">
                                    <i class="fas fa-trash me-2"></i>Delete
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
            
            document.getElementById('teachersList').innerHTML = html;
        } catch (error) {
            console.error('Error loading teachers:', error);
        }
    }
    async function loadWeeks() {
        try {
            // Try with orderBy first
            let snapshot;
            try {
                snapshot = await db.collection('weeks').orderBy('term').orderBy('weekNumber').get();
            } catch (indexError) {
                console.log('Index not ready, falling back to simple query');
                // Fallback to simple query without orderBy
                snapshot = await db.collection('weeks').get();
            }
            
            let html = '';
            
            if (snapshot.empty) {
                html = '<tr><td colspan="4" class="text-center">No weeks created yet</td></tr>';
            } else {
                // Sort manually if we couldn't use orderBy
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
                    html += `
                        <tr>
                            <td>Term ${week.term || ''}</td>
                            <td>Week ${week.weekNumber || ''}</td>
                            <td>${week.description || '-'}</td>
                            <td>
                                <button class="btn btn-sm btn-danger" onclick="AdminDashboard.deleteWeek('${week.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
            }
            
            document.getElementById('weeksTableBody').innerHTML = html;
        } catch (error) {
            console.error('Error loading weeks:', error);
            document.getElementById('weeksTableBody').innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading weeks</td></tr>';
        }
    
    }

    async function loadStudents() {
        try {
            const classFilter = document.getElementById('classFilter').value;
            console.log('Loading students with filter:', classFilter);
            
            let query = db.collection('students');
            
            if (classFilter) {
                query = query.where('form', '==', classFilter);
            }
            
            // Add orderBy to make it consistent
            try {
                query = query.orderBy('admNo');
            } catch (orderError) {
                console.log('Could not order by admNo, may need index:', orderError);
            }
            
            const snapshot = await query.get();
            console.log('Students found:', snapshot.size);
            
            let html = '';
            
            if (snapshot.empty) {
                html = '<tr><td colspan="5" class="text-center">No students found</td></tr>';
            } else {
                snapshot.forEach(doc => {
                    const student = doc.data();
                    console.log('Student data:', student); // Debug each student
                    
                    html += `
                        <tr>
                            <td>${student.admNo || 'N/A'}</td>
                            <td>${student.name || 'N/A'}</td>
                            <td>${student.gender === 'M' ? 'Male' : student.gender === 'F' ? 'Female' : student.gender || 'N/A'}</td>
                            <td>${student.form || 'N/A'}</td>
                            <td>
                                <button class="btn btn-sm btn-danger" onclick="AdminDashboard.deleteStudent('${doc.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
            }
            
            document.getElementById('studentsTableBody').innerHTML = html;
        } catch (error) {
            console.error('Error loading students:', error);
            
            // Check for index error
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                const indexLink = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                Swal.fire({
                    icon: 'error',
                    title: 'Index Required',
                    html: `Please create the required index: <br><a href="${indexLink}" target="_blank">Click here to create index</a>`,
                    footer: 'After creating the index, wait a few minutes and refresh'
                });
            } else {
                Swal.fire('Error', 'Failed to load students: ' + error.message, 'error');
            }
            
            document.getElementById('studentsTableBody').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading students</td></tr>';
        }
    
    }
    async function saveTeacher() {
        // Get values directly from the modal - no complex selection needed
        const name = document.getElementById('teacherName')?.value;
        const email = document.getElementById('teacherEmail')?.value;
        const phone = document.getElementById('teacherPhone')?.value;
        const assignedClass = document.getElementById('teacherClass')?.value; // Direct reference
        const username = document.getElementById('teacherUsername')?.value;
        const password = document.getElementById('teacherPassword')?.value;
    
        // Debug: Log what we're getting
        console.log('Teacher Class Element:', document.getElementById('teacherClass'));
        console.log('Teacher Class Value:', assignedClass);
        console.log('All values:', { name, email, phone, assignedClass, username, password });
    
        // Validate all fields
        if (!name || !email || !phone || !username || !assignedClass) {
            let missingFields = [];
            if (!name) missingFields.push('Name');
            if (!email) missingFields.push('Email');
            if (!phone) missingFields.push('Phone');
            if (!username) missingFields.push('Username');
            if (!assignedClass) missingFields.push('Class (selected: "' + assignedClass + '")');
            
            Swal.fire({
                icon: 'error',
                title: 'Missing Fields',
                html: `Please fill all fields:<br><strong>${missingFields.join(', ')}</strong>`
            });
            return;
        }
    
        try {
            // Check if username exists
            const existingTeacher = await db.collection('teachers')
                .where('username', '==', username)
                .get();
            
            if (!existingTeacher.empty) {
                Swal.fire('Error', 'Username already exists', 'error');
                return;
            }
    
            // Add teacher with all fields
            await db.collection('teachers').add({
                name: name,
                email: email,
                phone: phone,
                assignedClass: assignedClass,
                username: username,
                password: password,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
    
            // Close modal and show success
            const modal = bootstrap.Modal.getInstance(document.getElementById('addTeacherModal'));
            if (modal) modal.hide();
            
            Swal.fire('Success', 'Teacher added successfully!', 'success');
            
            // Reload teachers list
            loadTeachers();
            
            // Clear form
            document.getElementById('teacherName').value = '';
            document.getElementById('teacherEmail').value = '';
            document.getElementById('teacherPhone').value = '';
            document.getElementById('teacherUsername').value = '';
            document.getElementById('teacherPassword').value = 'teacher123';
            document.getElementById('teacherClass').value = '4E'; // Reset to default
            
        } catch (error) {
            console.error('Error adding teacher:', error);
            Swal.fire('Error', 'Failed to add teacher: ' + error.message, 'error');
        }
    
    }

    async function saveNewStudent() {
        const admNo = document.getElementById('studentAdm').value;
        const name = document.getElementById('studentName').value;
        const gender = document.getElementById('studentGender').value;
        const form = document.getElementById('studentForm').value;

        if (!admNo || !name || !gender || !form) {
            Swal.fire('Error', 'Please fill all fields', 'error');
            return;
        }

        try {
            const existingStudent = await db.collection('students')
                .where('admNo', '==', admNo)
                .get();
            
            if (!existingStudent.empty) {
                Swal.fire('Error', 'Student with this ADM number already exists', 'error');
                return;
            }

            await db.collection('students').add({
                admNo, name, gender, form,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            bootstrap.Modal.getInstance(document.getElementById('addStudentModal')).hide();
            Swal.fire('Success', 'Student added successfully!', 'success');
            loadStudents();
            
        } catch (error) {
            console.error('Error adding student:', error);
            Swal.fire('Error', 'Failed to add student', 'error');
        }
    }

    async function saveNewWeek() {
        const term = document.getElementById('weekTerm').value;
        const weekNumber = document.getElementById('weekNumber').value;
        const description = document.getElementById('weekDescription').value;

        if (!term || !weekNumber) {
            Swal.fire('Error', 'Please fill all required fields', 'error');
            return;
        }

        try {
            await db.collection('weeks').add({
                term, weekNumber: parseInt(weekNumber), description,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            bootstrap.Modal.getInstance(document.getElementById('createWeekModal')).hide();
            Swal.fire('Success', 'Week created successfully!', 'success');
            loadWeeks();
            
        } catch (error) {
            console.error('Error creating week:', error);
            Swal.fire('Error', 'Failed to create week', 'error');
        }
    }

    async function deleteTeacher(teacherId) {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'This will delete the teacher account!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await db.collection('teachers').doc(teacherId).delete();
                Swal.fire('Deleted!', 'Teacher has been deleted.', 'success');
                loadTeachers();
            } catch (error) {
                console.error('Error deleting teacher:', error);
                Swal.fire('Error', 'Failed to delete teacher', 'error');
            }
        }
    }

    async function deleteStudent(studentId) {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'This will delete all marks for this student!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                const marksSnapshot = await db.collection('marks')
                    .where('studentId', '==', studentId)
                    .get();
                
                const batch = db.batch();
                marksSnapshot.forEach(doc => batch.delete(doc.ref));
                batch.delete(db.collection('students').doc(studentId));
                
                await batch.commit();
                
                Swal.fire('Deleted!', 'Student has been deleted.', 'success');
                loadStudents();
                
            } catch (error) {
                console.error('Error deleting student:', error);
                Swal.fire('Error', 'Failed to delete student', 'error');
            }
        }
    }

    async function deleteWeek(weekId) {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'This will delete all marks associated with this week!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                const marksSnapshot = await db.collection('marks')
                    .where('weekId', '==', weekId)
                    .get();
                
                const batch = db.batch();
                marksSnapshot.forEach(doc => batch.delete(doc.ref));
                batch.delete(db.collection('weeks').doc(weekId));
                
                await batch.commit();
                
                Swal.fire('Deleted!', 'Week has been deleted.', 'success');
                loadWeeks();
                
            } catch (error) {
                console.error('Error deleting week:', error);
                Swal.fire('Error', 'Failed to delete week', 'error');
            }
        }
    }

    function filterStudents() {
        loadStudents();
    }

    function showAddTeacherModal() {
        UIManager.clearModalFields('addTeacherModal');
        new bootstrap.Modal(document.getElementById('addTeacherModal')).show();
    }

    function showAddStudentModal() {
        UIManager.clearModalFields('addStudentModal');
        new bootstrap.Modal(document.getElementById('addStudentModal')).show();
    }

    function showCreateWeekModal() {
        UIManager.clearModalFields('createWeekModal');
        new bootstrap.Modal(document.getElementById('createWeekModal')).show();
    }

    function showBulkUploadSection() {
        UIManager.showSection('bulkUpload-section');
    }

    async function uploadBulkStudents() {
        const fileInput = document.getElementById('bulkFile');
        const file = fileInput.files[0];
        
        if (!file) {
            Swal.fire('Error', 'Please select a file', 'error');
            return;
        }

        try {
            const data = await Utils.readExcelFile(file);
            
            if (data.length < 2) {
                Swal.fire('Error', 'File is empty', 'error');
                return;
            }
            
            const requiredHeaders = ['ADM', 'Name', 'Gender', 'Form'];
            const headers = data[0];
            
            for (const header of requiredHeaders) {
                if (!headers.includes(header)) {
                    Swal.fire('Error', `Missing required header: ${header}`, 'error');
                    return;
                }
            }

            const batch = db.batch();
            let successCount = 0;
            let errorCount = 0;

            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (row.length < 4) continue;

                const admNo = row[headers.indexOf('ADM')];
                const name = row[headers.indexOf('Name')];
                const gender = row[headers.indexOf('Gender')];
                const form = row[headers.indexOf('Form')];

                if (!admNo || !name || !gender || !form) {
                    errorCount++;
                    continue;
                }

                const existingStudent = await db.collection('students')
                    .where('admNo', '==', admNo.toString())
                    .get();

                if (existingStudent.empty) {
                    const studentRef = db.collection('students').doc();
                    batch.set(studentRef, {
                        admNo: admNo.toString(),
                        name, gender: gender.toString().toUpperCase(), form: form.toString(),
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    successCount++;
                } else {
                    errorCount++;
                }
            }

            if (successCount > 0) {
                await batch.commit();
            }

            const statusHtml = `
                <div class="alert alert-success">
                    <strong>Success!</strong> ${successCount} students uploaded successfully.
                </div>
                ${errorCount > 0 ? `
                    <div class="alert alert-warning">
                        <strong>Warning!</strong> ${errorCount} records skipped (invalid data or duplicates).
                    </div>
                ` : ''}
            `;
            
            document.getElementById('uploadStatus').innerHTML = statusHtml;
            Swal.fire('Success', `Uploaded ${successCount} students successfully!`, 'success');
            
            fileInput.value = '';
            loadStudents();
            
        } catch (error) {
            console.error('Error uploading file:', error);
            Swal.fire('Error', 'Failed to process file', 'error');
        }
    }

    // Expose functions globally for onclick handlers
    window.showAddTeacherModal = showAddTeacherModal;
    window.showCreateWeekModal = showCreateWeekModal;
    window.showAddStudentModal = showAddStudentModal;
    window.showBulkUploadSection = showBulkUploadSection;
    window.uploadBulkStudents = uploadBulkStudents;
    window.filterStudents = filterStudents;
    window.saveTeacher = saveTeacher;
    window.saveNewStudent = saveNewStudent;
    window.saveNewWeek = saveNewWeek;

    return {
        loadAdminDashboard,
        loadAdminDashboardData,
        loadDashboardStats,
        loadTeachers,
        loadWeeks,
        loadStudents,
        saveTeacher,
        saveNewStudent,
        saveNewWeek,
        deleteTeacher,
        deleteStudent,
        deleteWeek,
        filterStudents,
        showAddTeacherModal,
        showAddStudentModal,
        showCreateWeekModal,
        showBulkUploadSection,
        uploadBulkStudents
    };
})();