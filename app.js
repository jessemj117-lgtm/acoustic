// ============================================================
// GROUP 4 ACOUSTIC BONE DENSITY SCANNER
// GitHub Pages + Supabase
// ============================================================


// ------------------------------------------------------------
// SUPABASE
// ------------------------------------------------------------

// KEEP YOUR EXISTING VALUES HERE.
// Use the Supabase PUBLISHABLE/ANON key only.
// NEVER use the secret/service-role key in this file.

const SUPABASE_URL = "https://ropiudyalwarmowaiugu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";

const { createClient } = supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


// ------------------------------------------------------------
// GLOBAL VARIABLES
// ------------------------------------------------------------

let currentUser = null;
let currentProfile = null;
let currentPatient = null;
let currentMeasurementSide = null;

let scannerOnline = false;
let scannerCommandTimer = null;


// Scanner used by this project
const SCANNER_DEVICE_ID = "ABS-001";


// ------------------------------------------------------------
// PAGE START
// ------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {

    const {
        data: { session }
    } = await db.auth.getSession();

    if (session) {
        currentUser = session.user;
        await loadDashboard();
    }

});


// ------------------------------------------------------------
// AUTH STATE
// ------------------------------------------------------------

db.auth.onAuthStateChange(async (event, session) => {

    if (session) {

        currentUser = session.user;

    } else {

        currentUser = null;
        currentProfile = null;

    }

});


// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------

async function loginStaff() {

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    if (!email || !password) {

        showLoginMessage("Enter email and password.");

        return;
    }


    const { data, error } =
        await db.auth.signInWithPassword({
            email,
            password
        });


    if (error) {

        showLoginMessage(error.message);

        return;
    }


    currentUser = data.user;

    await loadDashboard();
}


// ------------------------------------------------------------
// REGISTER OPERATOR
// ------------------------------------------------------------

async function registerOperator() {

    const name =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;


    if (!name || !email || !password) {

        showLoginMessage("Complete all registration fields.");

        return;
    }


    const { data, error } =
        await db.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                }
            }
        });


    if (error) {

        showLoginMessage(error.message);

        return;
    }


    if (data.user) {

        // Profile is normally created by the database trigger.
        // We only update the name here.

        await db
            .from("profiles")
            .update({
                full_name: name
            })
            .eq("id", data.user.id);

    }


    showLoginMessage(
        "Registration completed. You can now log in."
    );

    hideRegister();
}


// ------------------------------------------------------------
// LOAD DASHBOARD
// ------------------------------------------------------------

async function loadDashboard() {

    const {
        data: { session }
    } = await db.auth.getSession();


    if (!session) {

        showLogin();

        return;
    }


    currentUser = session.user;


    const profileResult =
        await db
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();


    if (profileResult.error) {

        alert(
            "Unable to load your staff profile: " +
            profileResult.error.message
        );

        return;
    }


    currentProfile = profileResult.data;


    document
        .getElementById("loginScreen")
        .classList.add("hidden");

    document
        .getElementById("patientResultScreen")
        .classList.add("hidden");

    document
        .getElementById("staffApp")
        .classList.remove("hidden");


    document.getElementById("userInfo").textContent =
        `${currentProfile.full_name || currentUser.email} — ${currentProfile.role}`;


    if (currentProfile.role === "admin") {

        document
            .getElementById("adminDashboard")
            .classList.remove("hidden");

        document
            .getElementById("operatorDashboard")
            .classList.add("hidden");

        await loadAdminDashboard();

    } else if (currentProfile.role === "operator") {

        document
            .getElementById("operatorDashboard")
            .classList.remove("hidden");

        document
            .getElementById("adminDashboard")
            .classList.add("hidden");

        await loadOperatorDashboard();

    } else {

        alert(
            "Your account does not have an allowed staff role."
        );

        await logout();

    }

}


// ------------------------------------------------------------
// ADMIN DASHBOARD
// ------------------------------------------------------------

async function loadAdminDashboard() {

    await loadAllUsers();
    await loadAllSubjects();
    await loadAllScans();
    await loadAdminReferences();
    await loadScannerDevices();

}


