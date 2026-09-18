// ============================================================
// GROUP 4 - LOW-COST ACOUSTIC BONE SCANNER
// COMPLETE WEBSITE APPLICATION
// app.js
//
// Frontend:
//     HTML + JavaScript
//
// Database:
//     Supabase
//
// Hardware:
//     ESP32 Wi-Fi API
//
// Roles:
//     ADMIN
//     OPERATOR
//     PATIENT (linking-code access only)
//
// IMPORTANT:
//     This system is an academic/research prototype.
//     It does NOT provide a clinical diagnosis.
// ============================================================


// ============================================================
// SUPABASE CONFIGURATION
// ============================================================
//
// KEEP YOUR EXISTING VALUES HERE.
//
// Do NOT use a Supabase service-role/secret key in frontend code.
//
const SUPABASE_URL =
    "https://ropiudyalwarmowaiugu.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";


const { createClient } = window.supabase;

const supabaseClient =
    createClient(
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

let esp32Connected = false;

let esp32BaseUrl =
    localStorage.getItem("esp32BaseUrl") || "";

let wirelessPollTimer = null;

let dashboardLoading = false;
let dashboardLoadQueued = false;


// ============================================================
// SAFE DOM HELPER
// ============================================================

function el(id) {
    return document.getElementById(id);
}


// ============================================================
// DOM READY
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        try {

            const {
                data,
                error
            } =
                await supabaseClient.auth.getSession();

            if (error) {

                console.error(
                    "Session error:",
                    error
                );

                showLogin();
                return;
            }


            if (data && data.session) {

                currentUser =
                    data.session.user;

                await loadDashboard();

            } else {

                showLogin();

            }

        } catch (error) {

            console.error(
                "Startup error:",
                error
            );

            showLogin();

        }

    }
);


// ============================================================
// AUTH STATE LISTENER
// ============================================================
//
// IMPORTANT:
// Do not blindly call loadDashboard() on every event.
// Supabase can emit multiple auth events.
//
supabaseClient.auth.onAuthStateChange(
    async function (event, session) {

        try {

            if (event === "SIGNED_OUT") {

                currentUser = null;
                currentProfile = null;

                currentPatient = null;
                currentMeasurementSide = null;

                stopWirelessPolling();

                showLogin();

                return;
            }


            if (
                event === "SIGNED_IN" ||
                event === "INITIAL_SESSION" ||
                event === "TOKEN_REFRESHED"
            ) {

                if (!session) {
                    return;
                }

                currentUser =
                    session.user;

                // Prevent duplicate dashboard loads.
                if (dashboardLoading) {

                    dashboardLoadQueued = true;

                    return;
                }

                await loadDashboard();

            }

        } catch (error) {

            console.error(
                "Auth state error:",
                error
            );

        }

    }
);


// ============================================================
// LOGIN SCREEN
// ============================================================

function showLogin() {

    const loginScreen = el("loginScreen");
    const dashboard = el("dashboard");
    const resultScreen = el("patientResultScreen");

    if (loginScreen) {
        loginScreen.classList.remove("hidden");
    }

    if (dashboard) {
        dashboard.classList.add("hidden");
    }

    if (resultScreen) {
        resultScreen.classList.add("hidden");
    }

}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const emailElement =
        el("loginEmail");

    const passwordElement =
        el("loginPassword");

    const message =
        el("loginMessage");


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
            message,
            "Please enter email and password.",
            "error"
        );

        return;
    }


    setMessage(
        message,
        "Logging in...",
        "info"
    );


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth
                .signInWithPassword({
                    email,
                    password
                });


        if (error) {

            console.error(
                "Login error:",
                error
            );

            setMessage(
                message,
                error.message,
                "error"
            );

            return;
        }


        currentUser =
            data.user;


        await loadDashboard();

    } catch (error) {

        console.error(
            "Login exception:",
            error
        );

        setMessage(
            message,
            "Login failed. Please try again.",
            "error"
        );

    }

}


// ============================================================
// LOAD DASHBOARD
// ============================================================
//
// This is the important fix for the repeated:
//
//     Loading operator dashboard...
//
// loadDashboard() must be the top-level dashboard loader.
// loadOperatorDashboard() must NEVER call loadDashboard().
//
async function loadDashboard() {

    if (dashboardLoading) {

        dashboardLoadQueued = true;

        console.log(
            "Dashboard load already running. Queueing one refresh."
        );

        return;
    }


    dashboardLoading = true;
    dashboardLoadQueued = false;


    try {

        if (!currentUser) {

            const {
                data
            } =
                await supabaseClient.auth.getUser();

            currentUser =
                data
                    ? data.user
                    : null;
        }


        if (!currentUser) {

            showLogin();
            return;
        }


        console.log(
            "Loading profile for:",
            currentUser.email
        );


        const profile =
            await loadProfile();


        if (!profile) {

            setMessage(
                el("loginMessage"),
                "Your profile could not be loaded.",
                "error"
            );

            showLogin();

            return;
        }


        currentProfile =
            profile;


        const loginScreen =
            el("loginScreen");

        const dashboard =
            el("dashboard");

        const patientResultScreen =
            el("patientResultScreen");


        if (loginScreen) {
            loginScreen.classList.add("hidden");
        }

        if (patientResultScreen) {
            patientResultScreen.classList.add("hidden");
        }

        if (dashboard) {
            dashboard.classList.remove("hidden");
        }


        const adminDashboard =
            el("adminDashboard");

        const operatorDashboard =
            el("operatorDashboard");


        if (adminDashboard) {
            adminDashboard.classList.add("hidden");
        }

        if (operatorDashboard) {
            operatorDashboard.classList.add("hidden");
        }


        const userInfo =
            el("userInfo");


        if (userInfo) {

            userInfo.textContent =
                `${profile.full_name || profile.email || currentUser.email} | Role: ${String(profile.role || "").toUpperCase()}`;

        }


        const role =
            String(profile.role || "")
                .toLowerCase();


        console.log(
            "Current profile:",
            profile
        );


        if (role === "admin") {

            if (adminDashboard) {
                adminDashboard.classList.remove("hidden");
            }

            await loadAdminDashboard();

        }

        else if (role === "operator") {

            if (operatorDashboard) {
                operatorDashboard.classList.remove("hidden");
            }

            await loadOperatorDashboard();

        }

        else {

            console.error(
                "Unknown profile role:",
                profile.role
            );

            setMessage(
                el("loginMessage"),
                "Your account role is not configured correctly.",
                "error"
            );

            await supabaseClient.auth.signOut();

        }


    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        setMessage(
            el("loginMessage"),
            "Unable to load the dashboard.",
            "error"
        );

    } finally {

        dashboardLoading = false;


        // If an auth event happened while loading,
        // perform one additional refresh only.
        if (dashboardLoadQueued) {

            dashboardLoadQueued = false;

            setTimeout(
                function () {
                    loadDashboard();
                },
                50
            );

        }

    }

}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {

    if (!currentUser) {
        return null;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();


    if (error) {

        console.error(
            "Profile error:",
            error
        );

        return null;
    }


    return data;

}


// ============================================================
// ADMIN DASHBOARD
// ============================================================

async function loadAdminDashboard() {

    console.log(
        "Loading admin dashboard..."
    );


    await loadAllUsers();
    await loadAllSubjects();
    await loadAllScans();
    await loadAdminReferences();
    await loadScannerDevices();

}


// ============================================================
// ADMIN USERS
// ============================================================

async function loadAllUsers() {

    if (!isAdmin()) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Users error:",
            error
        );

        return;
    }


    const table =
        el("adminUsersTable");


    if (table) {

        table.innerHTML = "";

        let operatorCount = 0;


        data.forEach(
            function (user) {

                if (
                    String(user.role).toLowerCase() ===
                    "operator"
                ) {
                    operatorCount++;
                }


                const row =
                    document.createElement("tr");


                row.innerHTML = `
                    <td>
                        ${escapeHTML(user.email || "")}
                    </td>

                    <td>
                        ${escapeHTML(user.full_name || "")}
                    </td>

                    <td>
                        ${escapeHTML(user.role || "")}
                    </td>

                    <td>
                        ${formatDate(user.created_at)}
                    </td>
                `;


                table.appendChild(row);

            }
        );


        const count =
            el("adminUsers");

        if (count) {
            count.textContent =
                operatorCount;
        }

    }

}


