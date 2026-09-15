from flask import Flask, render_template, jsonify
import math
app = Flask(__name__)

@app.route("/")
def dashboard():
    f0 = 642
    points = [{"frequency": f, "rms": round(0.35 + 1.49*math.exp(-((f-f0)/55)**2), 3)}
              for f in range(200, 1201, 10)]
    return render_template("dashboard.html", f0=f0, rms=1.84, q=8.7,
                           bandwidth=74, points=points)

@app.route("/api/status")
def status():
    return jsonify({"device": "Demo", "connected": True})

if __name__ == "__main__":
    app.run(debug=True)
