# Day 47 — A/B Testing Framework

> 🎯 **DAY GOAL:** Build an A/B testing system to compare prompt variations, models, and configurations — measure which performs better with data

---

## 📚 CONCEPT 1: A/B Testing for AI

### WHAT — Simple Definition

**Run the same evaluation questions through TWO different configurations (prompt A vs prompt B, model A vs model B) and statistically compare which one performs better.**

```
A/B TEST: "Which system prompt is better?"

VARIANT A (Current):                   VARIANT B (New):
"You are Lunar, a helpful             "You are Lunar, an AI with 
 AI assistant."                         perfect memory. Always check
                                        memory before answering."

Run SAME 50 test cases through both:

RESULTS:
               Variant A    Variant B
Factual:        85%          88%      ← B slightly better
Tool Usage:     90%          95%      ← B much better (checks memory!)
Conversation:   92%          87%      ← A better (B too tool-heavy)
Overall:        87%          90%      ← B wins overall ✅

DECISION: Use Variant B, but tweak to be less tool-heavy
```

### WHY — Stop Guessing, Start Measuring

```
WITHOUT A/B TESTING:
  "I think this prompt is better" → vibes-based development
  "Let me try this model" → no way to compare fairly
  "I changed the RAG config" → did it actually help?

WITH A/B TESTING:
  "Variant B scores 3% higher with p-value 0.04" → data-driven
  "Model X is 12% better at tool usage" → specific insight
  "New RAG config improved memory recall by 8%" → measurable
```

### 🔗 NODE.JS ANALOGY

```
// A/B testing = load testing with comparison

// Web dev A/B test:
//   "Does button color affect click rate?"
//   → Show red button to 50% users, blue to 50%
//   → Measure click rate for each

// AI A/B test:
//   "Does prompt wording affect accuracy?"
//   → Run same questions with prompt A and prompt B
//   → Measure eval score for each
```

---

## 🔨 HANDS-ON: Build A/B Test Runner

### Step 1: A/B Test Configuration (10 minutes)

Create `services/eval/ab_config.py`:

```python
from dataclasses import dataclass, field
from typing import Any

@dataclass
class Variant:
    """One side of an A/B test"""
    name: str
    description: str
    config: dict[str, Any]
    # Config can override: model, system_prompt, temperature,
    # memory settings, tool settings, etc.

@dataclass
class ABTest:
    """Definition of an A/B test"""
    id: str
    name: str
    hypothesis: str  # "Variant B will score higher because..."
    variant_a: Variant
    variant_b: Variant
    test_cases: list[str] = field(default_factory=list)  # test case IDs
    
    # If empty, run ALL test cases

# Example A/B tests
PROMPT_AB_TEST = ABTest(
    id="prompt-memory-v1",
    name="Memory-aware prompt vs default",
    hypothesis="Adding memory instructions will improve tool usage",
    variant_a=Variant(
        name="default",
        description="Current system prompt",
        config={
            "system_prompt": "You are Lunar, a helpful AI assistant.",
        }
    ),
    variant_b=Variant(
        name="memory-aware",
        description="Prompt that emphasizes memory usage",
        config={
            "system_prompt": (
                "You are Lunar, an AI assistant with persistent memory. "
                "Always search your memory before answering questions about "
                "the user. Use tools proactively to provide accurate information."
            ),
        }
    ),
)

MODEL_AB_TEST = ABTest(
    id="model-qwen-vs-gemma",
    name="Qwen 2.5 7B vs Gemma 2 9B",
    hypothesis="Gemma 2 will be better at conversation but worse at tool usage",
    variant_a=Variant(
        name="qwen2.5:3b",
        description="Default Qwen model",
        config={"model": "qwen2.5:3b"}
    ),
    variant_b=Variant(
        name="gemma2:9b",
        description="Google Gemma 2 model",
        config={"model": "gemma2:9b"}
    ),
)

TEMPERATURE_AB_TEST = ABTest(
    id="temp-low-vs-high",
    name="Temperature 0.3 vs 0.7",
    hypothesis="Lower temperature will improve factual accuracy but hurt creativity",
    variant_a=Variant(
        name="temp-0.3",
        description="Low temperature (more precise)",
        config={"temperature": 0.3}
    ),
    variant_b=Variant(
        name="temp-0.7",
        description="Higher temperature (more creative)",
        config={"temperature": 0.7}
    ),
)
```

### Step 2: A/B Test Runner (25 minutes)

Create `services/eval/ab_runner.py`:

