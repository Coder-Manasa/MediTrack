# MediTrack — Patient Admission Management

A responsive patient-admission dashboard built for the DScribe Software Engineer Intern Round 1 task.

## Features
- Add, view, edit and delete patient records (delete includes confirmation).
- Mark admitted patients as discharged.
- Search patients by name.
- Filter by ward, department and doctor.
- Frontend and backend validation for every required field.
- SQLite persistence across backend restarts (on Render, use a persistent disk).
- Responsive dashboard for desktop, tablet and mobile.
- Export the currently displayed records to CSV.

## Tech stack
- Frontend: React.js, Vite, CSS, Lucide React
- Backend: Python, FastAPI, Pydantic
- Database: SQLite
- Hosting: Vercel (frontend) and Render (backend)

## Project structure
```text
meditrack/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── render.yaml
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Run locally (Windows PowerShell)

### 1. Backend
```powershell
cd meditrack\backend
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```
Backend: http://127.0.0.1:8000  
Interactive API documentation: http://127.0.0.1:8000/docs

### 2. Frontend (open a second terminal)
```powershell
cd meditrack\frontend
npm install
Copy-Item .env.example .env
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

## Deploy backend on Render
1. Push this project to a public GitHub repository.
2. In Render, choose **New → Web Service** and connect the repository.
3. Set **Root Directory** to `backend`.
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add a persistent disk: mount path `/var/data`, size 1 GB.
7. Add environment variable `DATABASE_PATH=/var/data/patients.db`.
8. Deploy and test `https://YOUR-API.onrender.com/api/health`.

Note: Render's persistent disk is important because the SQLite database must survive service restarts/redeploys. Confirm that your selected Render plan supports persistent disks before submission.

## Deploy frontend on Vercel
1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite.
4. Add environment variable:
   `VITE_API_URL=https://YOUR-API.onrender.com`
5. Deploy.
6. Open the deployed site and test add, edit, search, filters, discharge and delete.

The frontend reads the backend URL from `VITE_API_URL`. Redeploy the frontend after changing this environment variable.

## Before submission
- [ ] Test all CRUD operations on the live deployment.
- [ ] Confirm records remain after a backend restart.
- [ ] Test backend validation directly at `/docs`.
- [ ] Add screenshots of the deployed dashboard to this README.
- [ ] Ensure the GitHub repository contains no `.env`, secrets, virtual environment or database file.
- [ ] Add your live frontend and backend links below.

## Live links
- Frontend: `ADD_VERCEL_URL`
- Backend: `ADD_RENDER_URL`
- API docs: `ADD_RENDER_URL/docs`

## Author
Manasa K M
