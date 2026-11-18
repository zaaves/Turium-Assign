# Turium AI Knowledge Inbox — Master Technical Knowledge Base

> **Primary Objective**: This master document is the central technical source of truth for the entire **Turium AI Knowledge Inbox** codebase. It provides an exhaustive, evidence-backed architectural breakdown, component inventory, data flow traces, and engineering references designed for human engineers, technical interview panels, and autonomous AI coding agents.

---

## Navigation & Technical Document Index

The comprehensive technical investigation is partitioned into 18 specialized deep-dive documents located in `docs/technical-investigation/`:

| Doc # | Title & Topic | File Link | Core Focus |
| :---: | :--- | :--- | :--- |
| **00** | **Project Overview** | [00-PROJECT-OVERVIEW.md](file:///d:/TuriumAssign/docs/technical-investigation/00-PROJECT-OVERVIEW.md) | High-level problem statement, design goals, and tech stack rationale. |
| **01** | **Complete File Inventory** | [01-COMPLETE-FILE-INVENTORY.md](file:///d:/TuriumAssign/docs/technical-investigation/01-COMPLETE-FILE-INVENTORY.md) | Exhaustive catalog of every directory, file, responsibility, and dependency. |
| **02** | **System Architecture** | [02-SYSTEM-ARCHITECTURE.md](file:///d:/TuriumAssign/docs/technical-investigation/02-SYSTEM-ARCHITECTURE.md) | Layered design, component boundaries, and provider abstractions. |
| **03** | **Backend Deep Dive** | [03-BACKEND-DEEP-DIVE.md](file:///d:/TuriumAssign/docs/technical-investigation/03-BACKEND-DEEP-DIVE.md) | Server bootstrap, Express pipeline, middleware, and request IDs. |
| **04** | **Frontend Deep Dive** | [04-FRONTEND-DEEP-DIVE.md](file:///d:/TuriumAssign/docs/technical-investigation/04-FRONTEND-DEEP-DIVE.md) | React 18 SPA, component hierarchy, hooks, and live status polling. |
| **05** | **Ingestion & Worker Pipeline** | [05-INGESTION-AND-WORKER-PIPELINE.md](file:///d:/TuriumAssign/docs/technical-investigation/05-INGESTION-AND-WORKER-PIPELINE.md) | Note & URL workflows, Cheerio extraction, SSRF defense, and atomic worker leases. |
| **06** | **Chunking & Vector Embeddings** | [06-CHUNKING-AND-EMBEDDINGS.md](file:///d:/TuriumAssign/docs/technical-investigation/06-CHUNKING-AND-EMBEDDINGS.md) | Token chunking, sliding overlap, Gemini 3,072-dim vectors, and SQLite JSON storage. |
| **07** | **Vector Search & Cosine Similarity** | [07-VECTOR-SEARCH-AND-COSINE-SIMILARITY.md](file:///d:/TuriumAssign/docs/technical-investigation/07-VECTOR-SEARCH-AND-COSINE-SIMILARITY.md) | Cosine similarity mathematics, in-memory ranking, and top-K filtering. |
| **08** | **RAG Pipeline & Citations** | [08-RAG-PIPELINE-AND-CITATIONS.md](file:///d:/TuriumAssign/docs/technical-investigation/08-RAG-PIPELINE-AND-CITATIONS.md) | Grounded prompt construction, citation mapping, and hallucination pruning. |
| **09** | **AI Provider Switching Guide** | [09-LLM-AND-EMBEDDING-PROVIDER-SWITCHING.md](file:///d:/TuriumAssign/docs/technical-investigation/09-LLM-AND-EMBEDDING-PROVIDER-SWITCHING.md) | Adapter pattern, OpenAI implementation guide, and hybrid configs. |
| **10** | **Database Schema & Prisma** | [10-DATABASE-AND-PRISMA.md](file:///d:/TuriumAssign/docs/technical-investigation/10-DATABASE-AND-PRISMA.md) | SQLite models (`Item`, `Chunk`, `IngestionJob`), transactions, and cascade rules. |
| **11** | **REST API Reference** | [11-API-REFERENCE.md](file:///d:/TuriumAssign/docs/technical-investigation/11-API-REFERENCE.md) | Complete endpoint documentation, request schemas, and cURL commands. |
| **12** | **Security & Reliability** | [12-SECURITY-AND-ERROR-HANDLING.md](file:///d:/TuriumAssign/docs/technical-investigation/12-SECURITY-AND-ERROR-HANDLING.md) | SSRF defenses, prompt injection mitigation, rate limit backoff, and threat analysis. |
| **13** | **Testing Strategy** | [13-TESTING-AND-VERIFICATION.md](file:///d:/TuriumAssign/docs/technical-investigation/13-TESTING-AND-VERIFICATION.md) | 15 test suites (77 tests), mock provider vs live Gemini testing. |
| **14** | **Performance & Scalability** | [14-PERFORMANCE-AND-SCALABILITY.md](file:///d:/TuriumAssign/docs/technical-investigation/14-PERFORMANCE-AND-SCALABILITY.md) | Empirical scale modeling (100 to 100k docs) and pgvector roadmap. |
| **15** | **Environment & Local Setup** | [15-ENVIRONMENT-AND-SETUP.md](file:///d:/TuriumAssign/docs/technical-investigation/15-ENVIRONMENT-AND-SETUP.md) | Environment variable dictionary and 3-terminal launch guide. |
| **16** | **Interview Preparation Guide** | [16-INTERVIEW-PREPARATION.md](file:///d:/TuriumAssign/docs/technical-investigation/16-INTERVIEW-PREPARATION.md) | 42 technical interview questions and model answers with file citations. |
| **17** | **Known Limitations & Roadmap** | [17-KNOWN-LIMITATIONS-AND-IMPROVEMENTS.md](file:///d:/TuriumAssign/docs/technical-investigation/17-KNOWN-LIMITATIONS-AND-IMPROVEMENTS.md) | Intentional tradeoffs, architectural boundaries, and engineering roadmap. |

---

## 1. System Architecture at a Glance

The Turium AI Knowledge Inbox isolates fast synchronous user interactions from long-running network and AI processing using an asynchronous worker queue:

```mermaid
flowchart TD
    subgraph Client["Frontend Layer (React 18 + Vite + Tailwind)"]
        UI["SaaS Dashboard (App.jsx)"]
        Form["AddContentForm.jsx"]
        List["ItemList.jsx"]
        Ask["QuestionForm.jsx"]
        Answer["AnswerPanel.jsx"]
        Drawer["ItemDetailDrawer.jsx"]
        UI --> Form
        UI --> List
        UI --> Ask
        UI --> Answer
        UI --> Drawer
    end

    subgraph API["Backend API Layer (Express.js)"]
        Router["Express Router & Middleware\n(requestId, pino, cors, express.json)"]
        IngestCtrl["POST /api/ingest\n(202 Accepted)"]
        ItemsCtrl["GET /api/items\nGET /api/items/:id"]
        QueryCtrl["POST /api/query\n(RAG Pipeline)"]
        Router --> IngestCtrl
        Router --> ItemsCtrl
        Router --> QueryCtrl
    end

    subgraph Worker["Worker Process (worker.js)"]
        Loop["Infinite Polling Loop (2000ms)"]
        Claim["claimNextJob() (Atomic Transaction)"]
        Extract["Cheerio HTML Parser + SSRF Guard"]
        Chunker["Sliding Window Chunker (~500 tokens)"]
        Loop --> Claim --> Extract --> Chunker
    end

    subgraph Storage["Persistence Layer (SQLite + Prisma)"]
        DB[("SQLite Database (dev.db)")]
        TableItems["Item (title, content, status)"]
        TableJobs["IngestionJob (status, attempts, lockedAt)"]
        TableChunks["Chunk (content, embedding JSON, dims)"]
        DB --- TableItems
        DB --- TableJobs
        DB --- TableChunks
    end

    subgraph AI["AI Providers (Google Gemini)"]
        Embedder["gemini-embedding-001 (3072 dimensions)"]
        LLM["gemini-3-flash-preview (Grounded RAG synthesis)"]
    end

    %% Interactions
    Form -->|POST Note/URL| IngestCtrl
    IngestCtrl -->|Atomic Transaction| DB
    Claim -->|Atomic Lease| TableJobs
    Chunker -->|Batch Embeddings| Embedder
    Embedder -->|Persist JSON Vectors| TableChunks
    Ask -->|Question| QueryCtrl
    QueryCtrl -->|Embed Query| Embedder
    QueryCtrl -->|In-Memory Cosine Search| TableChunks
    QueryCtrl -->|Synthesize Grounded Answer| LLM
    LLM -->|Answer + Citations [S1]| Answer
```

---

## 2. Executive Summaries by Engineering Domain

### 2.1 Content Ingestion & SSRF Protection
- **Notes**: Ingested immediately. If title is omitted, the first line (up to 60 chars) is used as the title.
- **URLs**: Extracted on the server via Cheerio. To prevent **Server-Side Request Forgery (SSRF)**, `safe-url.js` performs pre-request DNS resolution to verify that target hostnames do not resolve to private subnets (`10.0.0.0/8`, `192.168.0.0/16`, `127.0.0.1`), link-local/cloud metadata (`169.254.169.254`), or IPv6 loopback (`::1`). Manual redirect following re-validates each redirect hop up to 5 hops max.
- **Deep Dive**: [05-INGESTION-AND-WORKER-PIPELINE.md](file:///d:/TuriumAssign/docs/technical-investigation/05-INGESTION-AND-WORKER-PIPELINE.md)

### 2.2 Asynchronous Worker & Queue Lifecycle
- **Decoupled Architecture**: `worker.js` runs as an independent Node.js process.
- **Atomic Concurrency Control**: Uses SQLite transactional status updates (`lockedAt`, `status = PROCESSING`) to prevent dual-processing or race conditions.
- **Stale-Lock Recovery**: Automatically claims and resets jobs abandoned by worker crashes or timeouts after 5 minutes (`JOB_STALE_LOCK_MS = 300000`).
- **Bounded Retries**: Bounded at 3 attempts (`JOB_MAX_ATTEMPTS = 3`). Failures transition to `PENDING` for retry; final failure transitions item and job to `FAILED`.
- **Strict Idempotency**: Reprocessing an item automatically deletes existing chunk records before inserting new ones.
- **Deep Dive**: [05-INGESTION-AND-WORKER-PIPELINE.md](file:///d:/TuriumAssign/docs/technical-investigation/05-INGESTION-AND-WORKER-PIPELINE.md#L3-background-worker-engine)

### 2.3 Text Chunking & Embeddings
- **Deterministic Chunking**: Target chunk size of ~500 tokens (approximated at 4 chars/token = 2,000 characters) with ~50-token (200 characters) sliding overlap.
- **Semantic Boundary Preservation**: Segments on paragraph double-newlines (`\n\n`) first, falling back to line breaks, sentences, and word boundaries.
- **Gemini Embeddings**: Integrated with official Google Gemini API (`gemini-embedding-001`). Produces **3,072-dimensional floating-point vectors**.
- **Vector Storage**: Stored as serialized JSON strings in the SQLite `Chunk.embedding` column.
- **Deep Dive**: [06-CHUNKING-AND-EMBEDDINGS.md](file:///d:/TuriumAssign/docs/technical-investigation/06-CHUNKING-AND-EMBEDDINGS.md)

### 2.4 Vector Search & Cosine Similarity
- **Mathematical Cosine Similarity**: Computes directional alignment between query vector and stored document vectors:
  $$\text{sim}(A, B) = \frac{A \cdot B}{\|A\|_2 \|B\|_2}$$
- **Dimension Safety**: Dynamically verifies `storedVector.length === queryVector.length`, skipping any mismatched legacy chunks.
- **Top-K & Cutoff**: Ranks chunks descending, filters by `minSimilarity` (default 0.0), and slices to `topK` (default 5, UI adjustable 1–10).
- **Deep Dive**: [07-VECTOR-SEARCH-AND-COSINE-SIMILARITY.md](file:///d:/TuriumAssign/docs/technical-investigation/07-VECTOR-SEARCH-AND-COSINE-SIMILARITY.md)

### 2.5 RAG Synthesis & Citation Verification
- **Prompt Isolation**: Chunks are enclosed in strict delimiters (`--- BEGIN CONTEXT ---`) and tagged `[S1]`, `[S2]`. The system instruction explicitly commands the LLM to treat context as quoted source material and avoid hallucinations.
- **Citation Pruning**: `rag.service.js` uses regex `\[(S\d+)\]/g` to extract all citation markers. Any fabricated tags invented by the LLM (e.g. `[S4]` when only 2 chunks exist) are stripped from the answer text before returning to the user.
- **Interactive UI Cards**: Clicking a citation badge in the UI smoothly scrolls to the corresponding source card displaying the title, source link, and exact 200-character snippet.
- **Deep Dive**: [08-RAG-PIPELINE-AND-CITATIONS.md](file:///d:/TuriumAssign/docs/technical-investigation/08-RAG-PIPELINE-AND-CITATIONS.md)

### 2.6 Provider Switching (OpenAI, Gemini, Ollama)
- **Zero Business Logic Coupling**: `RAGService` and `EmbeddingService` only interact with generic interfaces (`generateAnswer`, `embedDocuments`).
- **Seamless Provider Swapping**: Creating an OpenAI adapter and registering it in `providers/llm/index.js` allows switching from Gemini to OpenAI by simply setting `LLM_PROVIDER=openai` in `backend/.env`.
- **Hybrid Support**: Seamlessly supports Gemini Embeddings + OpenAI LLM (zero re-embedding required).
- **Deep Dive**: [09-LLM-AND-EMBEDDING-PROVIDER-SWITCHING.md](file:///d:/TuriumAssign/docs/technical-investigation/09-LLM-AND-EMBEDDING-PROVIDER-SWITCHING.md)

---

## 3. Quick Reference: Running the System

```bash
# 1. Setup Backend
cd backend
npm install
cp .env.example .env
# Edit backend/.env and supply your GEMINI_API_KEY
npx prisma generate
npx prisma migrate dev --name init
npm test # Runs offline test suite (15 files, 77 tests in ~5s)

# 2. Setup Frontend
cd ../frontend
npm install

# 3. Launch Services (Separate Terminals)
# Terminal 1: Backend API (port 5000)
cd backend && npm run dev

# Terminal 2: Ingestion Worker
cd backend && npm run worker

# Terminal 3: Frontend Dashboard (port 5173)
cd frontend && npm run dev
```

---

## 4. Architectural Invariants

Every engineer or AI coding agent modifying this codebase must adhere to the following 5 invariants:
1. **Never Call AI or Database from Controllers**: All HTTP controllers must delegate strictly to services; all database queries must reside in repositories.
2. **Never Bypass Ingestion Queue**: The API endpoint `POST /api/ingest` must always return `HTTP 202 Accepted` immediately; chunking and embedding operations belong exclusively to the background worker.
3. **Always Wrap Multi-Record Mutations in Transactions**: Item creation with jobs, and chunk deletion with chunk insertion, must be wrapped in `prisma.$transaction()`.
4. **Never Expose Secrets in Logs or Commits**: `GEMINI_API_KEY` must never be logged, printed to console, or included in client responses.
5. **Always Verify Citations Before Returning**: The RAG service must always run `_verifyCitations` to detect and prune ungrounded citation tags from LLM completions.
