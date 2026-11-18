/**
 * SOLO Minibus Transit & Fleet Engine (SANTACO 15-Seater Corridors)
 * Handles:
 *  - Associations (SANTACO, CODETA, CATA, Kimberley Local)
 *  - Corridors (Rank to Destination with standard fares)
 *  - 15-Seater Vehicles (Toyota Quantum / HiAce)
 *  - Rank Queue Dispatch & Manifest Journeys
 *  - 15-Seat Ledgers (Digital Paystack vs Cash logging)
 *  - Realtime WebSocket / LocalStorage fallback synchronization
 */

import { generateUuid, getSafeLocalStorageItem, setSafeLocalStorageItem, safeJsonParse } from './session';
import { supabase } from '@/lib/supabaseClient';

export interface MinibusAssociation {
  id: string;
  name: string;
  shortCode: string;
  region: string;
  contactPhone: string;
  contactEmail: string;
}

export interface MinibusCorridor {
  id: string;
  originRank: string;
  destination: string;
  standardFareZar: number;
  distanceKm: number;
  estimatedMinutes: number;
}

export interface MinibusVehicle {
  id: string;
  associationId: string;
  ownerId: string;
  registrationPlate: string;
  vinNumber: string;
  make: string;
  model: string;
  capacity: number; // 15
  status: 'active' | 'maintenance' | 'inactive';
}

export type MinibusTripStatus = 'boarding' | 'in_transit' | 'completed' | 'cancelled';

