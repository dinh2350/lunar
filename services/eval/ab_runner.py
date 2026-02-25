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
    judge_score: int
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
    winner: str
    categories: dict
    
def load_test_cases(path: str = "test_cases.json") -> list[dict]:
    with open(path) as f:
        return json.load(f)

async def run_variant(
    variant: Variant,
    test_cases: list[dict],
    judge_url: str = f"{GATEWAY_URL}/api/eval/judge"
) -> list[TestResult]:
    results = []
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        for tc in test_cases:
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
    print(f"\n{'='*60}")
    print(f"A/B TEST: {test.name}")
    print(f"Hypothesis: {test.hypothesis}")
    print(f"{'='*60}\n")
    
    all_cases = load_test_cases()
    if test.test_cases:
        cases = [tc for tc in all_cases if tc["id"] in test.test_cases]
    else:
        cases = all_cases
    
    print(f"Running {len(cases)} test cases...\n")
    
    print(f"▶ Variant A: {test.variant_a.name}")
    results_a = await run_variant(test.variant_a, cases)
    
    print(f"\n▶ Variant B: {test.variant_b.name}")
    results_b = await run_variant(test.variant_b, cases)
    
    score_a = sum(r.judge_score for r in results_a) / (len(results_a) * 5) * 100
    score_b = sum(r.judge_score for r in results_b) / (len(results_b) * 5) * 100
    
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
    
    output_path = Path(f"ab_results/{test.id}_{int(time.time())}.json")
    output_path.parent.mkdir(exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(asdict(result), f, indent=2)
    
    print_ab_summary(result)
    
    return result

def print_ab_summary(result: ABResult):
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


if __name__ == "__main__":
    import asyncio
    from ab_config import PROMPT_AB_TEST
    asyncio.run(run_ab_test(PROMPT_AB_TEST))
