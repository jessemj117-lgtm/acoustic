// ============================================================
// GROUP 4 ACOUSTIC BONE SCANNER
// APP.JS
//
// Admin + Operator Login
// Patient Access using Linking Code
// Admin Reference Database
// Manual Reference Entry
// Scanner Reference Entry
// Patient Selection
// Left / Right Measurement Selection
// ============================================================


// ============================================================
// SUPABASE
// ============================================================

// Put your EXISTING Supabase URL here locally.
const SUPABASE_URL = "https://ropiudyalwarmowaiugu.supabase.co";

// Put your EXISTING Supabase publishable/anon key here locally.
const SUPABASE_KEY = "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";


const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ============================================================
// GLOBAL STATE
// ============================================================

window.currentUser = null;
window.currentProfile = null;
window.currentPatient = null;

let currentReferenceScan = null;


// ============================================================
// DOM HELPER
// ============================================================

function $(id) {
    return document.getElementById(id);
}


function showElement(id) {

    const el = $(id);

    if (el) {
        el.classList.remove("hidden");
    }
}


function hideElement(id) {

    const el = $(id);

    if (el) {
        el.classList.add("hidden");
    }
}


function setMessage(id, message, type = "error") {

    const el = $(id);

    if (!el) {
        console.error(message);
        return;
    }

    el.textContent = message;

    el.className =
        type === "success"
            ? "message success"
            : "message error";
}


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "Acoustic Bone Scanner starting..."
        );

        try {

            const {
                data: { session },
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


            if (
                session &&
                session.user
            ) {

                console.log(
                    "Existing session found."
                );

                window.currentUser =
                    session.user;

                await loadDashboard();

            }

            else {

                console.log(
                    "No active session."
                );

                showLogin();

            }

        }

        catch (err) {

            console.error(
                "Initialization error:",
                err
            );

            showLogin();

        }

    }
);


// ============================================================
// LOGIN SCREEN
// ============================================================

function showLogin() {

    hideElement("dashboard");

    hideElement(
        "patientResultScreen"
    );

    showElement("loginScreen");

    hideElement(
        "adminDashboard"
    );

    hideElement(
        "operatorDashboard"
    );
}


function showDashboard() {

    hideElement("loginScreen");

    hideElement(
        "patientResultScreen"
    );

    showElement("dashboard");
}


