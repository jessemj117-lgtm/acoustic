// ============================================================
// GROUP 4 ACOUSTIC BONE DENSITY SCANNER
// WEBSITE APPLICATION
//
// GitHub Pages + Supabase + ESP32 Web Serial
// ============================================================


// ============================================================
// SUPABASE CONFIGURATION
// ============================================================
//
// IMPORTANT:
// Put your current Supabase URL and PUBLISHABLE/ANON KEY here.
//
// NEVER put a Supabase service-role/secret key in this file.
//
// ============================================================

const SUPABASE_URL = "https://ropiudyalwarmowaiugu.supabase.co";
const SUPABASE_KEY = "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";

const { createClient } = window.supabase;

const supabaseClient = createClient(
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

let referenceScannerRunning = false;
let patientScannerRunning = false;


// ============================================================
// ESP32 SERIAL VARIABLES
// ============================================================

let serialPort = null;
let serialReader = null;
let serialKeepReading = false;

let serialBuffer = "";

let scannerConnected = false;
let scannerBusy = false;

const SCANNER_DEVICE_ID = "ABS-001";


// ============================================================
// DOM READY
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        setupPatientCodeInput();

        if (!("serial" in navigator)) {

            updateScannerStatus(
                "Web Serial is not supported by this browser. Use Chrome or Edge on a supported computer.",
                "disconnected"
            );

        }

        try {

            const {
                data,
                error
            } = await supabaseClient.auth.getSession();

            if (error) {

                console.error(error);

                showLogin();

                return;
            }

            if (data.session) {

                currentUser = data.session.user;

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
// PATIENT CODE INPUT
// ============================================================

function setupPatientCodeInput() {

    const input =
        document.getElementById(
            "patientLinkingCode"
        );

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        function () {

            this.value =
                this.value
                    .replace(/\D/g, "")
                    .slice(0, 6);
        }
    );
}


// ============================================================
// LOGIN SCREEN
// ============================================================

function showLogin() {

    document
        .getElementById("loginScreen")
        .classList
        .remove("hidden");

    document
        .getElementById("dashboard")
        .classList
        .add("hidden");

    document
        .getElementById("patientResultScreen")
        .classList
        .add("hidden");
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
        document
            .getElementById("loginMessage");

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

    const {
        data,
        error
    } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    if (error) {

        console.error(error);

        setMessage(
            message,
            error.message,
            "error"
        );

        return;
    }

    currentUser = data.user;

    await loadDashboard();
}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    if (!currentUser) {

        const {
            data
        } =
            await supabaseClient.auth.getUser();

        currentUser = data.user;
    }

    if (!currentUser) {

        showLogin();

        return;
    }

    const profile =
        await loadProfile();

    if (!profile) {

        setMessage(
            document.getElementById("loginMessage"),
            "Your profile could not be loaded.",
            "error"
        );

        return;
    }

    currentProfile = profile;

    document
        .getElementById("loginScreen")
        .classList
        .add("hidden");

    document
        .getElementById("patientResultScreen")
        .classList
        .add("hidden");

    document
        .getElementById("dashboard")
        .classList
        .remove("hidden");

    document
        .getElementById("adminDashboard")
        .classList
        .add("hidden");

    document
        .getElementById("operatorDashboard")
        .classList
        .add("hidden");

    document
        .getElementById("userInfo")
        .textContent =
            `${profile.full_name || profile.email || currentUser.email} | Role: ${profile.role}`;

    if (profile.role === "admin") {

        document
            .getElementById("adminDashboard")
            .classList
            .remove("hidden");

        await loadAdminDashboard();

    }

    else if (profile.role === "operator") {

        document
            .getElementById("operatorDashboard")
            .classList
            .remove("hidden");

        await loadOperatorDashboard();

    }

    else {

        console.error(
            "Unknown user role:",
            profile.role
        );

        showLogin();
    }
}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {

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

    table.innerHTML = "";

    let operatorCount = 0;

    data.forEach(
        function (user) {

            if (user.role === "operator") {
                operatorCount++;
            }

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(user.email || "")}</td>
                <td>${escapeHTML(user.full_name || "")}</td>
                <td>${escapeHTML(user.role || "")}</td>
                <td>${formatDate(user.created_at)}</td>
            `;

            table.appendChild(row);
        }
    );

    document
        .getElementById("adminUsers")
        .textContent =
            operatorCount;
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

    document
        .getElementById("adminSubjects")
        .textContent =
            data.length;

    const container =
        document.getElementById(
            "adminSubjectsList"
        );

    container.innerHTML = "";

    if (!data.length) {

        container.innerHTML =
            `<div class="empty">No patients registered.</div>`;

        return;
    }

    data.forEach(
        function (patient) {

            const div =
                document.createElement("div");

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
                        String(patient.age ?? "")
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
            `;

            container.appendChild(div);
        }
    );
}


