// ============================================================
// GROUP 4 - LOW-COST ACOUSTIC BONE SCANNER
// COMPLETE WEBSITE APPLICATION
// app.js
//
// WEBSITE <-> ESP32 WIRELESS INTEGRATION
//
// ESP32 API expected:
//
// GET  /api/status
// POST /api/scan/start
// GET  /api/scan/status
// POST /api/scan/stop
//
// ESP32 DEVICE:
// ABS-001
//
// SENSOR HEAD:
// HEAD-001
//
// IMPORTANT:
// This is an academic/research prototype.
// It is NOT a clinical diagnostic device.
// ============================================================


// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

const SUPABASE_URL =
    "https://ropiudyalwarmowaiugu.supabase.co";

// Paste your existing Supabase publishable key here.
const SUPABASE_KEY =
    "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";

const { createClient } = window.supabase;

const supabaseClient =
    createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentUser = null;

let currentProfile = null;

let currentPatient = null;

let currentMeasurementSide = null;


// Scanner state
let referenceScannerRunning = false;

let patientScannerRunning = false;

let esp32Connected = false;

let esp32BaseUrl =
    localStorage.getItem("esp32BaseUrl") || "";

let wirelessPollTimer = null;

let wirelessScanMode = null;

let pendingReferenceScan = null;

let latestWirelessResult = null;


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


            if (data.session) {

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
// AUTH STATE CHANGE
// ============================================================

supabaseClient.auth.onAuthStateChange(
    async function (event, session) {

        if (event === "SIGNED_IN" && session) {

            currentUser =
                session.user;

            await loadDashboard();

        }


        if (event === "SIGNED_OUT") {

            currentUser = null;

            currentProfile = null;

            currentPatient = null;

            currentMeasurementSide = null;

            patientScannerRunning = false;

            referenceScannerRunning = false;

            stopWirelessPolling();

            showLogin();

        }

    }
);


// ============================================================
// LOGIN SCREEN
// ============================================================

function showLogin() {

    const loginScreen =
        document.getElementById(
            "loginScreen"
        );

    const dashboard =
        document.getElementById(
            "dashboard"
        );

    const patientResultScreen =
        document.getElementById(
            "patientResultScreen"
        );


    if (loginScreen) {

        loginScreen
            .classList
            .remove("hidden");

    }


    if (dashboard) {

        dashboard
            .classList
            .add("hidden");

    }


    if (patientResultScreen) {

        patientResultScreen
            .classList
            .add("hidden");

    }

}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const emailElement =
        document.getElementById(
            "loginEmail"
        );

    const passwordElement =
        document.getElementById(
            "loginPassword"
        );

    const message =
        document.getElementById(
            "loginMessage"
        );


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
            await supabaseClient.auth.signInWithPassword({
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
            error.message ||
            "Login failed.",
            "error"
        );

    }

}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    try {

        if (!currentUser) {

            const {
                data
            } =
                await supabaseClient.auth.getUser();

            currentUser =
                data.user;

        }


        if (!currentUser) {

            showLogin();

            return;

        }


        const profile =
            await loadProfile();


        if (!profile) {

            setMessage(
                document.getElementById(
                    "loginMessage"
                ),
                "Your profile could not be loaded.",
                "error"
            );

            return;

        }


        currentProfile =
            profile;


        const loginScreen =
            document.getElementById(
                "loginScreen"
            );

        const dashboard =
            document.getElementById(
                "dashboard"
            );

        const patientResultScreen =
            document.getElementById(
                "patientResultScreen"
            );

        const adminDashboard =
            document.getElementById(
                "adminDashboard"
            );

        const operatorDashboard =
            document.getElementById(
                "operatorDashboard"
            );


        if (loginScreen) {

            loginScreen
                .classList
                .add("hidden");

        }


        if (patientResultScreen) {

            patientResultScreen
                .classList
                .add("hidden");

        }


        if (dashboard) {

            dashboard
                .classList
                .remove("hidden");

        }


        if (adminDashboard) {

            adminDashboard
                .classList
                .add("hidden");

        }


        if (operatorDashboard) {

            operatorDashboard
                .classList
                .add("hidden");

        }


        const userInfo =
            document.getElementById(
                "userInfo"
            );


        if (userInfo) {

            userInfo.textContent =
                `${profile.full_name || profile.email || currentUser.email} | Role: ${profile.role}`;

        }


        if (profile.role === "admin") {

            if (adminDashboard) {

                adminDashboard
                    .classList
                    .remove("hidden");

            }

            await loadAdminDashboard();

        }


        else if (
            profile.role === "operator"
        ) {

            if (operatorDashboard) {

                operatorDashboard
                    .classList
                    .remove("hidden");

            }

            await loadOperatorDashboard();

        }


        else {

            console.error(
                "Unknown user role:",
                profile.role
            );

        }


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

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
        document.getElementById(
            "adminUsersTable"
        );


    if (!table) {

        return;

    }


    table.innerHTML = "";


    let operatorCount = 0;


    data.forEach(
        function (user) {

            if (
                user.role ===
                "operator"
            ) {

                operatorCount++;

            }


            const row =
                document.createElement(
                    "tr"
                );


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


    const counter =
        document.getElementById(
            "adminUsers"
        );


    if (counter) {

        counter.textContent =
            operatorCount;

    }

}


// ============================================================
// ADMIN PATIENTS
// ============================================================

async function loadAllSubjects() {

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
            "Patients error:",
            error
        );

        return;

    }


    const counter =
        document.getElementById(
            "adminSubjects"
        );


    if (counter) {

        counter.textContent =
            data.length;

    }


    const container =
        document.getElementById(
            "adminSubjectsList"
        );


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
                document.createElement(
                    "div"
                );


            div.className =
                "patient-card";


            div.innerHTML = `

                <h3>
                    ${escapeHTML(
                        patient.name ||
                        "Unnamed Patient"
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
                        String(
                            patient.age ??
                            ""
                        )
                    )}
                </p>

                <p>
                    Gender:
                    ${escapeHTML(
                        patient.gender ||
                        ""
                    )}
                </p>

                <p>
                    Linking Code:
                    <strong>
                        ${escapeHTML(
                            patient.linking_code ||
                            ""
                        )}
                    </strong>
                </p>

                <p>
                    Created:
                    ${formatDate(
                        patient.created_at
                    )}
                </p>

            `;


            container.appendChild(div);

        }
    );

}


// ============================================================
// ADMIN SCANS
// ============================================================

async function loadAllScans() {

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
            "Scan error:",
            error
        );

        return;

    }


    const counter =
        document.getElementById(
            "adminScans"
        );


    if (counter) {

        counter.textContent =
            data.length;

    }


    const table =
        document.getElementById(
            "adminScansTable"
        );


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
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        scan.scan_id ||
                        ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        patient.name ||
                        ""
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
                    ${formatNumber(
                        scan.f0
                    )}
                </td>

                <td>
                    ${formatNumber(
                        scan.rms
                    )}
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
// ADMIN REFERENCE MEASUREMENTS
// ============================================================

async function loadAdminReferences() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "reference_measurements"
            )
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Reference error:",
            error
        );

        return;

    }


    const counter =
        document.getElementById(
            "adminReferences"
        );


    if (counter) {

        counter.textContent =
            data.length;

    }


    renderReferenceTable(
        data,
        true
    );

}


// ============================================================
// OPERATOR DASHBOARD
// ============================================================

async function loadOperatorDashboard() {

    await loadSubjects();

    await loadScans();

    await loadReferenceGroups();

}


// ============================================================
// LOAD OPERATOR PATIENTS
// ============================================================