// ------------------------------------------------------------
// ADMIN USERS
// ------------------------------------------------------------

async function loadAllUsers() {

    const { data, error } =
        await db
            .from("profiles")
            .select("*")
            .order("created_at", {
                ascending: false
            });


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById("adminUsersTable");

    table.innerHTML = "";


    let operators = 0;


    data.forEach(user => {

        if (user.role === "operator") {
            operators++;
        }


        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(user.full_name || "-")}</td>
            <td>${escapeHTML(user.email || "-")}</td>
            <td>${escapeHTML(user.role || "-")}</td>
            <td>${formatDate(user.created_at)}</td>
        `;

        table.appendChild(row);

    });


    document.getElementById("adminOperatorCount")
        .textContent = operators;

}


// ------------------------------------------------------------
// ADMIN PATIENTS
// ------------------------------------------------------------

async function loadAllSubjects() {

    const { data, error } =
        await db
            .from("subjects")
            .select(`
                *,
                profiles:user_id (
                    full_name,
                    email
                )
            `)
            .order("created_at", {
                ascending: false
            });


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById("adminPatientsTable");

    table.innerHTML = "";


    document.getElementById("adminPatientCount")
        .textContent = data.length;


    data.forEach(patient => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(patient.patient_id || patient.subject_id || "-")}</td>
            <td>${escapeHTML(patient.name || "-")}</td>
            <td>${patient.age ?? "-"}</td>
            <td>${escapeHTML(patient.gender || "-")}</td>
            <td>${escapeHTML(patient.linking_code || "-")}</td>
            <td>${escapeHTML(patient.profiles?.full_name || "-")}</td>
            <td>
                <button
                    class="danger"
                    onclick="deletePatient('${patient.id}')"
                >
                    Delete
                </button>
            </td>
        `;

        table.appendChild(row);

    });

}


// ------------------------------------------------------------
// ADMIN SCANS
// ------------------------------------------------------------

async function loadAllScans() {

    const { data, error } =
        await db
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

        console.error(error);

        return;
    }


    document.getElementById("adminScanCount")
        .textContent = data.length;


    const table =
        document.getElementById("adminScansTable");

    table.innerHTML = "";


    data.forEach(scan => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(scan.scan_id || "-")}</td>
            <td>${escapeHTML(
                scan.subjects?.patient_id ||
                scan.subjects?.subject_id ||
                scan.subjects?.name ||
                "-"
            )}</td>
            <td>${escapeHTML(scan.measurement_side || "-")}</td>
            <td>${number(scan.f0)}</td>
            <td>${number(scan.rms)}</td>
            <td>${number(scan.q_factor)}</td>
            <td>${number(scan.bandwidth)}</td>
            <td>${formatDate(scan.created_at)}</td>
        `;

        table.appendChild(row);

    });

}


// ------------------------------------------------------------
// ADMIN REFERENCES
// ------------------------------------------------------------

async function loadAdminReferences() {

    const { data, error } =
        await db
            .from("reference_groups")
            .select("*")
            .order("age_min", {
                ascending: true
            });


    if (error) {

        console.error(error);

        return;
    }


    document.getElementById("adminReferenceCount")
        .textContent = data.length;


    const table =
        document.getElementById("adminReferenceTable");

    table.innerHTML = "";


    data.forEach(ref => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${ref.age_min ?? "-"}-${ref.age_max ?? "-"}</td>
            <td>${escapeHTML(ref.gender || "-")}</td>
            <td>${ref.sample_count ?? "-"}</td>
            <td>${number(ref.mean_f0)}</td>
            <td>${number(ref.sd_f0)}</td>
            <td>${number(ref.mean_rms)}</td>
            <td>${number(ref.sd_rms)}</td>
            <td>${number(ref.mean_q)}</td>
            <td>${number(ref.sd_q)}</td>
        `;

        table.appendChild(row);

    });

}


// ------------------------------------------------------------
// ADD REFERENCE
// ------------------------------------------------------------

