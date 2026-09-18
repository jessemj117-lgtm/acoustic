// ============================================================
// GROUP 4 ACOUSTIC BONE SCANNER
// WEBSITE APPLICATION
// ============================================================

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================
//
// Keep your existing Supabase URL and publishable key here.
//
// IMPORTANT:
// Never put the Supabase service-role/secret key in this file.
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
// GLOBAL VARIABLES
// ============================================================

let currentUser = null;
let currentProfile = null;

let currentPatient = null;
let currentMeasurementSide = null;

let referenceScannerRunning = false;
let patientScannerRunning = false;


// ============================================================
// ESP32 WIRELESS STATE
// ============================================================

let esp32Connected = false;

let esp32BaseUrl =
    localStorage.getItem("esp32BaseUrl") || "";

let wirelessPollTimer = null;

let wirelessScanStartTime = null;

const ESP32_DEVICE_ID = "ABS-001";


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

                console.error(error);

                showLogin();

                return;

            }


            if (data.session) {

                currentUser =
                    data.session.user;

                await loadDashboard();

            }

            else {

                showLogin();

            }


            // Restore previously entered ESP32 address.
            const esp32Input =
                document.getElementById(
                    "esp32BaseUrl"
                );


            if (
                esp32Input &&
                esp32BaseUrl
            ) {

                esp32Input.value =
                    esp32BaseUrl;

            }


            setScannerStatus(
                "ESP32 wireless connection: Not connected."
            );


        }

        catch (error) {

            console.error(
                "Startup error:",
                error
            );

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

        console.error(error);

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

}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    if (!currentUser) {

        const {
            data
        } =
            await supabaseClient.auth
                .getUser();

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


    document
        .getElementById("loginScreen")
        ?.classList
        .add("hidden");


    document
        .getElementById("patientResultScreen")
        ?.classList
        .add("hidden");


    document
        .getElementById("dashboard")
        ?.classList
        .remove("hidden");


    document
        .getElementById("adminDashboard")
        ?.classList
        .add("hidden");


    document
        .getElementById("operatorDashboard")
        ?.classList
        .add("hidden");


    const userInfo =
        document.getElementById(
            "userInfo"
        );


    if (userInfo) {

        userInfo.textContent =
            `${profile.full_name || profile.email || currentUser.email} | Role: ${profile.role}`;

    }


    if (profile.role === "admin") {

        document
            .getElementById("adminDashboard")
            ?.classList
            .remove("hidden");


        await loadAdminDashboard();

    }


    else if (profile.role === "operator") {

        document
            .getElementById("operatorDashboard")
            ?.classList
            .remove("hidden");


        await loadOperatorDashboard();

    }


    else {

        console.error(
            "Unknown user role:",
            profile.role
        );

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
            .eq(
                "id",
                currentUser.id
            )
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


    (data || []).forEach(
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
                    ${escapeHTML(
                        user.email || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        user.full_name || ""
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        user.role || ""
                    )}
                </td>

                <td>
                    ${formatDate(
                        user.created_at
                    )}
                </td>

            `;


            table.appendChild(row);

        }
    );


    const adminUsers =
        document.getElementById(
            "adminUsers"
        );


    if (adminUsers) {

        adminUsers.textContent =
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


    const subjects =
        data || [];


    const adminSubjects =
        document.getElementById(
            "adminSubjects"
        );


    if (adminSubjects) {

        adminSubjects.textContent =
            subjects.length;

    }


    const container =
        document.getElementById(
            "adminSubjectsList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    if (!subjects.length) {

        container.innerHTML =
            `<div class="empty">
                No patients registered.
             </div>`;

        return;

    }


    subjects.forEach(
        function (patient) {

            const div =
                document.createElement(
                    "div"
                );


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
                    ${escapeHTML(
                        patientId
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

                <div style="margin-top:10px;">

                    <button
                        class="danger"
                        onclick="deletePatient('${escapeHTMLAttribute(patient.id)}')"
                    >
                        Delete Patient
                    </button>

                </div>

            `;


            container.appendChild(div);

        }
    );

}


// ============================================================
// ADMIN ADD PATIENT
// ============================================================

function openAdminPatientModal() {

    if (
        !currentProfile ||
        currentProfile.role !== "admin"
    ) {

        alert(
            "Only an admin can add patients."
        );

        return;

    }


    const modal =
        document.getElementById(
            "adminPatientModal"
        );


    if (!modal) {

        alert(
            "Admin patient form was not found in index.html."
        );

        return;

    }


    modal
        .classList
        .remove("hidden");

}


