"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  QrCode,
  Banknote,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  RefreshCw,
  Phone,
  AlertCircle,
  Zap,
  Smartphone,
  Plus,
  Compass,
  Check,
  Volume2,
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
  removeSeatFromLedger,
  seedMinibusDataIfNeeded,
} from "@/utils/minibusStore";

export default function ConductorCompanionPage() {
  const [trips, setTrips] = useState<MinibusTrip[]>([]);
  const [vehicles, setVehicles] = useState<MinibusVehicle[]>([]);
  const [corridors, setCorridors] = useState<MinibusCorridor[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [seatLedger, setSeatLedger] = useState<SeatLedgerEntry[]>([]);
  
  // Modals
  const [showCashModal, setShowCashModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [targetSeatForCash, setTargetSeatForCash] = useState<number | null>(null);
  const [cashPhoneInput, setCashPhoneInput] = useState("");
  const [cashNameInput, setCashNameInput] = useState("");
  const [customFareInput, setCustomFareInput] = useState<number>(16);

  // Success chime / visual flash
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Initialize data
  const loadData = () => {
    seedMinibusDataIfNeeded();
    const loadedTrips = getMinibusTrips();
    const loadedVehicles = getVehicles();
    const loadedCorridors = getCorridors();

    setTrips(loadedTrips);
    setVehicles(loadedVehicles);
    setCorridors(loadedCorridors);

    // Default to the first active loading trip
    if (!selectedTripId && loadedTrips.length > 0) {
      const active = loadedTrips.find(t => t.status === "boarding") || loadedTrips[0];
      setSelectedTripId(active.id);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000); // Poll for realtime updates
    return () => clearInterval(interval);
  }, []);

  // Update seats when trip changes
  useEffect(() => {
    if (selectedTripId) {
      const seats = getSeatLedger(selectedTripId);
      setSeatLedger(seats);
    }
  }, [selectedTripId, trips]);

  const currentTrip = useMemo(() => {
    return trips.find(t => t.id === selectedTripId) || trips[0];
  }, [trips, selectedTripId]);

  const currentVehicle = useMemo(() => {
    if (!currentTrip) return null;
    return vehicles.find(v => v.id === currentTrip.vehicleId);
  }, [vehicles, currentTrip]);

  const currentCorridor = useMemo(() => {
    if (!currentTrip) return null;
    return corridors.find(c => c.id === currentTrip.corridorId);
  }, [corridors, currentTrip]);

  useEffect(() => {
    if (currentCorridor) {
      setCustomFareInput(currentCorridor.standardFareZar);
    }
  }, [currentCorridor]);

  // Seat state map (1 to 15)
  const seatMap = useMemo(() => {
    const map: Record<number, SeatLedgerEntry | undefined> = {};
    for (let i = 1; i <= 15; i++) {
      map[i] = seatLedger.find(s => s.seatNumber === i);
    }
    return map;
  }, [seatLedger]);

  const totalOccupied = (currentTrip?.digitalSeatsFilled || 0) + (currentTrip?.cashSeatsFilled || 0);
  const isFull = totalOccupied >= 15;

  // Handle seat click
  const handleSeatClick = (seatNum: number) => {
    const existing = seatMap[seatNum];
    if (existing) {
      // Prompt to remove / refund
      if (confirm(`Seat #${seatNum} is occupied by ${existing.passengerName} (${existing.paymentMethod === 'cash' ? 'Cash' : 'Digital'}). Remove/Vacate seat?`)) {
        removeSeatFromLedger(currentTrip.id, seatNum);
        loadData();
        setBannerNotice(`Seat #${seatNum} has been marked available.`);
        setTimeout(() => setBannerNotice(null), 3000);
      }
    } else {
      // Open Quick Cash logger for this seat
      setTargetSeatForCash(seatNum);
      setShowCashModal(true);
    }
  };

  // Quick next available seat for floating "+1 Cash Seat" button
  const handleQuickAddCash = () => {
    for (let i = 1; i <= 15; i++) {
      if (!seatMap[i]) {
        setTargetSeatForCash(i);
        setShowCashModal(true);
        return;
      }
    }
    alert("Minibus is fully loaded! All 15 seats are occupied.");
  };

  const handleConfirmCashSeat = () => {
    if (!targetSeatForCash || !currentTrip) return;

    const result = logSeatInLedger({
      tripId: currentTrip.id,
      seatNumber: targetSeatForCash,
      paymentMethod: "cash",
      fareAmount: customFareInput || 16.00,
      passengerPhone: cashPhoneInput.trim(),
      passengerName: cashNameInput.trim() || `Cash Seat #${targetSeatForCash}`,
      loggedBy: "conductor_manual",
    });

    if (result.success) {
      setShowCashModal(false);
      setCashPhoneInput("");
      setCashNameInput("");
      setTargetSeatForCash(null);
      loadData();

      setBannerNotice(`Seat #${targetSeatForCash} logged as CASH (R${customFareInput.toFixed(2)}).`);
      setTimeout(() => setBannerNotice(null), 3500);
    } else {
      alert(result.error || "Failed to log seat");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/minibus"
              className="p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            >
              <ChevronLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                  Toyota Quantum 15-Seater
                </span>
                <span className="text-xs text-zinc-400 font-mono font-bold">
                  {currentVehicle?.registrationPlate || "CC 44 NC"}
                </span>
              </div>
              <h1 className="text-sm font-extrabold text-white truncate max-w-[220px]">
                {currentCorridor?.destination || "Galeshewe Zone 4"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-md transition"
            >
              <QrCode size={16} />
              <span>Rank QR</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Banner Alert */}
        {bannerNotice && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in duration-200">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span>{bannerNotice}</span>
          </div>
        )}

        {/* Live Trip Status Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isFull ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                {currentTrip?.status === "boarding" ? (isFull ? "Ready for Dispatch" : "Boarding at Rank") : "In Transit"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-zinc-400 font-medium">Standard Fare</span>
              <p className="text-sm font-black text-emerald-400">
                R{currentCorridor?.standardFareZar?.toFixed(2) || "16.00"}
              </p>
            </div>
          </div>

          {/* Occupancy Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-200">
                {totalOccupied} of 15 Seats Filled
              </span>
              <span className="font-mono font-bold text-emerald-400">
                {Math.round((totalOccupied / 15) * 100)}% Capacity
              </span>
            </div>
            <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${(currentTrip?.digitalSeatsFilled / 15) * 100}%` }}
                className="bg-emerald-500 transition-all duration-300"
                title="Digital QR Seats"
              />
              <div
                style={{ width: `${(currentTrip?.cashSeatsFilled / 15) * 100}%` }}
                className="bg-amber-400 transition-all duration-300"
                title="Cash Seats"
              />
            </div>
          </div>

          {/* Mini Revenue Ticker */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-800/80 text-center text-xs">
            <div className="bg-zinc-950/60 p-2 rounded-xl border border-zinc-800/50">
              <span className="text-zinc-400 block text-[10px] uppercase font-bold">Total ZAR</span>
              <span className="font-black text-white text-sm">
                R{currentTrip?.totalRevenueZar?.toFixed(2) || "0.00"}
              </span>
            </div>
            <div className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/20">
              <span className="text-emerald-400 block text-[10px] uppercase font-bold">Digital (QR)</span>
              <span className="font-black text-emerald-300 text-sm">
                {currentTrip?.digitalSeatsFilled || 0} seats
              </span>
            </div>
            <div className="bg-amber-950/40 p-2 rounded-xl border border-amber-500/20">
              <span className="text-amber-400 block text-[10px] uppercase font-bold">Cash Logged</span>
              <span className="font-black text-amber-300 text-sm">
                {currentTrip?.cashSeatsFilled || 0} seats
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-zinc-400 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/60">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-emerald-500" />
            <span>Digital (QR / Paystack)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-amber-400" />
            <span>Cash Logged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-zinc-800 border border-zinc-700" />
            <span>Available</span>
          </div>
        </div>

        {/* Interactive 15-Seat Toyota Quantum Cabin Map */}
        <div className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          {/* Vehicle Front Windshield Indicator */}
          <div className="w-full text-center pb-4 mb-2 border-b border-zinc-800/80">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-950 rounded-full border border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
              <span>Front Windshield / Driver Cabin</span>
            </div>
          </div>

          {/* Front Row (Driver + Seat 1) */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {/* Front Passenger (Seat 1) */}
            <SeatButton
              seatNumber={1}
              seatData={seatMap[1]}
              onClick={() => handleSeatClick(1)}
              label="Seat 1 (Window)"
            />
            {/* Aisle space */}
            <div className="col-span-2 flex items-center justify-center text-zinc-600 text-[11px] font-bold tracking-wider uppercase">
              Cabin Aisle
            </div>
            {/* Driver Seat (Disabled) */}
            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-500 opacity-80 cursor-not-allowed">
              <span className="text-xs">🚗</span>
              <span className="text-[10px] font-black uppercase mt-1">Driver</span>
            </div>
          </div>

          {/* Row 1: Seats 2, 3, 4 */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <SeatButton seatNumber={2} seatData={seatMap[2]} onClick={() => handleSeatClick(2)} />
            <SeatButton seatNumber={3} seatData={seatMap[3]} onClick={() => handleSeatClick(3)} />
            <div className="flex items-center justify-center text-zinc-700 text-xs">🚶</div>
            <SeatButton seatNumber={4} seatData={seatMap[4]} onClick={() => handleSeatClick(4)} />
          </div>

          {/* Row 2: Seats 5, 6, 7 */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <SeatButton seatNumber={5} seatData={seatMap[5]} onClick={() => handleSeatClick(5)} />
            <SeatButton seatNumber={6} seatData={seatMap[6]} onClick={() => handleSeatClick(6)} />
            <div className="flex items-center justify-center text-zinc-700 text-xs">🚶</div>
            <SeatButton seatNumber={7} seatData={seatMap[7]} onClick={() => handleSeatClick(7)} />
          </div>

          {/* Row 3: Seats 8, 9, 10 */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <SeatButton seatNumber={8} seatData={seatMap[8]} onClick={() => handleSeatClick(8)} />
            <SeatButton seatNumber={9} seatData={seatMap[9]} onClick={() => handleSeatClick(9)} />
            <div className="flex items-center justify-center text-zinc-700 text-xs">🚶</div>
            <SeatButton seatNumber={10} seatData={seatMap[10]} onClick={() => handleSeatClick(10)} />
          </div>

          {/* Back Full Row: Seats 11, 12, 13, 14, 15 (Wide 5-seater bench) */}
          <div className="grid grid-cols-5 gap-2 pt-2 border-t border-zinc-800/60">
            <SeatButton seatNumber={11} seatData={seatMap[11]} onClick={() => handleSeatClick(11)} />
            <SeatButton seatNumber={12} seatData={seatMap[12]} onClick={() => handleSeatClick(12)} />
            <SeatButton seatNumber={13} seatData={seatMap[13]} onClick={() => handleSeatClick(13)} />
            <SeatButton seatNumber={14} seatData={seatMap[14]} onClick={() => handleSeatClick(14)} />
            <SeatButton seatNumber={15} seatData={seatMap[15]} onClick={() => handleSeatClick(15)} />
          </div>
          
          <p className="text-center text-[11px] text-zinc-500 mt-4">
            Tap an empty seat to log cash. Tap an occupied seat to inspect or vacate.
          </p>
        </div>

        {/* Quick Corridor / Vehicle Switcher */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 space-y-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
            Select Active Rank Vehicle / Trip
          </label>
          <select
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
          >
            {trips.map(t => {
              const v = vehicles.find(veh => veh.id === t.vehicleId);
              const c = corridors.find(cor => cor.id === t.corridorId);
              return (
                <option key={t.id} value={t.id}>
                  {v?.registrationPlate} • {c?.destination} ({t.digitalSeatsFilled + t.cashSeatsFilled}/15)
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Floating Bottom Quick-Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-800 z-30">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={handleQuickAddCash}
            disabled={isFull}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-zinc-950 font-black rounded-2xl shadow-lg active:scale-95 transition"
          >
            <Plus size={20} className="stroke-[3]" />
            <span className="text-sm">+1 Cash Seat (R{customFareInput})</span>
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center justify-center p-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded-2xl shadow-md active:scale-95 transition"
            title="Display Commuter Boarding QR"
          >
            <QrCode size={22} className="text-purple-400" />
          </button>
        </div>
      </div>

      {/* Micro-Modal: Quick Cash Logger */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Log Cash Fare</h3>
                  <p className="text-xs text-zinc-400">Assigning to Seat #{targetSeatForCash}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCashModal(false)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">
                  Standard Corridor Fare (ZAR)
                </label>
                <input
                  type="number"
                  value={customFareInput}
                  onChange={(e) => setCustomFareInput(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-black text-emerald-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">
                  Passenger Mobile (Optional - for SMS/WhatsApp Slip)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 082 123 4567"
                  value={cashPhoneInput}
                  onChange={(e) => setCashPhoneInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-amber-500 placeholder:text-zinc-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">
                  Passenger Name / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash Commuter"
                  value={cashNameInput}
                  onChange={(e) => setCashNameInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-amber-500 placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => setShowCashModal(false)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCashSeat}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20"
              >
                Confirm Cash R{customFareInput}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Micro-Modal: Commuter Vehicle Boarding QR */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-purple-500/40 w-full max-w-sm rounded-3xl p-6 text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <XCircle size={22} />
            </button>

            <div className="inline-flex p-3 bg-purple-500/20 text-purple-300 rounded-2xl mb-1">
              <QrCode size={32} />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/30">
                Scan to Pay &amp; Board
              </span>
              <h3 className="font-extrabold text-lg text-white">
                {currentVehicle?.registrationPlate}
              </h3>
              <p className="text-xs text-zinc-400">
                {currentCorridor?.originRank} ➔ {currentCorridor?.destination}
              </p>
            </div>

            {/* Generated QR Code SVG Box */}
            <div className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/minibus/board?tripId=${currentTrip?.id}&vehicle=${currentVehicle?.registrationPlate}&fare=${currentCorridor?.standardFareZar}`
                    : `https://soloapp.co.za/minibus/board?tripId=${currentTrip?.id}`
                )}`}
                alt="Commuter Boarding QR"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="text-xs text-zinc-300 space-y-1">
              <p className="font-bold">Show this screen to passengers in the rank queue.</p>
              <p className="text-[11px] text-zinc-500">
                Commuters scan with their camera, choose their seat, and pay R{currentCorridor?.standardFareZar} via Paystack.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href={`/minibus/board?tripId=${currentTrip?.id}&vehicle=${currentVehicle?.registrationPlate}&fare=${currentCorridor?.standardFareZar}`}
                className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-bold underline underline-offset-4"
              >
                <span>Preview Commuter Boarding Screen</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Seat Button Component representing individual Quantum seat
function SeatButton({
  seatNumber,
  seatData,
  onClick,
  label,
}: {
  seatNumber: number;
  seatData?: SeatLedgerEntry;
  onClick: () => void;
  label?: string;
}) {
  const isOccupied = !!seatData;
  const isDigital = seatData?.paymentMethod === "digital_paystack" || seatData?.paymentMethod === "qr_wallet";
  const isCash = seatData?.paymentMethod === "cash";

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 shadow-sm min-h-[72px] ${
        isDigital
          ? "bg-emerald-950/70 border-emerald-500 text-emerald-300"
          : isCash
          ? "bg-amber-950/70 border-amber-400 text-amber-300"
          : "bg-zinc-950 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-zinc-400"
      }`}
    >
      <span className="text-xs font-mono font-black">
        #{seatNumber}
      </span>
      <span className="text-[10px] font-bold mt-0.5 truncate max-w-[50px]">
        {isDigital ? "QR Paid" : isCash ? "Cash" : "Empty"}
      </span>

      {/* Tiny Status Dot */}
      <span
        className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
          isDigital ? "bg-emerald-400" : isCash ? "bg-amber-400" : "bg-zinc-700"
        }`}
      />
    </button>
  );
}