async function loadSubjects() {

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

        return;

    }


    const container =
        document.getElementById(
            "subjectsList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    if (!data.length) {

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
                document.createElement(
                    "div"
                );


            div.className =
                "patient-card";


            div.innerHTML = `

                <h3>
                    ${escapeHTML(
                        patient.name ||
                        "Unnamed Patient"
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
                        String(
                            patient.age ??
                            ""
                        )
                    )}
                </p>

                <p>
                    Gender:
                    ${escapeHTML(
                        patient.gender ||
                        ""
                    )}
                </p>

                <p>
                    Linking Code:
                    <strong>
                        ${escapeHTML(
                            patient.linking_code ||
                            ""
                        )}
                    </strong>
                </p>

                <button
                    onclick='selectPatient(${JSON.stringify(patient).replace(/'/g, "&#039;")})'
                >
                    Select for Scan
                </button>

            `;


            container.appendChild(div);

        }
    );

}


// ============================================================
// CREATE PATIENT
// ============================================================

async function createPatient() {

    const name =
        document
            .getElementById(
                "subjectName"
            )
            .value
            .trim();


    const age =
        parseInt(
            document
                .getElementById(
                    "subjectAge"
                )
                .value
        );


    const gender =
        document
            .getElementById(
                "subjectGender"
            )
            .value;


    const message =
        document.getElementById(
            "subjectMessage"
        );


    if (
        !name ||
        !Number.isFinite(age) ||
        age <= 0 ||
        !gender
    ) {

        setMessage(
            message,
            "Please fill in all patient details.",
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

            throw error;

        }


        const createdInfo =
            document.getElementById(
                "createdPatientInfo"
            );


        if (createdInfo) {

            createdInfo.innerHTML = `

                <p>
                    Patient has been registered successfully.
                </p>

                <p>
                    Patient ID:
                </p>

                <div class="code-display">
                    ${escapeHTML(patientId)}
                </div>

                <p>
                    Patient Linking Code:
                </p>

                <div class="code-display">
                    ${escapeHTML(linkingCode)}
                </div>

                <p>
                    Give this 6-digit linking code
                    to the patient so they can
                    view their results.
                </p>

            `;

        }


        const modal =
            document.getElementById(
                "patientModal"
            );


        if (modal) {

            modal
                .classList
                .remove("hidden");

        }


        document
            .getElementById(
                "subjectName"
            )
            .value = "";

        document
            .getElementById(
                "subjectAge"
            )
            .value = "";

        document
            .getElementById(
                "subjectGender"
            )
            .value = "";


        setMessage(
            message,
            "Patient registered successfully.",
            "success"
        );


        await loadSubjects();


    } catch (error) {

        console.error(
            "Patient creation error:",
            error
        );

        setMessage(
            message,
            error.message ||
            "Patient registration failed.",
            "error"
        );

    }

}


// ============================================================
// GENERATE PATIENT ID
// ============================================================

function generatePatientId() {

    const random =
        Math.floor(
            10000 +
            Math.random() *
            90000
        );


    return `PAT-${random}`;

}


// ============================================================
// GENERATE UNIQUE LINKING CODE
// ============================================================

async function generateUniqueLinkingCode() {

    for (
        let attempt = 0;
        attempt < 20;
        attempt++
    ) {

        const code =
            String(
                Math.floor(
                    100000 +
                    Math.random() *
                    900000
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
        "Could not generate a unique linking code."
    );

}


// ============================================================
// SELECT PATIENT
// ============================================================

function selectPatient(patient) {

    currentPatient =
        patient;

    currentMeasurementSide =
        null;


    const preparation =
        document.getElementById(
            "scanPreparation"
        );


    if (preparation) {

        preparation
            .classList
            .remove("hidden");

    }


    const selectedPatientInfo =
        document.getElementById(
            "selectedPatientInfo"
        );


    if (selectedPatientInfo) {

        selectedPatientInfo.innerHTML = `

            <div class="patient-card selected-patient">

                <h3>
                    ${escapeHTML(
                        patient.name ||
                        ""
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
                        String(
                            patient.age ??
                            ""
                        )
                    )}
                </p>

                <p>
                    Gender:
                    ${escapeHTML(
                        patient.gender ||
                        ""
                    )}
                </p>

            </div>

        `;

    }


    const selectedSideText =
        document.getElementById(
            "selectedSideText"
        );


    if (selectedSideText) {

        selectedSideText.textContent =
            "No side selected.";

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

        leftButton
            .classList
            .remove("selected");

    }


    if (rightButton) {

        rightButton
            .classList
            .remove("selected");

    }


    if (preparation) {

        preparation.scrollIntoView({
            behavior: "smooth"
        });

    }

}


// ============================================================
// SELECT LEFT / RIGHT
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
            "Measurement side must be Left or Right."
        );

        return;

    }


    currentMeasurementSide =
        side;


    const selectedSideText =
        document.getElementById(
            "selectedSideText"
        );


    if (selectedSideText) {

        selectedSideText.textContent =
            `Selected measurement side: ${side}`;

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

        leftButton
            .classList
            .remove("selected");

    }


    if (rightButton) {

        rightButton
            .classList
            .remove("selected");

    }


    if (side === "Left") {

        if (leftButton) {

            leftButton
                .classList
                .add("selected");

        }

    }


    if (side === "Right") {

        if (rightButton) {

            rightButton
                .classList
                .add("selected");

        }

    }

}


// ============================================================
// ESP32 BASE URL
// ============================================================

function getESP32BaseUrl() {

    const input =
        document.getElementById(
            "esp32BaseUrl"
        );


    let value =
        input
            ? input.value.trim()
            : esp32BaseUrl;


    if (!value) {

        value =
            localStorage.getItem(
                "esp32BaseUrl"
            ) || "";

    }


    value =
        value.trim();


    if (!value) {

        return "";

    }


    if (
        !value.startsWith(
            "http://"
        ) &&
        !value.startsWith(
            "https://"
        )
    ) {

        value =
            "http://" +
            value;

    }


    return value.replace(
        /\/+$/,
        ""
    );

}


// ============================================================
// WIRELESS REQUEST
// ============================================================

async function wirelessRequest(
    path,
    options = {}
) {

    const baseUrl =
        getESP32BaseUrl();


    if (!baseUrl) {

        throw new Error(
            "Enter the ESP32 IP address or base URL first."
        );

    }


    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            function () {

                controller.abort();

            },
            options.timeout ||
            7000
        );


    try {

        const method =
            options.method ||
            "GET";


        const fetchOptions = {

            method:

                method,

            headers: {

                "Content-Type":
                    "application/json"

            },

            signal:
                controller.signal

        };


        if (
            options.body !==
            undefined
        ) {

            fetchOptions.body =
                JSON.stringify(
                    options.body
                );

        }


        let response;


        try {

            response =
                await fetch(
                    baseUrl +
                    path,
                    fetchOptions
                );

        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {

                throw new Error(
                    "ESP32 request timed out."
                );

            }


            throw new Error(
                "Could not reach ESP32. Check the IP address, Wi-Fi connection, and browser network permissions."
            );

        }


        const text =
            await response.text();


        let data = {};


        try {

            data =
                text
                    ? JSON.parse(text)
                    : {};

        } catch (error) {

            data = {

                message:
                    text ||
                    "ESP32 returned invalid JSON."

            };

        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                `ESP32 HTTP error ${response.status}`
            );

        }


        return data;


    } finally {

        clearTimeout(timeout);

    }

}


// ============================================================
// CONNECT ESP32
// ============================================================

