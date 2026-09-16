// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

const SUPABASE_URL = "https://ropiudyalwarmowaiugu.supabase.co";
const SUPABASE_KEY = "sb_publishable_m4JSo5oRhn6GUOrWzBJBtA_o-W3Fr8K";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ============================================================
// ELEMENTS
// ============================================================

const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("dashboard");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const logoutButton = document.getElementById("logoutButton");

const userInfo = document.getElementById("userInfo");

const subjectCount = document.getElementById("subjectCount");
const scanCount = document.getElementById("scanCount");
const referenceCount = document.getElementById("referenceCount");

const subjectList = document.getElementById("subjectList");
const scanList = document.getElementById("scanList");
const referenceList = document.getElementById("referenceList");

const adminPanel = document.getElementById("adminPanel");

const subjectModal = document.getElementById("subjectModal");
const addSubjectButton = document.getElementById("addSubjectButton");
const closeModal = document.getElementById("closeModal");

const subjectForm = document.getElementById("subjectForm");
const subjectMessage = document.getElementById("subjectMessage");


// ============================================================
// LOGIN
// ============================================================

loginForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    loginMessage.textContent = "Logging in...";

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const {
        data,
        error
    } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {

        loginMessage.textContent =
            "Login failed: " + error.message;

        return;
    }

    loginMessage.textContent = "";

    await loadDashboard();
});


// ============================================================
// LOGOUT
// ============================================================

logoutButton.addEventListener("click", async function() {

    await supabaseClient.auth.signOut();

    dashboard.style.display = "none";
    loginScreen.style.display = "flex";

    userInfo.textContent = "";

});


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        return;
    }

    loginScreen.style.display = "none";
    dashboard.style.display = "block";

    userInfo.textContent =
        "Logged in as: " + user.email;


    // --------------------------------------------------------
    // LOAD PROFILE
    // --------------------------------------------------------

    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();


    if (!profileError && profile) {

        userInfo.textContent =
            "Logged in as: " +
            profile.email +
            " (" +
            profile.role +
            ")";


        if (profile.role === "admin") {

            adminPanel.style.display = "block";

        } else {

            adminPanel.style.display = "none";

        }

    } else {

        console.error(
            "Profile loading error:",
            profileError
        );

    }


    // --------------------------------------------------------
    // LOAD DASHBOARD DATA
    // --------------------------------------------------------

    await loadSubjects();

    await loadScans();

    await loadReferences();
}


// ============================================================
// LOAD SUBJECTS
// ============================================================

async function loadSubjects() {

    subjectList.innerHTML =
        "<p>Loading subjects...</p>";


    // --------------------------------------------------------
    // CHECK LOGIN
    // --------------------------------------------------------

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();


    if (!user) {

        subjectList.innerHTML =
            "<p>You are not logged in.</p>";

        return;
    }


    // --------------------------------------------------------
    // GET SUBJECTS
    // --------------------------------------------------------

    const {
        data,
        error
    } = await supabaseClient
        .from("subjects")
        .select(
            "id, user_id, subject_id, name, age, gender, created_at"
        )
        .order("created_at", {
            ascending: false
        });


    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    if (error) {

        subjectList.innerHTML = `
            <div class="error-box">

                <strong>Error loading subjects</strong>

                <br><br>

                ${escapeHtml(error.message)}

                <br>

                Code:
                ${escapeHtml(error.code ?? "N/A")}

                <br>

                Details:
                ${escapeHtml(error.details ?? "N/A")}

            </div>
        `;

        console.error(
            "Subjects error:",
            error
        );

        return;
    }


    // --------------------------------------------------------
    // UPDATE COUNT
    // --------------------------------------------------------

    subjectCount.textContent =
        data.length;


    // --------------------------------------------------------
    // NO SUBJECTS
    // --------------------------------------------------------

    if (data.length === 0) {

        subjectList.innerHTML =
            "<p>No subjects added yet.</p>";

        return;
    }


    // --------------------------------------------------------
    // CREATE TABLE
    // --------------------------------------------------------

    let html = `
        <table>

            <tr>
                <th>Subject ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
            </tr>
    `;


    data.forEach(subject => {

        html += `
            <tr>

                <td>
                    ${escapeHtml(subject.subject_id)}
                </td>

                <td>
                    ${escapeHtml(subject.name)}
                </td>

                <td>
                    ${subject.age ?? "-"}
                </td>

                <td>
                    ${escapeHtml(subject.gender)}
                </td>

            </tr>
        `;

    });


    html += `
        </table>
    `;


    subjectList.innerHTML =
        html;
}