// ============================================================
// ADMIN PATIENTS
// ============================================================

async function loadAllSubjects() {

    if (!isAdmin()) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("subjects")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Admin patients error:",
            error
        );

        return;
    }


    const count =
        el("adminSubjects");

    if (count) {
        count.textContent =
            data.length;
    }


    const container =
        el("adminSubjectsList");


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (!data.length) {

        container.innerHTML =
            `
            <div class="empty">
                No patients registered.
            </div>
            `;

        return;
    }


    data.forEach(
        function (patient) {

            const div =
                document.createElement("div");

            div.className =
                "patient-card";


            const patientId =
                patient.patient_id ||
                patient.subject_id ||
                "";


            div.innerHTML = `
                <h3>
                    ${escapeHTML(
                        patient.name ||
                        "Unnamed Patient"
                    )}
                </h3>

                <p>
                    Patient ID:
                    ${escapeHTML(patientId)}
                </p>

                <p>
                    Age:
                    ${escapeHTML(
                        patient.age ?? ""
                    )}
                </p>

                <p>
                    Gender:
                    ${escapeHTML(
                        patient.gender || ""
                    )}
                </p>

                <p>
                    Linking Code:
                    <strong>
                        ${escapeHTML(
                            patient.linking_code || ""
                        )}
                    </strong>
                </p>

                <p>
                    Created:
                    ${formatDate(
                        patient.created_at
                    )}
                </p>

                <button
                    class="danger"
                    onclick="deletePatient('${escapeHTML(patient.id)}')"
                >
                    Delete Patient
                </button>
            `;


            container.appendChild(div);

        }
    );

}


// ============================================================
// ADMIN CREATE PATIENT MODAL
// ============================================================

function openAdminPatientModal() {

    const modal =
        el("adminPatientModal");

    if (modal) {
        modal.classList.remove("hidden");
    }

}


function closeAdminPatientModal() {

    const modal =
        el("adminPatientModal");

    if (modal) {
        modal.classList.add("hidden");
    }

}


// ============================================================
// ADMIN CREATE PATIENT
// ============================================================

async function createAdminPatient() {

    if (!isAdmin()) {

        alert(
            "Only an admin can create patients from this section."
        );

        return;
    }


    const name =
        el("adminSubjectName")
            ? el("adminSubjectName").value.trim()
            : "";


    const age =
        el("adminSubjectAge")
            ? parseInt(
                el("adminSubjectAge").value,
                10
            )
            : NaN;


    const gender =
        el("adminSubjectGender")
            ? el("adminSubjectGender").value
            : "";


    const message =
        el("adminSubjectMessage");


    if (
        !name ||
        !Number.isInteger(age) ||
        age < 1 ||
        age > 120 ||
        !gender
    ) {

        setMessage(
            message,
            "Please enter a valid name, age and gender.",
            "error"
        );

        return;
    }


    try {

        const patientId =
            generatePatientId();


        const linkingCode =
            await generateUniqueLinkingCode();


        const {
            data,
            error
        } =
            await supabaseClient
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

            console.error(
                "Admin patient creation error:",
                error
            );

            setMessage(
                message,
                error.message,
                "error"
            );

            return;
        }


        const info =
            el("createdPatientInfo");


        if (info) {

            info.innerHTML = `
                <p>
                    Patient has been registered successfully.
                </p>

                <p>
                    Patient ID:
                </p>

                <div class="code-display">
                    ${escapeHTML(
                        data.patient_id ||
                        patientId
                    )}
                </div>

                <p>
                    Patient Linking Code:
                </p>

                <div class="code-display">
                    ${escapeHTML(
                        linkingCode
                    )}
                </div>

                <p>
                    Give this linking code to the patient.
                </p>
            `;

        }


        const patientModal =
            el("patientModal");

        if (patientModal) {
            patientModal.classList.remove("hidden");
        }


        setMessage(
            message,
            "Patient registered successfully.",
            "success"
        );


        if (el("adminSubjectName")) {
            el("adminSubjectName").value = "";
        }

        if (el("adminSubjectAge")) {
            el("adminSubjectAge").value = "";
        }

        if (el("adminSubjectGender")) {
            el("adminSubjectGender").value = "";
        }


        await loadAllSubjects();

    } catch (error) {

        console.error(
            "Admin patient exception:",
            error
        );

        setMessage(
            message,
            "Could not create patient.",
            "error"
        );

    }

}


// ============================================================
// OPERATOR DASHBOARD
// ============================================================
//
// IMPORTANT:
// This function does NOT call loadDashboard().
// This prevents the recursive/repeated dashboard problem.
//
async function loadOperatorDashboard() {

    console.log(
        "Loading operator dashboard..."
    );


    await loadSubjects();
    await loadScans();
    await loadReferenceGroups();

}


// ============================================================
// OPERATOR PATIENTS
// ============================================================

async function loadSubjects() {

    if (!isOperator()) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("subjects")
            .select("*")
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Operator patients error:",
            error
        );

        const container =
            el("subjectsList");

        if (container) {

            container.innerHTML =
                `
                <div class="empty">
                    Unable to load patients.
                </div>
                `;

        }

        return;
    }


    const container =
        el("subjectsList");


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (!data || !data.length) {

        container.innerHTML =
            `
            <div class="empty">
                No patients registered yet.
            </div>
            `;

        return;
    }


    data.forEach(
        function (patient) {

            const div =
                document.createElement("div");

            div.className =
                "patient-card";


            const patientId =
                patient.patient_id ||
                patient.subject_id ||
                "";


            div.innerHTML = `
                <h3>
                    ${escapeHTML(
                        patient.name ||
                        "Unnamed Patient"
                    )}
                </h3>

                <p>
                    Patient ID:
                    ${escapeHTML(patientId)}
                </p>

                <p>
                    Age:
                    ${escapeHTML(
                        patient.age ?? ""
                    )}
                </p>

                <p>
                    Gender:
                    ${escapeHTML(
                        patient.gender || ""
                    )}
                </p>

                <p>
                    Linking Code:
                    <strong>
                        ${escapeHTML(
                            patient.linking_code || ""
                        )}
                    </strong>
                </p>

                <button
                    onclick='selectPatient(${JSON.stringify(patient).replace(/'/g, "&#39;")})'
                >
                    Select for Scan
                </button>
            `;


            container.appendChild(div);

        }
    );

}


// ============================================================
// OPERATOR CREATE PATIENT
// ============================================================