function showPatientResults() {

    hideElement("loginScreen");

    hideElement("dashboard");

    showElement(
        "patientResultScreen"
    );
}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const email =
        $("loginEmail")
            .value
            .trim();

    const password =
        $("loginPassword")
            .value;


    if (!email || !password) {

        setMessage(
            "loginMessage",
            "Please enter your email and password."
        );

        return;
    }


    setMessage(
        "loginMessage",
        "Logging in...",
        "success"
    );


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth
                .signInWithPassword({
                    email: email,
                    password: password
                });


        if (error) {

            console.error(
                "Login error:",
                error
            );

            setMessage(
                "loginMessage",
                error.message
            );

            return;
        }


        if (
            !data ||
            !data.user
        ) {

            setMessage(
                "loginMessage",
                "Login failed. No user session was returned."
            );

            return;
        }


        window.currentUser =
            data.user;


        console.log(
            "Login successful:",
            data.user.email
        );


        await loadDashboard();

    }

    catch (err) {

        console.error(
            "Login exception:",
            err
        );

        setMessage(
            "loginMessage",
            "Unexpected login error: " +
            err.message
        );

    }
}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    console.log(
        "Loading dashboard..."
    );


    try {

        if (!window.currentUser) {

            const {
                data: { user }
            } =
                await supabaseClient.auth
                    .getUser();


            if (!user) {

                console.log(
                    "No authenticated user."
                );

                showLogin();

                return;
            }


            window.currentUser =
                user;
        }


        const profile =
            await loadProfile();


        if (!profile) {

            console.error(
                "No profile found for user."
            );

            showDashboard();

            $("userInfo").textContent =
                window.currentUser.email +
                " | Profile not found";


            hideElement(
                "adminDashboard"
            );

            hideElement(
                "operatorDashboard"
            );


            alert(
                "Login successful, but no profile was found for this account.\n\n" +
                "Check the public.profiles table in Supabase."
            );

            return;
        }


        window.currentProfile =
            profile;


        console.log(
            "Profile loaded:",
            profile
        );


        showDashboard();


        hideElement(
            "adminDashboard"
        );

        hideElement(
            "operatorDashboard"
        );


        const displayName =
            profile.full_name ||
            window.currentUser.email;


        $("userInfo").textContent =
            displayName +
            " | " +
            String(
                profile.role
            ).toUpperCase();


        if (
            profile.role === "admin"
        ) {

            console.log(
                "Admin dashboard."
            );

            showElement(
                "adminDashboard"
            );

            await loadAdminDashboard();

        }

        else if (
            profile.role === "operator"
        ) {

            console.log(
                "Operator dashboard."
            );

            showElement(
                "operatorDashboard"
            );

            await loadOperatorDashboard();

        }

        else {

            console.error(
                "Unknown profile role:",
                profile.role
            );


            await supabaseClient.auth
                .signOut();


            window.currentUser = null;
            window.currentProfile = null;

            showLogin();


            setMessage(
                "loginMessage",
                "This account does not have a valid admin/operator role."
            );
        }

    }

    catch (err) {

        console.error(
            "DASHBOARD ERROR:",
            err
        );


        showDashboard();

        hideElement(
            "adminDashboard"
        );

        hideElement(
            "operatorDashboard"
        );


        const dashboardContainer =
            document.querySelector(
                ".dashboard-container"
            );


        if (dashboardContainer) {

            const errorBox =
                document.createElement(
                    "div"
                );


            errorBox.className =
                "card";


            errorBox.innerHTML = `
                <h2>Dashboard Error</h2>
                <p class="error">
                    ${escapeHTML(err.message)}
                </p>
                <p>
                    Open F12 → Console for more details.
                </p>
            `;


            dashboardContainer.prepend(
                errorBox
            );
        }

    }
}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {

    if (!window.currentUser) {
        return null;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq(
                "id",
                window.currentUser.id
            )
            .maybeSingle();


    if (error) {

        console.error(
            "Profile query error:",
            error
        );

        throw new Error(
            "Unable to load profile: " +
            error.message
        );
    }


    if (!data) {

        console.warn(
            "No profile row found."
        );

        return null;
    }


    return data;
}


// ============================================================
// OPERATOR DASHBOARD
// ============================================================

async function loadOperatorDashboard() {

    console.log(
        "Loading operator data..."
    );


    await loadSubjects();

    await loadScans();

    await loadReferenceGroups();

}


// ============================================================
// ADMIN DASHBOARD
// ============================================================

async function loadAdminDashboard() {

    console.log(
        "Loading admin data..."
    );


    await loadAllUsers();

    await loadAllSubjects();

    await loadAllScans();

    await loadAdminReferences();

    await loadAdminReferenceGroups();

}


// ============================================================
// LOAD OPERATOR PATIENTS
// ============================================================

async function loadSubjects() {

    if (!window.currentUser) {
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
                window.currentUser.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Subjects error:",
            error
        );


        $("subjectsList").innerHTML = `
            <p class="error">
                Unable to load patients:
                ${escapeHTML(error.message)}
            </p>
        `;

        return;
    }


    const container =
        $("subjectsList");


    if (
        !data ||
        data.length === 0
    ) {

        container.innerHTML =
            "<p>No patients registered yet.</p>";

        return;
    }


    container.innerHTML =
        data.map(
            patient => {

                const patientJSON =
                    JSON.stringify(
                        patient
                    )
                    .replace(
                        /'/g,
                        "&#39;"
                    );


                const selected =
                    window.currentPatient &&
                    window.currentPatient.id ===
                        patient.id;


                return `
                    <div
                        class="patient-card ${
                            selected
                                ? "selected"
                                : ""
                        }"
                    >

                        <strong>
                            ${escapeHTML(
                                patient.name ||
                                "Unnamed Patient"
                            )}
                        </strong>

                        <p>
                            Patient ID:
                            ${escapeHTML(
                                patient.patient_id ||
                                patient.subject_id ||
                                "-"
                            )}
                        </p>

                        <p>
                            Age:
                            ${patient.age ?? "-"}

                            |

                            Gender:
                            ${escapeHTML(
                                patient.gender ||
                                "-"
                            )}
                        </p>

                        <span class="linking-code">
                            ${escapeHTML(
                                patient.linking_code ||
                                "-"
                            )}
                        </span>

                        <br>

                        <button
                            class="small-button"
                            onclick='selectPatient(${patientJSON})'
                        >
                            Select for Scan
                        </button>

                    </div>
                `;

            }
        ).join("");
}


