# Turium AI — AI Knowledge Inbox

A minimal, production-minded single-user web application that allows users to save plain-text notes and web URLs, asynchronously processes and embeds the content into SQLite, and provides a Retrieval-Augmented Generation (RAG) query interface to answer natural language questions grounded in saved knowledge.

## Project Structure

```text
├── backend/          # Node.js + Express API server, Prisma ORM, background worker
│   ├── prisma/       # Database schema and SQLite migrations
│   ├── src/          # Application code (ES modules)
│   └── tests/        # Integration and unit tests
├── frontend/         # React + Vite + Tailwind CSS single-page application
└── README.md         # Setup and architecture documentation
```

## Prerequisites

- Node.js (v20+ LTS recommended, tested on v24.15.0)
- npm (v10+)
- Google AI Studio API Key (for Gemini LLM and embeddings)

## Quick Start (Development)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and supply GEMINI_API_KEY
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### 2. Ingestion Worker (Separate Process)

```bash
cd backend
npm run worker
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:5000`.

## Architecture & Technology Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express (ES Modules)
- **Database**: SQLite with Prisma ORM
- **Async Queue**: SQLite-backed jobs table with dedicated worker process
- **AI Providers**: Decoupled LLM and Embeddings adapters (Google Gemini initially, extensible to OpenAI)
