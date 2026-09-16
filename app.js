// ==========================================
// ACOUSTIC BONE SCANNER
// GitHub Pages + Supabase
// ==========================================

// ---------- SUPABASE CONFIG ----------

const SUPABASE_URL = "https://ropiudyalwarmowaiugu.supabase.co";
const SUPABASE_KEY = "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";

const { createClient } = supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ---------- GLOBAL USER ----------

let currentUser = null;
let currentProfile = null;


// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    document.getElementById("adminPanel").style.display = "none";

    const {
        data: { session }
    } = await db.auth.getSession();

    if (session) {
        currentUser = session.user;
        await loadDashboard();
    } else {
        showLogin();
    }

});


// ==========================================
// LOGIN
// ==========================================
async function login() {

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const message =
        document.getElementById("loginMessage");

    message.textContent = "";

    if (!email || !password) {

        message.textContent =
            "Please enter email and password.";

        return;
    }

    const {
        data,
        error
    } = await db.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {

        console.error("Login error:", error);

        message.textContent =
            "Login failed: " + error.message;

        return;
    }

    currentUser = data.user;

    await loadDashboard();
}
// ==========================================
// REGISTRATION
// ==========================================

function showRegister() {

    document.getElementById("loginScreen").style.display = "none";

    document.getElementById("registerScreen").style.display = "flex";

    document.getElementById("registerMessage").textContent = "";
}


function showLogin() {

    document.getElementById("registerScreen").style.display = "none";

    document.getElementById("loginScreen").style.display = "flex";

    document.getElementById("loginMessage").textContent = "";
}


async function registerUser() {

    const name =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const message =
        document.getElementById("registerMessage");

    message.textContent = "";

    if (!name || !email || !password) {

        message.textContent =
            "Please fill all fields.";

        return;
    }

    if (password.length < 6) {

        message.textContent =
            "Password must contain at least 6 characters.";

        return;
    }

    const {
        data,
        error
    } = await db.auth.signUp({

        email: email,

        password: password,

        options: {

            data: {
                full_name: name
            }

        }

    });

    if (error) {

        console.error("Registration error:", error);

        message.textContent =
            "Registration failed: " + error.message;

        return;
    }

    /*
     * IMPORTANT:
     * New accounts are normal users.
     * Admin role is NOT selectable during registration.
     */

    message.textContent =
        "Account created successfully. You can now log in.";

    document.getElementById("registerName").value = "";
    document.getElementById("registerEmail").value = "";
    document.getElementById("registerPassword").value = "";

}
// ==========================================
// LOGOUT
// ==========================================

async function logout() {

    await db.auth.signOut();

    currentUser = null;
    currentProfile = null;

    showLogin();
}


// ==========================================
// SHOW LOGIN
// ==========================================

function showLogin() {

    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("dashboard").style.display = "none";

}


// ==========================================
// SHOW DASHBOARD
// ==========================================

async function loadDashboard() {

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    await loadProfile();
    await loadSubjects();
    await loadScans();
    await loadReferenceGroups();

    if (currentProfile && currentProfile.role === "admin") {

        document.getElementById("adminPanel").style.display = "block";

        await loadAllUsers();
        await loadAllSubjects();
        await loadAllScans();
        await loadAdminReferences();

    } else {

        document.getElementById("adminPanel").style.display = "none";

    }

}


// ==========================================
// LOAD PROFILE
// ==========================================

async function loadProfile() {

    const {
        data,
        error
    } = await db
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

    if (error) {

        console.error("Profile error:", error);

        document.getElementById("userInfo").textContent =
            currentUser.email;

        return;
    }

    currentProfile = data;

    document.getElementById("userInfo").textContent =
        `${data.full_name || currentUser.email} • ${data.role}`;

}


// ==========================================
// SUBJECTS — USER
// ==========================================