// ============================================================
// SELECT PATIENT
// ============================================================

function selectPatient(patient) {

    window.currentPatient =
        patient;


    console.log(
        "Selected patient:",
        patient
    );


    const box =
        $("selectedPatientBox");


    if (box) {

        box.innerHTML = `
            <strong>
                Selected Patient
            </strong>

            <p>
                <strong>Name:</strong>
                ${escapeHTML(
                    patient.name || "-"
                )}
            </p>

            <p>
                <strong>Patient ID:</strong>
                ${escapeHTML(
                    patient.patient_id ||
                    patient.subject_id ||
                    "-"
                )}
            </p>

            <p>
                <strong>Age:</strong>
                ${patient.age ?? "-"}
                |
                <strong>Gender:</strong>
                ${escapeHTML(
                    patient.gender || "-"
                )}
            </p>

            <p>
                Select LEFT or RIGHT measurement side.
            </p>
        `;
    }


    $("scannerStatus").textContent =
        "Patient selected. Choose measurement side.";


    document
        .querySelectorAll(
            ".patient-card"
        )
        .forEach(
            card =>
                card.classList.remove(
                    "selected"
                )
        );


    loadSubjects();
}


// ============================================================
// MEASUREMENT SIDE
// ============================================================

function selectMeasurementSide(side) {

    if (!window.currentPatient) {

        alert(
            "Please select a patient first."
        );

        return;
    }


    window.currentPatient.measurement_side =
        side;


    $("leftSideButton")
        .classList.toggle(
            "selected",
            side === "Left"
        );


    $("rightSideButton")
        .classList.toggle(
            "selected",
            side === "Right"
        );


    $("scannerStatus").textContent =
        "Measurement side selected: " +
        side +
        ". Scanner ready.";
}


// ============================================================
// PREPARE SCAN
// ============================================================

function prepareScan() {

    if (!window.currentPatient) {

        alert(
            "Please select a patient first using the " +
            "\"Select for Scan\" button."
        );


        $("subjectsList")
            ?.scrollIntoView({
                behavior: "smooth"
            });


        return;
    }


    const scanCard =
        $("selectedPatientBox");


    if (scanCard) {

        scanCard.scrollIntoView({
            behavior: "smooth"
        });
    }


    $("scannerStatus").textContent =
        "Select LEFT or RIGHT measurement side.";
}


// ============================================================
// BEGIN PATIENT SCAN
// ============================================================

function beginPatientScan() {

    if (!window.currentPatient) {

        alert(
            "Please select a patient first."
        );

        return;
    }


    if (
        !window.currentPatient.measurement_side
    ) {

        alert(
            "Please select LEFT or RIGHT measurement side."
        );

        return;
    }


    const patient =
        window.currentPatient;


    console.log(
        "Starting patient scan:",
        patient
    );


    $("scannerStatus").textContent =
        "Patient scan prepared: " +
        patient.measurement_side +
        " side.";


    alert(
        "Patient scan prepared.\n\n" +
        "Patient: " +
        (patient.name || "-") +
        "\n" +
        "Patient ID: " +
        (patient.patient_id ||
            patient.subject_id ||
            "-") +
        "\n" +
        "Side: " +
        patient.measurement_side +
        "\n\n" +
        "ESP32 scanner connection will be added next."
    );
}


// ============================================================
// LOAD OPERATOR SCANS
// ============================================================

