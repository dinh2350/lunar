# Day 23 — LLM-as-Judge Evaluation

> 🎯 **DAY GOAL:** Use an LLM to evaluate another LLM's answers — the most powerful evaluation technique in production AI systems

---

## 📚 CONCEPT 1: What is LLM-as-Judge?

### WHAT — Simple Definition

**Use one LLM to grade another LLM's responses.** Instead of writing rules to check if an answer is "good," you ask an AI judge: "Rate this answer on a scale of 1-5 and explain why."

```
┌──────────┐    Question     ┌──────────┐
│   USER   │ ──────────────► │  LUNAR   │
│          │ ◄────────────── │ (Agent)  │
└──────────┘    Answer       └──────────┘
                                  │
                         Answer + Question
                                  │
                            ┌─────▼─────┐
                            │  LLM      │
                            │  JUDGE    │  ← Different model evaluates
                            │  (eval)   │
                            └─────┬─────┘
                                  │
                         Score: 4/5
                         Reason: "Good but missed context about..."
```

### WHY — Why Not Just Use Heuristics?

```
Heuristic evaluation (Day 22):
  ✅ Fast, cheap, deterministic
  ❌ Can only check surface features (length, word overlap)
  ❌ Can't judge: "Is this helpful?" "Is this accurate?"
  ❌ "The capital of France is Paris :)" scores same as deep analysis

LLM-as-Judge:
  ✅ Can evaluate quality, helpfulness, accuracy, tone
  ✅ Can explain WHY something scored low
  ✅ Catches nuanced errors ("factually correct but misleading")
  ✅ Used by OpenAI, Anthropic, Google in production
  ❌ Costs tokens (but you use free local models!)
  ❌ Not 100% deterministic (run multiple times for reliability)
```

### WHEN — When to Use Each?

```
HEURISTICS (fast, free):
  → Length checks, format validation
  → "Did it return JSON?" "Is it under 500 words?"

LLM-AS-JUDGE (smart, slower):
  → Quality evaluation: "Is this answer helpful?"
  → Factual accuracy: "Does this match the context?"
  → Safety checks: "Is this response appropriate?"
  → Comparative: "Which of these 2 answers is better?"
```

### 🔗 NODE.JS ANALOGY

```
Heuristic eval = unit tests
  → Fast, deterministic, checks specific rules
  → test("returns 200", () => expect(res.status).toBe(200))

LLM-as-Judge = code review
  → A senior dev reads your code and gives nuanced feedback
  → "The code works but the naming is confusing and you missed an edge case"
```

---

## 📚 CONCEPT 2: Judge Prompt Engineering

### WHAT — Simple Definition

**The evaluation prompt template is the most important part.** A well-written judge prompt produces consistent, useful scores.

### HOW — Anatomy of a Judge Prompt

```
JUDGE PROMPT TEMPLATE:
  1. ROLE: "You are an expert evaluator..."
  2. CRITERIA: What specifically to evaluate
  3. SCALE: Clear rubric (1-5 with descriptions)
  4. FORMAT: Exact output format (JSON)
  5. EXAMPLES: Optional few-shot examples
  6. INPUT: The actual Q&A pair to evaluate
```

### KEY CRITERIA (Industry Standard)

```
1. ANSWER RELEVANCY — Does the answer address the question?
   1: Completely off-topic
   3: Partially addresses the question
   5: Directly and fully addresses the question

2. FAITHFULNESS — Is the answer grounded in provided context?
   1: Contains hallucinated claims not in context
   3: Mix of grounded and ungrounded claims
   5: Every claim is supported by the context

3. HELPFULNESS — Would a human find this useful?
   1: Unhelpful, confusing, or wrong
   3: Somewhat helpful but incomplete
   5: Clearly helpful, actionable, complete

4. HARMLESSNESS — Is the response safe and appropriate?
   1: Contains harmful/inappropriate content
   3: Borderline or potentially misleading
   5: Completely safe and appropriate
```

---

## 🔨 HANDS-ON: Build the LLM Judge

### Step 1: Judge Prompt Templates (15 minutes)

Create `services/eval/prompts.py`:

```python
"""Evaluation prompt templates for LLM-as-Judge."""

RELEVANCY_PROMPT = """You are an expert evaluator. Rate how well the ANSWER addresses the QUESTION.

QUESTION: {question}
ANSWER: {answer}

Rate on a scale of 1-5:
1 = Completely off-topic, does not address the question at all
2 = Slightly related but misses the main point
3 = Partially addresses the question but incomplete
4 = Mostly addresses the question with minor gaps
5 = Directly and completely addresses the question

Respond in this exact JSON format:
{{"score": <1-5>, "reason": "<one sentence explanation>"}}
"""

FAITHFULNESS_PROMPT = """You are an expert evaluator. Rate whether the ANSWER is grounded in the CONTEXT.

CONTEXT:
{context}

QUESTION: {question}
ANSWER: {answer}

Rate on a scale of 1-5:
1 = Answer contains claims not supported by context (hallucination)
2 = Most claims are unsupported
3 = Mix of grounded and ungrounded claims
4 = Mostly grounded with minor unsupported details
5 = Every claim in the answer is supported by the context

Respond in this exact JSON format:
{{"score": <1-5>, "reason": "<one sentence explanation>"}}
"""

HELPFULNESS_PROMPT = """You are an expert evaluator. Rate how helpful the ANSWER would be to a human asking the QUESTION.

QUESTION: {question}
ANSWER: {answer}

Rate on a scale of 1-5:
1 = Unhelpful, confusing, or incorrect
2 = Slightly helpful but mostly unclear
3 = Somewhat helpful but incomplete or verbose
4 = Helpful with minor room for improvement
5 = Extremely helpful, clear, complete, and actionable

Respond in this exact JSON format:
{{"score": <1-5>, "reason": "<one sentence explanation>"}}
"""
```

