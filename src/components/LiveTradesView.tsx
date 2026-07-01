import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Play,
  Square,
  Trash2,
  Target,
  ShieldAlert,
  Activity,
  AlertCircle,
  Clock,
  User,
  ArrowRightLeft,
  XCircle,
  Sparkles
} from "lucide-react";
import { LiveTrade, UserProfile } from "../types";
import { formatCurrency } from "../utils/helpers";

interface LiveTradesViewProps {
  liveTrades: LiveTrade[];
  userId: string;
  username: string;
  roomCode: string;
  traders: UserProfile[];
  onAddLiveTrade: (payload: {
    asset: string;
    direction: "long" | "short";
    entryPrice: number;
    tp: number;
    sl: number;
    quantity: number;
    notes: string;
  }) => Promise<void>;
  onCloseLiveTrade: (id: string, outcome: "TP" | "SL" | "manual", finalPrice: number, profitAmount: number) => Promise<void>;
  onUpdateTradePrice: (id: string, currentPrice: number) => Promise<void>;
  onDeleteLiveTrade: (id: string) => Promise<void>;
  onTriggerPriceFluctuation: () => void;
}

export default function LiveTradesView({
  liveTrades,
  userId,
  username,
  roomCode,
  traders,
  onAddLiveTrade,
  onCloseLiveTrade,
  onUpdateTradePrice,
  onDeleteLiveTrade,
  onTriggerPriceFluctuation,
}: LiveTradesViewProps) {
  const [scope, setScope] = useState<"all" | "me">("all");
  const [isNewTradeOpen, setIsNewTradeOpen] = useState(false);

  // Form states
  const [tradeAsset, setTradeAsset] = useState("BTC/USD");
  const [tradeDirection, setTradeDirection] = useState<"long" | "short">("long");
  const [tradeEntryPrice, setTradeEntryPrice] = useState("");
  const [tradeTP, setTradeTP] = useState("");
  const [tradeSL, setTradeSL] = useState("");
  const [tradeQuantity, setTradeQuantity] = useState("1");
  const [tradeNotes, setTradeNotes] = useState("");

  const filteredTrades = useMemo(() => {
    return liveTrades.filter((t) => {
      if (scope === "me") return t.userId === userId;
      return true;
    });
  }, [liveTrades, scope, userId]);

  // Split open vs closed
  const openTrades = useMemo(() => filteredTrades.filter((t) => t.status === "open"), [filteredTrades]);
  const closedTrades = useMemo(() => filteredTrades.filter((t) => t.status === "closed"), [filteredTrades]);

  // Aggregate stats
  const stats = useMemo(() => {
    let activeLongs = 0;
    let activeShorts = 0;
    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;
    let closedWins = 0;
    let closedTotal = 0;

    filteredTrades.forEach((t) => {
      // Quantity is parsed or defaults to 1
      const qty = (t as any).quantity || 1;
      if (t.status === "open") {
        const diff = t.direction === "long" ? t.currentPrice - t.entryPrice : t.entryPrice - t.currentPrice;
        const unrealized = diff * qty;
        totalUnrealizedPnl += unrealized;

        if (t.direction === "long") activeLongs++;
        else activeShorts++;
      } else {
        const realized = t.profitAmount || 0;
        totalRealizedPnl += realized;
        closedTotal++;
        if (realized >= 0) {
          closedWins++;
        }
      }
    });

    const winRate = closedTotal > 0 ? Math.round((closedWins / closedTotal) * 100) : 0;

    return {
      activeLongs,
      activeShorts,
      totalUnrealizedPnl,
      totalRealizedPnl,
      closedTotal,
      winRate,
    };
  }, [filteredTrades]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entry = parseFloat(tradeEntryPrice);
    const tpVal = parseFloat(tradeTP);
    const slVal = parseFloat(tradeSL);
    const qtyVal = parseFloat(tradeQuantity);

    if (isNaN(entry) || isNaN(tpVal) || isNaN(slVal) || isNaN(qtyVal) || qtyVal <= 0) {
      alert("Please check that entry, TP, SL, and Quantity are valid positive numbers.");
      return;
    }

    // Basic validity checks
    if (tradeDirection === "long") {
      if (tpVal <= entry) {
        alert("For Longs, Take Profit (TP) must be greater than Entry Price.");
        return;
      }
      if (slVal >= entry) {
        alert("For Longs, Stop Loss (SL) must be less than Entry Price.");
        return;
      }
    } else {
      if (tpVal >= entry) {
        alert("For Shorts, Take Profit (TP) must be less than Entry Price.");
        return;
      }
      if (slVal <= entry) {
        alert("For Shorts, Stop Loss (SL) must be greater than Entry Price.");
        return;
      }
    }

    await onAddLiveTrade({
      asset: tradeAsset.toUpperCase(),
      direction: tradeDirection,
      entryPrice: entry,
      tp: tpVal,
      sl: slVal,
      quantity: qtyVal,
      notes: tradeNotes,
    });

    // Reset form
    setIsNewTradeOpen(false);
    setTradeEntryPrice("");
    setTradeTP("");
    setTradeSL("");
    setTradeQuantity("1");
    setTradeNotes("");
  };

  // Preset assets for quick entry
  const presetAssets = [
    { name: "BTC/USD", defaultPrice: 92840.0 },
    { name: "ETH/USD", defaultPrice: 3420.0 },
    { name: "NQ", defaultPrice: 19850.0 },
    { name: "SNP500", defaultPrice: 5430.0 },
    { name: "GOLD", defaultPrice: 2380.0 },
    { name: "EUR/USD", defaultPrice: 1.0825 }
  ];

  const handleSelectAssetPreset = (assetName: string) => {
    setTradeAsset(assetName);
    const preset = presetAssets.find((p) => p.name === assetName);
    if (preset) {
      setTradeEntryPrice(preset.defaultPrice.toString());
      if (tradeDirection === "long") {
        setTradeTP((preset.defaultPrice * 1.01).toFixed(2));
        setTradeSL((preset.defaultPrice * 0.99).toFixed(2));
      } else {
        setTradeTP((preset.defaultPrice * 0.99).toFixed(2));
        setTradeSL((preset.defaultPrice * 1.01).toFixed(2));
      }
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto h-full text-[#DCDDDE]">
      {/* View Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 bg-[#5865F2]/10 text-indigo-400 rounded">
              <Activity className="w-5 h-5 animate-pulse" />
            </span>
            <h3 className="font-black text-2xl text-white tracking-tight">Live Trading Desk</h3>
          </div>
          <p className="text-xs text-[#8E9297] mt-1">
            Track active trades in real-time with automatic TP/SL alerts across your team
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onTriggerPriceFluctuation}
            disabled={openTrades.length === 0}
            className={`font-bold text-xs px-3 py-2 rounded transition flex items-center gap-1.5 ${
              openTrades.length === 0
                ? "bg-[#1E2023] border border-[#2A2D31] text-gray-600 cursor-not-allowed"
                : "bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400"
            }`}
            title="Slightly tick and fluctuate open trade prices to simulate real-time market updates"
          >
            <Sparkles className="w-4 h-4 animate-bounce" /> Simulate Live Ticks
          </button>
          <button
            onClick={() => setIsNewTradeOpen(true)}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs px-3 py-2 rounded transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Open Position
          </button>
        </div>
      </div>

      {/* Aggregate HUD stats panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#121417]/80 border border-[#2A2D31]/70 p-4 rounded-xl">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest block">Active Positions</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-white">{openTrades.length}</span>
            <span className="text-xs text-[#8E9297] font-mono">
              ({stats.activeLongs}L / {stats.activeShorts}S)
            </span>
          </div>
        </div>

        <div className="bg-[#121417]/80 border border-[#2A2D31]/70 p-4 rounded-xl">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest block">Unrealized P&L</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`text-2xl font-black ${stats.totalUnrealizedPnl >= 0 ? "text-[#43B581]" : "text-[#F04747]"}`}>
              {formatCurrency(stats.totalUnrealizedPnl)}
            </span>
            {stats.totalUnrealizedPnl >= 0 ? (
              <TrendingUp className="w-4 h-4 text-[#43B581]" />
            ) : (
              <TrendingDown className="w-4 h-4 text-[#F04747]" />
            )}
          </div>
        </div>

        <div className="bg-[#121417]/80 border border-[#2A2D31]/70 p-4 rounded-xl">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest block">Realized Live P&L</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`text-2xl font-black ${stats.totalRealizedPnl >= 0 ? "text-[#43B581]" : "text-[#F04747]"}`}>
              {formatCurrency(stats.totalRealizedPnl)}
            </span>
            {stats.totalRealizedPnl >= 0 ? (
              <TrendingUp className="w-4 h-4 text-[#43B581]" />
            ) : (
              <TrendingDown className="w-4 h-4 text-[#F04747]" />
            )}
          </div>
        </div>

        <div className="bg-[#121417]/80 border border-[#2A2D31]/70 p-4 rounded-xl">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest block">Live Win Rate</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-indigo-400">{stats.winRate}%</span>
            <span className="text-[10px] text-[#8E9297] font-semibold ml-2 font-mono">({stats.closedTotal} closed)</span>
          </div>
        </div>
      </div>

      {/* Filter Scope Controls */}
      <div className="glass-panel p-3 rounded flex gap-3 items-center flex-wrap border border-[#2A2D31] bg-[#121417]">
        <div className="flex items-center space-x-2 text-xs font-bold text-[#8E9297] uppercase tracking-wider">
          <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span>Monitor Scope:</span>
        </div>
        <button
          onClick={() => setScope("all")}
          className={`px-3 py-1.5 rounded text-xs font-bold transition ${
            scope === "all" ? "bg-[#5865F2]/10 text-[#5865F2]" : "text-[#8E9297] hover:text-white"
          }`}
        >
          All Desk Trades
        </button>
        <button
          onClick={() => setScope("me")}
          className={`px-3 py-1.5 rounded text-xs font-bold transition ${
            scope === "me" ? "bg-[#5865F2]/10 text-[#5865F2]" : "text-[#8E9297] hover:text-white"
          }`}
        >
          Only My Trades
        </button>
      </div>

      {/* Grid of Open Live Positions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Active Open Positions ({openTrades.length})
          </h4>
          {openTrades.length > 0 && (
            <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              Live Feed Active
            </span>
          )}
        </div>

        {openTrades.length === 0 ? (
          <div className="p-8 text-center bg-[#121417] border border-[#2A2D31]/60 rounded-xl flex flex-col items-center justify-center space-y-2">
            <AlertCircle className="w-8 h-8 text-gray-600" />
            <p className="text-gray-400 text-sm font-bold">No active live trades right now</p>
            <p className="text-[#8E9297] text-xs max-w-xs">
              Open a live position with customizable TP & SL, and watch it fluctuate. Hit targets to lock in ledger P&L!
            </p>
            <button
              onClick={() => setIsNewTradeOpen(true)}
              className="mt-2 bg-[#5865F2]/20 hover:bg-[#5865F2]/30 text-indigo-300 font-bold text-xs px-3.5 py-1.5 rounded transition border border-[#5865F2]/30"
            >
              Open New Trade
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openTrades.map((t) => {
              const qty = (t as any).quantity || 1;
              const diff = t.direction === "long" ? t.currentPrice - t.entryPrice : t.entryPrice - t.currentPrice;
              const unrealized = diff * qty;
              const pnlPercent = (diff / t.entryPrice) * 100;

              // Calculate distance to targets
              const tpDiff = Math.abs(t.tp - t.currentPrice);
              const slDiff = Math.abs(t.sl - t.currentPrice);
              const totalSpan = Math.abs(t.tp - t.sl) || 1;

              // Simple visualization slider percent
              const progressPct = Math.min(100, Math.max(0, ((t.currentPrice - Math.min(t.tp, t.sl)) / totalSpan) * 100));

              return (
                <div
                  key={t.id}
                  className="bg-[#121417] border border-[#2A2D31] rounded-xl overflow-hidden shadow-lg hover:border-indigo-500/30 transition flex flex-col"
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-[#2A2D31]/40 flex justify-between items-center bg-[#17191C]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          t.direction === "long" ? "bg-[#43B581]/10 text-[#43B581]" : "bg-[#F04747]/10 text-[#F04747]"
                        }`}
                      >
                        {t.direction}
                      </span>
                      <span className="font-mono font-black text-sm text-white uppercase">{t.asset}</span>
                      <span className="text-[10px] text-gray-500 font-mono">x{qty}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[#8E9297] flex items-center gap-1">
                        <User className="w-3 h-3 text-indigo-400" />
                        {t.username}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Details */}
                  <div className="p-4 flex-grow space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">Entry Price</span>
                        <span className="font-mono text-sm font-extrabold text-gray-300">${t.entryPrice.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">Current Price</span>
                        <span className="font-mono text-sm font-black text-white animate-pulse">${t.currentPrice.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* UnRealized P&L HUD */}
                    <div className="bg-[#1E2023] p-3 rounded-lg border border-[#2A2D31]/40 text-center">
                      <span className="text-[9px] font-bold text-[#8E9297] uppercase tracking-widest block">Unrealized profit/loss</span>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <span className={`text-xl font-black ${unrealized >= 0 ? "text-[#43B581]" : "text-[#F04747]"}`}>
                          {unrealized >= 0 ? "+" : ""}{formatCurrency(unrealized)}
                        </span>
                        <span className={`text-xs font-mono font-bold ${unrealized >= 0 ? "text-[#43B581]" : "text-[#F04747]"}`}>
                          ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                    {/* TP / SL Threshold bars */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Target className="w-3 h-3" /> TP: ${t.tp.toLocaleString()}
                        </span>
                        <span className="text-red-400 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> SL: ${t.sl.toLocaleString()}
                        </span>
                      </div>

                      {/* Visual progress bar bar */}
                      <div className="relative h-1.5 w-full bg-[#1A1C1E] rounded-full overflow-hidden">
                        <div
                          className={`absolute top-0 bottom-0 ${t.direction === "long" ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {t.notes && (
                      <p className="text-[10px] text-[#8E9297] italic bg-[#1E2023]/30 p-2 rounded border border-[#2A2D31]/20">
                        "{t.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="p-3 border-t border-[#2A2D31]/40 bg-[#121417] flex gap-2">
                    {t.userId === userId ? (
                      <>
                        <button
                          onClick={() => onCloseLiveTrade(t.id, "manual", t.currentPrice, unrealized)}
                          className="flex-grow bg-[#5865F2]/20 hover:bg-[#5865F2]/30 border border-[#5865F2]/40 text-indigo-300 font-bold text-xs py-1.5 rounded transition flex items-center justify-center gap-1.5"
                        >
                          <Square className="w-3 h-3" /> Market Close
                        </button>
                        <button
                          onClick={() => onDeleteLiveTrade(t.id)}
                          className="p-1.5 bg-[#F04747]/10 hover:bg-[#F04747]/20 border border-[#F04747]/30 text-[#F04747] rounded transition"
                          title="Delete trade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-[#8E9297] text-center w-full block py-1 font-semibold">
                        Watching partner's active trade
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Closed Positions History log list */}
      <div className="space-y-3">
        <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-gray-500" />
          Closed Trades History ({closedTrades.length})
        </h4>

        {closedTrades.length === 0 ? (
          <div className="p-6 text-center bg-[#121417]/40 border border-[#2A2D31]/40 rounded-xl text-gray-500 text-xs italic">
            No closed trades logged under this session/monitor scope.
          </div>
        ) : (
          <div className="bg-[#121417] border border-[#2A2D31] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#2A2D31]/60">
                <thead className="bg-[#17191C]">
                  <tr className="text-left text-[10px] font-bold text-[#8E9297] uppercase tracking-wider">
                    <th scope="col" className="px-6 py-3">Trader</th>
                    <th scope="col" className="px-6 py-3">Asset</th>
                    <th scope="col" className="px-6 py-3">Direction</th>
                    <th scope="col" className="px-6 py-3">Entry/Exit</th>
                    <th scope="col" className="px-6 py-3">TP/SL target</th>
                    <th scope="col" className="px-6 py-3">Outcome</th>
                    <th scope="col" className="px-6 py-3 text-right">Realized Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2D31]/40 text-xs">
                  {closedTrades.map((t) => {
                    const qty = (t as any).quantity || 1;
                    const isWin = (t.profitAmount || 0) >= 0;

                    return (
                      <tr key={t.id} className="hover:bg-[#1E2023]/30 transition">
                        <td className="px-6 py-3 text-[#DCDDDE] font-semibold">{t.username}</td>
                        <td className="px-6 py-3 text-white font-mono font-bold uppercase">{t.asset}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              t.direction === "long" ? "bg-[#43B581]/10 text-[#43B581]" : "bg-[#F04747]/10 text-[#F04747]"
                            }`}
                          >
                            {t.direction}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-400 font-mono">
                          ${t.entryPrice.toLocaleString()} &rarr; ${(t as any).exitPrice ? (t as any).exitPrice.toLocaleString() : t.currentPrice.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-gray-500 font-mono text-[11px]">
                          TP: {t.tp.toLocaleString()} | SL: {t.sl.toLocaleString()}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1 w-fit ${
                              t.outcome === "TP"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : t.outcome === "SL"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                            }`}
                          >
                            {t.outcome === "TP" && <Target className="w-3 h-3" />}
                            {t.outcome === "SL" && <ShieldAlert className="w-3 h-3" />}
                            {t.outcome || "Closed"}
                          </span>
                        </td>
                        <td className={`px-6 py-3 text-right font-mono font-extrabold ${isWin ? "text-[#43B581]" : "text-[#F04747]"}`}>
                          {isWin ? "+" : ""}{formatCurrency(t.profitAmount || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Overlay: Launch Live Trade Form */}
      {isNewTradeOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1113]/90 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#1E2023] border border-[#2A2D31] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[#2A2D31]/60 flex items-center justify-between bg-[#121417]">
              <h3 className="font-extrabold text-gray-100 text-sm flex items-center gap-2">
                <Play className="text-[#5865F2] w-5 h-5" /> Launch Real-Time Live Position
              </h3>
              <button onClick={() => setIsNewTradeOpen(false)} className="text-gray-400 hover:text-white transition">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-[#DCDDDE]">
              {/* Direction Indicator */}
              <div>
                <label className="block text-xs font-bold text-[#8E9297] uppercase mb-2">
                  Position Direction
                </label>
                <div className="flex rounded overflow-hidden border border-[#2A2D31]">
                  <button
                    type="button"
                    onClick={() => setTradeDirection("long")}
                    className={`flex-grow py-2.5 text-sm font-extrabold transition ${
                      tradeDirection === "long" ? "bg-[#43B581]/10 text-[#43B581]" : "bg-[#121417] text-gray-500"
                    }`}
                  >
                    LONG / BUY (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeDirection("short")}
                    className={`flex-grow py-2.5 text-sm font-extrabold transition ${
                      tradeDirection === "short" ? "bg-[#F04747]/10 text-[#F04747]" : "bg-[#121417] text-gray-500"
                    }`}
                  >
                    SHORT / SELL (-)
                  </button>
                </div>
              </div>

              {/* Quick Preset Asset Ticker row */}
              <div>
                <label className="block text-[10px] font-bold text-[#8E9297] uppercase tracking-wider mb-2">
                  Quick Asset Presets
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {presetAssets.map((pa) => (
                    <button
                      key={pa.name}
                      type="button"
                      onClick={() => handleSelectAssetPreset(pa.name)}
                      className={`text-[10px] font-mono px-2 py-1 rounded transition border ${
                        tradeAsset === pa.name
                          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                          : "bg-[#121417] text-gray-400 border-[#2A2D31] hover:text-white"
                      }`}
                    >
                      {pa.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asset & Quantity input */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#8E9297] uppercase mb-1.5">Asset / Ticker</label>
                  <input
                    type="text"
                    required
                    value={tradeAsset}
                    onChange={(e) => setTradeAsset(e.target.value)}
                    placeholder="BTC/USD"
                    className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#8E9297] uppercase mb-1.5">Position Size (Qty)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={tradeQuantity}
                    onChange={(e) => setTradeQuantity(e.target.value)}
                    placeholder="1.0"
                    className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Entry Price & Quantity */}
              <div>
                <label className="block text-xs font-bold text-[#8E9297] uppercase mb-1.5">Entry Price ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={tradeEntryPrice}
                  onChange={(e) => setTradeEntryPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2.5 text-sm font-bold text-white focus:outline-none"
                />
              </div>

              {/* Targets: TP and SL */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-400 uppercase mb-1.5 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" /> Take Profit (TP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tradeTP}
                    onChange={(e) => setTradeTP(e.target.value)}
                    placeholder="Target price"
                    className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-red-400 uppercase mb-1.5 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Stop Loss (SL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tradeSL}
                    onChange={(e) => setTradeSL(e.target.value)}
                    placeholder="Cut loss price"
                    className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8E9297] uppercase mb-1.5">Trade Notes / Strategy</label>
                <textarea
                  value={tradeNotes}
                  onChange={(e) => setTradeNotes(e.target.value)}
                  placeholder="Technical triggers like 'VWAP cross', '15m RSI oversold'..."
                  rows={2}
                  className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewTradeOpen(false)}
                  className="w-1/3 bg-[#121417] hover:bg-[#08090A] border border-[#2A2D31] text-gray-300 font-semibold text-xs py-2 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs py-2 rounded transition shadow flex items-center justify-center gap-1.5"
                >
                  <Activity className="w-4 h-4" /> Deploy Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