async function loadScans() {

    if (!window.currentUser) {
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
                    patient_id
                )
            `)
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


    if (error) {

        console.error(
            "Scan loading error:",
            error
        );


        $("scansList").innerHTML = `
            <p class="error">
                Unable to load scans:
                ${escapeHTML(error.message)}
            </p>
        `;

        return;
    }


    renderScanTable(
        $("scansList"),
        data || []
    );
}


// ============================================================
// LOAD REFERENCE GROUPS
// ============================================================

async function loadReferenceGroups() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("reference_groups")
            .select("*")
            .order(
                "age_min",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Reference group error:",
            error
        );


        $("referenceList").innerHTML = `
            <p class="error">
                Unable to load reference database:
                ${escapeHTML(error.message)}
            </p>
        `;

        return;
    }


    const container =
        $("referenceList");


    if (
        !data ||
        data.length === 0
    ) {

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
                    <th>SD RMS</th>
                    <th>Mean Q</th>
                    <th>SD Q</th>
                    <th>Mean Bandwidth</th>
                    <th>SD Bandwidth</th>
                </tr>

            </thead>

            <tbody>

                ${data.map(row => `

                    <tr>

                        <td>
                            ${row.age_min}–${row.age_max}
                        </td>

                        <td>
                            ${escapeHTML(
                                row.gender || "-"
                            )}
                        </td>

                        <td>
                            ${row.sample_count ?? "-"}
                        </td>

                        <td>
                            ${formatNumber(
                                row.mean_f0
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.sd_f0
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.mean_rms
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.sd_rms
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.mean_q_factor
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.sd_q_factor
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.mean_bandwidth
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.sd_bandwidth
                            )}
                        </td>

                    </tr>

                `).join("")}

            </tbody>

        </table>
    `;
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
            "Admin users error:",
            error
        );


        $("adminUsers").innerHTML = `
            <p class="error">
                Unable to load users:
                ${escapeHTML(error.message)}
            </p>
        `;

        return;
    }


    $("adminUsers").innerHTML = `

        <table>

            <thead>

                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                </tr>

            </thead>

            <tbody>

                ${(data || []).map(user => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                user.full_name || "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                user.email || "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                user.role || "-"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                user.created_at
                            )}
                        </td>

                    </tr>

                `).join("")}

            </tbody>

        </table>
    `;
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
            "Admin patients error:",
            error
        );


        $("adminSubjects").innerHTML = `
            <p class="error">
                Unable to load patients:
                ${escapeHTML(error.message)}
            </p>
        `;

        return;
    }


    $("adminSubjects").innerHTML = `

        <table>

            <thead>

                <tr>
                    <th>Patient ID</th>
                    <th>Name</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Linking Code</th>
                    <th>Created</th>
                </tr>

            </thead>

            <tbody>

                ${(data || []).map(patient => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                patient.patient_id ||
                                patient.subject_id ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                patient.name || "-"
                            )}
                        </td>

                        <td>
                            ${patient.age ?? "-"}
                        </td>

                        <td>
                            ${escapeHTML(
                                patient.gender || "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                patient.linking_code || "-"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                patient.created_at
                            )}
                        </td>

                    </tr>

                `).join("")}

            </tbody>

        </table>
    `;
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
                    patient_id
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


        $("adminScans").innerHTML = `
            <p class="error">
                Unable to load scans:
                ${escapeHTML(error.message)}
            </p>
        `;

        return;
    }


    renderScanTable(
        $("adminScans"),
        data || []
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
            "Reference measurement error:",
            error
        );


        $("adminReferences").innerHTML = `
            <p class="error">
                Unable to load reference measurements:
                ${escapeHTML(error.message)}
            </p>
        `;

        return;
    }


    const container =
        $("adminReferences");


    if (
        !data ||
        data.length === 0
    ) {

        container.innerHTML =
            "<p>No reference measurements available.</p>";

        return;
    }


    container.innerHTML = `

        <table>

            <thead>

                <tr>
                    <th>Reference ID</th>
                    <th>Sample ID</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Side</th>
                    <th>F₀</th>
                    <th>RMS</th>
                    <th>Q</th>
                    <th>Bandwidth</th>
                    <th>Date</th>
                </tr>

            </thead>

            <tbody>

                ${data.map(row => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                row.reference_id || "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                row.sample_id || "-"
                            )}
                        </td>

                        <td>
                            ${row.age ?? "-"}
                        </td>

                        <td>
                            ${escapeHTML(
                                row.gender || "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                row.measurement_side || "-"
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.f0
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.rms
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.q_factor
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.bandwidth
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                row.created_at
                            )}
                        </td>

                    </tr>

                `).join("")}

            </tbody>

        </table>
    `;
}


// ============================================================
// ADMIN REFERENCE GROUPS
// ============================================================

async function loadAdminReferenceGroups() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("reference_groups")
            .select("*")
            .order(
                "age_min",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Admin reference group error:",
            error
        );


        $("adminReferenceGroups").innerHTML = `
            <p class="error">
                Unable to load reference groups:
                ${escapeHTML(error.message)}
            </p>
        `;

        return;
    }


    const container =
        $("adminReferenceGroups");


    if (
        !data ||
        data.length === 0
    ) {

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
                    <th>SD RMS</th>
                    <th>Mean Q</th>
                    <th>SD Q</th>
                    <th>Mean Bandwidth</th>
                    <th>SD Bandwidth</th>
                </tr>

            </thead>

            <tbody>

                ${data.map(row => `

                    <tr>

                        <td>
                            ${row.age_min}–${row.age_max}
                        </td>

                        <td>
                            ${escapeHTML(
                                row.gender || "-"
                            )}
                        </td>

                        <td>
                            ${row.sample_count ?? "-"}
                        </td>

                        <td>
                            ${formatNumber(
                                row.mean_f0
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.sd_f0
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.mean_rms
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.sd_rms
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.mean_q_factor
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.sd_q_factor
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.mean_bandwidth
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.sd_bandwidth
                            )}
                        </td>

                    </tr>

                `).join("")}

            </tbody>

        </table>
    `;
}