async function connectESP32() {

    const statusElement =
        document.getElementById(
            "scannerStatus"
        );


    try {

        const baseUrl =
            getESP32BaseUrl();


        if (!baseUrl) {

            setScannerStatus(
                "Enter the ESP32 IP address first.",
                "scannerStatus"
            );

            return;

        }


        esp32BaseUrl =
            baseUrl;


        localStorage.setItem(
            "esp32BaseUrl",
            baseUrl
        );


        setScannerStatus(
            "Connecting to ESP32...",
            "scannerStatus"
        );


        const result =
            await wirelessRequest(
                "/api/status",
                {
                    timeout: 7000
                }
            );


        if (
            result.device_id &&
            result.device_id !==
            "ABS-001"
        ) {

            throw new Error(
                `Wrong scanner detected: ${result.device_id}`
            );

        }


        esp32Connected =
            true;


        setScannerStatus(
            `ESP32 Connected | Device: ${result.device_id || "ABS-001"} | IP: ${result.ip_address || baseUrl}`,
            "scannerStatus"
        );


        const operatorStatus =
            document.getElementById(
                "operatorScannerStatus"
            );


        if (operatorStatus) {

            operatorStatus.textContent =
                "Scanner status: ESP32 connected and ready.";

        }


        updateESP32ConnectionIndicator(
            true,
            result
        );


        return result;


    } catch (error) {

        esp32Connected =
            false;


        console.error(
            "ESP32 connection error:",
            error
        );


        setScannerStatus(
            `ESP32 connection failed: ${error.message}`,
            "scannerStatus"
        );


        const operatorStatus =
            document.getElementById(
                "operatorScannerStatus"
            );


        if (operatorStatus) {

            operatorStatus.textContent =
                `Scanner status: Connection failed - ${error.message}`;

        }


        updateESP32ConnectionIndicator(
            false
        );

    }

}


// ============================================================
// DISCONNECT ESP32
// ============================================================

function disconnectESP32() {

    if (
        patientScannerRunning ||
        referenceScannerRunning
    ) {

        alert(
            "Stop the current scan before disconnecting."
        );

        return;

    }


    esp32Connected =
        false;


    stopWirelessPolling();


    setScannerStatus(
        "ESP32 disconnected.",
        "scannerStatus"
    );


    const operatorStatus =
        document.getElementById(
            "operatorScannerStatus"
        );


    if (operatorStatus) {

        operatorStatus.textContent =
            "Scanner status: ESP32 disconnected.";

    }


    updateESP32ConnectionIndicator(
        false
    );

}


// ============================================================
// ESP32 CONNECTION INDICATOR
// ============================================================

function updateESP32ConnectionIndicator(
    connected,
    status = null
) {

    const elements =
        document.querySelectorAll(
            "[data-esp32-status]"
        );


    elements.forEach(
        function (element) {

            if (connected) {

                element.textContent =
                    status &&
                    status.device_id
                        ? `ESP32 Connected - ${status.device_id}`
                        : "ESP32 Connected";

            } else {

                element.textContent =
                    "ESP32 Disconnected";

            }

        }
    );

}


// ============================================================
// SET SCANNER STATUS
// ============================================================

function setScannerStatus(
    message,
    elementId = "scannerStatus"
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            message;

    }

}


// ============================================================
// GET NUMERIC ESP32 SUBJECT ID
// ============================================================
//
// IMPORTANT:
//
// Latest ESP32 firmware requires:
//
//     subject_id
//
// to be numeric.
//
// Your website patient IDs are normally:
//
//     PAT-12345
//
// Therefore the numeric part is sent to ESP32.
//
// The actual Supabase patient UUID is still used when
// saving the result to scan_measurements.
//
// ============================================================

function getESP32SubjectId(
    patient
) {

    if (!patient) {

        throw new Error(
            "No patient selected."
        );

    }


    const candidates = [

        patient.device_subject_id,

        patient.subject_id,

        patient.patient_id

    ];


    for (
        const candidate of candidates
    ) {

        if (
            candidate ===
            null ||
            candidate ===
            undefined
        ) {

            continue;

        }


        const value =
            String(candidate)
                .trim();


        if (
            /^\d+$/.test(value)
        ) {

            return value;

        }


        const match =
            value.match(
                /\d+/
            );


        if (match) {

            return match[0];

        }

    }


    throw new Error(
        "The selected patient does not have a numeric patient/device ID that can be sent to the ESP32."
    );

}


// ============================================================
// START PATIENT SCAN
// ============================================================

async function startPatientScan() {

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


    if (
        patientScannerRunning ||
        referenceScannerRunning
    ) {

        alert(
            "A scan is already running."
        );

        return;

    }


    if (!esp32Connected) {

        alert(
            "Connect the ESP32 wirelessly first."
        );

        return;

    }


    let deviceSubjectId;


    try {

        deviceSubjectId =
            getESP32SubjectId(
                currentPatient
            );

    } catch (error) {

        alert(
            error.message
        );

        return;

    }


    patientScannerRunning =
        true;

    wirelessScanMode =
        "patient";

    latestWirelessResult =
        null;


    setScannerStatus(
        "Sending scan command to ESP32...",
        "operatorScannerStatus"
    );


    setScannerStatus(
        "ESP32 wireless connection: Starting scan...",
        "scannerStatus"
    );


    updateScanProgress(
        0,
        0
    );


    try {

        const response =
            await wirelessRequest(
                "/api/scan/start",
                {

                    method:
                        "POST",

                    body: {

                        device_id:
                            "ABS-001",

                        subject_id:
                            deviceSubjectId,

                        side:
                            currentMeasurementSide,

                        measurement_side:
                            currentMeasurementSide,

                        scan_type:
                            "PATIENT"

                    },

                    timeout:
                        7000

                }
            );


        if (
            response.success ===
            false
        ) {

            throw new Error(
                response.message ||
                "ESP32 rejected the scan command."
            );

        }


        setScannerStatus(
            "ESP32 wireless connection: Scan queued...",
            "scannerStatus"
        );


        setScannerStatus(
            "Scanner status: Scan queued...",
            "operatorScannerStatus"
        );


        startWirelessScanPolling();


    } catch (error) {

        console.error(
            "Start patient scan error:",
            error
        );


        patientScannerRunning =
            false;

        wirelessScanMode =
            null;


        setScannerStatus(
            `Scan failed to start: ${error.message}`,
            "operatorScannerStatus"
        );


        setScannerStatus(
            `ESP32 error: ${error.message}`,
            "scannerStatus"
        );


        alert(
            `Could not start the scan.\n\n${error.message}`
        );

    }

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
            500
        );


    pollWirelessScanStatus();

}


// ============================================================
// STOP WIRELESS POLLING
// ============================================================

