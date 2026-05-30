# ✦ Aura AI — Full-Stack AI Chat SaaS

A production-ready AI chat application built with React, FastAPI, PostgreSQL, and OpenAI GPT-4o-mini. Features real-time streaming, JWT authentication, file uploads, and a beautiful dark UI.

---

## 📁 Project Structure

```
aura-ai/
├── frontend/                  # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/client.js      # API client + SSE streaming
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── components/
│   │   │   ├── AuthModal.jsx   # Login / Signup
│   │   │   ├── Sidebar.jsx     # Chat list
│   │   │   ├── ChatArea.jsx    # Messages view
│   │   │   ├── MessageBubble.jsx  # Markdown rendering
│   │   │   └── InputBar.jsx    # Send + file attach
│   │   ├── App.jsx             # Root component + state
│   │   └── index.css           # Global styles + design tokens
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app entrypoint
│   │   ├── config.py           # Settings (pydantic-settings)
│   │   ├── database.py         # Async SQLAlchemy setup
│   │   ├── models.py           # User, Chat, Message, File models
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── auth.py             # JWT + password hashing
│   │   ├── ai_service.py       # OpenAI integration (stream + sync)
│   │   └── routes/
│   │       ├── auth.py         # POST /signup, /login, GET /me
│   │       ├── chat.py         # Chat CRUD + AI messaging + streaming
│   │       └── files.py        # File upload (RAG-ready)
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── docker-compose.yml
├── init.sql
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js** 20+ and **npm**
- **Python** 3.12+
- **PostgreSQL** 16+ running locally, OR use Docker Compose
- **OpenAI API key** — [get one here](https://platform.openai.com/api-keys)

---

### Option A — Docker Compose (Recommended)

The fastest way to run everything together.

```bash
# 1. Clone and enter the project
cd aura-ai

# 2. Create a root .env file
cat > .env << EOF
OPENAI_API_KEY=sk-your-key-here
SECRET_KEY=your-secret-key-at-least-32-chars-long
APP_ENV=development
EOF

# 3. Start all services
docker compose up --build

# App will be available at:
#   Frontend: http://localhost:3000
#   Backend API: http://localhost:8000
#   API Docs: http://localhost:8000/docs
```

---

### Option B — Manual Setup

#### 1. Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE aura_db;"
psql -U postgres aura_db < init.sql
```

#### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your values:
#   DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/aura_db
#   SECRET_KEY=your-secret-key-at-least-32-chars
#   OPENAI_API_KEY=sk-your-openai-key

# Start the backend (auto-creates DB tables on first run)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend API docs: http://localhost:8000/docs

#### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env:
#   VITE_API_URL=http://localhost:8000/api/v1

# Start the dev server
npm run dev
```

Frontend: http://localhost:5173

---

## 🔌 API Reference

### Auth

| Method | Endpoint           | Auth | Description              |
|--------|--------------------|------|--------------------------|
| POST   | `/api/v1/auth/signup` | —    | Create account           |
| POST   | `/api/v1/auth/login`  | —    | Get JWT token            |
| GET    | `/api/v1/auth/me`     | ✓    | Get current user         |

**Signup request:**
```json
{
  "email": "you@example.com",
  "username": "yourname",
  "password": "minimum8chars"
}
```

**Login response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": "...", "email": "...", "username": "..." }
}
```

### Chats

| Method | Endpoint                     | Auth | Description                        |
|--------|------------------------------|------|------------------------------------|
| GET    | `/api/v1/chats`              | ✓    | List all chats                     |
| GET    | `/api/v1/chats/{id}`         | ✓    | Get chat with messages             |
| POST   | `/api/v1/chats/message`      | ✓    | Send message (non-streaming)       |
| POST   | `/api/v1/chats/message/stream` | ✓  | Send message (SSE streaming)       |
| PATCH  | `/api/v1/chats/{id}`         | ✓    | Rename chat                        |
| DELETE | `/api/v1/chats/{id}`         | ✓    | Delete chat + all messages         |

**Send message request:**
```json
{
  "chat_id": "uuid-or-null-for-new-chat",
  "content": "Hello, AI!",
  "stream": false
}
```

**Streaming (SSE events):**
```
data: {"type": "chat_info", "chat_id": "...", "chat_title": "..."}
data: {"type": "chunk", "content": "Hello"}
data: {"type": "chunk", "content": " there"}
data: {"type": "done", "message_id": "..."}
```

### Files