async function loadSubjects() {

    const table = document.getElementById("subjectsTable");
    const message = document.getElementById("subjectsMessage");

    table.innerHTML = "";
    message.textContent = "";

    const {
        data,
        error
    } = await db
        .from("subjects")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error("Subjects error:", error);

        message.textContent =
            "Error loading subjects: " + error.message;

        return;
    }

    document.getElementById("subjectCount").textContent =
        data.length;

    if (data.length === 0) {

        table.innerHTML =
            `<tr><td colspan="5">No subjects added yet.</td></tr>`;

        return;
    }

    data.forEach(subject => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(subject.subject_id)}</td>
            <td>${escapeHTML(subject.name || "")}</td>
            <td>${subject.age ?? ""}</td>
            <td>${escapeHTML(subject.gender || "")}</td>
            <td>${formatDate(subject.created_at)}</td>
        `;

        table.appendChild(row);

    });

}


// ==========================================
// ADD SUBJECT
// ==========================================

async function addSubject() {

    const subjectId =
        document.getElementById("subjectId").value.trim();

    const name =
        document.getElementById("subjectName").value.trim();

    const age =
        parseInt(document.getElementById("subjectAge").value);

    const gender =
        document.getElementById("subjectGender").value;

    const message =
        document.getElementById("subjectMessage");

    message.textContent = "";

    if (!subjectId || !name || !age || !gender) {

        message.textContent =
            "Please fill all fields.";

        return;
    }

    const {
        error
    } = await db
        .from("subjects")
        .insert({
            user_id: currentUser.id,
            subject_id: subjectId,
            name: name,
            age: age,
            gender: gender
        });

    if (error) {

        console.error(error);

        message.textContent =
            error.message;

        return;
    }

    message.textContent =
        "Subject added successfully.";

    document.getElementById("subjectId").value = "";
    document.getElementById("subjectName").value = "";
    document.getElementById("subjectAge").value = "";
    document.getElementById("subjectGender").value = "";

    await loadSubjects();

    setTimeout(() => {
        closeSubjectModal();
    }, 700);

}


// ==========================================
// SCANS — USER
// ==========================================

async function loadScans() {

    const table =
        document.getElementById("scansTable");

    table.innerHTML = "";

    const {
        data,
        error
    } = await db
        .from("scan_measurements")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error("Scan error:", error);

        table.innerHTML =
            `<tr><td colspan="8">
                Error loading scans: ${escapeHTML(error.message)}
             </td></tr>`;

        return;
    }

    document.getElementById("scanCount").textContent =
        data.length;

    if (data.length === 0) {

        table.innerHTML =
            `<tr><td colspan="8">No scans yet.</td></tr>`;

        return;
    }

    data.forEach(scan => {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(scan.scan_id || "")}</td>
            <td>${escapeHTML(scan.subject_id || "")}</td>
            <td>${scan.f0 ?? ""}</td>
            <td>${scan.rms ?? ""}</td>
            <td>${scan.q_factor ?? ""}</td>
            <td>${scan.bandwidth ?? ""}</td>
            <td>${escapeHTML(scan.comparison_status || "—")}</td>
            <td>${formatDate(scan.created_at)}</td>
        `;

        table.appendChild(row);

    });

}


// ==========================================
// REFERENCE GROUPS — USER
// ==========================================

async function loadReferenceGroups() {

    const table =
        document.getElementById("referenceTable");

    const message =
        document.getElementById("referenceMessage");

    table.innerHTML = "";
    message.textContent = "";

    const {
        data,
        error
    } = await db
        .from("reference_groups")
        .select("*")
        .order("age_min", {
            ascending: true
        });

    if (error) {

        console.error("Reference error:", error);

        message.textContent =
            "Error loading reference data: " +
            error.message;

        return;
    }

    document.getElementById("referenceCount").textContent =
        data.length;

    if (data.length === 0) {

        table.innerHTML =
            `<tr><td colspan="7">
                No reference groups available.
             </td></tr>`;

        return;
    }

    data.forEach(group => {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${group.age_min}–${group.age_max}</td>
            <td>${escapeHTML(group.gender || "All")}</td>
            <td>${group.sample_count ?? 0}</td>
            <td>${group.mean_f0 ?? "—"}</td>
            <td>${group.mean_rms ?? "—"}</td>
            <td>${group.mean_q_factor ?? "—"}</td>
            <td>${group.mean_bandwidth ?? "—"}</td>
        `;

        table.appendChild(row);

    });

}


// ==========================================
// ADMIN — USERS
// ==========================================

async function loadAllUsers() {

    const table =
        document.getElementById("usersTable");

    table.innerHTML = "";

    const {
        data,
        error
    } = await db
        .from("profiles")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error("Users error:", error);

        table.innerHTML =
            `<tr><td colspan="4">
                ${escapeHTML(error.message)}
             </td></tr>`;

        return;
    }

    data.forEach(user => {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(user.email || "")}</td>
            <td>${escapeHTML(user.full_name || "")}</td>
            <td>${escapeHTML(user.role || "")}</td>
            <td class="small-id">
                ${escapeHTML(user.id)}
            </td>
        `;

        table.appendChild(row);

    });

}


// ==========================================
// ADMIN — ALL SUBJECTS
// ==========================================

async function loadAllSubjects() {

    const table =
        document.getElementById("allSubjectsTable");

    table.innerHTML = "";

    const {
        data,
        error
    } = await db
        .from("subjects")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error("All subjects error:", error);

        table.innerHTML =
            `<tr><td colspan="5">
                ${escapeHTML(error.message)}
             </td></tr>`;

        return;
    }

    if (data.length === 0) {

        table.innerHTML =
            `<tr><td colspan="5">No subjects.</td></tr>`;

        return;
    }

    data.forEach(subject => {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(subject.subject_id)}</td>
            <td>${escapeHTML(subject.name || "")}</td>
            <td>${subject.age ?? ""}</td>
            <td>${escapeHTML(subject.gender || "")}</td>
            <td class="small-id">
                ${escapeHTML(subject.user_id)}
            </td>
        `;

        table.appendChild(row);

    });

}


// ==========================================
// ADMIN — ALL SCANS
// ==========================================

async function loadAllScans() {

    const table =
        document.getElementById("allScansTable");

    table.innerHTML = "";

    const {
        data,
        error
    } = await db
        .from("scan_measurements")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error("All scans error:", error);

        table.innerHTML =
            `<tr><td colspan="8">
                ${escapeHTML(error.message)}
             </td></tr>`;

        return;
    }

    if (data.length === 0) {

        table.innerHTML =
            `<tr><td colspan="8">No scans.</td></tr>`;

        return;
    }

    data.forEach(scan => {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(scan.scan_id || "")}</td>
            <td>${escapeHTML(scan.subject_id || "")}</td>
            <td>${scan.f0 ?? ""}</td>
            <td>${scan.rms ?? ""}</td>
            <td>${scan.q_factor ?? ""}</td>
            <td>${scan.bandwidth ?? ""}</td>
            <td>${escapeHTML(scan.comparison_status || "—")}</td>
            <td>${formatDate(scan.created_at)}</td>
        `;

        table.appendChild(row);

    });

}


