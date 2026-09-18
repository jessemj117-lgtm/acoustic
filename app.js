// ============================================================
// GROUP 4 ACOUSTIC BONE DENSITY SCANNER
// GitHub Pages + Supabase + ESP32 Web Serial
// ============================================================

// ============================================================
// SUPABASE
// ============================================================

// Put your existing Supabase project URL here.
// Do NOT put the secret/service-role key here.

const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ============================================================
// GLOBAL STATE
// ============================================================

let currentUser = null;
let currentProfile = null;

let currentPatient = null;
let selectedMeasurementSide = null;

let serialPort = null;
let serialReader = null;
let serialConnected = false;
let serialReadBuffer = "";

let patientScanRunning = false;
let referenceScanRunning = false;


// ============================================================
// SAFE DOM HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}

function showElement(id) {
    const element = $(id);

    if (element) {
        element.classList.remove("hidden");
    }
}

function hideElement(id) {
    const element = $(id);

    if (element) {
        element.classList.add("hidden");
    }
}

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = value ?? "";
    }
}

function setHTML(id, html) {
    const element = $(id);

    if (element) {
        element.innerHTML = html;
    }
}


// ============================================================
// STARTUP
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    try {

        hideElement("dashboard");
        hideElement("patientResultScreen");

        showElement("loginScreen");

        const {
            data: {
                session
            },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        if (session && session.user) {

            currentUser = session.user;

            await loadDashboard();

        } else {

            showLogin();

        }

    } catch (error) {

        console.error("Startup error:", error);

        showLogin();

        setMessage(
            "loginMessage",
            "Startup error: " + error.message,
            "error"
        );

    }

    supabaseClient.auth.onAuthStateChange(
        async (event, session) => {

            if (event === "SIGNED_OUT") {

                currentUser = null;
                currentProfile = null;

                showLogin();

                return;
            }

            if (
                event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED"
            ) {

                if (session && session.user) {

                    currentUser = session.user;

                    try {
                        await loadDashboard();
                    } catch (error) {
                        console.error(
                            "Auth state dashboard error:",
                            error
                        );
                    }

                }

            }

        }
    );

});


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const email = $("loginEmail")?.value.trim();
    const password = $("loginPassword")?.value;

    if (!email || !password) {

        setMessage(
            "loginMessage",
            "Enter your email and password.",
            "error"
        );

        return;
    }

    setMessage(
        "loginMessage",
        "Logging in...",
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

        await loadDashboard();

    } catch (error) {

        console.error("Login error:", error);

        setMessage(
            "loginMessage",
            error.message,
            "error"
        );

    }

}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    if (!currentUser) {

        const {
            data: {
                user
            }
        } = await supabaseClient.auth.getUser();

        currentUser = user;
    }

    if (!currentUser) {

        showLogin();

        return;
    }


    const {
        data: profile,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!profile) {

        throw new Error(
            "No profile found for this login."
        );

    }

    currentProfile = profile;


    hideElement("loginScreen");
    hideElement("patientResultScreen");

    showElement("dashboard");

    hideElement("adminDashboard");
    hideElement("operatorDashboard");


    setText(
        "userInfo",
        `${profile.full_name || profile.email || currentUser.email} | Role: ${profile.role}`
    );


    const role = String(profile.role || "").toLowerCase();


    if (role === "admin") {

        showElement("adminDashboard");

        await loadAdminDashboard();

    } else if (role === "operator") {

        showElement("operatorDashboard");

        await loadOperatorDashboard();

    } else {

        throw new Error(
            "This account does not have an Admin or Operator role."
        );

    }

}


// ============================================================
// SHOW LOGIN
// ============================================================

function showLogin() {

    hideElement("dashboard");
    hideElement("adminDashboard");
    hideElement("operatorDashboard");
    hideElement("patientResultScreen");

    showElement("loginScreen");

    setText("loginEmail", "");
    setText("loginPassword", "");

}


// ============================================================
// ADMIN DASHBOARD
// ============================================================

async function loadAdminDashboard() {

    await Promise.all([
        loadAllUsers(),
        loadAllSubjects(),
        loadAllScans(),
        loadAdminReferences(),
        loadScannerDevices()
    ]);

}


// ============================================================
// ADMIN USERS
// ============================================================

async function loadAllUsers() {

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


    setText(
        "adminUsers",
        data?.length || 0
    );


    const rows = (data || [])
        .map(user => {

            return `
                <tr>
                    <td>${escapeHTML(user.email || "")}</td>
                    <td>${escapeHTML(user.full_name || "")}</td>
                    <td>${escapeHTML(user.role || "")}</td>
                    <td>${formatDate(user.created_at)}</td>
                </tr>
            `;

        })
        .join("");


    setHTML(
        "adminUsersTable",
        rows ||
        `<tr><td colspan="4">No users found.</td></tr>`
    );

}


// ============================================================
// ADMIN PATIENTS
// ============================================================

async function loadAllSubjects() {

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


    setText(
        "adminSubjects",
        data?.length || 0
    );


    const html = (data || [])
        .map(subject => {

            return `
                <div class="patient-card">

                    <h3>
                        ${escapeHTML(subject.name || "Unnamed Patient")}
                    </h3>

                    <div>
                        <strong>Patient ID:</strong>
                        ${escapeHTML(subject.patient_id || subject.subject_id || "")}
                    </div>

                    <div>
                        <strong>Age:</strong>
                        ${escapeHTML(String(subject.age ?? ""))}
                    </div>

                    <div>
                        <strong>Gender:</strong>
                        ${escapeHTML(subject.gender || "")}
                    </div>

                    <div>
                        <strong>Linking Code:</strong>
                        ${escapeHTML(subject.linking_code || "")}
                    </div>

                    <div>
                        <strong>Created:</strong>
                        ${formatDate(subject.created_at)}
                    </div>

                </div>
            `;

        })
        .join("");


    setHTML(
        "adminSubjectsList",
        html ||
        `<div class="empty">No patients found.</div>`
    );

}


