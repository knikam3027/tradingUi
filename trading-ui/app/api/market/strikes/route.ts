import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(`${backendUrl}/api/v1/market/strikes`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeout);

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'error',
          message: payload?.message || `Backend error: ${response.statusText}`,
          error: payload?.error || 'Failed to fetch strike data',
        },
        { status: response.status }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching strikes:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch strike data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
