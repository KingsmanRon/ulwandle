"""
Unit tests for the Claude model fallback chain (resilience when a pinned model
ID is retired). We test the pure chain-construction logic; the network call is
exercised in integration, not here.
"""

from app.core.config import settings
from app.services.claude_service import ClaudeService


def test_primary_model_is_first_and_deduped(monkeypatch):
    monkeypatch.setattr(
        settings, "CLAUDE_FALLBACK_MODELS",
        ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
    )
    chain = ClaudeService._model_chain("claude-sonnet-4-6")
    assert chain[0] == "claude-sonnet-4-6"           # primary tried first
    assert chain.count("claude-sonnet-4-6") == 1      # not duplicated by fallbacks
    assert chain[-1] == "claude-haiku-4-5"            # ends on the cheap safety net
    assert "claude-opus-4-8" in chain


def test_chain_handles_primary_absent_from_fallbacks(monkeypatch):
    monkeypatch.setattr(settings, "CLAUDE_FALLBACK_MODELS", ["claude-opus-4-8"])
    chain = ClaudeService._model_chain("claude-opus-4-7")
    assert chain == ["claude-opus-4-7", "claude-opus-4-8"]
