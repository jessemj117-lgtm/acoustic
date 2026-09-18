// ============================================================
// GROUP 4 ACOUSTIC BONE DENSITY SCANNER
// WEBSITE APP.JS
//
// Architecture:
//
// GitHub Pages Website
//        |
//        v
// Supabase scan_commands
//        |
//        v
// ESP32 Wi-Fi
//        |
//        v
// Acoustic Scan
//        |
//        v
// Supabase scan_measurements
//        |
//        v
// Website
//
// Device:
// ABS-001
//
// IMPORTANT:
// This is an acoustic measurement/research screening prototype.
// It is NOT a clinically validated osteoporosis diagnostic device.
// ============================================================


// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

// Paste the SAME Supabase URL you already use.
const SUPABASE_URL = "https://ropiudyalwarmowaiugu.supabase.co";

// Paste the SAME Supabase publishable/anon key you already use.
const SUPABASE_KEY = "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";


// Create Supabase client
const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ============================================================
// GLOBAL STATE
// ============================================================

let currentUser = null;
let currentProfile = null;

let currentPatient = null;
let currentMeasurementSide = null;

let referenceScannerRunning = false;
let patientScannerRunning = false;

let wirelessPollTimer = null;

let currentWirelessCommandId = null;
let currentWirelessScanId = null;
let currentWirelessMode = null;

const SCANNER_DEVICE_ID = "ABS-001";


// ============================================================
// DOM READY
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("Acoustic Scanner application starting...");

    await initializeApplication();

});


// ============================================================
// INITIALIZE APPLICATION
// ============================================================

async function initializeApplication() {

    try {

        const {
            data: {
                session
            },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("Session error:", error);
            showLogin();
            return;
        }

        if (!session) {
            showLogin();
            return;
        }

        currentUser = session.user;

        await loadProfile();

        if (!currentProfile) {
            showLogin();
            return;
        }

        await loadDashboard();

    } catch (error) {

        console.error(
            "Application initialization error:",
            error
        );

        showLogin();

    }

}


// ============================================================
// AUTH STATE CHANGE
// ============================================================

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        console.log(
            "Auth state:",
            event
        );

        if (session) {

            currentUser = session.user;

            setTimeout(async () => {

                await loadProfile();

                if (currentProfile) {
                    await loadDashboard();
                }

            }, 0);

        } else {

            currentUser = null;
            currentProfile = null;
            currentPatient = null;

            stopWirelessPolling();

            showLogin();

        }

    }
);


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const emailElement =
        document.getElementById("loginEmail");

    const passwordElement =
        document.getElementById("loginPassword");

    const messageElement =
        document.getElementById("loginMessage");


    const email =
        emailElement
            ? emailElement.value.trim()
            : "";

    const password =
        passwordElement
            ? passwordElement.value
            : "";


    if (!email || !password) {

        setMessage(
            messageElement,
            "Please enter email and password.",
            "error"
        );

        return;
    }


    setMessage(
        messageElement,
        "Signing in...",
        "info"
    );


    try {

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });


        if (error) {
            throw error;
        }


        currentUser = data.user;

        await loadProfile();

        if (!currentProfile) {

            throw new Error(
                "User profile was not found."
            );

        }


        await loadDashboard();


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        setMessage(
            messageElement,
            error.message ||
            "Login failed.",
            "error"
        );

    }

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    stopWirelessPolling();

    currentUser = null;
    currentProfile = null;
    currentPatient = null;

    try {

        await supabaseClient.auth.signOut();

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    }

    showLogin();

}


// ============================================================
// SHOW LOGIN
// ============================================================

function showLogin() {

    const loginSection =
        document.getElementById("loginSection");

    const dashboardSection =
        document.getElementById("dashboardSection");


    if (loginSection) {
        loginSection.style.display = "block";
    }

    if (dashboardSection) {
        dashboardSection.style.display = "none";
    }

}


// ============================================================
// SHOW DASHBOARD
// ============================================================

function showDashboard() {

    const loginSection =
        document.getElementById("loginSection");

    const dashboardSection =
        document.getElementById("dashboardSection");


    if (loginSection) {
        loginSection.style.display = "none";
    }

    if (dashboardSection) {
        dashboardSection.style.display = "block";
    }

}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {

    if (!currentUser) {
        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();


        if (error) {
            throw error;
        }


        currentProfile = data;


        if (!currentProfile) {

            console.warn(
                "No profile found for user:",
                currentUser.id
            );

            return;

        }


        console.log(
            "Current profile:",
            currentProfile
        );


    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        currentProfile = null;

    }

}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    if (!currentProfile) {
        return;
    }


    showDashboard();


    const role =
        String(
            currentProfile.role || ""
        ).toUpperCase();


    updateUserInterface();


    if (role === "ADMIN") {

        await loadAdminDashboard();

    } else if (role === "OPERATOR") {

        await loadOperatorDashboard();

    } else if (role === "PATIENT") {

        await loadPatientDashboard();

    } else {

        console.warn(
            "Unknown user role:",
            role
        );

    }

}


// ============================================================
// UPDATE USER INTERFACE
// ============================================================

function updateUserInterface() {

    const role =
        String(
            currentProfile?.role || ""
        ).toUpperCase();


    const userNameElement =
        document.getElementById("currentUserName");

    const userRoleElement =
        document.getElementById("currentUserRole");


    if (userNameElement) {

        userNameElement.textContent =
            currentProfile?.full_name ||
            currentProfile?.name ||
            currentUser?.email ||
            "User";

    }


    if (userRoleElement) {

        userRoleElement.textContent =
            role;

    }


    const adminSection =
        document.getElementById("adminSection");

    const operatorSection =
        document.getElementById("operatorSection");

    const patientSection =
        document.getElementById("patientSection");


    if (adminSection) {

        adminSection.style.display =
            role === "ADMIN"
                ? ""
                : "none";

    }


    if (operatorSection) {

        operatorSection.style.display =
            role === "OPERATOR"
                ? ""
                : "none";

    }


    if (patientSection) {

        patientSection.style.display =
            role === "PATIENT"
                ? ""
                : "none";

    }

}


// ============================================================
// ADMIN DASHBOARD
// ============================================================

async function loadAdminDashboard() {

    console.log(
        "Loading admin dashboard..."
    );


    await Promise.all([
        loadAllUsers(),
        loadAllSubjects(),
        loadAllScans(),
        loadAdminReferences(),
        loadScannerDevices()
    ]);

}


// ============================================================
// LOAD ALL USERS
// ============================================================

async function loadAllUsers() {

    const container =
        document.getElementById(
            "adminUsersList"
        );

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("profiles")
            .select("*")
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        if (!container) {
            return;
        }


        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No users found.</p>";

            return;

        }


        container.innerHTML =
            data.map(user => {

                const name =
                    escapeHTML(
                        user.full_name ||
                        user.name ||
                        "Unnamed user"
                    );

                const email =
                    escapeHTML(
                        user.email ||
                        ""
                    );

                const role =
                    escapeHTML(
                        user.role ||
                        ""
                    );


                return `
                    <div class="admin-user-row">
                        <strong>${name}</strong>
                        <span>${email}</span>
                        <span>${role}</span>
                    </div>
                `;

            }).join("");


    } catch (error) {

        console.error(
            "Loading users failed:",
            error
        );

        if (container) {

            container.innerHTML =
                "<p>Unable to load users.</p>";

        }

    }

}


// ============================================================
// LOAD ALL SUBJECTS
// ============================================================

