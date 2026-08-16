import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

# Must set env vars before importing config or main
os.environ["API_KEY"] = "test_api_key"
os.environ["GROQ_API_KEY"] = "test_groq_key"
os.environ["OKF_ENABLED"] = "false"

from main import app
from config import get_settings


@pytest.fixture(scope="session")
def test_client():
    """Provides a TestClient initialized with our FastAPI app."""
    return TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def isolated_directories():
    """Ensure tests run with isolated upload/vectorstore directories."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_upload, \
         tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_db, \
         tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_kb:
        os.environ["UPLOAD_DIR"] = temp_upload
        os.environ["CHROMA_PERSIST_DIR"] = temp_db
        os.environ["OKF_KNOWLEDGE_DIR"] = temp_kb
        
        # Override the cached settings
        settings = get_settings()
        settings.upload_dir = temp_upload
        settings.chroma_persist_dir = temp_db
        settings.okf_knowledge_dir = temp_kb
        
        # Mock SQLite path in memory module
        import services.memory
        services.memory.DB_PATH = os.path.join(temp_upload, "chat_history_test.db")
        services.memory._init_db()

        yield


@pytest.fixture
def mock_openai_client(mocker):
    """Mocks the AsyncOpenAI client used for Groq/Vision calls."""
    mock_client = mocker.patch("services.ingestion.AsyncOpenAI", autospec=True)
    mock_instance = mock_client.return_value
    
    mock_chat_completion = AsyncMock()
    mock_chat_completion.choices = [
        AsyncMock(message=AsyncMock(content="Mocked vision extraction content"))
    ]
    mock_instance.chat.completions.create = AsyncMock(return_value=mock_chat_completion)
    
    return mock_instance
