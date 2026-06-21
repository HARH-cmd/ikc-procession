// 1. Configuration
// الصق رابط تطبيق الويب (Google Apps Script Web App URL) هنا للربط مع Google Sheets.
// في حال بقائه فارغاً، سيعمل النظام تلقائياً على التخزين المحلي (LocalStorage) للتجربة والتدقيق.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyH0ucAQxrEbfVbdoBCxHMo53N-QBvm9xojx5vxu_ZOAEYQu63hgCAs6T41r-_JVcrh2w/exec";

// 2. DOM Elements
const form = document.getElementById("registration-form");
const roleRadios = document.getElementsByName("role");
const stageGroup = document.getElementById("stage-group");
const stageSelect = document.getElementById("stage");
const phoneInput = document.getElementById("phone");
const submitBtn = document.getElementById("submit-btn");
const btnText = document.getElementById("btn-text");
const btnSpinner = document.getElementById("btn-spinner");

// Seats Counter Elements
const registeredCountSpan = document.getElementById("registered-students-count");
const counterBar = document.getElementById("counter-bar");
const counterStatus = document.getElementById("counter-status");

// Success Modal Elements
const successModal = document.getElementById("success-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const resultBox = document.getElementById("registration-result-box");

// Admin Dashboard Elements
const adminCard = document.getElementById("admin-card");
const tableBody = document.getElementById("table-body");
const adminSearch = document.getElementById("admin-search");
const exportBtn = document.getElementById("export-btn");
const statTotal = document.getElementById("stat-total");
const statStudents = document.getElementById("stat-students");
const statWaiting = document.getElementById("stat-waiting");
const statStaff = document.getElementById("stat-staff");

// Local cache for registrations
let allRegistrations = [];

// 3. Init on Load
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Check url hash for admin mode
    checkHashRoute();
    
    // Toggle Academic Stage visibility based on default selected role (Student)
    toggleStageVisibility();
    
    // Fetch and sync data
    fetchData();
}

function setupEventListeners() {
    // Listen to hash change
    window.addEventListener("hashchange", checkHashRoute);
    
    // Listen to role changes to hide/show academic stage
    roleRadios.forEach(radio => {
        radio.addEventListener("change", toggleStageVisibility);
    });
    
    // Handle form submit
    form.addEventListener("submit", handleFormSubmit);
    
    // Close success modal
    modalCloseBtn.addEventListener("click", () => {
        successModal.classList.add("hidden");
        form.reset();
        toggleStageVisibility();
        fetchData(); // Refresh counter
    });
    
    // Admin search filter
    adminSearch.addEventListener("input", filterTable);
    
    // Export button
    exportBtn.addEventListener("click", exportToCSV);
}

// Check if URL has #admin to show/hide Admin Panel
function checkHashRoute() {
    if (window.location.hash === "#admin") {
        adminCard.classList.remove("hidden");
        // Scroll to admin dashboard
        adminCard.scrollIntoView({ behavior: "smooth" });
        fetchData(); // Load admin data
    } else {
        adminCard.classList.add("hidden");
    }
}

// Toggle visibility of the Academic Stage select group
function toggleStageVisibility() {
    const selectedRole = document.querySelector('input[name="role"]:checked').value;
    if (selectedRole === "طالب") {
        stageGroup.classList.remove("collapsed");
        stageSelect.setAttribute("required", "required");
    } else {
        stageGroup.classList.add("collapsed");
        stageSelect.removeAttribute("required");
        stageSelect.value = ""; // Reset
    }
}

// Fetch Registrations (Local storage or Google Sheets)
function fetchData() {
    if (SCRIPT_URL && SCRIPT_URL.startsWith("https://script.google.com")) {
        // Fetch from Google Apps Script Web App
        fetch(SCRIPT_URL)
            .then(res => res.json())
            .then(res => {
                if (res.status === "success") {
                    allRegistrations = res.data;
                    updateUI();
                }
            })
            .catch(err => {
                console.error("Error fetching Google Sheets data:", err);
                loadLocalData();
            });
    } else {
        // Local mode
        loadLocalData();
    }
}

function loadLocalData() {
    const stored = localStorage.getItem("procession_registrations");
    if (stored) {
        allRegistrations = JSON.parse(stored);
    } else {
        allRegistrations = [];
    }
    updateUI();
}