async function createPatient() {

    if (!isOperator()) {

        alert(
            "Only an operator can create patients."
        );

        return;
    }


    const name =
        el("subjectName")
            ? el("subjectName").value.trim()
            : "";


    const age =
        el("subjectAge")
            ? parseInt(
                el("subjectAge").value,
                10
            )
            : NaN;


    const gender =
        el("subjectGender")
            ? el("subjectGender").value
            : "";


    const message =
        el("subjectMessage");


    if (
        !name ||
        !Number.isInteger(age) ||
        age < 1 ||
        age > 120 ||
        !gender
    ) {

        setMessage(
            message,
            "Please fill in all patient details correctly.",
            "error"
        );

        return;
    }


    try {

        const patientId =
            generatePatientId();


        const linkingCode =
            await generateUniqueLinkingCode();


        const {
            data,
            error
        } =
            await supabaseClient
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

            console.error(
                "Patient creation error:",
                error
            );

            setMessage(
                message,
                error.message,
                "error"
            );

            return;
        }


        const info =
            el("createdPatientInfo");


        if (info) {

            info.innerHTML = `
                <p>
                    Patient has been registered successfully.
                </p>

                <p>
                    Patient ID:
                </p>

                <div class="code-display">
                    ${escapeHTML(
                        data.patient_id ||
                        patientId
                    )}
                </div>

                <p>
                    Patient Linking Code:
                </p>

                <div class="code-display">
                    ${escapeHTML(
                        linkingCode
                    )}
                </div>

                <p>
                    Give this linking code to the patient
                    so they can view their results.
                </p>
            `;

        }


        const modal =
            el("patientModal");

        if (modal) {
            modal.classList.remove("hidden");
        }


        if (el("subjectName")) {
            el("subjectName").value = "";
        }

        if (el("subjectAge")) {
            el("subjectAge").value = "";
        }

        if (el("subjectGender")) {
            el("subjectGender").value = "";
        }


        setMessage(
            message,
            "Patient registered successfully.",
            "success"
        );


        await loadSubjects();

    } catch (error) {

        console.error(
            "Create patient exception:",
            error
        );

        setMessage(
            message,
            "Could not create patient.",
            "error"
        );

    }

}


// ============================================================
// PATIENT ID
// ============================================================

function generatePatientId() {

    const random =
        Math.floor(
            10000 +
            Math.random() * 90000
        );


    return `PAT-${random}`;

}


// ============================================================
// UNIQUE LINKING CODE
// ============================================================
//
// Six numeric digits are retained because your current HTML
// and patient access screen are designed around a 6-digit code.
//
async function generateUniqueLinkingCode() {

    for (
        let attempt = 0;
        attempt < 30;
        attempt++
    ) {

        const code =
            String(
                Math.floor(
                    100000 +
                    Math.random() * 900000
                )
            );


        const {
            data,
            error
        } =
            await supabaseClient
                .from("subjects")
                .select("id")
                .eq(
                    "linking_code",
                    code
                )
                .limit(1);


        if (error) {

            console.error(
                "Linking code check error:",
                error
            );

            continue;
        }


        if (
            !data ||
            data.length === 0
        ) {

            return code;

        }

    }


    throw new Error(
        "Could not generate a unique patient linking code."
    );

}


// ============================================================
// SELECT PATIENT
// ============================================================

function selectPatient(patient) {

    if (!isOperator()) {

        alert(
            "Only an operator can select a patient for scanning."
        );

        return;
    }


    if (!patient || !patient.id) {

        alert(
            "Invalid patient."
        );

        return;
    }


    currentPatient =
        patient;

    currentMeasurementSide =
        null;


    const preparation =
        el("scanPreparation");


    if (preparation) {
        preparation.classList.remove("hidden");
    }


    const selectedInfo =
        el("selectedPatientInfo");


    if (selectedInfo) {

        selectedInfo.innerHTML = `
            <div class="patient-card selected-patient">

                <h3>
                    ${escapeHTML(
                        patient.name || ""
                    )}
                </h3>

                <p>
                    Patient ID:
                    ${escapeHTML(
                        patient.patient_id ||
                        patient.subject_id ||
                        ""
                    )}
                </p>

                <p>
                    Age:
                    ${escapeHTML(
                        patient.age ?? ""
                    )}
                </p>

                <p>
                    Gender:
                    ${escapeHTML(
                        patient.gender || ""
                    )}
                </p>

            </div>
        `;

    }


    const sideText =
        el("selectedSideText");

    if (sideText) {
        sideText.textContent =
            "No side selected.";
    }


    const leftButton =
        el("leftSideButton");

    const rightButton =
        el("rightSideButton");


    if (leftButton) {
        leftButton.classList.remove("selected");
    }

    if (rightButton) {
        rightButton.classList.remove("selected");
    }


    if (preparation) {

        preparation.scrollIntoView({
            behavior: "smooth"
        });

    }

}


// ============================================================
// MEASUREMENT SIDE
// ============================================================

function selectMeasurementSide(side) {

    if (!currentPatient) {

        alert(
            "Please select a patient first."
        );

        return;
    }


    if (
        side !== "Left" &&
        side !== "Right"
    ) {

        alert(
            "Please select Left or Right."
        );

        return;
    }


    currentMeasurementSide =
        side;


    const sideText =
        el("selectedSideText");

    if (sideText) {

        sideText.textContent =
            `Selected measurement side: ${side}`;

    }


    const leftButton =
        el("leftSideButton");

    const rightButton =
        el("rightSideButton");


    if (leftButton) {
        leftButton.classList.remove("selected");
    }

    if (rightButton) {
        rightButton.classList.remove("selected");
    }


    if (side === "Left" && leftButton) {
        leftButton.classList.add("selected");
    }


    if (side === "Right" && rightButton) {
        rightButton.classList.add("selected");
    }

}


// ============================================================
// ESP32 BASE URL
// ============================================================

function getESP32BaseUrl() {

    const input =
        el("esp32BaseUrl");


    let url =
        input
            ? input.value.trim()
            : esp32BaseUrl;


    if (!url) {

        url =
            "http://192.168.4.1";

    }


    url =
        url.replace(
            /\/+$/,
            ""
        );


    return url;

}


// ============================================================
// ESP32 REQUEST
// ============================================================

async function wirelessRequest(
    path,
    options = {},
    timeout = 8000
) {

    const baseUrl =
        getESP32BaseUrl();


    const controller =
        new AbortController();


    const timer =
        setTimeout(
            function () {
                controller.abort();
            },
            timeout
        );


    try {

        const response =
            await fetch(
                `${baseUrl}${path}`,
                {
                    ...options,

                    cache:
                        "no-store",

                    signal:
                        controller.signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `ESP32 HTTP ${response.status}`
            );

        }


        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            contentType.includes(
                "application/json"
            )
        ) {

            return await response.json();

        }


        const text =
            await response.text();


        try {

            return JSON.parse(text);

        } catch {

            return {
                text
            };

        }

    } finally {

        clearTimeout(timer);

    }

}


// ============================================================
// CONNECT ESP32
// ============================================================

async function connectESP32() {

    const status =
        el("scannerStatus");


    try {

        const url =
            getESP32BaseUrl();


        esp32BaseUrl =
            url;


        localStorage.setItem(
            "esp32BaseUrl",
            url
        );


        setScannerStatus(
            "Connecting to ESP32..."
        );


        const result =
            await wirelessRequest(
                "/api/status",
                {
                    method: "GET"
                },
                5000
            );


        if (
            result &&
            result.active === false
        ) {

            setScannerStatus(
                "ESP32 connected, but scanner device is inactive."
            );

            esp32Connected =
                false;

            return;
        }


        esp32Connected =
            true;


        const deviceId =
            (
                result &&
                (
                    result.device_id ||
                    result.scanner_id
                )
            ) ||
            "ABS-001";


        setScannerStatus(
            `ESP32 Connected | Scanner: ${deviceId}`
        );


        if (status) {

            status.dataset.deviceId =
                deviceId;

        }


    } catch (error) {

        console.error(
            "ESP32 connection error:",
            error
        );

        esp32Connected =
            false;


        setScannerStatus(
            "ESP32 Not Connected"
        );


        alert(
            "Could not connect to the ESP32.\n\n" +
            "Check that the ESP32 is powered on, connected to Wi-Fi, " +
            "and that the Base URL is correct."
        );

    }

}


