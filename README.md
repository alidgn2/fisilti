# Fisilti Gazetesi

Emergent bagimliligi kaldirilmis bagimsiz full-stack proje.

## Gerekenler

- Node.js + npm
- Python 3.11+
- MongoDB

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

## Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm start
```

Uygulama: http://localhost:3000
API: http://localhost:8001/api

Google login varsayilan olarak kapali. Email/sifre girisi calisir.