// Update Seats Counter & Admin table
function updateUI() {
    // 1. Calculate active student count (where waitingList === "لا" and role === "طالب")
    const students = allRegistrations.filter(r => r.role === "طالب");
    const activeStudents = students.filter(r => r.waitingList === "لا" || r.waitingList === false);
    const count = activeStudents.length;
    
    // Update Seats Counter
    registeredCountSpan.innerText = count;
    
    // Animate progress bar width
    const percentage = Math.min((count / 100) * 100, 100);
    counterBar.style.width = `${percentage}%`;
    
    // Counter styling and message
    counterBar.className = "counter-bar";
    if (count >= 100) {
        counterBar.classList.add("danger");
        counterStatus.innerText = "اكتمل المقاعد الأساسية للطلبة! التسجيل الحالي سيكون ضمن (قائمة الاحتياط).";
        counterStatus.className = "counter-status waiting";
    } else if (count >= 80) {
        counterBar.classList.add("warning");
        counterStatus.innerText = "المقاعد أوشكت على النفاد! سارع بالتسجيل.";
        counterStatus.className = "counter-status";
    } else {
        counterStatus.innerText = "المقاعد الأساسية متوفرة حالياً، سيتم تأكيد المقعد عند إتمام الإرسال.";
        counterStatus.className = "counter-status";
    }
    
    // 2. Render Admin table and stats
    renderAdminTable();
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById("fullName").value.trim();
    const role = document.querySelector('input[name="role"]:checked').value;
    const department = document.getElementById("department").value;
    const stage = document.getElementById("stage").value;
    const phone = phoneInput.value.trim();
    const notes = document.getElementById("notes").value.trim();
    
    // Iraqi phone pattern verification (Starts with 077, 078, 075 and has 11 digits)
    const phonePattern = /^(077|078|075)[0-9]{8}$/;
    if (!phonePattern.test(phone)) {
        alert("يرجى إدخال رقم هاتف عراقي صحيح يتكون من 11 رقماً ويبدأ بـ (077 أو 078 أو 075)");
        phoneInput.focus();
        return;
    }
    
    // Set loading state
    setLoading(true);
    
    const payload = {
        name,
        role,
        department,
        stage: role === "طالب" ? stage : "—",
        phone,
        notes: notes || "—"
    };
    
    if (SCRIPT_URL && SCRIPT_URL.startsWith("https://script.google.com")) {
        // Submit to Google Apps Script
        fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", // Required for Apps Script Web App redirect
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
        .then(() => {
            // Because of no-cors, we can't read the response JSON directly, 
            // so we calculate the waiting list status locally for the UI feedback
            const students = allRegistrations.filter(r => r.role === "طالب" && (r.waitingList === "لا" || r.waitingList === false));
            const isWaiting = role === "طالب" && students.length >= 100;
            showSuccessModal(payload, isWaiting);
        })
        .catch(err => {
            console.error("Error submitting to Google Sheets:", err);
            alert("حدث خطأ أثناء الإرسال إلى خادم Google. جاري الحفظ محلياً...");
            saveLocally(payload);
        })
        .finally(() => {
            setLoading(false);
        });
    } else {
        // Local mode fallback
        setTimeout(() => {
            saveLocally(payload);
            setLoading(false);
        }, 1000);
    }
}

function saveLocally(payload) {
    const students = allRegistrations.filter(r => r.role === "طالب" && (r.waitingList === "لا" || r.waitingList === false));
    const isWaiting = payload.role === "طالب" && students.length >= 100;
    
    const newRecord = {
        id: allRegistrations.length + 1,
        timestamp: new Date().toISOString(),
        name: payload.name,
        role: payload.role,
        department: payload.department,
        stage: payload.stage,
        phone: payload.phone,
        notes: payload.notes,
        waitingList: isWaiting ? "نعم" : "لا"
    };
    
    allRegistrations.push(newRecord);
    localStorage.setItem("procession_registrations", JSON.stringify(allRegistrations));
    showSuccessModal(payload, isWaiting);
}

function setLoading(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        btnText.classList.add("hidden");
        btnSpinner.classList.remove("hidden");
    } else {
        submitBtn.disabled = false;
        btnText.classList.remove("hidden");
        btnSpinner.classList.add("hidden");
    }
}