function stopWirelessPolling() {

    if (
        wirelessPollTimer
    ) {

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

    if (!wirelessScanMode) {

        stopWirelessPolling();

        return;

    }


    try {

        const response =
            await wirelessRequest(
                "/api/scan/status",
                {
                    timeout: 5000
                }
            );


        if (
            response.success ===
            false
        ) {

            throw new Error(
                response.message ||
                "ESP32 status request failed."
            );

        }


        const state =
            String(
                response.state ||
                ""
            ).toLowerCase();


        const progress =
            Number(
                response.progress
            );


        const frequency =
            Number(
                response.frequency
            );


        updateScanProgress(
            Number.isFinite(progress)
                ? progress
                : 0,
            Number.isFinite(frequency)
                ? frequency
                : 0
        );


        if (
            state ===
            "queued"
        ) {

            setScannerStatus(
                "Scanner status: Scan queued...",
                "operatorScannerStatus"
            );

            setScannerStatus(
                "ESP32 wireless connection: Scan queued...",
                "scannerStatus"
            );

            return;

        }


        if (
            state ===
            "scanning"
        ) {

            const frequencyText =
                Number.isFinite(
                    frequency
                ) &&
                frequency > 0
                    ? ` | Frequency: ${frequency} Hz`
                    : "";


            const progressText =
                Number.isFinite(
                    progress
                )
                    ? ` | Progress: ${progress.toFixed(1)}%`
                    : "";


            setScannerStatus(
                `Scanner status: Scanning${frequencyText}${progressText}`,
                "operatorScannerStatus"
            );


            setScannerStatus(
                `ESP32 wireless connection: Scanning${frequencyText}${progressText}`,
                "scannerStatus"
            );


            return;

        }


        if (
            state ===
            "stopping"
        ) {

            setScannerStatus(
                "Scanner status: Stop requested...",
                "operatorScannerStatus"
            );


            setScannerStatus(
                "ESP32 wireless connection: Stopping...",
                "scannerStatus"
            );


            return;

        }


        if (
            state ===
            "stopped"
        ) {

            await handleWirelessScanStopped(
                response
            );

            return;

        }


        if (
            state ===
            "error"
        ) {

            await handleWirelessScanError(
                response
            );

            return;

        }


        if (
            state ===
            "complete" ||
            response.result_ready ===
            true
        ) {

            await handleWirelessScanComplete(
                response
            );

            return;

        }


        // Fallback for a firmware response that
        // has valid measurements but an unexpected state.

        if (
            isValidScannerResult(
                response
            )
        ) {

            await handleWirelessScanComplete(
                response
            );

        }


    } catch (error) {

        console.error(
            "Wireless polling error:",
            error
        );


        // Do not immediately stop polling for a
        // temporary network failure.

        setScannerStatus(
            `ESP32 status error: ${error.message}`,
            "scannerStatus"
        );

    }

}


// ============================================================
// HANDLE COMPLETE WIRELESS SCAN
// ============================================================

async function handleWirelessScanComplete(
    response
) {

    stopWirelessPolling();


    if (
        !isValidScannerResult(
            response
        )
    ) {

        patientScannerRunning =
            false;

        referenceScannerRunning =
            false;

        wirelessScanMode =
            null;


        setScannerStatus(
            "Scan completed, but the returned measurement is invalid.",
            "scannerStatus"
        );


        alert(
            "ESP32 completed the scan, but the result did not contain valid f0/RMS/Q/bandwidth data."
        );


        return;

    }


    latestWirelessResult =
        normalizeScannerResult(
            response
        );


    if (
        wirelessScanMode ===
        "patient"
    ) {

        try {

            setScannerStatus(
                "Scan complete. Validating and saving result...",
                "operatorScannerStatus"
            );


            setScannerStatus(
                "ESP32 wireless connection: Result received.",
                "scannerStatus"
            );


            const comparison =
                await calculateReferenceComparison(
                    latestWirelessResult,
                    currentPatient
                );


            const resultToSave = {

                ...latestWirelessResult,

                ...comparison

            };


            await savePatientMeasurement(
                resultToSave
            );


            patientScannerRunning =
                false;


            wirelessScanMode =
                null;


            displayLatestPatientResult(
                resultToSave
            );


            setScannerStatus(
                "Scanner status: Scan completed and saved successfully.",
                "operatorScannerStatus"
            );


            setScannerStatus(
                "ESP32 wireless connection: Scan complete.",
                "scannerStatus"
            );


        } catch (error) {

            console.error(
                "Saving wireless patient result error:",
                error
            );


            patientScannerRunning =
                false;

            wirelessScanMode =
                null;


            setScannerStatus(
                `Result received but saving failed: ${error.message}`,
                "operatorScannerStatus"
            );


            alert(
                `The ESP32 scan completed, but the website could not save the result.\n\n${error.message}`
            );

        }


        return;

    }


    if (
        wirelessScanMode ===
        "reference"
    ) {

        try {

            await handleWirelessReferenceResult(
                latestWirelessResult
            );


        } catch (error) {

            console.error(
                "Reference result error:",
                error
            );


            referenceScannerRunning =
                false;

            wirelessScanMode =
                null;


            setScannerStatus(
                `Reference result could not be saved: ${error.message}`,
                "referenceScannerStatus"
            );


            alert(
                `Reference scan completed, but saving failed.\n\n${error.message}`
            );

        }

    }

}


// ============================================================
// HANDLE STOPPED SCAN
// ============================================================

async function handleWirelessScanStopped(
    response
) {

    stopWirelessPolling();


    patientScannerRunning =
        false;

    referenceScannerRunning =
        false;

    wirelessScanMode =
        null;


    latestWirelessResult =
        null;


    setScannerStatus(
        "Scanner status: Scan stopped. No incomplete measurement was saved.",
        "operatorScannerStatus"
    );


    setScannerStatus(
        "ESP32 wireless connection: Scan stopped.",
        "scannerStatus"
    );


    const referenceStatus =
        document.getElementById(
            "referenceScannerStatus"
        );


    if (
        referenceStatus &&
        pendingReferenceScan
    ) {

        referenceStatus.textContent =
            "Scanner status: Reference scan stopped. No result was saved.";

    }


    updateScanProgress(
        0,
        0
    );

}


// ============================================================
// HANDLE SCAN ERROR
// ============================================================

async function handleWirelessScanError(
    response
) {

    stopWirelessPolling();


    patientScannerRunning =
        false;

    referenceScannerRunning =
        false;

    wirelessScanMode =
        null;


    const message =
        response.message ||
        "ESP32 reported a scan error.";


    setScannerStatus(
        `Scanner error: ${message}`,
        "scannerStatus"
    );


    setScannerStatus(
        `Scanner error: ${message}`,
        "operatorScannerStatus"
    );


    const referenceStatus =
        document.getElementById(
            "referenceScannerStatus"
        );


    if (
        referenceStatus
    ) {

        referenceStatus.textContent =
            `Scanner error: ${message}`;

    }

}


// ============================================================
// UPDATE SCAN PROGRESS
// ============================================================

function updateScanProgress(
    progress,
    frequency
) {

    const progressElements =
        document.querySelectorAll(
            "[data-scan-progress]"
        );


    progressElements.forEach(
        function (element) {

            if (
                Number.isFinite(
                    progress
                )
            ) {

                element.textContent =
                    `${progress.toFixed(1)}%`;

            }

        }
    );


    const progressBars =
        document.querySelectorAll(
            "[data-scan-progress-bar]"
        );


    progressBars.forEach(
        function (bar) {

            const safeProgress =
                Math.max(
                    0,
                    Math.min(
                        100,
                        Number(progress) ||
                        0
                    )
                );


            bar.style.width =
                `${safeProgress}%`;

        }
    );


    const frequencyElements =
        document.querySelectorAll(
            "[data-scan-frequency]"
        );


    frequencyElements.forEach(
        function (element) {

            if (
                Number.isFinite(
                    frequency
                ) &&
                frequency > 0
            ) {

                element.textContent =
                    `${frequency} Hz`;

            } else {

                element.textContent =
                    "—";

            }

        }
    );

}


// ============================================================
// VALIDATE SCANNER RESULT
// ============================================================

function isValidScannerResult(
    result
) {

    if (!result) {

        return false;

    }


    const f0 =
        Number(result.f0);

    const rms =
        Number(result.rms);

    const q =
        Number(result.q_factor);

    const bandwidth =
        Number(result.bandwidth);


    if (
        !Number.isFinite(f0) ||
        f0 <= 0
    ) {

        return false;

    }


    if (
        !Number.isFinite(rms) ||
        rms < 0
    ) {

        return false;

    }


    // Q factor and bandwidth may be unavailable
    // if the resonance bandwidth cannot be determined.
    //
    // Therefore they are allowed to be null/undefined,
    // but NaN is never accepted.

    if (
        result.q_factor !==
            null &&
        result.q_factor !==
            undefined &&
        result.q_factor !==
            "" &&
        !Number.isFinite(q)
    ) {

        return false;

    }


    if (
        result.bandwidth !==
            null &&
        result.bandwidth !==
            undefined &&
        result.bandwidth !==
            "" &&
        !Number.isFinite(bandwidth)
    ) {

        return false;

    }


    return true;

}


// ============================================================
// NORMALIZE ESP32 RESULT
// ============================================================

function normalizeScannerResult(
    result
) {

    const qValue =
        Number(result.q_factor);


    const bandwidthValue =
        Number(result.bandwidth);


    return {

        scan_id:
            result.scan_id ||
            generateScanId(),

        device_id:
            result.device_id ||
            "ABS-001",

        sensor_head_id:
            result.sensor_head_id ||
            "HEAD-001",

        subject_id:
            result.subject_id ||
            null,

        measurement_side:
            result.measurement_side ||
            result.side ||
            currentMeasurementSide ||
            null,

        scan_type:
            result.scan_type ||
            "PATIENT",

        f0:
            Number(result.f0),

        rms:
            Number(result.rms),

        q_factor:
            Number.isFinite(qValue)
                ? qValue
                : null,

        bandwidth:
            Number.isFinite(
                bandwidthValue
            )
                ? bandwidthValue
                : null,

        frequency_start:
            Number.isFinite(
                Number(
                    result.frequency_start
                )
            )
                ? Number(
                    result.frequency_start
                )
                : 200,

        frequency_end:
            Number.isFinite(
                Number(
                    result.frequency_end
                )
            )
                ? Number(
                    result.frequency_end
                )
                : 1200,

        frequency_step:
            Number.isFinite(
                Number(
                    result.frequency_step
                )
            )
                ? Number(
                    result.frequency_step
                )
                : 25,

        message:
            result.message ||
            null

    };

}


// ============================================================
// STOP PATIENT SCAN
// ============================================================

async function stopPatientScan() {

    if (
        !patientScannerRunning
    ) {

        return;

    }


    try {

        setScannerStatus(
            "Sending stop request to ESP32...",
            "operatorScannerStatus"
        );


        const response =
            await wirelessRequest(
                "/api/scan/stop",
                {

                    method:
                        "POST",

                    body: {

                        device_id:
                            "ABS-001"

                    },

                    timeout:
                        5000

                }
            );


        if (
            response.success ===
            false
        ) {

            throw new Error(
                response.message ||
                "ESP32 rejected stop request."
            );

        }


        setScannerStatus(
            "Scanner status: Stop requested...",
            "operatorScannerStatus"
        );


        setScannerStatus(
            "ESP32 wireless connection: Stop requested...",
            "scannerStatus"
        );


    } catch (error) {

        console.error(
            "Stop scan error:",
            error
        );


        alert(
            `Could not send stop request.\n\n${error.message}`
        );

    }

}


// ============================================================
// SAVE PATIENT MEASUREMENT
// ============================================================

async function savePatientMeasurement(
    result
) {

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


    if (
        !isValidScannerResult(
            result
        )
    ) {

        throw new Error(
            "Scanner returned invalid measurement data."
        );

    }


    const scanId =
        result.scan_id ||
        generateScanId();


    const measurement = {

        scan_id:
            scanId,

        f0:
            Number(result.f0),

        rms:
            Number(result.rms),

        q_factor:
            result.q_factor ===
                null ||
            result.q_factor ===
                undefined
                ? null
                : Number(
                    result.q_factor
                ),

        bandwidth:
            result.bandwidth ===
                null ||
            result.bandwidth ===
                undefined
                ? null
                : Number(
                    result.bandwidth
                ),

        user_id:
            currentUser.id,

        subject_id:
            currentPatient.id,

        measurement_side:
            result.measurement_side ||
            currentMeasurementSide,

        frequency_start:
            result.frequency_start ??
            200,

        frequency_end:
            result.frequency_end ??
            1200,

        frequency_step:
            result.frequency_step ??
            25,

        sensor_head_id:
            result.sensor_head_id ||
            null,

        reference_group_id:
            result.reference_group_id ||
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
            .from(
                "scan_measurements"
            )
            .insert(
                measurement
            )
            .select()
            .single();


    if (error) {

        console.error(
            "Saving patient measurement failed:",
            error
        );

        throw error;

    }


    await loadScans();


    if (
        currentProfile &&
        currentProfile.role ===
        "admin"
    ) {

        await loadAllScans();

    }


    return data;

}


// ============================================================
// CALCULATE REFERENCE COMPARISON
// ============================================================
//
// Reference group:
//
//     Age
//     Gender
//
// Side is kept in the stored scan but the reference
// grouping is primarily age/gender based.
//
// ============================================================

async function calculateReferenceComparison(
    result,
    patient
) {

    if (!patient) {

        return {};

    }


    const age =
        Number(
            patient.age
        );


    const gender =
        patient.gender;


    if (
        !Number.isFinite(age) ||
        !gender
    ) {

        return {

            comparison_status:
                "Reference group unavailable",

            notes:
                "Patient age or gender is unavailable."

        };

    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "reference_measurements"
            )
            .select("*")
            .eq(
                "gender",
                gender
            )
            .gte(
                "age",
                age - 2
            )
            .lte(
                "age",
                age + 2
            );


    if (error) {

        console.error(
            "Reference lookup error:",
            error
        );


        return {

            comparison_status:
                "Reference comparison unavailable",

            notes:
                "Reference database lookup failed."

        };

    }


    if (
        !data ||
        data.length === 0
    ) {

        return {

            comparison_status:
                "No matching reference group",

            notes:
                `No reference measurements found for ${gender}, age ${age}.`

        };

    }


    const referenceGroup =
        data;


    const f0Stats =
        calculateMeanSD(
            referenceGroup,
            "f0"
        );


    const rmsStats =
        calculateMeanSD(
            referenceGroup,
            "rms"
        );


    const qStats =
        calculateMeanSD(
            referenceGroup,
            "q_factor"
        );


    const bandwidthStats =
        calculateMeanSD(
            referenceGroup,
            "bandwidth"
        );


    const output = {

        reference_group_id:
            null,

        f0_deviation:
            calculatePercentDeviation(
                result.f0,
                f0Stats.mean
            ),

        rms_deviation:
            calculatePercentDeviation(
                result.rms,
                rmsStats.mean
            ),

        q_deviation:
            calculatePercentDeviation(
                result.q_factor,
                qStats.mean
            ),

        bandwidth_deviation:
            calculatePercentDeviation(
                result.bandwidth,
                bandwidthStats.mean
            ),

        f0_zscore:
            calculateZScore(
                result.f0,
                f0Stats.mean,
                f0Stats.sd
            ),

        rms_zscore:
            calculateZScore(
                result.rms,
                rmsStats.mean,
                rmsStats.sd
            ),

        q_zscore:
            calculateZScore(
                result.q_factor,
                qStats.mean,
                qStats.sd
            ),

        bandwidth_zscore:
            calculateZScore(
                result.bandwidth,
                bandwidthStats.mean,
                bandwidthStats.sd
            ),

        comparison_status:
            `Compared with ${referenceGroup.length} reference measurement(s)`,

        notes:
            `Reference group: ${gender}, age ${age - 2}-${age + 2}.`

    };


    return output;

}


// ============================================================
// MEAN + SD
// ============================================================

function calculateMeanSD(
    rows,
    field
) {

    const values =
        rows
            .map(
                function (row) {

                    return Number(
                        row[field]
                    );

                }
            )
            .filter(
                function (value) {

                    return Number.isFinite(
                        value
                    );

                }
            );


    if (!values.length) {

        return {

            mean:
                null,

            sd:
                null

        };

    }


    const mean =
        values.reduce(
            function (
                total,
                value
            ) {

                return total +
                    value;

            },
            0
        ) /
        values.length;


    if (
        values.length < 2
    ) {

        return {

            mean:
                mean,

            sd:
                null

        };

    }


    const variance =
        values.reduce(
            function (
                total,
                value
            ) {

                return total +
                    Math.pow(
                        value -
                        mean,
                        2
                    );

            },
            0
        ) /
        (
            values.length -
            1
        );


    return {

        mean:
            mean,

        sd:
            Math.sqrt(
                variance
            )

    };

}


// ============================================================
// PERCENT DEVIATION
// ============================================================

function calculatePercentDeviation(
    value,
    referenceMean
) {

    const number =
        Number(value);


    const mean =
        Number(
            referenceMean
        );


    if (
        !Number.isFinite(
            number
        ) ||
        !Number.isFinite(
            mean
        ) ||
        mean === 0
    ) {

        return null;

    }


    return (
        (
            number -
            mean
        ) /
        mean
    ) *
    100;

}


// ============================================================
// Z SCORE
// ============================================================

function calculateZScore(
    value,
    mean,
    sd
) {

    const number =
        Number(value);

    const average =
        Number(mean);

    const standardDeviation =
        Number(sd);


    if (
        !Number.isFinite(
            number
        ) ||
        !Number.isFinite(
            average
        ) ||
        !Number.isFinite(
            standardDeviation
        ) ||
        standardDeviation === 0
    ) {

        return null;

    }


    return (
        number -
        average
    ) /
    standardDeviation;

}


// ============================================================
// DISPLAY LATEST PATIENT RESULT
// ============================================================

function displayLatestPatientResult(
    result
) {

    const container =
        document.getElementById(
            "latestScanResult"
        );


    if (!container) {

        return;

    }


    container.innerHTML = `

        <div class="patient-result">

            <h3>
                Scan Result
            </h3>

            <p>
                Scan ID:
                <strong>
                    ${escapeHTML(
                        result.scan_id ||
                        ""
                    )}
                </strong>
            </p>

            <p>
                Measurement Side:
                <strong>
                    ${escapeHTML(
                        result.measurement_side ||
                        currentMeasurementSide ||
                        ""
                    )}
                </strong>
            </p>

            <p>
                Resonance Frequency (f₀):
                <strong>
                    ${formatNumber(
                        result.f0
                    )}
                    Hz
                </strong>
            </p>

            <p>
                RMS:
                <strong>
                    ${formatNumber(
                        result.rms
                    )}
                </strong>
            </p>

            <p>
                Q Factor:
                <strong>
                    ${formatNumber(
                        result.q_factor
                    )}
                </strong>
            </p>

            <p>
                Bandwidth:
                <strong>
                    ${formatNumber(
                        result.bandwidth
                    )}
                    Hz
                </strong>
            </p>

            <p>
                Reference Comparison:
                <strong>
                    ${escapeHTML(
                        result.comparison_status ||
                        "Not available"
                    )}
                </strong>
            </p>

            ${
                result.f0_deviation !==
                    null &&
                result.f0_deviation !==
                    undefined
                    ? `
                    <p>
                        f₀ deviation:
                        ${formatNumber(
                            result.f0_deviation
                        )}%
                    </p>
                    `
                    : ""
            }

            ${
                result.rms_deviation !==
                    null &&
                result.rms_deviation !==
                    undefined
                    ? `
                    <p>
                        RMS deviation:
                        ${formatNumber(
                            result.rms_deviation
                        )}%
                    </p>
                    `
                    : ""
            }

            ${
                result.q_deviation !==
                    null &&
                result.q_deviation !==
                    undefined
                    ? `
                    <p>
                        Q deviation:
                        ${formatNumber(
                            result.q_deviation
                        )}%
                    </p>
                    `
                    : ""
            }

            ${
                result.bandwidth_deviation !==
                    null &&
                result.bandwidth_deviation !==
                    undefined
                    ? `
                    <p>
                        Bandwidth deviation:
                        ${formatNumber(
                            result.bandwidth_deviation
                        )}%
                    </p>
                    `
                    : ""
            }

            <p class="prototype-warning">

                Academic/research measurement only.
                This result is not a clinical diagnosis
                and is not a replacement for DEXA.

            </p>

        </div>

    `;

}


// ============================================================
// GENERATE SCAN ID
// ============================================================

function generateScanId() {

    const timestamp =
        Date.now()
            .toString()
            .slice(-10);


    const random =
        Math.floor(
            100 +
            Math.random() *
            900
        );


    return `SCAN-${timestamp}-${random}`;

}


// ============================================================
// CANCEL SCAN PREPARATION
// ============================================================

function cancelScanPreparation() {

    if (
        patientScannerRunning ||
        referenceScannerRunning
    ) {

        alert(
            "Stop the active scan before cancelling."
        );

        return;

    }


    currentPatient =
        null;

    currentMeasurementSide =
        null;


    const preparation =
        document.getElementById(
            "scanPreparation"
        );


    if (preparation) {

        preparation
            .classList
            .add("hidden");

    }

}


// ============================================================
// OPERATOR SCAN HISTORY
// ============================================================

async function loadScans() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "scan_measurements"
            )
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
        document.getElementById(
            "scansList"
        );


    if (!table) {

        return;

    }


    table.innerHTML = "";


    if (!data.length) {

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
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        scan.scan_id ||
                        ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        patient.name ||
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
                    ${formatNumber(
                        scan.f0
                    )}
                </td>

                <td>
                    ${formatNumber(
                        scan.rms
                    )}
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
// DELETE PATIENT MEASUREMENT
// ============================================================

async function deletePatientMeasurement(
    id
) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this patient measurement?\n\nThis action cannot be undone."
        );


    if (!confirmed) {

        return;

    }


    const {
        error
    } =
        await supabaseClient
            .from(
                "scan_measurements"
            )
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
            `Could not delete measurement:\n\n${error.message}`
        );


        return;

    }


    alert(
        "Patient measurement deleted successfully."
    );


    if (
        currentProfile &&
        currentProfile.role ===
        "admin"
    ) {

        await loadAllScans();

    }


    if (
        currentProfile &&
        currentProfile.role ===
        "operator"
    ) {

        await loadScans();

    }

}


