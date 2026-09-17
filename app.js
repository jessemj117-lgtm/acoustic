// ============================================================
// ACOUSTIC BONE SCANNER
// GitHub Pages + Supabase
//
// ACCESS STRUCTURE
// ------------------------------------------------------------
// ADMIN     -> Login -> Full system access
// OPERATOR  -> Login -> Patients + Scans + Reference viewing
// PATIENT   -> No login -> 6-digit linking code -> Own results
// ============================================================


// ============================================================
// SUPABASE CONFIG
// ============================================================

const SUPABASE_URL =
    "https://ropiudyalwarmowaiugu.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

const SITE_URL =
    "https://jessemj117-lgtm.github.io/acoustic-bone-scanner/";


// ============================================================
// GLOBAL STATE
// ============================================================

window.currentUser = null;
window.currentProfile = null;
window.currentPatient = null;


// ============================================================
// PAGE CONTROL
// ============================================================

function showLogin() {

    const login =
        document.getElementById("loginScreen");

    const dashboard =
        document.getElementById("dashboard");

    const patientResults =
        document.getElementById("patientResultScreen");

    if (login)
        login.classList.remove("hidden");

    if (dashboard)
        dashboard.classList.add("hidden");

    if (patientResults)
        patientResults.classList.add("hidden");

    window.currentUser = null;
    window.currentProfile = null;
}


function showDashboard() {

    document
        .getElementById("loginScreen")
        ?.classList.add("hidden");

    document
        .getElementById("patientResultScreen")
        ?.classList.add("hidden");

    document
        .getElementById("dashboard")
        ?.classList.remove("hidden");
}


function showPatientResults() {

    document
        .getElementById("loginScreen")
        ?.classList.add("hidden");

    document
        .getElementById("dashboard")
        ?.classList.add("hidden");

    document
        .getElementById("patientResultScreen")
        ?.classList.remove("hidden");
}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const email =
        document
            .getElementById("loginEmail")
            .value
            .trim();

    const password =
        document
            .getElementById("loginPassword")
            .value;

    const message =
        document.getElementById("loginMessage");

    if (!email || !password) {

        message.textContent =
            "Please enter email and password.";

        return;
    }

    message.textContent =
        "Signing in...";

    try {

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({

                email: email,
                password: password

            });

        if (error)
            throw error;

        if (!data.user) {

            throw new Error(
                "Login failed. User not found."
            );

        }

        message.textContent = "";

        await loadDashboard();

    }
    catch (error) {

        console.error(
            "Login error:",
            error
        );

        message.textContent =
            error.message ||
            "Login failed.";

    }

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    try {

        await supabaseClient.auth.signOut();

    }
    catch (error) {

        console.error(
            "Logout error:",
            error
        );

    }

    showLogin();
}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    const {
        data: { session }
    } =
        await supabaseClient.auth.getSession();

    if (!session) {

        showLogin();

        return;
    }

    showDashboard();

    await loadProfile();

    if (!window.currentProfile) {

        await supabaseClient.auth.signOut();

        showLogin();

        return;
    }

    const role =
        window.currentProfile.role;

    console.log(
        "Logged-in role:",
        role
    );


    // Hide both dashboards first

    document
        .getElementById("adminDashboard")
        ?.classList.add("hidden");

    document
        .getElementById("operatorDashboard")
        ?.classList.add("hidden");


    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    if (role === "admin") {

        document
            .getElementById("adminDashboard")
            ?.classList.remove("hidden");

        await loadAdminPanel();

        return;
    }


    // --------------------------------------------------------
    // OPERATOR
    // --------------------------------------------------------

    if (role === "operator") {

        document
            .getElementById("operatorDashboard")
            ?.classList.remove("hidden");

        await loadSubjects();
        await loadScans();
        await loadReferenceGroups();

        return;
    }


    // --------------------------------------------------------
    // UNKNOWN ROLE
    // --------------------------------------------------------

    console.error(
        "Unknown account role:",
        role
    );

    alert(
        "Your account does not have a valid system role."
    );

    await supabaseClient.auth.signOut();

    showLogin();
}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {

    try {

        const {
            data: { user }
        } =
            await supabaseClient.auth.getUser();

        if (!user)
            return;

        const { data, error } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

        if (error)
            throw error;

        window.currentUser =
            user;

        window.currentProfile =
            data;


        const name =
            data.full_name ||
            user.email ||
            "User";

        const userInfo =
            document.getElementById("userInfo");

        if (userInfo) {

            userInfo.textContent =
                `${name} (${data.role})`;

        }

    }
    catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        window.currentUser = null;
        window.currentProfile = null;
    }
}


