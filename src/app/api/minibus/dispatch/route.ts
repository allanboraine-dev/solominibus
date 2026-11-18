import { NextRequest, NextResponse } from 'next/server';
import { dispatchMinibusTrip } from '@/utils/minibusStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tripId, marshalId } = body;

    if (!tripId) {
      return NextResponse.json({ success: false, error: 'tripId is required' }, { status: 400 });
    }

    const result = dispatchMinibusTrip(tripId, marshalId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Trip not found or already dispatched' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      dispatchedTrip: result.dispatchedTrip,
      nextTrip: result.nextTrip,
      message: 'Minibus dispatched successfully. Next vehicle promoted to loading bay.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
