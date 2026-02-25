import { NextRequest, NextResponse } from 'next/server';

const EVAL_URL = process.env.EVAL_URL || 'http://localhost:8000';

// GET /api/eval — list eval runs
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '20';

  try {
    const res = await fetch(`${EVAL_URL}/eval/runs?limit=${limit}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ runs: [], error: 'Eval service unavailable' });
  }
}

// POST /api/eval — trigger new eval run
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  try {
    const res = await fetch(`${EVAL_URL}/eval/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to start eval' }, { status: 500 });
  }
}