// ============================================================
// ADMIN SCANS
// ============================================================

async function loadAllScans() {

    const {
        data,
        error
    } = await supabaseClient
        .from("scan_measurements")
        .select(`
            *,
            subjects (
                name,
                patient_id,
                subject_id
            )
        `)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }


    setText(
        "adminScans",
        data?.length || 0
    );


    const rows = (data || [])
        .map(scan => {

            const subject = scan.subjects || {};

            return `
                <tr>

                    <td>
                        ${escapeHTML(scan.scan_id || "")}
                    </td>

                    <td>
                        ${escapeHTML(subject.name || "")}
                    </td>

                    <td>
                        ${escapeHTML(
                            subject.patient_id ||
                            subject.subject_id ||
                            ""
                        )}
                    </td>

                    <td>
                        ${escapeHTML(scan.measurement_side || "")}
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
                        ${escapeHTML(scan.comparison_status || "")}
                    </td>

                    <td>
                        ${formatDate(scan.created_at)}
                    </td>

                    <td>
                        <button
                            class="danger"
                            onclick="deletePatientMeasurement('${escapeHTML(scan.id || "")}')"
                        >
                            Delete
                        </button>
                    </td>

                </tr>
            `;

        })
        .join("");


    setHTML(
        "adminScansTable",
        rows ||
        `<tr><td colspan="11">No measurements found.</td></tr>`
    );

}


// ============================================================
// ADMIN REFERENCES
// ============================================================

async function loadAdminReferences() {

    const {
        data,
        error
    } = await supabaseClient
        .from("reference_measurements")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }


    setText(
        "adminReferences",
        data?.length || 0
    );


    renderReferenceTable(
        "referenceTable",
        data || [],
        true
    );

}


// ============================================================
// OPERATOR DASHBOARD
// ============================================================

async function loadOperatorDashboard() {

    await Promise.all([
        loadSubjects(),
        loadScans(),
        loadReferenceGroups()
    ]);

    updateScannerStatus(
        "Not connected"
    );

}


// ============================================================
// OPERATOR PATIENTS
// ============================================================

async function loadSubjects() {

    if (!currentUser) {
        return;
    }


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


    const html = (data || [])
        .map(subject => {

            return `
                <div
                    class="patient-card ${
                        currentPatient &&
                        currentPatient.id === subject.id
                            ? "selected-patient"
                            : ""
                    }"
                >

                    <h3>
                        ${escapeHTML(subject.name || "Unnamed Patient")}
                    </h3>

                    <div>
                        <strong>Patient ID:</strong>
                        ${escapeHTML(
                            subject.patient_id ||
                            subject.subject_id ||
                            ""
                        )}
                    </div>

                    <div>
                        <strong>Age:</strong>
                        ${escapeHTML(String(subject.age ?? ""))}
                    </div>

                    <div>
                        <strong>Gender:</strong>
                        ${escapeHTML(subject.gender || "")}
                    </div>

                    <button
                        onclick="selectPatient('${escapeHTML(subject.id)}')"
                    >
                        Select for Scan
                    </button>

                </div>
            `;

        })
        .join("");


    setHTML(
        "subjectsList",
        html ||
        `<div class="empty">No patients registered yet.</div>`
    );

}


// ============================================================
// CREATE PATIENT
// ============================================================

async function createPatient() {

    const name = $("subjectName")?.value.trim();
    const age = Number($("subjectAge")?.value);
    const gender = $("subjectGender")?.value;


    if (!name) {

        setMessage(
            "subjectMessage",
            "Enter the patient name.",
            "error"
        );

        return;
    }

    if (!age || age < 1 || age > 120) {

        setMessage(
            "subjectMessage",
            "Enter a valid age.",
            "error"
        );

        return;
    }

    if (!gender) {

        setMessage(
            "subjectMessage",
            "Select the gender.",
            "error"
        );

        return;
    }


    try {

        setMessage(
            "subjectMessage",
            "Creating patient...",
            "info"
        );


        const subjectId = await generateUniquePatientId();
        const linkingCode = await generateUniqueLinkingCode();


        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .insert({
                user_id: currentUser.id,
                subject_id: subjectId,
                patient_id: subjectId,
                name,
                age,
                gender,
                linking_code: linkingCode,
                account_linked: false
            })
            .select()
            .single();


        if (error) {
            throw error;
        }


        currentPatient = data;


        setHTML(
            "createdPatientInfo",
            `
                <p>
                    The patient has been registered successfully.
                </p>

                <p>
                    <strong>Patient Name:</strong>
                    ${escapeHTML(data.name)}
                </p>

                <p>
                    <strong>Patient ID:</strong>
                    ${escapeHTML(
                        data.patient_id ||
                        data.subject_id ||
                        ""
                    )}
                </p>

                <p>
                    <strong>Age:</strong>
                    ${escapeHTML(String(data.age))}
                </p>

                <p>
                    <strong>Gender:</strong>
                    ${escapeHTML(data.gender)}
                </p>

                <p>
                    <strong>Patient Linking Code:</strong>
                </p>

                <div class="code-display">
                    ${escapeHTML(data.linking_code)}
                </div>

                <p class="small-text">
                    Give this 6-digit code to the patient so
                    they can view their results later.
                </p>
            `
        );


        showElement("patientModal");


        $("subjectName").value = "";
        $("subjectAge").value = "";
        $("subjectGender").value = "";


        setMessage(
            "subjectMessage",
            "Patient created successfully.",
            "success"
        );


        await loadSubjects();

    } catch (error) {

        console.error(
            "Create patient error:",
            error
        );

        setMessage(
            "subjectMessage",
            error.message,
            "error"
        );

    }

}