// ============================================================
// REFERENCE TABS
// ============================================================

function showReferenceTab(
    tab
) {

    const manualPanel =
        document.getElementById(
            "manualReferencePanel"
        );

    const scannerPanel =
        document.getElementById(
            "scannerReferencePanel"
        );

    const manualButton =
        document.getElementById(
            "manualReferenceTab"
        );

    const scannerButton =
        document.getElementById(
            "scannerReferenceTab"
        );


    if (
        tab ===
        "manual"
    ) {

        if (manualPanel) {

            manualPanel
                .classList
                .remove("hidden");

        }


        if (scannerPanel) {

            scannerPanel
                .classList
                .add("hidden");

        }


        if (manualButton) {

            manualButton
                .classList
                .add("active");

        }


        if (scannerButton) {

            scannerButton
                .classList
                .remove("active");

        }

    }


    else {

        if (manualPanel) {

            manualPanel
                .classList
                .add("hidden");

        }


        if (scannerPanel) {

            scannerPanel
                .classList
                .remove("hidden");

        }


        if (manualButton) {

            manualButton
                .classList
                .remove("active");

        }


        if (scannerButton) {

            scannerButton
                .classList
                .add("active");

        }

    }

}


// ============================================================
// ADD MANUAL REFERENCE
// ============================================================

