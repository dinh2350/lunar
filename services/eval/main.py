"""
Lunar Eval Service — Python microservice for AI quality evaluation.
Called by Lunar (TypeScript) via HTTP to evaluate agent responses.
"""
from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(
    title="Lunar Eval Service",
    description="AI response quality evaluation",
    version="0.1.0",
)

# ---- Request/Response Models (= TypeScript interfaces) ----

class EvalRequest(BaseModel):
    """Input for evaluation — question + answer from Lunar agent."""
    question: str
    answer: str
    context: list[str] | None = None       # retrieved docs (for RAG eval)
    expected_answer: str | None = None      # ground truth (for accuracy eval)
    conversation: list[dict] | None = None  # full conversation (for coherence)

class EvalScore(BaseModel):
    """A single evaluation metric."""
    name: str
    score: float          # 0.0 to 1.0
    reason: str           # why this score

class EvalResponse(BaseModel):
    """Output — list of scores + overall."""
    scores: list[EvalScore]
    overall: float
    evaluated_at: str

# ---- Evaluation Logic ----

def eval_answer_relevancy(question: str, answer: str) -> EvalScore:
    """Does the answer actually address the question?"""
    # Simple heuristic for now — will add LLM-as-judge later
    q_words = set(question.lower().split())
    a_words = set(answer.lower().split())
    overlap = len(q_words & a_words) / max(len(q_words), 1)
    score = min(1.0, overlap * 2)  # scale up
    return EvalScore(
        name="answer_relevancy",
        score=round(score, 3),
        reason=f"{len(q_words & a_words)} word overlap between Q and A"
    )

def eval_faithfulness(answer: str, context: list[str]) -> EvalScore:
    """Is the answer grounded in the retrieved context?"""
    if not context:
        return EvalScore(name="faithfulness", score=0.0, reason="No context provided")
    
    context_text = " ".join(context).lower()
    a_words = answer.lower().split()
    grounded = sum(1 for w in a_words if w in context_text)
    score = grounded / max(len(a_words), 1)
    return EvalScore(
        name="faithfulness",
        score=round(score, 3),
        reason=f"{grounded}/{len(a_words)} answer words found in context"
    )

def eval_completeness(answer: str) -> EvalScore:
    """Is the answer sufficiently detailed?"""
    word_count = len(answer.split())
    if word_count < 5:
        score = 0.2
        reason = "Very short answer"
    elif word_count < 20:
        score = 0.5
        reason = "Brief answer"
    elif word_count < 100:
        score = 0.8
        reason = "Good length"
    else:
        score = 1.0
        reason = "Comprehensive answer"
    return EvalScore(name="completeness", score=score, reason=reason)

# ---- Routes ----

@app.get("/health")
async def health():
    return {"status": "ok", "service": "lunar-eval", "version": "0.1.0"}

@app.post("/eval/answer", response_model=EvalResponse)
async def evaluate_answer(req: EvalRequest) -> EvalResponse:
    """Evaluate a single Q&A pair."""
    scores = [
        eval_answer_relevancy(req.question, req.answer),
        eval_completeness(req.answer),
    ]
    
    # Add faithfulness if context is provided
    if req.context:
        scores.append(eval_faithfulness(req.answer, req.context))
    
    overall = sum(s.score for s in scores) / len(scores)
    
    return EvalResponse(
        scores=scores,
        overall=round(overall, 3),
        evaluated_at=datetime.now().isoformat(),
    )

@app.post("/eval/batch", response_model=list[EvalResponse])
async def evaluate_batch(requests: list[EvalRequest]) -> list[EvalResponse]:
    """Evaluate multiple Q&A pairs at once."""
    results = []
    for req in requests:
        result = await evaluate_answer(req)
        results.append(result)
    return results