// ============================================================
// UNIQUE PATIENT ID
// ============================================================

async function generateUniquePatientId() {

    for (let attempt = 0; attempt < 10; attempt++) {

        const id = generatePatientId();

        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .select("id")
            .eq("patient_id", id)
            .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {
            return id;
        }

    }


    throw new Error(
        "Could not generate a unique patient ID."
    );

}


function generatePatientId() {

    const timestamp = Date.now()
        .toString(36)
        .toUpperCase();

    const random = Math.floor(
        1000 + Math.random() * 9000
    );

    return `PAT-${timestamp}-${random}`;

}


// ============================================================
// UNIQUE LINKING CODE
// ============================================================

async function generateUniqueLinkingCode() {

    for (let attempt = 0; attempt < 20; attempt++) {

        const code = Math.floor(
            100000 +
            Math.random() * 900000
        ).toString();


        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .select("id")
            .eq("linking_code", code)
            .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {
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

async function selectPatient(patientId) {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .select("*")
            .eq("id", patientId)
            .maybeSingle();


        if (error) {
            throw error;
        }

        if (!data) {
            throw new Error(
                "Patient could not be found."
            );
        }


        currentPatient = data;
        selectedMeasurementSide = null;


        setHTML(
            "selectedPatientInfo",
            `
                <div class="patient-card selected-patient">

                    <h3>
                        ${escapeHTML(data.name || "")}
                    </h3>

                    <div>
                        <strong>Patient ID:</strong>
                        ${escapeHTML(
                            data.patient_id ||
                            data.subject_id ||
                            ""
                        )}
                    </div>

                    <div>
                        <strong>Age:</strong>
                        ${escapeHTML(String(data.age ?? ""))}
                    </div>

                    <div>
                        <strong>Gender:</strong>
                        ${escapeHTML(data.gender || "")}
                    </div>

                </div>
            `
        );


        setText(
            "selectedSideText",
            "No side selected."
        );


        $("leftSideButton")?.classList.remove(
            "selected"
        );

        $("rightSideButton")?.classList.remove(
            "selected"
        );


        showElement("scanPreparation");


        await loadSubjects();

    } catch (error) {

        console.error(
            "Select patient error:",
            error
        );

        setMessage(
            "subjectMessage",
            error.message,
            "error"
        );

    }

}


// ============================================================
// SELECT SIDE
// ============================================================

function selectMeasurementSide(side) {

    if (!currentPatient) {

        setMessage(
            "subjectMessage",
            "Select a patient first.",
            "error"
        );

        return;
    }


    selectedMeasurementSide = side;


    $("leftSideButton")?.classList.remove(
        "selected"
    );

    $("rightSideButton")?.classList.remove(
        "selected"
    );


    if (side === "Left") {

        $("leftSideButton")?.classList.add(
            "selected"
        );

    } else {

        $("rightSideButton")?.classList.add(
            "selected"
        );

    }


    setText(
        "selectedSideText",
        `Selected measurement side: ${side}`
    );

}


// ============================================================
// START PATIENT SCAN
// ============================================================

async function startPatientScan() {

    if (!currentPatient) {

        updateScannerStatus(
            "Select a patient first.",
            true
        );

        return;
    }


    if (!selectedMeasurementSide) {

        updateScannerStatus(
            "Select Left or Right before scanning.",
            true
        );

        return;
    }


    if (!serialConnected) {

        updateScannerStatus(
            "Connect the ESP32 scanner first.",
            true
        );

        return;
    }


    if (patientScanRunning) {
        return;
    }


    patientScanRunning = true;


    updateScannerStatus(
        `Starting scan for ${
            currentPatient.name
        } — ${
            selectedMeasurementSide
        }...`,
        false,
        true
    );


    try {

        await sendESP32Command({

            command: "START_SCAN",

            scan_type: "patient",

            subject_id: currentPatient.id,

            patient_id:
                currentPatient.patient_id ||
                currentPatient.subject_id,

            patient_name: currentPatient.name,

            age: currentPatient.age,

            gender: currentPatient.gender,

            measurement_side:
                selectedMeasurementSide,

            scanner_device_id: "ABS-001"

        });

    } catch (error) {

        patientScanRunning = false;

        updateScannerStatus(
            error.message,
            true
        );

    }

}


// ============================================================
// STOP PATIENT SCAN
// ============================================================

async function stopPatientScan() {

    if (!serialConnected) {
        return;
    }


    try {

        await sendESP32Command({
            command: "STOP_SCAN"
        });


        patientScanRunning = false;


        updateScannerStatus(
            "Patient scan stopped."
        );

    } catch (error) {

        updateScannerStatus(
            error.message,
            true
        );

    }

}


// ============================================================
// SAVE PATIENT MEASUREMENT
// ============================================================

async function savePatientMeasurement(result) {

    if (!currentPatient) {
        throw new Error(
            "No patient is selected."
        );
    }


    const f0 = Number(result.f0);
    const rms = Number(result.rms);
    const qFactor = Number(
        result.q_factor ?? result.q
    );
    const bandwidth = Number(
        result.bandwidth
    );


    if (
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(qFactor) ||
        !Number.isFinite(bandwidth)
    ) {

        throw new Error(
            "ESP32 returned incomplete measurement data."
        );

    }


    const scanId =
        result.scan_id ||
        generateScanId();


    const row = {

        scan_id: scanId,

        f0,

        rms,

        q_factor: qFactor,

        bandwidth,

        user_id: currentUser.id,

        subject_id: currentPatient.id,

        measurement_side:
            result.measurement_side ||
            selectedMeasurementSide,

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
            result.comparison_status ||
            null,

        notes:
            result.notes ||
            "Measurement received from ESP32."

    };


    const {
        data,
        error
    } = await supabaseClient
        .from("scan_measurements")
        .insert(row)
        .select()
        .single();


    if (error) {
        throw error;
    }


    patientScanRunning = false;


    setHTML(
        "operatorScannerStatus",
        `
            <strong>Scan completed.</strong><br>
            Scan ID: ${escapeHTML(data.scan_id || "")}<br>
            F₀: ${formatNumber(data.f0)} Hz<br>
            RMS: ${formatNumber(data.rms)}<br>
            Q: ${formatNumber(data.q_factor)}<br>
            Bandwidth: ${formatNumber(data.bandwidth)} Hz
        `
    );


    await loadScans();


    return data;

}


// ============================================================
// GENERATE SCAN ID
// ============================================================

function generateScanId() {

    const timestamp =
        Date.now().toString(36).toUpperCase();

    const random =
        Math.floor(
            1000 + Math.random() * 9000
        );

    return `SCAN-${timestamp}-${random}`;

}


// ============================================================
// CANCEL SCAN PREPARATION
// ============================================================

function cancelScanPreparation() {

    currentPatient = null;
    selectedMeasurementSide = null;
    patientScanRunning = false;


    hideElement("scanPreparation");


    setText(
        "selectedSideText",
        "No side selected."
    );


    $("leftSideButton")?.classList.remove(
        "selected"
    );

    $("rightSideButton")?.classList.remove(
        "selected"
    );

}


// ============================================================
// LOAD OPERATOR SCANS
// ============================================================

async function loadScans() {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("scan_measurements")
        .select(`
            *,
            subjects (
                name,
                patient_id,
                subject_id
            )
        `)
        .eq("user_id", currentUser.id)
        .order("created_at", {
            ascending: false
        });


    if (error) {
        throw error;
    }


    const rows = (data || [])
        .map(scan => {

            const subject =
                scan.subjects || {};


            return `
                <tr>

                    <td>
                        ${escapeHTML(scan.scan_id || "")}
                    </td>

                    <td>
                        ${escapeHTML(subject.name || "")}
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
                        ${formatDate(scan.created_at)}
                    </td>

                    <td>
                        <button
                            class="danger"
                            onclick="deletePatientMeasurement('${escapeHTML(scan.id || "")}')"
                        >
                            Delete
                        </button>
                    </td>

                </tr>
            `;

        })
        .join("");


    setHTML(
        "scansList",
        rows ||
        `<tr><td colspan="10">No measurements found.</td></tr>`
    );

}


// ============================================================
// DELETE SCAN
// ============================================================

async function deletePatientMeasurement(id) {

    if (!id) {
        return;
    }


    const confirmed = window.confirm(
        "Delete this measurement?"
    );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("scan_measurements")
            .delete()
            .eq("id", id);


        if (error) {
            throw error;
        }


        await loadScans();


        if (
            currentProfile &&
            String(currentProfile.role).toLowerCase() === "admin"
        ) {
            await loadAllScans();
        }


    } catch (error) {

        console.error(
            "Delete scan error:",
            error
        );

        alert(
            "Could not delete measurement: " +
            error.message
        );

    }

}


// ============================================================
// REFERENCE TAB
// ============================================================

function showReferenceTab(tab) {

    if (tab === "manual") {

        showElement("manualReferencePanel");
        hideElement("scannerReferencePanel");


        $("manualReferenceTab")?.classList.add(
            "active"
        );

        $("scannerReferenceTab")?.classList.remove(
            "active"
        );

    } else {

        hideElement("manualReferencePanel");
        showElement("scannerReferencePanel");


        $("manualReferenceTab")?.classList.remove(
            "active"
        );

        $("scannerReferenceTab")?.classList.add(
            "active"
        );

    }

}


// ============================================================
// ADD MANUAL REFERENCE
// ============================================================

async function addManualReference() {

    const sampleId =
        $("referenceSampleId")?.value.trim();

    const referenceId =
        $("referenceId")?.value.trim();

    const age =
        Number($("referenceAge")?.value);

    const gender =
        $("referenceGender")?.value;

    const side =
        $("referenceSide")?.value;

    const f0 =
        Number($("referenceF0")?.value);

    const rms =
        Number($("referenceRMS")?.value);

    const qFactor =
        Number($("referenceQ")?.value);

    const bandwidth =
        Number($("referenceBandwidth")?.value);

    const notes =
        $("referenceNotes")?.value.trim() ||
        null;


    if (!sampleId || !referenceId) {

        setMessage(
            "referenceMessage",
            "Enter Sample ID and Reference ID.",
            "error"
        );

        return;
    }


    if (!age || age < 1 || age > 120) {

        setMessage(
            "referenceMessage",
            "Enter a valid age.",
            "error"
        );

        return;
    }


    if (!gender || !side) {

        setMessage(
            "referenceMessage",
            "Select gender and measurement side.",
            "error"
        );

        return;
    }


    if (
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(qFactor) ||
        !Number.isFinite(bandwidth)
    ) {

        setMessage(
            "referenceMessage",
            "Enter valid measurement values.",
            "error"
        );

        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("reference_measurements")
            .insert({

                sample_id: sampleId,

                reference_id: referenceId,

                age,

                gender,

                measurement_side: side,

                f0,

                rms,

                q_factor: qFactor,

                bandwidth,

                notes

            });


        if (error) {
            throw error;
        }


        setMessage(
            "referenceMessage",
            "Reference measurement added.",
            "success"
        );


        clearManualReferenceForm();


        await loadAdminReferences();

        await loadReferenceGroups();


    } catch (error) {

        console.error(
            "Reference insert error:",
            error
        );

        setMessage(
            "referenceMessage",
            error.message,
            "error"
        );

    }

}


// ============================================================
// CLEAR MANUAL REFERENCE
// ============================================================

function clearManualReferenceForm() {

    const ids = [

        "referenceSampleId",
        "referenceId",
        "referenceAge",
        "referenceF0",
        "referenceRMS",
        "referenceQ",
        "referenceBandwidth",
        "referenceNotes"

    ];


    ids.forEach(id => {

        const element = $(id);

        if (element) {
            element.value = "";
        }

    });


    if ($("referenceGender")) {
        $("referenceGender").value = "";
    }

    if ($("referenceSide")) {
        $("referenceSide").value = "";
    }

}


// ============================================================
// START REFERENCE SCANNER
// ============================================================

async function startReferenceScanner() {

    const sampleId =
        $("scannerReferenceSampleId")?.value.trim();

    const referenceId =
        $("scannerReferenceId")?.value.trim();

    const age =
        Number($("scannerReferenceAge")?.value);

    const gender =
        $("scannerReferenceGender")?.value;

    const side =
        $("scannerReferenceSide")?.value;

    const sensorHead =
        $("scannerReferenceSensorHead")?.value.trim();


    if (!sampleId || !referenceId) {

        setMessage(
            "scannerReferenceResult",
            "Enter Sample ID and Reference ID.",
            "error"
        );

        return;
    }


    if (!age || age < 1 || age > 120) {

        setMessage(
            "scannerReferenceResult",
            "Enter a valid age.",
            "error"
        );

        return;
    }


    if (!gender || !side) {

        setMessage(
            "scannerReferenceResult",
            "Select gender and measurement side.",
            "error"
        );

        return;
    }


    if (!serialConnected) {

        setMessage(
            "scannerReferenceResult",
            "Connect the ESP32 scanner first.",
            "error"
        );

        return;
    }


    if (referenceScanRunning) {
        return;
    }


    referenceScanRunning = true;


    setScannerReferenceStatus(
        "Starting reference scan..."
    );


    try {

        await sendESP32Command({

            command: "START_REFERENCE_SCAN",

            scan_type: "reference",

            sample_id: sampleId,

            reference_id: referenceId,

            age,

            gender,

            measurement_side: side,

            sensor_head_id:
                sensorHead || null,

            scanner_device_id: "ABS-001"

        });


    } catch (error) {

        referenceScanRunning = false;

        setScannerReferenceStatus(
            error.message,
            true
        );

    }

}


// ============================================================
// STOP REFERENCE SCAN
// ============================================================

async function stopReferenceScanner() {

    if (!serialConnected) {
        return;
    }


    try {

        await sendESP32Command({
            command: "STOP_SCAN"
        });


        referenceScanRunning = false;


        setScannerReferenceStatus(
            "Reference scan stopped."
        );


    } catch (error) {

        setScannerReferenceStatus(
            error.message,
            true
        );

    }

}


// ============================================================
// SAVE REFERENCE SCANNER RESULT
// ============================================================

async function saveScannerReferenceMeasurement(result) {

    const sampleId =
        $("scannerReferenceSampleId")?.value.trim();

    const referenceId =
        $("scannerReferenceId")?.value.trim();

    const age =
        Number($("scannerReferenceAge")?.value);

    const gender =
        $("scannerReferenceGender")?.value;

    const side =
        result.measurement_side ||
        $("scannerReferenceSide")?.value;

    const notes =
        $("scannerReferenceNotes")?.value.trim() ||
        null;


    const f0 = Number(result.f0);
    const rms = Number(result.rms);

    const qFactor = Number(
        result.q_factor ?? result.q
    );

    const bandwidth =
        Number(result.bandwidth);


    if (
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(qFactor) ||
        !Number.isFinite(bandwidth)
    ) {

        throw new Error(
            "ESP32 returned incomplete reference measurement data."
        );

    }


    const {
        data,
        error
    } = await supabaseClient
        .from("reference_measurements")
        .insert({

            sample_id: sampleId,

            reference_id: referenceId,

            age,

            gender,

            measurement_side: side,

            f0,

            rms,

            q_factor: qFactor,

            bandwidth,

            notes

        })
        .select()
        .single();


    if (error) {
        throw error;
    }


    referenceScanRunning = false;


    setScannerReferenceStatus(
        "Reference scan completed successfully."
    );


    setHTML(
        "scannerReferenceResult",
        `
            <div class="message success">

                Reference measurement saved.

                <br><br>

                F₀:
                ${formatNumber(data.f0)} Hz

                <br>

                RMS:
                ${formatNumber(data.rms)}

                <br>

                Q:
                ${formatNumber(data.q_factor)}

                <br>

                Bandwidth:
                ${formatNumber(data.bandwidth)} Hz

            </div>
        `
    );


    await loadAdminReferences();

    await loadReferenceGroups();

}


// ============================================================
// RENDER REFERENCE TABLE
// ============================================================

function renderReferenceTable(
    elementId,
    data,
    includeActions
) {

    const rows = (data || [])
        .map(reference => {

            const action = includeActions
                ? `
                    <button
                        class="danger"
                        onclick="deleteReferenceMeasurement('${escapeHTML(reference.id || "")}')"
                    >
                        Delete
                    </button>
                `
                : "";


            return `
                <tr>

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
                            String(reference.age ?? "")
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
                        ${formatNumber(reference.f0)}
                    </td>

                    <td>
                        ${formatNumber(reference.rms)}
                    </td>

                    <td>
                        ${formatNumber(reference.q_factor)}
                    </td>

                    <td>
                        ${formatNumber(reference.bandwidth)}
                    </td>

                    <td>
                        ${formatDate(reference.created_at)}
                    </td>

                    <td>
                        ${action}
                    </td>

                </tr>
            `;

        })
        .join("");


    setHTML(
        elementId,
        rows ||
        `<tr><td colspan="${
            includeActions ? 11 : 10
        }">No reference measurements found.</td></tr>`
    );

}


// ============================================================
// OPERATOR REFERENCE DATABASE
// ============================================================

async function loadReferenceGroups() {

    const {
        data,
        error
    } = await supabaseClient
        .from("reference_measurements")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    if (error) {
        throw error;
    }


    renderReferenceTable(
        "referenceList",
        data || [],
        false
    );

}


// ============================================================
// DELETE REFERENCE
// ============================================================

async function deleteReferenceMeasurement(id) {

    if (!id) {
        return;
    }


    const confirmed = window.confirm(
        "Delete this reference measurement?"
    );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("reference_measurements")
            .delete()
            .eq("id", id);


        if (error) {
            throw error;
        }


        await loadAdminReferences();


    } catch (error) {

        console.error(
            "Delete reference error:",
            error
        );

        alert(
            "Could not delete reference measurement: " +
            error.message
        );

    }

}