// ============================================================
// MANUAL REFERENCE FORM
// ============================================================

function showManualReferenceForm() {

    hideElement(
        "scannerReferenceForm"
    );

    showElement(
        "manualReferenceForm"
    );


    $("manualReferenceMessage").textContent = "";
}


function showScannerReferenceForm() {

    hideElement(
        "manualReferenceForm"
    );

    showElement(
        "scannerReferenceForm"
    );


    $("scannerReferenceMessage").textContent = "";
}


function hideReferenceForms() {

    hideElement(
        "manualReferenceForm"
    );

    hideElement(
        "scannerReferenceForm"
    );


    currentReferenceScan = null;


    const results =
        $("referenceScanResults");


    if (results) {
        results.classList.add(
            "hidden"
        );
    }
}


// ============================================================
// SAVE MANUAL REFERENCE
// ============================================================

async function saveManualReference() {

    if (
        !window.currentProfile ||
        window.currentProfile.role !== "admin"
    ) {

        setMessage(
            "manualReferenceMessage",
            "Only an administrator can add reference data."
        );

        return;
    }


    const sampleId =
        $("manualReferenceId")
            .value
            .trim();


    const age =
        Number(
            $("manualReferenceAge")
                .value
        );


    const gender =
        $("manualReferenceGender")
            .value;


    const side =
        $("manualReferenceSide")
            .value;


    const f0 =
        Number(
            $("manualReferenceF0")
                .value
        );


    const rms =
        Number(
            $("manualReferenceRMS")
                .value
        );


    const qFactor =
        Number(
            $("manualReferenceQ")
                .value
        );


    const bandwidth =
        Number(
            $("manualReferenceBandwidth")
                .value
        );


    const notes =
        $("manualReferenceNotes")
            .value
            .trim();


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
            "manualReferenceMessage",
            "Please enter all required reference values."
        );

        return;
    }


    setMessage(
        "manualReferenceMessage",
        "Saving reference...",
        "success"
    );


    try {

        const {
            error
        } =
            await supabaseClient
                .from(
                    "reference_measurements"
                )
                .insert({

                    reference_id:
                        sampleId,

                    sample_id:
                        sampleId,

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
                        notes

                });


        if (error) {

            console.error(
                "Manual reference error:",
                error
            );


            setMessage(
                "manualReferenceMessage",
                error.message
            );

            return;
        }


        setMessage(
            "manualReferenceMessage",
            "Reference measurement saved successfully.",
            "success"
        );


        clearManualReferenceForm();


        await loadAdminReferences();

    }

    catch (err) {

        console.error(
            "Manual reference exception:",
            err
        );


        setMessage(
            "manualReferenceMessage",
            err.message
        );
    }
}


// ============================================================
// CLEAR MANUAL REFERENCE
// ============================================================

function clearManualReferenceForm() {

    $("manualReferenceId").value = "";
    $("manualReferenceAge").value = "";
    $("manualReferenceGender").value = "";
    $("manualReferenceSide").value = "";
    $("manualReferenceF0").value = "";
    $("manualReferenceRMS").value = "";
    $("manualReferenceQ").value = "";
    $("manualReferenceBandwidth").value = "";
    $("manualReferenceNotes").value = "";
}


// ============================================================
// START REFERENCE SCAN
// ============================================================
//
// TEMPORARY TEST MODE
//
// Later this function will be replaced by the real ESP32
// communication code.
//
// The temporary values are ONLY for testing the website/database.
// They are NOT clinical reference values.
// ============================================================