```python
import json
import time
import httpx
from datetime import datetime
from dataclasses import dataclass, asdict
from ab_config import ABTest, Variant
from pathlib import Path

GATEWAY_URL = "http://localhost:3100"

@dataclass
class TestResult:
    test_id: str
    variant: str
    input_text: str
    output: str
    judge_score: int  # 1-5
    judge_reason: str
    latency_ms: int
    tool_calls: int
    category: str

@dataclass
class ABResult:
    test_id: str
    timestamp: str
    test_name: str
    hypothesis: str
    variant_a_name: str
    variant_b_name: str
    variant_a_score: float
    variant_b_score: float
    variant_a_results: list[TestResult]
    variant_b_results: list[TestResult]
    winner: str  # "a", "b", or "tie"
    categories: dict  # per-category comparison
    
def load_test_cases(path: str = "test_cases.json") -> list[dict]:
    """Load evaluation test cases"""
    with open(path) as f:
        return json.load(f)

async def run_variant(
    variant: Variant,
    test_cases: list[dict],
    judge_url: str = f"{GATEWAY_URL}/api/eval/judge"
) -> list[TestResult]:
    """Run all test cases through one variant"""
    results = []
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        for tc in test_cases:
            # Apply variant config
            start = time.time()
            
            response = await client.post(
                f"{GATEWAY_URL}/api/chat",
                json={
                    "message": tc["input"],
                    "config_override": variant.config,
                    "session_id": f"ab-test-{variant.name}-{tc['id']}",
                }
            )
            
            latency_ms = int((time.time() - start) * 1000)
            data = response.json()
            output = data.get("response", "")
            tool_calls = len(data.get("tool_calls", []))
            
            # Judge the response
            judge_response = await client.post(
                f"{GATEWAY_URL}/api/eval/judge",
                json={
                    "input": tc["input"],
                    "output": output,
                    "expected": tc.get("expected", ""),
                    "rubric": tc.get("rubric", ""),
                }
            )
            judge = judge_response.json()
            
            results.append(TestResult(
                test_id=tc["id"],
                variant=variant.name,
                input_text=tc["input"],
                output=output,
                judge_score=judge.get("score", 0),
                judge_reason=judge.get("reason", ""),
                latency_ms=latency_ms,
                tool_calls=tool_calls,
                category=tc.get("category", "general"),
            ))
            
            print(f"  {variant.name} | {tc['id']}: {judge.get('score', 0)}/5 ({latency_ms}ms)")
    
    return results

async def run_ab_test(test: ABTest) -> ABResult:
    """Run a complete A/B test"""
    print(f"\n{'='*60}")
    print(f"A/B TEST: {test.name}")
    print(f"Hypothesis: {test.hypothesis}")
    print(f"{'='*60}\n")
    
    # Load test cases
    all_cases = load_test_cases()
    if test.test_cases:
        cases = [tc for tc in all_cases if tc["id"] in test.test_cases]
    else:
        cases = all_cases
    
    print(f"Running {len(cases)} test cases...\n")
    
    # Run Variant A
    print(f"▶ Variant A: {test.variant_a.name}")
    results_a = await run_variant(test.variant_a, cases)
    
    # Run Variant B
    print(f"\n▶ Variant B: {test.variant_b.name}")
    results_b = await run_variant(test.variant_b, cases)
    
    # Calculate scores
    score_a = sum(r.judge_score for r in results_a) / (len(results_a) * 5) * 100
    score_b = sum(r.judge_score for r in results_b) / (len(results_b) * 5) * 100
    
    # Per-category comparison
    categories = {}
    for cat in set(r.category for r in results_a):
        cat_a = [r for r in results_a if r.category == cat]
        cat_b = [r for r in results_b if r.category == cat]
        sa = sum(r.judge_score for r in cat_a) / (len(cat_a) * 5) * 100
        sb = sum(r.judge_score for r in cat_b) / (len(cat_b) * 5) * 100
        categories[cat] = {
            "variant_a": round(sa, 1),
            "variant_b": round(sb, 1),
            "delta": round(sb - sa, 1),
            "winner": "b" if sb > sa else "a" if sa > sb else "tie",
        }
    
    # Determine winner
    if score_b - score_a > 2:
        winner = "b"
    elif score_a - score_b > 2:
        winner = "a"
    else:
        winner = "tie"
    
    result = ABResult(
        test_id=test.id,
        timestamp=datetime.now().isoformat(),
        test_name=test.name,
        hypothesis=test.hypothesis,
        variant_a_name=test.variant_a.name,
        variant_b_name=test.variant_b.name,
        variant_a_score=round(score_a, 1),
        variant_b_score=round(score_b, 1),
        variant_a_results=results_a,
        variant_b_results=results_b,
        winner=winner,
        categories=categories,
    )
    
    # Save results
    output_path = Path(f"ab_results/{test.id}_{int(time.time())}.json")
    output_path.parent.mkdir(exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(asdict(result), f, indent=2)
    
    # Print summary
    print_ab_summary(result)
    
    return result

def print_ab_summary(result: ABResult):
    """Pretty-print A/B test results"""
    print(f"\n{'='*60}")
    print(f"RESULTS: {result.test_name}")
    print(f"{'='*60}")
    print(f"  Variant A ({result.variant_a_name}): {result.variant_a_score}%")
    print(f"  Variant B ({result.variant_b_name}): {result.variant_b_score}%")
    print(f"  Winner: {'Variant ' + result.winner.upper() if result.winner != 'tie' else 'TIE'}")
    print()
    print("  Per Category:")
    for cat, data in result.categories.items():
        arrow = "→" if data["winner"] == "tie" else ("↑B" if data["winner"] == "b" else "↑A")
        print(f"    {cat:20s}  A: {data['variant_a']:5.1f}%  B: {data['variant_b']:5.1f}%  {arrow} ({data['delta']:+.1f}%)")
    print()
    print(f"  Hypothesis: {result.hypothesis}")
    print(f"  Verdict: {'CONFIRMED' if result.winner == 'b' else 'REJECTED' if result.winner == 'a' else 'INCONCLUSIVE'}")


# CLI entry point
if __name__ == "__main__":
    import asyncio
    from ab_config import PROMPT_AB_TEST
    asyncio.run(run_ab_test(PROMPT_AB_TEST))
```