// ============================================================
// SCANNER DEVICES
// ============================================================

async function loadScannerDevices() {

    const {
        data,
        error
    } = await supabaseClient
        .from("scanner_devices")
        .select("*")
        .order("device_id");


    if (error) {
        throw error;
    }


    const html = (data || [])
        .map(device => {

            return `
                <div class="patient-card">

                    <h3>
                        ${escapeHTML(
                            device.device_id || ""
                        )}
                    </h3>

                    <div>
                        <strong>Active:</strong>
                        ${device.active ? "Yes" : "No"}
                    </div>

                    <div>
                        <strong>Assigned User:</strong>
                        ${escapeHTML(
                            device.user_id || ""
                        )}
                    </div>

                </div>
            `;

        })
        .join("");


    setHTML(
        "adminScannerDevices",
        html ||
        `<div class="empty">No scanner devices found.</div>`
    );

}


// ============================================================
// ESP32 WEB SERIAL
// ============================================================

async function connectESP32() {

    if (!("serial" in navigator)) {

        updateScannerStatus(
            "Web Serial is not supported in this browser. Use a supported Chrome or Edge desktop browser.",
            true
        );

        setScannerReferenceStatus(
            "Web Serial is not supported in this browser.",
            true
        );

        return;
    }


    if (serialConnected) {

        updateScannerStatus(
            "ESP32 scanner is already connected."
        );

        return;
    }


    try {

        serialPort =
            await navigator.serial.requestPort();


        await serialPort.open({
            baudRate: 115200
        });


        serialConnected = true;
        serialReadBuffer = "";


        updateScannerStatus(
            "ESP32 scanner connected.",
            false,
            false,
            true
        );


        setScannerReferenceStatus(
            "ESP32 scanner connected.",
            false,
            true
        );


        serialReadLoop();


    } catch (error) {

        console.error(
            "ESP32 connection error:",
            error
        );


        serialConnected = false;


        updateScannerStatus(
            error.message,
            true
        );


        setScannerReferenceStatus(
            error.message,
            true
        );

    }

}


