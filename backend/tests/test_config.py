import pytest
from pydantic import ValidationError

from config import get_settings


def test_settings_load_successfully():
    """Verify that settings can be loaded without error in the test environment."""
    settings = get_settings()
    assert settings.api_key == "test_api_key"
    assert settings.groq_api_key == "test_groq_key"
    assert settings.okf_enabled is False


def test_missing_critical_config():
    """Verify that instantiating Settings without required fields raises ValidationError."""
    from config import Settings
    with pytest.raises(ValidationError):
        # We must explicitly set it to None to simulate missing if env is somehow providing it
        Settings(groq_api_key=None)