async function startReferenceScan() {

    if (
        !window.currentProfile ||
        window.currentProfile.role !== "admin"
    ) {

        setMessage(
            "scannerReferenceMessage",
            "Only an administrator can perform a reference scan."
        );

        return;
    }


    const sampleId =
        $("scannerReferenceId")
            .value
            .trim();


    const age =
        Number(
            $("scannerReferenceAge")
                .value
        );


    const gender =
        $("scannerReferenceGender")
            .value;


    const side =
        $("scannerReferenceSide")
            .value;


    if (
        !sampleId ||
        !Number.isInteger(age) ||
        age < 1 ||
        !gender ||
        !side
    ) {

        setMessage(
            "scannerReferenceMessage",
            "Enter sample ID, age, gender and measurement side first."
        );

        return;
    }


    $("referenceScannerStatus")
        .textContent =
        "Performing reference scan...";


    $("scannerReferenceMessage")
        .textContent = "";


    hideElement(
        "referenceScanResults"
    );


    /*
        TEMPORARY TEST VALUES

        These values simulate what the ESP32 will eventually send.

        They are NOT medical/reference values.
    */

    setTimeout(
        () => {

            currentReferenceScan = {

                sample_id:
                    sampleId,

                age:
                    age,

                gender:
                    gender,

                measurement_side:
                    side,

                f0:
                    650.000,

                rms:
                    0.820,

                q_factor:
                    8.400,

                bandwidth:
                    77.400

            };


            $("referenceScanF0")
                .textContent =
                formatNumber(
                    currentReferenceScan.f0
                );


            $("referenceScanRMS")
                .textContent =
                formatNumber(
                    currentReferenceScan.rms
                );


            $("referenceScanQ")
                .textContent =
                formatNumber(
                    currentReferenceScan.q_factor
                );


            $("referenceScanBandwidth")
                .textContent =
                formatNumber(
                    currentReferenceScan.bandwidth
                );


            showElement(
                "referenceScanResults"
            );


            $("referenceScannerStatus")
                .textContent =
                "Reference scan completed. Review the values before saving.";


        },
        1500
    );
}


// ============================================================
// SAVE SCANNER REFERENCE
// ============================================================

async function saveScannerReference() {

    if (
        !currentReferenceScan
    ) {

        setMessage(
            "scannerReferenceMessage",
            "No reference scan is available."
        );

        return;
    }


    setMessage(
        "scannerReferenceMessage",
        "Saving reference...",
        "success"
    );


    try {

        const {
            error
        } =
            await supabaseClient
                .from(
                    "reference_measurements"
                )
                .insert({

                    reference_id:
                        currentReferenceScan.sample_id,

                    sample_id:
                        currentReferenceScan.sample_id,

                    age:
                        currentReferenceScan.age,

                    gender:
                        currentReferenceScan.gender,

                    measurement_side:
                        currentReferenceScan.measurement_side,

                    f0:
                        currentReferenceScan.f0,

                    rms:
                        currentReferenceScan.rms,

                    q_factor:
                        currentReferenceScan.q_factor,

                    bandwidth:
                        currentReferenceScan.bandwidth,

                    notes:
                        "Added using acoustic scanner"

                });


        if (error) {

            console.error(
                "Scanner reference error:",
                error
            );


            setMessage(
                "scannerReferenceMessage",
                error.message
            );

            return;
        }


        setMessage(
            "scannerReferenceMessage",
            "Scanner reference saved successfully.",
            "success"
        );


        currentReferenceScan =
            null;


        hideElement(
            "referenceScanResults"
        );


        $("referenceScannerStatus")
            .textContent =
            "Reference saved. Scanner ready for next reference.";


        await loadAdminReferences();

    }

    catch (err) {

        console.error(
            "Save scanner reference exception:",
            err
        );


        setMessage(
            "scannerReferenceMessage",
            err.message
        );
    }
}


// ============================================================
// CREATE PATIENT
// ============================================================

function openPatientModal() {

    $("patientModal")
        .classList
        .remove("hidden");


    $("subjectMessage")
        .textContent = "";


    $("createdPatientInfo")
        .classList
        .add("hidden");
}


function closePatientModal() {

    $("patientModal")
        .classList
        .add("hidden");
}


function generatePatientID() {

    const random =
        Math.floor(
            10000 +
            Math.random() *
            90000
        );


    return "PAT-" + random;
}


function generateLinkingCode() {

    return String(
        Math.floor(
            100000 +
            Math.random() *
            900000
        )
    );
}


