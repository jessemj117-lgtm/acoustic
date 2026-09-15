from flask import Flask, render_template, jsonify
from supabase import create_client
import os
import math

app = Flask(__name__)

# Supabase connection
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


@app.route("/")
def dashboard():

    # Demo resonance curve for now
    f0 = 642

    points = [
        {
            "frequency": f,
            "rms": round(
                0.35 + 1.49 * math.exp(-((f - f0) / 55) ** 2),
                3
            )
        }
        for f in range(200, 1201, 10)
    ]

    # Get reference measurements
    result = (
        supabase
        .table("reference_measurements")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    references = result.data

    return render_template(
        "dashboard.html",
        f0=f0,
        rms=1.84,
        q=8.7,
        bandwidth=74,
        points=points,
        references=references
    )


@app.route("/api/status")
def status():

    return jsonify({
        "device": "Acoustic Bone Scanner",
        "connected": True,
        "database": "Supabase"
    })


@app.route("/api/references")
def references():

    result = (
        supabase
        .table("reference_measurements")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    return jsonify(result.data)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
@app.route("/api/scan", methods=["POST"])
def receive_scan():
    from flask import request

    data = request.get_json()

    scan_data = {
        "scan_id": data.get("scan_id"),
        "f0": data.get("f0"),
        "rms": data.get("rms"),
        "q_factor": data.get("q_factor"),
        "bandwidth": data.get("bandwidth")
    }

    result = (
        supabase
        .table("scan_measurements")
        .insert(scan_data)
        .execute()
    )

    return jsonify({
        "success": True,
        "message": "Scan data saved",
        "data": result.data
    })