async function loadAllSubjects() {

    const container =
        document.getElementById(
            "adminSubjectsList"
        );


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .select("*")
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        if (!container) {
            return;
        }


        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No patients found.</p>";

            return;

        }


        container.innerHTML =
            data.map(subject => {

                const id =
                    escapeHTML(
                        subject.subject_id ||
                        subject.patient_id ||
                        subject.id ||
                        ""
                    );

                const name =
                    escapeHTML(
                        subject.name ||
                        "Unnamed patient"
                    );

                const age =
                    subject.age ??
                    "—";

                const gender =
                    escapeHTML(
                        subject.gender ||
                        "—"
                    );

                const linkingCode =
                    escapeHTML(
                        subject.linking_code ||
                        "—"
                    );

                const databaseId =
                    escapeHTML(
                        subject.id ||
                        ""
                    );


                return `
                    <div class="admin-patient-row">

                        <div>
                            <strong>${name}</strong>
                            <div>Patient ID: ${id}</div>
                            <div>Age: ${age}</div>
                            <div>Gender: ${gender}</div>
                            <div>Linking Code: ${linkingCode}</div>
                        </div>

                        <div>
                            <button
                                type="button"
                                onclick="selectAdminPatient('${databaseId}')"
                            >
                                View
                            </button>

                            <button
                                type="button"
                                class="danger"
                                onclick="deletePatient('${databaseId}')"
                            >
                                Delete
                            </button>
                        </div>

                    </div>
                `;

            }).join("");


    } catch (error) {

        console.error(
            "Loading admin patients failed:",
            error
        );

        if (container) {

            container.innerHTML =
                "<p>Unable to load patients.</p>";

        }

    }

}


// ============================================================
// ADMIN SELECT PATIENT
// ============================================================

async function selectAdminPatient(id) {

    if (!id) {
        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .select("*")
            .eq("id", id)
            .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {

            alert(
                "Patient not found."
            );

            return;

        }


        currentPatient = data;

        showPatientDetails(
            data
        );


    } catch (error) {

        console.error(
            "Admin patient selection error:",
            error
        );

        alert(
            error.message ||
            "Unable to load patient."
        );

    }

}


// ============================================================
// OPEN ADMIN PATIENT MODAL
// ============================================================

function openAdminPatientModal() {

    const modal =
        document.getElementById(
            "adminPatientModal"
        );


    if (!modal) {
        return;
    }


    const nameInput =
        document.getElementById(
            "adminSubjectName"
        );

    const ageInput =
        document.getElementById(
            "adminSubjectAge"
        );

    const genderInput =
        document.getElementById(
            "adminSubjectGender"
        );

    const message =
        document.getElementById(
            "adminSubjectMessage"
        );


    if (nameInput) {
        nameInput.value = "";
    }

    if (ageInput) {
        ageInput.value = "";
    }

    if (genderInput) {
        genderInput.value = "";
    }

    if (message) {
        message.textContent = "";
    }


    modal.style.display = "flex";

}


// ============================================================
// CLOSE ADMIN PATIENT MODAL
// ============================================================

function closeAdminPatientModal() {

    const modal =
        document.getElementById(
            "adminPatientModal"
        );


    if (modal) {
        modal.style.display = "none";
    }

}


// ============================================================
// CREATE ADMIN PATIENT
// ============================================================

async function createAdminPatient() {

    if (!isAdmin()) {

        alert(
            "Administrator access required."
        );

        return;

    }


    const nameInput =
        document.getElementById(
            "adminSubjectName"
        );

    const ageInput =
        document.getElementById(
            "adminSubjectAge"
        );

    const genderInput =
        document.getElementById(
            "adminSubjectGender"
        );

    const message =
        document.getElementById(
            "adminSubjectMessage"
        );


    const name =
        nameInput
            ? nameInput.value.trim()
            : "";

    const age =
        ageInput
            ? parseInt(
                ageInput.value,
                10
            )
            : NaN;

    const gender =
        genderInput
            ? genderInput.value.trim()
            : "";


    if (!name) {

        setMessage(
            message,
            "Patient name is required.",
            "error"
        );

        return;

    }


    if (
        !Number.isFinite(age) ||
        age < 1 ||
        age > 120
    ) {

        setMessage(
            message,
            "Enter a valid age.",
            "error"
        );

        return;

    }


    setMessage(
        message,
        "Creating patient...",
        "info"
    );


    try {

        const patientId =
            await generatePatientId();

        const linkingCode =
            await generateUniqueLinkingCode();


        const payload = {

            user_id:
                currentUser.id,

            subject_id:
                patientId,

            patient_id:
                patientId,

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

        };


        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .insert(payload)
            .select()
            .single();


        if (error) {
            throw error;
        }


        currentPatient = data;


        if (message) {

            message.innerHTML = `
                <strong>Patient created successfully.</strong><br>
                Patient ID: ${escapeHTML(patientId)}<br>
                Linking Code: ${escapeHTML(linkingCode)}
            `;

        }


        await loadAllSubjects();

        await loadSubjects();


        setTimeout(() => {

            closeAdminPatientModal();

        }, 3500);


    } catch (error) {

        console.error(
            "Admin patient creation failed:",
            error
        );

        setMessage(
            message,
            error.message ||
            "Unable to create patient.",
            "error"
        );

    }

}


// ============================================================
// DELETE PATIENT
// ============================================================

async function deletePatient(id) {

    if (!isAdmin()) {

        alert(
            "Administrator access required."
        );

        return;

    }


    if (!id) {
        return;
    }


    const confirmed =
        confirm(
            "Delete this patient and their scan measurements?\n\nThis action cannot be undone."
        );


    if (!confirmed) {
        return;
    }


    try {

        // Delete associated scan measurements first.
        const {
            error: scanError
        } = await supabaseClient
            .from("scan_measurements")
            .delete()
            .eq("subject_id", id);


        if (scanError) {
            throw scanError;
        }


        // Delete patient.
        const {
            error: subjectError
        } = await supabaseClient
            .from("subjects")
            .delete()
            .eq("id", id);


        if (subjectError) {
            throw subjectError;
        }


        if (
            currentPatient &&
            currentPatient.id === id
        ) {

            currentPatient = null;

        }


        alert(
            "Patient deleted successfully."
        );


        await loadAllSubjects();

        await loadAllScans();


    } catch (error) {

        console.error(
            "Patient deletion failed:",
            error
        );

        alert(
            error.message ||
            "Unable to delete patient."
        );

    }

}


// ============================================================
// LOAD ALL SCANS - ADMIN
// ============================================================

async function loadAllScans() {

    const container =
        document.getElementById(
            "adminScansTable"
        );


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("scan_measurements")
            .select("*")
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        if (!container) {
            return;
        }


        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No scans found.</p>";

            return;

        }


        container.innerHTML = `
            <div class="scan-table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Scan ID</th>
                            <th>Patient</th>
                            <th>Side</th>
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
                                    ${escapeHTML(
                                        scan.scan_id || ""
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        scan.subject_id || ""
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        scan.measurement_side || ""
                                    )}
                                </td>

                                <td>
                                    ${formatNumber(
                                        scan.f0,
                                        2
                                    )}
                                </td>

                                <td>
                                    ${formatNumber(
                                        scan.rms,
                                        3
                                    )}
                                </td>

                                <td>
                                    ${formatNumber(
                                        scan.q_factor,
                                        3
                                    )}
                                </td>

                                <td>
                                    ${formatNumber(
                                        scan.bandwidth,
                                        2
                                    )}
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
            </div>
        `;


    } catch (error) {

        console.error(
            "Admin scans loading failed:",
            error
        );

        if (container) {

            container.innerHTML =
                "<p>Unable to load scans.</p>";

        }

    }

}


// ============================================================
// LOAD ADMIN REFERENCES
// ============================================================

