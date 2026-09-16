// ============================================================
// ACOUSTIC BONE SCANNER
// GitHub Pages + Supabase
// ============================================================

// ---------------- SUPABASE CONFIG ----------------

const SUPABASE_URL = "https://ropiudyalwarmowaiugu.supabase.co";
const SUPABASE_KEY = "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const SITE_URL =
    "https://jessemj117-lgtm.github.io/acoustic-bone-scanner/";


// ============================================================
// PAGE CONTROL
// ============================================================

function showLogin() {

    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("registerScreen").style.display = "none";
    document.getElementById("dashboard").style.display = "none";

}

function showRegister() {

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("registerScreen").style.display = "flex";
    document.getElementById("dashboard").style.display = "none";

}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    const message =
        document.getElementById("loginMessage");

    if (!email || !password) {

        message.textContent =
            "Please enter email and password.";

        return;
    }

    message.textContent = "Signing in...";

    try {

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            throw error;
        }

        message.textContent = "";

        await loadDashboard();

    } catch (error) {

        console.error("Login error:", error);

        message.textContent =
            error.message || "Login failed.";

    }

}


// ============================================================
// REGISTER
// ============================================================

async function registerUser() {

    const fullName =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const message =
        document.getElementById("registerMessage");

    if (!fullName || !email || !password) {

        message.textContent =
            "Please fill in all fields.";

        return;
    }

    if (password.length < 6) {

        message.textContent =
            "Password must contain at least 6 characters.";

        return;
    }

    message.textContent =
        "Creating account...";

    try {

        const { data, error } =
            await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {

                    data: {
                        full_name: fullName
                    },

                    emailRedirectTo: SITE_URL

                }

            });

        if (error) {
            throw error;
        }

        console.log("Registration successful:", data);

        message.textContent =
            "Account created. Please check your email and confirm your account.";

    } catch (error) {

        console.error("Registration error:", error);

        message.textContent =
            error.message || "Registration failed.";

    }

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    await supabaseClient.auth.signOut();

    showLogin();

}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {

        showLogin();

        return;
    }

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("registerScreen").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    await loadProfile();
    await loadSubjects();
    await loadScans();
    await loadReferenceGroups();
    await loadAdminPanel();

}


// ============================================================
// LOAD USER PROFILE
// ============================================================

async function loadProfile() {

    try {

        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        if (!user) return;

        const { data, error } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

        if (error) {
            throw error;
        }

        const name =
            data.full_name ||
            user.email;

        const userInfo =
            document.getElementById("userInfo");

        if (userInfo) {

            userInfo.textContent =
                `${name} (${data.role})`;

        }

        window.currentUser = user;
        window.currentProfile = data;

    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

    }

}


// ============================================================
// LOAD SUBJECTS
// ============================================================

