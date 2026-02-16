// Admin Module - Handles all admin functionality
const AdminDashboard = (function() {
    // Analytics variables
    let classPerformanceChart = null;
    let distributionChart = null;

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
        const name = document.getElementById('teacherName')?.value;
        const email = document.getElementById('teacherEmail')?.value;
        const phone = document.getElementById('teacherPhone')?.value;
        const assignedClass = document.getElementById('teacherClass')?.value;
        const username = document.getElementById('teacherUsername')?.value;
        const password = document.getElementById('teacherPassword')?.value;

        // Validate all fields
        if (!name || !email || !phone || !username || !assignedClass) {
            let missingFields = [];
            if (!name) missingFields.push('Name');
            if (!email) missingFields.push('Email');
            if (!phone) missingFields.push('Phone');
            if (!username) missingFields.push('Username');
            if (!assignedClass) missingFields.push('Class');
            
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
            document.getElementById('teacherClass').value = '4E';
            
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
// ============= CAT (WEEK) SPECIFIC TOP/BOTTOM 10 =============

async function loadCATAnalytics(weekId = 'all') {
    try {
        UIManager.showSection('cat-analytics-section');
        
        // Show loading
        document.getElementById('cat-top10-body').innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-maroon" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        document.getElementById('cat-bottom10-body').innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-maroon" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        document.getElementById('cat-summary-body').innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border text-maroon" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        
        // Fetch data
        const [studentsSnap, weeksSnap, marksSnap] = await Promise.all([
            db.collection('students').get(),
            db.collection('weeks').get(),
            db.collection('marks').get()
        ]);
        
        // Create student map
        const studentDetails = new Map();
        studentsSnap.docs.forEach(doc => {
            studentDetails.set(doc.id, {
                name: doc.data().name,
                class: doc.data().form,
                admNo: doc.data().admNo
            });
        });
        
        // Create week map
        const weekDetails = new Map();
        const weekOptions = [];
        weeksSnap.docs.forEach(doc => {
            const week = doc.data();
            weekDetails.set(doc.id, {
                term: week.term,
                weekNumber: week.weekNumber,
                description: week.description || `Week ${week.weekNumber}`
            });
            weekOptions.push({
                id: doc.id,
                term: week.term,
                weekNumber: week.weekNumber,
                display: `Term ${week.term} Week ${week.weekNumber}`
            });
        });
        
        // Sort weeks
        weekOptions.sort((a, b) => {
            if (a.term !== b.term) return a.term - b.term;
            return a.weekNumber - b.weekNumber;
        });
        
        // Update week selector
        const weekSelect = document.getElementById('catWeekSelect');
        if (weekSelect) {
            let options = '<option value="all">All CATs (Overall)</option>';
            weekOptions.forEach(week => {
                options += `<option value="${week.id}">${week.display}</option>`;
            });
            weekSelect.innerHTML = options;
            weekSelect.value = weekId;
        }
        
        // Process marks by week
        const weekData = new Map();
        
        marksSnap.docs.forEach(doc => {
            const data = doc.data();
            const mark = data.marks;
            const studentId = data.studentId;
            const markWeekId = data.weekId;
            const student = studentDetails.get(studentId);
            
            if (!student) return;
            
            if (!weekData.has(markWeekId)) {
                weekData.set(markWeekId, {
                    weekId: markWeekId,
                    weekInfo: weekDetails.get(markWeekId) || { term: 0, weekNumber: 0, description: 'Unknown' },
                    marks: [],
                    studentMarks: new Map(),
                    classStats: new Map()
                });
            }
            
            const week = weekData.get(markWeekId);
            week.marks.push(mark);
            
            if (!week.studentMarks.has(studentId)) {
                week.studentMarks.set(studentId, {
                    studentId: studentId,
                    name: student.name,
                    class: student.class,
                    admNo: student.admNo,
                    marks: [],
                    total: 0,
                    count: 0
                });
            }
            
            const studentMark = week.studentMarks.get(studentId);
            studentMark.marks.push(mark);
            studentMark.total += mark;
            studentMark.count++;
            
            // Class stats
            if (!week.classStats.has(student.class)) {
                week.classStats.set(student.class, {
                    className: student.class,
                    marks: [],
                    total: 0,
                    count: 0,
                    students: new Set()
                });
            }
            
            const classStat = week.classStats.get(student.class);
            classStat.marks.push(mark);
            classStat.total += mark;
            classStat.count++;
            classStat.students.add(studentId);
        });
        
        // If specific week requested, show only that week
        if (weekId !== 'all' && weekData.has(weekId)) {
            displaySingleCATAnalytics(weekData.get(weekId), weekId, weekDetails);
        } else {
            // Show all weeks summary
            displayAllCATsAnalytics(weekData, weekDetails);
        }
        
        // Update week selector change handler
        if (weekSelect) {
            weekSelect.onchange = function() {
                loadCATAnalytics(this.value);
            };
        }
        
    } catch (error) {
        console.error('Error loading CAT analytics:', error);
        Swal.fire('Error', 'Failed to load CAT analytics', 'error');
    }
}

function displaySingleCATAnalytics(week, weekId, weekDetails) {
    const weekInfo = weekDetails.get(weekId) || { term: 0, weekNumber: 0, description: 'Unknown' };
    
    // Update header
    document.getElementById('cat-week-title').textContent = 
        `CAT ${weekInfo.term ? `Term ${weekInfo.term} Week ${weekInfo.weekNumber}` : 'Unknown'}`;
    
    // Build student rankings for this week
    const rankings = [];
    week.studentMarks.forEach(student => {
        const average = student.total / student.count;
        rankings.push({
            name: student.name,
            class: student.class,
            admNo: student.admNo,
            marks: student.marks,
            average: average,
            highest: Math.max(...student.marks),
            lowest: Math.min(...student.marks),
            count: student.count
        });
    });
    
    // Sort by average
    rankings.sort((a, b) => b.average - a.average);
    
    // Display Top 10 for this CAT
    let topHtml = '';
    rankings.slice(0, 10).forEach((student, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        topHtml += `
            <tr>
                <td><strong>${medal || index+1}</strong></td>
                <td>${student.name}</td>
                <td>${student.class}</td>
                <td>${student.admNo}</td>
                <td><span class="badge bg-success">${student.average.toFixed(1)}%</span></td>
                <td>${student.highest}%</td>
                <td>${student.lowest}%</td>
            </tr>
        `;
    });
    document.getElementById('cat-top10-body').innerHTML = topHtml || '<tr><td colspan="7" class="text-center">No data for this CAT</td></tr>';
    
    // Display Bottom 10 for this CAT
    let bottomHtml = '';
    rankings.slice(-10).reverse().forEach((student, index) => {
        bottomHtml += `
            <tr>
                <td><strong>${index+1}</strong></td>
                <td>${student.name}</td>
                <td>${student.class}</td>
                <td>${student.admNo}</td>
                <td><span class="badge bg-danger">${student.average.toFixed(1)}%</span></td>
                <td>${student.highest}%</td>
                <td>${student.lowest}%</td>
            </tr>
        `;
    });
    document.getElementById('cat-bottom10-body').innerHTML = bottomHtml || '<tr><td colspan="7" class="text-center">No data for this CAT</td></tr>';
    
    // Display Class Summary for this CAT
    let classHtml = '';
    const classRankings = [];
    week.classStats.forEach(cls => {
        const classAvg = cls.total / cls.count;
        const passMarks = cls.marks.filter(m => m >= 50).length;
        const passRate = (passMarks / cls.marks.length * 100).toFixed(1);
        
        classRankings.push({
            className: cls.className,
            average: classAvg,
            studentCount: cls.students.size,
            passRate: passRate,
            highest: Math.max(...cls.marks),
            lowest: Math.min(...cls.marks)
        });
    });
    
    classRankings.sort((a, b) => b.average - a.average);
    
    classRankings.forEach((cls, index) => {
        classHtml += `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>${cls.className}</td>
                <td>${cls.studentCount}</td>
                <td>${cls.average.toFixed(1)}%</td>
                <td>${cls.highest}%</td>
                <td>${cls.lowest}%</td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar ${cls.passRate >= 50 ? 'bg-success' : 'bg-warning'}" 
                             style="width: ${cls.passRate}%">${cls.passRate}%</div>
                    </div>
                </td>
            </tr>
        `;
    });
    document.getElementById('cat-summary-body').innerHTML = classHtml || '<tr><td colspan="7" class="text-center">No class data</td></tr>';
}

function displayAllCATsAnalytics(weekData, weekDetails) {
    document.getElementById('cat-week-title').textContent = 'All CATs (Overall Performance)';
    
    // Aggregate all marks
    const allRankings = new Map();
    const allClassStats = new Map();
    
    weekData.forEach(week => {
        week.studentMarks.forEach((student, studentId) => {
            if (!allRankings.has(studentId)) {
                allRankings.set(studentId, {
                    name: student.name,
                    class: student.class,
                    admNo: student.admNo,
                    marks: [],
                    total: 0,
                    count: 0
                });
            }
            const agg = allRankings.get(studentId);
            agg.marks.push(...student.marks);
            agg.total += student.total;
            agg.count += student.count;
        });
        
        week.classStats.forEach((cls, className) => {
            if (!allClassStats.has(className)) {
                allClassStats.set(className, {
                    className: className,
                    marks: [],
                    total: 0,
                    count: 0,
                    students: new Set()
                });
            }
            const agg = allClassStats.get(className);
            agg.marks.push(...cls.marks);
            agg.total += cls.total;
            agg.count += cls.count;
            cls.students.forEach(s => agg.students.add(s));
        });
    });
    
    // Build overall rankings
    const rankings = [];
    allRankings.forEach(student => {
        const average = student.total / student.count;
        rankings.push({
            name: student.name,
            class: student.class,
            admNo: student.admNo,
            average: average,
            highest: Math.max(...student.marks),
            lowest: Math.min(...student.marks),
            assessments: student.count
        });
    });
    
    rankings.sort((a, b) => b.average - a.average);
    
    // Display Top 10 Overall
    let topHtml = '';
    rankings.slice(0, 10).forEach((student, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        topHtml += `
            <tr>
                <td><strong>${medal || index+1}</strong></td>
                <td>${student.name}</td>
                <td>${student.class}</td>
                <td>${student.admNo}</td>
                <td><span class="badge bg-success">${student.average.toFixed(1)}%</span></td>
                <td>${student.highest}%</td>
                <td>${student.lowest}%</td>
                <td>${student.assessments}</td>
            </tr>
        `;
    });
    document.getElementById('cat-top10-body').innerHTML = topHtml || '<tr><td colspan="8" class="text-center">No data</td></tr>';
    
    // Display Bottom 10 Overall
    let bottomHtml = '';
    rankings.slice(-10).reverse().forEach((student, index) => {
        bottomHtml += `
            <tr>
                <td><strong>${index+1}</strong></td>
                <td>${student.name}</td>
                <td>${student.class}</td>
                <td>${student.admNo}</td>
                <td><span class="badge bg-danger">${student.average.toFixed(1)}%</span></td>
                <td>${student.highest}%</td>
                <td>${student.lowest}%</td>
                <td>${student.assessments}</td>
            </tr>
        `;
    });
    document.getElementById('cat-bottom10-body').innerHTML = bottomHtml || '<tr><td colspan="8" class="text-center">No data</td></tr>';
    
    // Display Class Summary Overall
    let classHtml = '';
    const classRankings = [];
    allClassStats.forEach(cls => {
        const classAvg = cls.total / cls.count;
        const passMarks = cls.marks.filter(m => m >= 50).length;
        const passRate = (passMarks / cls.marks.length * 100).toFixed(1);
        
        classRankings.push({
            className: cls.className,
            average: classAvg,
            studentCount: cls.students.size,
            passRate: passRate,
            highest: Math.max(...cls.marks),
            lowest: Math.min(...cls.marks)
        });
    });
    
    classRankings.sort((a, b) => b.average - a.average);
    
    classRankings.forEach((cls, index) => {
        classHtml += `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>${cls.className}</td>
                <td>${cls.studentCount}</td>
                <td>${cls.average.toFixed(1)}%</td>
                <td>${cls.highest}%</td>
                <td>${cls.lowest}%</td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar ${cls.passRate >= 50 ? 'bg-success' : 'bg-warning'}" 
                             style="width: ${cls.passRate}%">${cls.passRate}%</div>
                    </div>
                </td>
            </tr>
        `;
    });
    document.getElementById('cat-summary-body').innerHTML = classHtml || '<tr><td colspan="7" class="text-center">No class data</td></tr>';
}

// Export functions
window.loadCATAnalytics = loadCATAnalytics;
// Simplified CAT Analytics Function
async function loadCATAnalytics(weekId = 'all') {
    try {
        console.log('Loading CAT analytics for week:', weekId);
        
        // Show the section
        const section = document.getElementById('cat-analytics-section');
        if (section) section.style.display = 'block';
        
        // Check if elements exist
        const topBody = document.getElementById('cat-top10-body');
        const bottomBody = document.getElementById('cat-bottom10-body');
        const summaryBody = document.getElementById('cat-summary-body');
        const weekTitle = document.getElementById('cat-week-title');
        
        if (!topBody || !bottomBody || !summaryBody || !weekTitle) {
            console.error('CAT analytics elements not found in HTML');
            Swal.fire('Error', 'CAT analytics section not properly configured', 'error');
            return;
        }
        
        // Show loading
        topBody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-maroon" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        bottomBody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-maroon" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        summaryBody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border text-maroon" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        
        // Fetch data
        const [studentsSnap, weeksSnap, marksSnap] = await Promise.all([
            db.collection('students').get(),
            db.collection('weeks').get(),
            db.collection('marks').get()
        ]);
        
        // Create week selector
        const weekSelect = document.getElementById('catWeekSelect');
        if (weekSelect) {
            let options = '<option value="all">All CATs (Overall)</option>';
            weeksSnap.forEach(doc => {
                const week = doc.data();
                options += `<option value="${doc.id}">Term ${week.term} Week ${week.weekNumber}</option>`;
            });
            weekSelect.innerHTML = options;
            weekSelect.value = weekId;
        }
        
        // Create student map
        const students = {};
        studentsSnap.forEach(doc => {
            students[doc.id] = {
                name: doc.data().name,
                class: doc.data().form,
                admNo: doc.data().admNo
            };
        });
        
        // Process marks
        const weekMarks = {};
        const overallMarks = {};
        
        marksSnap.forEach(doc => {
            const data = doc.data();
            const student = students[data.studentId];
            if (!student) return;
            
            // Week specific
            if (!weekMarks[data.weekId]) {
                weekMarks[data.weekId] = [];
            }
            weekMarks[data.weekId].push({
                studentId: data.studentId,
                name: student.name,
                class: student.class,
                admNo: student.admNo,
                marks: data.marks
            });
            
            // Overall
            if (!overallMarks[data.studentId]) {
                overallMarks[data.studentId] = {
                    name: student.name,
                    class: student.class,
                    admNo: student.admNo,
                    total: 0,
                    count: 0,
                    marks: []
                };
            }
            overallMarks[data.studentId].total += data.marks;
            overallMarks[data.studentId].count++;
            overallMarks[data.studentId].marks.push(data.marks);
        });
        
        if (weekId === 'all') {
            // Show overall
            weekTitle.textContent = 'All CATs (Overall Performance)';
            
            // Calculate averages
            const rankings = [];
            for (let id in overallMarks) {
                const s = overallMarks[id];
                rankings.push({
                    name: s.name,
                    class: s.class,
                    admNo: s.admNo,
                    average: s.total / s.count
                });
            }
            
            rankings.sort((a, b) => b.average - a.average);
            
            // Top 10
            let topHtml = '';
            rankings.slice(0, 10).forEach((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                topHtml += `<tr>
                    <td><strong>${medal || i+1}</strong></td>
                    <td>${s.name}</td>
                    <td>${s.class}</td>
                    <td>${s.admNo}</td>
                    <td><span class="badge bg-success">${s.average.toFixed(1)}%</span></td>
                </tr>`;
            });
            topBody.innerHTML = topHtml || '<tr><td colspan="5">No data</td></tr>';
            
            // Bottom 10
            let bottomHtml = '';
            rankings.slice(-10).reverse().forEach((s, i) => {
                bottomHtml += `<tr>
                    <td><strong>${i+1}</strong></td>
                    <td>${s.name}</td>
                    <td>${s.class}</td>
                    <td>${s.admNo}</td>
                    <td><span class="badge bg-danger">${s.average.toFixed(1)}%</span></td>
                </tr>`;
            });
            bottomBody.innerHTML = bottomHtml || '<tr><td colspan="5">No data</td></tr>';
            
            // Class summary
            const classStats = {};
            for (let id in overallMarks) {
                const s = overallMarks[id];
                if (!classStats[s.class]) {
                    classStats[s.class] = {
                        total: 0,
                        count: 0,
                        students: new Set()
                    };
                }
                classStats[s.class].total += s.total;
                classStats[s.class].count += s.count;
                classStats[s.class].students.add(id);
            }
            
            let classHtml = '';
            const classList = [];
            for (let className in classStats) {
                const c = classStats[className];
                classList.push({
                    name: className,
                    average: c.total / c.count,
                    students: c.students.size
                });
            }
            
            classList.sort((a, b) => b.average - a.average);
            
            classList.forEach((c, i) => {
                classHtml += `<tr>
                    <td>${i+1}</td>
                    <td>${c.name}</td>
                    <td>${c.students}</td>
                    <td>${c.average.toFixed(1)}%</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                </tr>`;
            });
            summaryBody.innerHTML = classHtml || '<tr><td colspan="7">No data</td></tr>';
            
        } else {
            // Show specific week
            const weekMarksList = weekMarks[weekId] || [];
            
            if (weekMarksList.length === 0) {
                weekTitle.textContent = 'No data for this CAT';
                topBody.innerHTML = '<tr><td colspan="5">No marks found for this CAT</td></tr>';
                bottomBody.innerHTML = '<tr><td colspan="5">No marks found for this CAT</td></tr>';
                summaryBody.innerHTML = '<tr><td colspan="7">No marks found for this CAT</td></tr>';
                return;
            }
            
            // Get week info
            const weekDoc = await db.collection('weeks').doc(weekId).get();
            const weekData = weekDoc.data();
            weekTitle.textContent = `Term ${weekData.term} Week ${weekData.weekNumber}`;
            
            // Calculate averages
            const studentScores = {};
            weekMarksList.forEach(m => {
                if (!studentScores[m.studentId]) {
                    studentScores[m.studentId] = {
                        name: m.name,
                        class: m.class,
                        admNo: m.admNo,
                        total: 0,
                        count: 0
                    };
                }
                studentScores[m.studentId].total += m.marks;
                studentScores[m.studentId].count++;
            });
            
            const rankings = [];
            for (let id in studentScores) {
                const s = studentScores[id];
                rankings.push({
                    name: s.name,
                    class: s.class,
                    admNo: s.admNo,
                    average: s.total / s.count
                });
            }
            
            rankings.sort((a, b) => b.average - a.average);
            
            // Top 10
            let topHtml = '';
            rankings.slice(0, 10).forEach((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                topHtml += `<tr>
                    <td><strong>${medal || i+1}</strong></td>
                    <td>${s.name}</td>
                    <td>${s.class}</td>
                    <td>${s.admNo}</td>
                    <td><span class="badge bg-success">${s.average.toFixed(1)}%</span></td>
                </tr>`;
            });
            topBody.innerHTML = topHtml;
            
            // Bottom 10
            let bottomHtml = '';
            rankings.slice(-10).reverse().forEach((s, i) => {
                bottomHtml += `<tr>
                    <td><strong>${i+1}</strong></td>
                    <td>${s.name}</td>
                    <td>${s.class}</td>
                    <td>${s.admNo}</td>
                    <td><span class="badge bg-danger">${s.average.toFixed(1)}%</span></td>
                </tr>`;
            });
            bottomBody.innerHTML = bottomHtml;
            
            // Class summary for week
            const classStats = {};
            weekMarksList.forEach(m => {
                if (!classStats[m.class]) {
                    classStats[m.class] = {
                        total: 0,
                        count: 0,
                        students: new Set()
                    };
                }
                classStats[m.class].total += m.marks;
                classStats[m.class].count++;
                classStats[m.class].students.add(m.studentId);
            });
            
            let classHtml = '';
            const classList = [];
            for (let className in classStats) {
                const c = classStats[className];
                classList.push({
                    name: className,
                    average: c.total / c.count,
                    students: c.students.size
                });
            }
            
            classList.sort((a, b) => b.average - a.average);
            
            classList.forEach((c, i) => {
                classHtml += `<tr>
                    <td>${i+1}</td>
                    <td>${c.name}</td>
                    <td>${c.students}</td>
                    <td>${c.average.toFixed(1)}%</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                </tr>`;
            });
            summaryBody.innerHTML = classHtml;
        }
        
        console.log('CAT analytics loaded successfully');
        
    } catch (error) {
        console.error('Error in CAT analytics:', error);
        Swal.fire('Error', 'Failed to load CAT analytics: ' + error.message, 'error');
    }
}

// Make it globally available
window.loadCATAnalytics = loadCATAnalytics;
// ============= STORE CAT ANALYTICS IN FIREBASE =============

async function storeCATAnalytics() {
    try {
        const weekSelect = document.getElementById('catWeekSelect');
        const weekId = weekSelect ? weekSelect.value : 'all';
        
        // Show loading
        Swal.fire({
            title: 'Saving CAT Analysis',
            html: 'Please wait...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        console.log('💾 Saving CAT analytics for week:', weekId);
        
        // Fetch data
        const [studentsSnap, weeksSnap, marksSnap] = await Promise.all([
            db.collection('students').get(),
            db.collection('weeks').get(),
            db.collection('marks').get()
        ]);
        
        // Create maps
        const students = {};
        studentsSnap.forEach(doc => {
            students[doc.id] = {
                name: doc.data().name,
                class: doc.data().form,
                admNo: doc.data().admNo
            };
        });
        
        const weeks = {};
        weeksSnap.forEach(doc => {
            weeks[doc.id] = {
                term: doc.data().term,
                weekNumber: doc.data().weekNumber
            };
        });
        
        // Process marks
        const weekData = {};
        const overallData = {};
        
        marksSnap.forEach(doc => {
            const data = doc.data();
            const student = students[data.studentId];
            if (!student) return;
            
            // Week specific
            if (!weekData[data.weekId]) {
                weekData[data.weekId] = {
                    weekId: data.weekId,
                    marks: [],
                    students: {},
                    classes: {}
                };
            }
            
            const week = weekData[data.weekId];
            week.marks.push(data.marks);
            
            // Student in week
            if (!week.students[data.studentId]) {
                week.students[data.studentId] = {
                    studentId: data.studentId,
                    name: student.name,
                    class: student.class,
                    admNo: student.admNo,
                    marks: [],
                    total: 0,
                    count: 0
                };
            }
            const weekStudent = week.students[data.studentId];
            weekStudent.marks.push(data.marks);
            weekStudent.total += data.marks;
            weekStudent.count++;
            
            // Class in week
            if (!week.classes[student.class]) {
                week.classes[student.class] = {
                    className: student.class,
                    marks: [],
                    total: 0,
                    count: 0,
                    students: new Set()
                };
            }
            const weekClass = week.classes[student.class];
            weekClass.marks.push(data.marks);
            weekClass.total += data.marks;
            weekClass.count++;
            weekClass.students.add(data.studentId);
            
            // Overall
            if (!overallData[data.studentId]) {
                overallData[data.studentId] = {
                    studentId: data.studentId,
                    name: student.name,
                    class: student.class,
                    admNo: student.admNo,
                    marks: [],
                    total: 0,
                    count: 0
                };
            }
            const overall = overallData[data.studentId];
            overall.marks.push(data.marks);
            overall.total += data.marks;
            overall.count++;
        });
        
        // Prepare data for Firebase
        const analyticsData = {
            weekId: weekId,
            savedAt: firebase.firestore.FieldValue.serverTimestamp(),
            summary: {
                totalStudents: studentsSnap.size,
                totalWeeks: weeksSnap.size,
                totalMarks: marksSnap.size
            },
            weeks: {},
            overall: {}
        };
        
        // Process each week
        for (let wid in weekData) {
            const week = weekData[wid];
            const weekInfo = weeks[wid] || { term: 0, weekNumber: 0 };
            
            // Calculate student rankings for this week
            const rankings = [];
            for (let sid in week.students) {
                const s = week.students[sid];
                rankings.push({
                    studentId: sid,
                    name: s.name,
                    class: s.class,
                    admNo: s.admNo,
                    average: s.total / s.count,
                    total: s.total,
                    marks: s.marks,
                    count: s.count
                });
            }
            
            rankings.sort((a, b) => b.average - a.average);
            
            // Calculate class stats for this week
            const classStats = [];
            for (let cname in week.classes) {
                const c = week.classes[cname];
                const passMarks = c.marks.filter(m => m >= 50).length;
                const passRate = (passMarks / c.marks.length * 100).toFixed(1);
                
                classStats.push({
                    className: cname,
                    average: c.total / c.count,
                    studentCount: c.students.size,
                    passRate: parseFloat(passRate),
                    highest: Math.max(...c.marks),
                    lowest: Math.min(...c.marks),
                    totalMarks: c.total,
                    markCount: c.count
                });
            }
            
            classStats.sort((a, b) => b.average - a.average);
            
            analyticsData.weeks[wid] = {
                weekId: wid,
                term: weekInfo.term,
                weekNumber: weekInfo.weekNumber,
                totalMarks: week.marks.length,
                average: week.marks.reduce((a, b) => a + b, 0) / week.marks.length,
                highest: Math.max(...week.marks),
                lowest: Math.min(...week.marks),
                top10: rankings.slice(0, 10).map(r => ({
                    studentId: r.studentId,
                    name: r.name,
                    class: r.class,
                    admNo: r.admNo,
                    score: r.average
                })),
                bottom10: rankings.slice(-10).reverse().map(r => ({
                    studentId: r.studentId,
                    name: r.name,
                    class: r.class,
                    admNo: r.admNo,
                    score: r.average
                })),
                classRankings: classStats
            };
        }
        
        // Process overall data
        const overallRankings = [];
        for (let sid in overallData) {
            const s = overallData[sid];
            overallRankings.push({
                studentId: sid,
                name: s.name,
                class: s.class,
                admNo: s.admNo,
                average: s.total / s.count,
                total: s.total,
                count: s.count,
                marks: s.marks
            });
        }
        
        overallRankings.sort((a, b) => b.average - a.average);
        
        // Overall class stats
        const overallClassStats = {};
        for (let sid in overallData) {
            const s = overallData[sid];
            if (!overallClassStats[s.class]) {
                overallClassStats[s.class] = {
                    className: s.class,
                    totalMarks: 0,
                    count: 0,
                    students: new Set(),
                    allMarks: []
                };
            }
            const cs = overallClassStats[s.class];
            cs.totalMarks += s.total;
            cs.count += s.count;
            cs.students.add(sid);
            cs.allMarks.push(...s.marks);
        }
        
        const overallClassList = [];
        for (let cname in overallClassStats) {
            const cs = overallClassStats[cname];
            const passMarks = cs.allMarks.filter(m => m >= 50).length;
            const passRate = (passMarks / cs.allMarks.length * 100).toFixed(1);
            
            overallClassList.push({
                className: cname,
                average: cs.totalMarks / cs.count,
                studentCount: cs.students.size,
                passRate: parseFloat(passRate),
                highest: Math.max(...cs.allMarks),
                lowest: Math.min(...cs.allMarks),
                totalMarks: cs.totalMarks,
                markCount: cs.count
            });
        }
        
        overallClassList.sort((a, b) => b.average - a.average);
        
        analyticsData.overall = {
            totalMarks: marksSnap.size,
            average: Array.from(marksSnap.docs).reduce((a, d) => a + d.data().marks, 0) / marksSnap.size,
            highest: Math.max(...Array.from(marksSnap.docs).map(d => d.data().marks)),
            lowest: Math.min(...Array.from(marksSnap.docs).map(d => d.data().marks)),
            top10: overallRankings.slice(0, 10).map(r => ({
                studentId: r.studentId,
                name: r.name,
                class: r.class,
                admNo: r.admNo,
                score: r.average
            })),
            bottom10: overallRankings.slice(-10).reverse().map(r => ({
                studentId: r.studentId,
                name: r.name,
                class: r.class,
                admNo: r.admNo,
                score: r.average
            })),
            classRankings: overallClassList
        };
        
        // Save to Firebase based on week selection
        let docId = 'cat_analysis_overall';
        if (weekId !== 'all') {
            const weekInfo = weeks[weekId] || { term: 0, weekNumber: 0 };
            docId = `cat_analysis_term${weekInfo.term}_week${weekInfo.weekNumber}`;
        }
        
        await db.collection('analytics').doc(docId).set(analyticsData);
        
        console.log('✅ CAT analytics saved to Firebase:', docId);
        
        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: `CAT analysis saved to Firebase as "${docId}"`,
            timer: 2000
        });
        
        return analyticsData;
        
    } catch (error) {
        console.error('Error saving CAT analytics:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to save CAT analytics: ' + error.message
        });
    }
}

// Make it globally available
window.storeCATAnalytics = storeCATAnalytics;
    // ============= ORIGINAL ANALYTICS FUNCTIONS =============

    async function loadAnalytics() {
        try {
            UIManager.showSection('admin-analytics-section');
            
            // Show loading states
            document.getElementById('overallMean').textContent = '...';
            document.getElementById('highestScore').textContent = '...';
            document.getElementById('lowestScore').textContent = '...';
            document.getElementById('totalAssessments').textContent = '...';
            document.getElementById('classRankingsBody').innerHTML = '<tr><td colspan="7" class="text-center">Loading rankings...</td></tr>';
            document.getElementById('topStudentsOverallBody').innerHTML = '<tr><td colspan="4" class="text-center">Loading top students...</td></tr>';
            document.getElementById('classStatsBody').innerHTML = '<tr><td colspan="5" class="text-center">Loading statistics...</td></tr>';
            
            // Load weeks for filter
            await loadAnalyticsWeeks();
            
            const term = document.getElementById('analyticsTermSelect').value;
            const week = document.getElementById('analyticsWeekSelect').value;
            
            // Load all analytics data
            await loadOverallStats(term, week);
            await loadClassRankings(term, week);
            await loadTopStudents(term, week);
            await loadClassStats(term, week);
            await loadCharts(term, week);
            
            // Load rankings display
            await showRankingsInPage();
            
        } catch (error) {
            console.error('Error loading analytics:', error);
            Swal.fire('Error', 'Failed to load analytics: ' + error.message, 'error');
        }
    }

    async function loadAnalyticsWeeks() {
        try {
            let snapshot;
            try {
                snapshot = await db.collection('weeks').orderBy('term').orderBy('weekNumber').get();
            } catch (indexError) {
                console.log('Weeks index not ready, using fallback');
                snapshot = await db.collection('weeks').get();
            }
            
            let options = '<option value="all">All Weeks</option>';
            
            if (!snapshot.empty) {
                let weeks = [];
                snapshot.forEach(doc => {
                    weeks.push({ id: doc.id, ...doc.data() });
                });
                
                weeks.sort((a, b) => {
                    if (a.term !== b.term) return a.term - b.term;
                    return a.weekNumber - b.weekNumber;
                });
                
                weeks.forEach(week => {
                    options += `<option value="${week.id}">Term ${week.term} Week ${week.weekNumber}</option>`;
                });
            }
            
            document.getElementById('analyticsWeekSelect').innerHTML = options;
        } catch (error) {
            console.error('Error loading weeks:', error);
        }
    }

    async function loadOverallStats(term, week) {
        try {
            let marksQuery = db.collection('marks');
            
            if (week !== 'all') {
                marksQuery = marksQuery.where('weekId', '==', week);
            }
            
            const marksSnapshot = await marksQuery.get();
            
            if (marksSnapshot.empty) {
                document.getElementById('overallMean').textContent = '0%';
                document.getElementById('highestScore').textContent = '0%';
                document.getElementById('lowestScore').textContent = '0%';
                document.getElementById('totalAssessments').textContent = '0';
                return;
            }
            
            let totalMarks = 0;
            let highest = 0;
            let lowest = 100;
            let count = 0;
            
            marksSnapshot.forEach(doc => {
                const mark = doc.data().marks;
                totalMarks += mark;
                count++;
                if (mark > highest) highest = mark;
                if (mark < lowest) lowest = mark;
            });
            
            const mean = (totalMarks / count).toFixed(1);
            
            document.getElementById('overallMean').textContent = mean + '%';
            document.getElementById('highestScore').textContent = highest + '%';
            document.getElementById('lowestScore').textContent = lowest + '%';
            document.getElementById('totalAssessments').textContent = count;
            
        } catch (error) {
            console.error('Error loading overall stats:', error);
        }
    }

    async function loadClassRankings(term, week) {
        try {
            const classes = ['4E', '4W', '3E', '3W', '2E', '2W', '1E', '1W'];
            const classData = [];
            
            for (const className of classes) {
                const studentsSnapshot = await db.collection('students')
                    .where('form', '==', className)
                    .get();
                
                const studentIds = studentsSnapshot.docs.map(doc => doc.id);
                
                if (studentIds.length === 0) continue;
                
                let marks = [];
                let topStudent = { name: '', marks: 0 };
                let passCount = 0;
                
                for (const studentId of studentIds) {
                    let marksQuery = db.collection('marks').where('studentId', '==', studentId);
                    
                    if (week !== 'all') {
                        marksQuery = marksQuery.where('weekId', '==', week);
                    }
                    
                    const marksSnapshot = await marksQuery.get();
                    
                    if (!marksSnapshot.empty) {
                        let studentMarks = [];
                        marksSnapshot.forEach(doc => {
                            const mark = doc.data().marks;
                            studentMarks.push(mark);
                            marks.push(mark);
                        });
                        
                        const studentAvg = studentMarks.reduce((a, b) => a + b, 0) / studentMarks.length;
                        
                        if (studentAvg > topStudent.marks) {
                            topStudent.marks = studentAvg;
                            const studentDoc = await db.collection('students').doc(studentId).get();
                            topStudent.name = studentDoc.data().name;
                        }
                        
                        if (studentMarks.some(m => m >= 50)) {
                            passCount++;
                        }
                    }
                }
                
                if (marks.length > 0) {
                    const mean = marks.reduce((a, b) => a + b, 0) / marks.length;
                    const passRate = ((passCount / studentIds.length) * 100).toFixed(1);
                    
                    classData.push({
                        name: className,
                        mean: mean,
                        studentCount: studentIds.length,
                        passRate: passRate,
                        topStudent: topStudent.name || 'N/A',
                        topScore: topStudent.marks.toFixed(1)
                    });
                }
            }
            
            classData.sort((a, b) => b.mean - a.mean);
            
            let html = '';
            if (classData.length === 0) {
                html = '<tr><td colspan="7" class="text-center">No data available</td></tr>';
            } else {
                classData.forEach((cls, index) => {
                    const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
                    const trend = index < classData.length - 1 && cls.mean > classData[index + 1].mean ? '📈' : '📉';
                    
                    html += `
                        <tr>
                            <td>
                                <span class="badge-rank ${rankClass}">${index + 1}</span>
                            </td>
                            <td><strong>${cls.name}</strong></td>
                            <td>${cls.mean.toFixed(1)}%</td>
                            <td>${cls.studentCount}</td>
                            <td>
                                <div class="progress" style="height: 20px;">
                                    <div class="progress-bar bg-success" style="width: ${cls.passRate}%">${cls.passRate}%</div>
                                </div>
                            </td>
                            <td>${cls.topStudent} (${cls.topScore}%)</td>
                            <td class="text-center" style="font-size: 1.2rem;">${trend}</td>
                        </tr>
                    `;
                });
            }
            
            document.getElementById('classRankingsBody').innerHTML = html;
            
        } catch (error) {
            console.error('Error loading class rankings:', error);
            document.getElementById('classRankingsBody').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading rankings</td></tr>';
        }
    }

    async function loadTopStudents(term, week) {
        try {
            const studentsSnapshot = await db.collection('students').get();
            const studentAverages = [];
            
            for (const doc of studentsSnapshot.docs) {
                const student = doc.data();
                
                let marksQuery = db.collection('marks').where('studentId', '==', doc.id);
                
                if (week !== 'all') {
                    marksQuery = marksQuery.where('weekId', '==', week);
                }
                
                const marksSnapshot = await marksQuery.get();
                
                if (!marksSnapshot.empty) {
                    let total = 0;
                    marksSnapshot.forEach(markDoc => {
                        total += markDoc.data().marks;
                    });
                    const average = total / marksSnapshot.size;
                    
                    studentAverages.push({
                        name: student.name,
                        class: student.form,
                        average: average,
                        admNo: student.admNo
                    });
                }
            }
            
            studentAverages.sort((a, b) => b.average - a.average);
            const top10 = studentAverages.slice(0, 10);
            
            let html = '';
            if (top10.length === 0) {
                html = '<tr><td colspan="4" class="text-center">No data available</td></tr>';
            } else {
                top10.forEach((student, index) => {
                    const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'bg-secondary';
                    html += `
                        <tr>
                            <td>
                                <span class="badge-rank ${rankClass}">${index + 1}</span>
                            </td>
                            <td>${student.name}</td>
                            <td>${student.class}</td>
                            <td><strong>${student.average.toFixed(1)}%</strong></td>
                        </tr>
                    `;
                });
            }
            
            document.getElementById('topStudentsOverallBody').innerHTML = html;
            
        } catch (error) {
            console.error('Error loading top students:', error);
            document.getElementById('topStudentsOverallBody').innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading top students</td></tr>';
        }
    }

    async function loadClassStats(term, week) {
        try {
            const classes = ['4E', '4W', '3E', '3W', '2E', '2W', '1E', '1W'];
            let html = '';
            
            for (const className of classes) {
                const studentsSnapshot = await db.collection('students')
                    .where('form', '==', className)
                    .get();
                
                const studentIds = studentsSnapshot.docs.map(doc => doc.id);
                
                if (studentIds.length === 0) continue;
                
                let allMarks = [];
                
                for (const studentId of studentIds) {
                    let marksQuery = db.collection('marks').where('studentId', '==', studentId);
                    
                    if (week !== 'all') {
                        marksQuery = marksQuery.where('weekId', '==', week);
                    }
                    
                    const marksSnapshot = await marksQuery.get();
                    
                    marksSnapshot.forEach(doc => {
                        allMarks.push(doc.data().marks);
                    });
                }
                
                if (allMarks.length > 0) {
                    const mean = allMarks.reduce((a, b) => a + b, 0) / allMarks.length;
                    
                    const sorted = [...allMarks].sort((a, b) => a - b);
                    const median = allMarks.length % 2 === 0 
                        ? (sorted[allMarks.length/2 - 1] + sorted[allMarks.length/2]) / 2
                        : sorted[Math.floor(allMarks.length/2)];
                    
                    const frequency = {};
                    let maxFreq = 0;
                    let mode = allMarks[0];
                    
                    allMarks.forEach(mark => {
                        frequency[mark] = (frequency[mark] || 0) + 1;
                        if (frequency[mark] > maxFreq) {
                            maxFreq = frequency[mark];
                            mode = mark;
                        }
                    });
                    
                    const squareDiffs = allMarks.map(mark => Math.pow(mark - mean, 2));
                    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
                    const stdDev = Math.sqrt(avgSquareDiff).toFixed(1);
                    
                    html += `
                        <tr>
                            <td><strong>${className}</strong></td>
                            <td>${mean.toFixed(1)}%</td>
                            <td>${median.toFixed(1)}%</td>
                            <td>${mode}%</td>
                            <td>±${stdDev}</td>
                        </tr>
                    `;
                }
            }
            
            if (html === '') {
                html = '<tr><td colspan="5" class="text-center">No data available</td></tr>';
            }
            
            document.getElementById('classStatsBody').innerHTML = html;
            
        } catch (error) {
            console.error('Error loading class stats:', error);
            document.getElementById('classStatsBody').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading statistics</td></tr>';
        }
    }

    async function loadCharts(term, week) {
        try {
            const ctx1 = document.getElementById('classPerformanceChart').getContext('2d');
            const ctx2 = document.getElementById('performanceDistributionChart').getContext('2d');
            
            // Class Performance Chart
            const classes = ['4E', '4W', '3E', '3W', '2E', '2W', '1E', '1W'];
            const classMeans = [];
            const classLabels = [];
            
            for (const className of classes) {
                const studentsSnapshot = await db.collection('students')
                    .where('form', '==', className)
                    .get();
                
                const studentIds = studentsSnapshot.docs.map(doc => doc.id);
                
                if (studentIds.length === 0) continue;
                
                let allMarks = [];
                
                for (const studentId of studentIds) {
                    let marksQuery = db.collection('marks').where('studentId', '==', studentId);
                    
                    if (week !== 'all') {
                        marksQuery = marksQuery.where('weekId', '==', week);
                    }
                    
                    const marksSnapshot = await marksQuery.get();
                    
                    marksSnapshot.forEach(doc => {
                        allMarks.push(doc.data().marks);
                    });
                }
                
                if (allMarks.length > 0) {
                    const mean = allMarks.reduce((a, b) => a + b, 0) / allMarks.length;
                    classMeans.push(mean);
                    classLabels.push(className);
                }
            }
            
            if (classPerformanceChart) {
                classPerformanceChart.destroy();
            }
            
            if (classLabels.length > 0) {
                classPerformanceChart = new Chart(ctx1, {
                    type: 'bar',
                    data: {
                        labels: classLabels,
                        datasets: [{
                            label: 'Mean Score (%)',
                            data: classMeans,
                            backgroundColor: 'rgba(128, 0, 0, 0.7)',
                            borderColor: '#800000',
                            borderWidth: 1,
                            borderRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                title: {
                                    display: true,
                                    text: 'Score (%)'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                });
            } else {
                ctx1.clearRect(0, 0, ctx1.canvas.width, ctx1.canvas.height);
                ctx1.font = '14px Poppins';
                ctx1.fillStyle = '#666';
                ctx1.textAlign = 'center';
                ctx1.fillText('No data available', ctx1.canvas.width/2, ctx1.canvas.height/2);
            }
            
            // Performance Distribution Chart
            const marksSnapshot = await db.collection('marks').get();
            const distribution = {
                '0-20': 0,
                '21-40': 0,
                '41-60': 0,
                '61-80': 0,
                '81-100': 0
            };
            
            marksSnapshot.forEach(doc => {
                const mark = doc.data().marks;
                if (mark <= 20) distribution['0-20']++;
                else if (mark <= 40) distribution['21-40']++;
                else if (mark <= 60) distribution['41-60']++;
                else if (mark <= 80) distribution['61-80']++;
                else distribution['81-100']++;
            });
            
            if (distributionChart) {
                distributionChart.destroy();
            }
            
            if (Object.values(distribution).some(v => v > 0)) {
                distributionChart = new Chart(ctx2, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(distribution),
                        datasets: [{
                            data: Object.values(distribution),
                            backgroundColor: [
                                '#ff4444',
                                '#ffa444',
                                '#ffd966',
                                '#6c9b6c',
                                '#2e7d32'
                            ],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    boxWidth: 12,
                                    padding: 10
                                }
                            }
                        }
                    }
                });
            } else {
                ctx2.clearRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
                ctx2.font = '14px Poppins';
                ctx2.fillStyle = '#666';
                ctx2.textAlign = 'center';
                ctx2.fillText('No data available', ctx2.canvas.width/2, ctx2.canvas.height/2);
            }
            
        } catch (error) {
            console.error('Error loading charts:', error);
        }
    }

    // ============= RANKINGS FUNCTIONS =============

    async function displayRankings() {
        try {
            console.log('📊 Generating rankings...');
            
            const students = await db.collection('students').get();
            const marks = await db.collection('marks').get();
            
            // Calculate student averages
            const studentStats = {};
            marks.forEach(doc => {
                const data = doc.data();
                if (!studentStats[data.studentId]) {
                    studentStats[data.studentId] = {
                        total: 0,
                        count: 0,
                        marks: []
                    };
                }
                studentStats[data.studentId].total += data.marks;
                studentStats[data.studentId].count++;
                studentStats[data.studentId].marks.push(data.marks);
            });
            
            // Build rankings array
            const rankings = [];
            for (const doc of students.docs) {
                const student = doc.data();
                const stats = studentStats[doc.id];
                
                if (stats) {
                    const average = stats.total / stats.count;
                    const highest = Math.max(...stats.marks);
                    const lowest = Math.min(...stats.marks);
                    
                    rankings.push({
                        id: doc.id,
                        name: student.name,
                        class: student.form,
                        admNo: student.admNo,
                        average: average,
                        highest: highest,
                        lowest: lowest,
                        totalMarks: stats.total,
                        assessments: stats.count
                    });
                }
            }
            
            // Sort by average (highest first)
            rankings.sort((a, b) => b.average - a.average);
            
            // Display in console
            console.log('\n🥇 TOP 10 STUDENTS:');
            console.log('='.repeat(60));
            rankings.slice(0, 10).forEach((student, index) => {
                console.log(`${index + 1}. ${student.name} (${student.class}) - Avg: ${student.average.toFixed(1)}%`);
            });
            
            console.log('\n📉 BOTTOM 10 STUDENTS:');
            console.log('='.repeat(60));
            rankings.slice(-10).reverse().forEach((student, index) => {
                console.log(`${index + 1}. ${student.name} (${student.class}) - Avg: ${student.average.toFixed(1)}%`);
            });
            
            // Calculate class rankings
            const classStats = {};
            rankings.forEach(student => {
                if (!classStats[student.class]) {
                    classStats[student.class] = {
                        total: 0,
                        count: 0,
                        students: []
                    };
                }
                classStats[student.class].total += student.average;
                classStats[student.class].count++;
                classStats[student.class].students.push(student);
            });
            
            const classRankings = Object.keys(classStats).map(className => ({
                class: className,
                average: classStats[className].total / classStats[className].count,
                studentCount: classStats[className].count
            })).sort((a, b) => b.average - a.average);
            
            console.log('\n📊 CLASS RANKINGS:');
            console.log('='.repeat(60));
            classRankings.forEach((cls, index) => {
                console.log(`${index + 1}. ${cls.class} - Average: ${cls.average.toFixed(1)}% (${cls.studentCount} students)`);
            });
            
            return rankings;
            
        } catch (error) {
            console.error('Error generating rankings:', error);
            return [];
        }
    }

    async function showRankingsInPage() {
        try {
            const rankings = await displayRankings();
            if (rankings.length === 0) return;
            
            // Get the analytics section
            const analyticsSection = document.getElementById('admin-analytics-section');
            if (!analyticsSection) return;
            
            const sectionCard = analyticsSection.querySelector('.section-card');
            
            // Remove existing rankings sections
            let existingRankings = document.getElementById('rankings-section');
            if (existingRankings) existingRankings.remove();
            
            let existingMerit = document.getElementById('merit-section');
            if (existingMerit) existingMerit.remove();
            
            // Create new rankings section
            const rankingsSection = document.createElement('div');
            rankingsSection.id = 'rankings-section';
            rankingsSection.className = 'row mt-4';
            
            // Calculate class rankings
            const classStats = {};
            rankings.forEach(student => {
                if (!classStats[student.class]) {
                    classStats[student.class] = { total: 0, count: 0 };
                }
                classStats[student.class].total += student.average;
                classStats[student.class].count++;
            });
            
            const classRankings = Object.keys(classStats).map(className => ({
                class: className,
                average: classStats[className].total / classStats[className].count,
                studentCount: classStats[className].count
            })).sort((a, b) => b.average - a.average);
            
            // Top 10 HTML
            let top10Html = `
                <div class="col-md-4">
                    <div class="bg-white rounded shadow-sm p-3 h-100">
                        <h5 class="mb-3">
                            <i class="fas fa-crown text-warning me-2"></i>TOP 10 STUDENTS
                        </h5>
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead class="bg-light">
                                    <tr>
                                        <th>Rank</th>
                                        <th>Name</th>
                                        <th>Class</th>
                                        <th>Average</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            rankings.slice(0, 10).forEach((student, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
                top10Html += `
                    <tr>
                        <td><span class="badge-rank ${rankClass}">${medal || index+1}</span></td>
                        <td>${student.name}</td>
                        <td>${student.class}</td>
                        <td><strong>${student.average.toFixed(1)}%</strong></td>
                    </tr>
                `;
            });
            
            top10Html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // Bottom 10 HTML
            let bottom10Html = `
                <div class="col-md-4">
                    <div class="bg-white rounded shadow-sm p-3 h-100">
                        <h5 class="mb-3">
                            <i class="fas fa-exclamation-triangle text-danger me-2"></i>BOTTOM 10 STUDENTS
                        </h5>
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead class="bg-light">
                                    <tr>
                                        <th>Rank</th>
                                        <th>Name</th>
                                        <th>Class</th>
                                        <th>Average</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            rankings.slice(-10).reverse().forEach((student, index) => {
                bottom10Html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${student.name}</td>
                        <td>${student.class}</td>
                        <td><strong class="text-danger">${student.average.toFixed(1)}%</strong></td>
                    </tr>
                `;
            });
            
            bottom10Html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // Class Rankings HTML
            let classHtml = `
                <div class="col-md-4">
                    <div class="bg-white rounded shadow-sm p-3 h-100">
                        <h5 class="mb-3">
                            <i class="fas fa-school me-2" style="color: var(--maroon);"></i>CLASS RANKINGS
                        </h5>
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead class="bg-light">
                                    <tr>
                                        <th>Rank</th>
                                        <th>Class</th>
                                        <th>Average</th>
                                        <th>Students</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            classRankings.forEach((cls, index) => {
                const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
                classHtml += `
                    <tr>
                        <td><span class="badge-rank ${rankClass}">${index + 1}</span></td>
                        <td><strong>${cls.class}</strong></td>
                        <td>${cls.average.toFixed(1)}%</td>
                        <td>${cls.studentCount}</td>
                    </tr>
                `;
            });
            
            classHtml += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // Merit List HTML (full table)
            let meritHtml = `
                <div class="col-12 mt-4">
                    <div class="bg-white rounded shadow-sm p-3">
                        <h5 class="mb-3">
                            <i class="fas fa-list-ol me-2" style="color: var(--maroon);"></i>OVERALL MERIT LIST
                        </h5>
                        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                            <table class="table table-sm table-hover">
                                <thead class="bg-light sticky-top">
                                    <tr>
                                        <th>Rank</th>
                                        <th>ADM No</th>
                                        <th>Name</th>
                                        <th>Class</th>
                                        <th>Average</th>
                                        <th>Highest</th>
                                        <th>Lowest</th>
                                        <th>Assessments</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            rankings.forEach((student, index) => {
                const rankClass = index < 3 ? `rank-${index+1}` : '';
                meritHtml += `
                    <tr>
                        <td><span class="badge-rank ${rankClass}">${index + 1}</span></td>
                        <td>${student.admNo}</td>
                        <td>${student.name}</td>
                        <td>${student.class}</td>
                        <td><strong>${student.average.toFixed(1)}%</strong></td>
                        <td>${student.highest}%</td>
                        <td>${student.lowest}%</td>
                        <td>${student.assessments}</td>
                    </tr>
                `;
            });
            
            meritHtml += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // Add all sections
            rankingsSection.innerHTML = top10Html + bottom10Html + classHtml;
            sectionCard.appendChild(rankingsSection);
            
            // Add merit list
            const meritSection = document.createElement('div');
            meritSection.id = 'merit-section';
            meritSection.className = 'row mt-4';
            meritSection.innerHTML = meritHtml;
            sectionCard.appendChild(meritSection);
            
            console.log('✅ Rankings displayed on page');
            
        } catch (error) {
            console.error('Error showing rankings:', error);
        }
    }

    // ============= ANALYTICS CACHE SYSTEM =============

    const AnalyticsCache = (function() {
        let cache = {
            timestamp: null,
            weekId: 'all',
            data: null
        };
        
        const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
        
        function saveToStorage() {
            try {
                localStorage.setItem('analyticsCache', JSON.stringify({
                    timestamp: cache.timestamp,
                    weekId: cache.weekId,
                    data: cache.data
                }));
            } catch (e) {
                console.log('Could not save to localStorage:', e);
            }
        }
        
        function loadFromStorage() {
            try {
                const stored = localStorage.getItem('analyticsCache');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    cache = {
                        timestamp: parsed.timestamp,
                        weekId: parsed.weekId,
                        data: parsed.data
                    };
                    return true;
                }
            } catch (e) {
                console.log('Could not load from localStorage:', e);
            }
            return false;
        }
        
        function isValid(weekId) {
            if (!cache.data || !cache.timestamp) return false;
            if (cache.weekId !== weekId) return false;
            
            const now = Date.now();
            const age = now - cache.timestamp;
            return age < CACHE_EXPIRY;
        }
        
        function get(weekId) {
            if (isValid(weekId)) {
                return cache.data;
            }
            return null;
        }
        
        function set(weekId, data) {
            cache = {
                timestamp: Date.now(),
                weekId: weekId,
                data: data
            };
            saveToStorage();
        }
        
        function clear() {
            cache = {
                timestamp: null,
                weekId: 'all',
                data: null
            };
            localStorage.removeItem('analyticsCache');
        }
        
        // Load from storage on init
        loadFromStorage();
        
        return {
            get,
            set,
            clear,
            isValid
        };
    })();

    // ============= FAST ANALYTICS WITH CACHING =============

    async function loadFastAnalytics(forceRefresh = false) {
        try {
            const startTime = performance.now();
            
            UIManager.showSection('complete-analytics-section');
            
            // Get selected week
            const weekSelect = document.getElementById('analyticsWeekSelect');
            const weekId = weekSelect ? weekSelect.value : 'all';
            
            // Check cache first (unless force refresh)
            if (!forceRefresh) {
                const cached = AnalyticsCache.get(weekId);
                if (cached) {
                    console.log('📦 Loading from cache...');
                    displayAnalyticsFromCache(cached);
                    const endTime = performance.now();
                    console.log(`✅ Analytics loaded from cache in ${(endTime - startTime).toFixed(0)}ms`);
                    return;
                }
            }
            
            console.log('🔍 Generating fresh analytics...');
            showLoadingStates();
            
            // Fetch all data in parallel
            const [studentsSnap, weeksSnap, marksSnap] = await Promise.all([
                db.collection('students').get(),
                db.collection('weeks').get(),
                db.collection('marks').get()
            ]);
            
            // Create student map for quick lookup
            const studentDetails = new Map();
            studentsSnap.docs.forEach(doc => {
                studentDetails.set(doc.id, {
                    name: doc.data().name,
                    class: doc.data().form,
                    admNo: doc.data().admNo
                });
            });
            
            // Create week map
            const weekDetails = new Map();
            weeksSnap.docs.forEach(doc => {
                weekDetails.set(doc.id, {
                    term: doc.data().term,
                    weekNumber: doc.data().weekNumber
                });
            });
            
            // Process marks - filter by week if needed
            const studentMap = new Map();
            const classMap = new Map();
            const weekMap = new Map();
            
            let totalMarks = 0;
            let totalCount = 0;
            let highestScore = 0;
            let lowestScore = 100;
            
            marksSnap.docs.forEach(doc => {
                const data = doc.data();
                const mark = data.marks;
                const studentId = data.studentId;
                const markWeekId = data.weekId;
                
                // Filter by week if specified
                if (weekId !== 'all' && markWeekId !== weekId) return;
                
                const studentClass = studentDetails.get(studentId)?.class || 'Unknown';
                
                // Update totals
                totalMarks += mark;
                totalCount++;
                if (mark > highestScore) highestScore = mark;
                if (mark < lowestScore) lowestScore = mark;
                
                // Student stats
                if (!studentMap.has(studentId)) {
                    studentMap.set(studentId, {
                        total: 0,
                        count: 0,
                        marks: []
                    });
                }
                const stats = studentMap.get(studentId);
                stats.total += mark;
                stats.count++;
                stats.marks.push(mark);
                
                // Class stats
                if (!classMap.has(studentClass)) {
                    classMap.set(studentClass, {
                        total: 0,
                        count: 0,
                        marks: [],
                        students: new Set()
                    });
                }
                const classStats = classMap.get(studentClass);
                classStats.total += mark;
                classStats.count++;
                classStats.marks.push(mark);
                classStats.students.add(studentId);
                
                // Week stats
                if (!weekMap.has(markWeekId)) {
                    weekMap.set(markWeekId, {
                        total: 0,
                        count: 0,
                        marks: []
                    });
                }
                const weekStats = weekMap.get(markWeekId);
                weekStats.total += mark;
                weekStats.count++;
                weekStats.marks.push(mark);
            });
            
            // Update summary stats
            document.getElementById('total-students').textContent = studentsSnap.size;
            document.getElementById('total-weeks').textContent = weeksSnap.size;
            document.getElementById('total-marks').textContent = totalCount;
            document.getElementById('overall-average').textContent = 
                totalCount > 0 ? (totalMarks / totalCount).toFixed(1) + '%' : '0%';
            
            // Build rankings array
            const rankings = [];
            studentMap.forEach((stats, studentId) => {
                const student = studentDetails.get(studentId);
                if (student) {
                    const average = stats.total / stats.count;
                    rankings.push({
                        id: studentId,
                        name: student.name,
                        class: student.class,
                        admNo: student.admNo,
                        average: average,
                        highest: Math.max(...stats.marks),
                        lowest: Math.min(...stats.marks),
                        assessments: stats.count,
                        allMarks: stats.marks
                    });
                }
            });
            
            // Sort by average
            rankings.sort((a, b) => b.average - a.average);
            
            // Build class rankings
            const classRankings = [];
            classMap.forEach((stats, className) => {
                const classAvg = stats.total / stats.count;
                const passMarks = stats.marks.filter(m => m >= 50).length;
                const passRate = (passMarks / stats.marks.length * 100).toFixed(1);
                
                // Find top student in class
                let topStudent = 'N/A';
                let topScore = 0;
                rankings.forEach(s => {
                    if (s.class === className && s.average > topScore) {
                        topScore = s.average;
                        topStudent = s.name;
                    }
                });
                
                classRankings.push({
                    name: className,
                    average: classAvg,
                    studentCount: stats.students.size,
                    passRate: passRate,
                    highest: Math.max(...stats.marks),
                    lowest: Math.min(...stats.marks),
                    topStudent: topStudent
                });
            });
            
            classRankings.sort((a, b) => b.average - a.average);
            
            // Build week performance
            const weekPerformance = [];
            weekMap.forEach((stats, weekId) => {
                const week = weekDetails.get(weekId);
                if (week) {
                    weekPerformance.push({
                        id: weekId,
                        term: week.term,
                        weekNumber: week.weekNumber,
                        average: stats.total / stats.count,
                        count: stats.count
                    });
                }
            });
            
            weekPerformance.sort((a, b) => {
                if (a.term !== b.term) return a.term - b.term;
                return a.weekNumber - b.weekNumber;
            });
            
            // Prepare cache data
            const cacheData = {
                summary: {
                    totalStudents: studentsSnap.size,
                    totalWeeks: weeksSnap.size,
                    totalMarks: totalCount,
                    overallAverage: totalCount > 0 ? (totalMarks / totalCount).toFixed(1) : '0',
                    highestScore: highestScore,
                    lowestScore: lowestScore
                },
                rankings: rankings,
                classRankings: classRankings,
                weekPerformance: weekPerformance,
                weekId: weekId,
                generatedAt: new Date().toISOString()
            };
            
            // Store in cache
            AnalyticsCache.set(weekId, cacheData);
            
            // Display the data
            displayAnalyticsFromCache(cacheData);
            
            const endTime = performance.now();
            console.log(`✅ Fresh analytics generated in ${(endTime - startTime).toFixed(0)}ms`);
            console.log(`📊 Week: ${weekId === 'all' ? 'All Weeks' : 'Specific Week'}`);
            
        } catch (error) {
            console.error('Error in fast analytics:', error);
            Swal.fire('Error', 'Failed to load analytics: ' + error.message, 'error');
        }
    }

    // Display analytics from cache
    function displayAnalyticsFromCache(data) {
        // Update summary stats
        document.getElementById('total-students').textContent = data.summary.totalStudents;
        document.getElementById('total-weeks').textContent = data.summary.totalWeeks;
        document.getElementById('total-marks').textContent = data.summary.totalMarks;
        document.getElementById('overall-average').textContent = data.summary.overallAverage + '%';
        
        // Display Top 10 (by average)
        let topHtml = '';
        data.rankings.slice(0, 10).forEach((s, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
            topHtml += `
                <tr>
                    <td><strong>${medal || i+1}</strong></td>
                    <td>${s.name}</td>
                    <td>${s.class}</td>
                    <td><span class="badge bg-success">${s.average.toFixed(1)}%</span></td>
                    <td>${s.assessments}</td>
                </tr>
            `;
        });
        document.getElementById('top10-body').innerHTML = topHtml || '<tr><td colspan="5" class="text-center">No data</td></tr>';
        
        // Display Bottom 10 (by average)
        let bottomHtml = '';
        data.rankings.slice(-10).reverse().forEach((s, i) => {
            bottomHtml += `
                <tr>
                    <td><strong>${i+1}</strong></td>
                    <td>${s.name}</td>
                    <td>${s.class}</td>
                    <td><span class="badge bg-danger">${s.average.toFixed(1)}%</span></td>
                    <td>${s.assessments}</td>
                </tr>
            `;
        });
        document.getElementById('bottom10-body').innerHTML = bottomHtml || '<tr><td colspan="5" class="text-center">No data</td></tr>';
        
        // Display Class Performance
        let classHtml = '';
        data.classRankings.forEach((cls, index) => {
            const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
            classHtml += `
                <tr>
                    <td><span class="badge-rank ${rankClass}">${index + 1}</span></td>
                    <td><strong>${cls.name}</strong></td>
                    <td>${cls.studentCount}</td>
                    <td>${cls.average.toFixed(1)}%</td>
                    <td>${cls.highest}%</td>
                    <td>${cls.lowest}%</td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar ${cls.passRate >= 50 ? 'bg-success' : 'bg-warning'}" 
                                 style="width: ${cls.passRate}%">${cls.passRate}%</div>
                        </div>
                    </td>
                    <td>${cls.topStudent}</td>
                </tr>
            `;
        });
        document.getElementById('class-performance-body').innerHTML = classHtml || '<tr><td colspan="8" class="text-center">No data</td></tr>';
        
        // Display Merit List
        let meritHtml = '';
        data.rankings.forEach((s, i) => {
            meritHtml += `
                <tr>
                    <td><strong>${i + 1}</strong></td>
                    <td>${s.admNo}</td>
                    <td>${s.name}</td>
                    <td>${s.class}</td>
                    <td><strong>${s.average.toFixed(1)}%</strong></td>
                    <td>${s.highest}%</td>
                    <td>${s.lowest}%</td>
                    <td>${s.assessments}</td>
                </tr>
            `;
        });
        document.getElementById('merit-body').innerHTML = meritHtml || '<tr><td colspan="8" class="text-center">No data</td></tr>';
        
        // Display generation time
        const generatedAt = new Date(data.generatedAt).toLocaleString();
        const cacheStatus = document.getElementById('cache-status');
        if (cacheStatus) {
            cacheStatus.innerHTML = `<small class="text-muted">Last updated: ${generatedAt} | Week: ${data.weekId === 'all' ? 'All Weeks' : 'Specific Week'}</small>`;
        }
    }

    // Show loading states
    function showLoadingStates() {
        const spinner = '<div class="spinner-border text-maroon" role="status"><span class="visually-hidden">Loading...</span></div>';
        document.getElementById('top10-body').innerHTML = `<tr><td colspan="5" class="text-center">${spinner}</td></tr>`;
        document.getElementById('bottom10-body').innerHTML = `<tr><td colspan="5" class="text-center">${spinner}</td></tr>`;
        document.getElementById('class-performance-body').innerHTML = `<tr><td colspan="8" class="text-center">${spinner}</td></tr>`;
        document.getElementById('merit-body').innerHTML = `<tr><td colspan="8" class="text-center">${spinner}</td></tr>`;
    }

    // Clear cache and regenerate
    function regenerateAnalytics() {
        AnalyticsCache.clear();
        loadFastAnalytics(true);
    }

    // Initialize analytics with week selector
    async function initAnalyticsWithWeeks() {
        try {
            const weeksSnap = await db.collection('weeks').orderBy('term').orderBy('weekNumber').get();
            let options = '<option value="all">All Weeks</option>';
            
            weeksSnap.forEach(doc => {
                const week = doc.data();
                options += `<option value="${doc.id}">Term ${week.term} Week ${week.weekNumber}</option>`;
            });
            
            const weekSelect = document.getElementById('analyticsWeekSelect');
            if (weekSelect) {
                weekSelect.innerHTML = options;
                weekSelect.onchange = () => loadFastAnalytics(true);
            }
            
            // Add regenerate button
            const header = document.querySelector('#complete-analytics-section .section-header div');
            if (header && !document.getElementById('regenerate-btn')) {
                const regenBtn = document.createElement('button');
                regenBtn.id = 'regenerate-btn';
                regenBtn.className = 'btn btn-warning ms-2';
                regenBtn.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Regenerate';
                regenBtn.onclick = regenerateAnalytics;
                header.appendChild(regenBtn);
                
                // Add cache status
                const statusDiv = document.createElement('div');
                statusDiv.id = 'cache-status';
                statusDiv.className = 'mt-2';
                header.parentNode.insertBefore(statusDiv, header.nextSibling);
            }
            
        } catch (error) {
            console.error('Error loading weeks:', error);
        }
    }

    // ============= ANALYTICS STORAGE SYSTEM =============

    const ANALYTICS_COLLECTION = 'analytics';

    async function storeAnalyticsInFirebase(weekId = 'all') {
        try {
            console.log('💾 Storing analytics in Firebase...');
            
            Swal.fire({
                title: 'Generating Analytics',
                html: 'Please wait...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            const [studentsSnap, weeksSnap, marksSnap] = await Promise.all([
                db.collection('students').get(),
                db.collection('weeks').get(),
                db.collection('marks').get()
            ]);
            
            const studentDetails = new Map();
            studentsSnap.docs.forEach(doc => {
                studentDetails.set(doc.id, {
                    name: doc.data().name,
                    class: doc.data().form,
                    admNo: doc.data().admNo
                });
            });
            
            const weekDetails = new Map();
            weeksSnap.docs.forEach(doc => {
                weekDetails.set(doc.id, {
                    term: doc.data().term,
                    weekNumber: doc.data().weekNumber
                });
            });
            
            const studentMap = new Map();
            const classMap = new Map();
            const weekMap = new Map();
            
            let totalMarks = 0;
            let totalCount = 0;
            
            marksSnap.docs.forEach(doc => {
                const data = doc.data();
                const mark = data.marks;
                const studentId = data.studentId;
                const markWeekId = data.weekId;
                
                if (weekId !== 'all' && markWeekId !== weekId) return;
                
                const studentClass = studentDetails.get(studentId)?.class || 'Unknown';
                
                totalMarks += mark;
                totalCount++;
                
                if (!studentMap.has(studentId)) {
                    studentMap.set(studentId, {
                        total: 0,
                        count: 0,
                        marks: []
                    });
                }
                const stats = studentMap.get(studentId);
                stats.total += mark;
                stats.count++;
                stats.marks.push(mark);
                
                if (!classMap.has(studentClass)) {
                    classMap.set(studentClass, {
                        total: 0,
                        count: 0,
                        marks: [],
                        students: new Set()
                    });
                }
                const classStats = classMap.get(studentClass);
                classStats.total += mark;
                classStats.count++;
                classStats.marks.push(mark);
                classStats.students.add(studentId);
                
                if (!weekMap.has(markWeekId)) {
                    weekMap.set(markWeekId, {
                        total: 0,
                        count: 0,
                        marks: []
                    });
                }
                const weekStats = weekMap.get(markWeekId);
                weekStats.total += mark;
                weekStats.count++;
                weekStats.marks.push(mark);
            });
            
            const rankings = [];
            studentMap.forEach((stats, studentId) => {
                const student = studentDetails.get(studentId);
                if (student) {
                    const average = stats.total / stats.count;
                    rankings.push({
                        studentId: studentId,
                        name: student.name,
                        class: student.class,
                        admNo: student.admNo,
                        average: average,
                        highest: Math.max(...stats.marks),
                        lowest: Math.min(...stats.marks),
                        assessments: stats.count,
                        totalMarks: stats.total
                    });
                }
            });
            
            rankings.sort((a, b) => b.average - a.average);
            
            const classRankings = [];
            classMap.forEach((stats, className) => {
                const classAvg = stats.total / stats.count;
                const passMarks = stats.marks.filter(m => m >= 50).length;
                const passRate = (passMarks / stats.marks.length * 100).toFixed(1);
                
                let topStudent = 'N/A';
                let topScore = 0;
                rankings.forEach(s => {
                    if (s.class === className && s.average > topScore) {
                        topScore = s.average;
                        topStudent = s.name;
                    }
                });
                
                classRankings.push({
                    className: className,
                    average: classAvg,
                    studentCount: stats.students.size,
                    passRate: parseFloat(passRate),
                    highest: Math.max(...stats.marks),
                    lowest: Math.min(...stats.marks),
                    topStudent: topStudent,
                    topScore: topScore
                });
            });
            
            classRankings.sort((a, b) => b.average - a.average);
            
            const weekPerformance = [];
            weekMap.forEach((stats, weekId) => {
                const week = weekDetails.get(weekId);
                if (week) {
                    weekPerformance.push({
                        weekId: weekId,
                        term: week.term,
                        weekNumber: week.weekNumber,
                        average: stats.total / stats.count,
                        count: stats.count,
                        highest: Math.max(...stats.marks),
                        lowest: Math.min(...stats.marks)
                    });
                }
            });
            
            weekPerformance.sort((a, b) => {
                if (a.term !== b.term) return a.term - b.term;
                return a.weekNumber - b.weekNumber;
            });
            
            const analyticsData = {
                weekId: weekId,
                generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                generatedBy: 'admin',
                summary: {
                    totalStudents: studentsSnap.size,
                    totalWeeks: weeksSnap.size,
                    totalMarks: totalCount,
                    overallAverage: totalCount > 0 ? (totalMarks / totalCount) : 0,
                    highestScore: totalCount > 0 ? Math.max(...Array.from(marksSnap.docs.map(d => d.data().marks))) : 0,
                    lowestScore: totalCount > 0 ? Math.min(...Array.from(marksSnap.docs.map(d => d.data().marks))) : 0
                },
                rankings: rankings.slice(0, 50),
                classRankings: classRankings,
                weekPerformance: weekPerformance,
                top10: rankings.slice(0, 10),
                bottom10: rankings.slice(-10).reverse()
            };
            
            const analyticsRef = db.collection(ANALYTICS_COLLECTION).doc(weekId === 'all' ? 'overall' : `week_${weekId}`);
            await analyticsRef.set(analyticsData);
            
            console.log('✅ Analytics stored in Firebase successfully!');
            
            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Analytics have been stored in Firebase',
                timer: 2000
            });
            
            return analyticsData;
            
        } catch (error) {
            console.error('Error storing analytics:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to store analytics: ' + error.message
            });
            return null;
        }
    }

    async function loadAnalyticsFromFirebase(weekId = 'all') {
        try {
            console.log('📥 Loading analytics from Firebase...');
            
            const analyticsRef = db.collection(ANALYTICS_COLLECTION).doc(weekId === 'all' ? 'overall' : `week_${weekId}`);
            const analyticsDoc = await analyticsRef.get();
            
            if (!analyticsDoc.exists) {
                console.log('No stored analytics found. Generate first.');
                return null;
            }
            
            const data = analyticsDoc.data();
            console.log('✅ Analytics loaded from Firebase');
            return data;
            
        } catch (error) {
            console.error('Error loading analytics:', error);
            return null;
        }
    }

    async function displayStoredAnalytics(weekId = 'all') {
        try {
            UIManager.showSection('complete-analytics-section');
            showLoadingStates();
            
            const analytics = await loadAnalyticsFromFirebase(weekId);
            
            if (!analytics) {
                Swal.fire({
                    icon: 'info',
                    title: 'No Analytics Found',
                    text: 'Would you like to generate analytics now?',
                    showCancelButton: true,
                    confirmButtonColor: '#800000',
                    confirmButtonText: 'Yes, generate'
                }).then((result) => {
                    if (result.isConfirmed) {
                        storeAnalyticsInFirebase(weekId).then(() => {
                            displayStoredAnalytics(weekId);
                        });
                    }
                });
                return;
            }
            
            document.getElementById('total-students').textContent = analytics.summary.totalStudents;
            document.getElementById('total-weeks').textContent = analytics.summary.totalWeeks;
            document.getElementById('total-marks').textContent = analytics.summary.totalMarks;
            document.getElementById('overall-average').textContent = analytics.summary.overallAverage.toFixed(1) + '%';
            
            let topHtml = '';
            analytics.top10.forEach((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                topHtml += `
                    <tr>
                        <td><strong>${medal || i+1}</strong></td>
                        <td>${s.name}</td>
                        <td>${s.class}</td>
                        <td><span class="badge bg-success">${s.average.toFixed(1)}%</span></td>
                        <td>${s.assessments}</td>
                    </tr>
                `;
            });
            document.getElementById('top10-body').innerHTML = topHtml;
            
            let bottomHtml = '';
            analytics.bottom10.forEach((s, i) => {
                bottomHtml += `
                    <tr>
                        <td><strong>${i+1}</strong></td>
                        <td>${s.name}</td>
                        <td>${s.class}</td>
                        <td><span class="badge bg-danger">${s.average.toFixed(1)}%</span></td>
                        <td>${s.assessments}</td>
                    </tr>
                `;
            });
            document.getElementById('bottom10-body').innerHTML = bottomHtml;
            
            let classHtml = '';
            analytics.classRankings.forEach((cls, index) => {
                const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
                classHtml += `
                    <tr>
                        <td><span class="badge-rank ${rankClass}">${index + 1}</span></td>
                        <td><strong>${cls.className}</strong></td>
                        <td>${cls.studentCount}</td>
                        <td>${cls.average.toFixed(1)}%</td>
                        <td>${cls.highest}%</td>
                        <td>${cls.lowest}%</td>
                        <td>
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar ${cls.passRate >= 50 ? 'bg-success' : 'bg-warning'}" 
                                     style="width: ${cls.passRate}%">${cls.passRate}%</div>
                            </div>
                        </td>
                        <td>${cls.topStudent}</td>
                    </tr>
                `;
            });
            document.getElementById('class-performance-body').innerHTML = classHtml;
            
            let meritHtml = '';
            analytics.rankings.forEach((s, i) => {
                meritHtml += `
                    <tr>
                        <td><strong>${i + 1}</strong></td>
                        <td>${s.admNo}</td>
                        <td>${s.name}</td>
                        <td>${s.class}</td>
                        <td><strong>${s.average.toFixed(1)}%</strong></td>
                        <td>${s.highest}%</td>
                        <td>${s.lowest}%</td>
                        <td>${s.assessments}</td>
                    </tr>
                `;
            });
            document.getElementById('merit-body').innerHTML = meritHtml;
            
            const generatedAt = analytics.generatedAt ? new Date(analytics.generatedAt.seconds * 1000).toLocaleString() : 'Unknown';
            const statusDiv = document.getElementById('analytics-status');
            if (statusDiv) {
                statusDiv.innerHTML = `
                    <div class="alert alert-info mt-3">
                        <i class="fas fa-info-circle me-2"></i>
                        Analytics generated on: ${generatedAt} | Week: ${analytics.weekId === 'all' ? 'All Weeks' : 'Specific Week'}
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Error displaying stored analytics:', error);
        }
    }

    async function teacherViewAnalytics() {
        try {
            const currentUser = Auth.getCurrentUser();
            if (!currentUser || currentUser.type !== 'teacher') return;
            
            UIManager.showSection('teacher-analytics-section');
            
            const analytics = await loadAnalyticsFromFirebase('all');
            
            if (!analytics) {
                document.getElementById('teacher-analytics-body').innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Analytics not yet generated. Please contact admin.
                    </div>
                `;
                return;
            }
            
            const teacherClass = currentUser.assignedClass;
            const classData = analytics.classRankings.find(c => c.className === teacherClass);
            const classStudents = analytics.rankings.filter(s => s.class === teacherClass);
            
            let html = `
                <div class="row mb-4">
                    <div class="col-md-4">
                        <div class="stat-card" style="background: linear-gradient(135deg, #2196F3, #1976D2);">
                            <i class="fas fa-chart-line"></i>
                            <h2>${classData ? classData.average.toFixed(1) + '%' : 'N/A'}</h2>
                            <p>Class Average</p>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="stat-card" style="background: linear-gradient(135deg, #4CAF50, #388E3C);">
                            <i class="fas fa-trophy"></i>
                            <h2>${classData ? classData.passRate + '%' : 'N/A'}</h2>
                            <p>Pass Rate</p>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="stat-card" style="background: linear-gradient(135deg, #FF9800, #F57C00);">
                            <i class="fas fa-users"></i>
                            <h2>${classStudents.length}</h2>
                            <p>Students with marks</p>
                        </div>
                    </div>
                </div>
                
                <h5 class="mb-3">🏆 Top Students in ${teacherClass}</h5>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="bg-light">
                            <tr>
                                <th>Rank</th>
                                <th>ADM No</th>
                                <th>Name</th>
                                <th>Average</th>
                                <th>Highest</th>
                                <th>Lowest</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            classStudents.sort((a, b) => b.average - a.average).slice(0, 10).forEach((s, i) => {
                html += `
                    <tr>
                        <td><strong>${i+1}</strong></td>
                        <td>${s.admNo}</td>
                        <td>${s.name}</td>
                        <td><span class="badge bg-success">${s.average.toFixed(1)}%</span></td>
                        <td>${s.highest}%</td>
                        <td>${s.lowest}%</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            
            document.getElementById('teacher-analytics-body').innerHTML = html;
            
        } catch (error) {
            console.error('Error in teacher view:', error);
        }
    }

    async function initAnalyticsControls() {
        try {
            const weeksSnap = await db.collection('weeks').orderBy('term').orderBy('weekNumber').get();
            let options = '<option value="all">All Weeks</option>';
            
            weeksSnap.forEach(doc => {
                const week = doc.data();
                options += `<option value="${doc.id}">Term ${week.term} Week ${week.weekNumber}</option>`;
            });
            
            const weekSelect = document.getElementById('analyticsWeekSelect');
            if (weekSelect) {
                weekSelect.innerHTML = options;
            }
            
            const section = document.getElementById('complete-analytics-section');
            if (section && !document.getElementById('analytics-status')) {
                const statusDiv = document.createElement('div');
                statusDiv.id = 'analytics-status';
                statusDiv.className = 'mt-3';
                section.querySelector('.section-card').appendChild(statusDiv);
            }
            
        } catch (error) {
            console.error('Error initializing analytics:', error);
        }
    }

    // ============= EXPOSED FUNCTIONS =============

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
    window.loadAnalytics = loadAnalytics;
    window.loadFastAnalytics = loadFastAnalytics;
    window.regenerateAnalytics = regenerateAnalytics;
    window.initAnalyticsWithWeeks = initAnalyticsWithWeeks;
    window.storeAnalyticsInFirebase = storeAnalyticsInFirebase;
    window.loadAnalyticsFromFirebase = loadAnalyticsFromFirebase;
    window.displayStoredAnalytics = displayStoredAnalytics;
    window.initAnalyticsControls = initAnalyticsControls;
    window.teacherViewAnalytics = teacherViewAnalytics;

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
        uploadBulkStudents,
        loadAnalytics,
        loadAnalyticsWeeks,
        loadOverallStats,
        loadClassRankings,
        loadTopStudents,
        loadClassStats,
        loadCharts,
        displayRankings,
        showRankingsInPage,
        loadFastAnalytics,
        regenerateAnalytics,
        initAnalyticsWithWeeks,
        storeAnalyticsInFirebase,
        loadAnalyticsFromFirebase,
        displayStoredAnalytics,
        initAnalyticsControls,
        teacherViewAnalytics
    };
})();

// Make AdminDashboard globally available
window.AdminDashboard = AdminDashboard;