// ============================================================
// DISCONNECT ESP32
// ============================================================

async function disconnectESP32() {

    stopWirelessPolling();


    if (patientScannerRunning) {

        try {

            await wirelessRequest(
                "/api/scan/stop",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            command:
                                "stop_scan"
                        })
                },
                5000
            );

        } catch (error) {

            console.warn(
                "ESP32 stop during disconnect failed:",
                error
            );

        }

    }


    patientScannerRunning =
        false;

    referenceScannerRunning =
        false;

    esp32Connected =
        false;


    setScannerStatus(
        "ESP32 Not Connected"
    );


    const operatorStatus =
        el("operatorScannerStatus");

    if (operatorStatus) {

        operatorStatus.textContent =
            "Scanner status: Disconnected.";

    }

}


// ============================================================
// SCANNER STATUS
// ============================================================

function setScannerStatus(text) {

    const scannerStatus =
        el("scannerStatus");


    if (scannerStatus) {
        scannerStatus.textContent =
            text;
    }


    const operatorStatus =
        el("operatorScannerStatus");


    if (operatorStatus) {
        operatorStatus.textContent =
            `Scanner status: ${text}`;
    }

}


// ============================================================
// START PATIENT SCAN
// ============================================================

async function startPatientScan() {

    if (!isOperator()) {

        alert(
            "Only an operator can start a patient scan."
        );

        return;
    }


    if (!currentPatient) {

        alert(
            "Please select a patient."
        );

        return;
    }


    if (!currentMeasurementSide) {

        alert(
            "Please select Left or Right measurement side."
        );

        return;
    }


    if (!esp32Connected) {

        alert(
            "Please connect the ESP32 first."
        );

        return;
    }


    if (patientScannerRunning) {

        alert(
            "A patient scan is already running."
        );

        return;
    }


    try {

        patientScannerRunning =
            true;


        setScannerStatus(
            "Starting acoustic scan..."
        );


        const payload = {

            command:
                "start_scan",

            mode:
                "patient",

            subject_id:
                currentPatient.id,

            side:
                currentMeasurementSide,

            measurement_side:
                currentMeasurementSide,

            device_id:
                "ABS-001"

        };


        const result =
            await wirelessRequest(
                "/api/scan/start",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)
                },
                8000
            );


        console.log(
            "ESP32 scan start:",
            result
        );


        setScannerStatus(
            "Scanning..."
        );


        startWirelessScanPolling();


    } catch (error) {

        console.error(
            "Start patient scan error:",
            error
        );


        patientScannerRunning =
            false;


        setScannerStatus(
            "Unable to start scan."
        );


        alert(
            "Could not start the acoustic scan.\n\n" +
            error.message
        );

    }

}


// ============================================================
// STOP PATIENT SCAN
// ============================================================

async function stopPatientScan() {

    stopWirelessPolling();


    if (!patientScannerRunning) {

        setScannerStatus(
            "No active scan."
        );

        return;
    }


    try {

        await wirelessRequest(
            "/api/scan/stop",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        command:
                            "stop_scan"
                    })
            },
            5000
        );


    } catch (error) {

        console.error(
            "Stop scan error:",
            error
        );

    }


    patientScannerRunning =
        false;


    setScannerStatus(
        "Scan stopped."
    );

}


// ============================================================
// START WIRELESS POLLING
// ============================================================

function startWirelessScanPolling() {

    stopWirelessPolling();


    wirelessPollTimer =
        setInterval(
            async function () {

                await pollWirelessScanStatus();

            },
            700
        );

}


// ============================================================
// STOP WIRELESS POLLING
// ============================================================

function stopWirelessPolling() {

    if (wirelessPollTimer) {

        clearInterval(
            wirelessPollTimer
        );

        wirelessPollTimer =
            null;

    }

}


// ============================================================
// POLL ESP32 SCAN STATUS
// ============================================================

async function pollWirelessScanStatus() {

    if (
        !patientScannerRunning &&
        !referenceScannerRunning
    ) {

        return;
    }


    try {

        const result =
            await wirelessRequest(
                "/api/scan/status",
                {
                    method: "GET"
                },
                5000
            );


        console.log(
            "ESP32 scan status:",
            result
        );


        if (!result) {
            return;
        }


        const status =
            String(
                result.status ||
                ""
            ).toLowerCase();


        const progress =
            Number(
                result.progress
            );


        const frequency =
            Number(
                result.frequency
            );


        if (
            Number.isFinite(progress)
        ) {

            setScannerStatus(
                `Scanning... ${Math.round(progress)}%`
            );

        }


        if (
            Number.isFinite(frequency)
        ) {

            const statusText =
                Number.isFinite(progress)
                    ? `Scanning... ${Math.round(progress)}% | ${Math.round(frequency)} Hz`
                    : `Scanning... ${Math.round(frequency)} Hz`;


            setScannerStatus(
                statusText
            );

        }


        let finalResult =
            null;


        if (
            result.result &&
            typeof result.result === "object"
        ) {

            finalResult =
                result.result;

        }

        else if (
            result.data &&
            typeof result.data === "object" &&
            (
                result.data.f0 !== undefined ||
                result.data.rms !== undefined
            )
        ) {

            finalResult =
                result.data;

        }

        else if (
            result.f0 !== undefined ||
            result.rms !== undefined
        ) {

            finalResult =
                result;

        }


        const resultType =
            String(
                result.type ||
                ""
            ).toLowerCase();


        if (
            finalResult &&
            (
                resultType === "scan_result" ||
                resultType === "result" ||
                status === "complete" ||
                status === "completed" ||
                finalResult.f0 !== undefined
            )
        ) {

            stopWirelessPolling();


            if (patientScannerRunning) {

                patientScannerRunning =
                    false;


                await validateAndSaveWirelessResult(
                    finalResult
                );

            }

            else if (referenceScannerRunning) {

                referenceScannerRunning =
                    false;


                await validateAndSaveWirelessReferenceResult(
                    finalResult
                );

            }


            return;
        }


        if (
            status === "stopped" ||
            status === "cancelled" ||
            status === "aborted"
        ) {

            stopWirelessPolling();


            patientScannerRunning =
                false;

            referenceScannerRunning =
                false;


            setScannerStatus(
                "Scan stopped."
            );

        }


    } catch (error) {

        console.error(
            "Wireless scan polling error:",
            error
        );

    }

}


// ============================================================
// VALIDATE AND SAVE PATIENT RESULT
// ============================================================

async function validateAndSaveWirelessResult(result) {

    try {

        if (!result) {

            throw new Error(
                "Scanner result is missing."
            );

        }


        const f0 =
            Number(result.f0);

        const rms =
            Number(result.rms);

        const qFactor =
            Number(result.q_factor);

        const bandwidth =
            Number(result.bandwidth);


        if (!Number.isFinite(f0)) {

            throw new Error(
                "Scanner result is missing F₀."
            );

        }


        if (!Number.isFinite(rms)) {

            throw new Error(
                "Scanner result is missing RMS."
            );

        }


        if (!Number.isFinite(qFactor)) {

            throw new Error(
                "Scanner result is missing Q-factor."
            );

        }


        if (!Number.isFinite(bandwidth)) {

            throw new Error(
                "Scanner result is missing bandwidth."
            );

        }


        setScannerStatus(
            "Scan complete. Saving measurement..."
        );


        const saved =
            await savePatientMeasurement({

                ...result,

                f0:
                    f0,

                rms:
                    rms,

                q_factor:
                    qFactor,

                bandwidth:
                    bandwidth

            });


        setScannerStatus(
            "Scan Complete - Measurement Saved"
        );


        alert(
            "Acoustic scan completed successfully.\n\n" +
            `F₀: ${formatNumber(saved.f0)} Hz\n` +
            `RMS: ${formatNumber(saved.rms)}\n` +
            `Q-factor: ${formatNumber(saved.q_factor)}\n` +
            `Bandwidth: ${formatNumber(saved.bandwidth)} Hz`
        );


        await loadScans();


    } catch (error) {

        console.error(
            "Wireless result validation/save error:",
            error
        );


        setScannerStatus(
            "Scan completed, but measurement could not be saved."
        );


        alert(
            "The scanner returned a result, but it could not be saved.\n\n" +
            error.message
        );

    }

}