async function loadAdminReferences() {

    const container =
        document.getElementById(
            "adminReferencesList"
        );


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("reference_groups")
            .select("*")
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        if (!container) {
            return;
        }


        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No reference groups found.</p>";

            return;

        }


        container.innerHTML =
            data.map(group => {

                return `
                    <div class="reference-row">

                        <strong>
                            ${escapeHTML(
                                group.name ||
                                "Reference Group"
                            )}
                        </strong>

                        <span>
                            Age:
                            ${escapeHTML(
                                String(
                                    group.age_min ??
                                    ""
                                )
                            )}
                            -
                            ${escapeHTML(
                                String(
                                    group.age_max ??
                                    ""
                                )
                            )}
                        </span>

                        <span>
                            Gender:
                            ${escapeHTML(
                                group.gender ||
                                "All"
                            )}
                        </span>

                    </div>
                `;

            }).join("");


    } catch (error) {

        console.error(
            "Admin references error:",
            error
        );

        if (container) {

            container.innerHTML =
                "<p>Unable to load references.</p>";

        }

    }

}


// ============================================================
// LOAD SCANNER DEVICES
// ============================================================

async function loadScannerDevices() {

    const container =
        document.getElementById(
            "scannerDevicesList"
        );


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("scanner_devices")
            .select("*")
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        if (!container) {
            return;
        }


        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No scanner devices found.</p>";

            return;

        }


        container.innerHTML =
            data.map(device => {

                const status =
                    device.is_active === false
                        ? "Inactive"
                        : "Active";


                return `
                    <div class="scanner-device-row">

                        <strong>
                            ${escapeHTML(
                                device.device_id ||
                                "Unknown"
                            )}
                        </strong>

                        <span>
                            ${status}
                        </span>

                        <span>
                            ${escapeHTML(
                                device.name ||
                                ""
                            )}
                        </span>

                    </div>
                `;

            }).join("");


    } catch (error) {

        console.error(
            "Scanner devices loading failed:",
            error
        );

        if (container) {

            container.innerHTML =
                "<p>Unable to load scanner devices.</p>";

        }

    }

}


// ============================================================
// OPERATOR DASHBOARD
// ============================================================

async function loadOperatorDashboard() {

    console.log(
        "Loading operator dashboard..."
    );


    await loadSubjects();

    await loadScans();

    updateScannerStatus(
        "Ready"
    );

}


// ============================================================
// LOAD OPERATOR PATIENTS
// ============================================================

async function loadSubjects() {

    const container =
        document.getElementById(
            "subjectsList"
        );


    if (!currentUser) {
        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        if (!container) {
            return;
        }


        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No patients found.</p>";

            return;

        }


        container.innerHTML =
            data.map(patient => {

                const databaseId =
                    escapeHTML(
                        patient.id || ""
                    );

                const name =
                    escapeHTML(
                        patient.name ||
                        "Unnamed"
                    );

                const patientId =
                    escapeHTML(
                        patient.subject_id ||
                        patient.patient_id ||
                        ""
                    );

                const age =
                    patient.age ??
                    "—";

                const gender =
                    escapeHTML(
                        patient.gender ||
                        "—"
                    );


                return `
                    <div
                        class="patient-row"
                        onclick="selectPatient('${databaseId}')"
                    >

                        <strong>
                            ${name}
                        </strong>

                        <span>
                            ID: ${patientId}
                        </span>

                        <span>
                            Age: ${age}
                        </span>

                        <span>
                            ${gender}
                        </span>

                    </div>
                `;

            }).join("");


    } catch (error) {

        console.error(
            "Loading patients failed:",
            error
        );

        if (container) {

            container.innerHTML =
                "<p>Unable to load patients.</p>";

        }

    }

}


// ============================================================
// CREATE PATIENT - OPERATOR
// ============================================================