async function generateUniqueLinkingCode() {

    for (
        let attempt = 0;
        attempt < 20;
        attempt++
    ) {

        const code =
            generateLinkingCode();


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
                .maybeSingle();


        if (error) {

            throw new Error(
                "Unable to check linking code: " +
                error.message
            );
        }


        if (!data) {

            return code;
        }
    }


    throw new Error(
        "Unable to generate a unique linking code."
    );
}


async function addSubject() {

    if (!window.currentUser) {

        setMessage(
            "subjectMessage",
            "You must be logged in."
        );

        return;
    }


    const name =
        $("subjectName")
            .value
            .trim();


    const age =
        Number(
            $("subjectAge")
                .value
        );


    const gender =
        $("subjectGender")
            .value;


    if (
        !name ||
        !Number.isInteger(age) ||
        age < 1 ||
        !gender
    ) {

        setMessage(
            "subjectMessage",
            "Please enter patient name, age and gender."
        );

        return;
    }


    setMessage(
        "subjectMessage",
        "Creating patient...",
        "success"
    );


    try {

        const patientID =
            generatePatientID();


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


        if (error) {

            console.error(
                "Create patient error:",
                error
            );


            setMessage(
                "subjectMessage",
                error.message
            );

            return;
        }


        $("createdPatientInfo")
            .innerHTML = `

                <strong>
                    Patient Created Successfully
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
                    Patient Linking Code:
                    <span class="linking-code">
                        ${escapeHTML(
                            data.linking_code
                        )}
                    </span>
                </p>

                <p>
                    Give this linking code to the patient.
                    It is used to access their scan results.
                </p>

            `;


        $("createdPatientInfo")
            .classList
            .remove("hidden");


        $("subjectMessage")
            .textContent = "";


        $("subjectName").value = "";
        $("subjectAge").value = "";
        $("subjectGender").value = "";


        await loadSubjects();

        if (
            window.currentProfile &&
            window.currentProfile.role === "admin"
        ) {

            await loadAllSubjects();
        }

    }

    catch (err) {

        console.error(
            "Create patient exception:",
            err
        );


        setMessage(
            "subjectMessage",
            err.message
        );
    }
}


// ============================================================
// PATIENT ACCESS
// ============================================================

async function patientAccess() {

    const code =
        $("patientLinkingCode")
            .value
            .trim();


    if (
        !/^\d{6}$/.test(code)
    ) {

        setMessage(
            "patientAccessMessage",
            "Please enter a valid 6-digit linking code."
        );

        return;
    }


    setMessage(
        "patientAccessMessage",
        "Searching for your results...",
        "success"
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
                "Patient RPC error:",
                error
            );


            setMessage(
                "patientAccessMessage",
                "Unable to retrieve results: " +
                error.message
            );

            return;
        }


        if (
            !data ||
            data.length === 0
        ) {

            setMessage(
                "patientAccessMessage",
                "No patient was found for this linking code."
            );

            return;
        }


        displayPatientResults(
            data
        );

    }

    catch (err) {

        console.error(
            "Patient access exception:",
            err
        );


        setMessage(
            "patientAccessMessage",
            err.message
        );
    }
}


// ============================================================
// DISPLAY PATIENT RESULTS
// ============================================================

