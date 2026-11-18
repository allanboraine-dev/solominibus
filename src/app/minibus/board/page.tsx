"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  QrCode,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ChevronLeft,
  ArrowRight,
  Sparkles,
  Lock,
  Compass,
} from "lucide-react";
import {
  MinibusTrip,
  MinibusVehicle,
  MinibusCorridor,
  SeatLedgerEntry,
  getMinibusTrips,
  getVehicles,
  getCorridors,
  getSeatLedger,
  logSeatInLedger,
  seedMinibusDataIfNeeded,
} from "@/utils/minibusStore";

function CommuterBoardingContent() {
  const searchParams = useSearchParams();
  const paramTripId = searchParams.get("tripId");
  const paramVehicle = searchParams.get("vehicle");
  const paramFare = searchParams.get("fare");

  const [trips, setTrips] = useState<MinibusTrip[]>([]);
  const [vehicles, setVehicles] = useState<MinibusVehicle[]>([]);
  const [corridors, setCorridors] = useState<MinibusCorridor[]>([]);
  const [seatLedger, setSeatLedger] = useState<SeatLedgerEntry[]>([]);

  // Selection
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedSeat, setConfirmedSeat] = useState<SeatLedgerEntry | null>(null);

  const loadData = () => {
    seedMinibusDataIfNeeded();
    setTrips(getMinibusTrips());
    setVehicles(getVehicles());
    setCorridors(getCorridors());
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentTrip = useMemo(() => {
    if (paramTripId) {
      const match = trips.find(t => t.id === paramTripId);
      if (match) return match;
    }
    return trips.find(t => t.status === "boarding") || trips[0];
  }, [trips, paramTripId]);

  useEffect(() => {
    if (currentTrip) {
      setSeatLedger(getSeatLedger(currentTrip.id));
    }
  }, [currentTrip, trips]);

  const currentVehicle = useMemo(() => {
    if (!currentTrip) return null;
    return vehicles.find(v => v.id === currentTrip.vehicleId);
  }, [vehicles, currentTrip]);

  const currentCorridor = useMemo(() => {
    if (!currentTrip) return null;
    return corridors.find(c => c.id === currentTrip.corridorId);
  }, [corridors, currentTrip]);

  const occupiedMap = useMemo(() => {
    const map: Record<number, boolean> = {};
    seatLedger.forEach(s => {
      map[s.seatNumber] = true;
    });
    return map;
  }, [seatLedger]);

  const fareZar = Number(paramFare) || currentCorridor?.standardFareZar || 16.00;

  const handlePaystackCheckout = () => {
    if (!selectedSeat) {
      alert("Please tap a seat to select where you want to sit.");
      return;
    }
    if (!phone.trim()) {
      alert("Please provide your mobile phone number for your digital boarding pass.");
      return;
    }

    setIsProcessing(true);

    // Simulate Paystack processing (or live Paystack redirect)
    setTimeout(() => {
      if (!currentTrip) return;

      const result = logSeatInLedger({
        tripId: currentTrip.id,
        seatNumber: selectedSeat,
        paymentMethod: "digital_paystack",
        fareAmount: fareZar,
        passengerPhone: phone.trim(),
        passengerName: name.trim() || `Commuter #${selectedSeat}`,
        loggedBy: "commuter_scan",
      });

      setIsProcessing(false);

      if (result.success && result.seat) {
        setConfirmedSeat(result.seat);
      } else {
        alert(result.error || "Payment succeeded but seat reservation failed.");
      }
    }, 1200);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href="/minibus"
            className="p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-500/30">
              SOLO Fast-Boarding Pass
            </span>
            <h1 className="text-sm font-extrabold text-white truncate">
              {currentVehicle?.registrationPlate || paramVehicle || "CC 44 NC"}
            </h1>
          </div>
          <div className="w-8" />
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Confirmed Boarding Pass Modal/Screen */}
        {confirmedSeat ? (
          <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-emerald-500/60 rounded-3xl p-6 text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="inline-flex p-4 bg-emerald-500/20 text-emerald-400 rounded-3xl ring-8 ring-emerald-500/10">
              <CheckCircle2 size={44} />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                Payment Successful • Seat Reserved
              </span>
              <h2 className="text-2xl font-black text-white font-mono">
                Seat #{confirmedSeat.seatNumber}
              </h2>
              <p className="text-xs text-zinc-400">
                {currentCorridor?.originRank} ➔ {currentCorridor?.destination}
              </p>
            </div>

            {/* Boarding Slip Box */}
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Vehicle:</span>
                <span className="font-mono font-bold text-white">{currentVehicle?.registrationPlate}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Driver:</span>
                <span className="font-bold text-white">{currentTrip?.driverName}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Fare Paid:</span>
                <span className="font-black text-emerald-400 font-mono">R{fareZar.toFixed(2)} (Paystack)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Passenger Phone:</span>
                <span className="font-bold text-white">{confirmedSeat.passengerPhone}</span>
              </div>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-2xl text-xs text-emerald-300 font-bold">
              ✓ Conductor's vehicle cabin screen has turned Green for Seat #{confirmedSeat.seatNumber}. Simply board the vehicle!
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/minibus/conductor"
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs rounded-2xl shadow-lg transition"
              >
                View on Conductor Cabin Map
              </Link>
              <button
                onClick={() => {
                  setConfirmedSeat(null);
                  setSelectedSeat(null);
                  loadData();
                }}
                className="w-full py-3 bg-zinc-900 text-zinc-400 font-bold text-xs rounded-2xl"
              >
                Book Another Seat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Route & Vehicle Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Corridor Route
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                  R{fareZar.toFixed(2)} Standard Fare
                </span>
              </div>

              <div>
                <h2 className="text-base font-black text-white">
                  {currentCorridor?.originRank}
                </h2>
                <div className="text-xs text-amber-400 font-bold my-1">
                  ➔ {currentCorridor?.destination}
                </div>
                <p className="text-xs text-zinc-500">
                  Toyota Quantum 15-Seater • Reg: <strong className="text-zinc-300">{currentVehicle?.registrationPlate}</strong>
                </p>
              </div>
            </div>

            {/* Interactive Seat Selector */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">
                  Tap to Choose Your Seat (1 - 15)
                </h3>
                <span className="text-[11px] text-zinc-500">
                  {selectedSeat ? `Seat #${selectedSeat} Selected` : "Tap an empty seat"}
                </span>
              </div>

              {/* Quantum 15-Seat Grid */}
              <div className="space-y-3 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/80">
                <div className="text-center pb-2 text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  Driver Front
                </div>

                {/* Front Row */}
                <div className="grid grid-cols-4 gap-2">
                  <CommuterSeatBtn
                    seatNum={1}
                    isOccupied={occupiedMap[1]}
                    isSelected={selectedSeat === 1}
                    onSelect={() => setSelectedSeat(1)}
                  />
                  <div className="col-span-2 flex items-center justify-center text-zinc-700 text-[10px] uppercase font-bold">
                    Aisle
                  </div>
                  <div className="flex items-center justify-center p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 text-[10px] font-black uppercase">
                    Driver
                  </div>
                </div>

                {/* Row 1 */}
                <div className="grid grid-cols-4 gap-2">
                  <CommuterSeatBtn seatNum={2} isOccupied={occupiedMap[2]} isSelected={selectedSeat === 2} onSelect={() => setSelectedSeat(2)} />
                  <CommuterSeatBtn seatNum={3} isOccupied={occupiedMap[3]} isSelected={selectedSeat === 3} onSelect={() => setSelectedSeat(3)} />
                  <div className="flex items-center justify-center text-zinc-800 text-xs">🚶</div>
                  <CommuterSeatBtn seatNum={4} isOccupied={occupiedMap[4]} isSelected={selectedSeat === 4} onSelect={() => setSelectedSeat(4)} />
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-4 gap-2">
                  <CommuterSeatBtn seatNum={5} isOccupied={occupiedMap[5]} isSelected={selectedSeat === 5} onSelect={() => setSelectedSeat(5)} />
                  <CommuterSeatBtn seatNum={6} isOccupied={occupiedMap[6]} isSelected={selectedSeat === 6} onSelect={() => setSelectedSeat(6)} />
                  <div className="flex items-center justify-center text-zinc-800 text-xs">🚶</div>
                  <CommuterSeatBtn seatNum={7} isOccupied={occupiedMap[7]} isSelected={selectedSeat === 7} onSelect={() => setSelectedSeat(7)} />
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-4 gap-2">
                  <CommuterSeatBtn seatNum={8} isOccupied={occupiedMap[8]} isSelected={selectedSeat === 8} onSelect={() => setSelectedSeat(8)} />
                  <CommuterSeatBtn seatNum={9} isOccupied={occupiedMap[9]} isSelected={selectedSeat === 9} onSelect={() => setSelectedSeat(9)} />
                  <div className="flex items-center justify-center text-zinc-800 text-xs">🚶</div>
                  <CommuterSeatBtn seatNum={10} isOccupied={occupiedMap[10]} isSelected={selectedSeat === 10} onSelect={() => setSelectedSeat(10)} />
                </div>

                {/* Back 5-seater Row */}
                <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-zinc-800/80">
                  <CommuterSeatBtn seatNum={11} isOccupied={occupiedMap[11]} isSelected={selectedSeat === 11} onSelect={() => setSelectedSeat(11)} />
                  <CommuterSeatBtn seatNum={12} isOccupied={occupiedMap[12]} isSelected={selectedSeat === 12} onSelect={() => setSelectedSeat(12)} />
                  <CommuterSeatBtn seatNum={13} isOccupied={occupiedMap[13]} isSelected={selectedSeat === 13} onSelect={() => setSelectedSeat(13)} />
                  <CommuterSeatBtn seatNum={14} isOccupied={occupiedMap[14]} isSelected={selectedSeat === 14} onSelect={() => setSelectedSeat(14)} />
                  <CommuterSeatBtn seatNum={15} isOccupied={occupiedMap[15]} isSelected={selectedSeat === 15} onSelect={() => setSelectedSeat(15)} />
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-zinc-800 border border-zinc-700" /> Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-purple-600" /> Selected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-zinc-900 border border-red-500/30 text-red-400 opacity-60" /> Occupied
                </span>
              </div>
            </div>

            {/* Commuter Information & Checkout */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">
                Passenger Details &amp; Mobile Boarding Pass
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">
                    Mobile Phone Number (Required for WhatsApp ticket)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 082 555 1234"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-purple-500 placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">
                    Passenger Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kagiso M."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-purple-500 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Paystack Payment Button */}
              <button
                onClick={handlePaystackCheckout}
                disabled={isProcessing || !selectedSeat}
                className="w-full py-4 px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl shadow-purple-600/30 active:scale-95 transition flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <span>Processing Paystack Payment...</span>
                ) : (
                  <>
                    <CreditCard size={18} />
                    <span>
                      {selectedSeat
                        ? `Pay R${fareZar.toFixed(2)} (Seat #${selectedSeat})`
                        : "Select a Seat to Pay"}
                    </span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                <Lock size={12} />
                <span>Secured by Paystack • Instant Card, Apple Pay, &amp; Capitec Pay</span>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function CommuterBoardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-white p-8">Loading Boarding Pass...</div>}>
      <CommuterBoardingContent />
    </Suspense>
  );
}

function CommuterSeatBtn({
  seatNum,
  isOccupied,
  isSelected,
  onSelect,
}: {
  seatNum: number;
  isOccupied: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      disabled={isOccupied}
      onClick={onSelect}
      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
        isOccupied
          ? "bg-zinc-900 border-zinc-800/60 text-zinc-600 cursor-not-allowed opacity-50"
          : isSelected
          ? "bg-purple-600 border-purple-400 text-white scale-105 shadow-lg shadow-purple-600/40"
          : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 active:scale-95"
      }`}
    >
      <span className="text-xs font-mono font-bold">#{seatNum}</span>
      <span className="text-[9px] font-black mt-0.5">
        {isOccupied ? "Taken" : isSelected ? "Chosen" : "Empty"}
      </span>
    </button>
  );
}