### Step 3: A/B Results Viewer Component (20 minutes)

Create `apps/control/src/components/ab-test-viewer.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ABResult {
  test_id: string;
  test_name: string;
  hypothesis: string;
  variant_a_name: string;
  variant_b_name: string;
  variant_a_score: number;
  variant_b_score: number;
  winner: 'a' | 'b' | 'tie';
  categories: Record<string, {
    variant_a: number;
    variant_b: number;
    delta: number;
    winner: string;
  }>;
  timestamp: string;
}

export function ABTestViewer() {
  const [results, setResults] = useState<ABResult[]>([]);
  const [selected, setSelected] = useState<ABResult | null>(null);

  useEffect(() => {
    fetch('/api/eval/ab-tests')
      .then(r => r.json())
      .then(data => {
        setResults(data.results || []);
        if (data.results?.length) setSelected(data.results[0]);
      });
  }, []);

  if (!selected) return <p>No A/B test results yet. Run one from CLI first.</p>;

  const maxScore = Math.max(selected.variant_a_score, selected.variant_b_score);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">🔬 A/B Test: {selected.test_name}</h3>
      <p className="text-sm text-muted-foreground italic">
        Hypothesis: {selected.hypothesis}
      </p>

      {/* Score Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <Card className={selected.winner === 'a' ? 'border-green-500 border-2' : ''}>
          <CardContent className="pt-4 text-center">
            <p className="text-sm">Variant A: {selected.variant_a_name}</p>
            <p className="text-4xl font-bold">{selected.variant_a_score}%</p>
            {selected.winner === 'a' && <Badge className="bg-green-500 mt-2">WINNER</Badge>}
          </CardContent>
        </Card>
        <Card className={selected.winner === 'b' ? 'border-green-500 border-2' : ''}>
          <CardContent className="pt-4 text-center">
            <p className="text-sm">Variant B: {selected.variant_b_name}</p>
            <p className="text-4xl font-bold">{selected.variant_b_score}%</p>
            {selected.winner === 'b' && <Badge className="bg-green-500 mt-2">WINNER</Badge>}
          </CardContent>
        </Card>
      </div>

      {/* Category Comparison Bars */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(selected.categories).map(([cat, data]) => (
            <div key={cat}>
              <div className="flex justify-between text-sm mb-1">
                <span>{cat}</span>
                <span className={data.delta > 0 ? 'text-green-600' : data.delta < 0 ? 'text-red-600' : ''}>
                  {data.delta > 0 ? '+' : ''}{data.delta}%
                </span>
              </div>
              <div className="flex gap-1 h-6">
                <div
                  className="bg-blue-500 rounded-l flex items-center justify-end pr-1 text-xs text-white"
                  style={{ width: `${(data.variant_a / maxScore) * 50}%` }}
                >
                  {data.variant_a}%
                </div>
                <div
                  className="bg-orange-500 rounded-r flex items-center pl-1 text-xs text-white"
                  style={{ width: `${(data.variant_b / maxScore) * 50}%` }}
                >
                  {data.variant_b}%
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-blue-500 rounded" /> Variant A
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-orange-500 rounded" /> Variant B
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## ✅ CHECKLIST

- [ ] A/B test config with variants
- [ ] Runner executes both variants on same test cases
- [ ] Judge scores each response
- [ ] Per-category comparison
- [ ] Winner determination
- [ ] Results saved to JSON
- [ ] Visual comparison in dashboard

---

## 💡 KEY TAKEAWAY

**A/B testing replaces "I think this is better" with "the data shows this is better." By running the same test cases through two configurations, you get fair, comparable results. This is exactly how AI teams at companies like OpenAI, Anthropic, and Google make prompt and model decisions. Adding this to Lunar shows you understand production AI development.**

---

**Next → [Day 48: Regression Detection](day-48.md)**
