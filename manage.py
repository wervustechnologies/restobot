#!/usr/bin/env python
"""
RestoBot dev manager.

Single-command runner for the Flask backend and the Vite/React frontend.

Usage (from the repo root):
    python manage.py setup   # create backend venv + install deps, npm install frontend
    python manage.py run     # start backend (:5000) and frontend (:5173); Ctrl+C stops both
    python manage.py stop    # terminate any running backend/frontend processes

Notes:
    - Windows only (uses backend/venv/Scripts/python.exe and taskkill).
    - The backend virtualenv lives at backend/venv.
    - backend/.env (JWT secret) and the Firebase admin SDK json are gitignored;
      `setup` warns if they are missing.
"""

import argparse
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

VENV = BACKEND / "venv"
VENV_PY = VENV / "Scripts" / "python.exe"

BACKEND_PORT = 5000
FRONTEND_PORT = 5173

NPM = "npm.cmd" if os.name == "nt" else "npm"


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def info(msg):
    print(f"[manage] {msg}")


def warn(msg):
    print(f"[manage] WARNING: {msg}")


def die(msg, code=1):
    print(f"[manage] ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def ensure_venv():
    """Create the backend venv if it does not exist. Returns True if freshly created."""
    if VENV_PY.exists():
        return False
    info("Backend venv not found. Creating backend/venv ...")
    subprocess.check_call([sys.executable, "-m", "venv", str(VENV)])
    return True


def install_backend_deps():
    req = BACKEND / "requirements.txt"
    if not req.exists():
        die(f"Missing {req}")
    info("Installing backend dependencies ...")
    subprocess.check_call([str(VENV_PY), "-m", "pip", "install", "--upgrade", "pip"])
    subprocess.check_call([str(VENV_PY), "-m", "pip", "install", "-r", str(req)])


def install_frontend_deps():
    if not (FRONTEND / "package.json").exists():
        die(f"Missing {FRONTEND / 'package.json'}")
    info("Installing frontend dependencies (npm install) ...")
    subprocess.check_call([NPM, "install"], cwd=str(FRONTEND), shell=(os.name == "nt"))


def check_env_files():
    if not (BACKEND / ".env").exists():
        warn("backend/.env not found. Copy backend/.env.example to backend/.env and set jwt_secret_key.")
    firebase = list(BACKEND.glob("restobot-*-firebase-adminsdk-*.json"))
    if not firebase:
        warn("Firebase admin SDK credentials json not found in backend/. The backend may fail to start.")


def stream_output(proc, prefix):
    """Read a process's combined stdout and print with a prefix."""
    for line in iter(proc.stdout.readline, b""):
        if not line:
            break
        try:
            text = line.decode(errors="replace").rstrip()
        except Exception:
            text = str(line).rstrip()
        print(f"[{prefix}] {text}")


# ----------------------------------------------------------------------------
# Commands
# ----------------------------------------------------------------------------
def cmd_setup(_args):
    created = ensure_venv()
    if created:
        install_backend_deps()
    else:
        info("Backend venv already exists. Ensuring dependencies are installed ...")
        install_backend_deps()

    if (FRONTEND / "node_modules").exists():
        info("frontend/node_modules already exists. Skipping npm install.")
    else:
        install_frontend_deps()

    check_env_files()
    info("Setup complete. Run: python manage.py run")


def cmd_run(_args):
    # Backend venv must exist; create if missing (but don't force reinstall each run).
    if not VENV_PY.exists():
        warn("Backend venv missing; creating it and installing dependencies (first run).")
        ensure_venv()
        install_backend_deps()

    if not (FRONTEND / "node_modules").exists():
        install_frontend_deps()

    check_env_files()

    procs = []

    info("Starting backend on http://localhost:%d ..." % BACKEND_PORT)
    backend_proc = subprocess.Popen(
        [str(VENV_PY), "run.py"],
        cwd=str(BACKEND),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    procs.append(("backend", backend_proc))

    info("Starting frontend on http://localhost:%d ..." % FRONTEND_PORT)
    frontend_proc = subprocess.Popen(
        [NPM, "run", "dev"],
        cwd=str(FRONTEND),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        shell=(os.name == "nt"),
    )
    procs.append(("frontend", frontend_proc))

    threads = []
    for name, proc in procs:
        t = threading.Thread(target=stream_output, args=(proc, name), daemon=True)
        t.start()
        threads.append(t)

    def shutdown(*_):
        info("Shutting down ...")
        for name, proc in procs:
            if proc.poll() is None:
                info(f"Terminating {name} (pid {proc.pid}) ...")
                terminate_tree(proc.pid)
        # give them a moment
        deadline = time.time() + 8
        for name, proc in procs:
            while proc.poll() is None and time.time() < deadline:
                time.sleep(0.2)
            if proc.poll() is None:
                info(f"Force killing {name} (pid {proc.pid}) ...")
                terminate_tree(proc.pid, force=True)
        info("Stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    info("Both services are starting. Press Ctrl+C to stop both.")

    # Watch: if either process dies on its own, tear down the other.
    try:
        while True:
            for name, proc in procs:
                code = proc.poll()
                if code is not None:
                    warn(f"{name} exited with code {code}. Stopping the other service.")
                    shutdown()
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown()


def terminate_tree(pid, force=False):
    """Terminate a process and its children."""
    if os.name == "nt":
        args = ["taskkill", "/PID", str(pid), "/T"]
        if force:
            args.append("/F")
        subprocess.call(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        try:
            os.kill(pid, signal.SIGKILL if force else signal.SIGTERM)
        except ProcessLookupError:
            pass


def _pids_on_port(port):
    """Return PIDs listening on the given TCP port (Windows netstat)."""
    pids = set()
    try:
        out = subprocess.check_output(["netstat", "-ano", "-p", "tcp"], text=True)
    except Exception:
        return pids
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0].upper() == "TCP":
            local = parts[1]
            if local.endswith(f":{port}") and parts[-1].isdigit():
                pids.add(int(parts[-1]))
    return pids


def cmd_stop(_args):
    stopped_any = False

    # Backend: whatever listens on the backend port.
    for pid in _pids_on_port(BACKEND_PORT):
        info(f"Stopping backend process on port {BACKEND_PORT} (pid {pid}) ...")
        terminate_tree(pid, force=True)
        stopped_any = True

    # Frontend: whatever listens on the vite port.
    for pid in _pids_on_port(FRONTEND_PORT):
        info(f"Stopping frontend process on port {FRONTEND_PORT} (pid {pid}) ...")
        terminate_tree(pid, force=True)
        stopped_any = True

    if not stopped_any:
        info("No running backend/frontend processes found.")
    else:
        info("Stopped running services.")


# ----------------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        prog="manage.py",
        description="RestoBot dev manager: run the Flask backend and Vite frontend together.",
    )
    sub = parser.add_subparsers(dest="command")

    p_setup = sub.add_parser("setup", help="Create backend venv + install deps, npm install frontend")
    p_setup.set_defaults(func=cmd_setup)

    p_run = sub.add_parser("run", help="Run backend and frontend together (Ctrl+C stops both)")
    p_run.set_defaults(func=cmd_run)

    p_stop = sub.add_parser("stop", help="Terminate running backend/frontend processes")
    p_stop.set_defaults(func=cmd_stop)

    args = parser.parse_args()
    if not getattr(args, "command", None):
        parser.print_help()
        sys.exit(0)
    args.func(args)


if __name__ == "__main__":
    main()