async function addManualReference() {

    const sampleId =
        document
            .getElementById(
                "referenceSampleId"
            )
            .value
            .trim();


    const referenceId =
        document
            .getElementById(
                "referenceId"
            )
            .value
            .trim();


    const age =
        parseInt(
            document
                .getElementById(
                    "referenceAge"
                )
                .value
        );


    const gender =
        document
            .getElementById(
                "referenceGender"
            )
            .value;


    const side =
        document
            .getElementById(
                "referenceSide"
            )
            .value;


    const f0 =
        parseFloat(
            document
                .getElementById(
                    "referenceF0"
                )
                .value
        );


    const rms =
        parseFloat(
            document
                .getElementById(
                    "referenceRMS"
                )
                .value
        );


    const qFactor =
        parseFloat(
            document
                .getElementById(
                    "referenceQ"
                )
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


    const notes =
        document
            .getElementById(
                "referenceNotes"
            )
            .value
            .trim();


    const message =
        document.getElementById(
            "referenceMessage"
        );


    if (
        !sampleId ||
        !Number.isFinite(age) ||
        !gender ||
        !side ||
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(qFactor) ||
        !Number.isFinite(bandwidth)
    ) {

        setMessage(
            message,
            "Please fill in Sample ID, age, gender, side, F₀, RMS, Q factor and bandwidth.",
            "error"
        );

        return;

    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "reference_measurements"
            )
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
// CLEAR MANUAL REFERENCE FORM
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
                document.getElementById(
                    id
                );


            if (element) {

                element.value =
                    "";

            }

        }
    );

}