// ==========================================
// ADMIN — REFERENCE MEASUREMENTS
// ==========================================

async function loadAdminReferences() {

    const table =
        document.getElementById("adminReferenceTable");

    table.innerHTML = "";

    const {
        data,
        error
    } = await db
        .from("reference_measurements")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error("Admin reference error:", error);

        table.innerHTML =
            `<tr><td colspan="9">
                ${escapeHTML(error.message)}
             </td></tr>`;

        return;
    }

    if (data.length === 0) {

        table.innerHTML =
            `<tr><td colspan="9">
                No reference measurements.
             </td></tr>`;

        return;
    }

    data.forEach(reference => {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${reference.reference_id ?? reference.id ?? ""}</td>
            <td>${reference.age ?? ""}</td>
            <td>${escapeHTML(reference.gender || "")}</td>
            <td>${escapeHTML(reference.measurement_side || "")}</td>
            <td>${reference.f0 ?? ""}</td>
            <td>${reference.rms ?? ""}</td>
            <td>${reference.q_factor ?? ""}</td>
            <td>${reference.bandwidth ?? ""}</td>

            <td>
                <button
                    class="danger-btn"
                    onclick="deleteReference(${reference.id})">
                    Delete
                </button>
            </td>
        `;

        table.appendChild(row);

    });

}


// ==========================================
// ADMIN — ADD REFERENCE
// ==========================================

async function addReference() {

    const age =
        parseInt(
            document.getElementById("referenceAge").value
        );

    const gender =
        document.getElementById("referenceGender").value;

    const side =
        document.getElementById("referenceSide").value;

    const f0 =
        parseFloat(
            document.getElementById("referenceF0").value
        );

    const rms =
        parseFloat(
            document.getElementById("referenceRMS").value
        );

    const q =
        parseFloat(
            document.getElementById("referenceQ").value
        );

    const bandwidth =
        parseFloat(
            document.getElementById("referenceBandwidth").value
        );

    const message =
        document.getElementById("referenceAddMessage");

    message.textContent = "";

    if (
        !age ||
        !gender ||
        !side ||
        Number.isNaN(f0) ||
        Number.isNaN(rms) ||
        Number.isNaN(q) ||
        Number.isNaN(bandwidth)
    ) {

        message.textContent =
            "Please fill all fields.";

        return;
    }

    const {
        error
    } = await db
        .from("reference_measurements")
        .insert({
            age: age,
            gender: gender,
            measurement_side: side,
            f0: f0,
            rms: rms,
            q_factor: q,
            bandwidth: bandwidth
        });

    if (error) {

        console.error(error);

        message.textContent =
            error.message;

        return;
    }

    message.textContent =
        "Reference measurement added.";

    document.getElementById("referenceAge").value = "";
    document.getElementById("referenceGender").value = "";
    document.getElementById("referenceSide").value = "";
    document.getElementById("referenceF0").value = "";
    document.getElementById("referenceRMS").value = "";
    document.getElementById("referenceQ").value = "";
    document.getElementById("referenceBandwidth").value = "";

    await loadAdminReferences();

    setTimeout(() => {
        closeReferenceModal();
    }, 700);

}


// ==========================================
// ADMIN — DELETE REFERENCE
// ==========================================

async function deleteReference(id) {

    if (!confirm("Delete this reference measurement?")) {
        return;
    }

    const {
        error
    } = await db
        .from("reference_measurements")
        .delete()
        .eq("id", id);

    if (error) {

        alert(error.message);

        return;
    }

    await loadAdminReferences();

}


// ==========================================
// SUBJECT MODAL
// ==========================================

function openSubjectModal() {

    document.getElementById("subjectModal")
        .style.display = "flex";

}

function closeSubjectModal() {

    document.getElementById("subjectModal")
        .style.display = "none";

}


// ==========================================
// REFERENCE MODAL
// ==========================================

function openReferenceModal() {

    document.getElementById("referenceModal")
        .style.display = "flex";

}

function closeReferenceModal() {

    document.getElementById("referenceModal")
        .style.display = "none";

}


// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatDate(date) {

    if (!date) {
        return "—";
    }

    return new Date(date).toLocaleString();
}


function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// AUTH STATE LISTENER
// ==========================================

db.auth.onAuthStateChange(
    async (event, session) => {

        if (session) {

            currentUser = session.user;

        } else {

            currentUser = null;
            currentProfile = null;

        }

    }
);
