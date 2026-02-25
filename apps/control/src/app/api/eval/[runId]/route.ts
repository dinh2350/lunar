import { NextRequest, NextResponse } from 'next/server';

const EVAL_URL = process.env.EVAL_URL || 'http://localhost:8000';

// GET /api/eval/:runId — get single run details
export async function GET(
  _request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const res = await fetch(`${EVAL_URL}/eval/runs/${params.runId}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }
}