// Show custom success popup modal
function showSuccessModal(data, isWaiting) {
    let resultHTML = `
        <p><strong>الاسم:</strong> ${data.name}</p>
        <p><strong>الصفة:</strong> ${data.role}</p>
        <p><strong>القسم:</strong> ${data.department}</p>
        ${data.role === "طالب" ? `<p><strong>المرحلة:</strong> ${data.stage}</p>` : ""}
        <p><strong>رقم الهاتف:</strong> ${data.phone}</p>
    `;
    
    if (data.role === "طالب") {
        if (isWaiting) {
            resultHTML += `
                <div class="result-badge wait">قائمة الاحتياط</div>
                <p style="color: #ff8080; font-size:0.85rem; margin-top: 5px;">تم تسجيلك ضمن قائمة الاحتياط لتجاوز العدد المتاح (100 طالب). سنخطرك في حال شواغر جديدة.</p>
            `;
        } else {
            resultHTML += `
                <div class="result-badge main">القائمة الأساسية (مؤكد)</div>
                <p style="color: #80ffaa; font-size:0.85rem; margin-top: 5px;">مقعدك مؤكد ضمن الـ 100 طالب المشاركين رسمياً في الموكب.</p>
            `;
        }
    } else {
        resultHTML += `
            <div class="result-badge main">الأساتذة</div>
            <p style="color: #80ffaa; font-size:0.85rem; margin-top: 5px;">تم تسجيلك بنجاح للمشاركة في التنسيق والموكب الرسمي.</p>
        `;
    }
    
    resultBox.innerHTML = resultHTML;
    successModal.classList.remove("hidden");
}

// Admin Panel Render Table & Stats
function renderAdminTable() {
    tableBody.innerHTML = "";
    
    // Stats calculation
    const total = allRegistrations.length;
    const studentsOnly = allRegistrations.filter(r => r.role === "طالب");
    const activeStudentsCount = studentsOnly.filter(r => r.waitingList === "لا" || r.waitingList === false).length;
    const waitingCount = studentsOnly.filter(r => r.waitingList === "نعم" || r.waitingList === true).length;
    const staffCount = allRegistrations.filter(r => r.role !== "طالب").length;
    
    statTotal.innerText = total;
    statStudents.innerText = activeStudentsCount;
    statWaiting.innerText = waitingCount;
    statStaff.innerText = staffCount;
    
    // Sort registrations: latest first
    const sorted = [...allRegistrations].reverse();
    
    if (sorted.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">لا توجد أي طلبات مسجلة حالياً.</td></tr>`;
        return;
    }
    
    sorted.forEach((r, idx) => {
        const tr = document.createElement("tr");
        const formattedDate = new Date(r.timestamp).toLocaleString("ar-IQ", { hour12: true });
        const waitingText = r.waitingList === "نعم" || r.waitingList === true ? "نعم" : "لا";
        const tagClass = r.waitingList === "نعم" || r.waitingList === true ? "yes" : "no";
        
        tr.innerHTML = `
            <td>${sorted.length - idx}</td>
            <td><strong>${r.name}</strong></td>
            <td>${r.role}</td>
            <td>${r.department}</td>
            <td>${r.stage}</td>
            <td>${r.phone}</td>
            <td><span class="waiting-tag ${tagClass}">${waitingText}</span></td>
            <td style="font-size:0.75rem; color:var(--text-muted);">${formattedDate}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// Admin Table search filtering
function filterTable() {
    const query = adminSearch.value.toLowerCase().trim();
    const rows = tableBody.getElementsByTagName("tr");
    
    for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent.toLowerCase();
        if (text.includes(query)) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
}

// Export data to CSV (Compatible with Excel Arabic encoding)
function exportToCSV() {
    if (allRegistrations.length === 0) {
        alert("لا توجد بيانات لتصديرها!");
        return;
    }
    
    // Prepare header row
    const headers = ["ت", "الاسم الكامل", "الصفة", "القسم العلمي", "المرحلة الدراسية", "رقم الهاتف", "ملاحظات", "قائمة الاحتياط", "تاريخ التسجيل"];
    
    // Build CSV content
    let csvRows = [];
    csvRows.push(headers.join(","));
    
    allRegistrations.forEach((r, idx) => {
        const row = [
            idx + 1,
            `"${r.name.replace(/"/g, '""')}"`,
            `"${r.role}"`,
            `"${r.department}"`,
            `"${r.stage}"`,
            `"'${r.phone}"`, // Prepend single quote for Excel formatting
            `"${(r.notes || "—").replace(/"/g, '""')}"`,
            `"${r.waitingList === "نعم" || r.waitingList === true ? "نعم" : "لا"}"`,
            `"${new Date(r.timestamp).toLocaleString()}"`
        ];
        csvRows.push(row.join(","));
    });
    
    const csvContent = csvRows.join("\n");
    
    // Add UTF-8 Byte Order Mark (BOM) to force Excel to read Arabic correctly
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `مسجلي_موكب_كلية_الامام_الكاظم_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
