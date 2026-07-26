# RestoBot — Dev Manager (`manage.py`)

`manage.py` is a single-command runner for the RestoBot local development stack:

- **backend/** — Flask API (runs on `http://localhost:5000`)
- **frontend/** — Vite + React app (runs on `http://localhost:5173`)
- **superadmin-frontend/** — Vite + React app for super admins (runs on `http://localhost:5174`)

It sets up both environments and runs them together in one terminal, with a single
<kbd>Ctrl+C</kbd> stopping **both** services cleanly.

> **Platform:** Windows (uses `backend/venv/Scripts/python.exe` and `taskkill`).

---

## Prerequisites

- Python 3.10+
- Node.js 18+ (with `npm`)
- `backend/.env` containing `JWT_SECRET_KEY` (copy from `backend/.env.example`)
- Firebase admin SDK credentials json in `backend/` (gitignored)

---

## Quick start

```bash
# 1. Install all dependencies (backend venv + frontend node_modules)
python manage.py setup

# 2. Run backend and frontend together
python manage.py run
```

Then open the frontend at **http://localhost:5173**. It talks to the API at `http://localhost:5000`
(CORS already allows `localhost:5173` in `backend/app.py`).

To run the separate Super Admin frontend, run `python manage.py run-admin` in another terminal.
It will be available at **http://localhost:5174**.

Press <kbd>Ctrl+C</kbd> to stop running processes.

---

## Commands

| Command | Description |
| --- | --- |
| `python manage.py setup` | Create `backend/venv` (if missing) and install `backend/requirements.txt`. Runs `npm install` in `frontend/` (only if `node_modules` is missing). Warns if `backend/.env` or the Firebase credentials are missing. |
| `python manage.py run` | Start the backend (using the existing venv) and the frontend (`npm run dev`) together. Auto-installs missing deps on first run. <kbd>Ctrl+C</kbd> stops both. |
| `python manage.py run-admin` | Start *only* the superadmin-frontend (`npm run dev`). Auto-installs missing deps on first run. <kbd>Ctrl+C</kbd> stops it. Note: you need to run the backend separately if you want the APIs to work. |
| `python manage.py stop` | Terminate any running backend/frontend/superadmin processes (by port 5000 / 5173 / 5174). |
| `python manage.py --help` | Show usage. |

---

## How it works

- **Backend venv:** `manage.py` manages a virtualenv at `backend/venv`. `setup` creates it and
  installs dependencies; `run` reuses it. The venv directory is gitignored.
- **Frontend:** `run` runs `npm install` only when `frontend/node_modules` is absent, then
  `npm run dev`.
- **Logging:** Both processes stream to the same terminal, prefixed with `[backend]` and
  `[frontend]` so you can tell them apart.
- **Shutdown:** A single <kbd>Ctrl+C</kbd> (SIGINT) terminates both process trees. If either
  service crashes on its own, the other is also torn down. `manage.py stop` can be run from
  another terminal to force-kill anything still listening on the dev ports.

---

## Troubleshooting

- **Backend won't start / Firebase errors:** make sure the Firebase admin SDK json exists in
  `backend/` and `backend/.env` has `JWT_SECRET_KEY` set.
- **Port already in use:** run `python manage.py stop`, or close the other process holding
  ports 5000 / 5173 / 5174.
- **Changes to `requirements.txt`:** re-run `python manage.py setup` to refresh the venv.