async function createPatient() {

    if (!isOperator() && !isAdmin()) {

        alert(
            "Operator access required."
        );

        return;

    }


    const nameInput =
        document.getElementById(
            "subjectName"
        );

    const ageInput =
        document.getElementById(
            "subjectAge"
        );

    const genderInput =
        document.getElementById(
            "subjectGender"
        );

    const message =
        document.getElementById(
            "patientMessage"
        );


    const name =
        nameInput
            ? nameInput.value.trim()
            : "";

    const age =
        ageInput
            ? parseInt(
                ageInput.value,
                10
            )
            : NaN;

    const gender =
        genderInput
            ? genderInput.value.trim()
            : "";


    if (!name) {

        setMessage(
            message,
            "Patient name is required.",
            "error"
        );

        return;

    }


    if (
        !Number.isFinite(age) ||
        age < 1 ||
        age > 120
    ) {

        setMessage(
            message,
            "Please enter a valid age.",
            "error"
        );

        return;

    }


    try {

        setMessage(
            message,
            "Creating patient...",
            "info"
        );


        const patientId =
            await generatePatientId();

        const linkingCode =
            await generateUniqueLinkingCode();


        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .insert({

                user_id:
                    currentUser.id,

                subject_id:
                    patientId,

                patient_id:
                    patientId,

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


        if (error) {
            throw error;
        }


        currentPatient = data;


        setMessage(
            message,
            `Patient created. Patient ID: ${patientId}. Linking Code: ${linkingCode}`,
            "success"
        );


        await loadSubjects();


    } catch (error) {

        console.error(
            "Create patient error:",
            error
        );

        setMessage(
            message,
            error.message ||
            "Unable to create patient.",
            "error"
        );

    }

}


// ============================================================
// GENERATE PATIENT ID
// ============================================================

async function generatePatientId() {

    for (let attempt = 0; attempt < 20; attempt++) {

        const randomPart =
            Math.floor(
                100000 +
                Math.random() * 900000
            );


        const patientId =
            `ABS-P-${randomPart}`;


        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .select("id")
            .eq("subject_id", patientId)
            .limit(1);


        if (error) {
            throw error;
        }


        if (!data || data.length === 0) {

            return patientId;

        }

    }


    throw new Error(
        "Unable to generate a unique patient ID."
    );

}


// ============================================================
// GENERATE UNIQUE LINKING CODE
// ============================================================

async function generateUniqueLinkingCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    for (let attempt = 0; attempt < 30; attempt++) {

        let code = "";


        for (let i = 0; i < 8; i++) {

            code +=
                characters[
                    Math.floor(
                        Math.random() *
                        characters.length
                    )
                ];

        }


        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .select("id")
            .eq("linking_code", code)
            .limit(1);


        if (error) {
            throw error;
        }


        if (!data || data.length === 0) {

            return code;

        }

    }


    throw new Error(
        "Unable to generate a unique linking code."
    );

}


// ============================================================
// SELECT PATIENT
// ============================================================

async function selectPatient(id) {

    if (!id) {
        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .select("*")
            .eq("id", id)
            .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {

            alert(
                "Patient not found."
            );

            return;

        }


        currentPatient = data;

        currentMeasurementSide = null;


        showPatientDetails(
            data
        );


        const scannerSection =
            document.getElementById(
                "patientScannerSection"
            );


        if (scannerSection) {
            scannerSection.style.display = "";
        }


        await loadScans(
            data.id
        );


    } catch (error) {

        console.error(
            "Patient selection error:",
            error
        );

        alert(
            error.message ||
            "Unable to select patient."
        );

    }

}


// ============================================================
// SHOW PATIENT DETAILS
// ============================================================

function showPatientDetails(patient) {

    const modal =
        document.getElementById(
            "patientModal"
        );


    const nameElement =
        document.getElementById(
            "patientModalName"
        );

    const idElement =
        document.getElementById(
            "patientModalId"
        );

    const ageElement =
        document.getElementById(
            "patientModalAge"
        );

    const genderElement =
        document.getElementById(
            "patientModalGender"
        );

    const linkingElement =
        document.getElementById(
            "patientModalLinkingCode"
        );


    if (nameElement) {

        nameElement.textContent =
            patient.name ||
            "Unnamed patient";

    }


    if (idElement) {

        idElement.textContent =
            patient.subject_id ||
            patient.patient_id ||
            "";

    }


    if (ageElement) {

        ageElement.textContent =
            patient.age ??
            "—";

    }


    if (genderElement) {

        genderElement.textContent =
            patient.gender ||
            "—";

    }


    if (linkingElement) {

        linkingElement.textContent =
            patient.linking_code ||
            "—";

    }


    if (modal) {

        modal.style.display =
            "flex";

    }

}


// ============================================================
// SELECT MEASUREMENT SIDE
// ============================================================

function selectMeasurementSide(side) {

    if (!currentPatient) {

        alert(
            "Please select a patient first."
        );

        return;

    }


    const normalizedSide =
        String(side || "")
            .trim()
            .toUpperCase();


    if (
        normalizedSide !== "LEFT" &&
        normalizedSide !== "RIGHT"
    ) {

        alert(
            "Please select LEFT or RIGHT."
        );

        return;

    }


    currentMeasurementSide =
        normalizedSide;


    const sideDisplay =
        document.getElementById(
            "selectedMeasurementSide"
        );


    if (sideDisplay) {

        sideDisplay.textContent =
            normalizedSide;

    }


    const leftButton =
        document.getElementById(
            "leftSideButton"
        );

    const rightButton =
        document.getElementById(
            "rightSideButton"
        );


    if (leftButton) {

        leftButton.classList.toggle(
            "active",
            normalizedSide === "LEFT"
        );

    }


    if (rightButton) {

        rightButton.classList.toggle(
            "active",
            normalizedSide === "RIGHT"
        );

    }

}


// ============================================================
// GENERATE SCAN ID
// ============================================================

function generateScanId() {

    const timestamp =
        Date.now().toString(36).toUpperCase();

    const random =
        Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();


    return `SCAN-${timestamp}-${random}`;

}


// ============================================================
// CANCEL SCAN PREPARATION
// ============================================================

function cancelScanPreparation() {

    stopWirelessPolling();

    patientScannerRunning = false;
    referenceScannerRunning = false;

    currentWirelessCommandId = null;
    currentWirelessScanId = null;
    currentWirelessMode = null;

    updateScannerStatus(
        "Ready"
    );


    const modal =
        document.getElementById(
            "scanPreparationModal"
        );


    if (modal) {
        modal.style.display = "none";
    }

}


// ============================================================
// START PATIENT SCAN
// ============================================================

async function startPatientScan() {

    if (!currentPatient) {

        alert(
            "Please select a patient first."
        );

        return;

    }


    if (
        currentMeasurementSide !== "LEFT" &&
        currentMeasurementSide !== "RIGHT"
    ) {

        alert(
            "Please select LEFT or RIGHT measurement side."
        );

        return;

    }


    if (patientScannerRunning) {

        alert(
            "A patient scan is already running."
        );

        return;

    }


    if (referenceScannerRunning) {

        alert(
            "A reference scan is currently running."
        );

        return;

    }


    const scanId =
        generateScanId();


    patientScannerRunning = true;

    currentWirelessMode = "patient";

    currentWirelessScanId =
        scanId;


    updateScannerStatus(
        "Sending scan command..."
    );


    try {

        // ----------------------------------------------------
        // Create remote scan command.
        //
        // ESP32 polls this table every few seconds.
        // ----------------------------------------------------

        const {
            data,
            error
        } = await supabaseClient
            .from("scan_commands")
            .insert({

                device_id:
                    SCANNER_DEVICE_ID,

                subject_id:
                    currentPatient.id,

                scan_id:
                    scanId,

                measurement_side:
                    currentMeasurementSide,

                status:
                    "PENDING"

            })
            .select()
            .single();


        if (error) {
            throw error;
        }


        currentWirelessCommandId =
            data.id;


        updateScannerStatus(
            "Command sent. Waiting for ESP32..."
        );


        startWirelessScanPolling();


    } catch (error) {

        console.error(
            "Starting wireless patient scan failed:",
            error
        );


        patientScannerRunning = false;

        currentWirelessMode = null;

        updateScannerStatus(
            "Scan command failed"
        );


        alert(
            error.message ||
            "Unable to start scan."
        );

    }

}


// ============================================================
// STOP PATIENT SCAN
// ============================================================

async function stopPatientScan() {

    stopWirelessPolling();


    if (
        !currentWirelessCommandId
    ) {

        patientScannerRunning = false;
        referenceScannerRunning = false;

        updateScannerStatus(
            "Ready"
        );

        return;

    }


    try {

        const {
            error
        } = await supabaseClient
            .from("scan_commands")
            .update({
                status: "CANCELLED"
            })
            .eq(
                "id",
                currentWirelessCommandId
            )
            .in(
                "status",
                [
                    "PENDING",
                    "RUNNING"
                ]
            );


        if (error) {
            throw error;
        }


        patientScannerRunning = false;
        referenceScannerRunning = false;

        currentWirelessCommandId = null;
        currentWirelessScanId = null;
        currentWirelessMode = null;


        updateScannerStatus(
            "Scan cancelled"
        );


    } catch (error) {

        console.error(
            "Stopping scan failed:",
            error
        );


        patientScannerRunning = false;
        referenceScannerRunning = false;


        updateScannerStatus(
            "Stop requested"
        );

    }

}


// ============================================================
// START WIRELESS SCAN POLLING
// ============================================================

function startWirelessScanPolling() {

    stopWirelessPolling();


    wirelessPollTimer =
        setInterval(
            async () => {

                await pollWirelessScanStatus();

            },
            1000
        );


    // Run immediately instead of waiting 1 second.
    pollWirelessScanStatus();

}


// ============================================================
// POLL WIRELESS SCAN STATUS
// ============================================================

async function pollWirelessScanStatus() {

    if (
        !currentWirelessCommandId
    ) {
        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("scan_commands")
            .select("*")
            .eq(
                "id",
                currentWirelessCommandId
            )
            .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {

            updateScannerStatus(
                "Scan command not found"
            );

            return;

        }


        const status =
            String(
                data.status || ""
            ).toUpperCase();


        // ----------------------------------------------------
        // PENDING
        // ----------------------------------------------------

        if (status === "PENDING") {

            updateScannerStatus(
                "Waiting for ESP32..."
            );

            return;

        }


        // ----------------------------------------------------
        // RUNNING
        // ----------------------------------------------------

        if (status === "RUNNING") {

            updateScannerStatus(
                "ESP32 is scanning..."
            );


            updateWirelessProgress(
                data.progress,
                data.current_frequency
            );


            return;

        }


        // ----------------------------------------------------
        // COMPLETED
        // ----------------------------------------------------

        if (status === "COMPLETED") {

            await handleWirelessScanCompleted(
                data
            );

            return;

        }


        // ----------------------------------------------------
        // FAILED
        // ----------------------------------------------------

        if (status === "FAILED") {

            stopWirelessPolling();

            patientScannerRunning = false;
            referenceScannerRunning = false;


            updateScannerStatus(
                "Scan failed"
            );


            alert(
                data.error_message ||
                "ESP32 scan failed."
            );


            clearWirelessState();

            return;

        }


        // ----------------------------------------------------
        // CANCELLED
        // ----------------------------------------------------

        if (status === "CANCELLED") {

            stopWirelessPolling();

            patientScannerRunning = false;
            referenceScannerRunning = false;


            updateScannerStatus(
                "Scan cancelled"
            );


            clearWirelessState();

            return;

        }


        updateScannerStatus(
            `Scanner status: ${status}`
        );


    } catch (error) {

        console.error(
            "Wireless scan polling error:",
            error
        );

        updateScannerStatus(
            "Checking scanner..."
        );

    }

}


// ============================================================
// HANDLE COMPLETED WIRELESS SCAN
// ============================================================

async function handleWirelessScanCompleted(
    command
) {

    stopWirelessPolling();


    updateScannerStatus(
        "Scan complete. Loading measurement..."
    );


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("scan_measurements")
            .select("*")
            .eq(
                "scan_id",
                command.scan_id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(1)
            .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {

            // ESP32 may have marked the command complete
            // just before the measurement becomes visible.
            //
            // Wait briefly and try once more.

            await delay(1000);


            const retry =
                await supabaseClient
                    .from("scan_measurements")
                    .select("*")
                    .eq(
                        "scan_id",
                        command.scan_id
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    )
                    .limit(1)
                    .maybeSingle();


            if (retry.error) {
                throw retry.error;
            }


            if (!retry.data) {

                throw new Error(
                    "Scan completed but no measurement was found."
                );

            }


            await processCompletedMeasurement(
                retry.data
            );


        } else {

            await processCompletedMeasurement(
                data
            );

        }


    } catch (error) {

        console.error(
            "Completed scan handling failed:",
            error
        );


        patientScannerRunning = false;
        referenceScannerRunning = false;


        updateScannerStatus(
            "Measurement retrieval failed"
        );


        alert(
            error.message ||
            "Unable to retrieve scan measurement."
        );


        clearWirelessState();

    }

}


// ============================================================
// PROCESS COMPLETED MEASUREMENT
// ============================================================

async function processCompletedMeasurement(
    measurement
) {

    if (!measurement) {
        return;
    }


    const f0 =
        Number(
            measurement.f0
        );

    const rms =
        Number(
            measurement.rms
        );

    const q =
        Number(
            measurement.q_factor
        );

    const bandwidth =
        Number(
            measurement.bandwidth
        );


    if (
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(q) ||
        !Number.isFinite(bandwidth)
    ) {

        throw new Error(
            "The scanner returned an incomplete measurement."
        );

    }


    // --------------------------------------------------------
    // If firmware has already inserted the result into
    // scan_measurements, do NOT insert a duplicate here.
    // --------------------------------------------------------

    displayMeasurementResult(
        measurement
    );


    patientScannerRunning = false;
    referenceScannerRunning = false;


    updateScannerStatus(
        "Scan completed successfully"
    );


    await loadScans(
        currentPatient
            ? currentPatient.id
            : null
    );


    clearWirelessState();

}


// ============================================================
// UPDATE WIRELESS PROGRESS
// ============================================================

function updateWirelessProgress(
    progress,
    frequency
) {

    const progressElement =
        document.getElementById(
            "scannerProgress"
        );

    const frequencyElement =
        document.getElementById(
            "scannerFrequency"
        );


    if (
        progressElement &&
        Number.isFinite(
            Number(progress)
        )
    ) {

        const value =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(progress)
                )
            );


        progressElement.value =
            value;


        if (
            "textContent" in
            progressElement
        ) {

            progressElement.textContent =
                `${value.toFixed(0)}%`;

        }

    }


    if (
        frequencyElement &&
        Number.isFinite(
            Number(frequency)
        )
    ) {

        frequencyElement.textContent =
            `${Number(frequency).toFixed(0)} Hz`;

    }

}


