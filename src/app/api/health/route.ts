import { NextResponse } from 'next/server';

/** docker-compose healthcheck shu manzilni so'raydi (§4.1). */
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
