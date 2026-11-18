/**
 * SOLO Minibus Fleet & Rank Operations Type Definitions
 * South African Minibus Taxi Associations, 15-Seater Fleets, Corridors, and Seat Manifests.
 */

export type VehicleStatus = 'active' | 'maintenance' | 'inactive' | 'suspended';

export type MinibusTripStatus = 'boarding' | 'in_transit' | 'completed' | 'cancelled';

export type SeatPaymentMethod = 'digital_paystack' | 'cash' | 'qr_wallet';

export type SeatLoggedBy = 'commuter_scan' | 'conductor_manual' | 'marshal_manual';

export interface TaxiAssociation {
  id: string;
  name: string;
  shortCode?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  operatingCity: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface MinibusVehicle {
  id: string;
  associationId?: string | null;
  ownerId?: string | null;
  registrationPlate: string;
  vinNumber?: string | null;
  make: string;
  model: string;
  capacity: number;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MinibusCorridor {
  id: string;
  originRank: string;
  destination: string;
  standardFareZar: number;
  distanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface MinibusTrip {
  id: string;
  vehicleId: string;
  corridorId: string;
  driverId?: string | null;
  marshalId?: string | null;
  status: MinibusTripStatus;
  totalSeats: number;
  digitalSeatsFilled: number;
  cashSeatsFilled: number;
  totalRevenueZar: number;
  dispatchedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeatLedgerEntry {
  id: string;
  tripId: string;
  seatNumber: number; // 1 to 15
  paymentMethod: SeatPaymentMethod;
  fareAmountZar: number;
  passengerPhone?: string | null;
  passengerName?: string | null;
  loggedBy: SeatLoggedBy;
  createdAt: string;
}