async function addReferenceGroup() {

    if (currentProfile?.role !== "admin") {

        alert("Only admin can add reference data.");

        return;
    }


    const ageMin =
        Number(document.getElementById("refAgeMin").value);

    const ageMax =
        Number(document.getElementById("refAgeMax").value);

    const gender =
        document.getElementById("refGender").value;

    const f0 =
        Number(document.getElementById("refF0").value);

    const rms =
        Number(document.getElementById("refRMS").value);

    const q =
        Number(document.getElementById("refQ").value);

    const bandwidth =
        Number(document.getElementById("refBandwidth").value);

    const sampleCount =
        Number(document.getElementById("refSampleCount").value);


    if (
        !ageMin ||
        !ageMax ||
        !gender ||
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(q) ||
        !Number.isFinite(bandwidth)
    ) {

        alert("Complete the reference values.");

        return;
    }


    const { error } =
        await db
            .from("reference_groups")
            .insert({
                age_min: ageMin,
                age_max: ageMax,
                gender,
                sample_count: sampleCount || 1,
                mean_f0: f0,
                mean_rms: rms,
                mean_q: q,
                mean_bandwidth: bandwidth
            });


    if (error) {

        alert(error.message);

        return;
    }


    alert("Reference group added.");

    await loadAdminReferences();
}


// ------------------------------------------------------------
// SCANNER DEVICES
// ------------------------------------------------------------

async function loadScannerDevices() {

    const { data, error } =
        await db
            .from("scanner_devices")
            .select("*")
            .order("created_at", {
                ascending: false
            });


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById("scannerDevicesTable");

    table.innerHTML = "";


    data.forEach(device => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(device.device_id)}</td>
            <td>${escapeHTML(device.user_id || "-")}</td>
            <td>${device.active ? "Active" : "Inactive"}</td>
            <td>${formatDate(device.created_at)}</td>
        `;

        table.appendChild(row);

    });

}


// ============================================================
// OPERATOR DASHBOARD
// ============================================================

async function loadOperatorDashboard() {

    await loadOperatorPatients();

    await loadOperatorScans();

    await loadReferenceGroups();

    checkScannerStatus();

}


// ------------------------------------------------------------
// LOAD OPERATOR PATIENTS
// ------------------------------------------------------------

async function loadOperatorPatients() {

    const { data, error } =
        await db
            .from("subjects")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", {
                ascending: false
            });


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById("operatorPatientsTable");

    table.innerHTML = "";


    data.forEach(patient => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(patient.patient_id || patient.subject_id || "-")}</td>
            <td>${escapeHTML(patient.name || "-")}</td>
            <td>${patient.age ?? "-"}</td>
            <td>${escapeHTML(patient.gender || "-")}</td>
            <td>${escapeHTML(patient.linking_code || "-")}</td>
            <td>
                <button
                    class="primary"
                    onclick="selectPatient('${patient.id}')"
                >
                    Select for Scan
                </button>

                <button
                    class="danger"
                    onclick="deletePatient('${patient.id}')"
                >
                    Delete
                </button>
            </td>
        `;

        table.appendChild(row);

    });

}


// ------------------------------------------------------------
// CREATE PATIENT
// ------------------------------------------------------------

async function createPatient() {

    const name =
        document.getElementById("patientName").value.trim();

    const age =
        Number(document.getElementById("patientAge").value);

    const gender =
        document.getElementById("patientGender").value;


    if (!name || !age || !gender) {

        alert("Enter patient name, age and gender.");

        return;
    }


    // Patient ID
    const patientId =
        "PAT-" +
        Math.floor(
            10000 + Math.random() * 90000
        );


    // Six digit linking code
    const linkingCode =
        String(
            Math.floor(
                100000 + Math.random() * 900000
            )
        );


    const { data, error } =
        await db
            .from("subjects")
            .insert({
                user_id: currentUser.id,
                subject_id: patientId,
                patient_id: patientId,
                name,
                age,
                gender,
                linking_code: linkingCode,
                account_linked: false
            })
            .select()
            .single();


    if (error) {

        alert(
            "Unable to create patient: " +
            error.message
        );

        return;
    }


    document.getElementById("createdPatientId")
        .innerHTML =
        `<strong>Patient ID:</strong> ${escapeHTML(data.patient_id)}`;


    document.getElementById("createdLinkCode")
        .textContent = data.linking_code;


    document
        .getElementById("patientCreatedModal")
        .classList.remove("hidden");


    document.getElementById("patientName").value = "";
    document.getElementById("patientAge").value = "";
    document.getElementById("patientGender").value = "";


    await loadOperatorPatients();

}


