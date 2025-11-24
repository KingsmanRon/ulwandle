"""
Claude AI Service for Predictive Analytics
Uses Anthropic's Claude API for water consumption predictions and anomaly detection
"""

import anthropic
from typing import List, Dict, Any, Optional
import json
import logging
from datetime import datetime, timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)


class ClaudeService:
    """Service for interacting with Claude AI"""

    def __init__(self):
        """Initialize Claude client"""
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = "claude-3-5-sonnet-20241022"

    async def analyze_consumption_patterns(
        self,
        district_name: str,
        flow_data: List[Dict[str, Any]],
        historical_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze water consumption patterns using Claude AI

        Args:
            district_name: Name of the district
            flow_data: Recent flow readings
            historical_data: Historical consumption data

        Returns:
            Analysis results with predictions
        """
        try:
            # Prepare data summary for Claude
            data_summary = self._prepare_data_summary(flow_data, historical_data)

            prompt = f"""You are an expert water infrastructure analyst for South Africa's municipal water systems. Analyze the following water consumption data for {district_name} district.

Data Summary:
{json.dumps(data_summary, indent=2)}

Please provide a comprehensive analysis including:

1. **Pattern Analysis:**
   - Identify consumption patterns (daily, weekly, seasonal)
   - Detect any unusual patterns or trends
   - Compare with typical consumption profiles

2. **Leak Detection:**
   - Identify potential leaks based on flow anomalies
   - Calculate estimated water loss if leaks detected
   - Provide confidence score for leak detection

3. **Predictions:**
   - Predict consumption for next 24 hours, 7 days, and 30 days
   - Identify peak demand periods
   - Forecast potential supply issues

4. **Recommendations:**
   - Immediate actions needed (if any)
   - Preventive measures
   - Infrastructure improvements

5. **Risk Assessment:**
   - Risk level (low, medium, high, critical)
   - Specific risks identified
   - Mitigation strategies

Please format your response as structured JSON with the following schema:
{{
    "patterns": {{
        "daily_trend": "string",
        "weekly_trend": "string",
        "anomalies_detected": boolean,
        "anomaly_details": ["string"]
    }},
    "leak_detection": {{
        "potential_leaks": boolean,
        "confidence_score": float,
        "estimated_loss_lpm": float,
        "locations": ["string"]
    }},
    "predictions": {{
        "next_24h": float,
        "next_7d": float,
        "next_30d": float,
        "peak_periods": ["string"]
    }},
    "recommendations": {{
        "immediate": ["string"],
        "preventive": ["string"],
        "infrastructure": ["string"]
    }},
    "risk_assessment": {{
        "level": "low|medium|high|critical",
        "risks": ["string"],
        "mitigation": ["string"]
    }},
    "summary": "string"
}}
"""

            # Call Claude API
            message = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.2,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Parse response
            response_text = message.content[0].text
            analysis_result = self._parse_claude_response(response_text)

            logger.info(f"Claude analysis completed for {district_name}")
            return analysis_result

        except Exception as e:
            logger.error(f"Error in Claude analysis: {str(e)}")
            return self._get_fallback_analysis()

    async def detect_water_quality_issues(
        self,
        district_name: str,
        quality_readings: List[Dict[str, Any]],
        compliance_standards: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze water quality data and detect compliance issues

        Args:
            district_name: Name of the district
            quality_readings: Recent water quality readings
            compliance_standards: SANS 241 standards

        Returns:
            Water quality analysis
        """
        try:
            prompt = f"""You are a water quality expert analyzing data for {district_name} district in South Africa.

Water Quality Readings:
{json.dumps(quality_readings, indent=2)}

Compliance Standards (SANS 241):
{json.dumps(compliance_standards, indent=2)}

Analyze the water quality data and provide:

1. **Compliance Status:**
   - Parameters within/outside acceptable ranges
   - Severity of any violations
   - Immediate health risks

2. **Trend Analysis:**
   - Quality trends over time
   - Deteriorating or improving parameters
   - Seasonal patterns

3. **Health Impact:**
   - Drinkability assessment (safe/monitoring/unsafe)
   - Specific health concerns
   - Affected population estimate

4. **Recommendations:**
   - Immediate actions (e.g., issue boil water advisory)
   - Treatment adjustments needed
   - Long-term improvements

Format response as JSON:
{{
    "compliance_status": {{
        "meets_standards": boolean,
        "violations": [{{
            "parameter": "string",
            "value": float,
            "standard": float,
            "severity": "low|medium|high"
        }}]
    }},
    "drinkability": "safe|monitoring|unsafe",
    "health_risks": ["string"],
    "recommendations": {{
        "immediate": ["string"],
        "treatment": ["string"],
        "longterm": ["string"]
    }},
    "district_status": "green|yellow|red",
    "summary": "string"
}}
"""

            message = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                temperature=0.1,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            response_text = message.content[0].text
            analysis_result = self._parse_claude_response(response_text)

            logger.info(f"Water quality analysis completed for {district_name}")
            return analysis_result

        except Exception as e:
            logger.error(f"Error in water quality analysis: {str(e)}")
            return self._get_fallback_quality_analysis()

    async def analyze_valve_operation_decision(
        self,
        valve_name: str,
        district_name: str,
        current_conditions: Dict[str, Any],
        reason: str
    ) -> Dict[str, Any]:
        """
        Analyze whether valve operation (kill switch) should be executed

        Args:
            valve_name: Name of the valve
            district_name: District name
            current_conditions: Current water system conditions
            reason: Reason for valve operation request

        Returns:
            Recommendation for valve operation
        """
        try:
            prompt = f"""You are a critical infrastructure analyst for South African water systems.
A Kill Switch (valve closure) has been requested for {valve_name} in {district_name}.

Reason: {reason}

Current Conditions:
{json.dumps(current_conditions, indent=2)}

Analyze and provide:

1. **Risk Assessment:**
   - Risks of closing valve (supply disruption)
   - Risks of keeping valve open
   - Population affected

2. **Recommendation:**
   - Should valve be closed? (yes/no/conditional)
   - Confidence level (0-100)
   - Conditions if conditional

3. **Impact Analysis:**
   - Estimated duration of closure
   - Affected population
   - Alternative supply options

4. **Action Plan:**
   - Pre-closure notifications
   - Employee dispatch requirements
   - Post-closure monitoring

Format as JSON:
{{
    "recommendation": "approve|deny|conditional",
    "confidence": float,
    "conditions": ["string"],
    "impact": {{
        "affected_population": int,
        "estimated_duration_hours": float,
        "severity": "low|medium|high|critical"
    }},
    "action_plan": {{
        "notifications": ["string"],
        "employee_dispatch": ["string"],
        "monitoring": ["string"]
    }},
    "summary": "string"
}}
"""

            message = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                temperature=0.1,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            response_text = message.content[0].text
            analysis_result = self._parse_claude_response(response_text)

            logger.info(f"Valve operation analysis completed for {valve_name}")
            return analysis_result

        except Exception as e:
            logger.error(f"Error in valve operation analysis: {str(e)}")
            return {
                "recommendation": "deny",
                "confidence": 0.0,
                "summary": "Error occurred during analysis. Manual review required."
            }

    def _prepare_data_summary(
        self,
        flow_data: List[Dict[str, Any]],
        historical_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Prepare data summary for Claude"""
        if not flow_data:
            return {}

        # Calculate basic statistics
        flow_rates = [d.get("flow_rate", 0) for d in flow_data]
        avg_flow = sum(flow_rates) / len(flow_rates) if flow_rates else 0
        max_flow = max(flow_rates) if flow_rates else 0
        min_flow = min(flow_rates) if flow_rates else 0

        summary = {
            "recent_readings": {
                "count": len(flow_data),
                "average_flow_lpm": round(avg_flow, 2),
                "max_flow_lpm": round(max_flow, 2),
                "min_flow_lpm": round(min_flow, 2),
                "timespan": "last 24 hours"
            },
            "sample_readings": flow_data[:10]  # First 10 readings
        }

        if historical_data:
            summary["historical"] = historical_data

        return summary

    def _parse_claude_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Claude's JSON response"""
        try:
            # Try to extract JSON from response
            # Claude might wrap JSON in markdown code blocks
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()

            return json.loads(response_text)

        except json.JSONDecodeError:
            logger.error("Failed to parse Claude response as JSON")
            return {
                "error": "Failed to parse response",
                "raw_response": response_text
            }

    def _get_fallback_analysis(self) -> Dict[str, Any]:
        """Fallback analysis when Claude API fails"""
        return {
            "patterns": {
                "daily_trend": "Unable to analyze",
                "anomalies_detected": False,
                "anomaly_details": []
            },
            "leak_detection": {
                "potential_leaks": False,
                "confidence_score": 0.0,
                "estimated_loss_lpm": 0.0
            },
            "predictions": {
                "next_24h": 0.0,
                "next_7d": 0.0,
                "next_30d": 0.0
            },
            "recommendations": {
                "immediate": ["Claude AI service unavailable - manual review recommended"]
            },
            "risk_assessment": {
                "level": "medium",
                "risks": ["AI analysis unavailable"]
            },
            "summary": "AI analysis service is currently unavailable. Please use manual analysis."
        }

    def _get_fallback_quality_analysis(self) -> Dict[str, Any]:
        """Fallback water quality analysis"""
        return {
            "compliance_status": {
                "meets_standards": True,
                "violations": []
            },
            "drinkability": "monitoring",
            "health_risks": [],
            "recommendations": {
                "immediate": ["AI analysis unavailable - manual review recommended"]
            },
            "district_status": "yellow",
            "summary": "AI analysis service is currently unavailable. Please use manual water quality assessment."
        }


# Singleton instance
claude_service = ClaudeService()
