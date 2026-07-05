import React, { useState, useMemo } from "react";
import { Trophy, Award } from "lucide-react";
import { PnlLog } from "../types";
import { formatCurrency, getLocalDateString } from "../utils/helpers";

interface LeaderboardViewProps {
  pnlLogs: PnlLog[];
}

export default function LeaderboardView({ pnlLogs }: LeaderboardViewProps) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");

  const leaderboardData = useMemo(() => {
    const now = new Date();
    const todayStr = getLocalDateString(now);

    // Monday
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mondayStr = getLocalDateString(new Date(d.setDate(diff)));

    const currentYearMonth = todayStr.substring(0, 7);

    // Accumulator map
    const statsMap: Record<
      string,
      { username: string; trades: number; wins: number; totalPnL: number }
    > = {};

    pnlLogs.forEach((log) => {
      let inRange = false;
      if (period === "daily") inRange = log.date === todayStr;
      else if (period === "weekly") inRange = log.date >= mondayStr;
      else inRange = log.date.startsWith(currentYearMonth);

      if (inRange) {
        const uKey = log.userId || log.username;
        if (!statsMap[uKey]) {
          statsMap[uKey] = {
            username: log.username,
            trades: 0,
            wins: 0,
            totalPnL: 0,
          };
        }
        statsMap[uKey].trades++;
        if (log.amount >= 0) statsMap[uKey].wins++;
        statsMap[uKey].totalPnL += log.amount;
      }
    });

    return Object.keys(statsMap)
      .map((key) => {
        const data = statsMap[key];
        const winRate = data.trades > 0 ? Math.round((data.wins / data.trades) * 100) : 0;
        return {
          username: data.username,
          trades: data.trades,
          winRate,
          totalPnL: data.totalPnL,
        };
      })
      .sort((a, b) => b.totalPnL - a.totalPnL);
  }, [pnlLogs, period]);

  const getRankPill = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="w-6 h-6 flex items-center justify-center rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-6 h-6 flex items-center justify-center rounded bg-slate-400/20 text-slate-300 border border-slate-400/30 text-xs font-black">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-6 h-6 flex items-center justify-center rounded bg-amber-700/20 text-amber-600 border border-amber-700/30 text-xs font-black">
          3
        </span>
      );
    }
    return (
      <span className="w-6 h-6 flex items-center justify-center rounded bg-[#2A2D31] text-[#8E9297] text-xs font-bold">
        {rank}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto h-full text-[#DCDDDE]">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-black text-2xl text-white tracking-tight flex items-center gap-2">
            <Trophy className="text-amber-400 w-6 h-6" /> Partner Performance Board
          </h3>
          <p className="text-xs text-[#8E9297] mt-1">
            Real-time standings ranked by cumulative profits inside this room node
          </p>
        </div>

        <div className="flex bg-[#08090A] border border-[#2A2D31] p-0.5 rounded">
          <button
            onClick={() => setPeriod("daily")}
            className={`px-4 py-1.5 rounded text-xs font-bold transition ${
              period === "daily"
                ? "bg-[#5865F2]/10 text-[#5865F2]"
                : "text-[#8E9297] hover:text-white"
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setPeriod("weekly")}
            className={`px-4 py-1.5 rounded text-xs font-bold transition ${
              period === "weekly"
                ? "bg-[#5865F2]/10 text-[#5865F2]"
                : "text-[#8E9297] hover:text-white"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setPeriod("monthly")}
            className={`px-4 py-1.5 rounded text-xs font-bold transition ${
              period === "monthly"
                ? "bg-[#5865F2]/10 text-[#5865F2]"
                : "text-[#8E9297] hover:text-white"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="glass-panel rounded overflow-hidden border border-[#2A2D31]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#2A2D31]">
            <thead>
              <tr className="bg-[#121417] text-left text-[10px] font-extrabold text-[#8E9297] uppercase tracking-wider">
                <th scope="col" className="px-6 py-4">
                  Rank
                </th>
                <th scope="col" className="px-6 py-4">
                  Trader Nickname
                </th>
                <th scope="col" className="px-6 py-4 text-center">
                  Trades Logged
                </th>
                <th scope="col" className="px-6 py-4 text-center">
                  Win Rate
                </th>
                <th scope="col" className="px-6 py-4 text-right">
                  Aggregate P&L
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2D31]">
              {leaderboardData.length > 0 ? (
                leaderboardData.map((trader, index) => {
                  const rankNum = index + 1;
                  const profitStyle =
                    trader.totalPnL > 0
                      ? "text-emerald-400 font-extrabold"
                      : trader.totalPnL < 0
                      ? "text-rose-400 font-extrabold"
                      : "text-gray-400";

                  return (
                    <tr key={trader.username} className="hover:bg-[#1E2023]/40 transition">
                      <td className="px-6 py-4 text-sm">{getRankPill(rankNum)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-200">
                        {trader.username}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-300">
                        {trader.trades}
                      </td>
                      <td
                        className={`px-6 py-4 text-center text-sm ${
                          trader.winRate >= 50 ? "text-[#43B581]" : "text-[#F04747]"
                        }`}
                      >
                        {trader.winRate}%
                      </td>
                      <td className={`px-6 py-4 text-right text-sm ${profitStyle}`}>
                        {formatCurrency(trader.totalPnL)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-[#72767D] italic text-xs">
                    No P&L logs captured within the selected timeframe
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