// ============================================================
// STOP WIRELESS POLLING
// ============================================================

function stopWirelessPolling() {

    if (wirelessPollTimer) {

        clearInterval(
            wirelessPollTimer
        );

        wirelessPollTimer = null;

    }

}


// ============================================================
// CLEAR WIRELESS STATE
// ============================================================

function clearWirelessState() {

    currentWirelessCommandId = null;
    currentWirelessScanId = null;
    currentWirelessMode = null;

}


// ============================================================
// SAVE PATIENT MEASUREMENT
//
// This function is retained for manual/reference workflows.
// Normal ESP32 scans already upload directly to Supabase.
// ============================================================

async function savePatientMeasurement(
    measurement
) {

    if (!currentPatient) {

        throw new Error(
            "No patient selected."
        );

    }


    const payload = {

        user_id:
            currentUser
                ? currentUser.id
                : null,

        subject_id:
            currentPatient.id,

        scan_id:
            measurement.scan_id ||
            generateScanId(),

        f0:
            toNullableNumber(
                measurement.f0
            ),

        rms:
            toNullableNumber(
                measurement.rms
            ),

        q_factor:
            toNullableNumber(
                measurement.q_factor
            ),

        bandwidth:
            toNullableNumber(
                measurement.bandwidth
            ),

        measurement_side:
            measurement.measurement_side ||
            currentMeasurementSide,

        frequency_start:
            toNullableNumber(
                measurement.frequency_start ??
                200
            ),

        frequency_end:
            toNullableNumber(
                measurement.frequency_end ??
                1200
            ),

        frequency_step:
            toNullableNumber(
                measurement.frequency_step ??
                5
            ),

        sensor_head_id:
            measurement.sensor_head_id ||
            "ABS-HEAD-001"

    };


    const {
        data,
        error
    } = await supabaseClient
        .from("scan_measurements")
        .insert(payload)
        .select()
        .single();


    if (error) {
        throw error;
    }


    return data;

}


// ============================================================
// DISPLAY MEASUREMENT RESULT
// ============================================================

function displayMeasurementResult(
    measurement
) {

    const f0 =
        toNullableNumber(
            measurement.f0
        );

    const rms =
        toNullableNumber(
            measurement.rms
        );

    const q =
        toNullableNumber(
            measurement.q_factor
        );

    const bandwidth =
        toNullableNumber(
            measurement.bandwidth
        );


    const f0Element =
        document.getElementById(
            "resultF0"
        );

    const rmsElement =
        document.getElementById(
            "resultRMS"
        );

    const qElement =
        document.getElementById(
            "resultQ"
        );

    const bandwidthElement =
        document.getElementById(
            "resultBandwidth"
        );

    const sideElement =
        document.getElementById(
            "resultSide"
        );

    const scanIdElement =
        document.getElementById(
            "resultScanId"
        );


    if (f0Element) {

        f0Element.textContent =
            formatNumber(
                f0,
                2
            ) + " Hz";

    }


    if (rmsElement) {

        rmsElement.textContent =
            formatNumber(
                rms,
                3
            );

    }


    if (qElement) {

        qElement.textContent =
            formatNumber(
                q,
                3
            );

    }


    if (bandwidthElement) {

        bandwidthElement.textContent =
            formatNumber(
                bandwidth,
                2
            ) + " Hz";

    }


    if (sideElement) {

        sideElement.textContent =
            measurement.measurement_side ||
            "—";

    }


    if (scanIdElement) {

        scanIdElement.textContent =
            measurement.scan_id ||
            "—";

    }


    const resultSection =
        document.getElementById(
            "scanResultSection"
        );


    if (resultSection) {

        resultSection.style.display =
            "";

    }

}


// ============================================================
// LOAD PATIENT SCANS
// ============================================================