function closeAdminPatientModal() {

    const modal =
        document.getElementById(
            "adminPatientModal"
        );


    if (modal) {

        modal
            .classList
            .add("hidden");

    }

}


async function createAdminPatient() {

    if (
        !currentProfile ||
        currentProfile.role !== "admin"
    ) {

        alert(
            "Only an admin can add patients."
        );

        return;

    }


    const name =
        document
            .getElementById(
                "adminSubjectName"
            )
            ?.value
            .trim();


    const age =
        parseInt(
            document
                .getElementById(
                    "adminSubjectAge"
                )
                ?.value,
            10
        );


    const gender =
        document
            .getElementById(
                "adminSubjectGender"
            )
            ?.value;


    const message =
        document.getElementById(
            "adminSubjectMessage"
        );


    if (
        !name ||
        !Number.isFinite(age) ||
        age <= 0 ||
        !gender
    ) {

        setMessage(
            message,
            "Please enter patient name, age and gender.",
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


        const createdPatientInfo =
            document.getElementById(
                "createdPatientInfo"
            );


        if (createdPatientInfo) {

            createdPatientInfo.innerHTML = `

                <p>
                    Patient has been registered successfully.
                </p>

                <p>
                    Patient ID:
                </p>

                <div class="code-display">
                    ${escapeHTML(
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

            `;

        }


        const patientModal =
            document.getElementById(
                "patientModal"
            );


        if (patientModal) {

            patientModal
                .classList
                .remove("hidden");

        }


        clearAdminPatientForm();


        closeAdminPatientModal();


        setMessage(
            message,
            "Patient registered successfully.",
            "success"
        );


        await loadAllSubjects();


    }

    catch (error) {

        console.error(
            "Admin patient creation error:",
            error
        );


        setMessage(
            message,
            error.message ||
            "Could not create patient.",
            "error"
        );

    }

}


// ============================================================
// CLEAR ADMIN PATIENT FORM
// ============================================================

function clearAdminPatientForm() {

    const name =
        document.getElementById(
            "adminSubjectName"
        );

    const age =
        document.getElementById(
            "adminSubjectAge"
        );

    const gender =
        document.getElementById(
            "adminSubjectGender"
        );


    if (name) {

        name.value = "";

    }


    if (age) {

        age.value = "";

    }


    if (gender) {

        gender.value = "";

    }

}


// ============================================================
// ADMIN DELETE PATIENT
// ============================================================

async function deletePatient(id) {

    if (
        !currentProfile ||
        currentProfile.role !== "admin"
    ) {

        alert(
            "Only an admin can delete patients."
        );

        return;

    }


    if (!id) {

        alert(
            "Invalid patient ID."
        );

        return;

    }


    const confirmed =
        confirm(
            "Are you sure you want to delete this patient?\n\n" +
            "The patient's scan measurements will also be deleted.\n\n" +
            "This action cannot be undone."
        );


    if (!confirmed) {

        return;

    }


    try {

        // Delete patient's scans first.
        const {
            error: scanDeleteError
        } =
            await supabaseClient
                .from(
                    "scan_measurements"
                )
                .delete()
                .eq(
                    "subject_id",
                    id
                );


        if (scanDeleteError) {

            console.error(
                "Patient scan deletion error:",
                scanDeleteError
            );

            alert(
                "Could not delete the patient's scan measurements:\n\n" +
                scanDeleteError.message
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
                "Could not delete patient:\n\n" +
                error.message
            );

            return;

        }


        if (
            currentPatient &&
            currentPatient.id === id
        ) {

            currentPatient =
                null;

            currentMeasurementSide =
                null;

        }


        alert(
            "Patient deleted successfully."
        );


        await loadAllSubjects();

        await loadAllScans();

        await loadScans();


    }

    catch (error) {

        console.error(
            "Delete patient error:",
            error
        );

        alert(
            "An unexpected error occurred while deleting the patient."
        );

    }

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


    const scans =
        data || [];


    const adminScans =
        document.getElementById(
            "adminScans"
        );


    if (adminScans) {

        adminScans.textContent =
            scans.length;

    }


    const table =
        document.getElementById(
            "adminScansTable"
        );


    if (!table) {

        return;

    }


    table.innerHTML = "";


    if (!scans.length) {

        table.innerHTML =
            `<tr>
                <td colspan="11">
                    No patient measurements found.
                </td>
             </tr>`;

        return;

    }


    scans.forEach(
        function (scan) {

            const patient =
                scan.subjects || {};


            const row =
                document.createElement(
                    "tr"
                );


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
                        onclick="deletePatientMeasurement('${escapeHTMLAttribute(scan.id)}')"
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


    const references =
        data || [];


    const adminReferences =
        document.getElementById(
            "adminReferences"
        );


    if (adminReferences) {

        adminReferences.textContent =
            references.length;

    }


    renderReferenceTable(
        references,
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


    const subjects =
        data || [];


    const container =
        document.getElementById(
            "subjectsList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    if (!subjects.length) {

        container.innerHTML =
            `<div class="empty">
                No patients registered yet.
             </div>`;

        return;

    }


    subjects.forEach(
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
                    onclick='selectPatient(${safeJSONString(patient)})'
                >
                    Select for Scan
                </button>

            `;


            container.appendChild(div);

        }
    );

}


// ============================================================
// CREATE PATIENT - OPERATOR
// ============================================================

async function createPatient() {

    const name =
        document
            .getElementById(
                "subjectName"
            )
            ?.value
            .trim();


    const age =
        parseInt(
            document
                .getElementById(
                    "subjectAge"
                )
                ?.value,
            10
        );


    const gender =
        document
            .getElementById(
                "subjectGender"
            )
            ?.value;


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


        const createdPatientInfo =
            document.getElementById(
                "createdPatientInfo"
            );


        if (createdPatientInfo) {

            createdPatientInfo.innerHTML = `

                <p>
                    Patient has been registered successfully.
                </p>

                <p>
                    Patient ID:
                </p>

                <div class="code-display">
                    ${escapeHTML(
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


        document
            .getElementById(
                "patientModal"
            )
            ?.classList
            .remove("hidden");


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

    }

    catch (error) {

        console.error(
            "Create patient error:",
            error
        );


        setMessage(
            message,
            error.message ||
            "Could not create patient.",
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
            Math.random() * 90000
        );


    return `PAT-${random}`;

}


// ============================================================
// GENERATE UNIQUE 6-DIGIT LINKING CODE
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
// SELECT PATIENT FOR SCAN
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


    document
        .getElementById(
            "leftSideButton"
        )
        ?.classList
        .remove("selected");


    document
        .getElementById(
            "rightSideButton"
        )
        ?.classList
        .remove("selected");


    preparation?.scrollIntoView({
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


    if (
        side !== "Left" &&
        side !== "Right"
    ) {

        alert(
            "Invalid measurement side."
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


    document
        .getElementById(
            "leftSideButton"
        )
        ?.classList
        .remove("selected");


    document
        .getElementById(
            "rightSideButton"
        )
        ?.classList
        .remove("selected");


    if (side === "Left") {

        document
            .getElementById(
                "leftSideButton"
            )
            ?.classList
            .add("selected");

    }


    if (side === "Right") {

        document
            .getElementById(
                "rightSideButton"
            )
            ?.classList
            .add("selected");

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


    let url =
        input
            ? input.value.trim()
            : esp32BaseUrl;


    if (!url) {

        throw new Error(
            "Enter the ESP32 IP address first."
        );

    }


    // Add HTTP automatically if user enters only an IP.
    if (
        !url.startsWith(
            "http://"
        ) &&
        !url.startsWith(
            "https://"
        )
    ) {

        url =
            "http://" +
            url;

    }


    // Remove trailing slash.
    url =
        url.replace(
            /\/+$/,
            ""
        );


    return url;

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


    const url =
        baseUrl +
        path;


    const requestOptions = {
        method:
            options.method ||
            "GET",

        headers: {
            "Content-Type":
                "application/json",

            ...(options.headers || {})
        },

        ...options
    };


    let response;


    try {

        response =
            await fetch(
                url,
                requestOptions
            );

    }

    catch (error) {

        throw new Error(
            "Could not reach the ESP32. Check Wi-Fi connection, IP address and ESP32 server."
        );

    }


    if (!response.ok) {

        throw new Error(
            `ESP32 returned HTTP ${response.status}.`
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

    }

    catch {

        return {
            ok: true,
            text: text
        };

    }

}


// ============================================================
// CONNECT ESP32
// ============================================================

async function connectESP32() {

    try {

        const baseUrl =
            getESP32BaseUrl();


        esp32BaseUrl =
            baseUrl;


        localStorage.setItem(
            "esp32BaseUrl",
            baseUrl
        );


        setScannerStatus(
            "Connecting to ESP32..."
        );


        const result =
            await wirelessRequest(
                "/api/status"
            );


        if (
            result &&
            result.device_id &&
            result.device_id !==
                ESP32_DEVICE_ID
        ) {

            console.warn(
                "Unexpected scanner device:",
                result.device_id
            );

        }


        esp32Connected =
            true;


        setScannerStatus(
            `ESP32 Connected | Scanner: ${result.device_id || ESP32_DEVICE_ID}`
        );


        const operatorStatus =
            document.getElementById(
                "operatorScannerStatus"
            );


        if (operatorStatus) {

            operatorStatus.textContent =
                `Scanner status: ESP32 Connected | Scanner: ${result.device_id || ESP32_DEVICE_ID}`;

        }


        return true;

    }

    catch (error) {

        console.error(
            "ESP32 connection error:",
            error
        );


        esp32Connected =
            false;


        setScannerStatus(
            "ESP32 connection failed: " +
            error.message
        );


        alert(
            "ESP32 connection failed.\n\n" +
            error.message
        );


        return false;

    }

}


// ============================================================
// DISCONNECT ESP32
// ============================================================

async function disconnectESP32() {

    stopWirelessScanPolling();


    esp32Connected =
        false;


    patientScannerRunning =
        false;


    referenceScannerRunning =
        false;


    setScannerStatus(
        "ESP32 wireless connection: Not connected."
    );


    const operatorStatus =
        document.getElementById(
            "operatorScannerStatus"
        );


    if (operatorStatus) {

        operatorStatus.textContent =
            "Scanner status: ESP32 disconnected.";

    }

}


// ============================================================
// SET SCANNER STATUS
// ============================================================

function setScannerStatus(message) {

    const status =
        document.getElementById(
            "scannerStatus"
        );


    if (status) {

        status.textContent =
            message;

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


    if (!esp32Connected) {

        alert(
            "Connect ESP32 first."
        );

        return;

    }


    patientScannerRunning =
        true;


    wirelessScanStartTime =
        Date.now();


    const operatorStatus =
        document.getElementById(
            "operatorScannerStatus"
        );


    if (operatorStatus) {

        operatorStatus.textContent =
            "Scanner status: Starting acoustic scan...";

    }


    setScannerStatus(
        "ESP32 connected. Starting acoustic scan..."
    );


    try {

        const result =
            await wirelessRequest(
                "/api/scan/start",
                {
                    method: "POST",

                    body:
                        JSON.stringify({

                            command:
                                "start_scan",

                            subject_id:
                                currentPatient.id,

                            side:
                                currentMeasurementSide,

                            device_id:
                                ESP32_DEVICE_ID

                        })
                }
            );


        if (
            result &&
            result.ok === false
        ) {

            throw new Error(
                result.message ||
                "ESP32 refused to start the scan."
            );

        }


        setScannerStatus(
            "Scanning... 0%"
        );


        if (operatorStatus) {

            operatorStatus.textContent =
                "Scanner status: Scanning... 0%";

        }


        startWirelessScanPolling();

    }

    catch (error) {

        console.error(
            "Start wireless scan error:",
            error
        );


        patientScannerRunning =
            false;


        setScannerStatus(
            "Could not start scan: " +
            error.message
        );


        if (operatorStatus) {

            operatorStatus.textContent =
                "Scanner status: Scan failed to start.";

        }


        alert(
            "Could not start acoustic scan.\n\n" +
            error.message
        );

    }

}


// ============================================================
// STOP PATIENT SCAN
// ============================================================

async function stopPatientScan() {

    if (!patientScannerRunning) {

        setScannerStatus(
            "No patient scan is currently running."
        );

        return;

    }


    try {

        await wirelessRequest(
            "/api/scan/stop",
            {
                method: "POST",

                body:
                    JSON.stringify({
                        command:
                            "stop_scan"
                    })
            }
        );

    }

    catch (error) {

        console.error(
            "Stop scan error:",
            error
        );

    }


    patientScannerRunning =
        false;


    stopWirelessScanPolling();


    setScannerStatus(
        "Scan stopped. No incomplete measurement was saved."
    );


    const operatorStatus =
        document.getElementById(
            "operatorScannerStatus"
        );


    if (operatorStatus) {

        operatorStatus.textContent =
            "Scanner status: Scan stopped.";

    }

}


// ============================================================
// START WIRELESS SCAN POLLING
// ============================================================

function startWirelessScanPolling() {

    stopWirelessScanPolling();


    wirelessPollTimer =
        setInterval(
            async function () {

                await pollWirelessScanStatus();

            },
            700
        );

}


// ============================================================
// STOP WIRELESS SCAN POLLING
// ============================================================

function stopWirelessScanPolling() {

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

    if (!patientScannerRunning) {

        return;

    }


    // 5-minute safety timeout.
    if (
        wirelessScanStartTime &&
        Date.now() -
            wirelessScanStartTime >
            5 * 60 * 1000
    ) {

        patientScannerRunning =
            false;

        stopWirelessScanPolling();


        setScannerStatus(
            "Scan timed out."
        );


        try {

            await wirelessRequest(
                "/api/scan/stop",
                {
                    method: "POST",

                    body:
                        JSON.stringify({
                            command:
                                "stop_scan"
                        })
                }
            );

        }

        catch {

            // Ignore stop failure after timeout.

        }


        alert(
            "The acoustic scan timed out. No incomplete result was saved."
        );


        return;

    }


    try {

        const result =
            await wirelessRequest(
                "/api/scan/status"
            );


        if (!result) {

            return;

        }


        // ----------------------------------------------------
        // SCAN PROGRESS
        // ----------------------------------------------------

        if (
            result.type ===
            "scan_progress"
        ) {

            const frequency =
                Number(
                    result.frequency
                );


            const progress =
                Number(
                    result.progress
                );


            const frequencyText =
                Number.isFinite(
                    frequency
                )
                    ? `${frequency} Hz`
                    : "";


            const progressText =
                Number.isFinite(
                    progress
                )
                    ? `${progress}%`
                    : "";


            setScannerStatus(
                `Scanning... ${frequencyText} ${progressText}`
            );


            const operatorStatus =
                document.getElementById(
                    "operatorScannerStatus"
                );


            if (operatorStatus) {

                operatorStatus.textContent =
                    `Scanner status: Scanning... ${frequencyText} ${progressText}`;

            }


            return;

        }


        // ----------------------------------------------------
        // SCAN RESULT
        // ----------------------------------------------------

        if (
            result.type ===
                "scan_result" ||
            result.type ===
                "result" ||
            result.result
        ) {

            const scanResult =
                result.result ||
                result;


            patientScannerRunning =
                false;


            stopWirelessScanPolling();


            setScannerStatus(
                "Scan Complete"
            );


            const operatorStatus =
                document.getElementById(
                    "operatorScannerStatus"
                );


            if (operatorStatus) {

                operatorStatus.textContent =
                    "Scanner status: Scan Complete";

            }


            await validateAndSaveWirelessResult(
                scanResult
            );


            return;

        }


        // ----------------------------------------------------
        // SCAN STOPPED
        // ----------------------------------------------------

        if (
            result.type ===
            "scan_stopped"
        ) {

            patientScannerRunning =
                false;

            stopWirelessScanPolling();


            setScannerStatus(
                "Scan stopped."
            );


            return;

        }


        // ----------------------------------------------------
        // DEVICE DISCONNECTED
        // ----------------------------------------------------

        if (
            result.connected ===
            false
        ) {

            esp32Connected =
                false;

            patientScannerRunning =
                false;

            stopWirelessScanPolling();


            setScannerStatus(
                "ESP32 disconnected."
            );


            return;

        }

    }

    catch (error) {

        console.error(
            "Wireless scan status error:",
            error
        );


        // Do not immediately stop for one temporary
        // Wi-Fi request failure.
        // The next poll will try again.

    }

}


// ============================================================
// VALIDATE AND SAVE WIRELESS RESULT
// ============================================================

async function validateAndSaveWirelessResult(
    result
) {

    if (!result) {

        alert(
            "ESP32 returned an empty scan result."
        );

        return;

    }


    const f0 =
        Number(
            result.f0
        );


    const rms =
        Number(
            result.rms
        );


    const qFactor =
        Number(
            result.q_factor
        );


    const bandwidth =
        Number(
            result.bandwidth
        );


    if (!Number.isFinite(f0)) {

        alert(
            "Invalid scan result: missing F₀."
        );

        return;

    }


    if (!Number.isFinite(rms)) {

        alert(
            "Invalid scan result: missing RMS."
        );

        return;

    }


    if (!Number.isFinite(qFactor)) {

        alert(
            "Invalid scan result: missing Q-factor."
        );

        return;

    }


    if (!Number.isFinite(bandwidth)) {

        alert(
            "Invalid scan result: missing bandwidth."
        );

        return;

    }


    try {

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
            "Scan Complete — Measurement saved."
        );


        alert(
            "Acoustic scan completed successfully.\n\n" +
            "F₀: " +
            formatNumber(f0) +
            " Hz\n" +
            "RMS: " +
            formatNumber(rms) +
            "\n" +
            "Q-factor: " +
            formatNumber(qFactor) +
            "\n" +
            "Bandwidth: " +
            formatNumber(bandwidth) +
            " Hz"
        );


        return saved;

    }

    catch (error) {

        console.error(
            "Wireless result save error:",
            error
        );


        setScannerStatus(
            "Scan completed, but saving failed."
        );


        alert(
            "The ESP32 completed the scan, but the result could not be saved.\n\n" +
            error.message
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


    const f0 =
        Number(
            result.f0
        );


    const rms =
        Number(
            result.rms
        );


    const qFactor =
        Number(
            result.q_factor
        );


    const bandwidth =
        Number(
            result.bandwidth
        );


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


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "scan_measurements"
            )
            .insert({

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
                    null

            })
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
// GENERATE SCAN ID
// ============================================================

function generateScanId() {

    const timestamp =
        Date.now()
            .toString()
            .slice(-8);


    return `SCAN-${timestamp}`;

}


// ============================================================
// CANCEL SCAN PREPARATION
// ============================================================

function cancelScanPreparation() {

    if (patientScannerRunning) {

        stopPatientScan();

    }


    currentPatient =
        null;

    currentMeasurementSide =
        null;

    patientScannerRunning =
        false;


    document
        .getElementById(
            "scanPreparation"
        )
        ?.classList
        .add("hidden");

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


    const scans =
        data || [];


    const table =
        document.getElementById(
            "scansList"
        );


    if (!table) {

        return;

    }


    table.innerHTML = "";


    if (!scans.length) {

        table.innerHTML =
            `<tr>
                <td colspan="10">
                    No patient measurements found.
                </td>
             </tr>`;

        return;

    }


    scans.forEach(
        function (scan) {

            const patient =
                scan.subjects || {};


            const row =
                document.createElement(
                    "tr"
                );


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
                        onclick="deletePatientMeasurement('${escapeHTMLAttribute(scan.id)}')"
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


    if (tab === "manual") {

        manualPanel
            ?.classList
            .remove("hidden");

        scannerPanel
            ?.classList
            .add("hidden");

        manualButton
            ?.classList
            .add("active");

        scannerButton
            ?.classList
            .remove("active");

    }

    else {

        manualPanel
            ?.classList
            .add("hidden");

        scannerPanel
            ?.classList
            .remove("hidden");

        manualButton
            ?.classList
            .remove("active");

        scannerButton
            ?.classList
            .add("active");

    }

}


// ============================================================
// ADD MANUAL REFERENCE MEASUREMENT
// ============================================================

async function addManualReference() {

    const sampleId =
        document
            .getElementById(
                "referenceSampleId"
            )
            ?.value
            .trim();


    const referenceId =
        document
            .getElementById(
                "referenceId"
            )
            ?.value
            .trim();


    const age =
        parseInt(
            document
                .getElementById(
                    "referenceAge"
                )
                ?.value,
            10
        );


    const gender =
        document
            .getElementById(
                "referenceGender"
            )
            ?.value;


    const side =
        document
            .getElementById(
                "referenceSide"
            )
            ?.value;


    const f0 =
        parseFloat(
            document
                .getElementById(
                    "referenceF0"
                )
                ?.value
        );


    const rms =
        parseFloat(
            document
                .getElementById(
                    "referenceRMS"
                )
                ?.value
        );


    const qFactor =
        parseFloat(
            document
                .getElementById(
                    "referenceQ"
                )
                ?.value
        );


    const bandwidth =
        parseFloat(
            document
                .getElementById(
                    "referenceBandwidth"
                )
                ?.value
        );


    const notes =
        document
            .getElementById(
                "referenceNotes"
            )
            ?.value
            .trim();


    const message =
        document.getElementById(
            "referenceMessage"
        );


    if (
        !sampleId ||
        !Number.isFinite(age) ||
        age <= 0 ||
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
            ?.value
            .trim();


    const age =
        parseInt(
            document
                .getElementById(
                    "scannerReferenceAge"
                )
                ?.value,
            10
        );


    const gender =
        document
            .getElementById(
                "scannerReferenceGender"
            )
            ?.value;


    const side =
        document
            .getElementById(
                "scannerReferenceSide"
            )
            ?.value;


    if (
        !sampleId ||
        !Number.isFinite(age) ||
        age <= 0 ||
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
            "Connect ESP32 first."
        );

        return;

    }


    referenceScannerRunning =
        true;


    setReferenceScannerStatus(
        "Starting ESP32 reference scan..."
    );


    try {

        const result =
            await wirelessRequest(
                "/api/scan/start",
                {
                    method: "POST",

                    body:
                        JSON.stringify({

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

                            device_id:
                                ESP32_DEVICE_ID

                        })
                }
            );


        if (
            result &&
            result.ok === false
        ) {

            throw new Error(
                result.message ||
                "ESP32 refused to start the reference scan."
            );

        }


        setReferenceScannerStatus(
            "Reference scan running..."
        );


        startReferenceWirelessPolling(
            {
                sample_id:
                    sampleId,

                age:
                    age,

                gender:
                    gender,

                measurement_side:
                    side
            }
        );

    }

    catch (error) {

        console.error(
            "Reference scanner error:",
            error
        );


        referenceScannerRunning =
            false;


        setReferenceScannerStatus(
            "Reference scan failed: " +
            error.message
        );


        alert(
            "Could not start reference scan.\n\n" +
            error.message
        );

    }

}


// ============================================================
// REFERENCE WIRELESS POLLING
// ============================================================

let referencePollTimer = null;


function startReferenceWirelessPolling(
    referenceInfo
) {

    stopReferenceWirelessPolling();


    referencePollTimer =
        setInterval(
            async function () {

                try {

                    const result =
                        await wirelessRequest(
                            "/api/scan/status"
                        );


                    if (!result) {

                        return;

                    }


                    if (
                        result.type ===
                        "scan_progress"
                    ) {

                        const frequency =
                            Number(
                                result.frequency
                            );


                        const progress =
                            Number(
                                result.progress
                            );


                        setReferenceScannerStatus(
                            `Scanning... ${
                                Number.isFinite(
                                    frequency
                                )
                                    ? frequency + " Hz"
                                    : ""
                            } ${
                                Number.isFinite(
                                    progress
                                )
                                    ? progress + "%"
                                    : ""
                            }`
                        );


                        return;

                    }


                    if (
                        result.type ===
                            "scan_result" ||
                        result.type ===
                            "result" ||
                        result.result
                    ) {

                        const scanResult =
                            result.result ||
                            result;


                        stopReferenceWirelessPolling();


                        referenceScannerRunning =
                            false;


                        await validateAndSaveReferenceResult(
                            {
                                ...referenceInfo,

                                ...scanResult

                            }
                        );


                        return;

                    }


                    if (
                        result.type ===
                        "scan_stopped"
                    ) {

                        stopReferenceWirelessPolling();


                        referenceScannerRunning =
                            false;


                        setReferenceScannerStatus(
                            "Reference scan stopped."
                        );

                    }

                }

                catch (error) {

                    console.error(
                        "Reference polling error:",
                        error
                    );

                }

            },
            700
        );

}


function stopReferenceWirelessPolling() {

    if (referencePollTimer) {

        clearInterval(
            referencePollTimer
        );

        referencePollTimer =
            null;

    }

}


// ============================================================
// VALIDATE AND SAVE REFERENCE RESULT
// ============================================================

async function validateAndSaveReferenceResult(
    result
) {

    const f0 =
        Number(
            result.f0
        );


    const rms =
        Number(
            result.rms
        );


    const qFactor =
        Number(
            result.q_factor
        );


    const bandwidth =
        Number(
            result.bandwidth
        );


    if (!Number.isFinite(f0)) {

        alert(
            "Invalid reference result: missing F₀."
        );

        return;

    }


    if (!Number.isFinite(rms)) {

        alert(
            "Invalid reference result: missing RMS."
        );

        return;

    }


    if (!Number.isFinite(qFactor)) {

        alert(
            "Invalid reference result: missing Q-factor."
        );

        return;

    }


    if (!Number.isFinite(bandwidth)) {

        alert(
            "Invalid reference result: missing bandwidth."
        );

        return;

    }


    try {

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


        setReferenceScannerStatus(
            "Reference measurement saved successfully."
        );


        alert(
            "Reference acoustic measurement saved successfully."
        );

    }

    catch (error) {

        console.error(
            "Reference result save error:",
            error
        );


        setReferenceScannerStatus(
            "Reference scan completed, but saving failed."
        );


        alert(
            "Reference scan completed, but the measurement could not be saved.\n\n" +
            error.message
        );

    }

}


// ============================================================
// REFERENCE SCANNER STATUS
// ============================================================

function setReferenceScannerStatus(
    message
) {

    const element =
        document.getElementById(
            "referenceScannerStatus"
        );


    if (element) {

        element.textContent =
            "Scanner status: " +
            message;

    }

}


// ============================================================
// STOP REFERENCE SCANNER
// ============================================================

async function stopReferenceScanner() {

    stopReferenceWirelessPolling();


    if (referenceScannerRunning) {

        try {

            await wirelessRequest(
                "/api/scan/stop",
                {
                    method: "POST",

                    body:
                        JSON.stringify({
                            command:
                                "stop_scan"
                        })
                }
            );

        }

        catch (error) {

            console.error(
                "Stop reference scanner error:",
                error
            );

        }

    }


    referenceScannerRunning =
        false;


    setReferenceScannerStatus(
        "Stopped."
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


    const f0 =
        Number(
            result.f0
        );


    const rms =
        Number(
            result.rms
        );


    const qFactor =
        Number(
            result.q_factor
        );


    const bandwidth =
        Number(
            result.bandwidth
        );


    if (
        !Number.isFinite(f0) ||
        !Number.isFinite(rms) ||
        !Number.isFinite(qFactor) ||
        !Number.isFinite(bandwidth)
    ) {

        throw new Error(
            "Invalid scanner reference measurement."
        );

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
                    f0,

                rms:
                    rms,

                q_factor:
                    qFactor,

                bandwidth:
                    bandwidth,

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


    setReferenceScannerStatus(
        "Measurement saved successfully."
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


    if (!table) {

        return;

    }


    table.innerHTML = "";


    if (
        !data ||
        !data.length
    ) {

        table.innerHTML =
            `<tr>
                <td colspan="11">
                    No reference measurements found.
                </td>
             </tr>`;

        return;

    }


    data.forEach(
        function (reference) {

            const row =
                document.createElement(
                    "tr"
                );


            let action = "";


            if (allowDelete) {

                action = `

                    <button
                        class="danger"
                        onclick="deleteReferenceMeasurement('${escapeHTMLAttribute(reference.id)}')"
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


    const references =
        data || [];


    const table =
        document.getElementById(
            "referenceList"
        );


    if (!table) {

        return;

    }


    table.innerHTML = "";


    if (!references.length) {

        table.innerHTML =
            `<tr>
                <td colspan="10">
                    No reference measurements found.
                </td>
             </tr>`;

        return;

    }


    references.forEach(
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


    if (error) {

        console.error(
            "Scanner devices error:",
            error
        );


        const element =
            document.getElementById(
                "adminScannerDevices"
            );


        if (element) {

            element.textContent =
                "Unable to load scanner devices.";

        }


        return;

    }


    const devices =
        data || [];


    const container =
        document.getElementById(
            "adminScannerDevices"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    if (!devices.length) {

        container.innerHTML =
            "No scanner devices registered.";

        return;

    }


    devices.forEach(
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
            ?.value
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

function displayPatientResults(
    data
) {

    const first =
        data[0];


    document
        .getElementById(
            "loginScreen"
        )
        ?.classList
        .add("hidden");


    document
        .getElementById(
            "dashboard"
        )
        ?.classList
        .add("hidden");


    document
        .getElementById(
            "patientResultScreen"
        )
        ?.classList
        .remove("hidden");


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
                        scan.scan_date
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

    document
        .getElementById(
            "patientResultScreen"
        )
        ?.classList
        .add("hidden");


    const code =
        document.getElementById(
            "patientLinkingCode"
        );


    if (code) {

        code.value = "";

    }


    const message =
        document.getElementById(
            "patientAccessMessage"
        );


    if (message) {

        message.innerHTML = "";

    }


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
        ?.classList
        .add("hidden");

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    stopWirelessScanPolling();

    stopReferenceWirelessPolling();


    try {

        const {
            error
        } =
            await supabaseClient
                .auth
                .signOut();


        if (error) {

            console.error(
                "Logout error:",
                error
            );

        }

    }

    catch (error) {

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

    esp32Connected =
        false;


    const email =
        document.getElementById(
            "loginEmail"
        );


    const password =
        document.getElementById(
            "loginPassword"
        );


    const message =
        document.getElementById(
            "loginMessage"
        );


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
        `<div class="message ${escapeHTML(type)}">
            ${escapeHTML(text)}
         </div>`;

}


// ============================================================
// NUMBER FORMATTER
// ============================================================

function formatNumber(
    value
) {

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


    return date.toLocaleString();

}


// ============================================================
// HTML ESCAPE
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
// HTML ATTRIBUTE ESCAPE
// ============================================================

function escapeHTMLAttribute(
    value
) {

    return escapeHTML(
        value
    );

}


// ============================================================
// SAFE JSON FOR INLINE HTML
// ============================================================

function safeJSONString(
    value
) {

    return JSON.stringify(
        value
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        )
        .replace(
            /</g,
            "\\u003c"
        )
        .replace(
            />/g,
            "\\u003e"
        )
        .replace(
            /&/g,
            "\\u0026"
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


// Real scanner result functions.
window.savePatientMeasurement =
    savePatientMeasurement;

window.saveScannerReferenceMeasurement =
    saveScannerReferenceMeasurement;


// ============================================================
// END OF APP.JS
// ============================================================
