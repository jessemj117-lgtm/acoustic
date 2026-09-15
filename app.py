from flask import Flask, render_template, jsonify, request
from supabase import create_client
import os
import math
from datetime import datetime, timezone

app = Flask(__name__)


# ============================================================
# SUPABASE CONNECTION
# ============================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


# ============================================================
# DASHBOARD
# ============================================================

@app.route("/")
def dashboard():

    # --------------------------------------------------------
    # Get reference measurements
    # --------------------------------------------------------

    reference_result = (
        supabase
        .table("reference_measurements")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    references = reference_result.data or []


    # --------------------------------------------------------
    # Get uploaded scan measurements
    # --------------------------------------------------------

    scan_result = (
        supabase
        .table("scan_measurements")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    scans = scan_result.data or []


    # --------------------------------------------------------
    # Latest scan
    # --------------------------------------------------------

    latest_scan = scans[0] if scans else None


    # --------------------------------------------------------
    # Demo resonance graph
    #
    # This is only the current demonstration graph.
    # Actual ESP32 scan points are not currently uploaded.
    # --------------------------------------------------------

    f0 = 642

    points = [
        {
            "frequency": f,
            "rms": round(
                0.35 +
                1.49 *
                math.exp(
                    -((f - f0) / 55) ** 2
                ),
                3
            )
        }
        for f in range(200, 1201, 10)
    ]


    # --------------------------------------------------------
    # Dashboard values
    # --------------------------------------------------------

    if latest_scan:

        dashboard_f0 = latest_scan.get("f0") or 0
        dashboard_rms = latest_scan.get("rms") or 0
        dashboard_q = latest_scan.get("q_factor") or 0
        dashboard_bw = latest_scan.get("bandwidth") or 0

    else:

        dashboard_f0 = f0
        dashboard_rms = 1.84
        dashboard_q = 8.7
        dashboard_bw = 74


    return render_template(
        "dashboard.html",

        f0=dashboard_f0,
        rms=dashboard_rms,
        q=dashboard_q,
        bandwidth=dashboard_bw,

        points=points,

        references=references,
        scans=scans,

        latest_scan=latest_scan
    )


# ============================================================
# STATUS API
# ============================================================

@app.route("/api/status")
def status():

    return jsonify({
        "device": "Acoustic Bone Scanner",
        "connected": True,
        "database": "Supabase"
    })


# ============================================================
# REFERENCE API
# ============================================================

@app.route("/api/references")
def references():

    result = (
        supabase
        .table("reference_measurements")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    return jsonify(
        result.data or []
    )


# ============================================================
# SCAN API
# ============================================================

@app.route("/api/scans")
def scans():

    result = (
        supabase
        .table("scan_measurements")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    return jsonify(
        result.data or []
    )


# ============================================================
# RECEIVE SCAN FROM ESP32
# ============================================================

@app.route(
    "/api/scan",
    methods=["POST"]
)
def receive_scan():

    try:

        data = request.get_json(
            silent=True
        )


        if not data:

            return jsonify({
                "success": False,
                "message": "No JSON data received"
            }), 400


        # ----------------------------------------------------
        # Extract data
        # ----------------------------------------------------

        scan_id = data.get(
            "scan_id"
        )

        f0 = data.get(
            "f0"
        )

        rms = data.get(
            "rms"
        )

        q_factor = data.get(
            "q_factor"
        )

        bandwidth = data.get(
            "bandwidth"
        )


        # ----------------------------------------------------
        # Basic validation
        # ----------------------------------------------------

        if scan_id is None:

            scan_id = (
                "ESP32-" +
                datetime.now(
                    timezone.utc
                ).strftime(
                    "%Y%m%d%H%M%S"
                )
            )


        if f0 is None:
            f0 = 0

        if rms is None:
            rms = 0

        if q_factor is None:
            q_factor = 0

        if bandwidth is None:
            bandwidth = 0


        # ----------------------------------------------------
        # Prepare Supabase row
        # ----------------------------------------------------

        scan_data = {

            "scan_id":
                str(scan_id),

            "f0":
                float(f0),

            "rms":
                float(rms),

            "q_factor":
                float(q_factor),

            "bandwidth":
                float(bandwidth)
        }


        # ----------------------------------------------------
        # Insert into Supabase
        # ----------------------------------------------------

        result = (
            supabase
            .table("scan_measurements")
            .insert(scan_data)
            .execute()
        )


        # ----------------------------------------------------
        # Success
        # ----------------------------------------------------

        return jsonify({

            "success":
                True,

            "message":
                "Scan data saved successfully",

            "data":
                result.data
        })


    except Exception as e:

        print(
            "SCAN UPLOAD ERROR:",
            str(e)
        )


        return jsonify({

            "success":
                False,

            "message":
                "Failed to save scan",

            "error":
                str(e)
        }), 500


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )
