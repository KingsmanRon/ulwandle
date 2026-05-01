"""
Claude AI service. Used strictly as an advisory layer — never an authorization gate.

Hardening:
- AsyncAnthropic to avoid blocking the event loop.
- Prompt caching on the static system text.
- Inputs are bounded enums / numeric primitives — no free-text user content.
- All outputs are validated before use; on any failure we return a typed fallback.
"""

import json
import logging
from typing import Any

from anthropic import AsyncAnthropic, APIError

from app.core.config import settings

logger = logging.getLogger(__name__)


_client: AsyncAnthropic | None = None


def _client_singleton() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY.get_secret_value(),
            timeout=settings.CLAUDE_TIMEOUT_SECONDS,
            max_retries=2,
        )
    return _client


# Reason codes mirror the ReasonCode enum in models.
_ALLOWED_REASON_CODES = {
    "leak_detected", "quality_breach", "contamination",
    "infrastructure_fault", "scheduled_maintenance", "emergency_other",
}


def _safe_str(value: Any, max_len: int = 60) -> str:
    """Reduce arbitrary input to a short, alphanumeric-ish slug for prompt safety."""
    s = "" if value is None else str(value)
    s = "".join(c for c in s if c.isalnum() or c in "-_ .")
    return s[:max_len]


def _parse_json(text: str) -> dict | None:
    """Strict JSON extraction; return None on any malformed output."""
    text = text.strip()
    if text.startswith("```"):
        # Strip a possible code fence.
        first_nl = text.find("\n")
        if first_nl != -1:
            text = text[first_nl + 1 :]
        if text.endswith("```"):
            text = text[: -3]
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        return None


# ---------- Public service surface ----------

