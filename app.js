const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_KEY = "PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY";

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

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
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
    }


    await loadSubjects();
    await loadScans();
    await loadReferences();
}


// ============================================================
// LOAD SUBJECTS
// ============================================================

async function loadSubjects() {

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

        subjectList.innerHTML =
            "<p>Error loading subjects.</p>";

        console.error(error);

        return;
    }


    subjectCount.textContent =
        data.length;


    if (data.length === 0) {

        subjectList.innerHTML =
            "<p>No subjects added yet.</p>";

        return;
    }


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
                <td>${escapeHtml(subject.subject_id)}</td>
                <td>${escapeHtml(subject.name)}</td>
                <td>${subject.age}</td>
                <td>${escapeHtml(subject.gender)}</td>
            </tr>
        `;

    });


    html += "</table>";

    subjectList.innerHTML = html;
}


// ============================================================
// LOAD SCANS
// ============================================================

async function loadScans() {

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

        scanList.innerHTML =
            "<p>Error loading scans.</p>";

        console.error(error);

        return;
    }


    scanCount.textContent =
        data.length;


    if (data.length === 0) {

        scanList.innerHTML =
            "<p>No scans recorded yet.</p>";

        return;
    }


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
                <td>${escapeHtml(scan.scan_id)}</td>
                <td>${scan.f0 ?? "-"}</td>
                <td>${scan.rms ?? "-"}</td>
                <td>${scan.q_factor ?? "-"}</td>
                <td>${scan.bandwidth ?? "-"}</td>
                <td>${escapeHtml(scan.comparison_status ?? "-")}</td>
                <td>${formatDate(scan.created_at)}</td>
            </tr>
        `;

    });


    html += "</table>";

    scanList.innerHTML = html;
}


// ============================================================
// LOAD REFERENCE GROUPS
// ============================================================

async function loadReferences() {

    const {
        data,
        error
    } = await supabaseClient
        .from("reference_groups")
        .select("*")
        .order("age_min", {
            ascending: true
        });


    if (error) {

        referenceList.innerHTML =
            "<p>Error loading reference data.</p>";

        console.error(error);

        return;
    }


    referenceCount.textContent =
        data.length;


    if (data.length === 0) {

        referenceList.innerHTML =
            "<p>No reference groups created yet.</p>";

        return;
    }


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
                <td>${ref.age_min}–${ref.age_max}</td>
                <td>${escapeHtml(ref.gender)}</td>
                <td>${ref.sample_count ?? 0}</td>
                <td>${ref.mean_f0 ?? "-"}</td>
                <td>${ref.mean_rms ?? "-"}</td>
                <td>${ref.mean_q_factor ?? "-"}</td>
            </tr>
        `;

    });


    html += "</table>";

    referenceList.innerHTML = html;
}


// ============================================================
// ADD SUBJECT
// ============================================================

addSubjectButton.addEventListener("click", function() {

    subjectModal.style.display = "flex";

});


closeModal.addEventListener("click", function() {

    subjectModal.style.display = "none";

    subjectMessage.textContent = "";

});


subjectForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    subjectMessage.textContent =
        "Saving...";


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


    const subject = {

        user_id: user.id,

        subject_id:
            document.getElementById("subjectId")
                .value.trim(),

        name:
            document.getElementById("subjectName")
                .value.trim(),

        age:
            Number(
                document.getElementById("subjectAge")
                    .value
            ),

        gender:
            document.getElementById("subjectGender")
                .value

    };


    const {
        error
    } = await supabaseClient
        .from("subjects")
        .insert(subject);


    if (error) {

        subjectMessage.textContent =
            "Error: " + error.message;

        console.error(error);

        return;
    }


    subjectMessage.textContent =
        "Subject saved successfully.";


    subjectForm.reset();

    await loadSubjects();


    setTimeout(() => {

        subjectModal.style.display =
            "none";

        subjectMessage.textContent = "";

    }, 1000);

});


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


checkSession();


// ============================================================
// HELPERS
// ============================================================

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    return new Date(value)
        .toLocaleString();
}