// ============================================================
// REFERENCE SCANNER
// ============================================================

async function startReferenceScanner() {

    if (
        referenceScannerRunning ||
        patientScannerRunning
    ) {

        alert(
            "A scan is already running."
        );

        return;

    }


    if (!esp32Connected) {

        alert(
            "Connect the ESP32 wirelessly first."
        );

        return;

    }


    const sampleId =
        document
            .getElementById(
                "scannerReferenceSampleId"
            )
            .value
            .trim();


    const age =
        parseInt(
            document
                .getElementById(
                    "scannerReferenceAge"
                )
                .value
        );


    const gender =
        document
            .getElementById(
                "scannerReferenceGender"
            )
            .value;


    const side =
        document
            .getElementById(
                "scannerReferenceSide"
            )
            .value;


    if (
        !sampleId ||
        !Number.isFinite(age) ||
        !gender ||
        !side
    ) {

        alert(
            "Please enter Sample ID, age, gender and measurement side first."
        );

        return;

    }


    //
    // Latest ESP32 firmware requires numeric subject_id.
    //
    // Reference sample IDs can be text such as:
    //
    // REF001
    // REF-F-01
    // SAMPLE-A
    //
    // We therefore generate a deterministic numeric
    // device-side ID from the sample ID.
    //
    // This ID is ONLY for the ESP32 command.
    // The real sample_id is stored in Supabase.
    //

    const deviceReferenceId =
        createNumericDeviceId(
            sampleId
        );


    pendingReferenceScan = {

        sample_id:
            sampleId,

        age:
            age,

        gender:
            gender,

        measurement_side:
            side,

        reference_id:
            document
                .getElementById(
                    "scannerReferenceId"
                )
                ?.value
                ?.trim() ||
            null,

        notes:
            document
                .getElementById(
                    "scannerReferenceNotes"
                )
                ?.value
                ?.trim() ||
            null

    };


    referenceScannerRunning =
        true;

    wirelessScanMode =
        "reference";

    latestWirelessResult =
        null;


    const status =
        document.getElementById(
            "referenceScannerStatus"
        );


    if (status) {

        status.textContent =
            "Sending reference scan command to ESP32...";

    }


    try {

        const response =
            await wirelessRequest(
                "/api/scan/start",
                {

                    method:
                        "POST",

                    body: {

                        device_id:
                            "ABS-001",

                        subject_id:
                            deviceReferenceId,

                        side:
                            side,

                        measurement_side:
                            side,

                        scan_type:
                            "REFERENCE"

                    },

                    timeout:
                        7000

                }
            );


        if (
            response.success ===
            false
        ) {

            throw new Error(
                response.message ||
                "ESP32 rejected reference scan."
            );

        }


        if (status) {

            status.textContent =
                "Reference scan queued. Scanning...";

        }


        startWirelessScanPolling();


    } catch (error) {

        console.error(
            "Reference scan start error:",
            error
        );


        referenceScannerRunning =
            false;

        wirelessScanMode =
            null;

        pendingReferenceScan =
            null;


        if (status) {

            status.textContent =
                `Reference scan failed: ${error.message}`;

        }


        alert(
            `Could not start reference scan.\n\n${error.message}`
        );

    }

}


// ============================================================
// CREATE NUMERIC DEVICE ID
// ============================================================

function createNumericDeviceId(
    value
) {

    const text =
        String(value || "")
            .trim();


    if (
        /^\d+$/.test(text)
    ) {

        return text;

    }


    let hash =
        2166136261;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        hash ^=
            text.charCodeAt(i);

        hash =
            Math.imul(
                hash,
                16777619
            );

    }


    const positive =
        hash >>> 0;


    const numeric =
        (
            positive %
            900000000
        ) +
        100000000;


    return String(
        numeric
    );

}


// ============================================================
// STOP REFERENCE SCANNER
// ============================================================

async function stopReferenceScanner() {

    if (
        !referenceScannerRunning
    ) {

        return;

    }


    try {

        const response =
            await wirelessRequest(
                "/api/scan/stop",
                {

                    method:
                        "POST",

                    body: {

                        device_id:
                            "ABS-001"

                    },

                    timeout:
                        5000

                }
            );


        if (
            response.success ===
            false
        ) {

            throw new Error(
                response.message ||
                "ESP32 rejected stop request."
            );

        }


        const status =
            document.getElementById(
                "referenceScannerStatus"
            );


        if (status) {

            status.textContent =
                "Reference scanner: Stop requested...";

        }


    } catch (error) {

        console.error(
            "Reference stop error:",
            error
        );


        alert(
            `Could not stop reference scan.\n\n${error.message}`
        );

    }

}


// ============================================================
// HANDLE WIRELESS REFERENCE RESULT
// ============================================================

async function handleWirelessReferenceResult(
    result
) {

    if (
        !pendingReferenceScan
    ) {

        throw new Error(
            "Reference scan metadata is missing."
        );

    }


    const referenceData = {

        sample_id:
            pendingReferenceScan.sample_id,

        reference_id:
            pendingReferenceScan.reference_id ||
            null,

        age:
            pendingReferenceScan.age,

        gender:
            pendingReferenceScan.gender,

        measurement_side:
            pendingReferenceScan.measurement_side,

        f0:
            result.f0,

        rms:
            result.rms,

        q_factor:
            result.q_factor,

        bandwidth:
            result.bandwidth,

        notes:
            pendingReferenceScan.notes ||
            null

    };


    await saveScannerReferenceMeasurement(
        referenceData
    );


    referenceScannerRunning =
        false;

    wirelessScanMode =
        null;


    const status =
        document.getElementById(
            "referenceScannerStatus"
        );


    if (status) {

        status.textContent =
            "Reference scanner: Measurement saved successfully.";

    }


    setScannerStatus(
        "ESP32 wireless connection: Reference scan complete.",
        "scannerStatus"
    );


    pendingReferenceScan =
        null;


    await loadAdminReferences();


    alert(
        "Reference measurement completed and saved successfully."
    );

}


// ============================================================
// SAVE SCANNER REFERENCE MEASUREMENT
// ============================================================

