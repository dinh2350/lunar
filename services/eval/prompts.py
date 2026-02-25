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