// ------------------------------------------------------------
// CLOSE PATIENT MODAL
// ------------------------------------------------------------

function closePatientModal() {

    document
        .getElementById("patientCreatedModal")
        .classList.add("hidden");

}


// ============================================================
// DELETE PATIENT
// ============================================================

async function deletePatient(patientUUID) {

    if (!currentProfile) {
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


    const { error: scanError } =
        await db
            .from("scan_measurements")
            .delete()
            .eq("subject_id", patientUUID);


    if (scanError) {

        alert(
            "Could not delete patient measurements: " +
            scanError.message
        );

        return;
    }


    const { error } =
        await db
            .from("subjects")
            .delete()
            .eq("id", patientUUID);


    if (error) {

        alert(
            "Could not delete patient: " +
            error.message
        );

        return;
    }


    if (
        currentPatient &&
        currentPatient.id === patientUUID
    ) {

        currentPatient = null;

        document
            .getElementById("selectedPatientCard")
            .classList.add("hidden");

    }


    alert("Patient deleted.");

    if (currentProfile.role === "admin") {

        await loadAllSubjects();
        await loadAllScans();

    } else {

        await loadOperatorPatients();
        await loadOperatorScans();

    }

}


// ============================================================
// SELECT PATIENT
// ============================================================

async function selectPatient(patientUUID) {

    const { data, error } =
        await db
            .from("subjects")
            .select("*")
            .eq("id", patientUUID)
            .single();


    if (error) {

        alert(error.message);

        return;
    }


    currentPatient = data;

    currentMeasurementSide = null;


    document
        .getElementById("selectedPatientCard")
        .classList.remove("hidden");


    document.getElementById("selectedPatientInfo")
        .innerHTML = `
            <strong>${escapeHTML(data.name)}</strong><br>
            Patient ID: ${escapeHTML(data.patient_id || data.subject_id)}<br>
            Age: ${data.age}<br>
            Gender: ${escapeHTML(data.gender)}<br>
            Linking Code: ${escapeHTML(data.linking_code || "-")}
        `;


    document
        .getElementById("startScanButton")
        .disabled = true;


    document
        .getElementById("scanCommandStatus")
        .innerHTML =
        `<div class="message">
            Select Left or Right measurement side.
        </div>`;


    document
        .getElementById("leftSideButton")
        .classList.remove("selected");

    document
        .getElementById("rightSideButton")
        .classList.remove("selected");

}


// ------------------------------------------------------------
// SELECT SIDE
// ------------------------------------------------------------

function selectMeasurementSide(side) {

    if (!currentPatient) {

        alert("Select a patient first.");

        return;
    }


    // Database requires LEFT / RIGHT
    const normalizedSide = String(side).toUpperCase();

    if (
        normalizedSide !== "LEFT" &&
        normalizedSide !== "RIGHT"
    ) {

        alert("Invalid measurement side.");

        return;
    }


    currentMeasurementSide = normalizedSide;


    document
        .getElementById("leftSideButton")
        .classList.toggle(
            "selected",
            normalizedSide === "LEFT"
        );


    document
        .getElementById("rightSideButton")
        .classList.toggle(
            "selected",
            normalizedSide === "RIGHT"
        );


    document
        .getElementById("startScanButton")
        .disabled = false;


    document
        .getElementById("scanCommandStatus")
        .innerHTML =
        `<div class="message">
            ${normalizedSide} side selected. Press Start ESP32 Scan.
        </div>`;

}


// ============================================================
// ESP32 SCAN COMMAND
// ============================================================

async function startPatientScan() {

    if (!currentPatient) {

        alert("Select a patient first.");

        return;
    }


    if (!currentMeasurementSide) {

        alert("Select Left or Right side.");

        return;
    }


    const button =
        document.getElementById("startScanButton");


    button.disabled = true;


    document
        .getElementById("scanCommandStatus")
        .innerHTML =
        `<div class="pending">
            Sending scan command to ESP32...
        </div>`;


    const scanId =
        "SCAN-" +
        Date.now();


    const { data, error } =
        await db
            .from("scan_commands")
            .insert({
                user_id: currentUser.id,
                device_id: SCANNER_DEVICE_ID,
                subject_id: currentPatient.id,
                measurement_side: currentMeasurementSide,
                scan_id: scanId,
                command: "SCAN",
                status: "PENDING"
            })
            .select()
            .single();


    if (error) {

        button.disabled = false;

        document
            .getElementById("scanCommandStatus")
            .innerHTML =
            `<div class="offline">
                Scanner command failed: ${escapeHTML(error.message)}
            </div>`;

        return;
    }


    document
        .getElementById("scanCommandStatus")
        .innerHTML =
        `<div class="pending">
            Scan command created.<br>
            Waiting for ESP32...
        </div>`;


    monitorScanCommand(data.id);

}


// ------------------------------------------------------------
// MONITOR ESP32 COMMAND
// ------------------------------------------------------------

function monitorScanCommand(commandId) {

    if (scannerCommandTimer) {

        clearInterval(scannerCommandTimer);

    }


    let attempts = 0;


    scannerCommandTimer =
        setInterval(async () => {

            attempts++;


            const { data, error } =
                await db
                    .from("scan_commands")
                    .select("*")
                    .eq("id", commandId)
                    .single();


            if (error) {

                return;
            }


            if (data.status === "PENDING") {

                document
                    .getElementById("scanCommandStatus")
                    .innerHTML =
                    `<div class="pending">
                        Waiting for ESP32 scanner...
                    </div>`;

            }


            if (data.status === "RUNNING") {

                document
                    .getElementById("scanCommandStatus")
                    .innerHTML =
                    `<div class="pending">
                        ESP32 is performing the scan...
                    </div>`;

            }


            if (data.status === "COMPLETED") {

                clearInterval(scannerCommandTimer);

                scannerCommandTimer = null;


                document
                    .getElementById("scanCommandStatus")
                    .innerHTML =
                    `<div class="online">
                        Scan completed successfully.
                    </div>`;


                document
                    .getElementById("startScanButton")
                    .disabled = false;


                await loadOperatorScans();

                return;
            }


            if (data.status === "FAILED") {

                clearInterval(scannerCommandTimer);

                scannerCommandTimer = null;


                document
                    .getElementById("scanCommandStatus")
                    .innerHTML =
                    `<div class="offline">
                        ESP32 scan failed.
                        ${escapeHTML(data.error_message || "")}
                    </div>`;


                document
                    .getElementById("startScanButton")
                    .disabled = false;


                return;
            }


            // Timeout after 5 minutes
            if (attempts >= 150) {

                clearInterval(scannerCommandTimer);

                scannerCommandTimer = null;


                document
                    .getElementById("scanCommandStatus")
                    .innerHTML =
                    `<div class="offline">
                        Scanner response timed out.
                    </div>`;


                document
                    .getElementById("startScanButton")
                    .disabled = false;

            }

        }, 2000);

}


// ============================================================
// SCANNER STATUS
// ============================================================

async function checkScannerStatus() {

    const status =
        document.getElementById("scannerStatus");


    const { data, error } =
        await db
            .from("scanner_devices")
            .select("device_id,active")
            .eq("device_id", SCANNER_DEVICE_ID)
            .maybeSingle();


    if (error || !data) {

        scannerOnline = false;

        status.className =
            "scanner-status offline";

        status.textContent =
            "ESP32 scanner is not registered.";

        return;
    }


    if (!data.active) {

        scannerOnline = false;

        status.className =
            "scanner-status offline";

        status.textContent =
            "ABS-001 is inactive.";

        return;
    }


    // The device is registered.
    // Actual communication is confirmed when ESP32
    // processes the pending command.

    scannerOnline = true;

    status.className =
        "scanner-status online";

    status.textContent =
        "ESP32 scanner ABS-001 is registered and ready.";
}


// ============================================================
// OPERATOR SCANS
// ============================================================

async function loadOperatorScans() {

    const { data, error } =
        await db
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

        console.error(error);

        return;
    }


    const table =
        document.getElementById("operatorScansTable");

    table.innerHTML = "";


    data.forEach(scan => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(scan.scan_id || "-")}</td>

            <td>${escapeHTML(
                scan.subjects?.patient_id ||
                scan.subjects?.subject_id ||
                scan.subjects?.name ||
                "-"
            )}</td>

            <td>${escapeHTML(scan.measurement_side || "-")}</td>

            <td>${number(scan.f0)}</td>

            <td>${number(scan.rms)}</td>

            <td>${number(scan.q_factor)}</td>

            <td>${number(scan.bandwidth)}</td>

            <td>${escapeHTML(scan.comparison_status || "Recorded")}</td>

            <td>${formatDate(scan.created_at)}</td>

            <td>
                <button
                    class="danger"
                    onclick="deleteMeasurement('${scan.id}')"
                >
                    Delete
                </button>
            </td>
        `;

        table.appendChild(row);

    });

}


// ------------------------------------------------------------
// DELETE MEASUREMENT
// ------------------------------------------------------------

async function deleteMeasurement(id) {

    if (!confirm("Delete this measurement?")) {
        return;
    }


    const { error } =
        await db
            .from("scan_measurements")
            .delete()
            .eq("id", id);


    if (error) {

        alert(error.message);

        return;
    }


    await loadOperatorScans();

}


// ============================================================
// REFERENCE GROUPS FOR OPERATOR
// ============================================================

async function loadReferenceGroups() {

    const { data, error } =
        await db
            .from("reference_groups")
            .select("*")
            .order("age_min", {
                ascending: true
            });


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById("operatorReferenceTable");

    table.innerHTML = "";


    data.forEach(ref => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${ref.age_min ?? "-"}-${ref.age_max ?? "-"}</td>
            <td>${escapeHTML(ref.gender || "-")}</td>
            <td>${ref.sample_count ?? "-"}</td>
            <td>${number(ref.mean_f0)}</td>
            <td>${number(ref.sd_f0)}</td>
            <td>${number(ref.mean_rms)}</td>
            <td>${number(ref.sd_rms)}</td>
            <td>${number(ref.mean_q)}</td>
            <td>${number(ref.sd_q)}</td>
        `;

        table.appendChild(row);

    });

}