// ============================================================
// SERIAL READ LOOP
// ============================================================

async function serialReadLoop() {

    if (!serialPort || !serialPort.readable) {
        return;
    }


    serialReader =
        serialPort.readable.getReader();


    const decoder =
        new TextDecoder();


    try {

        while (serialConnected) {

            const {
                value,
                done
            } = await serialReader.read();


            if (done) {
                break;
            }


            if (!value) {
                continue;
            }


            serialReadBuffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );


            let newlineIndex;


            while (
                (newlineIndex =
                    serialReadBuffer.indexOf("\n")) >= 0
            ) {

                const line =
                    serialReadBuffer
                        .slice(0, newlineIndex)
                        .trim();


                serialReadBuffer =
                    serialReadBuffer.slice(
                        newlineIndex + 1
                    );


                if (line) {

                    await handleESP32Line(
                        line
                    );

                }

            }

        }

    } catch (error) {

        if (serialConnected) {

            console.error(
                "Serial read error:",
                error
            );


            updateScannerStatus(
                "Serial read error: " +
                error.message,
                true
            );

        }

    } finally {

        try {
            serialReader.releaseLock();
        } catch (_) {}

        serialReader = null;

    }

}


// ============================================================
// HANDLE ESP32 LINE
// ============================================================

async function handleESP32Line(line) {

    console.log(
        "ESP32:",
        line
    );


    let message;


    try {

        message =
            JSON.parse(line);

    } catch (_) {

        // Ignore normal debug text from ESP32.
        return;

    }


    const type =
        String(
            message.type ||
            message.event ||
            ""
        ).toLowerCase();


    if (
        type === "ready" ||
        type === "connected"
    ) {

        updateScannerStatus(
            "ESP32 scanner ready.",
            false,
            false,
            true
        );

        return;
    }


    if (type === "scan_started") {

        updateScannerStatus(
            "ESP32 scan started.",
            false,
            true
        );

        setScannerReferenceStatus(
            "ESP32 reference scan started.",
            false,
            true
        );

        return;
    }


    if (type === "scan_progress") {

        const progress =
            message.progress ??
            message.percent;


        const text =
            progress !== undefined
                ? `Scanning... ${progress}%`
                : "ESP32 scanner is scanning...";


        updateScannerStatus(
            text,
            false,
            true
        );


        if (referenceScanRunning) {

            setScannerReferenceStatus(
                text,
                false,
                true
            );

        }


        return;
    }


    if (
        type === "scan_result" ||
        type === "result" ||
        type === "measurement"
    ) {

        try {

            if (patientScanRunning) {

                await savePatientMeasurement(
                    message
                );

            } else if (referenceScanRunning) {

                await saveScannerReferenceMeasurement(
                    message
                );

            } else {

                console.log(
                    "Received scan result with no active scan.",
                    message
                );

            }

        } catch (error) {

            console.error(
                "Measurement save error:",
                error
            );


            patientScanRunning = false;
            referenceScanRunning = false;


            updateScannerStatus(
                "Measurement received, but database save failed: " +
                error.message,
                true
            );


            setScannerReferenceStatus(
                "Measurement received, but database save failed: " +
                error.message,
                true
            );

        }


        return;
    }


    if (
        type === "scan_stopped" ||
        type === "stopped"
    ) {

        patientScanRunning = false;
        referenceScanRunning = false;


        updateScannerStatus(
            "ESP32 scan stopped."
        );


        setScannerReferenceStatus(
            "ESP32 scan stopped."
        );


        return;
    }


    if (type === "error") {

        patientScanRunning = false;
        referenceScanRunning = false;


        const errorText =
            message.message ||
            message.error ||
            "ESP32 reported an error.";


        updateScannerStatus(
            errorText,
            true
        );


        setScannerReferenceStatus(
            errorText,
            true
        );


        return;
    }

}


