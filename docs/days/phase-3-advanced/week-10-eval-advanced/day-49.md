# Day 49 — Custom Evaluation Metrics

> 🎯 **DAY GOAL:** Build custom metrics beyond pass/fail — latency, cost, tool efficiency, hallucination rate, and composite scoring

---

## 📚 CONCEPT 1: Beyond Pass/Fail

### WHAT — Simple Definition

**A single "score" doesn't tell the full story. Custom metrics measure SPECIFIC qualities: How fast? How expensive? Did it hallucinate? Did it use tools efficiently? Was the tone appropriate?**

```
BASIC EVAL:                          CUSTOM METRICS:
──────────                           ──────────────
Score: 85%                           Quality:     85%
                                     Latency:     1200ms (p50), 3400ms (p95)
That's it. 😐                        Cost:        $0.003/query
                                     Tool Efficiency: 92% (tools used correctly)
                                     Hallucination:   3% (fabricated info)
                                     Verbosity:   1.2x (slightly wordy)
                                     Tone Match:  94% (matches personality)
                                     
                                     Much more actionable! 🎯
```

### WHY — Different Metrics for Different Goals

```
SCENARIO 1: "Lunar is accurate but slow"
  → Quality metrics look great
  → But latency p95 is 8 seconds
  → Need to optimize: smaller model? fewer tool calls?

SCENARIO 2: "Lunar is fast but hallucinating"
  → Latency looks great
  → But hallucination rate is 12%
  → Need to: add RAG guardrails? lower temperature?

SCENARIO 3: "Lunar works but costs too much on Groq"
  → Everything looks good
  → But token cost per query is $0.02
  → Need to: trim context? use smaller model for simple queries?

ONE metric can't capture all of this.
```

---

## 🔨 HANDS-ON: Build Custom Metrics

### Step 1: Metrics Framework (20 minutes)

Create `services/eval/metrics.py`:

```python
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import re
import time

@dataclass
class MetricResult:
    name: str
    value: float
    unit: str
    rating: str      # "good" | "ok" | "bad"
    details: str = ""

class Metric(ABC):
    """Base class for custom metrics"""
    
    @abstractmethod
    def name(self) -> str: ...
    
    @abstractmethod
    def compute(self, test_input: str, output: str, metadata: dict) -> MetricResult: ...


class LatencyMetric(Metric):
    """Measure response time"""
    
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
    """Did the agent use tools correctly and efficiently?"""
    
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
        
        # Check: did it call the right tools?
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
    """Detect potential hallucinations by checking for fabricated details"""
    
    def name(self) -> str:
        return "hallucination"
    
    def compute(self, test_input: str, output: str, metadata: dict) -> MetricResult:
        known_facts = metadata.get("known_facts", [])
        
        # Heuristic checks for common hallucination patterns
        signals = []
        
        # 1. Confident false specifics (dates, numbers, names)
        if re.search(r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b', output):
            if not any(fact_type == "date" for fact_type, _ in known_facts):
                signals.append("Specific date without source")
        
        # 2. Made-up URLs
        url_pattern = r'https?://[^\s]+'
        urls = re.findall(url_pattern, output)
        if urls and not metadata.get("has_web_tool", False):
            signals.append(f"URLs without web access: {urls[:2]}")
        
        # 3. "As of [date]" claims
        if re.search(r'as of (January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}', output, re.I):
            signals.append("Temporal claim without source")
        
        # 4. Check against known facts if provided
        contradictions = 0
        for fact_type, fact_value in known_facts:
            if fact_value.lower() not in output.lower():
                if fact_type == "must_contain":
                    contradictions += 1
        
        # Score: 100 = no hallucination, 0 = definite hallucination
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
    """Is the response appropriately concise?"""
    
    def name(self) -> str:
        return "verbosity"
    
    def compute(self, test_input: str, output: str, metadata: dict) -> MetricResult:
        expected_length = metadata.get("expected_length", None)
        word_count = len(output.split())
        
        if expected_length:
            ratio = word_count / expected_length
        else:
            # Heuristic: simple questions should get concise answers
            input_words = len(test_input.split())
            if input_words < 10:
                ideal = 50  # Short questions → ~50 word answers
            else:
                ideal = 150  # Complex questions → ~150 word answers
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
    """Estimate token cost per query"""
    
    # Approximate costs per 1K tokens
    COSTS = {
        "ollama": 0.0,         # Free (local)
        "gemini": 0.0,         # Free tier
        "groq": 0.0,           # Free tier
        "openrouter": 0.002,   # ~$2/1M tokens
        "openai": 0.01,        # ~$10/1M tokens
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


# Registry of all metrics
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
    """Run all metrics on a single test case"""
    metrics = metrics or ALL_METRICS
    return [m.compute(test_input, output, metadata) for m in metrics]


def aggregate_metrics(all_results: list[list[MetricResult]]) -> dict:
    """Aggregate metrics across all test cases"""
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
```