async function loadScans(
    subjectId = null
) {

    const container =
        document.getElementById(
            "scansList"
        );


    const targetSubject =
        subjectId ||
        currentPatient?.id;


    if (!targetSubject) {

        if (container) {

            container.innerHTML =
                "<p>Select a patient to view scans.</p>";

        }

        return;

    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("scan_measurements")
            .select("*")
            .eq(
                "subject_id",
                targetSubject
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {
            throw error;
        }


        if (!container) {
            return;
        }


        if (!data || data.length === 0) {

            container.innerHTML =
                "<p>No measurements recorded.</p>";

            return;

        }


        container.innerHTML =
            data.map(scan => {

                const scanId =
                    escapeHTML(
                        scan.scan_id ||
                        ""
                    );

                const side =
                    escapeHTML(
                        scan.measurement_side ||
                        "—"
                    );


                return `
                    <div class="scan-card">

                        <div>
                            <strong>
                                ${scanId}
                            </strong>

                            <div>
                                ${formatDate(
                                    scan.created_at
                                )}
                            </div>

                            <div>
                                Side:
                                ${side}
                            </div>
                        </div>

                        <div>
                            <span>
                                f0:
                                ${formatNumber(
                                    scan.f0,
                                    2
                                )} Hz
                            </span>

                            <span>
                                RMS:
                                ${formatNumber(
                                    scan.rms,
                                    3
                                )}
                            </span>

                            <span>
                                Q:
                                ${formatNumber(
                                    scan.q_factor,
                                    3
                                )}
                            </span>

                            <span>
                                BW:
                                ${formatNumber(
                                    scan.bandwidth,
                                    2
                                )} Hz
                            </span>
                        </div>

                        <div>

                            <button
                                type="button"
                                onclick="deletePatientMeasurement('${escapeHTML(
                                    scan.id || ""
                                )}')"
                            >
                                Delete
                            </button>

                        </div>

                    </div>
                `;

            }).join("");


    } catch (error) {

        console.error(
            "Loading scans failed:",
            error
        );

        if (container) {

            container.innerHTML =
                "<p>Unable to load measurements.</p>";

        }

    }

}


// ============================================================
// DELETE PATIENT MEASUREMENT
// ============================================================

async function deletePatientMeasurement(
    id
) {

    if (!id) {
        return;
    }


    if (!isOperator() && !isAdmin()) {

        alert(
            "You do not have permission to delete measurements."
        );

        return;

    }


    if (
        !confirm(
            "Delete this measurement?"
        )
    ) {

        return;

    }


    try {

        const {
            error
        } = await supabaseClient
            .from("scan_measurements")
            .delete()
            .eq(
                "id",
                id
            );


        if (error) {
            throw error;
        }


        await loadScans();


        if (isAdmin()) {
            await loadAllScans();
        }


    } catch (error) {

        console.error(
            "Measurement deletion failed:",
            error
        );

        alert(
            error.message ||
            "Unable to delete measurement."
        );

    }

}


// ============================================================
// REFERENCE SCANNER
//
// Reference scan uses the SAME ESP32 scan algorithm.
// The website creates a command with mode/reference data.
// ============================================================

async function startReferenceScanner() {

    if (!isOperator() && !isAdmin()) {

        alert(
            "Operator or administrator access required."
        );

        return;

    }


    if (patientScannerRunning) {

        alert(
            "A patient scan is currently running."
        );

        return;

    }


    if (referenceScannerRunning) {

        alert(
            "A reference scan is already running."
        );

        return;

    }


    const ageInput =
        document.getElementById(
            "referenceAge"
        );

    const genderInput =
        document.getElementById(
            "referenceGender"
        );

    const sideInput =
        document.getElementById(
            "referenceSide"
        );


    const age =
        ageInput
            ? parseInt(
                ageInput.value,
                10
            )
            : NaN;

    const gender =
        genderInput
            ? genderInput.value.trim()
            : "";

    const side =
        sideInput
            ? sideInput.value.trim().toUpperCase()
            : "LEFT";


    if (
        !Number.isFinite(age) ||
        age < 1 ||
        age > 120
    ) {

        alert(
            "Enter a valid reference age."
        );

        return;

    }


    if (!gender) {

        alert(
            "Enter reference gender."
        );

        return;

    }


    const sampleId =
        `REF-${Date.now()}`;


    referenceScannerRunning = true;

    currentWirelessMode =
        "reference";

    currentWirelessScanId =
        sampleId;


    updateScannerStatus(
        "Starting reference scan..."
    );


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("scan_commands")
            .insert({

                device_id:
                    SCANNER_DEVICE_ID,

                subject_id:
                    null,

                scan_id:
                    sampleId,

                measurement_side:
                    side,

                status:
                    "PENDING",

                mode:
                    "REFERENCE",

                reference_age:
                    age,

                reference_gender:
                    gender

            })
            .select()
            .single();


        if (error) {
            throw error;
        }


        currentWirelessCommandId =
            data.id;


        updateScannerStatus(
            "Reference command sent. Waiting for ESP32..."
        );


        startWirelessReferencePolling();


    } catch (error) {

        console.error(
            "Reference scanner error:",
            error
        );


        referenceScannerRunning = false;

        currentWirelessMode = null;


        updateScannerStatus(
            "Reference scan failed"
        );


        alert(
            error.message ||
            "Unable to start reference scan."
        );

    }

}


// ============================================================
// REFERENCE WIRELESS POLLING
// ============================================================

function startWirelessReferencePolling() {

    stopWirelessPolling();


    wirelessPollTimer =
        setInterval(
            async () => {

                await pollReferenceScanStatus();

            },
            1000
        );


    pollReferenceScanStatus();

}


// ============================================================
// POLL REFERENCE SCAN
// ============================================================

async function pollReferenceScanStatus() {

    if (!currentWirelessCommandId) {
        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("scan_commands")
            .select("*")
            .eq(
                "id",
                currentWirelessCommandId
            )
            .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {
            return;
        }


        const status =
            String(
                data.status || ""
            ).toUpperCase();


        if (status === "PENDING") {

            updateScannerStatus(
                "Waiting for ESP32..."
            );

            return;

        }


        if (status === "RUNNING") {

            updateScannerStatus(
                "ESP32 is performing reference scan..."
            );

            updateWirelessProgress(
                data.progress,
                data.current_frequency
            );

            return;

        }


        if (status === "COMPLETED") {

            stopWirelessPolling();

            await saveReferenceMeasurementFromCommand(
                data
            );

            return;

        }


        if (status === "FAILED") {

            stopWirelessPolling();

            referenceScannerRunning = false;

            updateScannerStatus(
                "Reference scan failed"
            );


            alert(
                data.error_message ||
                "Reference scan failed."
            );


            clearWirelessState();

            return;

        }


        if (status === "CANCELLED") {

            stopWirelessPolling();

            referenceScannerRunning = false;

            updateScannerStatus(
                "Reference scan cancelled"
            );


            clearWirelessState();

        }


    } catch (error) {

        console.error(
            "Reference polling error:",
            error
        );

    }

}


// ============================================================
// SAVE REFERENCE MEASUREMENT
// ============================================================

async function saveReferenceMeasurementFromCommand(
    command
) {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("scan_measurements")
            .select("*")
            .eq(
                "scan_id",
                command.scan_id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(1)
            .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {

            throw new Error(
                "Reference scan completed but measurement was not found."
            );

        }


        const {
            error: referenceError
        } = await supabaseClient
            .from("reference_measurements")
            .insert({

                reference_group_id:
                    command.reference_group_id ||
                    null,

                age:
                    command.reference_age,

                gender:
                    command.reference_gender,

                f0:
                    data.f0,

                rms:
                    data.rms,

                q_factor:
                    data.q_factor,

                bandwidth:
                    data.bandwidth,

                measurement_side:
                    data.measurement_side ||
                    command.measurement_side

            });


        if (referenceError) {
            throw referenceError;
        }


        referenceScannerRunning = false;


        updateScannerStatus(
            "Reference measurement saved"
        );


        displayMeasurementResult(
            data
        );


        await loadAdminReferences();


        clearWirelessState();


    } catch (error) {

        console.error(
            "Saving reference measurement failed:",
            error
        );


        referenceScannerRunning = false;


        updateScannerStatus(
            "Reference save failed"
        );


        alert(
            error.message ||
            "Unable to save reference measurement."
        );


        clearWirelessState();

    }

}


