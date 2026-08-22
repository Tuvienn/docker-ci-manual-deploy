from flask import Flask, jsonify, send_from_directory, redirect
from flask_cors import CORS
import os
import time
import platform

app = Flask(__name__)
CORS(app)  # Cho phép frontend từ bất kỳ origin nào gọi API

VERSION = "1.0"
START_TIME = time.time()


@app.route("/")
def home():
    return "Hello CI Docker Deployment!"


@app.route("/health")
def health():
    uptime_seconds = time.time() - START_TIME
    return jsonify({
        "status": "ok",
        "uptime": f"{uptime_seconds:.2f}s",
        "system": platform.system(),
        "python_version": platform.python_version()
    })


@app.route("/version")
def version():
    return jsonify({
        "version": VERSION
    })

# ── Serve Frontend ────────────────────────────────────────
FRONTEND_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route("/ui")
def frontend_redirect():
    return redirect("/ui/")

@app.route("/ui/")
def frontend():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/ui/<path:filename>")
def frontend_static(filename):
    return send_from_directory(FRONTEND_DIR, filename)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=8000
    )