| Method | Endpoint                        | Auth | Description          |
|--------|---------------------------------|------|----------------------|
| POST   | `/api/v1/files/upload`          | ✓    | Upload file          |
| GET    | `/api/v1/files`                 | ✓    | List user files      |
| DELETE | `/api/v1/files/{id}`            | ✓    | Delete file          |

Supported formats: PDF, TXT, MD, CSV, JSON, DOCX (max 10MB)

---

## 🗄️ Database Schema

```sql
users
  id UUID PK
  email VARCHAR(255) UNIQUE
  username VARCHAR(100) UNIQUE
  hashed_password VARCHAR(255)
  is_active BOOLEAN
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

chats
  id UUID PK
  user_id UUID FK→users(id) CASCADE
  title VARCHAR(255)
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

messages
  id UUID PK
  chat_id UUID FK→chats(id) CASCADE
  role VARCHAR(20)       -- "user" | "assistant" | "system"
  content TEXT
  token_count INTEGER
  created_at TIMESTAMPTZ

uploaded_files
  id UUID PK
  user_id UUID FK→users(id) CASCADE
  chat_id UUID FK→chats(id) SET NULL
  filename VARCHAR(255)
  original_filename VARCHAR(255)
  file_path VARCHAR(512)
  file_size INTEGER
  mime_type VARCHAR(100)
  processed BOOLEAN     -- for future RAG pipeline
  created_at TIMESTAMPTZ
```

---

## ⚡ Features

| Feature | Status |
|---------|--------|
| JWT Authentication (signup/login) | ✅ |
| Persistent chat history | ✅ |
| AI responses (GPT-4o-mini) | ✅ |
| Real-time streaming (SSE) | ✅ |
| Streaming toggle (⚡ button) | ✅ |
| Markdown + code highlighting | ✅ |
| File upload (RAG-ready) | ✅ |
| Chat rename/delete | ✅ |
| Collapsible sidebar | ✅ |
| Sidebar search | ✅ |
| Mobile-friendly layout | ✅ |
| Docker Compose | ✅ |
| RAG pipeline | 🔲 (structure ready) |
| Rate limiting | 🔲 (add slowapi) |
| Supabase auth | 🔲 (swap auth.py) |

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | Async PostgreSQL URL |
| `SECRET_KEY` | ✅ | — | JWT signing key (min 32 chars) |
| `OPENAI_API_KEY` | ✅ | — | OpenAI API key |
| `ALGORITHM` | — | HS256 | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | 10080 | 7 days |
| `APP_ENV` | — | development | development / production |
| `ALLOWED_ORIGINS` | — | localhost | Comma-separated CORS origins |
| `UPLOAD_DIR` | — | ./uploads | File upload directory |
| `MAX_FILE_SIZE_MB` | — | 10 | Max upload size |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | — | /api/v1 | Backend API base URL |

---

## 🚢 Deployment

### Railway / Render / Fly.io (Backend)

```bash
# Set environment variables in your dashboard, then:
cd backend
# Dockerfile is ready to go
```

### Vercel / Netlify (Frontend)

```bash
cd frontend
npm run build
# Deploy the dist/ folder
# Set VITE_API_URL to your deployed backend URL
```

### Supabase (Database)

Replace `DATABASE_URL` with your Supabase PostgreSQL connection string:
```
DATABASE_URL=postgresql+asyncpg://postgres.xxx:password@aws-0-region.pooler.supabase.com:5432/postgres
```

---

## 🧩 Extending for RAG

The file upload infrastructure is already in place. To add RAG:

1. Install `langchain`, `chromadb`, `tiktoken`
2. When a file is uploaded, process it in a background task (FastAPI `BackgroundTasks`)
3. Chunk text → embed with OpenAI → store in ChromaDB
4. In `ai_service.py`, retrieve relevant chunks before calling GPT
5. Set `processed=True` on the `UploadedFile` record

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS |
| Fonts | Syne (display), DM Sans (UI), JetBrains Mono |
| Markdown | react-markdown, remark-gfm, react-syntax-highlighter |
| Backend | Python 3.12, FastAPI, Uvicorn |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 16 |
| Auth | JWT (python-jose), bcrypt (passlib) |
| AI | OpenAI GPT-4o-mini (streaming + sync) |
| Streaming | Server-Sent Events (SSE) |
| Container | Docker, Docker Compose |
| Proxy | Nginx |

---

## 📝 License

MIT — free for personal and commercial use.