### Step 2: LLM Judge Client (20 minutes)

Create `services/eval/judge.py`:

```python
"""LLM-as-Judge — calls Ollama to evaluate responses."""
import httpx
import json
import re
from prompts import RELEVANCY_PROMPT, FAITHFULNESS_PROMPT, HELPFULNESS_PROMPT

OLLAMA_URL = "http://localhost:11434/api/chat"
JUDGE_MODEL = "qwen2.5:7b"  # Same model, but could use a different one

async def call_judge(prompt: str) -> dict:
    """Send a prompt to the LLM judge and parse JSON response."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": JUDGE_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {"temperature": 0.1},  # Low temp for consistent scoring
        })
        response.raise_for_status()
        
        content = response.json()["message"]["content"]
        
        # Parse JSON from response (handle markdown code blocks)
        json_match = re.search(r'\{[^}]+\}', content)
        if json_match:
            return json.loads(json_match.group())
        
        # Fallback
        return {"score": 0, "reason": f"Could not parse judge response: {content[:100]}"}


async def judge_relevancy(question: str, answer: str) -> dict:
    """Judge: Does the answer address the question?"""
    prompt = RELEVANCY_PROMPT.format(question=question, answer=answer)
    result = await call_judge(prompt)
    return {**result, "name": "relevancy", "score": result["score"] / 5.0}  # normalize to 0-1


async def judge_faithfulness(question: str, answer: str, context: list[str]) -> dict:
    """Judge: Is the answer grounded in the context?"""
    context_text = "\n---\n".join(context)
    prompt = FAITHFULNESS_PROMPT.format(
        question=question, answer=answer, context=context_text
    )
    result = await call_judge(prompt)
    return {**result, "name": "faithfulness", "score": result["score"] / 5.0}


async def judge_helpfulness(question: str, answer: str) -> dict:
    """Judge: Is the answer helpful?"""
    prompt = HELPFULNESS_PROMPT.format(question=question, answer=answer)
    result = await call_judge(prompt)
    return {**result, "name": "helpfulness", "score": result["score"] / 5.0}
```

### Step 3: Add Judge Endpoints to FastAPI (15 minutes)

Update `services/eval/main.py` — add new endpoint:

```python
from judge import judge_relevancy, judge_faithfulness, judge_helpfulness

@app.post("/eval/judge", response_model=EvalResponse)
async def evaluate_with_judge(req: EvalRequest) -> EvalResponse:
    """Evaluate using LLM-as-Judge (slower but smarter)."""
    scores = []
    
    # Always run relevancy + helpfulness
    relevancy = await judge_relevancy(req.question, req.answer)
    scores.append(EvalScore(**relevancy))
    
    helpfulness = await judge_helpfulness(req.question, req.answer)
    scores.append(EvalScore(**helpfulness))
    
    # Faithfulness only if context provided
    if req.context:
        faithfulness = await judge_faithfulness(req.question, req.answer, req.context)
        scores.append(EvalScore(**faithfulness))
    
    overall = sum(s.score for s in scores) / len(scores)
    
    return EvalResponse(
        scores=scores,
        overall=round(overall, 3),
        evaluated_at=datetime.now().isoformat(),
    )
```

### Step 4: Test the Judge (15 minutes)

```bash
# Make sure Ollama is running!
# In terminal 1:
uvicorn main:app --reload --port 8000

# In terminal 2:
# Good answer test
curl -X POST http://localhost:8000/eval/judge \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is RAG in AI?",
    "answer": "RAG stands for Retrieval Augmented Generation. It enhances LLM responses by first retrieving relevant documents from a knowledge base, then providing them as context to the language model. This helps reduce hallucinations and ground responses in factual data.",
    "context": ["RAG is a technique that retrieves documents and uses them as context for LLM generation to reduce hallucinations"]
  }'

# Bad answer test (should score lower)
curl -X POST http://localhost:8000/eval/judge \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is RAG in AI?",
    "answer": "It is a type of cloth material used in cleaning."
  }'
```

---

## ✅ CHECKLIST

- [ ] Judge prompt templates created with clear rubrics
- [ ] LLM judge client calls Ollama with low temperature
- [ ] JSON response parsed from judge output
- [ ] `/eval/judge` endpoint works
- [ ] Good answers score higher than bad answers
- [ ] Scores normalized to 0.0-1.0 range
- [ ] Judge provides text reasoning, not just numbers

---

## 💡 KEY TAKEAWAY

**LLM-as-Judge is the most practical evaluation method for AI agents. Write a clear rubric prompt (role + criteria + scale + format), use low temperature for consistency, and normalize scores to 0-1. The judge catches quality issues that heuristics miss.**

---

**Next → [Day 24: Evaluation Dataset + Automated Testing](day-24.md)**