// ============================================================
// MANUAL REFERENCE SAVE
// ============================================================

async function saveReferenceMeasurement() {

    if (!isOperator() && !isAdmin()) {

        alert(
            "Operator or administrator access required."
        );

        return;

    }


    const ageInput =
        document.getElementById(
            "referenceAge"
        );

    const genderInput =
        document.getElementById(
            "referenceGender"
        );

    const f0Input =
        document.getElementById(
            "referenceF0"
        );

    const rmsInput =
        document.getElementById(
            "referenceRMS"
        );

    const qInput =
        document.getElementById(
            "referenceQ"
        );

    const bandwidthInput =
        document.getElementById(
            "referenceBandwidth"
        );


    const age =
        parseInt(
            ageInput?.value,
            10
        );

    const gender =
        genderInput?.value.trim() ||
        "";

    const f0 =
        Number(
            f0Input?.value
        );

    const rms =
        Number(
            rmsInput?.value
        );

    const q =
        Number(
            qInput?.value
        );

    const bandwidth =
        Number(
            bandwidthInput?.value
        );


    if (
        !Number.isFinite(age) ||
        !gender ||
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(q) ||
        !Number.isFinite(bandwidth)
    ) {

        alert(
            "Please enter all reference measurement values."
        );

        return;

    }


    try {

        const {
            error
        } = await supabaseClient
            .from("reference_measurements")
            .insert({

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


        if (error) {
            throw error;
        }


        alert(
            "Reference measurement saved."
        );


        await loadAdminReferences();


    } catch (error) {

        console.error(
            "Manual reference save error:",
            error
        );

        alert(
            error.message ||
            "Unable to save reference measurement."
        );

    }

}


// ============================================================
// PATIENT DASHBOARD
// ============================================================

async function loadPatientDashboard() {

    console.log(
        "Loading patient dashboard..."
    );


    const linkingCodeElement =
        document.getElementById(
            "patientLinkingCode"
        );


    if (linkingCodeElement) {

        linkingCodeElement.value =
            "";

    }

}


// ============================================================
// PATIENT ACCESS USING LINKING CODE
// ============================================================

async function accessPatientResults() {

    const input =
        document.getElementById(
            "patientLinkingCode"
        );

    const message =
        document.getElementById(
            "patientAccessMessage"
        );


    const linkingCode =
        input
            ? input.value.trim().toUpperCase()
            : "";


    if (!linkingCode) {

        setMessage(
            message,
            "Enter your linking code.",
            "error"
        );

        return;

    }


    setMessage(
        message,
        "Loading measurements...",
        "info"
    );


    try {

        const {
            data,
            error
        } = await supabaseClient
            .rpc(
                "get_patient_results",
                {
                    p_linking_code:
                        linkingCode
                }
            );


        if (error) {
            throw error;
        }


        displayPatientResults(
            data || []
        );


        setMessage(
            message,
            "Results loaded.",
            "success"
        );


    } catch (error) {

        console.error(
            "Patient result access error:",
            error
        );

        setMessage(
            message,
            error.message ||
            "Unable to retrieve results.",
            "error"
        );

    }

}


// ============================================================
// DISPLAY PATIENT RESULTS
// ============================================================

function displayPatientResults(
    results
) {

    const container =
        document.getElementById(
            "patientResults"
        );


    if (!container) {
        return;
    }


    if (
        !results ||
        results.length === 0
    ) {

        container.innerHTML =
            "<p>No measurements available.</p>";

        return;

    }


    container.innerHTML =
        results.map(result => {

            return `
                <div class="patient-result-card">

                    <div>
                        <strong>
                            Acoustic Measurement
                        </strong>

                        <div>
                            Date:
                            ${formatDate(
                                result.created_at
                            )}
                        </div>

                        <div>
                            Side:
                            ${escapeHTML(
                                result.measurement_side ||
                                "—"
                            )}
                        </div>

                    </div>

                    <div>
                        <div>
                            Resonance Frequency:
                            <strong>
                                ${formatNumber(
                                    result.f0,
                                    2
                                )} Hz
                            </strong>
                        </div>

                        <div>
                            RMS:
                            <strong>
                                ${formatNumber(
                                    result.rms,
                                    3
                                )}
                            </strong>
                        </div>

                        <div>
                            Q Factor:
                            <strong>
                                ${formatNumber(
                                    result.q_factor,
                                    3
                                )}
                            </strong>
                        </div>

                        <div>
                            Bandwidth:
                            <strong>
                                ${formatNumber(
                                    result.bandwidth,
                                    2
                                )} Hz
                            </strong>
                        </div>
                    </div>

                </div>
            `;

        }).join("");

}


// ============================================================
// REFERENCE COMPARISON
// ============================================================

async function compareMeasurementWithReference(
    measurement
) {

    if (!measurement) {
        return null;
    }


    const age =
        currentPatient?.age;


    const gender =
        currentPatient?.gender;


    if (
        !Number.isFinite(
            Number(age)
        ) ||
        !gender
    ) {

        return {
            available: false,
            message:
                "Patient age or gender is unavailable."
        };

    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("reference_measurements")
            .select("*")
            .eq(
                "gender",
                gender
            )
            .gte(
                "age",
                Number(age) - 2
            )
            .lte(
                "age",
                Number(age) + 2
            );


        if (error) {
            throw error;
        }


        if (
            !data ||
            data.length < 2
        ) {

            return {
                available: false,
                message:
                    "Insufficient reference data."
            };

        }


        const metrics = [
            "f0",
            "rms",
            "q_factor",
            "bandwidth"
        ];


        const comparison = {};


        for (const metric of metrics) {

            const values =
                data
                    .map(
                        row =>
                            Number(
                                row[metric]
                            )
                    )
                    .filter(
                        Number.isFinite
                    );


            if (values.length < 2) {

                comparison[metric] = {
                    available: false
                };

                continue;

            }


            const mean =
                values.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) /
                values.length;


            const variance =
                values.reduce(
                    (sum, value) =>
                        sum +
                        Math.pow(
                            value - mean,
                            2
                        ),
                    0
                ) /
                (
                    values.length - 1
                );


            const sd =
                Math.sqrt(
                    variance
                );


            const measured =
                Number(
                    measurement[metric]
                );


            const deviation =
                mean !== 0
                    ? (
                        (
                            measured -
                            mean
                        ) /
                        mean
                    ) * 100
                    : null;


            const zScore =
                sd > 0
                    ? (
                        measured -
                        mean
                    ) /
                    sd
                    : null;


            comparison[metric] = {

                available:
                    Number.isFinite(
                        measured
                    ),

                measured:
                    measured,

                mean:
                    mean,

                sd:
                    sd,

                deviationPercent:
                    deviation,

                zScore:
                    zScore

            };

        }


        return {

            available:
                true,

            sampleCount:
                data.length,

            comparison

        };


    } catch (error) {

        console.error(
            "Reference comparison error:",
            error
        );


        return {

            available:
                false,

            message:
                "Reference comparison could not be completed."

        };

    }

}


// ============================================================
// UPDATE SCANNER STATUS
// ============================================================

function updateScannerStatus(
    message
) {

    const elements = [

        document.getElementById(
            "scannerStatus"
        ),

        document.getElementById(
            "operatorScannerStatus"
        )

    ];


    elements.forEach(element => {

        if (element) {

            element.textContent =
                message || "Ready";

        }

    });

}


// ============================================================
// SET SCANNER STATUS
// ============================================================

function setScannerStatus(
    message,
    type = "info"
) {

    updateScannerStatus(
        message
    );


    const element =
        document.getElementById(
            "scannerStatus"
        );


    if (element) {

        element.dataset.status =
            type;

    }

}


// ============================================================
// LEGACY ESP32 CONNECTION FUNCTIONS
//
// The actual scan communication is through Supabase.
// These functions are retained so the existing scanner
// connection section in index.html does not break.
//
// No USB / navigator.serial is used.
// ============================================================

async function connectESP32() {

    updateScannerStatus(
        "Checking scanner device..."
    );


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("scanner_devices")
            .select("*")
            .eq(
                "device_id",
                SCANNER_DEVICE_ID
            )
            .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {

            updateScannerStatus(
                "Scanner device not found"
            );

            alert(
                "ABS-001 was not found in scanner_devices."
            );

            return false;

        }


        if (data.is_active === false) {

            updateScannerStatus(
                "Scanner device inactive"
            );

            alert(
                "ABS-001 is marked inactive."
            );

            return false;

        }


        updateScannerStatus(
            "Scanner connected through Supabase"
        );


        return true;


    } catch (error) {

        console.error(
            "Scanner connection check failed:",
            error
        );


        updateScannerStatus(
            "Scanner connection check failed"
        );


        alert(
            error.message ||
            "Unable to check scanner."
        );


        return false;

    }

}