// ============================================================
// SEND COMMAND TO ESP32
// ============================================================

async function sendESP32Command(command) {

    if (
        !serialConnected ||
        !serialPort ||
        !serialPort.writable
    ) {

        throw new Error(
            "ESP32 scanner is not connected."
        );

    }


    const writer =
        serialPort.writable.getWriter();


    try {

        const text =
            JSON.stringify(command) +
            "\n";


        const data =
            new TextEncoder().encode(
                text
            );


        await writer.write(data);


        console.log(
            "Sent to ESP32:",
            command
        );

    } finally {

        writer.releaseLock();

    }

}


// ============================================================
// DISCONNECT ESP32
// ============================================================

async function disconnectESP32() {

    serialConnected = false;


    patientScanRunning = false;
    referenceScanRunning = false;


    try {

        if (serialReader) {

            try {
                await serialReader.cancel();
            } catch (_) {}

        }

    } catch (_) {}


    try {

        if (serialPort) {

            await serialPort.close();

        }

    } catch (error) {

        console.warn(
            "Serial close warning:",
            error
        );

    }


    serialReader = null;
    serialPort = null;
    serialReadBuffer = "";


    updateScannerStatus(
        "ESP32 scanner disconnected."
    );


    setScannerReferenceStatus(
        "ESP32 scanner disconnected."
    );

}