// ============================================================
// PATIENT ACCESS
// ============================================================

async function patientAccess() {

    const code =
        document
            .getElementById("patientLinkCode")
            .value
            .trim();


    if (!/^\d{6}$/.test(code)) {

        document.getElementById("patientMessage")
            .innerHTML =
            `<div class="message">
                Enter a valid 6-digit linking code.
            </div>`;

        return;
    }


    const { data, error } =
        await db.rpc(
            "get_patient_results",
            {
                p_linking_code: code
            }
        );


    if (error) {

        document.getElementById("patientMessage")
            .innerHTML =
            `<div class="message">
                Unable to load patient results.
            </div>`;

        console.error(error);

        return;
    }


    if (!data || data.length === 0) {

        document.getElementById("patientMessage")
            .innerHTML =
            `<div class="message">
                No patient found for this linking code.
            </div>`;

        return;
    }


    displayPatientResults(data);

}


// ------------------------------------------------------------
// DISPLAY PATIENT RESULTS
// ------------------------------------------------------------

function displayPatientResults(data) {

    const first = data[0];


    document
        .getElementById("loginScreen")
        .classList.add("hidden");

    document
        .getElementById("staffApp")
        .classList.add("hidden");

    document
        .getElementById("patientResultScreen")
        .classList.remove("hidden");


    document.getElementById("patientDetails")
        .innerHTML = `
            <div class="result-grid">

                <div class="result-item">
                    <small>Patient Name</small>
                    <strong>${escapeHTML(first.patient_name || "-")}</strong>
                </div>

                <div class="result-item">
                    <small>Patient ID</small>
                    <strong>${escapeHTML(first.patient_id || "-")}</strong>
                </div>

                <div class="result-item">
                    <small>Age</small>
                    <strong>${first.patient_age ?? "-"}</strong>
                </div>

                <div class="result-item">
                    <small>Gender</small>
                    <strong>${escapeHTML(first.patient_gender || "-")}</strong>
                </div>

            </div>
        `;


    const table =
        document.getElementById("patientResultsTable");

    table.innerHTML = "";


    data.forEach(scan => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${formatDate(scan.scan_date)}</td>
            <td>${escapeHTML(scan.scan_id || "-")}</td>
            <td>${escapeHTML(scan.measurement_side || "-")}</td>
            <td>${number(scan.f0)}</td>
            <td>${number(scan.rms)}</td>
            <td>${number(scan.q_factor)}</td>
            <td>${number(scan.bandwidth)}</td>
            <td>${escapeHTML(scan.comparison_status || "Recorded")}</td>
        `;

        table.appendChild(row);

    });

}


// ------------------------------------------------------------
// PATIENT LOGOUT
// ------------------------------------------------------------

function patientLogout() {

    document
        .getElementById("patientResultScreen")
        .classList.add("hidden");

    document
        .getElementById("loginScreen")
        .classList.remove("hidden");

    document.getElementById("patientLinkCode").value = "";

}


// ============================================================
// STAFF LOGOUT
// ============================================================

async function logout() {

    if (scannerCommandTimer) {

        clearInterval(scannerCommandTimer);

        scannerCommandTimer = null;

    }


    await db.auth.signOut();


    currentUser = null;
    currentProfile = null;
    currentPatient = null;


    document
        .getElementById("staffApp")
        .classList.add("hidden");

    document
        .getElementById("adminDashboard")
        .classList.add("hidden");

    document
        .getElementById("operatorDashboard")
        .classList.add("hidden");

    document
        .getElementById("loginScreen")
        .classList.remove("hidden");

}


// ============================================================
// REGISTER UI
// ============================================================

function showRegister() {

    document
        .getElementById("registerBox")
        .classList.remove("hidden");

}


function hideRegister() {

    document
        .getElementById("registerBox")
        .classList.add("hidden");

}


// ============================================================
// LOGIN SCREEN
// ============================================================

function showLogin() {

    document
        .getElementById("staffApp")
        .classList.add("hidden");

    document
        .getElementById("patientResultScreen")
        .classList.add("hidden");

    document
        .getElementById("loginScreen")
        .classList.remove("hidden");

}


function showLoginMessage(message) {

    document.getElementById("loginMessage")
        .innerHTML =
        `<div class="message">${escapeHTML(message)}</div>`;

}


// ============================================================
// HELPERS
// ============================================================

function number(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }


    const n = Number(value);


    if (!Number.isFinite(n)) {
        return "-";
    }


    return n.toFixed(2);

}


function formatDate(value) {

    if (!value) {
        return "-";
    }


    try {

        return new Date(value)
            .toLocaleString();

    } catch {

        return "-";

    }

}


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ============================================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ============================================================

window.loginStaff = loginStaff;
window.registerOperator = registerOperator;
window.logout = logout;

window.showRegister = showRegister;
window.hideRegister = hideRegister;

window.patientAccess = patientAccess;
window.patientLogout = patientLogout;

window.createPatient = createPatient;
window.closePatientModal = closePatientModal;

window.selectPatient = selectPatient;
window.selectMeasurementSide = selectMeasurementSide;

window.startPatientScan = startPatientScan;

window.deletePatient = deletePatient;
window.deleteMeasurement = deleteMeasurement;

window.addReferenceGroup = addReferenceGroup;
