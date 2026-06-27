// 1. Configuration
// الصق رابط تطبيق الويب (Google Apps Script Web App URL) هنا للربط مع Google Sheets.
// في حال بقائه فارغاً، سيعمل النظام تلقائياً على التخزين المحلي (LocalStorage) للتجربة والتدقيق.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVJnpdQkc_fAc77cv8_HIBBAnWDkxovYVTBbEXcqC-WbfQLsA3l19CtP10VJtuM_CqFQ/exec";

// 2. DOM Elements
const form = document.getElementById("registration-form");
const stageSelect = document.getElementById("stage");
const birthYearSelect = document.getElementById("birthYear");
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

// Admin Login Modal Elements
const adminLoginModal = document.getElementById("admin-login-modal");
const adminPasswordInput = document.getElementById("admin-password");
const toggleAdminPassword = document.getElementById("toggle-admin-password");
const adminLoginError = document.getElementById("admin-login-error");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminBtnText = document.getElementById("admin-btn-text");
const adminBtnSpinner = document.getElementById("admin-btn-spinner");

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
    
    // Fetch and sync data
    fetchData();
}

function setupEventListeners() {
    // Listen to hash change
    window.addEventListener("hashchange", checkHashRoute);
    
    // Handle form submit
    form.addEventListener("submit", handleFormSubmit);
    
    // Close success modal
    modalCloseBtn.addEventListener("click", () => {
        successModal.classList.add("hidden");
        form.reset();
        fetchData(); // Refresh counter
    });
    
    // Admin search filter
    adminSearch.addEventListener("input", filterTable);
    
    // Export button
    exportBtn.addEventListener("click", exportToCSV);

    // Admin Login handlers
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener("click", handleAdminLogin);
    }
    if (adminPasswordInput) {
        adminPasswordInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                handleAdminLogin();
            }
        });
    }
    if (toggleAdminPassword) {
        toggleAdminPassword.addEventListener("click", () => {
            const type = adminPasswordInput.getAttribute("type") === "password" ? "text" : "password";
            adminPasswordInput.setAttribute("type", type);
            toggleAdminPassword.classList.toggle("fa-eye");
            toggleAdminPassword.classList.toggle("fa-eye-slash");
        });
    }
}

// Check if URL has #admin to show/hide Admin Panel
function checkHashRoute() {
    if (window.location.hash === "#admin") {
        const storedPassword = sessionStorage.getItem("admin_password");
        if (storedPassword) {
            // If password already stored, fetch data using it
            adminLoginModal.classList.add("hidden");
            adminCard.classList.remove("hidden");
            adminCard.scrollIntoView({ behavior: "smooth" });
            fetchData(storedPassword);
        } else {
            // Otherwise show login modal, hide card contents
            adminCard.classList.add("hidden");
            adminLoginError.classList.add("hidden");
            adminPasswordInput.value = "";
            adminLoginModal.classList.remove("hidden");
        }
    } else {
        adminCard.classList.add("hidden");
        adminLoginModal.classList.add("hidden");
    }
}



// Fetch Registrations (Local storage or Google Sheets)
function fetchData(password = "") {
    if (SCRIPT_URL && SCRIPT_URL.startsWith("https://script.google.com")) {
        // Build URL depending on whether we need public count or full admin access
        let url = SCRIPT_URL;
        if (password) {
            url += `?password=${encodeURIComponent(password)}`;
        } else {
            // Public count request to update counter only
            url += "?action=count";
        }
        
        fetch(url)
            .then(res => res.json())
            .then(res => {
                if (res.status === "success") {
                    if (password) {
                        // Full data fetched successfully - Deduplicate by phone
                        var uniqueData = [];
                        var seenPhones = {};
                        res.data.forEach(function(item) {
                            var cleanPhone = item.phone.toString().replace(/[^0-9]/g, "");
                            if (!seenPhones[cleanPhone]) {
                                seenPhones[cleanPhone] = true;
                                uniqueData.push(item);
                            }
                        });
                        allRegistrations = uniqueData.filter(r => !r.name.includes("محمد رضا عبد الهادي"));
                        sessionStorage.setItem("admin_password", password);
                        adminLoginModal.classList.add("hidden");
                        adminCard.classList.remove("hidden");
                        adminCard.scrollIntoView({ behavior: "smooth" });
                        updateUI();
                    } else {
                        // Public count fetched successfully
                        updateCounterOnly(res.count);
                    }
                } else if (res.status === "error" && res.message && res.message.includes("غير مصرح")) {
                    // Password incorrect or unauthorized
                    sessionStorage.removeItem("admin_password");
                    adminLoginError.classList.remove("hidden");
                    adminCard.classList.add("hidden");
                    adminLoginModal.classList.remove("hidden");
                }
            })
            .catch(err => {
                console.error("Error fetching Google Sheets data:", err);
                if (!password) {
                    loadLocalData();
                }
            });
    } else {
        // Local mode
        loadLocalData();
    }
}