async function saveScannerReferenceMeasurement(
    result
) {

    if (!result) {

        throw new Error(
            "Scanner result is missing."
        );

    }


    if (
        !Number.isFinite(
            Number(result.f0)
        ) ||
        !Number.isFinite(
            Number(result.rms)
        )
    ) {

        throw new Error(
            "Invalid reference measurement."
        );

    }


    const qValue =
        Number(
            result.q_factor
        );


    const bandwidthValue =
        Number(
            result.bandwidth
        );


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "reference_measurements"
            )
            .insert({

                sample_id:
                    result.sample_id,

                reference_id:
                    result.reference_id ||
                    null,

                age:
                    result.age,

                gender:
                    result.gender,

                measurement_side:
                    result.measurement_side,

                f0:
                    Number(
                        result.f0
                    ),

                rms:
                    Number(
                        result.rms
                    ),

                q_factor:
                    Number.isFinite(
                        qValue
                    )
                        ? qValue
                        : null,

                bandwidth:
                    Number.isFinite(
                        bandwidthValue
                    )
                        ? bandwidthValue
                        : null,

                notes:
                    result.notes ||
                    null

            })
            .select()
            .single();


    if (error) {

        console.error(
            "Scanner reference save error:",
            error
        );

        throw error;

    }


    return data;

}


// ============================================================
// RENDER REFERENCE TABLE
// ============================================================

function renderReferenceTable(
    data,
    allowDelete
) {

    const table =
        document.getElementById(
            "referenceTable"
        );


    if (!table) {

        return;

    }


    table.innerHTML =
        "";


    if (
        !data ||
        !data.length
    ) {

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
                document.createElement(
                    "tr"
                );


            let action =
                "";


            if (
                allowDelete
            ) {

                action = `

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
                        reference.sample_id ||
                        ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.reference_id ||
                        ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        String(
                            reference.age ??
                            ""
                        )
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.gender ||
                        ""
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

async function deleteReferenceMeasurement(
    id
) {

    if (
        !currentProfile ||
        currentProfile.role !==
        "admin"
    ) {

        alert(
            "Only an admin can delete reference measurements."
        );

        return;

    }


    const confirmed =
        confirm(
            "Are you sure you want to delete this reference measurement?\n\nThis action cannot be undone."
        );


    if (!confirmed) {

        return;

    }


    const {
        error
    } =
        await supabaseClient
            .from(
                "reference_measurements"
            )
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
            `Could not delete reference measurement:\n\n${error.message}`
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

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "reference_measurements"
            )
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
        document.getElementById(
            "referenceList"
        );


    if (!table) {

        return;

    }


    table.innerHTML =
        "";


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
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        reference.sample_id ||
                        ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.reference_id ||
                        ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        String(
                            reference.age ??
                            ""
                        )
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.gender ||
                        ""
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

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "scanner_devices"
            )
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    const container =
        document.getElementById(
            "adminScannerDevices"
        );


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


    container.innerHTML =
        "";


    if (!data.length) {

        container.textContent =
            "No scanner devices registered.";

        return;

    }


    data.forEach(
        function (device) {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "patient-card";


            div.innerHTML = `

                <strong>
                    ${escapeHTML(
                        device.device_id ||
                        ""
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

async function patientAccess() {

    const code =
        document
            .getElementById(
                "patientLinkingCode"
            )
            .value
            .trim();


    const message =
        document.getElementById(
            "patientAccessMessage"
        );


    if (
        !/^\d{6}$/.test(
            code
        )
    ) {

        setMessage(
            message,
            "Please enter a valid 6-digit linking code.",
            "error"
        );

        return;

    }


    setMessage(
        message,
        "Loading patient results...",
        "info"
    );


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
            "Patient access error:",
            error
        );


        setMessage(
            message,
            "Unable to access patient results.",
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

}


// ============================================================
// DISPLAY PATIENT RESULTS
// ============================================================

function displayPatientResults(
    data
) {

    const first =
        data[0];


    const loginScreen =
        document.getElementById(
            "loginScreen"
        );

    const dashboard =
        document.getElementById(
            "dashboard"
        );

    const patientResultScreen =
        document.getElementById(
            "patientResultScreen"
        );


    if (loginScreen) {

        loginScreen
            .classList
            .add("hidden");

    }


    if (dashboard) {

        dashboard
            .classList
            .add("hidden");

    }


    if (patientResultScreen) {

        patientResultScreen
            .classList
            .remove("hidden");

    }


    const patientDetails =
        document.getElementById(
            "patientDetails"
        );


    if (patientDetails) {

        patientDetails.innerHTML = `

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
                        String(
                            first.patient_age ??
                            ""
                        )
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
        document.getElementById(
            "patientScanResults"
        );


    if (!results) {

        return;

    }


    results.innerHTML =
        "";


    const validScans =
        data.filter(
            function (item) {

                return item.scan_id;

            }
        );


    if (
        !validScans.length
    ) {

        results.innerHTML =
            `
            <div class="empty">
                No scan measurements are available yet.
            </div>
            `;

        return;

    }


    validScans.forEach(
        function (scan) {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "patient-result";


            div.innerHTML = `

                <h3>
                    Scan:
                    ${escapeHTML(
                        scan.scan_id ||
                        ""
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
                    Comparison:
                    ${escapeHTML(
                        scan.comparison_status ||
                        "Not available"
                    )}
                </p>

                <p class="prototype-warning">

                    This system is an academic/research
                    prototype and does not provide a
                    clinical diagnosis.

                </p>

            `;


            results.appendChild(
                div
            );

        }
    );

}


// ============================================================
// BACK TO LOGIN
// ============================================================

function backToLogin() {

    const resultScreen =
        document.getElementById(
            "patientResultScreen"
        );


    if (resultScreen) {

        resultScreen
            .classList
            .add("hidden");

    }


    const code =
        document.getElementById(
            "patientLinkingCode"
        );


    if (code) {

        code.value =
            "";

    }


    const message =
        document.getElementById(
            "patientAccessMessage"
        );


    if (message) {

        message.innerHTML =
            "";

    }


    showLogin();

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

        modal
            .classList
            .add("hidden");

    }

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    stopWirelessPolling();


    try {

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


    } catch (error) {

        console.error(
            "Logout exception:",
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

    patientScannerRunning =
        false;

    referenceScannerRunning =
        false;

    wirelessScanMode =
        null;

    pendingReferenceScan =
        null;

    latestWirelessResult =
        null;


    const loginEmail =
        document.getElementById(
            "loginEmail"
        );


    const loginPassword =
        document.getElementById(
            "loginPassword"
        );


    const loginMessage =
        document.getElementById(
            "loginMessage"
        );


    if (loginEmail) {

        loginEmail.value =
            "";

    }


    if (loginPassword) {

        loginPassword.value =
            "";

    }


    if (loginMessage) {

        loginMessage.innerHTML =
            "";

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

function formatNumber(
    value
) {

    if (
        value ===
            null ||
        value ===
            undefined ||
        value ===
            ""
    ) {

        return "—";

    }


    const number =
        Number(value);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "—";

    }


    return number.toFixed(
        3
    );

}


// ============================================================
// DATE FORMATTER
// ============================================================

function formatDate(
    value
) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(
            value
        );


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

function escapeHTML(
    value
) {

    if (
        value ===
            null ||
        value ===
            undefined
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
// ADMIN / OPERATOR HELPERS
// ============================================================

function isAdmin() {

    return (
        currentProfile &&
        currentProfile.role ===
        "admin"
    );

}


function isOperator() {

    return (
        currentProfile &&
        currentProfile.role ===
        "operator"
    );

}


// ============================================================
// EXPOSE FUNCTIONS TO HTML
// ============================================================

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

window.connectESP32 =
    connectESP32;

window.disconnectESP32 =
    disconnectESP32;

window.getESP32BaseUrl =
    getESP32BaseUrl;

window.wirelessRequest =
    wirelessRequest;

window.isAdmin =
    isAdmin;

window.isOperator =
    isOperator;


// ============================================================
// END OF app.js
// ============================================================
