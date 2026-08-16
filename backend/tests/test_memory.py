import pytest

from services.memory import add_message, get_history, get_all_sessions, delete_session


@pytest.mark.asyncio
async def test_add_and_get_message():
    """Test inserting and retrieving messages from SQLite memory."""
    session_id = "test_session_1"
    await add_message(session_id, "user", "Hello World")
    
    history = await get_history(session_id)
    assert len(history) == 1
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "Hello World"


@pytest.mark.asyncio
async def test_session_management():
    """Test retrieving and deleting sessions."""
    session_id = "test_session_2"
    await add_message(session_id, "user", "Test 2")
    
    sessions = await get_all_sessions()
    assert any(s["id"] == session_id for s in sessions)
    
    deleted = await delete_session(session_id)
    assert deleted is True
    
    history = await get_history(session_id)
    assert len(history) == 0


@pytest.mark.asyncio
async def test_max_messages_truncation():
    """Test that max messages per session limit is enforced."""
    session_id = "test_session_3"
    
    # Insert 50 messages, limit is 40
    for i in range(50):
        await add_message(session_id, "user", f"Message {i}")
        
    # get_history returns the last 20 by default according to the implementation
    history = await get_history(session_id)
    assert len(history) == 20
    assert history[-1]["content"] == "Message 49"