// ============================================================
// LOAD SCANS
// ============================================================

async function loadScans() {

    scanList.innerHTML =
        "<p>Loading scans...</p>";


    const {
        data,
        error
    } = await supabaseClient
        .from("scan_measurements")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    if (error) {

        scanList.innerHTML = `
            <div class="error-box">

                <strong>Error loading scans</strong>

                <br><br>

                ${escapeHtml(error.message)}

                <br>

                Code:
                ${escapeHtml(error.code ?? "N/A")}

                <br>

                Details:
                ${escapeHtml(error.details ?? "N/A")}

            </div>
        `;

        console.error(
            "Scans error:",
            error
        );

        return;
    }


    // --------------------------------------------------------
    // UPDATE COUNT
    // --------------------------------------------------------

    scanCount.textContent =
        data.length;


    // --------------------------------------------------------
    // NO SCANS
    // --------------------------------------------------------

    if (data.length === 0) {

        scanList.innerHTML =
            "<p>No scans recorded yet.</p>";

        return;
    }


    // --------------------------------------------------------
    // CREATE TABLE
    // --------------------------------------------------------

    let html = `
        <table>

            <tr>
                <th>Scan ID</th>
                <th>F₀</th>
                <th>RMS</th>
                <th>Q</th>
                <th>Bandwidth</th>
                <th>Status</th>
                <th>Date</th>
            </tr>
    `;


    data.forEach(scan => {

        html += `
            <tr>

                <td>
                    ${escapeHtml(scan.scan_id)}
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
                    ${escapeHtml(
                        scan.comparison_status ?? "-"
                    )}
                </td>

                <td>
                    ${formatDate(scan.created_at)}
                </td>

            </tr>
        `;

    });


    html += `
        </table>
    `;


    scanList.innerHTML =
        html;
}


// ============================================================
// LOAD REFERENCE GROUPS
// ============================================================

async function loadReferences() {

    referenceList.innerHTML =
        "<p>Loading reference data...</p>";


    const {
        data,
        error
    } = await supabaseClient
        .from("reference_groups")
        .select("*")
        .order("age_min", {
            ascending: true
        });


    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    if (error) {

        referenceList.innerHTML = `
            <div class="error-box">

                <strong>Error loading reference data</strong>

                <br><br>

                ${escapeHtml(error.message)}

                <br>

                Code:
                ${escapeHtml(error.code ?? "N/A")}

                <br>

                Details:
                ${escapeHtml(error.details ?? "N/A")}

            </div>
        `;

        console.error(
            "Reference error:",
            error
        );

        return;
    }


    // --------------------------------------------------------
    // UPDATE COUNT
    // --------------------------------------------------------

    referenceCount.textContent =
        data.length;


    // --------------------------------------------------------
    // NO REFERENCE GROUPS
    // --------------------------------------------------------

    if (data.length === 0) {

        referenceList.innerHTML =
            "<p>No reference groups created yet.</p>";

        return;
    }


    // --------------------------------------------------------
    // CREATE TABLE
    // --------------------------------------------------------

    let html = `
        <table>

            <tr>
                <th>Age Group</th>
                <th>Gender</th>
                <th>Samples</th>
                <th>Mean F₀</th>
                <th>Mean RMS</th>
                <th>Mean Q</th>
            </tr>
    `;


    data.forEach(ref => {

        html += `
            <tr>

                <td>
                    ${ref.age_min}–${ref.age_max}
                </td>

                <td>
                    ${escapeHtml(ref.gender)}
                </td>

                <td>
                    ${ref.sample_count ?? 0}
                </td>

                <td>
                    ${ref.mean_f0 ?? "-"}
                </td>

                <td>
                    ${ref.mean_rms ?? "-"}
                </td>

                <td>
                    ${ref.mean_q_factor ?? "-"}
                </td>

            </tr>
        `;

    });


    html += `
        </table>
    `;


    referenceList.innerHTML =
        html;
}


