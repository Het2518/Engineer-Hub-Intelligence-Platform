# Engineering Intelligence Hub

Hello there! 👋 Welcome to the **Engineering Intelligence Hub**. 

## What is this project?
Think of this project as a highly intelligent, private AI assistant specifically built for software engineering teams. It is a full-stack **RAG (Retrieval-Augmented Generation)** application. 

Instead of searching through endless folders, wikis, and code repositories to find information, you simply ask this AI a question. It will instantly read through all your uploaded architecture diagrams, incident reports, codebases, and runbooks, and give you a perfectly formatted answer. Even better? It tells you exactly *which* files it used to get that answer, so you know it's not making things up.

## What problem does it solve?
As engineering teams grow, knowledge gets lost. 
- *Where is the documentation for the payment API?*
- *How did we fix the database crash last October?*
- *What does this specific block of code in the backend actually do?*

Usually, answering these questions means tapping a senior engineer on the shoulder or spending two hours digging through old GitHub commits and Google Docs. 

**This project solves knowledge fragmentation.** It centralizes all your engineering data into one searchable "brain." It saves teams hundreds of hours of context-switching by giving them immediate, accurate answers to their technical questions.

## How it works
This system uses a modern AI pipeline called RAG (Retrieval-Augmented Generation). Here is the exact flow of how it works behind the scenes:

1. **Ingestion**: You drag and drop files (PDFs, Markdown, JSON, etc.) or paste a GitHub URL into the frontend.
2. **Chunking**: The backend takes those large files and smartly slices them into smaller, readable "chunks" (paragraphs of text or blocks of code).
3. **Embedding**: We use OpenAI to translate these text chunks into numbers (called vector embeddings).
4. **Storage**: These numbers are saved into our local vector database (ChromaDB).
5. **Retrieval (The Magic)**: When you ask a question like *"How does auth work?"*, the system searches the database for chunks of text that mathematically match your question.
6. **Generation**: The system takes the best matching chunks, hands them to an LLM (like GPT-4), and says: *"Answer the user's question using ONLY these chunks of context."* The LLM then streams the answer back to your screen in real-time!

## Tech Stack: What we used and why
We carefully chose a stack that is blazing fast, easy to maintain, and highly customizable.

### The Backend (FastAPI + Python)
- **Why we used it:** Python is the undisputed king of AI. We used **FastAPI** because it is incredibly fast, handles real-time data streaming perfectly, and is very easy to read. 
- **LangChain:** We use LangChain to orchestrate the AI. It handles the heavy lifting of slicing documents, talking to OpenAI, and managing our search pipeline.
- **ChromaDB:** This is our Vector Database. We chose Chroma because it runs entirely locally on your machine. You don't need to pay for an expensive cloud database to store your embeddings!
- **OpenAI:** Used for generating embeddings and generating the final chat responses because they currently offer the highest quality AI models.

### The Frontend (Next.js + JavaScript)
- **Why we used it:** We used **Next.js** (App Router) because it makes building full-stack React applications seamless. 
- **Pure JavaScript (JSX):** We intentionally stripped out TypeScript and used pure JavaScript to make the codebase as approachable and easy to modify as possible for rapid prototyping.
- **Tailwind CSS:** We used Tailwind to build a premium, custom UI with a warm color palette (corals, reds, and glassmorphism) without writing thousands of lines of raw CSS.

## Step-by-Step Setup Guide
Ready to run this on your own machine? It's easy. Just follow these steps:

### Prerequisites
You will need:
- **Node.js** installed (v18+)
- **Python** installed (v3.9+)
- An **OpenAI API Key**

### 1. Configure your environment
Clone the repository, then create your environment variables:
```bash
cp .env.example .env
```
Open the `.env` file and paste your OpenAI API key inside:
```env
OPENAI_API_KEY=your-api-key-here
```

### 2. Start the Backend (The Brain)
Open your terminal and run these exact commands to start the Python API and Database:

```bash
cd backend
python -m venv venv

# Activate the environment (Windows)
.\venv\Scripts\activate
# If on Mac/Linux, use: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server!
uvicorn main:app --reload --port 8000
```
*(Leave this terminal window open!)*

### 3. Start the Frontend (The Face)
Open a **brand new** terminal window and run these commands to start the beautiful web interface:

```bash
cd frontend

# Install Node dependencies
npm install

# Start the web app!
npm run dev
```

### 4. You're Done! 🎉
Open your web browser and navigate to **[http://localhost:3000](http://localhost:3000)**. 
Go to the upload tab, drop in some documents, and start chatting with your very own Engineering Intelligence Hub!

---

## 🐳 Dockerized Deployment (Recommended)
This project is fully Dockerized for production-ready deployment, fulfilling the assessment requirements. You can spin up the entire stack (Frontend, Backend, and ChromaDB) with a single command.

### Prerequisites
- **Docker** and **Docker Compose** installed on your machine.

### Setup Instructions
1. Clone the repository and configure your environment variables:
```bash
cp .env.example .env
```
2. Add your `OPENAI_API_KEY` to the `.env` file.
3. Build and start the containers in detached mode:
```bash
docker-compose up -d --build
```

The system will automatically download the ChromaDB image, build the FastAPI backend, and build the Next.js frontend. 

Once the containers are running, access the web UI at **[http://localhost:3000](http://localhost:3000)**.

To stop the application, run:
```bash
docker-compose down
```
# Engineer-Hub-Intelligence-Platform