class ClaudeService:

    async def analyze_consumption_patterns(
        self,
        district_name: str,
        flow_data: list[dict[str, Any]],
        historical_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Advisory analysis — never authorizes anything."""
        district = _safe_str(district_name)
        flow_summary = self._summarise_flow(flow_data, historical_data)

        system = [{
            "type": "text",
            "text": (
                "You are a water-systems analyst for South African municipal supply. "
                "Respond only with a single JSON object matching the requested schema. "
                "Do not include prose, markdown fences, or commentary."
            ),
            "cache_control": {"type": "ephemeral"},
        }]
        user_text = (
            f"District: {district}\n"
            f"Summary: {json.dumps(flow_summary)}\n\n"
            "Schema:\n"
            "{\n"
            '  "patterns": {"daily_trend": "string", "weekly_trend": "string", '
            '"anomalies_detected": false, "anomaly_details": []},\n'
            '  "leak_detection": {"potential_leaks": false, "confidence_score": 0.0, '
            '"estimated_loss_lpm": 0.0, "locations": []},\n'
            '  "predictions": {"next_24h": 0.0, "next_7d": 0.0, "next_30d": 0.0, "peak_periods": []},\n'
            '  "recommendations": {"immediate": [], "preventive": [], "infrastructure": []},\n'
            '  "risk_assessment": {"level": "low|medium|high|critical", "risks": [], "mitigation": []},\n'
            '  "summary": "string"\n'
            "}"
        )

        return await self._invoke(system, user_text, model=settings.CLAUDE_MODEL,
                                  max_tokens=2048, fallback=self._fallback_consumption())

    async def detect_water_quality_issues(
        self,
        district_name: str,
        quality_readings: list[dict[str, Any]],
        compliance_standards: dict[str, Any],
    ) -> dict[str, Any]:
        district = _safe_str(district_name)
        # Trim and round numeric inputs only.
        sanitised = []
        for r in quality_readings[:50]:
            sanitised.append({
                "ph": _num(r.get("ph")), "tds": _num(r.get("tds")),
                "turbidity": _num(r.get("turbidity")), "chlorine": _num(r.get("chlorine")),
                "temperature": _num(r.get("temperature")),
                "meets_standards": bool(r.get("meets_standards", True)),
            })

        system = [{
            "type": "text",
            "text": (
                "You assess SANS 241 drinking-water compliance from numeric readings. "
                "Reply with a single JSON object only."
            ),
            "cache_control": {"type": "ephemeral"},
        }]
        user_text = (
            f"District: {district}\n"
            f"Standards: {json.dumps(compliance_standards)}\n"
            f"Readings: {json.dumps(sanitised)}\n\n"
            "Schema:\n"
            "{\n"
            '  "compliance_status": {"meets_standards": true, "violations": []},\n'
            '  "drinkability": "safe|monitoring|unsafe",\n'
            '  "health_risks": [],\n'
            '  "recommendations": {"immediate": [], "treatment": [], "longterm": []},\n'
            '  "district_status": "green|yellow|red",\n'
            '  "summary": "string"\n'
            "}"
        )
        return await self._invoke(system, user_text, model=settings.CLAUDE_MODEL,
                                  max_tokens=1500, fallback=self._fallback_quality())

    async def advise_valve_operation(
        self,
        valve_summary: dict[str, Any],
        reason_code: str,
    ) -> dict[str, Any]:
        """
        ADVISORY ONLY. Never used to authorize. Inputs are bounded:
        valve_summary contains pre-computed numeric/enum fields; reason_code is a
        short enum string. No free-text reason notes are forwarded.
        """
        if reason_code not in _ALLOWED_REASON_CODES:
            reason_code = "emergency_other"

        # Sanitize the small set of fields we forward.
        forwarded = {
            "valve_name": _safe_str(valve_summary.get("valve_name"), 80),
            "district_name": _safe_str(valve_summary.get("district_name"), 80),
            "district_population": int(valve_summary.get("district_population") or 0),
            "current_status": _safe_str(valve_summary.get("current_status"), 20),
            "district_quality_status": _safe_str(valve_summary.get("district_quality_status"), 20),
            "reason_code": reason_code,
        }

        system = [{
            "type": "text",
            "text": (
                "You are an advisor for valve operations on South African water infrastructure. "
                "You do NOT authorize operations. You produce a structured JSON impact analysis. "
                "Reply with one JSON object only."
            ),
            "cache_control": {"type": "ephemeral"},
        }]
        user_text = (
            f"Operation context: {json.dumps(forwarded)}\n\n"
            "Schema:\n"
            "{\n"
            '  "impact": {"affected_population": 0, "estimated_duration_hours": 0.0, '
            '"severity": "low|medium|high|critical"},\n'
            '  "considerations": [],\n'
            '  "checklist": {"notifications": [], "employee_dispatch": [], "post_monitoring": []},\n'
            '  "summary": "string"\n'
            "}"
        )
        return await self._invoke(
            system, user_text, model=settings.CLAUDE_DECISION_MODEL,
            max_tokens=1024, fallback={"summary": "Advisory unavailable; proceed with manual judgement."}
        )

    # ---------- Internals ----------

    async def _invoke(self, system, user_text: str, *, model: str,
                      max_tokens: int, fallback: dict[str, Any]) -> dict[str, Any]:
        try:
            client = _client_singleton()
            msg = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=0.1,
                system=system,
                messages=[{"role": "user", "content": user_text}],
            )
            text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
            parsed = _parse_json(text)
            return parsed if parsed is not None else fallback
        except APIError as e:
            logger.warning("Claude API error: %s", e)
            return fallback
        except Exception:
            logger.exception("Claude invocation failed")
            return fallback

    def _summarise_flow(self, flow_data, historical_data):
        if not flow_data:
            return {}
        rates = [d.get("flow_rate", 0) for d in flow_data if isinstance(d.get("flow_rate"), (int, float))]
        if not rates:
            return {"count": len(flow_data)}
        return {
            "count": len(flow_data),
            "avg": round(sum(rates) / len(rates), 2),
            "min": round(min(rates), 2),
            "max": round(max(rates), 2),
            "historical": historical_data or {},
        }

    @staticmethod
    def _fallback_consumption() -> dict[str, Any]:
        return {
            "patterns": {"daily_trend": "unknown", "weekly_trend": "unknown",
                         "anomalies_detected": False, "anomaly_details": []},
            "leak_detection": {"potential_leaks": False, "confidence_score": 0.0,
                               "estimated_loss_lpm": 0.0, "locations": []},
            "predictions": {"next_24h": 0.0, "next_7d": 0.0, "next_30d": 0.0, "peak_periods": []},
            "recommendations": {"immediate": ["AI advisory unavailable"], "preventive": [], "infrastructure": []},
            "risk_assessment": {"level": "medium", "risks": ["AI unavailable"], "mitigation": []},
            "summary": "AI advisory unavailable.",
        }

    @staticmethod
    def _fallback_quality() -> dict[str, Any]:
        return {
            "compliance_status": {"meets_standards": True, "violations": []},
            "drinkability": "monitoring",
            "health_risks": [],
            "recommendations": {"immediate": ["AI advisory unavailable"], "treatment": [], "longterm": []},
            "district_status": "yellow",
            "summary": "AI advisory unavailable.",
        }


def _num(v):
    return float(v) if isinstance(v, (int, float)) else None


claude_service = ClaudeService()