async function loadSubjects() {

    const container =
        document.getElementById("subjectsList");

    if (!container) return;

    try {

        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        if (!user) return;

        const { data, error } =
            await supabaseClient
                .from("subjects")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", {
                    ascending: false
                });

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No subjects added yet.</p>";

            return;
        }

        container.innerHTML =
            data.map(subject => `

                <div class="data-card">

                    <strong>
                        ${escapeHTML(subject.subject_id)}
                    </strong>

                    <p>
                        Name:
                        ${escapeHTML(subject.name || "-")}
                    </p>

                    <p>
                        Age:
                        ${subject.age ?? "-"}
                    </p>

                    <p>
                        Gender:
                        ${escapeHTML(subject.gender || "-")}
                    </p>

                </div>

            `).join("");

    } catch (error) {

        console.error(
            "Subjects loading error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                Error loading subjects: ${escapeHTML(error.message)}
            </p>`;

    }

}


// ============================================================
// ADD SUBJECT
// ============================================================

async function addSubject() {

    const subjectId =
        document.getElementById("subjectId").value.trim();

    const name =
        document.getElementById("subjectName").value.trim();

    const age =
        parseInt(
            document.getElementById("subjectAge").value
        );

    const gender =
        document.getElementById("subjectGender").value;

    const message =
        document.getElementById("subjectMessage");

    if (!subjectId || !name || !age || !gender) {

        message.textContent =
            "Please fill in all fields.";

        return;
    }

    try {

        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        if (!user) {

            message.textContent =
                "Please log in first.";

            return;
        }

        const { error } =
            await supabaseClient
                .from("subjects")
                .insert({

                    user_id: user.id,
                    subject_id: subjectId,
                    name: name,
                    age: age,
                    gender: gender

                });

        if (error) {
            throw error;
        }

        message.textContent =
            "Subject added successfully.";

        document.getElementById("subjectId").value = "";
        document.getElementById("subjectName").value = "";
        document.getElementById("subjectAge").value = "";
        document.getElementById("subjectGender").value = "";

        await loadSubjects();

    } catch (error) {

        console.error(
            "Add subject error:",
            error
        );

        message.textContent =
            error.message || "Could not add subject.";

    }

}


// ============================================================
// LOAD SCANS
// ============================================================

async function loadScans() {

    const container =
        document.getElementById("scansList");

    if (!container) return;

    try {

        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        if (!user) return;

        const { data, error } =
            await supabaseClient
                .from("scan_measurements")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", {
                    ascending: false
                });

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No scans available.</p>";

            return;
        }

        container.innerHTML = `

            <table>

                <thead>

                    <tr>
                        <th>Scan ID</th>
                        <th>Subject</th>
                        <th>f0</th>
                        <th>RMS</th>
                        <th>Q</th>
                        <th>Bandwidth</th>
                        <th>Date</th>
                    </tr>

                </thead>

                <tbody>

                    ${data.map(scan => `

                        <tr>

                            <td>
                                ${escapeHTML(scan.scan_id || "-")}
                            </td>

                            <td>
                                ${escapeHTML(scan.subject_id || "-")}
                            </td>

                            <td>
                                ${scan.f0 ?? "-"}
                            </td>

                            <td>
                                ${scan.rms ?? "-"}
                            </td>

                            <td>
                                ${scan.q_factor ?? "-"}
                            </td>

                            <td>
                                ${scan.bandwidth ?? "-"}
                            </td>

                            <td>
                                ${formatDate(scan.created_at)}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        `;

    } catch (error) {

        console.error(
            "Scans loading error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                Error loading scans: ${escapeHTML(error.message)}
            </p>`;

    }

}


// ============================================================
// LOAD REFERENCE GROUPS
// ============================================================

async function loadReferenceGroups() {

    const container =
        document.getElementById("referenceList");

    if (!container) return;

    try {

        const { data, error } =
            await supabaseClient
                .from("reference_groups")
                .select("*")
                .order("age_min", {
                    ascending: true
                });

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No reference groups available.</p>";

            return;
        }

        container.innerHTML = `

            <table>

                <thead>

                    <tr>

                        <th>Age Range</th>
                        <th>Gender</th>
                        <th>Samples</th>
                        <th>Mean f0</th>
                        <th>SD f0</th>
                        <th>Mean RMS</th>
                        <th>Mean Q</th>

                    </tr>

                </thead>

                <tbody>

                    ${data.map(group => `

                        <tr>

                            <td>
                                ${group.age_min}
                                -
                                ${group.age_max}
                            </td>

                            <td>
                                ${escapeHTML(group.gender || "All")}
                            </td>

                            <td>
                                ${group.sample_count ?? 0}
                            </td>

                            <td>
                                ${group.mean_f0 ?? "-"}
                            </td>

                            <td>
                                ${group.sd_f0 ?? "-"}
                            </td>

                            <td>
                                ${group.mean_rms ?? "-"}
                            </td>

                            <td>
                                ${group.mean_q_factor ?? "-"}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        `;

    } catch (error) {

        console.error(
            "Reference loading error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                Error loading reference data:
                ${escapeHTML(error.message)}
            </p>`;

    }

}


// ============================================================
// ADMIN PANEL
// ============================================================

async function loadAdminPanel() {

    const panel =
        document.getElementById("adminPanel");

    if (!panel) return;

    if (
        !window.currentProfile ||
        window.currentProfile.role !== "admin"
    ) {

        panel.style.display = "none";

        return;
    }

    panel.style.display = "block";

    await loadAllUsers();
    await loadAllSubjects();
    await loadAllScans();
    await loadReferenceMeasurements();

}


// ============================================================
// ADMIN - USERS
// ============================================================

async function loadAllUsers() {

    const container =
        document.getElementById("adminUsers");

    if (!container) return;

    try {

        const { data, error } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

        if (error) {
            throw error;
        }

        container.innerHTML = `

            <table>

                <thead>

                    <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Role</th>
                    </tr>

                </thead>

                <tbody>

                    ${data.map(user => `

                        <tr>

                            <td>
                                ${escapeHTML(user.email || "-")}
                            </td>

                            <td>
                                ${escapeHTML(user.full_name || "-")}
                            </td>

                            <td>
                                ${escapeHTML(user.role || "-")}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        `;

    } catch (error) {

        console.error(
            "Admin users error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                ${escapeHTML(error.message)}
            </p>`;

    }

}


// ============================================================
// ADMIN - SUBJECTS
// ============================================================

async function loadAllSubjects() {

    const container =
        document.getElementById("adminSubjects");

    if (!container) return;

    try {

        const { data, error } =
            await supabaseClient
                .from("subjects")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

        if (error) {
            throw error;
        }

        container.innerHTML = `

            <table>

                <thead>

                    <tr>
                        <th>Subject ID</th>
                        <th>Name</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>User ID</th>
                    </tr>

                </thead>

                <tbody>

                    ${data.map(subject => `

                        <tr>

                            <td>
                                ${escapeHTML(subject.subject_id)}
                            </td>

                            <td>
                                ${escapeHTML(subject.name || "-")}
                            </td>

                            <td>
                                ${subject.age ?? "-"}
                            </td>

                            <td>
                                ${escapeHTML(subject.gender || "-")}
                            </td>

                            <td>
                                ${escapeHTML(subject.user_id)}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        `;

    } catch (error) {

        console.error(
            "Admin subjects error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                ${escapeHTML(error.message)}
            </p>`;

    }

}


// ============================================================
// ADMIN - SCANS
// ============================================================

async function loadAllScans() {

    const container =
        document.getElementById("adminScans");

    if (!container) return;

    try {

        const { data, error } =
            await supabaseClient
                .from("scan_measurements")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

        if (error) {
            throw error;
        }

        container.innerHTML = `

            <table>

                <thead>

                    <tr>
                        <th>Scan ID</th>
                        <th>User ID</th>
                        <th>Subject</th>
                        <th>f0</th>
                        <th>RMS</th>
                        <th>Q</th>
                    </tr>

                </thead>

                <tbody>

                    ${data.map(scan => `

                        <tr>

                            <td>
                                ${escapeHTML(scan.scan_id || "-")}
                            </td>

                            <td>
                                ${escapeHTML(scan.user_id || "-")}
                            </td>

                            <td>
                                ${escapeHTML(scan.subject_id || "-")}
                            </td>

                            <td>
                                ${scan.f0 ?? "-"}
                            </td>

                            <td>
                                ${scan.rms ?? "-"}
                            </td>

                            <td>
                                ${scan.q_factor ?? "-"}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        `;

    } catch (error) {

        console.error(
            "Admin scans error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                ${escapeHTML(error.message)}
            </p>`;

    }

}


// ============================================================
// ADMIN - REFERENCE MEASUREMENTS
// ============================================================

async function loadReferenceMeasurements() {

    const container =
        document.getElementById("adminReferences");

    if (!container) return;

    try {

        const { data, error } =
            await supabaseClient
                .from("reference_measurements")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

        if (error) {
            throw error;
        }

        container.innerHTML = `

            <table>

                <thead>

                    <tr>

                        <th>Reference ID</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>f0</th>
                        <th>RMS</th>
                        <th>Q</th>
                        <th>Bandwidth</th>

                    </tr>

                </thead>

                <tbody>

                    ${data.map(ref => `

                        <tr>

                            <td>
                                ${escapeHTML(ref.reference_id || "-")}
                            </td>

                            <td>
                                ${ref.age ?? "-"}
                            </td>

                            <td>
                                ${escapeHTML(ref.gender || "-")}
                            </td>

                            <td>
                                ${ref.f0 ?? "-"}
                            </td>

                            <td>
                                ${ref.rms ?? "-"}
                            </td>

                            <td>
                                ${ref.q_factor ?? "-"}
                            </td>

                            <td>
                                ${ref.bandwidth ?? "-"}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        `;

    } catch (error) {

        console.error(
            "Admin reference error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                ${escapeHTML(error.message)}
            </p>`;

    }

}


// ============================================================
// ADD REFERENCE MEASUREMENT
// ============================================================

async function addReference() {

    if (
        !window.currentProfile ||
        window.currentProfile.role !== "admin"
    ) {

        alert(
            "Only administrators can add reference data."
        );

        return;
    }

    const referenceId =
        document.getElementById("referenceId").value.trim();

    const age =
        parseInt(
            document.getElementById("referenceAge").value
        );

    const gender =
        document.getElementById("referenceGender").value;

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
        document.getElementById("referenceMessage");

    try {

        const { error } =
            await supabaseClient
                .from("reference_measurements")
                .insert({

                    reference_id: referenceId,
                    age: age,
                    gender: gender,
                    f0: f0,
                    rms: rms,
                    q_factor: q,
                    bandwidth: bandwidth

                });

        if (error) {
            throw error;
        }

        message.textContent =
            "Reference measurement added.";

        await loadReferenceMeasurements();
        await loadReferenceGroups();

    } catch (error) {

        console.error(
            "Add reference error:",
            error
        );

        message.textContent =
            error.message || "Could not add reference.";

    }

}


// ============================================================
// UTILITIES
// ============================================================

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


function formatDate(date) {

    if (!date) return "-";

    return new Date(date).toLocaleString();

}


// ============================================================
// INITIAL SESSION CHECK
// ============================================================

async function checkSession() {

    try {

        const {
            data: { session }
        } = await supabaseClient.auth.getSession();

        if (session) {

            await loadDashboard();

        } else {

            showLogin();

        }

    } catch (error) {

        console.error(
            "Session error:",
            error
        );

        showLogin();

    }

}


// ============================================================
// SUPABASE AUTH STATE
// ============================================================

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        console.log(
            "Auth event:",
            event
        );

        if (
            event === "SIGNED_IN" &&
            session
        ) {

            await loadDashboard();

        }

        if (
            event === "SIGNED_OUT"
        ) {

            showLogin();

        }

    }
);


// ============================================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ============================================================

window.showLogin = showLogin;
window.showRegister = showRegister;
window.login = login;
window.registerUser = registerUser;
window.logout = logout;
window.addSubject = addSubject;
window.addReference = addReference;


// ============================================================
// START APPLICATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkSession();

    }
);
