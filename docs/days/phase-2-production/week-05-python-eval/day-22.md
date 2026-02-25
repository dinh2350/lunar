# Day 22 — FastAPI: Your First Python API Server

> 🎯 **DAY GOAL:** Build the Eval Service with FastAPI — a Python version of Fastify that Lunar calls for quality evaluation

---

## 📚 CONCEPT 1: What is FastAPI?

### WHAT — Simple Definition

**FastAPI is Python's Fastify.** It's a web framework that's fast, type-safe, and auto-generates docs.

### Fastify ↔ FastAPI

| Feature | Fastify (Node.js) | FastAPI (Python) |
|---|---|---|
| Create app | `Fastify()` | `FastAPI()` |
| Route | `app.get('/path', handler)` | `@app.get("/path")` |
| Request body | `req.body` | Function parameter with type |
| Validation | JSON Schema | Pydantic model (auto!) |
| Auto docs | Swagger plugin | Built-in at `/docs` |
| Run | `app.listen({ port })` | `uvicorn app:app --port` |

### WHY — Why Not Just Use Fastify?

```
DeepEval (evaluation library) = Python only
RAGAS (RAG evaluation) = Python only
scikit-learn (ML metrics) = Python only

Instead of reimplementing these in TypeScript:
  → Build a small Python API service
  → Lunar calls it via HTTP
  → Best tool for each job
```

### 🔗 NODE.JS ANALOGY

```typescript
// Fastify (Node.js)
import Fastify from 'fastify';
const app = Fastify();
app.get('/health', async () => ({ status: 'ok' }));
app.post('/eval', async (req) => {
  const { question, answer } = req.body;
  return { score: 0.85 };
});
app.listen({ port: 8000 });
```

```python
# FastAPI (Python) — almost identical!
from fastapi import FastAPI
app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/eval")
async def evaluate(question: str, answer: str):
    return {"score": 0.85}

# Run: uvicorn main:app --port 8000
```

---

## 📚 CONCEPT 2: Pydantic — TypeScript Interfaces for Python

### WHAT — Simple Definition

**Pydantic models are Python's equivalent of TypeScript interfaces + zod validation combined.** They define the shape of data AND validate it at runtime.

### HOW — Side by Side

```typescript
// TypeScript + Zod
import { z } from 'zod';

const EvalRequest = z.object({
  question: z.string(),
  answer: z.string(),
  context: z.array(z.string()).optional(),
  expectedAnswer: z.string().optional(),
});

type EvalRequest = z.infer<typeof EvalRequest>;
```

```python
# Python + Pydantic
from pydantic import BaseModel

class EvalRequest(BaseModel):
    question: str
    answer: str
    context: list[str] | None = None     # optional with default
    expected_answer: str | None = None

# Usage:
req = EvalRequest(question="What is RAG?", answer="Retrieval Augmented Generation")
print(req.model_dump())  # → dict (like .toJSON())
```

### WHY — Why Pydantic?

```
Without Pydantic:
  ❌ No validation (any dict accepted)
  ❌ No autocomplete in editors
  ❌ Errors at runtime deep in code

With Pydantic:
  ✅ Validates on creation (like zod.parse)
  ✅ Auto-generates OpenAPI schema
  ✅ Editor autocomplete for fields
  ✅ FastAPI uses it for request/response types
```

---

## 🔨 HANDS-ON: Build the Eval Service

### Step 1: Install Dependencies (5 minutes)

```bash
cd ~/Documents/project/lunar/services/eval
source .venv/bin/activate

# Install FastAPI + server
pip install fastapi uvicorn pydantic

# Save dependencies (= like package.json)
pip freeze > requirements.txt
```

### Step 2: Create the Eval Service (40 minutes)

Create `services/eval/main.py`:

```python
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
```

### Step 3: Run and Test (10 minutes)

```bash
# Start the eval service
uvicorn main:app --reload --port 8000
# INFO:     Uvicorn running on http://0.0.0.0:8000

# In another terminal, test:

# Health check
curl http://localhost:8000/health
# {"status":"ok","service":"lunar-eval","version":"0.1.0"}

# Evaluate an answer
curl -X POST http://localhost:8000/eval/answer \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is RAG?",
    "answer": "RAG is Retrieval Augmented Generation. It retrieves relevant documents and uses them as context for the LLM to generate grounded answers.",
    "context": ["RAG combines retrieval with generation for grounded AI responses"]
  }'
```

### Step 4: Auto-Generated Docs (2 minutes)

Open `http://localhost:8000/docs` in your browser!

FastAPI automatically generates interactive Swagger docs — you can test endpoints right in the browser. This is built-in (no plugin needed, unlike Fastify).

### Step 5: Call from Lunar (10 minutes)

Add TypeScript client in `packages/tools/src/eval-client.ts`:

```typescript
interface EvalResult {
  scores: { name: string; score: number; reason: string }[];
  overall: number;
  evaluated_at: string;
}

export async function evaluateAnswer(
  question: string,
  answer: string,
  context?: string[]
): Promise<EvalResult> {
  const res = await fetch('http://localhost:8000/eval/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer, context }),
  });

  if (!res.ok) throw new Error(`Eval service error: ${res.status}`);
  return res.json() as Promise<EvalResult>;
}
```

---

## ✅ CHECKLIST

- [ ] FastAPI installed in virtual environment
- [ ] Eval service runs on port 8000
- [ ] `/health` endpoint works
- [ ] `/eval/answer` returns scores
- [ ] Auto-docs visible at `/docs`
- [ ] TypeScript client can call eval service
- [ ] Understand: Pydantic = zod + TypeScript interface

---

## 💡 KEY TAKEAWAY

**FastAPI is Fastify for Python. Pydantic types give you zod-like validation with zero boilerplate. The eval service is a clean microservice — Lunar calls it via HTTP. Each tool uses its best language: TypeScript for agents, Python for ML evaluation.**

---

**Next → [Day 23: LLM-as-Judge Evaluation](day-23.md)**
