from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import re
import time

@dataclass
class MetricResult:
    name: str
    value: float
    unit: str
    rating: str
    details: str = ""

class Metric(ABC):
    @abstractmethod
    def name(self) -> str: ...
    
    @abstractmethod
    def compute(self, test_input: str, output: str, metadata: dict) -> MetricResult: ...


class LatencyMetric(Metric):
    def name(self) -> str:
        return "latency"
    
    def compute(self, test_input: str, output: str, metadata: dict) -> MetricResult:
        ms = metadata.get("latency_ms", 0)
        
        if ms < 2000:
            rating = "good"
        elif ms < 5000:
            rating = "ok"
        else:
            rating = "bad"
        
        return MetricResult(
            name="latency",
            value=ms,
            unit="ms",
            rating=rating,
            details=f"Time to complete: {ms}ms"
        )


class ToolEfficiencyMetric(Metric):
    def name(self) -> str:
        return "tool_efficiency"
    
    def compute(self, test_input: str, output: str, metadata: dict) -> MetricResult:
        tool_calls = metadata.get("tool_calls", [])
        expected_tools = metadata.get("expected_tools", [])
        
        if not expected_tools and not tool_calls:
            return MetricResult("tool_efficiency", 100, "%", "good", "No tools needed or used")
        
        if not expected_tools and tool_calls:
            return MetricResult("tool_efficiency", 50, "%", "ok", 
                              f"Used {len(tool_calls)} tools when none expected")
        
        expected_names = set(expected_tools)
        actual_names = set(tc.get("name", "") for tc in tool_calls)
        
        correct = len(expected_names & actual_names)
        unnecessary = len(actual_names - expected_names)
        missed = len(expected_names - actual_names)
        
        total = len(expected_names)
        score = max(0, (correct - unnecessary * 0.5) / total * 100) if total > 0 else 0
        
        if score >= 90:
            rating = "good"
        elif score >= 60:
            rating = "ok"
        else:
            rating = "bad"
        
        return MetricResult(
            name="tool_efficiency",
            value=round(score, 1),
            unit="%",
            rating=rating,
            details=f"Correct: {correct}, Unnecessary: {unnecessary}, Missed: {missed}"
        )


class HallucinationMetric(Metric):
    def name(self) -> str:
        return "hallucination"
    
    def compute(self, test_input: str, output: str, metadata: dict) -> MetricResult:
        known_facts = metadata.get("known_facts", [])
        
        signals = []
        
        if re.search(r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b', output):
            if not any(fact_type == "date" for fact_type, _ in known_facts):
                signals.append("Specific date without source")
        
        url_pattern = r'https?://[^\s]+'
        urls = re.findall(url_pattern, output)
        if urls and not metadata.get("has_web_tool", False):
            signals.append(f"URLs without web access: {urls[:2]}")
        
        if re.search(r'as of (January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}', output, re.I):
            signals.append("Temporal claim without source")
        
        contradictions = 0
        for fact_type, fact_value in known_facts:
            if fact_value.lower() not in output.lower():
                if fact_type == "must_contain":
                    contradictions += 1
        
        penalty = len(signals) * 20 + contradictions * 30
        score = max(0, 100 - penalty)
        
        if score >= 80:
            rating = "good"
        elif score >= 50:
            rating = "ok"
        else:
            rating = "bad"
        
        return MetricResult(
            name="hallucination_safety",
            value=round(score, 1),
            unit="%",
            rating=rating,
            details="; ".join(signals) if signals else "No hallucination signals detected"
        )


class VerbosityMetric(Metric):
    def name(self) -> str:
        return "verbosity"
    
    def compute(self, test_input: str, output: str, metadata: dict) -> MetricResult:
        expected_length = metadata.get("expected_length", None)
        word_count = len(output.split())
        
        if expected_length:
            ratio = word_count / expected_length
        else:
            input_words = len(test_input.split())
            if input_words < 10:
                ideal = 50
            else:
                ideal = 150
            ratio = word_count / ideal
        
        if 0.5 <= ratio <= 1.5:
            rating = "good"
        elif 0.3 <= ratio <= 2.0:
            rating = "ok"
        else:
            rating = "bad"
        
        return MetricResult(
            name="verbosity",
            value=round(ratio, 2),
            unit="x",
            rating=rating,
            details=f"{word_count} words (ratio: {ratio:.2f}x ideal)"
        )


class CostMetric(Metric):
    COSTS = {
        "ollama": 0.0,
        "gemini": 0.0,
        "groq": 0.0,
        "openrouter": 0.002,
        "openai": 0.01,
    }
    
    def name(self) -> str:
        return "cost"
    
    def compute(self, test_input: str, output: str, metadata: dict) -> MetricResult:
        provider = metadata.get("provider", "ollama")
        input_tokens = metadata.get("input_tokens", 0)
        output_tokens = metadata.get("output_tokens", 0)
        total_tokens = input_tokens + output_tokens
        
        cost_per_1k = self.COSTS.get(provider, 0.0)
        cost = (total_tokens / 1000) * cost_per_1k
        
        if cost == 0:
            rating = "good"
        elif cost < 0.01:
            rating = "ok"
        else:
            rating = "bad"
        
        return MetricResult(
            name="cost",
            value=round(cost, 6),
            unit="$",
            rating=rating,
            details=f"{total_tokens} tokens × ${cost_per_1k}/1K ({provider})"
        )


ALL_METRICS: list[Metric] = [
    LatencyMetric(),
    ToolEfficiencyMetric(),
    HallucinationMetric(),
    VerbosityMetric(),
    CostMetric(),
]

def compute_all_metrics(
    test_input: str,
    output: str,
    metadata: dict,
    metrics: list[Metric] | None = None
) -> list[MetricResult]:
    metrics = metrics or ALL_METRICS
    return [m.compute(test_input, output, metadata) for m in metrics]


def aggregate_metrics(all_results: list[list[MetricResult]]) -> dict:
    from statistics import mean, median
    
    by_name: dict[str, list[float]] = {}
    for results in all_results:
        for r in results:
            by_name.setdefault(r.name, []).append(r.value)
    
    summary = {}
    for name, values in by_name.items():
        summary[name] = {
            "mean": round(mean(values), 2),
            "median": round(median(values), 2),
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "p95": round(sorted(values)[int(len(values) * 0.95)], 2) if len(values) >= 5 else round(max(values), 2),
        }
    
    return summary