// ============================================================
// SCANNER STATUS
// ============================================================

function updateScannerStatus(
    message,
    isError = false,
    isScanning = false,
    isConnected = false
) {

    const elements = [

        $("scannerStatus"),
        $("operatorScannerStatus")

    ];


    elements.forEach(element => {

        if (!element) {
            return;
        }


        element.classList.remove(
            "connected",
            "error",
            "scanning"
        );


        if (isError) {

            element.classList.add(
                "error"
            );

        } else if (isScanning) {

            element.classList.add(
                "scanning"
            );

        } else if (isConnected) {

            element.classList.add(
                "connected"
            );

        }


        element.textContent =
            `ESP32 scanner: ${message}`;

    });

}


function setScannerReferenceStatus(
    message,
    isError = false,
    isScanning = false
) {

    const element =
        $("referenceScannerStatus");


    if (!element) {
        return;
    }


    element.classList.remove(
        "connected",
        "error",
        "scanning"
    );


    if (isError) {

        element.classList.add(
            "error"
        );

    } else if (isScanning) {

        element.classList.add(
            "scanning"
        );

    } else if (serialConnected) {

        element.classList.add(
            "connected"
        );

    }


    element.textContent =
        `Scanner status: ${message}`;

}


// ============================================================
// PATIENT ACCESS
// ============================================================