### Step 2: Integrate with Eval Runner (10 minutes)

Update eval runner to compute custom metrics:

```python
# In services/eval/runner.py — add to run_single_test:

from metrics import compute_all_metrics, aggregate_metrics

async def run_single_test(test_case: dict) -> dict:
    """Run a single test case and compute all metrics"""
    start = time.time()
    
    # ... existing code to get response ...
    
    latency_ms = int((time.time() - start) * 1000)
    
    metadata = {
        "latency_ms": latency_ms,
        "tool_calls": response.get("tool_calls", []),
        "expected_tools": test_case.get("expected_tools", []),
        "provider": response.get("provider", "ollama"),
        "input_tokens": response.get("usage", {}).get("input_tokens", 0),
        "output_tokens": response.get("usage", {}).get("output_tokens", 0),
        "known_facts": test_case.get("known_facts", []),
    }
    
    metrics = compute_all_metrics(test_case["input"], output, metadata)
    
    return {
        **existing_result,
        "metrics": [{"name": m.name, "value": m.value, "unit": m.unit, "rating": m.rating} for m in metrics],
    }
```

### Step 3: Metrics Dashboard Panel (15 minutes)

```tsx
// In eval dashboard — add Metrics Summary component

function MetricsSummary({ metrics }: { metrics: Record<string, any> }) {
  const metricConfig: Record<string, { icon: string; goodRange: string }> = {
    latency: { icon: '⚡', goodRange: '< 2000ms' },
    tool_efficiency: { icon: '🔧', goodRange: '> 90%' },
    hallucination_safety: { icon: '🛡️', goodRange: '> 80%' },
    verbosity: { icon: '📝', goodRange: '0.5-1.5x' },
    cost: { icon: '💰', goodRange: '$0' },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 Custom Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(metrics).map(([name, data]) => {
            const config = metricConfig[name] || { icon: '📊', goodRange: '' };
            return (
              <div key={name} className="text-center p-3 rounded-lg border">
                <p className="text-2xl">{config.icon}</p>
                <p className="font-bold text-lg">{data.median}{name === 'cost' ? '' : ''}</p>
                <p className="text-xs text-muted-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">
                  p95: {data.p95}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## ✅ CHECKLIST

- [ ] Metrics framework with base class
- [ ] Latency metric (good/ok/bad thresholds)
- [ ] Tool efficiency metric (correct, unnecessary, missed)
- [ ] Hallucination detection metric
- [ ] Verbosity metric (word count ratio)
- [ ] Cost estimation metric
- [ ] Aggregation (mean, median, p95)
- [ ] Integrated into eval runner
- [ ] Metrics summary in dashboard

---

## 💡 KEY TAKEAWAY

**Custom metrics transform eval from "did it pass?" to "HOW did it perform?" Latency tells you about speed. Tool efficiency tells you about intelligence. Hallucination rate tells you about trustworthiness. Cost tells you about sustainability. Together, they give a complete picture. AI companies track 10-20 custom metrics per model — start with 5 and add more as needed.**

---

**Next → [Day 50: Eval Best Practices + Week 10 Wrap](day-50.md)**