// ============================================================
// SAVE PATIENT MEASUREMENT
// ============================================================

async function savePatientMeasurement(result) {

    if (!isOperator()) {

        throw new Error(
            "Only an operator can save a patient measurement."
        );

    }


    if (!currentPatient) {

        throw new Error(
            "No patient selected."
        );

    }


    if (!currentMeasurementSide) {

        throw new Error(
            "No measurement side selected."
        );

    }


    const f0 =
        Number(result.f0);

    const rms =
        Number(result.rms);

    const qFactor =
        Number(result.q_factor);

    const bandwidth =
        Number(result.bandwidth);


    if (
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(qFactor) ||
        !Number.isFinite(bandwidth)
    ) {

        throw new Error(
            "Invalid scanner measurement."
        );

    }


    const scanId =
        result.scan_id ||
        generateScanId();


    const insertData = {

        scan_id:
            scanId,

        f0:
            f0,

        rms:
            rms,

        q_factor:
            qFactor,

        bandwidth:
            bandwidth,

        user_id:
            currentUser.id,

        subject_id:
            currentPatient.id,

        measurement_side:
            currentMeasurementSide,

        frequency_start:
            Number.isFinite(
                Number(result.frequency_start)
            )
                ? Number(result.frequency_start)
                : 200,

        frequency_end:
            Number.isFinite(
                Number(result.frequency_end)
            )
                ? Number(result.frequency_end)
                : 1200,

        frequency_step:
            Number.isFinite(
                Number(result.frequency_step)
            )
                ? Number(result.frequency_step)
                : 25,

        sensor_head_id:
            result.sensor_head_id ??
            null,

        reference_group_id:
            result.reference_group_id ??
            null,

        f0_deviation:
            result.f0_deviation ??
            null,

        rms_deviation:
            result.rms_deviation ??
            null,

        q_deviation:
            result.q_deviation ??
            null,

        bandwidth_deviation:
            result.bandwidth_deviation ??
            null,

        f0_zscore:
            result.f0_zscore ??
            null,

        rms_zscore:
            result.rms_zscore ??
            null,

        q_zscore:
            result.q_zscore ??
            null,

        bandwidth_zscore:
            result.bandwidth_zscore ??
            null,

        comparison_status:
            result.comparison_status ??
            null,

        notes:
            result.notes ??
            null

    };


    const {
        data,
        error
    } =
        await supabaseClient
            .from("scan_measurements")
            .insert(insertData)
            .select()
            .single();


    if (error) {

        console.error(
            "Saving patient measurement failed:",
            error
        );

        throw error;
    }


    return data;

}


// ============================================================
// SCAN ID
// ============================================================

function generateScanId() {

    const timestamp =
        Date.now()
            .toString()
            .slice(-10);


    const random =
        Math.floor(
            100 +
            Math.random() * 900
        );


    return `SCAN-${timestamp}-${random}`;

}


// ============================================================
// CANCEL SCAN PREPARATION
// ============================================================

function cancelScanPreparation() {

    currentPatient =
        null;

    currentMeasurementSide =
        null;

    patientScannerRunning =
        false;


    stopWirelessPolling();


    const preparation =
        el("scanPreparation");


    if (preparation) {

        preparation.classList.add(
            "hidden"
        );

    }

}


// ============================================================
// OPERATOR SCANS
// ============================================================

async function loadScans() {

    if (!isOperator()) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("scan_measurements")
            .select(`
                *,
                subjects (
                    name,
                    patient_id,
                    subject_id
                )
            `)
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Operator scans error:",
            error
        );

        return;
    }


    const table =
        el("scansList");


    if (!table) {
        return;
    }


    table.innerHTML = "";


    if (!data || !data.length) {

        table.innerHTML =
            `
            <tr>
                <td colspan="10">
                    No patient measurements found.
                </td>
            </tr>
            `;

        return;
    }


    data.forEach(
        function (scan) {

            const patient =
                scan.subjects ||
                {};


            const row =
                document.createElement("tr");


            row.innerHTML = `
                <td>
                    ${escapeHTML(
                        scan.scan_id || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        patient.name || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        scan.measurement_side || ""
                    )}
                </td>

                <td>
                    ${formatNumber(scan.f0)}
                </td>

                <td>
                    ${formatNumber(scan.rms)}
                </td>

                <td>
                    ${formatNumber(
                        scan.q_factor
                    )}
                </td>

                <td>
                    ${formatNumber(
                        scan.bandwidth
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        scan.comparison_status ||
                        ""
                    )}
                </td>

                <td>
                    ${formatDate(
                        scan.created_at
                    )}
                </td>

                <td>
                    <button
                        class="danger"
                        onclick="deletePatientMeasurement('${escapeHTML(scan.id)}')"
                    >
                        Delete
                    </button>
                </td>
            `;


            table.appendChild(row);

        }
    );

}


// ============================================================
// ADMIN ALL SCANS
// ============================================================