// Update only the seats progress bar (used for public requests)
function updateCounterOnly(count) {
    registeredCountSpan.innerText = count;
    const percentage = Math.min((count / 100) * 100, 100);
    counterBar.style.width = `${percentage}%`;
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
}

// Handle Admin password validation and submission
function handleAdminLogin() {
    const password = adminPasswordInput.value.trim();
    if (!password) {
        alert("يرجى إدخال كلمة المرور أولاً!");
        adminPasswordInput.focus();
        return;
    }
    
    setAdminLoading(true);
    adminLoginError.classList.add("hidden");
    
    if (SCRIPT_URL && SCRIPT_URL.startsWith("https://script.google.com")) {
        const url = `${SCRIPT_URL}?password=${encodeURIComponent(password)}`;
        fetch(url)
            .then(res => res.json())
            .then(res => {
                if (res.status === "success") {
                    var uniqueData = [];
                    var seenPhones = {};
                    res.data.forEach(function(item) {
                        var cleanPhone = item.phone.toString().replace(/[^0-9]/g, "");
                        if (!seenPhones[cleanPhone]) {
                            seenPhones[cleanPhone] = true;
                            uniqueData.push(item);
                        }
                    });
                    allRegistrations = uniqueData.filter(r => !r.name.includes("محمد رضا عبد الهادي"));
                    sessionStorage.setItem("admin_password", password);
                    adminLoginModal.classList.add("hidden");
                    adminCard.classList.remove("hidden");
                    adminCard.scrollIntoView({ behavior: "smooth" });
                    updateUI();
                } else {
                    sessionStorage.removeItem("admin_password");
                    adminLoginError.classList.remove("hidden");
                }
            })
            .catch(err => {
                console.error("Authentication check failed:", err);
                alert("فشل الاتصال بالخادم. يرجى التحقق من جودة الإنترنت.");
            })
            .finally(() => {
                setAdminLoading(false);
            });
    } else {
        // Local mode fallback
        setTimeout(() => {
            if (password === "IKU@2026n") {
                sessionStorage.setItem("admin_password", password);
                adminLoginModal.classList.add("hidden");
                adminCard.classList.remove("hidden");
                updateUI();
            } else {
                adminLoginError.classList.remove("hidden");
            }
            setAdminLoading(false);
        }, 800);
    }
}

function setAdminLoading(isLoading) {
    if (isLoading) {
        adminLoginBtn.disabled = true;
        adminBtnText.classList.add("hidden");
        adminBtnSpinner.classList.remove("hidden");
    } else {
        adminLoginBtn.disabled = false;
        adminBtnText.classList.remove("hidden");
        adminBtnSpinner.classList.add("hidden");
    }
}