async function patientAccess() {

    const code =
        $("patientLinkingCode")?.value.trim();


    if (!code || !/^\d{6}$/.test(code)) {

        setMessage(
            "patientAccessMessage",
            "Enter a valid 6-digit linking code.",
            "error"
        );

        return;
    }


    try {

        setMessage(
            "patientAccessMessage",
            "Loading results...",
            "info"
        );


        const {
            data,
            error
        } = await supabaseClient.rpc(
            "get_patient_results",
            {
                p_linking_code: code
            }
        );


        if (error) {
            throw error;
        }


        if (!data) {

            throw new Error(
                "No patient found for this linking code."
            );

        }


        displayPatientResults(data);


    } catch (error) {

        console.error(
            "Patient access error:",
            error
        );


        setMessage(
            "patientAccessMessage",
            error.message,
            "error"
        );

    }

}


// ============================================================
// DISPLAY PATIENT RESULTS
// ============================================================

function displayPatientResults(data) {

    hideElement("loginScreen");
    hideElement("dashboard");

    showElement("patientResultScreen");


    let patient = data.patient;
    let scans = data.scans;


    // Support RPC returning an array.
    if (Array.isArray(data)) {

        scans = data;

        patient =
            data.length > 0
                ? data[0].patient ||
                  data[0].subject ||
                  null
                : null;

    }


    if (!patient) {

        const firstScan =
            Array.isArray(scans)
                ? scans[0]
                : null;


        patient =
            firstScan?.subjects ||
            firstScan?.patient ||
            null;

    }


    if (patient) {

        setHTML(
            "patientDetails",
            `
                <div class="patient-card">

                    <h3>
                        ${escapeHTML(
                            patient.name || ""
                        )}
                    </h3>

                    <div>
                        <strong>Patient ID:</strong>
                        ${escapeHTML(
                            patient.patient_id ||
                            patient.subject_id ||
                            ""
                        )}
                    </div>

                    <div>
                        <strong>Age:</strong>
                        ${escapeHTML(
                            String(patient.age ?? "")
                        )}
                    </div>

                    <div>
                        <strong>Gender:</strong>
                        ${escapeHTML(
                            patient.gender || ""
                        )}
                    </div>

                </div>
            `
        );

    } else {

        setHTML(
            "patientDetails",
            `<div class="empty">Patient details unavailable.</div>`
        );

    }


    const scanArray =
        Array.isArray(scans)
            ? scans
            : [];


    const html =
        scanArray
            .map(scan => {

                return `
                    <div class="patient-result">

                        <h3>
                            Scan
                            ${escapeHTML(
                                scan.scan_id || ""
                            )}
                        </h3>

                        <p>
                            <strong>Side:</strong>
                            ${escapeHTML(
                                scan.measurement_side || ""
                            )}
                        </p>

                        <p>
                            <strong>F₀:</strong>
                            ${formatNumber(scan.f0)} Hz
                        </p>

                        <p>
                            <strong>RMS:</strong>
                            ${formatNumber(scan.rms)}
                        </p>

                        <p>
                            <strong>Q Factor:</strong>
                            ${formatNumber(scan.q_factor)}
                        </p>

                        <p>
                            <strong>Bandwidth:</strong>
                            ${formatNumber(scan.bandwidth)} Hz
                        </p>

                        <p>
                            <strong>Date:</strong>
                            ${formatDate(scan.created_at)}
                        </p>

                    </div>
                `;

            })
            .join("");


    setHTML(
        "patientScanResults",
        html ||
        `<div class="empty">No scan measurements found.</div>`
    );

}


// ============================================================
// BACK TO LOGIN
// ============================================================

function backToLogin() {

    hideElement("patientResultScreen");

    showElement("loginScreen");


    setMessage(
        "patientAccessMessage",
        "",
        "info"
    );

}


// ============================================================
// PATIENT MODAL
// ============================================================

function closePatientModal() {

    hideElement("patientModal");

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    try {

        await disconnectESP32();


        await supabaseClient.auth.signOut();


        currentUser = null;
        currentProfile = null;
        currentPatient = null;
        selectedMeasurementSide = null;


        showLogin();


    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    }

}


// ============================================================
// MESSAGE
// ============================================================

function setMessage(
    elementId,
    message,
    type = "info"
) {

    const element =
        $(elementId);


    if (!element) {
        return;
    }


    if (!message) {

        element.innerHTML = "";

        return;
    }


    element.innerHTML = `
        <div class="message ${type}">
            ${escapeHTML(message)}
        </div>
    `;

}


// ============================================================
// NUMBER FORMAT
// ============================================================

function formatNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "-";

    }


    const number =
        Number(value);


    if (!Number.isFinite(number)) {

        return "-";

    }


    return number.toFixed(3);

}


// ============================================================
// DATE FORMAT
// ============================================================

function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (Number.isNaN(date.getTime())) {
        return "-";
    }


    return date.toLocaleString();

}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ============================================================
// EXPOSE FUNCTIONS TO HTML ONCLICK
// ============================================================

window.login = login;
window.logout = logout;

window.patientAccess = patientAccess;
window.backToLogin = backToLogin;

window.createPatient = createPatient;
window.selectPatient = selectPatient;

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

window.connectESP32 =
    connectESP32;

window.disconnectESP32 =
    disconnectESP32;