async function loadAllScans() {

    if (!isAdmin()) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("scan_measurements")
            .select(`
                *,
                subjects (
                    name,
                    patient_id,
                    subject_id
                )
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Admin scan error:",
            error
        );

        return;
    }


    const count =
        el("adminScans");

    if (count) {
        count.textContent =
            data.length;
    }


    const table =
        el("adminScansTable");


    if (!table) {
        return;
    }


    table.innerHTML = "";


    if (!data.length) {

        table.innerHTML =
            `
            <tr>
                <td colspan="11">
                    No patient measurements found.
                </td>
            </tr>
            `;

        return;
    }


    data.forEach(
        function (scan) {

            const patient =
                scan.subjects ||
                {};


            const row =
                document.createElement("tr");


            row.innerHTML = `
                <td>
                    ${escapeHTML(
                        scan.scan_id || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        patient.name || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        patient.patient_id ||
                        patient.subject_id ||
                        ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        scan.measurement_side ||
                        ""
                    )}
                </td>

                <td>
                    ${formatNumber(scan.f0)}
                </td>

                <td>
                    ${formatNumber(scan.rms)}
                </td>

                <td>
                    ${formatNumber(
                        scan.q_factor
                    )}
                </td>

                <td>
                    ${formatNumber(
                        scan.bandwidth
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        scan.comparison_status ||
                        ""
                    )}
                </td>

                <td>
                    ${formatDate(
                        scan.created_at
                    )}
                </td>

                <td>
                    <button
                        class="danger"
                        onclick="deletePatientMeasurement('${escapeHTML(scan.id)}')"
                    >
                        Delete
                    </button>
                </td>
            `;


            table.appendChild(row);

        }
    );

}


// ============================================================
// DELETE PATIENT
// ============================================================

async function deletePatient(id) {

    if (!isAdmin()) {

        alert(
            "Only an admin can delete patients."
        );

        return;
    }


    if (!id) {
        return;
    }


    const confirmed =
        confirm(
            "Delete this patient and their measurements?\n\n" +
            "This action cannot be undone."
        );


    if (!confirmed) {
        return;
    }


    try {

        // Delete scans belonging to patient first.
        const scanDelete =
            await supabaseClient
                .from("scan_measurements")
                .delete()
                .eq(
                    "subject_id",
                    id
                );


        if (scanDelete.error) {

            console.error(
                "Patient scan deletion error:",
                scanDelete.error
            );

            alert(
                "Could not delete the patient's measurements.\n\n" +
                scanDelete.error.message
            );

            return;
        }


        const {
            error
        } =
            await supabaseClient
                .from("subjects")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (error) {

            console.error(
                "Patient deletion error:",
                error
            );

            alert(
                "Could not delete patient.\n\n" +
                error.message
            );

            return;
        }


        alert(
            "Patient deleted successfully."
        );


        await loadAllSubjects();
        await loadAllScans();


    } catch (error) {

        console.error(
            "Delete patient exception:",
            error
        );

        alert(
            "Could not delete patient."
        );

    }

}


// ============================================================
// DELETE PATIENT MEASUREMENT
// ============================================================

async function deletePatientMeasurement(id) {

    if (!id) {
        return;
    }


    if (
        !isAdmin() &&
        !isOperator()
    ) {

        alert(
            "You do not have permission to delete measurements."
        );

        return;
    }


    const confirmed =
        confirm(
            "Are you sure you want to delete this patient measurement?\n\n" +
            "This action cannot be undone."
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from("scan_measurements")
            .delete()
            .eq(
                "id",
                id
            );


    if (error) {

        console.error(
            "Delete measurement error:",
            error
        );

        alert(
            "Could not delete measurement.\n\n" +
            error.message
        );

        return;
    }


    alert(
        "Patient measurement deleted successfully."
    );


    if (isAdmin()) {
        await loadAllScans();
    }


    if (isOperator()) {
        await loadScans();
    }

}


// ============================================================
// REFERENCE TABS
// ============================================================

function showReferenceTab(tab) {

    const manualPanel =
        el("manualReferencePanel");

    const scannerPanel =
        el("scannerReferencePanel");

    const manualButton =
        el("manualReferenceTab");

    const scannerButton =
        el("scannerReferenceTab");


    if (
        !manualPanel ||
        !scannerPanel
    ) {
        return;
    }


    if (tab === "manual") {

        manualPanel
            .classList
            .remove("hidden");

        scannerPanel
            .classList
            .add("hidden");


        if (manualButton) {
            manualButton.classList.add("active");
        }

        if (scannerButton) {
            scannerButton.classList.remove("active");
        }

    }

    else {

        manualPanel
            .classList
            .add("hidden");

        scannerPanel
            .classList
            .remove("hidden");


        if (manualButton) {
            manualButton.classList.remove("active");
        }

        if (scannerButton) {
            scannerButton.classList.add("active");
        }

    }

}


// ============================================================
// ADD MANUAL REFERENCE
// ============================================================

async function addManualReference() {

    if (!isAdmin()) {

        alert(
            "Only an admin can add reference measurements."
        );

        return;
    }


    const sampleId =
        el("referenceSampleId")
            ? el("referenceSampleId")
                .value.trim()
            : "";


    const referenceId =
        el("referenceId")
            ? el("referenceId")
                .value.trim()
            : "";


    const age =
        el("referenceAge")
            ? parseInt(
                el("referenceAge").value,
                10
            )
            : NaN;


    const gender =
        el("referenceGender")
            ? el("referenceGender").value
            : "";


    const side =
        el("referenceSide")
            ? el("referenceSide").value
            : "";


    const f0 =
        el("referenceF0")
            ? parseFloat(
                el("referenceF0").value
            )
            : NaN;


    const rms =
        el("referenceRMS")
            ? parseFloat(
                el("referenceRMS").value
            )
            : NaN;


    const qFactor =
        el("referenceQ")
            ? parseFloat(
                el("referenceQ").value
            )
            : NaN;


    const bandwidth =
        el("referenceBandwidth")
            ? parseFloat(
                el("referenceBandwidth").value
            )
            : NaN;


    const notes =
        el("referenceNotes")
            ? el("referenceNotes")
                .value.trim()
            : "";


    const message =
        el("referenceMessage");


    if (
        !sampleId ||
        !Number.isInteger(age) ||
        age < 1 ||
        !gender ||
        !side ||
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(qFactor) ||
        !Number.isFinite(bandwidth)
    ) {

        setMessage(
            message,
            "Please fill in all required reference measurement fields.",
            "error"
        );

        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("reference_measurements")
            .insert({

                sample_id:
                    sampleId,

                reference_id:
                    referenceId ||
                    null,

                age:
                    age,

                gender:
                    gender,

                measurement_side:
                    side,

                f0:
                    f0,

                rms:
                    rms,

                q_factor:
                    qFactor,

                bandwidth:
                    bandwidth,

                notes:
                    notes ||
                    null

            })
            .select()
            .single();


    if (error) {

        console.error(
            "Reference insert error:",
            error
        );

        setMessage(
            message,
            error.message,
            "error"
        );

        return;
    }


    setMessage(
        message,
        "Reference measurement added successfully.",
        "success"
    );


    clearManualReferenceForm();


    await loadAdminReferences();

}


// ============================================================
// CLEAR REFERENCE FORM
// ============================================================

function clearManualReferenceForm() {

    const ids = [

        "referenceSampleId",
        "referenceId",
        "referenceAge",
        "referenceGender",
        "referenceSide",
        "referenceF0",
        "referenceRMS",
        "referenceQ",
        "referenceBandwidth",
        "referenceNotes"

    ];


    ids.forEach(
        function (id) {

            const element =
                el(id);

            if (element) {

                element.value = "";

            }

        }
    );

}


// ============================================================
// REFERENCE SCANNER START
// ============================================================

async function startReferenceScanner() {

    if (!isAdmin()) {

        alert(
            "Only an admin can perform reference measurements."
        );

        return;
    }


    const sampleId =
        el("scannerReferenceSampleId")
            ? el("scannerReferenceSampleId")
                .value.trim()
            : "";


    const age =
        el("scannerReferenceAge")
            ? parseInt(
                el("scannerReferenceAge").value,
                10
            )
            : NaN;


    const gender =
        el("scannerReferenceGender")
            ? el("scannerReferenceGender").value
            : "";


    const side =
        el("scannerReferenceSide")
            ? el("scannerReferenceSide").value
            : "";


    if (
        !sampleId ||
        !Number.isInteger(age) ||
        !gender ||
        !side
    ) {

        alert(
            "Please enter Sample ID, age, gender and measurement side first."
        );

        return;
    }


    if (!esp32Connected) {

        alert(
            "Please connect the ESP32 first."
        );

        return;
    }


    if (referenceScannerRunning) {

        alert(
            "A reference scan is already running."
        );

        return;
    }


    try {

        referenceScannerRunning =
            true;


        const status =
            el("referenceScannerStatus");


        if (status) {

            status.textContent =
                "Scanner status: Starting reference measurement...";

        }


        const payload = {

            command:
                "start_scan",

            mode:
                "reference",

            sample_id:
                sampleId,

            age:
                age,

            gender:
                gender,

            side:
                side,

            measurement_side:
                side,

            device_id:
                "ABS-001"

        };


        await wirelessRequest(
            "/api/scan/start",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(payload)
            },
            8000
        );


        if (status) {

            status.textContent =
                "Scanner status: Scanning reference sample...";

        }


        startWirelessScanPolling();


    } catch (error) {

        console.error(
            "Reference scanner start error:",
            error
        );


        referenceScannerRunning =
            false;


        const status =
            el("referenceScannerStatus");


        if (status) {

            status.textContent =
                "Scanner status: Unable to start.";

        }


        alert(
            "Could not start reference scan.\n\n" +
            error.message
        );

    }

}


// ============================================================
// STOP REFERENCE SCANNER
// ============================================================

async function stopReferenceScanner() {

    stopWirelessPolling();


    if (referenceScannerRunning) {

        try {

            await wirelessRequest(
                "/api/scan/stop",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            command:
                                "stop_scan"
                        })
                },
                5000
            );

        } catch (error) {

            console.error(
                "Reference stop error:",
                error
            );

        }

    }


    referenceScannerRunning =
        false;


    const status =
        el("referenceScannerStatus");


    if (status) {

        status.textContent =
            "Scanner status: Stopped.";

    }

}


// ============================================================
// VALIDATE AND SAVE REFERENCE RESULT
// ============================================================

async function validateAndSaveWirelessReferenceResult(
    result
) {

    try {

        const f0 =
            Number(result.f0);

        const rms =
            Number(result.rms);

        const qFactor =
            Number(result.q_factor);

        const bandwidth =
            Number(result.bandwidth);


        if (
            !Number.isFinite(f0) ||
            !Number.isFinite(rms) ||
            !Number.isFinite(qFactor) ||
            !Number.isFinite(bandwidth)
        ) {

            throw new Error(
                "Reference scanner returned incomplete measurement data."
            );

        }


        const saved =
            await saveScannerReferenceMeasurement({

                ...result,

                f0:
                    f0,

                rms:
                    rms,

                q_factor:
                    qFactor,

                bandwidth:
                    bandwidth

            });


        const status =
            el("referenceScannerStatus");


        if (status) {

            status.textContent =
                "Scanner status: Reference measurement saved successfully.";

        }


        alert(
            "Reference measurement saved.\n\n" +
            `F₀: ${formatNumber(saved.f0)} Hz\n` +
            `RMS: ${formatNumber(saved.rms)}\n` +
            `Q-factor: ${formatNumber(saved.q_factor)}\n` +
            `Bandwidth: ${formatNumber(saved.bandwidth)} Hz`
        );


        await loadAdminReferences();


    } catch (error) {

        console.error(
            "Reference result error:",
            error
        );


        const status =
            el("referenceScannerStatus");


        if (status) {

            status.textContent =
                "Scanner status: Result could not be saved.";

        }


        alert(
            "Reference measurement could not be saved.\n\n" +
            error.message
        );

    }

}


// ============================================================
// SAVE REFERENCE MEASUREMENT
// ============================================================

async function saveScannerReferenceMeasurement(
    result
) {

    if (!isAdmin()) {

        throw new Error(
            "Only an admin can save reference measurements."
        );

    }


    if (!result) {

        throw new Error(
            "Scanner result is missing."
        );

    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("reference_measurements")
            .insert({

                sample_id:
                    result.sample_id,

                reference_id:
                    result.reference_id ??
                    null,

                age:
                    result.age,

                gender:
                    result.gender,

                measurement_side:
                    result.measurement_side,

                f0:
                    Number(result.f0),

                rms:
                    Number(result.rms),

                q_factor:
                    Number(result.q_factor),

                bandwidth:
                    Number(result.bandwidth),

                notes:
                    result.notes ??
                    null

            })
            .select()
            .single();


    if (error) {

        console.error(
            "Reference save error:",
            error
        );

        throw error;
    }


    return data;

}


// ============================================================
// ADMIN REFERENCE MEASUREMENTS
// ============================================================

async function loadAdminReferences() {

    if (!isAdmin()) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("reference_measurements")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Admin reference error:",
            error
        );

        return;
    }


    const count =
        el("adminReferences");

    if (count) {
        count.textContent =
            data.length;
    }


    renderReferenceTable(
        data,
        true
    );

}


// ============================================================
// REFERENCE TABLE
// ============================================================

function renderReferenceTable(
    data,
    allowDelete
) {

    const table =
        el("referenceTable");


    if (!table) {
        return;
    }


    table.innerHTML = "";


    if (!data || !data.length) {

        table.innerHTML =
            `
            <tr>
                <td colspan="11">
                    No reference measurements found.
                </td>
            </tr>
            `;

        return;
    }


    data.forEach(
        function (reference) {

            const row =
                document.createElement("tr");


            let action = "";


            if (allowDelete) {

                action =
                    `
                    <button
                        class="danger"
                        onclick="deleteReferenceMeasurement('${escapeHTML(reference.id)}')"
                    >
                        Delete
                    </button>
                    `;

            }


            row.innerHTML = `
                <td>
                    ${escapeHTML(
                        reference.sample_id || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.reference_id || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.age ?? ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.gender || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.measurement_side ||
                        ""
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reference.f0
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reference.rms
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reference.q_factor
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reference.bandwidth
                    )}
                </td>

                <td>
                    ${formatDate(
                        reference.created_at
                    )}
                </td>

                <td>
                    ${action}
                </td>
            `;


            table.appendChild(row);

        }
    );

}


// ============================================================
// DELETE REFERENCE MEASUREMENT
// ============================================================

async function deleteReferenceMeasurement(id) {

    if (!isAdmin()) {

        alert(
            "Only an admin can delete reference measurements."
        );

        return;
    }


    const confirmed =
        confirm(
            "Are you sure you want to delete this reference measurement?\n\n" +
            "This action cannot be undone."
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from("reference_measurements")
            .delete()
            .eq(
                "id",
                id
            );


    if (error) {

        console.error(
            "Delete reference error:",
            error
        );

        alert(
            "Could not delete reference measurement.\n\n" +
            error.message
        );

        return;
    }


    alert(
        "Reference measurement deleted successfully."
    );


    await loadAdminReferences();

}


// ============================================================
// OPERATOR REFERENCE DATABASE
// ============================================================

async function loadReferenceGroups() {

    if (!isOperator()) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("reference_measurements")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Operator reference error:",
            error
        );

        return;
    }


    const table =
        el("referenceList");


    if (!table) {
        return;
    }


    table.innerHTML = "";


    if (!data.length) {

        table.innerHTML =
            `
            <tr>
                <td colspan="10">
                    No reference measurements found.
                </td>
            </tr>
            `;

        return;
    }


    data.forEach(
        function (reference) {

            const row =
                document.createElement("tr");


            row.innerHTML = `
                <td>
                    ${escapeHTML(
                        reference.sample_id || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.reference_id || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.age ?? ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.gender || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.measurement_side ||
                        ""
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reference.f0
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reference.rms
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reference.q_factor
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reference.bandwidth
                    )}
                </td>

                <td>
                    ${formatDate(
                        reference.created_at
                    )}
                </td>
            `;


            table.appendChild(row);

        }
    );

}


// ============================================================
// SCANNER DEVICES
// ============================================================

async function loadScannerDevices() {

    if (!isAdmin()) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("scanner_devices")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    const container =
        el("adminScannerDevices");


    if (error) {

        console.error(
            "Scanner devices error:",
            error
        );

        if (container) {

            container.textContent =
                "Unable to load scanner devices.";

        }

        return;
    }


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (!data.length) {

        container.textContent =
            "No scanner devices registered.";

        return;
    }


    data.forEach(
        function (device) {

            const div =
                document.createElement("div");


            div.className =
                "patient-card";


            div.innerHTML = `
                <strong>
                    ${escapeHTML(
                        device.device_id || ""
                    )}
                </strong>

                <p>
                    Status:
                    ${device.active
                        ? "Active"
                        : "Inactive"}
                </p>

                <p>
                    Created:
                    ${formatDate(
                        device.created_at
                    )}
                </p>
            `;


            container.appendChild(div);

        }
    );

}


// ============================================================
// PATIENT ACCESS
// ============================================================
//
// IMPORTANT SECURITY DESIGN:
//
// The browser does NOT query subjects directly here.
//
// It calls:
//
//     get_patient_results
//
// The RPC must be implemented as a SECURITY DEFINER
// PostgreSQL function with a restricted result.
//
// That prevents a public patient from selecting arbitrary
// subjects or scan_measurements.
//
async function patientAccess() {

    const input =
        el("patientLinkingCode");


    const message =
        el("patientAccessMessage");


    const code =
        input
            ? input.value.trim()
            : "";


    if (!code) {

        setMessage(
            message,
            "Please enter your patient linking code.",
            "error"
        );

        return;
    }


    // Accept the current 6-digit format.
    // Also accept ABS- style codes if you later change
    // the database to that format.
    const validNumeric =
        /^\d{6}$/.test(code);

    const validABS =
        /^ABS-[A-Z0-9]{6}$/i.test(code);


    if (
        !validNumeric &&
        !validABS
    ) {

        setMessage(
            message,
            "Please enter a valid patient linking code.",
            "error"
        );

        return;
    }


    setMessage(
        message,
        "Loading patient results...",
        "info"
    );


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .rpc(
                    "get_patient_results",
                    {
                        p_linking_code:
                            code
                    }
                );


        if (error) {

            console.error(
                "Patient access RPC error:",
                error
            );


            setMessage(
                message,
                "Unable to access patient results. Please check the linking code.",
                "error"
            );

            return;
        }


        if (
            !data ||
            data.length === 0
        ) {

            setMessage(
                message,
                "No patient was found for this linking code.",
                "error"
            );

            return;
        }


        displayPatientResults(
            data
        );


    } catch (error) {

        console.error(
            "Patient access exception:",
            error
        );


        setMessage(
            message,
            "Unable to access patient results.",
            "error"
        );

    }

}


// ============================================================
// DISPLAY PATIENT RESULTS
// ============================================================

function displayPatientResults(
    data
) {

    if (
        !data ||
        !data.length
    ) {
        return;
    }


    const first =
        data[0];


    const loginScreen =
        el("loginScreen");

    const dashboard =
        el("dashboard");

    const resultScreen =
        el("patientResultScreen");


    if (loginScreen) {
        loginScreen.classList.add("hidden");
    }

    if (dashboard) {
        dashboard.classList.add("hidden");
    }

    if (resultScreen) {
        resultScreen.classList.remove("hidden");
    }


    const details =
        el("patientDetails");


    if (details) {

        details.innerHTML = `
            <div class="patient-card">

                <h3>
                    ${escapeHTML(
                        first.patient_name ||
                        ""
                    )}
                </h3>

                <p>
                    Patient ID:
                    ${escapeHTML(
                        first.patient_id ||
                        ""
                    )}
                </p>

                <p>
                    Age:
                    ${escapeHTML(
                        first.patient_age ??
                        ""
                    )}
                </p>

                <p>
                    Gender:
                    ${escapeHTML(
                        first.patient_gender ||
                        ""
                    )}
                </p>

            </div>
        `;

    }


    const results =
        el("patientScanResults");


    if (!results) {
        return;
    }


    results.innerHTML = "";


    const scans =
        data.filter(
            function (item) {

                return Boolean(
                    item.scan_id
                );

            }
        );


    if (!scans.length) {

        results.innerHTML =
            `
            <div class="empty">
                No scan measurements are available yet.
            </div>
            `;

        return;
    }


    scans.forEach(
        function (scan) {

            const div =
                document.createElement("div");


            div.className =
                "patient-result";


            div.innerHTML = `
                <h3>
                    Scan:
                    ${escapeHTML(
                        scan.scan_id || ""
                    )}
                </h3>

                <p>
                    Date:
                    ${formatDate(
                        scan.scan_date ||
                        scan.created_at
                    )}
                </p>

                <p>
                    Measurement side:
                    ${escapeHTML(
                        scan.measurement_side ||
                        "Not specified"
                    )}
                </p>

                <p>
                    F₀:
                    ${formatNumber(
                        scan.f0
                    )}
                    Hz
                </p>

                <p>
                    RMS:
                    ${formatNumber(
                        scan.rms
                    )}
                </p>

                <p>
                    Q Factor:
                    ${formatNumber(
                        scan.q_factor
                    )}
                </p>

                <p>
                    Bandwidth:
                    ${formatNumber(
                        scan.bandwidth
                    )}
                    Hz
                </p>

                <p>
                    Reference Comparison:
                    ${escapeHTML(
                        scan.comparison_status ||
                        "Not available"
                    )}
                </p>

            `;


            results.appendChild(
                div
            );

        }
    );

}


// ============================================================
// PATIENT ACCESS - BACK
// ============================================================

function backToLogin() {

    const resultScreen =
        el("patientResultScreen");


    if (resultScreen) {

        resultScreen.classList.add(
            "hidden"
        );

    }


    const input =
        el("patientLinkingCode");


    if (input) {
        input.value = "";
    }


    const message =
        el("patientAccessMessage");


    if (message) {
        message.innerHTML = "";
    }


    showLogin();

}


// ============================================================
// PATIENT MODAL
// ============================================================

function closePatientModal() {

    const modal =
        el("patientModal");


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    stopWirelessPolling();


    patientScannerRunning =
        false;

    referenceScannerRunning =
        false;

    esp32Connected =
        false;


    const {
        error
    } =
        await supabaseClient.auth.signOut();


    if (error) {

        console.error(
            "Logout error:",
            error
        );

    }


    currentUser =
        null;

    currentProfile =
        null;

    currentPatient =
        null;

    currentMeasurementSide =
        null;


    const email =
        el("loginEmail");

    const password =
        el("loginPassword");

    const message =
        el("loginMessage");


    if (email) {
        email.value = "";
    }

    if (password) {
        password.value = "";
    }

    if (message) {
        message.innerHTML = "";
    }


    showLogin();

}


// ============================================================
// MESSAGE HELPER
// ============================================================

function setMessage(
    element,
    text,
    type
) {

    if (!element) {
        return;
    }


    element.innerHTML =
        `
        <div class="message ${escapeHTML(type || "info")}">
            ${escapeHTML(text)}
        </div>
        `;

}


// ============================================================
// NUMBER FORMATTER
// ============================================================

function formatNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "—";
    }


    const number =
        Number(value);


    if (!Number.isFinite(number)) {

        return "—";
    }


    return number.toFixed(3);

}


// ============================================================
// DATE FORMATTER
// ============================================================

function formatDate(value) {

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


    return date.toLocaleString();

}


// ============================================================
// HTML ESCAPE
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


// ============================================================
// ROLE HELPERS
// ============================================================

function isAdmin() {

    return Boolean(
        currentProfile &&
        String(
            currentProfile.role || ""
        ).toLowerCase() ===
        "admin"
    );

}


function isOperator() {

    return Boolean(
        currentProfile &&
        String(
            currentProfile.role || ""
        ).toLowerCase() ===
        "operator"
    );

}


// ============================================================
// WINDOW EXPORTS
// ============================================================
//
// These are required because your index.html uses
// onclick="functionName()".
//

window.login =
    login;

window.logout =
    logout;

window.patientAccess =
    patientAccess;

window.backToLogin =
    backToLogin;

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

window.connectESP32 =
    connectESP32;

window.disconnectESP32 =
    disconnectESP32;

window.deletePatientMeasurement =
    deletePatientMeasurement;

window.showReferenceTab =
    showReferenceTab;

window.addManualReference =
    addManualReference;

window.startReferenceScanner =
    startReferenceScanner;

window.stopReferenceScanner =
    stopReferenceScanner;

window.deleteReferenceMeasurement =
    deleteReferenceMeasurement;

window.closePatientModal =
    closePatientModal;

window.savePatientMeasurement =
    savePatientMeasurement;

window.saveScannerReferenceMeasurement =
    saveScannerReferenceMeasurement;


// ============================================================
// END OF APP.JS
// ============================================================