// ============================================================
// LOAD OPERATOR PATIENTS
// ============================================================

async function loadSubjects() {

    const container =
        document.getElementById("subjectsList");

    if (!container)
        return;


    if (
        !window.currentUser ||
        window.currentProfile?.role !== "operator"
    ) {

        container.innerHTML =
            "<p>Patient list unavailable.</p>";

        return;
    }


    try {

        const { data, error } =
            await supabaseClient
                .from("subjects")
                .select("*")
                .eq(
                    "user_id",
                    window.currentUser.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (error)
            throw error;


        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No patients registered yet.</p>";

            return;
        }


        container.innerHTML =
            data.map(subject => `

                <div class="patient-card">

                    <strong>
                        ${escapeHTML(
                            subject.patient_id ||
                            subject.subject_id ||
                            "-"
                        )}
                    </strong>

                    <p>
                        Name:
                        ${escapeHTML(
                            subject.name || "-"
                        )}
                    </p>

                    <p>
                        Age:
                        ${subject.age ?? "-"}
                    </p>

                    <p>
                        Gender:
                        ${escapeHTML(
                            subject.gender || "-"
                        )}
                    </p>

                    <div class="linking-code">
                        Patient Code:
                        ${escapeHTML(
                            subject.linking_code || "-"
                        )}
                    </div>

                </div>

            `).join("");

    }
    catch (error) {

        console.error(
            "Subjects loading error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                Error loading patients:
                ${escapeHTML(error.message)}
            </p>`;
    }
}


// ============================================================
// GENERATE PATIENT ID
// ============================================================

function generatePatientID() {

    const random =
        Math.floor(
            10000 +
            Math.random() * 90000
        );

    return `PAT-${random}`;
}


// ============================================================
// GENERATE LINKING CODE
// ============================================================

function generateLinkingCode() {

    return String(
        Math.floor(
            100000 +
            Math.random() * 900000
        )
    );
}


// ============================================================
// CHECK LINKING CODE UNIQUENESS
// ============================================================

async function generateUniqueLinkingCode() {

    for (let attempt = 0; attempt < 10; attempt++) {

        const code =
            generateLinkingCode();

        const { data, error } =
            await supabaseClient
                .from("subjects")
                .select("id")
                .eq("linking_code", code)
                .limit(1);

        if (error)
            throw error;

        if (!data || data.length === 0) {

            return code;
        }
    }

    throw new Error(
        "Could not generate a unique patient code. Please try again."
    );
}


// ============================================================
// OPEN PATIENT MODAL
// ============================================================

function openPatientModal() {

    document
        .getElementById("patientModal")
        ?.classList.remove("hidden");

    document
        .getElementById("subjectMessage")
        .textContent = "";

    document
        .getElementById("createdPatientInfo")
        ?.classList.add("hidden");
}


// ============================================================
// CLOSE PATIENT MODAL
// ============================================================

function closePatientModal() {

    document
        .getElementById("patientModal")
        ?.classList.add("hidden");
}


// ============================================================
// ADD PATIENT
// ============================================================

async function addSubject() {

    if (
        !window.currentUser ||
        !window.currentProfile ||
        !["admin", "operator"]
            .includes(window.currentProfile.role)
    ) {

        alert(
            "Only admin or operator accounts can create patients."
        );

        return;
    }


    const name =
        document
            .getElementById("subjectName")
            .value
            .trim();

    const age =
        parseInt(
            document
                .getElementById("subjectAge")
                .value
        );

    const gender =
        document
            .getElementById("subjectGender")
            .value;

    const message =
        document
            .getElementById("subjectMessage");


    if (!name || !age || !gender) {

        message.textContent =
            "Please fill in all patient fields.";

        return;
    }


    if (age < 1 || age > 120) {

        message.textContent =
            "Please enter a valid age.";

        return;
    }


    message.textContent =
        "Creating patient...";


    try {

        const patientID =
            generatePatientID();

        const linkingCode =
            await generateUniqueLinkingCode();


        const { data, error } =
            await supabaseClient
                .from("subjects")
                .insert({

                    user_id:
                        window.currentUser.id,

                    subject_id:
                        patientID,

                    patient_id:
                        patientID,

                    name:
                        name,

                    age:
                        age,

                    gender:
                        gender,

                    linking_code:
                        linkingCode,

                    account_linked:
                        false

                })
                .select()
                .single();


        if (error)
            throw error;


        message.textContent =
            "Patient created successfully.";

        message.className =
            "message success";


        const info =
            document
                .getElementById(
                    "createdPatientInfo"
                );


        if (info) {

            info.innerHTML = `

                <strong>
                    Patient Created
                </strong>

                <p>
                    Patient ID:
                    <strong>
                        ${escapeHTML(
                            data.patient_id
                        )}
                    </strong>
                </p>

                <p>
                    Patient Name:
                    ${escapeHTML(
                        data.name
                    )}
                </p>

                <p>
                    Linking Code:
                    <strong>
                        ${escapeHTML(
                            data.linking_code
                        )}
                    </strong>
                </p>

                <p>
                    Give this linking code to the patient.
                    It is required to view their results.
                </p>

            `;

            info.classList.remove("hidden");
        }


        // Clear form

        document
            .getElementById("subjectName")
            .value = "";

        document
            .getElementById("subjectAge")
            .value = "";

        document
            .getElementById("subjectGender")
            .value = "";


        await loadSubjects();


        if (
            window.currentProfile.role === "admin"
        ) {

            await loadAllSubjects();
        }

    }
    catch (error) {

        console.error(
            "Add patient error:",
            error
        );

        message.className =
            "message";

        message.textContent =
            error.message ||
            "Could not create patient.";
    }
}


// ============================================================
// LOAD OPERATOR SCANS
// ============================================================

async function loadScans() {

    const container =
        document.getElementById("scansList");

    if (!container)
        return;


    try {

        const { data, error } =
            await supabaseClient
                .from("scan_measurements")
                .select("*")
                .eq(
                    "user_id",
                    window.currentUser.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error)
            throw error;


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
                        <th>Patient</th>
                        <th>F₀</th>
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
                                ${escapeHTML(
                                    scan.scan_id || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    scan.subject_id || "-"
                                )}
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
                                ${formatDate(
                                    scan.created_at
                                )}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>
        `;

    }
    catch (error) {

        console.error(
            "Scan loading error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                Error loading scans:
                ${escapeHTML(error.message)}
            </p>`;
    }
}


// ============================================================
// LOAD REFERENCE GROUPS
// ============================================================

async function loadReferenceGroups() {

    const container =
        document.getElementById(
            "referenceList"
        );

    if (!container)
        return;


    try {

        const { data, error } =
            await supabaseClient
                .from("reference_groups")
                .select("*")
                .order(
                    "age_min",
                    {
                        ascending: true
                    }
                );


        if (error)
            throw error;


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
                        <th>Mean F₀</th>
                        <th>SD F₀</th>
                        <th>Mean RMS</th>
                        <th>Mean Q</th>
                        <th>Mean Bandwidth</th>

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
                                ${escapeHTML(
                                    group.gender || "All"
                                )}
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

                            <td>
                                ${group.mean_bandwidth ?? "-"}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>
        `;

    }
    catch (error) {

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

    if (
        !window.currentProfile ||
        window.currentProfile.role !== "admin"
    ) {

        return;
    }


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
        document.getElementById(
            "adminUsers"
        );

    if (!container)
        return;


    try {

        const { data, error } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error)
            throw error;


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
                                ${escapeHTML(
                                    user.email || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    user.full_name || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    user.role || "-"
                                )}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>
        `;

    }
    catch (error) {

        console.error(
            "Admin users error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                ${escapeHTML(
                    error.message
                )}
            </p>`;
    }
}


// ============================================================
// ADMIN - ALL PATIENTS
// ============================================================

async function loadAllSubjects() {

    const container =
        document.getElementById(
            "adminSubjects"
        );

    if (!container)
        return;


    try {

        const { data, error } =
            await supabaseClient
                .from("subjects")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error)
            throw error;


        container.innerHTML = `

            <table>

                <thead>

                    <tr>

                        <th>Patient ID</th>
                        <th>Name</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>Operator</th>
                        <th>Linking Code</th>

                    </tr>

                </thead>

                <tbody>

                    ${data.map(subject => `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    subject.patient_id ||
                                    subject.subject_id ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    subject.name || "-"
                                )}
                            </td>

                            <td>
                                ${subject.age ?? "-"}
                            </td>

                            <td>
                                ${escapeHTML(
                                    subject.gender || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    subject.user_id || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    subject.linking_code || "-"
                                )}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>
        `;

    }
    catch (error) {

        console.error(
            "Admin patients error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                ${escapeHTML(
                    error.message
                )}
            </p>`;
    }
}


