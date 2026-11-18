import { NextRequest, NextResponse } from 'next/server';
import {
  getMinibusTrips,
  getCorridors,
  getVehicles,
  registerVehicleInRankQueue,
  seedMinibusDataIfNeeded,
} from '@/utils/minibusStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    seedMinibusDataIfNeeded();
    const { searchParams } = new URL(req.url);
    const corridorId = searchParams.get('corridorId');
    const status = searchParams.get('status');

    let trips = getMinibusTrips();
    if (corridorId) {
      trips = trips.filter(t => t.corridorId === corridorId);
    }
    if (status) {
      trips = trips.filter(t => t.status === status);
    }

    return NextResponse.json({
      success: true,
      trips,
      corridors: getCorridors(),
      vehicles: getVehicles(),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vehicleId, corridorId, driverId, driverName, driverPhone, marshalId } = body;

    if (!vehicleId || !corridorId || !driverName) {
      return NextResponse.json({ success: false, error: 'vehicleId, corridorId, driverName are required' }, { status: 400 });
    }

    const trip = registerVehicleInRankQueue({
      vehicleId,
      corridorId,
      driverId: driverId || `drv-${Date.now()}`,
      driverName,
      driverPhone: driverPhone || '+27 82 000 0000',
      marshalId,
    });

    return NextResponse.json({ success: true, trip });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
