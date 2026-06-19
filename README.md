# Engineering Intelligence Hub

👋 Welcome to the **Engineering Intelligence Hub**. 

## 🚀 What is this project?
This project is a highly intelligent, private AI assistant specifically built for software engineering teams. It is a full-stack **RAG (Retrieval-Augmented Generation)** application.

Instead of searching through endless folders, wikis, and code repositories to find information, you simply ask this AI a question. It will instantly read through all your uploaded architecture diagrams, incident reports, codebases, and runbooks, and give you a perfectly formatted answer. Most importantly, it tells you exactly *which* files it used to get that answer, so you know it's not hallucinating.

## 🌟 Key Features
- **Multi-format Ingestion:** Upload PDF, DOCX, TXT, JSON, CSV, and Image files (using Vision AI for architecture diagrams).
- **Hybrid Search:** Combines Vector Search (ChromaDB) and Keyword Search (BM25) with MMR (Maximal Marginal Relevance) re-ranking for highly accurate context retrieval.
- **Robust LLM Integration:** Streaming responses with strict prompt constraints to avoid hallucinations and ensure grounded answers with inline citations `[SOURCE: filename]`.
- **Knowledge Cards:** Automatically extracts key concepts, flows, and services into beautiful UI cards.
- **Conversation Memory:** Remembers your chat history for multi-turn conversations.
- **Admin Dashboard:** Built-in dashboard to monitor system stats and index sizes.
- **Dockerized:** One-click deployment with Docker Compose.

---

## 🛠️ Step-by-Step Setup Guide (Recommended Flow)

The easiest and most reliable way to run this project is using Docker. This ensures the frontend, backend, and ChromaDB vector database all start together seamlessly.

### Prerequisites
1. **Docker** and **Docker Compose** installed on your machine.
2. An **OpenAI API Key** (or Groq API key, depending on your configuration).

### 1. Configure your environment variables
Clone the repository, then copy the example environment file:
```bash
cp .env.example .env
```
Open the `.env` file and paste your API key inside:
```env
OPENAI_API_KEY=sk-your-api-key-here
```
*(Optional: You can also add a `GITHUB_TOKEN` if you plan to index private GitHub repositories).*

### 2. Start the Application
Open your terminal in the root directory of the project and run:
```bash
docker-compose up -d --build
```
This will automatically download the ChromaDB image, build the FastAPI backend, and build the Next.js frontend. 

### 3. Access the Application
Once the containers are successfully running, open your web browser:
- **Web Interface:** [http://localhost:3000](http://localhost:3000)
- **Backend API (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)

To stop the application at any time, run:
```bash
docker-compose down
```

---

## 💻 Local Development Setup (Without Docker)

If you want to run the project locally without Docker (e.g., for active development):

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### 1. Start the Backend (FastAPI)
Open a terminal and run:
```bash
cd backend
python -m venv venv

# Activate the environment
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```
*(Note: Since ChromaDB runs in-memory or locally via the backend in this mode, ensure you don't have port conflicts).*

### 2. Start the Frontend (Next.js)
Open a **new** terminal window and run:
```bash
cd frontend
npm install
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to view the app!

---

## 🏗️ Tech Stack
- **Backend:** Python, FastAPI, LangChain, ChromaDB (Vector Store), structlog
- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **AI Models:** OpenAI API / Groq API

