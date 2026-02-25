"""Automated evaluation runner — runs test dataset through eval endpoints."""
import asyncio
import json
import httpx
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel

EVAL_URL = "http://localhost:8000"
LUNAR_URL = "http://localhost:3100"

class TestCase(BaseModel):
    id: str
    category: str
    question: str
    expected_answer: str
    context: list[str] | None = None
    min_score: float = 0.7
    eval_type: str = "quality"  # quality | safety

class TestResult(BaseModel):
    test_id: str
    category: str
    question: str
    agent_answer: str
    scores: list[dict]
    overall_score: float
    passed: bool
    min_score: float

async def get_agent_answer(client: httpx.AsyncClient, question: str) -> str:
    """Call Lunar agent to get an answer."""
    try:
        resp = await client.post(
            f"{LUNAR_URL}/api/chat",
            json={"message": question},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()["response"]
    except Exception as e:
        return f"[ERROR: {e}]"

async def evaluate_answer(
    client: httpx.AsyncClient,
    question: str,
    answer: str,
    context: list[str] | None = None,
    expected: str | None = None,
) -> dict:
    """Call eval service to score the answer."""
    resp = await client.post(
        f"{EVAL_URL}/eval/judge",
        json={
            "question": question,
            "answer": answer,
            "context": context,
            "expected_answer": expected,
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.json()

async def run_eval(dataset_path: str) -> list[TestResult]:
    """Run all test cases and collect results."""
    # Load dataset
    with open(dataset_path) as f:
        test_cases = [TestCase(**tc) for tc in json.load(f)]
    
    print(f"\n{'='*60}")
    print(f"  LUNAR EVAL RUN — {len(test_cases)} test cases")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    results: list[TestResult] = []
    
    async with httpx.AsyncClient() as client:
        for i, tc in enumerate(test_cases, 1):
            print(f"[{i}/{len(test_cases)}] {tc.id}: {tc.question[:50]}...")
            
            # Get agent answer
            answer = await get_agent_answer(client, tc.question)
            print(f"  Agent: {answer[:80]}...")
            
            # Evaluate
            eval_result = await evaluate_answer(
                client, tc.question, answer, tc.context, tc.expected_answer
            )
            
            overall = eval_result["overall"]
            passed = overall >= tc.min_score
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"  Score: {overall:.3f} (min: {tc.min_score}) {status}")
            
            results.append(TestResult(
                test_id=tc.id,
                category=tc.category,
                question=tc.question,
                agent_answer=answer,
                scores=eval_result["scores"],
                overall_score=overall,
                passed=passed,
                min_score=tc.min_score,
            ))
            print()
    
    return results

def print_report(results: list[TestResult]):
    """Print a summary report."""
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    avg_score = sum(r.overall_score for r in results) / max(total, 1)
    
    print(f"\n{'='*60}")
    print(f"  EVAL REPORT")
    print(f"{'='*60}")
    print(f"  Total:   {total}")
    print(f"  Passed:  {passed}/{total} ({passed/total*100:.0f}%)")
    print(f"  Failed:  {total-passed}/{total}")
    print(f"  Average: {avg_score:.3f}")
    print()
    
    # By category
    categories = set(r.category for r in results)
    for cat in sorted(categories):
        cat_results = [r for r in results if r.category == cat]
        cat_pass = sum(1 for r in cat_results if r.passed)
        cat_avg = sum(r.overall_score for r in cat_results) / len(cat_results)
        print(f"  {cat:15s}  {cat_pass}/{len(cat_results)} passed  avg: {cat_avg:.3f}")
    
    # Worst results
    failures = [r for r in results if not r.passed]
    if failures:
        print(f"\n  FAILURES:")
        for r in failures:
            print(f"    {r.test_id}: score={r.overall_score:.3f} (min={r.min_score})")
            print(f"      Q: {r.question[:60]}")
            print(f"      A: {r.agent_answer[:60]}")
    
    print(f"{'='*60}\n")
    
    # Save report
    report_dir = Path("reports")
    report_dir.mkdir(exist_ok=True)
    report_file = report_dir / f"eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, "w") as f:
        json.dump([r.model_dump() for r in results], f, indent=2)
    print(f"  Report saved: {report_file}")

async def main():
    results = await run_eval("datasets/lunar_basic.json")
    print_report(results)

if __name__ == "__main__":
    asyncio.run(main())
