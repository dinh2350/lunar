import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3100';

// GET /api/settings — load current config
export async function GET() {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/settings`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 503 });
  }
}

// PUT /api/settings — update config
export async function PUT(request: NextRequest) {
  const settings = await request.json();
  
  try {
    const res = await fetch(`${GATEWAY_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