function loadLocalData() {
    const stored = localStorage.getItem("procession_registrations");
    if (stored) {
        var parsed = JSON.parse(stored);
        var uniqueData = [];
        var seenPhones = {};
        parsed.forEach(function(item) {
            var cleanPhone = item.phone.toString().replace(/[^0-9]/g, "");
            if (!seenPhones[cleanPhone]) {
                seenPhones[cleanPhone] = true;
                uniqueData.push(item);
            }
        });
        allRegistrations = uniqueData.filter(r => !r.name.includes("محمد رضا عبد الهادي"));
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
    
    // 3. Render Analytics Charts
    renderAnalytics();
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById("fullName").value.trim();
    const gender = document.getElementById("gender").value;
    const role = "طالب";
    const department = document.getElementById("department").value;
    const stage = document.getElementById("stage").value;
    const birthYear = document.getElementById("birthYear").value;
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
        gender,
        role: "طالب",
        department,
        stage,
        birthYear,
        phone,
        notes: notes || "—"
    };
    
    if (SCRIPT_URL && SCRIPT_URL.startsWith("https://script.google.com")) {
        // Submit to Google Apps Script using simple request (CORS-enabled via text/plain)
        fetch(SCRIPT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) {
                throw new Error("HTTP error " + res.status);
            }
            return res.json();
        })
        .then(res => {
            if (res.status === "success") {
                showSuccessModal(payload, res.waitingList);
            } else if (res.status === "duplicate") {
                alert("عذراً، هذا الرقم مسجل مسبقاً في المنظومة!");
            } else {
                alert("فشل التسجيل: " + res.message);
            }
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
    // Check if phone number already exists locally
    var cleanNewPhone = payload.phone.toString().replace(/[^0-9]/g, "");
    var duplicate = allRegistrations.some(function(r) {
        return r.phone.toString().replace(/[^0-9]/g, "") === cleanNewPhone;
    });
    if (duplicate) {
        alert("عذراً، هذا الرقم مسجل مسبقاً في المنظومة!");
        return;
    }

    const isWaiting = allRegistrations.length >= 100;
    
    const newRecord = {
        id: allRegistrations.length + 1,
        timestamp: new Date().toISOString(),
        name: payload.name,
        gender: payload.gender,
        role: "طالب",
        department: payload.department,
        stage: payload.stage,
        birthYear: payload.birthYear,
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
        <p><strong>الجنس:</strong> ${data.gender}</p>
        <p><strong>القسم:</strong> ${data.department}</p>
        <p><strong>المرحلة:</strong> ${data.stage}</p>
        <p><strong>سنة الميلاد:</strong> ${data.birthYear}</p>
        <p><strong>رقم الهاتف:</strong> ${data.phone}</p>
    `;
    
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
    
    resultBox.innerHTML = resultHTML;
    successModal.classList.remove("hidden");
}

// Admin Panel Render Table & Stats
function renderAdminTable() {
    tableBody.innerHTML = "";
    
    // Stats calculation
    const total = allRegistrations.length;
    const activeStudentsCount = allRegistrations.filter(r => r.waitingList === "لا" || r.waitingList === false).length;
    const waitingCount = allRegistrations.filter(r => r.waitingList === "نعم" || r.waitingList === true).length;
    
    statTotal.innerText = total;
    statStudents.innerText = activeStudentsCount;
    statWaiting.innerText = waitingCount;
    
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
            <td>${r.department}</td>
            <td>${r.stage}</td>
            <td>${r.birthYear || "—"}</td>
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
    const headers = ["ت", "الاسم الكامل", "الصفة", "القسم العلمي", "المرحلة الدراسية", "سنة الميلاد", "رقم الهاتف", "ملاحظات", "قائمة الاحتياط", "تاريخ التسجيل"];
    
    // Build CSV content
    let csvRows = [];
    csvRows.push(headers.join(","));
    
    allRegistrations.forEach((r, idx) => {
        const row = [
            idx + 1,
            `"${r.name.replace(/"/g, '""')}"`,
            `"${r.gender || "ذكر"}"`,
            `"${r.role}"`,
            `"${r.department}"`,
            `"${r.stage}"`,
            `"${r.birthYear || "—"}"`,
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

// ==========================================================================
// قسم الإحصائيات التحليلية المطور
// ==========================================================================
function renderAnalytics() {
    const genderContainer = document.getElementById("gender-stats-container");
    const deptContainer = document.getElementById("dept-stats-container");
    const stageContainer = document.getElementById("stage-stats-container");
    const ageContainer = document.getElementById("age-stats-container");
    
    if (!genderContainer || !deptContainer || !stageContainer || !ageContainer) return;
    
    genderContainer.innerHTML = "";
    deptContainer.innerHTML = "";
    stageContainer.innerHTML = "";
    ageContainer.innerHTML = "";
    
    const total = allRegistrations.length;
    if (total === 0) {
        const noData = `<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin:10px 0;">لا توجد بيانات كافية للحساب</p>`;
        deptContainer.innerHTML = noData;
        stageContainer.innerHTML = noData;
        ageContainer.innerHTML = noData;
        return;
    }
    
    // 0. حساب وتوزيع الجنس
    const genders = {};
    allRegistrations.forEach(r => {
        const g = r.gender || "ذكر";
        genders[g] = (genders[g] || 0) + 1;
    });
    renderBarChart(genderContainer, genders, total);

    // 1. حساب وتوزيع الأقسام العلمية
    const depts = {};
    allRegistrations.forEach(r => {
        const d = r.department || "غير محدد";
        depts[d] = (depts[d] || 0) + 1;
    });
    renderBarChart(deptContainer, depts, total);
    
    // 2. حساب وتوزيع المراحل الدراسية
    const stages = {};
    allRegistrations.forEach(r => {
        const s = r.stage || "غير محدد";
        stages[s] = (stages[s] || 0) + 1;
    });
    renderBarChart(stageContainer, stages, total);
    
    // 3. حساب وتوزيع الأعمار وسنوات الميلاد
    const ages = {};
    allRegistrations.forEach(r => {
        const y = r.birthYear || "غير محدد";
        ages[y] = (ages[y] || 0) + 1;
    });
    renderBarChart(ageContainer, ages, total);
}

function renderBarChart(container, dataObj, total) {
    // ترتيب العناصر تنازلياً حسب القيمة
    const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    
    sorted.forEach(([key, val]) => {
        const pct = ((val / total) * 100).toFixed(1);
        const barHtml = `
            <div class="stat-bar-group">
                <div class="stat-bar-info">
                    <span class="stat-bar-label">${key}</span>
                    <span class="stat-bar-val">${val} طالب (${pct}%)</span>
                </div>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", barHtml);
    });
}