// ============================================================
// DISCONNECT ESP32
//
// No physical disconnect is performed because the ESP32
// communicates through Wi-Fi/Supabase.
// ============================================================

function disconnectESP32() {

    stopWirelessPolling();


    patientScannerRunning = false;
    referenceScannerRunning = false;


    clearWirelessState();


    updateScannerStatus(
        "Scanner disconnected"
    );

}


// ============================================================
// GET ESP32 BASE URL
//
// Kept only for compatibility with older HTML.
// Direct browser-to-ESP32 communication is NOT used.
// ============================================================

function getESP32BaseUrl() {

    return "";

}


// ============================================================
// WIRELESS REQUEST
//
// Intentionally disabled for direct browser-to-ESP32 calls.
// ESP32 communication is handled through Supabase.
// ============================================================

async function wirelessRequest() {

    throw new Error(
        "Direct ESP32 browser communication is not used. The scanner communicates through Supabase."
    );

}


// ============================================================
// LEGACY DIRECT-SCAN STATUS
// ============================================================

async function pollDirectESP32Status() {

    return null;

}


// ============================================================
// PATIENT MODAL
// ============================================================

function closePatientModal() {

    const modal =
        document.getElementById(
            "patientModal"
        );


    if (modal) {

        modal.style.display =
            "none";

    }

}


// ============================================================
// SCANNER STATUS HELPERS
// ============================================================

function scannerIsBusy() {

    return (
        patientScannerRunning ||
        referenceScannerRunning
    );

}


// ============================================================
// ADMIN CHECK
// ============================================================

function isAdmin() {

    return (
        String(
            currentProfile?.role || ""
        ).toUpperCase() ===
        "ADMIN"
    );

}


// ============================================================
// OPERATOR CHECK
// ============================================================

function isOperator() {

    return (
        String(
            currentProfile?.role || ""
        ).toUpperCase() ===
        "OPERATOR"
    );

}


// ============================================================
// SET MESSAGE
// ============================================================

function setMessage(
    elementOrId,
    message,
    type = "info"
) {

    const element =
        typeof elementOrId === "string"
            ? document.getElementById(
                elementOrId
            )
            : elementOrId;


    if (!element) {
        return;
    }


    element.textContent =
        message || "";


    element.dataset.type =
        type;


    element.classList.remove(
        "success",
        "error",
        "warning",
        "info"
    );


    element.classList.add(
        type
    );

}


// ============================================================
// FORMAT NUMBER
// ============================================================

function formatNumber(
    value,
    decimals = 2
) {

    const number =
        Number(value);


    if (!Number.isFinite(number)) {

        return "—";

    }


    return number.toFixed(
        decimals
    );

}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return date.toLocaleString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


// ============================================================
// NULLABLE NUMBER
// ============================================================

function toNullableNumber(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : null;

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(
    value
) {

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


// ============================================================
// DELAY
// ============================================================

function delay(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}


// ============================================================
// NAVIGATION HELPERS
// ============================================================

function showSection(
    sectionId
) {

    const sections =
        document.querySelectorAll(
            "[data-section]"
        );


    sections.forEach(section => {

        section.style.display =
            section.dataset.section ===
            sectionId
                ? ""
                : "none";

    });

}


// ============================================================
// REFRESH CURRENT DASHBOARD
// ============================================================

async function refreshDashboard() {

    if (!currentProfile) {
        return;
    }


    await loadDashboard();

}


// ============================================================
// CLOSE MODALS WHEN CLICKING OUTSIDE
// ============================================================

document.addEventListener(
    "click",
    event => {

        const patientModal =
            document.getElementById(
                "patientModal"
            );

        const adminModal =
            document.getElementById(
                "adminPatientModal"
            );


        if (
            patientModal &&
            event.target === patientModal
        ) {

            closePatientModal();

        }


        if (
            adminModal &&
            event.target === adminModal
        ) {

            closeAdminPatientModal();

        }

    }
);


// ============================================================
// KEYBOARD ESCAPE
// ============================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Escape"
        ) {
            return;
        }


        closePatientModal();

        closeAdminPatientModal();

    }
);


// ============================================================
// WINDOW EXPORTS
//
// Required because index.html uses onclick="..." handlers.
// ============================================================

window.login =
    login;

window.logout =
    logout;

window.loadDashboard =
    loadDashboard;

window.loadAdminDashboard =
    loadAdminDashboard;

window.loadOperatorDashboard =
    loadOperatorDashboard;

window.loadPatientDashboard =
    loadPatientDashboard;

window.loadAllUsers =
    loadAllUsers;

window.loadAllSubjects =
    loadAllSubjects;

window.loadAllScans =
    loadAllScans;

window.loadAdminReferences =
    loadAdminReferences;

window.loadScannerDevices =
    loadScannerDevices;

window.loadSubjects =
    loadSubjects;

window.createPatient =
    createPatient;

window.openAdminPatientModal =
    openAdminPatientModal;

window.closeAdminPatientModal =
    closeAdminPatientModal;

window.createAdminPatient =
    createAdminPatient;

window.deletePatient =
    deletePatient;

window.selectAdminPatient =
    selectAdminPatient;

window.selectPatient =
    selectPatient;

window.selectMeasurementSide =
    selectMeasurementSide;

window.startPatientScan =
    startPatientScan;

window.stopPatientScan =
    stopPatientScan;

window.cancelScanPreparation =
    cancelScanPreparation;

window.savePatientMeasurement =
    savePatientMeasurement;

window.generateScanId =
    generateScanId;

window.loadScans =
    loadScans;

window.deletePatientMeasurement =
    deletePatientMeasurement;

window.startReferenceScanner =
    startReferenceScanner;

window.saveReferenceMeasurement =
    saveReferenceMeasurement;

window.accessPatientResults =
    accessPatientResults;

window.compareMeasurementWithReference =
    compareMeasurementWithReference;

window.closePatientModal =
    closePatientModal;

window.connectESP32 =
    connectESP32;

window.disconnectESP32 =
    disconnectESP32;

window.getESP32BaseUrl =
    getESP32BaseUrl;

window.wirelessRequest =
    wirelessRequest;

window.refreshDashboard =
    refreshDashboard;

window.showSection =
    showSection;


// ============================================================
// END OF APP.JS
// ============================================================
