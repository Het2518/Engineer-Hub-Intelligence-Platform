import pytest

def test_chat_missing_auth(test_client):
    """Verify that chatting without the API key is rejected."""
    response = test_client.post("/chat", json={"question": "Hello?"})
    assert response.status_code == 401


def test_chat_non_streaming(test_client, mocker):
    """Verify the non-streaming chat endpoint."""
    headers = {"Authorization": "Bearer test_api_key"}
    
    # Mock RAG retrieval
    mocker.patch("routers.chat.hybrid_search", return_value=[])
    
    # Mock AsyncOpenAI generator for streaming response
    async def mock_agenerator():
        yield "Hello"
        yield " World"
    mocker.patch("services.llm.stream_answer", return_value=mock_agenerator())
    
    response = test_client.post(
        "/chat", 
        json={"question": "Hello?", "stream": False},
        headers=headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Hello World"
    assert "sources" in data


def test_get_sessions_unauthorized(test_client):
    """Verify that session listing requires auth."""
    response = test_client.get("/chat/sessions")
    assert response.status_code == 401


def test_get_sessions_authorized(test_client):
    """Verify that session listing works with valid auth."""
    headers = {"Authorization": "Bearer test_api_key"}
    response = test_client.get("/chat/sessions", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