function displayPatientResults(data) {

    const first =
        data[0];


    showPatientResults();


    $("patientDetails")
        .innerHTML = `

            <div class="card">

                <h2>
                    Patient Details
                </h2>

                <p>
                    <strong>Patient ID:</strong>
                    ${escapeHTML(
                        first.patient_id ||
                        "-"
                    )}
                </p>

                <p>
                    <strong>Name:</strong>
                    ${escapeHTML(
                        first.patient_name ||
                        "-"
                    )}
                </p>

                <p>
                    <strong>Age:</strong>
                    ${first.patient_age ?? "-"}
                </p>

                <p>
                    <strong>Gender:</strong>
                    ${escapeHTML(
                        first.patient_gender ||
                        "-"
                    )}
                </p>

            </div>
        `;


    const scans =
        data.filter(
            row =>
                row.scan_id
        );


    if (
        scans.length === 0
    ) {

        $("patientScanResults")
            .innerHTML = `

                <div class="card">

                    <h3>
                        No Scan Results Yet
                    </h3>

                    <p>
                        Your patient record exists,
                        but no acoustic scan has been
                        recorded yet.
                    </p>

                </div>
            `;

        return;
    }


    $("patientScanResults")
        .innerHTML = `

            <div class="card">

                <h2>
                    Scan History
                </h2>

                ${scans.map(
                    scan => `

                        <div class="patient-result">

                            <h3>
                                Scan
                                ${escapeHTML(
                                    scan.scan_id
                                )}
                            </h3>

                            <p>
                                Date:
                                ${formatDate(
                                    scan.scan_date
                                )}
                            </p>

                            <div class="result-grid">

                                <div class="result-item">

                                    <strong>
                                        F₀
                                    </strong>

                                    ${formatNumber(
                                        scan.f0
                                    )}

                                </div>


                                <div class="result-item">

                                    <strong>
                                        RMS
                                    </strong>

                                    ${formatNumber(
                                        scan.rms
                                    )}

                                </div>


                                <div class="result-item">

                                    <strong>
                                        Q Factor
                                    </strong>

                                    ${formatNumber(
                                        scan.q_factor
                                    )}

                                </div>


                                <div class="result-item">

                                    <strong>
                                        Bandwidth
                                    </strong>

                                    ${formatNumber(
                                        scan.bandwidth
                                    )}

                                </div>


                                <div class="result-item">

                                    <strong>
                                        Measurement Side
                                    </strong>

                                    ${escapeHTML(
                                        scan.measurement_side ||
                                        "-"
                                    )}

                                </div>


                                <div class="result-item">

                                    <strong>
                                        Comparison
                                    </strong>

                                    ${escapeHTML(
                                        scan.comparison_status ||
                                        "Not available"
                                    )}

                                </div>

                            </div>

                        </div>

                    `
                ).join("")}

            </div>
        `;
}


// ============================================================
// BACK TO PATIENT ACCESS
// ============================================================

function backToPatientAccess() {

    hideElement(
        "patientResultScreen"
    );


    showLogin();


    $("patientLinkingCode")
        .value = "";


    $("patientAccessMessage")
        .textContent = "";
}


// ============================================================
// REFERENCE SCROLL
// ============================================================

function scrollToReference() {

    const section =
        $("operatorReferenceSection");


    if (section) {

        section.scrollIntoView({
            behavior: "smooth"
        });
    }
}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    try {

        await supabaseClient.auth
            .signOut();

    }

    catch (err) {

        console.error(
            "Logout error:",
            err
        );
    }


    const emailField =
        $("loginEmail");


    const passwordField =
        $("loginPassword");


    if (emailField) {
        emailField.value = "";
    }


    if (passwordField) {
        passwordField.value = "";
    }


    const loginMessage =
        $("loginMessage");


    if (loginMessage) {
        loginMessage.textContent = "";
    }


    window.currentUser = null;
    window.currentProfile = null;
    window.currentPatient = null;

    currentReferenceScan = null;


    showLogin();
}


// ============================================================
// SCAN TABLE
// ============================================================

function renderScanTable(
    container,
    scans
) {

    if (!container) {
        return;
    }


    if (
        !scans ||
        scans.length === 0
    ) {

        container.innerHTML =
            "<p>No scan measurements available.</p>";

        return;
    }


    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>Scan ID</th>
                    <th>Patient</th>
                    <th>Date</th>
                    <th>Side</th>
                    <th>F₀</th>
                    <th>RMS</th>
                    <th>Q</th>
                    <th>Bandwidth</th>
                    <th>Status</th>

                </tr>

            </thead>

            <tbody>

                ${scans.map(
                    scan => `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    scan.scan_id ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    scan.subjects?.name ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${formatDate(
                                    scan.created_at
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    scan.measurement_side ||
                                    "-"
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
                                    "-"
                                )}
                            </td>

                        </tr>

                    `
                ).join("")}

            </tbody>

        </table>
    `;
}


// ============================================================
// UTILITIES
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


    if (
        !Number.isFinite(number)
    ) {

        return "-";
    }


    return number.toFixed(3);
}


function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";
    }


    return date.toLocaleString();
}


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
// MAKE FUNCTIONS AVAILABLE TO HTML
// ============================================================

window.login = login;
window.logout = logout;

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

window.beginPatientScan =
    beginPatientScan;

window.selectPatient =
    selectPatient;

window.selectMeasurementSide =
    selectMeasurementSide;

window.scrollToReference =
    scrollToReference;

window.showManualReferenceForm =
    showManualReferenceForm;

window.showScannerReferenceForm =
    showScannerReferenceForm;

window.hideReferenceForms =
    hideReferenceForms;

window.saveManualReference =
    saveManualReference;

window.startReferenceScan =
    startReferenceScan;

window.saveScannerReference =
    saveScannerReference;
