"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Compass,
  Users,
  Clock,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Plus,
  Car,
  Filter,
  Volume2,
  Sparkles,
  ShieldCheck,
  Send,
  Building2,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import {
  MinibusTrip,
  MinibusVehicle,
  MinibusCorridor,
  getMinibusTrips,
  getVehicles,
  getCorridors,
  dispatchMinibusTrip,
  registerVehicleInRankQueue,
  seedMinibusDataIfNeeded,
} from "@/utils/minibusStore";

export default function RankMarshalDispatchPage() {
  const [trips, setTrips] = useState<MinibusTrip[]>([]);
  const [vehicles, setVehicles] = useState<MinibusVehicle[]>([]);
  const [corridors, setCorridors] = useState<MinibusCorridor[]>([]);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>("all");
  
  // Registration modal for arriving taxis
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlateInput, setNewPlateInput] = useState("");
  const [newDriverInput, setNewDriverInput] = useState("");
  const [newCorridorSelect, setNewCorridorSelect] = useState("");

  const [dispatchAlert, setDispatchAlert] = useState<string | null>(null);

  const loadData = () => {
    seedMinibusDataIfNeeded();
    setTrips(getMinibusTrips());
    setVehicles(getVehicles());
    const corrs = getCorridors();
    setCorridors(corrs);
    if (!newCorridorSelect && corrs.length > 0) {
      setNewCorridorSelect(corrs[0].id);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Filter trips
  const activeQueue = useMemo(() => {
    return trips
      .filter(t => t.status === "boarding")
      .filter(t => selectedCorridorId === "all" || t.corridorId === selectedCorridorId)
      .sort((a, b) => a.queuePosition - b.queuePosition);
  }, [trips, selectedCorridorId]);

  const inTransitTrips = useMemo(() => {
    return trips
      .filter(t => t.status === "in_transit")
      .sort((a, b) => new Date(b.dispatchedAt || 0).getTime() - new Date(a.dispatchedAt || 0).getTime())
      .slice(0, 5);
  }, [trips]);

  // Loading bay vehicle (position 1)
  const loadingBayVehicle = activeQueue[0];

  const handleDispatch = (tripId: string) => {
    const result = dispatchMinibusTrip(tripId, "marshal-kby-main");
    if (result.success) {
      loadData();
      const v = vehicles.find(veh => veh.id === result.dispatchedTrip?.vehicleId);
      const c = corridors.find(cor => cor.id === result.dispatchedTrip?.corridorId);
      setDispatchAlert(
        `🚨 DISPATCH CONFIRMED: ${v?.registrationPlate} departing for ${c?.destination}! Next minibus promoted to Loading Bay.`
      );
      setTimeout(() => setDispatchAlert(null), 5000);
    }
  };

  const handleAddVehicleToQueue = () => {
    if (!newPlateInput.trim() || !newDriverInput.trim() || !newCorridorSelect) {
      alert("Please fill in plate number, driver name, and corridor route.");
      return;
    }

    let existingVeh = vehicles.find(v => v.registrationPlate.toLowerCase() === newPlateInput.trim().toLowerCase());
    let vehicleId = existingVeh?.id;

    if (!vehicleId) {
      vehicleId = `veh-custom-${Date.now().toString().slice(-4)}`;
    }

    registerVehicleInRankQueue({
      vehicleId,
      corridorId: newCorridorSelect,
      driverId: `drv-${Date.now().toString().slice(-4)}`,
      driverName: newDriverInput.trim(),
      driverPhone: '+27 82 123 4567',
      marshalId: 'marshal-kby-main',
    });

    setShowAddModal(false);
    setNewPlateInput("");
    setNewDriverInput("");
    loadData();
    setDispatchAlert(`Minibus ${newPlateInput.toUpperCase()} added to Rank Queue.`);
    setTimeout(() => setDispatchAlert(null), 4000);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/minibus"
              className="p-2 -ml-1 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition"
            >
              <ChevronLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  Rank Master Mode
                </span>
                <span className="text-xs text-zinc-400 font-bold hidden sm:inline">
                  SANTACO Kimberley Main Rank
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-extrabold text-white">
                Rank Marshal Queue &amp; Dispatch
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-zinc-950 font-black px-3.5 py-2 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition"
            >
              <Plus size={16} className="stroke-[3]" />
              <span className="hidden sm:inline">Check-In Minibus</span>
              <span className="sm:hidden">Check-In</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Dispatch Alert Toast */}
        {dispatchAlert && (
          <div className="bg-amber-500/20 border border-amber-500/50 text-amber-300 p-4 rounded-3xl flex items-center gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
            <Sparkles size={20} className="shrink-0 text-amber-400" />
            <span className="font-extrabold text-sm">{dispatchAlert}</span>
          </div>
        )}

        {/* Corridor Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCorridorId("all")}
            className={`px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition border ${
              selectedCorridorId === "all"
                ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-md"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            All Corridors ({activeQueue.length})
          </button>
          {corridors.map(c => {
            const count = trips.filter(t => t.corridorId === c.id && t.status === "boarding").length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCorridorId(c.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition border ${
                  selectedCorridorId === c.id
                    ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-md"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                }`}
              >
                {c.destination} ({count})
              </button>
            );
          })}
        </div>

        {/* BAY 1: CURRENT ACTIVE LOADING VEHICLE */}
        {loadingBayVehicle && (
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-amber-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-amber-500 text-zinc-950 font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-bl-2xl shadow">
              Loading Bay #1 (At Rank Platform)
            </div>

            {(() => {
              const v = vehicles.find(veh => veh.id === loadingBayVehicle.vehicleId);
              const c = corridors.find(cor => cor.id === loadingBayVehicle.corridorId);
              const totalFilled = loadingBayVehicle.digitalSeatsFilled + loadingBayVehicle.cashSeatsFilled;
              const isFull = totalFilled >= 15;

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl sm:text-2xl font-black text-white font-mono">
                          {v?.registrationPlate}
                        </span>
                        <span className="text-xs bg-zinc-800 text-zinc-300 font-bold px-2 py-0.5 rounded">
                          {v?.model}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold text-amber-400">
                        Route: {c?.originRank} ➔ {c?.destination}
                      </p>
                      <p className="text-xs text-zinc-400">
                        Driver: <strong className="text-zinc-200">{loadingBayVehicle.driverName}</strong> ({loadingBayVehicle.driverPhone})
                      </p>
                    </div>

                    {/* Dispatch Action Button */}
                    <div className="shrink-0 flex items-center gap-3">
                      <Link
                        href="/minibus/conductor"
                        className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-2xl transition"
                      >
                        Open In-Vehicle Grid
                      </Link>

                      <button
                        onClick={() => handleDispatch(loadingBayVehicle.id)}
                        className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition ${
                          isFull
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white animate-pulse"
                            : "bg-amber-500 hover:bg-amber-400 text-zinc-950"
                        }`}
                      >
                        <Send size={18} />
                        <span>{isFull ? "Dispatch Vehicle (FULL 15/15)" : "Dispatch Minibus"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Seat Count */}
                  <div className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-zinc-300">
                        Manifest Capacity: <strong className="text-amber-400">{totalFilled} of 15 Seats</strong>
                      </span>
                      <span className="text-emerald-400 font-mono">
                        R{loadingBayVehicle.totalRevenueZar?.toFixed(2)} Collected
                      </span>
                    </div>

                    <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${(loadingBayVehicle.digitalSeatsFilled / 15) * 100}%` }}
                        className="bg-emerald-500"
                        title="Digital QR"
                      />
                      <div
                        style={{ width: `${(loadingBayVehicle.cashSeatsFilled / 15) * 100}%` }}
                        className="bg-amber-400"
                        title="Cash Logged"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                      <span>🟢 Digital QR: {loadingBayVehicle.digitalSeatsFilled} seats</span>
                      <span>🟡 Cash Logged: {loadingBayVehicle.cashSeatsFilled} seats</span>
                      <span>⚪ Available: {15 - totalFilled} seats</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* QUEUED VEHICLES IN LINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-400">
              Rank Queue Line ({activeQueue.length} Active Vehicles)
            </h2>
            <span className="text-xs text-zinc-500">Ordered by arrival timestamp</span>
          </div>

          {activeQueue.length === 0 ? (
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-8 text-center rounded-3xl text-zinc-500 text-xs font-bold">
              No minibus taxis currently in rank queue for this corridor.
            </div>
          ) : (
            <div className="grid gap-3">
              {activeQueue.map((trip, idx) => {
                const v = vehicles.find(veh => veh.id === trip.vehicleId);
                const c = corridors.find(cor => cor.id === trip.corridorId);
                const totalFilled = trip.digitalSeatsFilled + trip.cashSeatsFilled;
                const isBayOne = idx === 0;

                return (
                  <div
                    key={trip.id}
                    className={`p-4 rounded-3xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isBayOne
                        ? "bg-zinc-900/90 border-amber-500/40 shadow-lg"
                        : "bg-zinc-900 border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center font-black text-xs text-amber-400 shrink-0">
                        #{trip.queuePosition}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-sm text-white">
                            {v?.registrationPlate}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {c?.destination}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Driver: {trip.driverName} • {totalFilled}/15 seats filled
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">Status</span>
                        <span className={`text-xs font-bold ${isBayOne ? 'text-amber-400 font-extrabold' : 'text-zinc-400'}`}>
                          {isBayOne ? "At Loading Bay" : "Waiting in Queue"}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDispatch(trip.id)}
                        className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-xs rounded-xl transition"
                      >
                        Force Dispatch
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RECENTLY DISPATCHED IN-TRANSIT VEHICLES */}
        <div className="pt-4 border-t border-zinc-800 space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
            Recently Dispatched (En Route on Corridors)
          </h2>
          <div className="grid gap-2">
            {inTransitTrips.map(trip => {
              const v = vehicles.find(veh => veh.id === trip.vehicleId);
              const c = corridors.find(cor => cor.id === trip.corridorId);
              return (
                <div key={trip.id} className="p-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-mono font-bold text-white">{v?.registrationPlate}</span>
                    <span className="text-zinc-400">➔ {c?.destination}</span>
                  </div>
                  <span className="text-zinc-500 font-mono">
                    Dispatched {trip.dispatchedAt ? new Date(trip.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Check-In Arriving Minibus Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Car size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Check-In Minibus to Queue</h3>
                  <p className="text-xs text-zinc-400">Record incoming Quantum arrival at rank</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">
                  Registration Plate Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. CC 99 NC or CA 749-332"
                  value={newPlateInput}
                  onChange={(e) => setNewPlateInput(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white uppercase focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">
                  Driver Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sipho Ndlovu"
                  value={newDriverInput}
                  onChange={(e) => setNewDriverInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">
                  Assigned Corridor Route
                </label>
                <select
                  value={newCorridorSelect}
                  onChange={(e) => setNewCorridorSelect(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-amber-500 focus:outline-none"
                >
                  {corridors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.originRank} ➔ {c.destination} (R{c.standardFareZar})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddVehicleToQueue}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl shadow-lg"
              >
                Add to Queue Line
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
