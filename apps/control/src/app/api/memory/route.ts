import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3100';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const source = searchParams.get('source');
  const limit = searchParams.get('limit') || '20';

  try {
    const endpoint = query
      ? `${GATEWAY_URL}/api/memory/search?q=${encodeURIComponent(query)}&limit=${limit}`
      : `${GATEWAY_URL}/api/memory/chunks?source=${source || 'all'}&limit=${limit}`;

    const response = await fetch(endpoint);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch memory' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { chunkId } = await request.json();
  
  try {
    const response = await fetch(`${GATEWAY_URL}/api/memory/chunks/${chunkId}`, {
      method: 'DELETE',
    });
    return NextResponse.json({ success: response.ok });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete chunk' },
      { status: 500 }
    );
  }
}
