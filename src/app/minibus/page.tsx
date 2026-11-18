"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Compass,
  QrCode,
  Banknote,
  Send,
  Building2,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Layers,
  ArrowUpRight,
  Sparkles,
  Smartphone,
  Car,
  Clock,
  CheckCircle2,
  FileText,
  DollarSign,
  Download,
} from "lucide-react";
import {
  getMinibusDailyAudit,
  getMinibusTrips,
  getVehicles,
  getCorridors,
  seedMinibusDataIfNeeded,
} from "@/utils/minibusStore";

export default function MinibusHubPage() {
  const [dailyAudit, setDailyAudit] = useState<any>(null);
  const [tripsCount, setTripsCount] = useState(0);
  const [vehiclesCount, setVehiclesCount] = useState(0);

  useEffect(() => {
    seedMinibusDataIfNeeded();
    setDailyAudit(getMinibusDailyAudit());
    setTripsCount(getMinibusTrips().length);
    setVehiclesCount(getVehicles().length);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-white selection:bg-purple-500 selection:text-white pb-20">
      {/* Hero Header */}
      <div className="relative border-b border-zinc-800 bg-gradient-to-b from-purple-950/40 via-zinc-900 to-zinc-950 pt-8 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} />
              <span>SANTACO 15-Seater Corridor Suite</span>
            </div>

            <Link
              href="/"
              className="text-xs font-bold text-zinc-400 hover:text-white transition flex items-center gap-1"
            >
              <span>Back to SOLO Home</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            SOLO Minibus Transit &amp; Rank Fleet
          </h1>
          <p className="text-sm sm:text-base text-zinc-300 max-w-2xl leading-relaxed">
            Engineered for South African Toyota HiAce and Quantum corridors: multi-passenger QR boarding, conductor cash logging, and rank queue dispatch under SOLO’s flat R499/month zero-commission SaaS model.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Target Fleet</span>
              <span className="text-lg font-black text-white">15-Seater Minibuses</span>
            </div>
            <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Rank Corridors</span>
              <span className="text-lg font-black text-amber-400">5 Active Lines</span>
            </div>
            <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Today's Seats Sold</span>
              <span className="text-lg font-black text-emerald-400">{dailyAudit?.totalSeatsSold || 16} seats</span>
            </div>
            <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Platform Commission</span>
              <span className="text-lg font-black text-purple-400">0% (R499/mo SaaS)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        {/* Core Subsystem Portals */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Smartphone size={20} className="text-purple-400" />
            <span>Dedicated Operating Modules</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            {/* 1. Conductor Companion App */}
            <div className="group relative bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-3xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Banknote size={24} />
                </div>
                <h3 className="text-lg font-black text-white">Conductor / Driver In-Vehicle App</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Interactive 15-seat cabin map with realtime color codes (Green for QR Paystack, Yellow for Cash). Features Quick-Tap +1 Cash logger and dynamic vehicle boarding QR.
                </p>
              </div>

              <div className="pt-6">
                <Link
                  href="/minibus/conductor"
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
                >
                  <span>Open Conductor Cabin</span>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>

            {/* 2. Rank Marshal Dispatch Dashboard */}
            <div className="group relative bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-3xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Compass size={24} />
                </div>
                <h3 className="text-lg font-black text-white">Rank Marshal Queue &amp; Dispatch</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Queue Line Monitor showing parked Quantum taxis ordered by arrival timestamp. One-Tap dispatch button automatically promotes the next queued vehicle when full.
                </p>
              </div>

              <div className="pt-6">
                <Link
                  href="/minibus/marshal"
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition"
                >
                  <span>Open Marshal Dashboard</span>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>

            {/* 3. Commuter QR Boarding Pass */}
            <div className="group relative bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 rounded-3xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <QrCode size={24} />
                </div>
                <h3 className="text-lg font-black text-white">Commuter QR Fast-Boarding</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Passengers waiting in rank queues scan the vehicle QR code, select an available seat (1-15), pay instantly via Paystack (Card, Apple Pay, Instant EFT), and receive an instant boarding slip.
                </p>
              </div>

              <div className="pt-6">
                <Link
                  href="/minibus/board"
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition"
                >
                  <span>Test Commuter QR Pass</span>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Owner Financial Audit & Bankable Revenue Ledger */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
                <ShieldCheck size={16} />
                <span>SARS-Compliant &amp; Bankable Digital Audit</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Fleet Owner Daily Revenue Reconciliation
              </h2>
              <p className="text-xs text-zinc-400">
                End-of-day reconciliation across digital Paystack collections and conductor cash takings.
              </p>
            </div>

            <button
              onClick={() => alert("Exporting Bank-Grade Settlement Statement (CSV/PDF)...")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl transition"
            >
              <Download size={15} />
              <span>Export Audit</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Gross Revenue</span>
              <p className="text-2xl font-black text-white font-mono mt-1">
                R{dailyAudit?.totalGrossZar?.toFixed(2) || "266.00"}
              </p>
              <span className="text-[10px] text-zinc-500 mt-1 block">Combined Cash + Digital</span>
            </div>

            <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-500/30">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Digital (Paystack / QR)</span>
              <p className="text-2xl font-black text-emerald-300 font-mono mt-1">
                R{dailyAudit?.digitalGrossZar?.toFixed(2) || "100.00"}
              </p>
              <span className="text-[10px] text-emerald-400/70 mt-1 block">Instant Bank Settlement</span>
            </div>

            <div className="bg-amber-950/40 p-4 rounded-2xl border border-amber-500/30">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Cash Logged</span>
              <p className="text-2xl font-black text-amber-300 font-mono mt-1">
                R{dailyAudit?.cashGrossZar?.toFixed(2) || "166.00"}
              </p>
              <span className="text-[10px] text-amber-400/70 mt-1 block">Collected by Conductor</span>
            </div>

            <div className="bg-purple-950/40 p-4 rounded-2xl border border-purple-500/30">
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">Daily SaaS Share</span>
              <p className="text-2xl font-black text-purple-200 font-mono mt-1">
                -R{dailyAudit?.saasPlatformFeeZar?.toFixed(2) || "16.63"}
              </p>
              <span className="text-[10px] text-purple-300/70 mt-1 block">R499/mo Flat Platform Fee</span>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-zinc-400 font-bold">Estimated Net Daily Payout to Fleet Owner:</span>
              <p className="text-base font-black text-emerald-400 font-mono">
                R{dailyAudit?.netOwnerPayoutZar?.toFixed(2) || "249.37"} ZAR
              </p>
            </div>
            <p className="text-[11px] text-zinc-500 max-w-md">
              Unlike 25% Uber/Bolt commission (which would take R66.50 on this revenue), SOLO charges only a flat R16.63/day fraction of your monthly R499 subscription.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