// ============================================================
// ADMIN PATIENT SCANS
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

    document
        .getElementById("adminScans")
        .textContent =
            data.length;

    const table =
        document.getElementById(
            "adminScansTable"
        );

    table.innerHTML = "";

    if (!data.length) {

        table.innerHTML = `
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
                scan.subjects || {};

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
                    ${formatNumber(scan.q_factor)}
                </td>

                <td>
                    ${formatNumber(scan.bandwidth)}
                </td>

                <td>
                    ${escapeHTML(
                        scan.comparison_status || ""
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
                        onclick="deletePatientMeasurement('${scan.id}')"
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
// ADMIN REFERENCES
// ============================================================

async function loadAdminReferences() {

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
            "Reference error:",
            error
        );

        return;
    }

    document
        .getElementById("adminReferences")
        .textContent =
            data.length;

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

    updateScannerStatus(
        scannerConnected
            ? "ESP32 scanner connection: Connected"
            : "ESP32 scanner connection: Not connected",
        scannerConnected
            ? "connected"
            : "disconnected"
    );
}


// ============================================================
// OPERATOR PATIENTS
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

    container.innerHTML = "";

    if (!data.length) {

        container.innerHTML =
            `<div class="empty">No patients registered yet.</div>`;

        return;
    }

    data.forEach(
        function (patient) {

            const div =
                document.createElement("div");

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
                        String(patient.age ?? "")
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
                    onclick='selectPatient(${JSON.stringify(patient)})'
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
        document.getElementById(
            "subjectMessage"
        );

    if (
        !name ||
        !Number.isFinite(age) ||
        age < 1 ||
        age > 120 ||
        !gender
    ) {

        setMessage(
            message,
            "Please fill in all patient details.",
            "error"
        );

        return;
    }

    const patientId =
        generatePatientId();

    let linkingCode;

    try {

        linkingCode =
            await generateUniqueLinkingCode();

    } catch (error) {

        console.error(error);

        setMessage(
            message,
            "Could not generate a unique patient linking code.",
            "error"
        );

        return;
    }

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

    document
        .getElementById("createdPatientInfo")
        .innerHTML = `

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
                Give this 6-digit linking code to the patient
                so they can view their results.
            </p>
        `;

    document
        .getElementById("patientModal")
        .classList
        .remove("hidden");

    document
        .getElementById("subjectName")
        .value = "";

    document
        .getElementById("subjectAge")
        .value = "";

    document
        .getElementById("subjectGender")
        .value = "";

    setMessage(
        message,
        "Patient registered successfully.",
        "success"
    );

    await loadSubjects();
}


// ============================================================
// GENERATE PATIENT ID
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

    preparation
        .classList
        .remove("hidden");

    document
        .getElementById(
            "selectedPatientInfo"
        )
        .innerHTML = `

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
                        String(patient.age ?? "")
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

    document
        .getElementById(
            "selectedSideText"
        )
        .textContent =
            "No side selected.";

    document
        .getElementById(
            "leftSideButton"
        )
        .classList
        .remove("selected");

    document
        .getElementById(
            "rightSideButton"
        )
        .classList
        .remove("selected");

    updateScannerStatus(
        scannerConnected
            ? "ESP32 scanner connection: Connected"
            : "ESP32 scanner connection: Not connected",
        scannerConnected
            ? "connected"
            : "disconnected"
    );

    preparation.scrollIntoView({
        behavior: "smooth"
    });
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

    currentMeasurementSide =
        side;

    document
        .getElementById(
            "selectedSideText"
        )
        .textContent =
            `Selected measurement side: ${side}`;

    document
        .getElementById(
            "leftSideButton"
        )
        .classList
        .remove("selected");

    document
        .getElementById(
            "rightSideButton"
        )
        .classList
        .remove("selected");

    if (side === "Left") {

        document
            .getElementById(
                "leftSideButton"
            )
            .classList
            .add("selected");
    }

    if (side === "Right") {

        document
            .getElementById(
                "rightSideButton"
            )
            .classList
            .add("selected");
    }
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

    if (!scannerConnected) {

        const connected =
            await connectESP32();

        if (!connected) {

            alert(
                "ESP32 scanner is not connected.\n\n" +
                "Connect ABS-001 using the Connect Scanner button " +
                "that appears after Web Serial is available."
            );

            return;
        }
    }

    if (scannerBusy) {

        alert(
            "The scanner is already performing a measurement."
        );

        return;
    }

    patientScannerRunning =
        true;

    scannerBusy =
        true;

    updateScannerStatus(
        "ESP32 scanner: Starting patient scan...",
        "working"
    );

    setOperatorScannerStatus(
        "Scanner status: Sending scan request to ESP32..."
    );

    const scanId =
        generateScanId();

    const command = {

        type:
            "START_SCAN",

        device_id:
            SCANNER_DEVICE_ID,

        scan_id:
            scanId,

        subject_id:
            currentPatient.id,

        patient_id:
            currentPatient.patient_id ||
            currentPatient.subject_id ||
            null,

        measurement_side:
            currentMeasurementSide,

        frequency_start:
            200,

        frequency_end:
            1200,

        frequency_step:
            25
    };

    try {

        await sendESP32Command(
            command
        );

        setOperatorScannerStatus(
            "Scanner status: Scan started. Waiting for real ESP32 measurement..."
        );

    } catch (error) {

        console.error(
            "ESP32 start scan error:",
            error
        );

        patientScannerRunning =
            false;

        scannerBusy =
            false;

        updateScannerStatus(
            "ESP32 scanner: Communication error.",
            "disconnected"
        );

        setOperatorScannerStatus(
            "Scanner status: Communication error."
        );

        alert(
            "Could not start the ESP32 scan.\n\n" +
            error.message
        );
    }
}


