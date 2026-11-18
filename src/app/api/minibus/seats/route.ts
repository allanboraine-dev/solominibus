import { NextRequest, NextResponse } from 'next/server';
import {
  getSeatLedger,
  logSeatInLedger,
  removeSeatFromLedger,
  seedMinibusDataIfNeeded,
} from '@/utils/minibusStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    seedMinibusDataIfNeeded();
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get('tripId');

    const seats = getSeatLedger(tripId || undefined);
    return NextResponse.json({ success: true, count: seats.length, seats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tripId, seatNumber, paymentMethod, fareAmount, passengerPhone, passengerName, loggedBy } = body;

    if (!tripId || !seatNumber || !paymentMethod || fareAmount === undefined) {
      return NextResponse.json(
        { success: false, error: 'tripId, seatNumber, paymentMethod, and fareAmount are required' },
        { status: 400 }
      );
    }

    const result = logSeatInLedger({
      tripId,
      seatNumber: Number(seatNumber),
      paymentMethod,
      fareAmount: Number(fareAmount),
      passengerPhone,
      passengerName,
      loggedBy: loggedBy || 'conductor_manual',
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, seat: result.seat, trip: result.trip });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get('tripId');
    const seatNumber = Number(searchParams.get('seatNumber'));

    if (!tripId || !seatNumber) {
      return NextResponse.json({ success: false, error: 'tripId and seatNumber are required' }, { status: 400 });
    }

    const result = removeSeatFromLedger(tripId, seatNumber);
    return NextResponse.json({ success: result.success, trip: result.trip });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
