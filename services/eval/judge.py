"""LLM-as-Judge — calls Ollama to evaluate responses."""
import httpx
import json
import os
import re
from prompts import RELEVANCY_PROMPT, FAITHFULNESS_PROMPT, HELPFULNESS_PROMPT

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434") + "/api/chat"
JUDGE_MODEL = os.getenv("JUDGE_MODEL", "qwen2.5:3b")

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