export interface MinibusTrip {
  id: string;
  vehicleId: string;
  corridorId: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  marshalId?: string;
  queuePosition: number; // 1 = in loading bay, 2+ = waiting in line
  status: MinibusTripStatus;
  totalSeats: number; // 15
  digitalSeatsFilled: number;
  cashSeatsFilled: number;
  totalRevenueZar: number;
  dispatchedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SeatPaymentMethod = 'digital_paystack' | 'cash' | 'qr_wallet';
export type SeatLoggedBy = 'commuter_scan' | 'conductor_manual' | 'marshal_manual';

export interface SeatLedgerEntry {
  id: string;
  tripId: string;
  seatNumber: number; // 1 to 15
  paymentMethod: SeatPaymentMethod;
  fareAmount: number;
  passengerPhone?: string;
  passengerName?: string;
  loggedBy: SeatLoggedBy;
  createdAt: string;
}

// Default SANTACO Associations
export const SEED_ASSOCIATIONS: MinibusAssociation[] = [
  {
    id: 'assoc-santaco-kby',
    name: 'SANTACO Kimberley Local Taxi Association',
    shortCode: 'KLTA-SANTACO',
    region: 'Northern Cape (Kimberley)',
    contactPhone: '+27 53 831 2400',
    contactEmail: 'admin@kimberleytaxis.co.za',
  },
  {
    id: 'assoc-codeta-wc',
    name: 'CODETA Cape Town Regional Association',
    shortCode: 'CODETA',
    region: 'Western Cape (Cape Town Metro)',
    contactPhone: '+27 21 386 1100',
    contactEmail: 'dispatch@codeta.co.za',
  },
  {
    id: 'assoc-santaco-gp',
    name: 'Bree Street United Taxi Association',
    shortCode: 'BUTA-SANTACO',
    region: 'Gauteng (Johannesburg CBD)',
    contactPhone: '+27 11 333 4500',
    contactEmail: 'ops@breetaxis.co.za',
  },
];

// Default Popular Corridors & Ranks
export const SEED_CORRIDORS: MinibusCorridor[] = [
  {
    id: 'corr-kby-galeshewe',
    originRank: 'Kimberley CBD Main Rank (Old Market)',
    destination: 'Galeshewe Zone 4 / Circle',
    standardFareZar: 16.00,
    distanceKm: 8.5,
    estimatedMinutes: 18,
  },
  {
    id: 'corr-kby-roodepan',
    originRank: 'Kimberley CBD Main Rank (Old Market)',
    destination: 'Roodepan Terminus via Barkly Rd',
    standardFareZar: 18.00,
    distanceKm: 12.0,
    estimatedMinutes: 24,
  },
  {
    id: 'corr-kby-greenpoint',
    originRank: 'Kimberley CBD Main Rank (Old Market)',
    destination: 'Greenpoint Primary & Diamond Park',
    standardFareZar: 17.00,
    distanceKm: 9.2,
    estimatedMinutes: 20,
  },
  {
    id: 'corr-cpt-khayelitsha',
    originRank: 'Cape Town Station Deck Rank',
    destination: 'Khayelitsha Site C via N2 Express',
    standardFareZar: 28.00,
    distanceKm: 32.0,
    estimatedMinutes: 45,
  },
  {
    id: 'corr-jhb-soweto',
    originRank: 'Johannesburg Bree Street Taxi Rank',
    destination: 'Soweto Baragwanath Hospital Hub',
    standardFareZar: 22.00,
    distanceKm: 16.5,
    estimatedMinutes: 30,
  },
];

// Default 15-Seater Minibus Vehicles
export const SEED_VEHICLES: MinibusVehicle[] = [
  {
    id: 'veh-quantum-01',
    associationId: 'assoc-santaco-kby',
    ownerId: 'owner-boraine-01',
    registrationPlate: 'CC 44 NC',
    vinNumber: 'AHT31B1500098412',
    make: 'Toyota',
    model: 'Quantum Ses’fikile 2.7 VVTi (15-Seater)',
    capacity: 15,
    status: 'active',
  },
  {
    id: 'veh-quantum-02',
    associationId: 'assoc-santaco-kby',
    ownerId: 'owner-boraine-01',
    registrationPlate: 'CC 88 NC',
    vinNumber: 'AHT31B1500098499',
    make: 'Toyota',
    model: 'Quantum Ses’fikile 2.5 D-4D (15-Seater)',
    capacity: 15,
    status: 'active',
  },
  {
    id: 'veh-quantum-03',
    associationId: 'assoc-santaco-kby',
    ownerId: 'owner-boraine-02',
    registrationPlate: 'CC 92 NC',
    vinNumber: 'AHT31B1500098651',
    make: 'Toyota',
    model: 'Quantum GL Executive 2.8 GD-6 (15-Seater)',
    capacity: 15,
    status: 'active',
  },
  {
    id: 'veh-hiace-04',
    associationId: 'assoc-codeta-wc',
    ownerId: 'owner-codeta-01',
    registrationPlate: 'CA 749-332',
    vinNumber: 'AHT31B1500097103',
    make: 'Toyota',
    model: 'HiAce 16-Valve 15-Seater',
    capacity: 15,
    status: 'active',
  },
];

const LOCAL_STORAGE_KEYS = {
  ASSOCIATIONS: 'solo_minibus_associations',
  CORRIDORS: 'solo_minibus_corridors',
  VEHICLES: 'solo_minibus_vehicles',
  TRIPS: 'solo_minibus_trips',
  SEATS: 'solo_minibus_seat_ledger',
};

/**
 * Seeds initial minibus transit data if not present in localStorage
 */
export function seedMinibusDataIfNeeded(): void {
  if (typeof window === 'undefined') return;

  if (!getSafeLocalStorageItem(LOCAL_STORAGE_KEYS.ASSOCIATIONS, '')) {
    setSafeLocalStorageItem(LOCAL_STORAGE_KEYS.ASSOCIATIONS, JSON.stringify(SEED_ASSOCIATIONS));
  }
  if (!getSafeLocalStorageItem(LOCAL_STORAGE_KEYS.CORRIDORS, '')) {
    setSafeLocalStorageItem(LOCAL_STORAGE_KEYS.CORRIDORS, JSON.stringify(SEED_CORRIDORS));
  }
  if (!getSafeLocalStorageItem(LOCAL_STORAGE_KEYS.VEHICLES, '')) {
    setSafeLocalStorageItem(LOCAL_STORAGE_KEYS.VEHICLES, JSON.stringify(SEED_VEHICLES));
  }

  // Seed sample active trips in queue if empty
  if (!getSafeLocalStorageItem(LOCAL_STORAGE_KEYS.TRIPS, '')) {
    const initialTrips: MinibusTrip[] = [
      {
        id: 'trip-kby-001',
        vehicleId: 'veh-quantum-01',
        corridorId: 'corr-kby-galeshewe',
        driverId: 'drv-sipho-01',
        driverName: 'Sipho Ndlovu',
        driverPhone: '+27 82 456 7890',
        marshalId: 'msh-lucas-01',
        queuePosition: 1, // Currently at loading bay
        status: 'boarding',
        totalSeats: 15,
        digitalSeatsFilled: 4,
        cashSeatsFilled: 7,
        totalRevenueZar: 176.00, // 11 * R16
        createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'trip-kby-002',
        vehicleId: 'veh-quantum-02',
        corridorId: 'corr-kby-galeshewe',
        driverId: 'drv-tumi-02',
        driverName: 'Tumi Molefe',
        driverPhone: '+27 71 234 5678',
        marshalId: 'msh-lucas-01',
        queuePosition: 2, // Next up in line
        status: 'boarding',
        totalSeats: 15,
        digitalSeatsFilled: 0,
        cashSeatsFilled: 0,
        totalRevenueZar: 0.00,
        createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'trip-kby-003',
        vehicleId: 'veh-quantum-03',
        corridorId: 'corr-kby-roodepan',
        driverId: 'drv-allan-03',
        driverName: 'Kagiso Booysen',
        driverPhone: '+27 76 890 1234',
        marshalId: 'msh-lucas-01',
        queuePosition: 1, // Loading bay for Roodepan
        status: 'boarding',
        totalSeats: 15,
        digitalSeatsFilled: 2,
        cashSeatsFilled: 3,
        totalRevenueZar: 90.00, // 5 * R18
        createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    setSafeLocalStorageItem(LOCAL_STORAGE_KEYS.TRIPS, JSON.stringify(initialTrips));

    // Seed sample seat reservations for trip-kby-001 (11 seats filled, 4 empty)
    const initialSeats: SeatLedgerEntry[] = [
      { id: 'seat-1', tripId: 'trip-kby-001', seatNumber: 1, paymentMethod: 'digital_paystack', fareAmount: 16.00, passengerPhone: '+27821112222', passengerName: 'Nomvula K.', loggedBy: 'commuter_scan', createdAt: new Date(Date.now() - 20 * 60000).toISOString() },
      { id: 'seat-2', tripId: 'trip-kby-001', seatNumber: 2, paymentMethod: 'digital_paystack', fareAmount: 16.00, passengerPhone: '+27733334444', passengerName: 'Thabo M.', loggedBy: 'commuter_scan', createdAt: new Date(Date.now() - 18 * 60000).toISOString() },
      { id: 'seat-3', tripId: 'trip-kby-001', seatNumber: 3, paymentMethod: 'cash', fareAmount: 16.00, passengerPhone: '', passengerName: 'Cash Commuter', loggedBy: 'conductor_manual', createdAt: new Date(Date.now() - 15 * 60000).toISOString() },
      { id: 'seat-4', tripId: 'trip-kby-001', seatNumber: 4, paymentMethod: 'cash', fareAmount: 16.00, passengerPhone: '', passengerName: 'Cash Commuter', loggedBy: 'conductor_manual', createdAt: new Date(Date.now() - 14 * 60000).toISOString() },
      { id: 'seat-5', tripId: 'trip-kby-001', seatNumber: 5, paymentMethod: 'digital_paystack', fareAmount: 16.00, passengerPhone: '+27845556666', passengerName: 'Kagiso S.', loggedBy: 'commuter_scan', createdAt: new Date(Date.now() - 12 * 60000).toISOString() },
      { id: 'seat-6', tripId: 'trip-kby-001', seatNumber: 6, paymentMethod: 'cash', fareAmount: 16.00, passengerPhone: '', passengerName: 'Cash Commuter', loggedBy: 'conductor_manual', createdAt: new Date(Date.now() - 10 * 60000).toISOString() },
      { id: 'seat-7', tripId: 'trip-kby-001', seatNumber: 7, paymentMethod: 'cash', fareAmount: 16.00, passengerPhone: '', passengerName: 'Cash Commuter', loggedBy: 'conductor_manual', createdAt: new Date(Date.now() - 8 * 60000).toISOString() },
      { id: 'seat-8', tripId: 'trip-kby-001', seatNumber: 8, paymentMethod: 'digital_paystack', fareAmount: 16.00, passengerPhone: '+27727778888', passengerName: 'Lindiwe Z.', loggedBy: 'commuter_scan', createdAt: new Date(Date.now() - 6 * 60000).toISOString() },
      { id: 'seat-9', tripId: 'trip-kby-001', seatNumber: 9, paymentMethod: 'cash', fareAmount: 16.00, passengerPhone: '', passengerName: 'Cash Commuter', loggedBy: 'conductor_manual', createdAt: new Date(Date.now() - 5 * 60000).toISOString() },
      { id: 'seat-10', tripId: 'trip-kby-001', seatNumber: 10, paymentMethod: 'cash', fareAmount: 16.00, passengerPhone: '', passengerName: 'Cash Commuter', loggedBy: 'conductor_manual', createdAt: new Date(Date.now() - 3 * 60000).toISOString() },
      { id: 'seat-11', tripId: 'trip-kby-001', seatNumber: 11, paymentMethod: 'cash', fareAmount: 16.00, passengerPhone: '', passengerName: 'Cash Commuter', loggedBy: 'conductor_manual', createdAt: new Date(Date.now() - 1 * 60000).toISOString() },
    ];
    setSafeLocalStorageItem(LOCAL_STORAGE_KEYS.SEATS, JSON.stringify(initialSeats));
  }
}

export function getCorridors(): MinibusCorridor[] {
  seedMinibusDataIfNeeded();
  const raw = getSafeLocalStorageItem(LOCAL_STORAGE_KEYS.CORRIDORS, '');
  return safeJsonParse<MinibusCorridor[]>(raw, SEED_CORRIDORS);
}

export function getVehicles(): MinibusVehicle[] {
  seedMinibusDataIfNeeded();
  const raw = getSafeLocalStorageItem(LOCAL_STORAGE_KEYS.VEHICLES, '');
  return safeJsonParse<MinibusVehicle[]>(raw, SEED_VEHICLES);
}

export function getMinibusTrips(): MinibusTrip[] {
  seedMinibusDataIfNeeded();
  const raw = getSafeLocalStorageItem(LOCAL_STORAGE_KEYS.TRIPS, '');
  return safeJsonParse<MinibusTrip[]>(raw, []);
}

export function saveMinibusTrips(trips: MinibusTrip[]): void {
  setSafeLocalStorageItem(LOCAL_STORAGE_KEYS.TRIPS, JSON.stringify(trips));
}

export function getSeatLedger(tripId?: string): SeatLedgerEntry[] {
  seedMinibusDataIfNeeded();
  const raw = getSafeLocalStorageItem(LOCAL_STORAGE_KEYS.SEATS, '');
  const allSeats = safeJsonParse<SeatLedgerEntry[]>(raw, []);
  if (!tripId) return allSeats;
  return allSeats.filter(s => s.tripId === tripId);
}

export function saveSeatLedger(seats: SeatLedgerEntry[]): void {
  setSafeLocalStorageItem(LOCAL_STORAGE_KEYS.SEATS, JSON.stringify(seats));
}

/**
 * Logs a cash seat reservation by conductor (+1 cash seat)
 */
export function logSeatInLedger(params: {
  tripId: string;
  seatNumber: number;
  paymentMethod: SeatPaymentMethod;
  fareAmount: number;
  passengerPhone?: string;
  passengerName?: string;
  loggedBy: SeatLoggedBy;
}): { success: boolean; seat?: SeatLedgerEntry; error?: string; trip?: MinibusTrip } {
  seedMinibusDataIfNeeded();
  const allSeats = getSeatLedger();

  // Validate seat number 1-15
  if (params.seatNumber < 1 || params.seatNumber > 15) {
    return { success: false, error: 'Seat number must be between 1 and 15.' };
  }

  // Prevent double booking of the exact same seat
  const exists = allSeats.some(s => s.tripId === params.tripId && s.seatNumber === params.seatNumber);
  if (exists) {
    return { success: false, error: `Seat #${params.seatNumber} is already occupied on this trip.` };
  }

  const newSeat: SeatLedgerEntry = {
    id: generateUuid(),
    tripId: params.tripId,
    seatNumber: params.seatNumber,
    paymentMethod: params.paymentMethod,
    fareAmount: params.fareAmount,
    passengerPhone: params.passengerPhone || '',
    passengerName: params.passengerName || (params.paymentMethod === 'cash' ? 'Cash Commuter' : 'Digital Passenger'),
    loggedBy: params.loggedBy,
    createdAt: new Date().toISOString(),
  };

  const updatedSeats = [...allSeats, newSeat];
  saveSeatLedger(updatedSeats);

  // Update trip counts
  const trips = getMinibusTrips();
  const tripIdx = trips.findIndex(t => t.id === params.tripId);
  let updatedTrip: MinibusTrip | undefined;

  if (tripIdx !== -1) {
    const trip = trips[tripIdx];
    const isDigital = params.paymentMethod === 'digital_paystack' || params.paymentMethod === 'qr_wallet';
    const digitalCount = trip.digitalSeatsFilled + (isDigital ? 1 : 0);
    const cashCount = trip.cashSeatsFilled + (!isDigital ? 1 : 0);
    const totalRevenue = trip.totalRevenueZar + params.fareAmount;

    // Check if total seats filled reached 15
    const totalFilled = digitalCount + cashCount;
    const autoDispatch = totalFilled >= 15;

    updatedTrip = {
      ...trip,
      digitalSeatsFilled: digitalCount,
      cashSeatsFilled: cashCount,
      totalRevenueZar: Math.round(totalRevenue * 100) / 100,
      status: autoDispatch ? 'in_transit' : trip.status,
      dispatchedAt: autoDispatch ? new Date().toISOString() : trip.dispatchedAt,
      updatedAt: new Date().toISOString(),
    };

    trips[tripIdx] = updatedTrip;

    // If auto-dispatched, promote next trip in queue
    if (autoDispatch) {
      promoteNextMinibusInQueue(trips, trip.corridorId);
    } else {
      saveMinibusTrips(trips);
    }
  }

  // Also broadcast or sync to Supabase if connected
  try {
    supabase.from('seat_ledger').insert([{
      trip_id: params.tripId,
      seat_number: params.seatNumber,
      payment_method: params.paymentMethod,
      fare_amount: params.fareAmount,
      passenger_phone: params.passengerPhone,
      passenger_name: params.passengerName,
      logged_by: params.loggedBy,
    }]).then(() => {});
  } catch (_) {
    // Offline resilient
  }

  return { success: true, seat: newSeat, trip: updatedTrip };
}

/**
 * Removes or refunds a logged seat
 */
export function removeSeatFromLedger(tripId: string, seatNumber: number): { success: boolean; trip?: MinibusTrip } {
  const allSeats = getSeatLedger();
  const targetSeat = allSeats.find(s => s.tripId === tripId && s.seatNumber === seatNumber);
  if (!targetSeat) return { success: false };

  const updatedSeats = allSeats.filter(s => !(s.tripId === tripId && s.seatNumber === seatNumber));
  saveSeatLedger(updatedSeats);

  const trips = getMinibusTrips();
  const tripIdx = trips.findIndex(t => t.id === tripId);
  let updatedTrip: MinibusTrip | undefined;

  if (tripIdx !== -1) {
    const trip = trips[tripIdx];
    const isDigital = targetSeat.paymentMethod === 'digital_paystack' || targetSeat.paymentMethod === 'qr_wallet';
    const digitalCount = Math.max(0, trip.digitalSeatsFilled - (isDigital ? 1 : 0));
    const cashCount = Math.max(0, trip.cashSeatsFilled - (!isDigital ? 1 : 0));
    const totalRevenue = Math.max(0, trip.totalRevenueZar - targetSeat.fareAmount);

    updatedTrip = {
      ...trip,
      digitalSeatsFilled: digitalCount,
      cashSeatsFilled: cashCount,
      totalRevenueZar: Math.round(totalRevenue * 100) / 100,
      updatedAt: new Date().toISOString(),
    };
    trips[tripIdx] = updatedTrip;
    saveMinibusTrips(trips);
  }

  return { success: true, trip: updatedTrip };
}

/**
 * Promotes the next queued minibus in the corridor to the loading bay (position 1)
 */
function promoteNextMinibusInQueue(trips: MinibusTrip[], corridorId: string): void {
  const queuedTrips = trips
    .filter(t => t.corridorId === corridorId && t.status === 'boarding')
    .sort((a, b) => a.queuePosition - b.queuePosition);

  // Shift queue positions
  queuedTrips.forEach((t, idx) => {
    t.queuePosition = idx + 1;
    t.updatedAt = new Date().toISOString();
  });

  saveMinibusTrips(trips);
}

/**
 * Marshal manually or automatically triggers dispatch of the vehicle
 */
export function dispatchMinibusTrip(tripId: string, marshalId?: string): { success: boolean; dispatchedTrip?: MinibusTrip; nextTrip?: MinibusTrip } {
  const trips = getMinibusTrips();
  const tripIdx = trips.findIndex(t => t.id === tripId);
  if (tripIdx === -1) return { success: false };

  const currentTrip = trips[tripIdx];
  const dispatchedTrip: MinibusTrip = {
    ...currentTrip,
    status: 'in_transit',
    marshalId: marshalId || currentTrip.marshalId || 'marshal-rank-dispatch',
    dispatchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  trips[tripIdx] = dispatchedTrip;

  // Find next vehicle in same corridor and set queuePosition to 1
  const remainingInCorridor = trips
    .filter(t => t.corridorId === currentTrip.corridorId && t.status === 'boarding' && t.id !== tripId)
    .sort((a, b) => a.queuePosition - b.queuePosition);

  let nextTrip: MinibusTrip | undefined;
  if (remainingInCorridor.length > 0) {
    nextTrip = remainingInCorridor[0];
    remainingInCorridor.forEach((t, i) => {
      t.queuePosition = i + 1;
      t.updatedAt = new Date().toISOString();
    });
  }

  saveMinibusTrips(trips);
  return { success: true, dispatchedTrip, nextTrip };
}

/**
 * Creates a new trip entry in the rank queue for a driver
 */
export function registerVehicleInRankQueue(params: {
  vehicleId: string;
  corridorId: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  marshalId?: string;
}): MinibusTrip {
  const trips = getMinibusTrips();
  const inQueueSameCorridor = trips.filter(t => t.corridorId === params.corridorId && t.status === 'boarding');
  const nextPos = inQueueSameCorridor.length + 1;

  const newTrip: MinibusTrip = {
    id: `trip-kby-${Date.now().toString().slice(-6)}`,
    vehicleId: params.vehicleId,
    corridorId: params.corridorId,
    driverId: params.driverId,
    driverName: params.driverName,
    driverPhone: params.driverPhone,
    marshalId: params.marshalId || 'msh-lucas-01',
    queuePosition: nextPos,
    status: 'boarding',
    totalSeats: 15,
    digitalSeatsFilled: 0,
    cashSeatsFilled: 0,
    totalRevenueZar: 0.00,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  trips.push(newTrip);
  saveMinibusTrips(trips);
  return newTrip;
}

/**
 * Generates an end-of-day revenue reconciliation audit for fleet owners
 */
export function getMinibusDailyAudit(vehicleId?: string, dateStr?: string): {
  date: string;
  tripsCount: number;
  totalSeatsSold: number;
  digitalSeatsSold: number;
  cashSeatsSold: number;
  totalGrossZar: number;
  digitalGrossZar: number;
  cashGrossZar: number;
  saasPlatformFeeZar: number; // Daily fraction of R499/mo (R16.63)
  netOwnerPayoutZar: number;
} {
  const trips = getMinibusTrips();
  const filtered = trips.filter(t => !vehicleId || t.vehicleId === vehicleId);

  const totalSeats = filtered.reduce((acc, t) => acc + (t.digitalSeatsFilled + t.cashSeatsFilled), 0);
  const digitalSeats = filtered.reduce((acc, t) => acc + t.digitalSeatsFilled, 0);
  const cashSeats = filtered.reduce((acc, t) => acc + t.cashSeatsFilled, 0);
  const gross = filtered.reduce((acc, t) => acc + t.totalRevenueZar, 0);

  // 15-seater avg fare calculation
  const digitalGross = filtered.reduce((acc, t) => {
    const avgFare = (t.digitalSeatsFilled + t.cashSeatsFilled) > 0 ? (t.totalRevenueZar / (t.digitalSeatsFilled + t.cashSeatsFilled)) : 16;
    return acc + (t.digitalSeatsFilled * avgFare);
  }, 0);
  const cashGross = gross - digitalGross;

  const dailySaasFee = 16.63; // R499 / 30 days
  const netPayout = Math.max(0, gross - dailySaasFee);

  return {
    date: dateStr || new Date().toISOString().split('T')[0],
    tripsCount: filtered.length,
    totalSeatsSold: totalSeats,
    digitalSeatsSold: digitalSeats,
    cashSeatsSold: cashSeats,
    totalGrossZar: Math.round(gross * 100) / 100,
    digitalGrossZar: Math.round(digitalGross * 100) / 100,
    cashGrossZar: Math.round(cashGross * 100) / 100,
    saasPlatformFeeZar: dailySaasFee,
    netOwnerPayoutZar: Math.round(netPayout * 100) / 100,
  };
}