// ============================================================
// ADMIN - ALL SCANS
// ============================================================

async function loadAllScans() {

    const container =
        document.getElementById(
            "adminScans"
        );

    if (!container)
        return;


    try {

        const { data, error } =
            await supabaseClient
                .from("scan_measurements")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error)
            throw error;


        container.innerHTML = `

            <table>

                <thead>

                    <tr>

                        <th>Scan ID</th>
                        <th>Operator</th>
                        <th>Patient</th>
                        <th>F₀</th>
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
                                ${escapeHTML(
                                    scan.scan_id || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    scan.user_id || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    scan.subject_id || "-"
                                )}
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
                                ${formatDate(
                                    scan.created_at
                                )}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>
        `;

    }
    catch (error) {

        console.error(
            "Admin scans error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                ${escapeHTML(
                    error.message
                )}
            </p>`;
    }
}


// ============================================================
// ADMIN - REFERENCE MEASUREMENTS
// ============================================================

async function loadReferenceMeasurements() {

    const container =
        document.getElementById(
            "adminReferences"
        );

    if (!container)
        return;


    try {

        const { data, error } =
            await supabaseClient
                .from("reference_measurements")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error)
            throw error;


        container.innerHTML = `

            <table>

                <thead>

                    <tr>

                        <th>Reference ID</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>F₀</th>
                        <th>RMS</th>
                        <th>Q</th>
                        <th>Bandwidth</th>

                    </tr>

                </thead>

                <tbody>

                    ${data.map(ref => `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    ref.reference_id || "-"
                                )}
                            </td>

                            <td>
                                ${ref.age ?? "-"}
                            </td>

                            <td>
                                ${escapeHTML(
                                    ref.gender || "-"
                                )}
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

    }
    catch (error) {

        console.error(
            "Admin reference error:",
            error
        );

        container.innerHTML =
            `<p class="error">
                ${escapeHTML(
                    error.message
                )}
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
        document
            .getElementById("referenceId")
            .value
            .trim();

    const age =
        parseInt(
            document
                .getElementById("referenceAge")
                .value
        );

    const gender =
        document
            .getElementById("referenceGender")
            .value;

    const f0 =
        parseFloat(
            document
                .getElementById("referenceF0")
                .value
        );

    const rms =
        parseFloat(
            document
                .getElementById("referenceRMS")
                .value
        );

    const q =
        parseFloat(
            document
                .getElementById("referenceQ")
                .value
        );

    const bandwidth =
        parseFloat(
            document
                .getElementById(
                    "referenceBandwidth"
                )
                .value
        );

    const message =
        document.getElementById(
            "referenceMessage"
        );


    if (
        !referenceId ||
        !age ||
        !gender ||
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(q) ||
        !Number.isFinite(bandwidth)
    ) {

        message.textContent =
            "Please fill in all reference fields.";

        return;
    }


    message.textContent =
        "Adding reference measurement...";


    try {

        const { error } =
            await supabaseClient
                .from("reference_measurements")
                .insert({

                    reference_id:
                        referenceId,

                    age:
                        age,

                    gender:
                        gender,

                    f0:
                        f0,

                    rms:
                        rms,

                    q_factor:
                        q,

                    bandwidth:
                        bandwidth

                });


        if (error)
            throw error;


        message.className =
            "message success";

        message.textContent =
            "Reference measurement added successfully.";


        await loadReferenceMeasurements();
        await loadReferenceGroups();

    }
    catch (error) {

        console.error(
            "Add reference error:",
            error
        );

        message.className =
            "message";

        message.textContent =
            error.message ||
            "Could not add reference measurement.";
    }
}


// ============================================================
// PATIENT ACCESS
// ============================================================

async function patientAccess() {

    const input =
        document.getElementById(
            "patientLinkingCode"
        );

    const message =
        document.getElementById(
            "patientAccessMessage"
        );


    const code =
        input.value.trim();


    if (!/^\d{6}$/.test(code)) {

        message.textContent =
            "Please enter a valid 6-digit code.";

        return;
    }


    message.textContent =
        "Finding your records...";


    try {

        const { data, error } =
            await supabaseClient.rpc(
                "get_patient_results",
                {
                    p_linking_code: code
                }
            );


        if (error)
            throw error;


        if (!data || data.length === 0) {

            message.textContent =
                "No patient record found for this code.";

            return;
        }


        window.currentPatient =
            data;


        displayPatientResults(data);

    }
    catch (error) {

        console.error(
            "Patient access error:",
            error
        );

        message.textContent =
            error.message ||
            "Unable to retrieve patient records.";
    }
}


// ============================================================
// DISPLAY PATIENT RESULTS
// ============================================================

function displayPatientResults(data) {

    if (!data || data.length === 0)
        return;


    const first =
        data[0];


    const details =
        document.getElementById(
            "patientDetails"
        );


    const results =
        document.getElementById(
            "patientScanResults"
        );


    if (details) {

        details.innerHTML = `

            <div class="card">

                <h3>
                    Patient Details
                </h3>

                <div class="result-grid">

                    <div class="result-item">

                        <strong>
                            Patient ID
                        </strong>

                        ${escapeHTML(
                            first.patient_id || "-"
                        )}

                    </div>

                    <div class="result-item">

                        <strong>
                            Name
                        </strong>

                        ${escapeHTML(
                            first.patient_name || "-"
                        )}

                    </div>

                    <div class="result-item">

                        <strong>
                            Age
                        </strong>

                        ${first.patient_age ?? "-"}

                    </div>

                    <div class="result-item">

                        <strong>
                            Gender
                        </strong>

                        ${escapeHTML(
                            first.patient_gender || "-"
                        )}

                    </div>

                </div>

            </div>

        `;
    }


    const scans =
        data.filter(
            item => item.scan_id
        );


    if (!results)
        return;


    if (scans.length === 0) {

        results.innerHTML = `

            <div class="card">

                <h3>
                    Scan History
                </h3>

                <p>
                    No scan results are available yet.
                </p>

            </div>

        `;

        showPatientResults();

        return;
    }


    results.innerHTML = `

        <div class="card">

            <h3>
                My Scan History
            </h3>

            <div class="table-container">

                <table>

                    <thead>

                        <tr>

                            <th>Date</th>
                            <th>Scan ID</th>
                            <th>Side</th>
                            <th>F₀</th>
                            <th>RMS</th>
                            <th>Q</th>
                            <th>Bandwidth</th>
                            <th>Status</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${scans.map(scan => `

                            <tr>

                                <td>
                                    ${formatDate(
                                        scan.scan_date
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        scan.scan_id
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        scan.measurement_side ||
                                        "-"
                                    )}
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
                                    ${escapeHTML(
                                        scan.comparison_status ||
                                        "-"
                                    )}
                                </td>

                            </tr>

                        `).join("")}

                    </tbody>

                </table>

            </div>

        </div>

    `;


    showPatientResults();
}


// ============================================================
// BACK TO PATIENT ACCESS
// ============================================================

function backToPatientAccess() {

    document
        .getElementById(
            "patientResultScreen"
        )
        ?.classList.add("hidden");

    document
        .getElementById(
            "loginScreen"
        )
        ?.classList.remove("hidden");

    const input =
        document.getElementById(
            "patientLinkingCode"
        );

    if (input)
        input.value = "";

    const message =
        document.getElementById(
            "patientAccessMessage"
        );

    if (message)
        message.textContent = "";

    window.currentPatient = null;
}


// ============================================================
// START SCAN
// ============================================================

function prepareScan() {

    alert(
        "Scan module will be connected here. " +
        "First select a patient, then start the ESP32 scan."
    );
}


// ============================================================
// REFERENCE SCROLL
// ============================================================

function scrollToReference() {

    const section =
        document.getElementById(
            "operatorReferenceSection"
        );

    if (section) {

        section.scrollIntoView({
            behavior: "smooth"
        });

    }
}


// ============================================================
// UTILITIES
// ============================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function formatDate(date) {

    if (!date)
        return "-";


    const parsed =
        new Date(date);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {

        return "-";
    }


    return parsed.toLocaleString();
}


// ============================================================
// SESSION CHECK
// ============================================================

async function checkSession() {

    try {

        const {
            data: { session }
        } =
            await supabaseClient.auth.getSession();


        if (session) {

            await loadDashboard();

        }
        else {

            showLogin();

        }

    }
    catch (error) {

        console.error(
            "Session error:",
            error
        );

        showLogin();
    }
}


// ============================================================
// AUTH STATE
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
// EXPOSE FUNCTIONS TO HTML
// ============================================================

window.login =
    login;

window.logout =
    logout;

window.patientAccess =
    patientAccess;

window.backToPatientAccess =
    backToPatientAccess;

window.openPatientModal =
    openPatientModal;

window.closePatientModal =
    closePatientModal;

window.addSubject =
    addSubject;

window.addReference =
    addReference;

window.prepareScan =
    prepareScan;

window.scrollToReference =
    scrollToReference;


// ============================================================
// START APPLICATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkSession();

    }
);
