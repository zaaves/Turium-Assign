# Turium AI Knowledge Inbox

> A production-minded, single-user AI Knowledge Inbox application built with modern JavaScript ES modules, SQLite via Prisma ORM, decoupled Google Gemini embedding & LLM provider adapters, an asynchronous background worker queue, and a responsive SaaS-style React + Vite + Tailwind CSS dashboard.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Key Capabilities & Features](#key-capabilities--features)
4. [Technology Stack & Architectural Rationale](#technology-stack--architectural-rationale)
5. [Prerequisites & Environment Configuration](#prerequisites--environment-configuration)
6. [Getting Started (Step-by-Step)](#getting-started-step-by-step)
7. [API Contract Reference](#api-contract-reference)
8. [Ingestion & RAG Pipeline Workflow](#ingestion--rag-pipeline-workflow)
9. [Automated Testing & Verification](#automated-testing--verification)
10. [Design Tradeoffs, Scaling Limits & Production Roadmap](#design-tradeoffs-scaling-limits--production-roadmap)
11. [Project Directory Layout](#project-directory-layout)

---

## Executive Summary

The **Turium AI Knowledge Inbox** allows a user to save unstructured personal notes and arbitrary web URLs into a centralized knowledge repository. Rather than blocking HTTP ingestion requests with slow network calls, webpage parsing, and LLM embedding operations, the system employs an asynchronous background worker backed by SQLite transactions.

Once content is ingested:
- Extracted text is segmented into semantically coherent, deterministic token chunks with sliding-window overlap.
- High-dimensional vector embeddings are generated using Google's official Gemini API (`gemini-embedding-001`).
- Saved knowledge is queried through a grounded **Retrieval-Augmented Generation (RAG)** pipeline powered by Gemini Flash (`gemini-3-flash-preview` / `gemini-2.5-flash`), featuring strict anti-hallucination prompt constraints and bidirectional source citation verification (`[S1]`, `[S2]`).

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Layer (React 18 + Vite + Tailwind CSS)"]
        UI["SaaS Knowledge Dashboard"]
        Library["Knowledge Library\n(Notes, URLs, Status Polling)"]
        Assistant["AI Assistant Panel\n(Questions, Answers, Source Cards)"]
        Drawer["Item Detail Drawer\n(Raw Text & Chunk Inspection)"]
        UI --> Library
        UI --> Assistant
        UI --> Drawer
    end

    subgraph API["Backend API Layer (Express.js ES Modules)"]
        Router["Express App & Middleware\n(Request ID, Zod Validation, Central Error Handler)"]
        IngestCtrl["POST /api/ingest\n(202 Accepted)"]
        ItemsCtrl["GET /api/items\nGET /api/items/:id"]
        QueryCtrl["POST /api/query\n(RAG Pipeline)"]
        HealthCtrl["GET /api/health"]
        Router --> IngestCtrl
        Router --> ItemsCtrl
        Router --> QueryCtrl
        Router --> HealthCtrl
    end

    subgraph Storage["Persistence Layer (SQLite + Prisma ORM)"]
        DB[("SQLite Database\n(dev.db)")]
        TableItems["Item Table\n(id, title, content, status)"]
        TableJobs["IngestionJob Table\n(status, attempts, lockedAt)"]
        TableChunks["Chunk Table\n(content, embedding JSON, dims)"]
        DB --- TableItems
        DB --- TableJobs
        DB --- TableChunks
    end

    subgraph Worker["Asynchronous Worker Engine (Independent Process)"]
        WorkerProc["Worker Process Loop\n(worker.js)"]
        SSRF["SSRF Defense Guard\n(DNS resolve, RFC1918 block)"]
        Cheerio["HTML Extraction\n(Cheerio, metadata, clean text)"]
        Chunker["Sliding Window Chunker\n(~500 tokens, 50-token overlap)"]
        Embedder["Embedding Service"]
        WorkerProc --> SSRF --> Cheerio --> Chunker --> Embedder
    end

    subgraph Providers["Decoupled AI Adapters"]
        EmbedAdapter["Gemini Embedding Adapter\n(gemini-embedding-001, 3072 dims)"]
        LLMAdapter["Gemini LLM Adapter\n(gemini-3-flash-preview, grounding prompt)"]
        MockAdapter["Offline Mock Provider\n(Zero-latency deterministic unit tests)"]
    end

    %% Interactions
    Library -->|POST note/url| IngestCtrl
    IngestCtrl -->|Atomic Transaction| DB
    WorkerProc -->|Atomic Job Lease| TableJobs
    Embedder -->|Batch Embeddings| EmbedAdapter
    EmbedAdapter -->|Vector Persistence| TableChunks
    Assistant -->|Question| QueryCtrl
    QueryCtrl -->|Embed Query| EmbedAdapter
    QueryCtrl -->|Cosine Similarity Search| TableChunks
    QueryCtrl -->|Synthesize Grounded Answer| LLMAdapter
    LLMAdapter -->|Verified Citations [S1]| Assistant
```

---

## Key Capabilities & Features

### 1. Robust Content Ingestion
- **Plain-Text Notes**: Immediate ingestion with title and multi-paragraph content.
- **Webpage URLs**: Server-side extraction of page titles and main textual content using Cheerio.
- **Security Hardened SSRF Guard**:
  - Pre-fetch DNS resolution to inspect resolved IPv4 and IPv6 addresses.
  - Strict blocking of private, loopback, link-local, multicast, and cloud metadata addresses (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `169.254.169.254`, `::1`).
  - Safe redirect following (maximum 5 hops) with full IP re-validation on every redirect target.
  - Strict response payload size limits (2 MB cap) and network timeouts (15s).
- **Asynchronous Processing**: Ingestion returns `HTTP 202 Accepted` with a job ID in under 15ms.

### 2. Transactional SQLite Job Queue & Worker
- **Decoupled Process**: The background worker runs in a standalone OS process independent of the HTTP server.
- **Atomic Concurrency Control**: Uses SQLite transactional status updates (`lockedAt`, `status = PROCESSING`) to prevent dual-processing or race conditions.
- **Bounded Exponential Backoff**: Retries failed jobs up to 3 times before transitioning the item to `FAILED`.
- **Stale-Lock Recovery**: Automatically claims and resets jobs abandoned by worker crashes or timeouts after 5 minutes.
- **Strict Idempotency**: Re-running or retrying an ingestion job safely clears stale chunks before persisting new ones, preventing duplicate records.

### 3. Chunking & Embeddings Engine
- **Deterministic Token-Bounded Chunking**: Target chunk size of ~500 tokens (approximated at 4 chars/token) with 50-token sliding overlap.
- **Semantic Boundary Preservation**: Breaks on double newlines (paragraphs) first, falling back to sentences and whitespace.
- **High-Dimensional Gemini Embeddings**: Integrated with Google's official `gemini-embedding-001` endpoint, generating 3,072-dimensional vector representations.
- **Vector Serialization**: High-dimensional vectors are serialized into JSON strings and stored in SQLite chunk records alongside token counts, provider, model name, and dimensions.

### 4. Grounded RAG Query Engine
- **In-Memory Cosine Similarity**: Fast, exact vector dot-product similarity ranking across active chunks.
- **Dimension Safety**: Protects against cross-model corruption by dynamically filtering chunks that match the query vector's dimensionality.
- **Configurable Top-K & Threshold**: Allows selecting top 1–20 chunks with optional minimum similarity cutoff.
- **Strict Anti-Hallucination Prompting**: System instructions explicitly force the LLM to answer only using context enclosed in `[S1]`, `[S2]` markers and to state clearly when information is missing.
- **Citation Hallucination Pruning**: Automatically detects and strips any fabricated `[Sn]` citation markers from the LLM answer if they do not correspond to retrieved chunks.

### 5. SaaS-Style React Dashboard
- **Unified 3-Column SaaS Layout**: Ingestion modal, filterable Knowledge Library, and AI Assistant query console.
- **Live Status Polling**: Automatic lightweight polling (every 3 seconds) that dynamically disables itself when all items reach `COMPLETED` or `FAILED`.
- **Interactive Citations**: Clickable `[S1]`, `[S2]` badges in generated answers scroll and highlight corresponding source cards.
- **Full Transparency Drawer**: Slide-over drawer displaying raw text, extracted content, metadata, and token chunks.

---

## Technology Stack & Architectural Rationale

| Layer | Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **Runtime** | Node.js v20+ (ESM) | Native `import`/`export` support, fast asynchronous I/O, modern standard library. |
| **Backend Framework** | Express.js 4 | Minimal, unopinionated, reliable HTTP middleware ecosystem. |
| **Database & ORM** | SQLite + Prisma | Single-file portability (`dev.db`), zero external service dependencies (no Postgres or Docker needed for local setup), transactional safety, type-safe schema migrations. |
| **HTML Parsing** | Cheerio | Fast server-side DOM parsing; avoids the multi-gigabyte RAM overhead and security vulnerabilities of headless browsers (Puppeteer/Chromium). |
| **Embedding Provider** | Google Gemini `gemini-embedding-001` | Official Gemini API embedding model producing state-of-the-art 3,072-dimensional representations. |
| **Generative LLM** | Google Gemini `gemini-3-flash-preview` / `gemini-2.5-flash` | Ultra-low latency (~1-2s response time), 1M+ token context window, strict adherence to system prompts. |
| **Frontend Framework** | React 18 + Vite | Rapid Hot Module Replacement (HMR), component-driven UI, zero build bloat. |
| **Styling** | Tailwind CSS 3 | Utility-first, highly maintainable CSS with responsive breakpoints and zero runtime overhead. |
| **Validation** | Zod | Runtime schema validation across API payloads and environment variables with typed errors. |
| **Logging** | Pino | High-performance, structured JSON logging with request ID correlation. |
| **Testing** | Vitest + Supertest | Blazing fast ESM-native test runner with built-in mocking and HTTP integration testing. |

---

## Prerequisites & Environment Configuration

### Prerequisites
- **Node.js**: `v20.0.0` or higher (verified on Node.js `v24.15.0`)
- **npm**: `v10.0.0` or higher
- **Gemini API Key**: A valid Google AI Studio key ([https://aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### Environment Variables (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and configure:

```env
# Server
NODE_ENV=development
PORT=5000
DATABASE_URL="file:./dev.db"
FRONTEND_ORIGIN=http://localhost:5173

# Generative AI (LLM)
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3-flash-preview
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Embeddings Engine
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=gemini-embedding-001

# RAG & Chunking
RAG_TOP_K=5
RAG_MIN_SIMILARITY=0.0
CHUNK_TARGET_TOKENS=500
CHUNK_OVERLAP_TOKENS=50

# Worker & Queue
WORKER_POLL_INTERVAL_MS=2000
JOB_MAX_ATTEMPTS=3
JOB_STALE_LOCK_MS=300000
MAX_INGEST_BYTES=2000000
URL_FETCH_TIMEOUT_MS=15000
```

> **Security Note:** Never commit `backend/.env` or expose your `GEMINI_API_KEY`. It is excluded by `.gitignore`.

---

## Getting Started (Step-by-Step)

Open two or three terminal tabs to run the services:

### Step 1: Install Dependencies & Setup Database

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Open backend/.env in your editor and insert your GEMINI_API_KEY

# 3. Generate Prisma client & apply SQLite migrations
npx prisma generate
npx prisma migrate dev --name init

# 4. Install frontend dependencies
cd ../frontend
npm install
```

### Step 2: Start the Backend API Server (Terminal 1)

```bash
cd backend
npm run dev
# Server listening on http://localhost:5000
```

### Step 3: Start the Ingestion Worker (Terminal 2)

```bash
cd backend
npm run worker
# Background worker listening for PENDING ingestion jobs (polling every 2000ms)
```

### Step 4: Start the Frontend Application (Terminal 3)

```bash
cd frontend
npm run dev
# Frontend running at http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## API Contract Reference

### 1. Ingest Content (`POST /api/ingest`)
Queues a new note or URL for asynchronous processing.

**Request (Note):**
```bash
curl -X POST http://localhost:5000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "NOTE",
    "title": "Architecture Overview",
    "content": "Turium uses SQLite for zero-configuration vector persistence."
  }'
```

**Request (URL):**
```bash
curl -X POST http://localhost:5000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "URL",
    "url": "https://en.wikipedia.org/wiki/Retrieval-augmented_generation"
  }'
```

**Response (`202 Accepted`):**
```json
{
  "success": true,
  "data": {
    "item": {
      "id": "7345272c-8c13-48ac-abf0-1776a31ad891",
      "sourceType": "NOTE",
      "title": "Architecture Overview",
      "status": "PENDING",
      "createdAt": "2026-11-17T18:52:02.701Z"
    },
    "jobId": "5fa1f2af-6638-4b42-b6ac-9d8ded8c8082"
  }
}
```

---

### 2. List Items (`GET /api/items`)
Returns items with status and chunk count. Supports filtering and search.

**Query Parameters:**
- `status`: Filter by `PENDING`, `PROCESSING`, `COMPLETED`, or `FAILED`
- `sourceType`: Filter by `NOTE` or `URL`
- `search`: Case-insensitive title and content search
- `limit`: Default `50`, max `100`
- `offset`: Pagination offset

**Request:**
```bash
curl "http://localhost:5000/api/items?status=COMPLETED&limit=10"
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "7345272c-8c13-48ac-abf0-1776a31ad891",
        "title": "Architecture Overview",
        "sourceType": "NOTE",
        "status": "COMPLETED",
        "chunkCount": 1,
        "createdAt": "2026-11-17T18:52:02.701Z",
        "updatedAt": "2026-11-17T18:52:03.574Z"
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

---

### 3. Get Item Details (`GET /api/items/:id`)
Returns full raw and extracted content, chunks, and job processing history.

**Request:**
```bash
curl http://localhost:5000/api/items/7345272c-8c13-48ac-abf0-1776a31ad891
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "7345272c-8c13-48ac-abf0-1776a31ad891",
    "title": "Architecture Overview",
    "sourceType": "NOTE",
    "status": "COMPLETED",
    "rawContent": "Turium uses SQLite for zero-configuration vector persistence.",
    "chunks": [
      {
        "id": "chunk-uuid",
        "chunkIndex": 0,
        "content": "Turium uses SQLite for zero-configuration vector persistence.",
        "tokenCount": 14,
        "embeddingModel": "gemini-embedding-001",
        "embeddingDimensions": 3072
      }
    ],
    "jobs": [
      {
        "id": "job-uuid",
        "status": "COMPLETED",
        "attempts": 1
      }
    ]
  }
}
```

---

### 4. Query RAG Knowledge Base (`POST /api/query`)
Performs semantic retrieval and generates a grounded response with verified citations.

**Request:**
```bash
curl -X POST http://localhost:5000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What database does Turium use for vector persistence?",
    "topK": 3,
    "minSimilarity": 0.3
  }'
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "answer": "Turium utilizes SQLite through Prisma for local vector persistence [S1].",
    "sources": [
      {
        "label": "S1",
        "itemId": "7345272c-8c13-48ac-abf0-1776a31ad891",
        "title": "Architecture Overview",
        "sourceType": "NOTE",
        "sourceUrl": null,
        "chunkId": "chunk-uuid",
        "snippet": "Turium uses SQLite for zero-configuration vector persistence."
      }
    ],
    "retrieval": {
      "chunksRetrieved": 1,
      "topSimilarity": 0.702
    }
  }
}
```

---

### 5. Health Check (`GET /api/health`)
Provides real-time health metrics, database connectivity, and job queue counts.

**Request:**
```bash
curl http://localhost:5000/api/health
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected",
  "uptime": 128.45,
  "jobs": {
    "pending": 0,
    "processing": 0,
    "completed": 12,
    "failed": 0
  }
}
```

---

## Ingestion & RAG Pipeline Workflow

### Ingestion Lifecycle
1. **User Request**: User submits a Note or URL via `POST /api/ingest`.
2. **Transaction**: Express server opens a Prisma transaction, writes an `Item` (`PENDING`) and `IngestionJob` (`PENDING`), and returns `HTTP 202 Accepted` immediately.
3. **Worker Lease**: The background worker calls `jobRepository.claimNextJob()`. This atomically finds the oldest `PENDING` job (or stale `PROCESSING` job) and sets `status = PROCESSING`, `lockedAt = now`, `attempts = attempts + 1`.
4. **Extraction**:
   - If `NOTE`: Text is taken directly.
   - If `URL`: SSRF validation resolves DNS, verifies safe IP, fetches HTML via HTTP GET, and Cheerio extracts metadata and body text.
5. **Chunking**: Text is passed to `chunkingService.chunkText()`, splitting content into ~500-token chunks with 50-token overlap, preserving paragraph boundaries.
6. **Embeddings**: `embeddingProvider.embedDocuments()` batches chunk text into Google Gemini's `batchEmbedContents` API, validating 3,072-dimensional float vectors.
7. **Persistence**: Chunks and vector JSON strings are saved to the database; Item and Job status updated to `COMPLETED`.

### RAG Retrieval & Answer Generation
1. **User Question**: User asks a question via `POST /api/query`.
2. **Query Vector**: The question is sent to `embeddingProvider.embedQuery()`, producing a 3,072-dimensional vector.
3. **Semantic Similarity**: `retrievalService` loads stored chunks from SQLite, filters by matching dimensionality, and computes the Cosine Similarity:
   $$\text{similarity} = \frac{A \cdot B}{\|A\|_2 \|B\|_2}$$
4. **Ranking & Filtering**: Chunks are sorted descending by similarity. Chunks exceeding `minSimilarity` are sliced to `topK` (default 5).
5. **Grounded Synthesis**: Context chunks are formatted with `[S1]`, `[S2]` labels and sent to Gemini Flash alongside a strict grounding prompt.
6. **Citation Verification**: `ragService._verifyCitations()` parses all `[Sn]` occurrences in the LLM text. Fabricated labels are stripped. Valid labels are mapped to actual database items and returned as interactive source cards.

---

## Automated Testing & Verification

The project includes an exhaustive automated test suite covering all services, security guards, repositories, and API controllers.

### 1. Run Backend Test Suite (Vitest)
Unit and integration tests run offline against mocked providers to ensure instant, deterministic verification without consuming API quota:

```bash
cd backend
npm test
```

**Results:**
- **15 Test Files**: 100% Passed
- **77 Automated Tests**: 100% Passed
- Tests cover: SSRF DNS inspection, redirect limits, Cheerio extraction, chunking sliding-windows, job queue leases, stale lock recovery, idempotency, cosine similarity math, Zod validations, RAG citation verification, and error middleware.

### 2. Run Real Gemini API Live Verification
A standalone verification script executes the complete end-to-end flow against Google's live production API:

```bash
cd backend
node -e "
import { ingestionService } from './src/services/ingestion.service.js';
import { jobService } from './src/services/job.service.js';
import { ragService } from './src/services/rag.service.js';
import { prisma } from './src/config/prisma.js';

async function verify() {
  const item = await ingestionService.ingestNote({
    title: 'Live Gemini Note',
    content: 'Turium AI Knowledge Inbox uses SQLite and Google Gemini models.'
  });
  await jobService.processNextJob();
  const res = await ragService.answerQuestion({ question: 'What does Turium use?' });
  console.log('Answer:', res.answer);
  console.log('Sources:', res.sources);
}
verify();
"
```

### 3. Verify Frontend Production Build
```bash
cd frontend
npm run build
# Output: dist/ (clean build, 0 errors)
```

---

## Design Tradeoffs, Scaling Limits & Production Roadmap

### 1. In-Memory Cosine Similarity vs. Dedicated Vector Database
- **Current Approach**: Chunks are loaded from SQLite, deserialized from JSON, and cosine similarity is calculated in-memory in Node.js.
- **Tradeoff Rationale**: Eliminates external operational dependencies (no Pinecone, Weaviate, or Qdrant required). For a single-user inbox with <10,000 chunks, in-memory calculation takes <10ms and avoids cross-service network latency.
- **Scale Limit**: At 100,000+ chunks, memory footprint and CPU load during search will degrade query latency.
- **Production Roadmap**: Transition to **`pgvector`** in PostgreSQL or an embedded vector extension (such as `sqlite-vec`).

### 2. SQLite Database Concurrency
- **Current Approach**: Single-file SQLite database configured with Prisma ORM.
- **Tradeoff Rationale**: Extreme simplicity, zero-setup developer experience, instant teardown for testing.
- **Scale Limit**: SQLite allows unlimited concurrent readers but serializes writers with file-level database locks (`SQLITE_BUSY`). Running multiple concurrent ingestion workers would cause lock contention.
- **Production Roadmap**: Migrate to **PostgreSQL** or **MySQL** with row-level locking for enterprise multi-tenant deployments.

### 3. Polling Queue vs. Distributed Broker
- **Current Approach**: Background worker polls the SQLite `IngestionJob` table on a fixed interval (`WORKER_POLL_INTERVAL_MS = 2000`).
- **Tradeoff Rationale**: Avoids running a Redis instance or message broker (RabbitMQ/Kafka) for a lightweight application.
- **Scale Limit**: High-frequency database polling generates unnecessary database read I/O when the queue is idle.
- **Production Roadmap**: Adopt **Redis BullMQ** or **Temporal** for event-driven job distribution with native pub/sub.

### 4. Cheerio vs. Headless Browser for Web Ingestion
- **Current Approach**: Node.js `fetch` combined with Cheerio DOM parsing.
- **Tradeoff Rationale**: Extremely lightweight (<10ms per page), minimal memory footprint (<10MB RAM), robust against browser memory leaks and sandbox escape vulnerabilities.
- **Scale Limit**: Single Page Applications (SPAs) that render content entirely through client-side JavaScript (e.g. heavy React/Vue dashboards) return empty initial HTML.
- **Production Roadmap**: Introduce a hybrid fetcher: Cheerio by default, falling back to a sandboxed **Playwright** worker pool only when JavaScript rendering is detected.

---

## Project Directory Layout

```text
TuriumAssign/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # SQLite schema (Item, Chunk, IngestionJob)
│   │   └── migrations/             # Timestamped SQL migration history
│   ├── src/
│   │   ├── app.js                  # Express application setup & middleware stack
│   │   ├── server.js               # HTTP server entrypoint (port 5000)
│   │   ├── worker.js               # Standalone async worker process loop
│   │   ├── config/
│   │   │   ├── env.js              # Zod environment variable parsing & validation
│   │   │   ├── logger.js           # Pino structured logging configuration
│   │   │   └── prisma.js           # Singleton PrismaClient instance
│   │   ├── controllers/            # HTTP route handlers (ingest, items, query)
│   │   ├── middleware/             # Error handling, request ID, Zod validators
│   │   ├── providers/
│   │   │   ├── embeddings/         # Gemini & Mock embedding adapters
│   │   │   └── llm/                # Gemini Flash & Mock LLM adapters
│   │   ├── repositories/           # Database access layer (Item, Chunk, Job)
│   │   ├── routes/                 # Express API routes
│   │   ├── schemas/                # Zod request validation schemas
│   │   ├── services/               # Core business logic (chunking, RAG, worker)
│   │   └── utils/                  # Cosine similarity math, SSRF URL validator
│   ├── tests/                      # 15 Vitest test suites (77 automated tests)
│   ├── .env.example                # Documented configuration template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/             # UI Components (AddContentForm, ItemList, AnswerPanel, etc.)
│   │   ├── hooks/                  # Custom React hooks (useItems polling, useQuery)
│   │   ├── services/               # API clients (Axios, error formatting)
│   │   ├── App.jsx                 # Main application dashboard layout
│   │   └── index.css               # Tailwind CSS directives
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md                       # Complete project specification & documentation
```

---

## License

This project is authored as an engineering assessment for **Turium AI**. All rights reserved.
