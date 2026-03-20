# FinTrack — Personal Finance OS

> Full-stack Personal Finance Operating System built with **FastAPI + MongoDB Atlas + Redis** (backend) and **React 18 + Vite + Tailwind CSS** (frontend).

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- MongoDB Atlas cluster (free tier works)
- Redis (local or cloud — [Upstash](https://upstash.com) free)

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# ↳ Edit .env with your MONGODB_URI, SECRET_KEY, REDIS_URL, GROQ_API_KEY
```

Generate a SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Start the API server:
```bash
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (already done if you cloned fresh)
npm install

# Start dev server (proxies /api/* → localhost:8000)
npm run dev
```

App available at: http://localhost:5173

---

## 📁 Project Structure

```
FinTrack/
├── backend/
│   ├── app/
│   │   ├── core/           # config, database, redis, security
│   │   ├── models/         # MongoDB document models (Pydantic)
│   │   ├── schemas/        # Request/Response schemas (Pydantic v2)
│   │   ├── api/
│   │   │   ├── endpoints/  # auth, accounts, categories, transactions, budgets
│   │   │   ├── deps.py     # JWT auth dependency
│   │   │   └── router.py   # API router aggregation
│   │   ├── ml/             # ML engine stubs (Phase 3)
│   │   ├── background/     # APScheduler cron tasks
│   │   └── main.py         # FastAPI app entrypoint
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── layout/     # Sidebar, TopBar
    │   │   ├── ui/         # Card, Button, Input, Modal, Badge, ProgressBar
    │   │   └── charts/     # ECharts FinTrack theme
    │   ├── pages/          # CommandCenter, Accounts, Categories, Transactions, Budgets, Login, Register
    │   ├── services/       # API service wrappers (Axios + JWT refresh)
    │   ├── store/          # Zustand global state
    │   ├── App.jsx         # Routing + auth guards
    │   ├── main.jsx        # Entry point
    │   └── index.css       # FinTrack design system
    ├── vite.config.js
    └── index.html
```

---

## 🔧 Environment Variables

Copy `backend/.env.example` → `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `SECRET_KEY` | Random 32-byte hex string |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `REDIS_URL` | Redis URL (`redis://localhost:6379/0`) |
| `GROQ_API_KEY` | Groq API key for LLM features (Phase 4) |
| `EXCHANGE_RATE_API_KEY` | ExchangeRate-API key (Phase 2) |

---

## ✅ Phase 1 Complete — What's Built

| Feature | Status |
|---|---|
| JWT Auth (register, login, refresh, logout) | ✅ |
| User registration with default category seeding | ✅ |
| Accounts CRUD + Net Worth | ✅ |
| Categories CRUD + 2-level hierarchy | ✅ |
| Transactions CRUD + pagination + filters | ✅ |
| Balance auto-update on transaction create/edit/delete | ✅ |
| Bulk CSV import with hash-based dedup | ✅ |
| Split transactions | ✅ |
| Budgets CRUD + real-time spend tracking | ✅ |
| Budget vs. Actual comparison | ✅ |
| Command Center dashboard | ✅ |
| Dark premium UI with FinTrack design system | ✅ |
| ECharts theme registered | ✅ |

## 🔜 Phase 2 — Next Up

- Goals & Savings Targets
- Recurring Transactions (APScheduler cron)
- Multi-Currency FX rates (ExchangeRate-API)
- Push Notifications / Budget Alerts
- PDF / Excel Report Export
