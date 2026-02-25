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