// ============================================================
// ADD SUBJECT — OPEN MODAL
// ============================================================

addSubjectButton.addEventListener(
    "click",
    function() {

        subjectModal.style.display =
            "flex";

    }
);


// ============================================================
// CLOSE SUBJECT MODAL
// ============================================================

closeModal.addEventListener(
    "click",
    function() {

        subjectModal.style.display =
            "none";

        subjectMessage.textContent = "";

    }
);


// ============================================================
// ADD SUBJECT
// ============================================================

subjectForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        subjectMessage.textContent =
            "Saving...";


        // ----------------------------------------------------
        // GET USER
        // ----------------------------------------------------

        const {
            data: {
                user
            }
        } = await supabaseClient.auth.getUser();


        if (!user) {

            subjectMessage.textContent =
                "You are not logged in.";

            return;
        }


        // ----------------------------------------------------
        // COLLECT FORM DATA
        // ----------------------------------------------------

        const subject = {

            user_id:
                user.id,

            subject_id:
                document
                    .getElementById("subjectId")
                    .value
                    .trim(),

            name:
                document
                    .getElementById("subjectName")
                    .value
                    .trim(),

            age:
                Number(
                    document
                        .getElementById("subjectAge")
                        .value
                ),

            gender:
                document
                    .getElementById("subjectGender")
                    .value

        };


        // ----------------------------------------------------
        // INSERT SUBJECT
        // ----------------------------------------------------

        const {
            data,
            error
        } = await supabaseClient
            .from("subjects")
            .insert(subject)
            .select()
            .single();


        // ----------------------------------------------------
        // ERROR
        // ----------------------------------------------------

        if (error) {

            subjectMessage.innerHTML = `
                <span class="error-box">

                    Error:
                    ${escapeHtml(error.message)}

                    <br>

                    Code:
                    ${escapeHtml(
                        error.code ?? "N/A"
                    )}

                </span>
            `;

            console.error(
                "Add subject error:",
                error
            );

            return;
        }


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        subjectMessage.textContent =
            "Subject saved successfully.";


        subjectForm.reset();


        // ----------------------------------------------------
        // REFRESH SUBJECT LIST
        // ----------------------------------------------------

        await loadSubjects();


        // ----------------------------------------------------
        // CLOSE MODAL
        // ----------------------------------------------------

        setTimeout(() => {

            subjectModal.style.display =
                "none";

            subjectMessage.textContent = "";

        }, 1000);

    }
);


// ============================================================
// SESSION CHECK
// ============================================================

async function checkSession() {

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();


    if (session) {

        await loadDashboard();

    }

}


// Run session check

checkSession();


// ============================================================
// AUTH STATE CHANGE
// ============================================================

supabaseClient.auth.onAuthStateChange(
    async function(event, session) {

        if (event === "SIGNED_OUT") {

            dashboard.style.display =
                "none";

            loginScreen.style.display =
                "flex";

            return;
        }

        if (
            event === "SIGNED_IN" &&
            session
        ) {

            await loadDashboard();

        }

    }
);


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(value) {

    if (!value) {

        return "-";

    }


    return new Date(value)
        .toLocaleString();

}