// ============================================================
// CANCEL SCAN PREPARATION
// ============================================================

async function cancelScanPreparation() {

    if (
        scannerConnected &&
        scannerBusy
    ) {

        try {

            await sendESP32Command({

                type:
                    "STOP_SCAN",

                device_id:
                    SCANNER_DEVICE_ID
            });

        } catch (error) {

            console.error(
                "Stop scanner error:",
                error
            );
        }
    }

    currentPatient =
        null;

    currentMeasurementSide =
        null;

    patientScannerRunning =
        false;

    scannerBusy =
        false;

    document
        .getElementById(
            "scanPreparation"
        )
        .classList
        .add("hidden");

    setOperatorScannerStatus(
        "Scanner status: Ready"
    );
}


// ============================================================
// SAVE PATIENT MEASUREMENT
// ============================================================

async function savePatientMeasurement(result) {

    if (!currentPatient) {

        throw new Error(
            "No patient selected."
        );
    }

    const measurementSide =
        result.measurement_side ||
        currentMeasurementSide;

    if (!measurementSide) {

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
            "ESP32 returned invalid measurement values."
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
            measurementSide,

        frequency_start:
            result.frequency_start ?? 200,

        frequency_end:
            result.frequency_end ?? 1200,

        frequency_step:
            result.frequency_step ?? 25,

        sensor_head_id:
            result.sensor_head_id ||
            null,

        reference_group_id:
            result.reference_group_id ||
            null,

        f0_deviation:
            finiteOrNull(
                result.f0_deviation
            ),

        rms_deviation:
            finiteOrNull(
                result.rms_deviation
            ),

        q_deviation:
            finiteOrNull(
                result.q_deviation
            ),

        bandwidth_deviation:
            finiteOrNull(
                result.bandwidth_deviation
            ),

        f0_zscore:
            finiteOrNull(
                result.f0_zscore
            ),

        rms_zscore:
            finiteOrNull(
                result.rms_zscore
            ),

        q_zscore:
            finiteOrNull(
                result.q_zscore
            ),

        bandwidth_zscore:
            finiteOrNull(
                result.bandwidth_zscore
            ),

        comparison_status:
            result.comparison_status ||
            null,

        notes:
            result.notes ||
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

    patientScannerRunning =
        false;

    scannerBusy =
        false;

    setOperatorScannerStatus(
        "Scanner status: Measurement received and saved successfully."
    );

    updateScannerStatus(
        "ESP32 scanner connection: Connected — measurement saved.",
        "connected"
    );

    await loadScans();

    if (
        currentProfile &&
        currentProfile.role === "admin"
    ) {

        await loadAllScans();
    }

    return data;
}


// ============================================================
// HANDLE ESP32 RESULT
// ============================================================

async function handleESP32Result(result) {

    console.log(
        "ESP32 result:",
        result
    );

    if (!result) {
        return;
    }

    // --------------------------------------------------------
    // Scanner connection message
    // --------------------------------------------------------

    if (
        result.type === "READY" ||
        result.type === "HELLO"
    ) {

        scannerConnected =
            true;

        updateScannerStatus(
            `ESP32 scanner ${SCANNER_DEVICE_ID}: Connected`,
            "connected"
        );

        return;
    }


    // --------------------------------------------------------
    // Scanner status message
    // --------------------------------------------------------

    if (
        result.type === "STATUS"
    ) {

        const status =
            result.message ||
            "ESP32 scanner status received.";

        updateScannerStatus(
            `ESP32 scanner: ${status}`,
            "working"
        );

        setOperatorScannerStatus(
            `Scanner status: ${status}`
        );

        return;
    }


    // --------------------------------------------------------
    // Scan started
    // --------------------------------------------------------

    if (
        result.type === "SCAN_STARTED"
    ) {

        scannerBusy =
            true;

        patientScannerRunning =
            true;

        setOperatorScannerStatus(
            "Scanner status: ESP32 is performing the acoustic sweep..."
        );

        updateScannerStatus(
            "ESP32 scanner: Performing acoustic sweep...",
            "working"
        );

        return;
    }


    // --------------------------------------------------------
    // Scan result
    // --------------------------------------------------------

    if (
        result.type === "RESULT" ||
        result.type === "SCAN_RESULT"
    ) {

        try {

            await savePatientMeasurement(
                result
            );

            alert(
                "Acoustic scan completed successfully.\n\n" +
                "F₀: " +
                formatNumber(result.f0) +
                " Hz\n" +
                "RMS: " +
                formatNumber(result.rms) +
                "\n" +
                "Q Factor: " +
                formatNumber(result.q_factor) +
                "\n" +
                "Bandwidth: " +
                formatNumber(result.bandwidth) +
                " Hz"
            );

        } catch (error) {

            console.error(
                "Saving ESP32 result failed:",
                error
            );

            scannerBusy =
                false;

            patientScannerRunning =
                false;

            setOperatorScannerStatus(
                "Scanner status: Result received, but database save failed."
            );

            updateScannerStatus(
                "ESP32 scanner: Result received but could not be saved.",
                "working"
            );

            alert(
                "The ESP32 returned a measurement, but it could not be saved.\n\n" +
                error.message
            );
        }

        return;
    }


    // --------------------------------------------------------
    // Scan stopped
    // --------------------------------------------------------

    if (
        result.type === "STOPPED"
    ) {

        scannerBusy =
            false;

        patientScannerRunning =
            false;

        setOperatorScannerStatus(
            "Scanner status: Scan stopped."
        );

        updateScannerStatus(
            "ESP32 scanner: Connected.",
            "connected"
        );

        return;
    }


    // --------------------------------------------------------
    // Error
    // --------------------------------------------------------

    if (
        result.type === "ERROR"
    ) {

        scannerBusy =
            false;

        patientScannerRunning =
            false;

        const message =
            result.message ||
            "ESP32 reported an error.";

        setOperatorScannerStatus(
            "Scanner status: " + message
        );

        updateScannerStatus(
            "ESP32 scanner error: " + message,
            "disconnected"
        );

        alert(
            "ESP32 scanner error:\n\n" +
            message
        );

        return;
    }


    // --------------------------------------------------------
    // Direct result without type
    // --------------------------------------------------------

    if (
        result.f0 !== undefined &&
        result.rms !== undefined &&
        result.q_factor !== undefined &&
        result.bandwidth !== undefined
    ) {

        try {

            await savePatientMeasurement(
                result
            );

        } catch (error) {

            console.error(
                error
            );
        }
    }
}


// ============================================================
// ESP32 WEB SERIAL CONNECTION
// ============================================================

async function connectESP32() {

    if (!("serial" in navigator)) {

        alert(
            "Web Serial is not supported in this browser.\n\n" +
            "Use a current version of Chrome or Edge on a computer."
        );

        return false;
    }

    try {

        if (!serialPort) {

            serialPort =
                await navigator.serial.requestPort();
        }

        await serialPort.open({
            baudRate: 115200
        });

        scannerConnected =
            true;

        serialKeepReading =
            true;

        updateScannerStatus(
            `ESP32 scanner ${SCANNER_DEVICE_ID}: Connected`,
            "connected"
        );

        setOperatorScannerStatus(
            "Scanner status: ESP32 connected."
        );

        startSerialReader();

        await sendESP32Command({

            type:
                "HELLO",

            device_id:
                SCANNER_DEVICE_ID
        });

        return true;

    } catch (error) {

        console.error(
            "ESP32 connection error:",
            error
        );

        scannerConnected =
            false;

        serialPort =
            null;

        updateScannerStatus(
            "ESP32 scanner connection: Not connected",
            "disconnected"
        );

        return false;
    }
}


// ============================================================
// SERIAL READER
// ============================================================

async function startSerialReader() {

    if (!serialPort) {
        return;
    }

    if (!serialPort.readable) {
        return;
    }

    try {

        serialReader =
            serialPort
                .readable
                .getReader();

        while (serialKeepReading) {

            const {
                value,
                done
            } =
                await serialReader.read();

            if (done) {
                break;
            }

            if (value) {

                const text =
                    new TextDecoder()
                        .decode(value);

                serialBuffer +=
                    text;

                processSerialBuffer();
            }
        }

    } catch (error) {

        console.error(
            "Serial reader error:",
            error
        );

        scannerConnected =
            false;

        updateScannerStatus(
            "ESP32 scanner connection lost.",
            "disconnected"
        );

    } finally {

        if (serialReader) {

            try {
                serialReader.releaseLock();
            } catch (error) {
                console.error(error);
            }

            serialReader =
                null;
        }
    }
}


// ============================================================
// PROCESS SERIAL BUFFER
// ============================================================

function processSerialBuffer() {

    const lines =
        serialBuffer.split(/\r?\n/);

    serialBuffer =
        lines.pop() || "";

    lines.forEach(
        function (line) {

            const trimmed =
                line.trim();

            if (!trimmed) {
                return;
            }

            console.log(
                "ESP32:",
                trimmed
            );

            // ------------------------------------------------
            // JSON protocol
            // ------------------------------------------------

            if (
                trimmed.startsWith("{") &&
                trimmed.endsWith("}")
            ) {

                try {

                    const result =
                        JSON.parse(trimmed);

                    handleESP32Result(
                        result
                    );

                    return;

                } catch (error) {

                    console.error(
                        "Invalid ESP32 JSON:",
                        error
                    );
                }
            }

            // ------------------------------------------------
            // Simple READY message
            // ------------------------------------------------

            if (
                trimmed === "READY" ||
                trimmed === "ESP32_READY"
            ) {

                scannerConnected =
                    true;

                updateScannerStatus(
                    `ESP32 scanner ${SCANNER_DEVICE_ID}: Connected`,
                    "connected"
                );

                return;
            }
        }
    );
}


// ============================================================
// SEND COMMAND TO ESP32
// ============================================================

async function sendESP32Command(command) {

    if (!serialPort) {

        throw new Error(
            "ESP32 serial port is not connected."
        );
    }

    if (!serialPort.writable) {

        throw new Error(
            "ESP32 serial connection is not writable."
        );
    }

    const writer =
        serialPort
            .writable
            .getWriter();

    try {

        const message =
            JSON.stringify(command) +
            "\n";

        await writer.write(
            new TextEncoder().encode(
                message
            )
        );

    } finally {

        writer.releaseLock();
    }
}


// ============================================================
// DISCONNECT ESP32
// ============================================================

async function disconnectESP32() {

    serialKeepReading =
        false;

    scannerBusy =
        false;

    patientScannerRunning =
        false;

    try {

        if (serialReader) {

            await serialReader.cancel();

            serialReader =
                null;
        }

    } catch (error) {

        console.error(error);
    }

    try {

        if (serialPort) {

            await serialPort.close();
        }

    } catch (error) {

        console.error(error);

    } finally {

        serialPort =
            null;

        scannerConnected =
            false;
    }

    updateScannerStatus(
        "ESP32 scanner connection: Not connected",
        "disconnected"
    );
}


// ============================================================
// ADD SCANNER CONNECT BUTTON
// ============================================================

function createScannerConnectButton() {

    if (
        document.getElementById(
            "connectScannerButton"
        )
    ) {
        return;
    }

    const status =
        document.getElementById(
            "scannerStatus"
        );

    if (!status) {
        return;
    }

    const button =
        document.createElement("button");

    button.id =
        "connectScannerButton";

    button.className =
        "success";

    button.textContent =
        "Connect ESP32 Scanner";

    button.onclick =
        async function () {

            if (scannerConnected) {

                await disconnectESP32();

                button.textContent =
                    "Connect ESP32 Scanner";

                return;
            }

            const connected =
                await connectESP32();

            if (connected) {

                button.textContent =
                    "Disconnect ESP32 Scanner";
            }
        };

    status.parentNode.insertBefore(
        button,
        status
    );
}


// ============================================================
// SCANNER STATUS
// ============================================================

function updateScannerStatus(
    message,
    state
) {

    const ids = [
        "scannerStatus",
        "operatorScannerStatus",
        "referenceScannerStatus"
    ];

    ids.forEach(
        function (id) {

            const element =
                document.getElementById(id);

            if (!element) {
                return;
            }

            if (
                id === "scannerStatus" ||
                id === "operatorScannerStatus"
            ) {

                element.textContent =
                    message;
            }

            element.classList.remove(
                "scanner-connected",
                "scanner-disconnected",
                "scanner-working"
            );

            if (state === "connected") {

                element.classList.add(
                    "scanner-connected"
                );

            } else if (
                state === "working"
            ) {

                element.classList.add(
                    "scanner-working"
                );

            } else {

                element.classList.add(
                    "scanner-disconnected"
                );
            }
        }
    );
}


function setOperatorScannerStatus(
    message
) {

    const element =
        document.getElementById(
            "operatorScannerStatus"
        );

    if (element) {

        element.textContent =
            message;
    }
}


// ============================================================
// OPERATOR SCANS
// ============================================================

async function loadScans() {

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
        document.getElementById(
            "scansList"
        );

    table.innerHTML = "";

    if (!data.length) {

        table.innerHTML = `
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
                scan.subjects || {};

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
                        scan.comparison_status || ""
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
                        onclick="deletePatientMeasurement('${scan.id}')"
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

async function deletePatientMeasurement(id) {

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
            "Could not delete measurement:\n\n" +
            error.message
        );

        return;
    }

    alert(
        "Patient measurement deleted successfully."
    );

    if (
        currentProfile &&
        currentProfile.role === "admin"
    ) {

        await loadAllScans();
    }

    if (
        currentProfile &&
        currentProfile.role === "operator"
    ) {

        await loadScans();
    }
}


// ============================================================
// REFERENCE TABS
// ============================================================

function showReferenceTab(tab) {

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

    if (tab === "manual") {

        manualPanel
            .classList
            .remove("hidden");

        scannerPanel
            .classList
            .add("hidden");

        manualButton
            .classList
            .add("active");

        scannerButton
            .classList
            .remove("active");

    } else {

        manualPanel
            .classList
            .add("hidden");

        scannerPanel
            .classList
            .remove("hidden");

        manualButton
            .classList
            .remove("active");

        scannerButton
            .classList
            .add("active");
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
                document.getElementById(id);

            if (element) {
                element.value = "";
            }
        }
    );
}


// ============================================================
// REFERENCE SCANNER
// ============================================================

async function startReferenceScanner() {

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

    const sensorHeadId =
        document
            .getElementById(
                "scannerReferenceSensorHead"
            )
            .value
            .trim();

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

    if (!scannerConnected) {

        const connected =
            await connectESP32();

        if (!connected) {

            alert(
                "Please connect the ESP32 scanner first."
            );

            return;
        }
    }

    referenceScannerRunning =
        true;

    updateScannerStatus(
        "ESP32 scanner: Starting reference scan...",
        "working"
    );

    document
        .getElementById(
            "referenceScannerStatus"
        )
        .textContent =
            "Scanner status: Sending reference scan request...";

    const command = {

        type:
            "START_REFERENCE_SCAN",

        device_id:
            SCANNER_DEVICE_ID,

        sample_id:
            sampleId,

        reference_id:
            document
                .getElementById(
                    "scannerReferenceId"
                )
                .value
                .trim() ||
            null,

        age:
            age,

        gender:
            gender,

        measurement_side:
            side,

        sensor_head_id:
            sensorHeadId ||
            null,

        frequency_start:
            200,

        frequency_end:
            1200,

        frequency_step:
            25
    };

    try {

        await sendESP32Command(
            command
        );

        document
            .getElementById(
                "referenceScannerStatus"
            )
            .textContent =
                "Scanner status: ESP32 is performing the reference scan...";

    } catch (error) {

        console.error(
            error
        );

        referenceScannerRunning =
            false;

        updateScannerStatus(
            "ESP32 scanner: Communication error.",
            "disconnected"
        );

        alert(
            "Could not start reference scan:\n\n" +
            error.message
        );
    }
}


// ============================================================
// STOP REFERENCE SCANNER
// ============================================================

async function stopReferenceScanner() {

    referenceScannerRunning =
        false;

    if (
        scannerConnected &&
        scannerBusy
    ) {

        try {

            await sendESP32Command({

                type:
                    "STOP_SCAN",

                device_id:
                    SCANNER_DEVICE_ID

            });

        } catch (error) {

            console.error(
                error
            );
        }
    }

    scannerBusy =
        false;

    document
        .getElementById(
            "referenceScannerStatus"
        )
        .textContent =
            "Scanner status: Stopped.";

    updateScannerStatus(
        scannerConnected
            ? "ESP32 scanner: Connected."
            : "ESP32 scanner: Not connected.",
        scannerConnected
            ? "connected"
            : "disconnected"
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
                    result.reference_id ||
                    null,

                age:
                    result.age,

                gender:
                    result.gender,

                measurement_side:
                    result.measurement_side,

                f0:
                    result.f0,

                rms:
                    result.rms,

                q_factor:
                    result.q_factor,

                bandwidth:
                    result.bandwidth,

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

    referenceScannerRunning =
        false;

    document
        .getElementById(
            "referenceScannerStatus"
        )
        .textContent =
            "Scanner status: Measurement saved successfully.";

    updateScannerStatus(
        "ESP32 scanner: Reference measurement saved.",
        "connected"
    );

    await loadAdminReferences();

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

    table.innerHTML = "";

    if (
        !data ||
        !data.length
    ) {

        table.innerHTML = `
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

            let action = "";

            if (allowDelete) {

                action = `
                    <button
                        class="danger"
                        onclick="deleteReferenceMeasurement('${reference.id}')"
                    >
                        Delete
                    </button>
                `;
            }

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
                        String(
                            reference.age ?? ""
                        )
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.gender || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.measurement_side || ""
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

    if (
        !currentProfile ||
        currentProfile.role !== "admin"
    ) {

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
            "Could not delete reference measurement:\n\n" +
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
        document.getElementById(
            "referenceList"
        );

    table.innerHTML = "";

    if (!data.length) {

        table.innerHTML = `
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
                        String(
                            reference.age ?? ""
                        )
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.gender || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reference.measurement_side || ""
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
            .from("scanner_devices")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(
            "Scanner devices error:",
            error
        );

        document
            .getElementById(
                "adminScannerDevices"
            )
            .textContent =
                "Unable to load scanner devices.";

        return;
    }

    const container =
        document.getElementById(
            "adminScannerDevices"
        );

    container.innerHTML = "";

    if (!data.length) {

        container.innerHTML =
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

    if (!/^\d{6}$/.test(code)) {

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

function displayPatientResults(data) {

    const first =
        data[0];

    document
        .getElementById(
            "loginScreen"
        )
        .classList
        .add("hidden");

    document
        .getElementById(
            "dashboard"
        )
        .classList
        .add("hidden");

    document
        .getElementById(
            "patientResultScreen"
        )
        .classList
        .remove("hidden");

    document
        .getElementById(
            "patientDetails"
        )
        .innerHTML = `

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

    const results =
        document.getElementById(
            "patientScanResults"
        );

    results.innerHTML = "";

    const validScans =
        data.filter(
            function (item) {
                return item.scan_id;
            }
        );

    if (!validScans.length) {

        results.innerHTML =
            `<div class="empty">
                No scan measurements are available yet.
            </div>`;

        return;
    }

    validScans.forEach(
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
                    Comparison:
                    ${escapeHTML(
                        scan.comparison_status ||
                        "Not available"
                    )}
                </p>
            `;

            results.appendChild(div);
        }
    );
}


// ============================================================
// BACK TO LOGIN
// ============================================================

function backToLogin() {

    document
        .getElementById(
            "patientResultScreen"
        )
        .classList
        .add("hidden");

    document
        .getElementById(
            "patientLinkingCode"
        )
        .value = "";

    document
        .getElementById(
            "patientAccessMessage"
        )
        .innerHTML = "";

    showLogin();
}


// ============================================================
// PATIENT MODAL
// ============================================================

function closePatientModal() {

    document
        .getElementById(
            "patientModal"
        )
        .classList
        .add("hidden");
}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    if (scannerConnected) {

        await disconnectESP32();
    }

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

    document
        .getElementById(
            "loginEmail"
        )
        .value = "";

    document
        .getElementById(
            "loginPassword"
        )
        .value = "";

    document
        .getElementById(
            "loginMessage"
        )
        .innerHTML = "";

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
        `<div class="message ${type}">
            ${escapeHTML(text)}
        </div>`;
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

    if (
        !Number.isFinite(number)
    ) {

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
// NUMBER HELPER
// ============================================================

function finiteOrNull(value) {

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
            Math.random() * 900
        );

    return `SCAN-${timestamp}-${random}`;
}


// ============================================================
// INITIALIZE SCANNER BUTTON
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setTimeout(
            function () {

                createScannerConnectButton();

            },
            500
        );
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
