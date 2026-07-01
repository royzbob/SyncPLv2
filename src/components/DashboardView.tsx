import React, { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  CalendarRange,
  CalendarDays,
  Percent,
  TrendingUp as ProfitIcon,
  BarChart2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { PnlLog } from "../types";
import { formatCurrency, getLocalDateString } from "../utils/helpers";

interface DashboardViewProps {
  pnlLogs: PnlLog[];
  userId: string;
}

export default function DashboardView({ pnlLogs, userId }: DashboardViewProps) {
  // 1. Calculate stats for current user
  const userLogs = useMemo(() => pnlLogs.filter((l) => l.userId === userId), [pnlLogs, userId]);

  const stats = useMemo(() => {
    // Current timezone local dates
    const now = new Date();
    const todayStr = getLocalDateString(now);

    // Find Monday of current week
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mondayStr = getLocalDateString(new Date(d.setDate(diff)));

    const currentYearMonth = todayStr.substring(0, 7); // e.g. "2026-06"

    let dailySum = 0;
    let weeklySum = 0;
    let monthlySum = 0;
    let wins = 0;

    userLogs.forEach((log) => {
      const amount = log.amount;
      if (amount >= 0) wins++;

      if (log.date === todayStr) dailySum += amount;
      if (log.date >= mondayStr) weeklySum += amount;
      if (log.date.startsWith(currentYearMonth)) monthlySum += amount;
    });

    const totalTrades = userLogs.length;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

    return {
      dailySum,
      weeklySum,
      monthlySum,
      winRate,
      totalTrades,
      todayStr,
    };
  }, [userLogs]);

  // 2. Compute Heatmap Calendar Grid for Current Month
  const heatmapDays = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    const firstDay = new Date(year, month, 1);
    // getDay returns 0 for Sunday, we map Monday to index 0, Sunday to 6
    let startDayIndex = firstDay.getDay();
    startDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1;

    const totalDays = new Date(year, month + 1, 0).getDate();

    // Sum P&L per day
    const dailyPnLMap: Record<number, number> = {};
    pnlLogs.forEach((log) => {
      if (!log.date) return;
      const parts = log.date.split("-");
      if (parts.length !== 3) return;
      const ly = parseInt(parts[0], 10);
      const lm = parseInt(parts[1], 10) - 1; // 0-indexed month
      const ld = parseInt(parts[2], 10);
      
      if (ly === year && lm === month) {
        dailyPnLMap[ld] = (dailyPnLMap[ld] || 0) + log.amount;
      }
    });

    return {
      startDayIndex,
      totalDays,
      dailyPnLMap,
      monthName: today.toLocaleString("default", { month: "long" }),
      year,
      month,
    };
  }, [pnlLogs]);

  // 3. Strategy aggregates table
  const strategyStats = useMemo(() => {
    const map: Record<string, { wins: number; total: number; pnl: number }> = {};
    userLogs.forEach((log) => {
      const strat = log.strategy || "Unknown";
      if (!map[strat]) map[strat] = { wins: 0, total: 0, pnl: 0 };
      map[strat].total++;
      map[strat].pnl += log.amount;
      if (log.amount >= 0) map[strat].wins++;
    });

    return Object.keys(map).map((strat) => {
      const data = map[strat];
      const wr = data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0;
      return {
        strategy: strat,
        total: data.total,
        winRate: wr,
        pnl: data.pnl,
      };
    });
  }, [userLogs]);

  // 4. Cumulative line chart performance dataset mapping
  const chartData = useMemo(() => {
    // Get unique sorted dates from all logs
    const dates = Array.from(new Set(pnlLogs.map((l) => l.date))).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    // Get unique traders
    const traders = Array.from(new Set(pnlLogs.map((l) => l.username)));

    // Cumulative tracker for each trader
    const traderPnLMap: Record<string, number> = {};
    traders.forEach((t) => {
      traderPnLMap[t] = 0;
    });

    // Create a data point for each date
    return dates.map((date) => {
      const point: Record<string, any> = { date };

      // Apply trades that happened on this date
      pnlLogs
        .filter((l) => l.date === date)
        .forEach((log) => {
          traderPnLMap[log.username] = (traderPnLMap[log.username] || 0) + log.amount;
        });

      // Write active cumulative value for each trader
      traders.forEach((t) => {
        point[t] = Number(traderPnLMap[t].toFixed(2));
      });

      return point;
    });
  }, [pnlLogs]);

  const uniqueTraders = useMemo(() => {
    return Array.from(new Set(pnlLogs.map((l) => l.username)));
  }, [pnlLogs]);

  // List of colors for lines
  const lineColors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#3b82f6"];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto h-full text-[#DCDDDE]">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="glass-panel p-5 rounded flex flex-col justify-between relative overflow-hidden glass-card-hover">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
              Today's P&L
            </span>
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p
              className={`text-3xl font-black tracking-tight ${
                stats.dailySum > 0
                  ? "text-emerald-400"
                  : stats.dailySum < 0
                  ? "text-rose-400"
                  : "text-white"
              }`}
            >
              {formatCurrency(stats.dailySum)}
            </p>
            <p className="text-[10px] text-gray-500 font-medium mt-1">
              {userLogs.filter((l) => l.date === stats.todayStr).length}{" "}
              trades logged today
            </p>
            <div className="w-full bg-[#08090A] h-1 rounded mt-3 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded"
                style={{ width: stats.dailySum >= 0 ? "100%" : "0%" }}
              ></div>
            </div>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="glass-panel p-5 rounded flex flex-col justify-between relative overflow-hidden glass-card-hover">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
              This Week
            </span>
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded">
              <CalendarRange className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p
              className={`text-3xl font-black tracking-tight ${
                stats.weeklySum > 0
                  ? "text-emerald-400"
                  : stats.weeklySum < 0
                  ? "text-rose-400"
                  : "text-white"
              }`}
            >
              {formatCurrency(stats.weeklySum)}
            </p>
            <p className="text-[10px] text-gray-500 font-medium mt-1">Weekly aggregate</p>
            <div className="w-full bg-[#08090A] h-1 rounded mt-3 overflow-hidden">
              <div
                className="bg-indigo-400 h-full rounded"
                style={{ width: stats.weeklySum >= 0 ? "70%" : "30%" }}
              ></div>
            </div>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="glass-panel p-5 rounded flex flex-col justify-between relative overflow-hidden glass-card-hover">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
              This Month
            </span>
            <span className="p-2 bg-purple-500/10 text-purple-400 rounded">
              <CalendarDays className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p
              className={`text-3xl font-black tracking-tight ${
                stats.monthlySum > 0
                  ? "text-emerald-400"
                  : stats.monthlySum < 0
                  ? "text-rose-400"
                  : "text-white"
              }`}
            >
              {formatCurrency(stats.monthlySum)}
            </p>
            <p className="text-[10px] text-gray-500 font-medium mt-1">Monthly aggregate</p>
            <div className="w-full bg-[#08090A] h-1 rounded mt-3 overflow-hidden">
              <div
                className="bg-purple-400 h-full rounded"
                style={{ width: stats.monthlySum >= 0 ? "85%" : "15%" }}
              ></div>
            </div>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="glass-panel p-5 rounded flex flex-col justify-between relative overflow-hidden glass-card-hover">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
              Win Rate
            </span>
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p
              className={`text-3xl font-black tracking-tight ${
                stats.winRate >= 50 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {stats.winRate}%
            </p>
            <p className="text-[10px] text-gray-500 font-medium mt-1">
              {stats.totalTrades} setups logged
            </p>
            <div className="w-full bg-[#08090A] h-1 rounded mt-3 overflow-hidden">
              <div
                className={`h-full rounded transition-all duration-500 ${
                  stats.winRate >= 50 ? "bg-emerald-400" : "bg-rose-500"
                }`}
                style={{ width: `${stats.winRate}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Heatmap Calendar */}
      <div className="glass-panel p-6 rounded relative overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-gray-100 text-lg flex items-center gap-2">
              <Calendar className="text-indigo-400 w-5 h-5" />
              Consistency Calendar ({heatmapDays.monthName} {heatmapDays.year})
            </h3>
            <p className="text-xs text-[#8E9297] mt-1">
              Visualizing win/loss habit chains of all traders in this room. Profit is green, loss is red,flat is grey.
            </p>
          </div>
          <div className="flex items-center space-x-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-[#08090A]/80 px-3 py-1.5 rounded border border-[#2A2D31]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/40"></span>{" "}
              Profit
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-red-500/20 border border-red-500/40"></span>{" "}
              Loss
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#2A2D31]"></span> Flat
            </div>
          </div>
        </div>

        <div className="overflow-x-auto pb-1.5">
          <div className="grid grid-cols-7 gap-2 text-center min-w-[500px]">
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
              <div key={day} className="text-[10px] font-extrabold text-gray-500 tracking-wider py-1">
                {day}
              </div>
            ))}

            {/* Empty cells */}
            {Array.from({ length: heatmapDays.startDayIndex }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-10 bg-transparent"></div>
            ))}

            {/* Calendar grid cells */}
            {Array.from({ length: heatmapDays.totalDays }).map((_, idx) => {
              const dayNum = idx + 1;
              const dayPnL = heatmapDays.dailyPnLMap[dayNum];

              let cellClass = "bg-[#08090A]/40 text-gray-500 border border-[#2A2D31]";
              let textClass = "text-gray-400";
              let amountLabel = "";

              if (dayPnL !== undefined) {
                if (dayPnL > 0) {
                  cellClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                  textClass = "text-emerald-300";
                  amountLabel = `+$${Math.round(dayPnL)}`;
                } else if (dayPnL < 0) {
                  cellClass = "bg-red-500/10 text-red-400 border border-red-500/20";
                  textClass = "text-red-300";
                  amountLabel = `-$${Math.abs(Math.round(dayPnL))}`;
                } else {
                  cellClass = "bg-[#2A2D31] text-gray-300 border border-[#2A2D31]";
                  textClass = "text-gray-500";
                  amountLabel = "Flat";
                }
              }

              const isToday =
                new Date().getDate() === dayNum &&
                new Date().getMonth() === heatmapDays.month;

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`h-11 rounded flex flex-col justify-center items-center select-none transition cursor-help ${cellClass} ${
                    isToday ? "ring-2 ring-indigo-500" : ""
                  }`}
                  title={
                    dayPnL !== undefined
                      ? `Net Day P&L: ${formatCurrency(dayPnL)}`
                      : "No positions reported"
                  }
                >
                  <span className="text-[10px] font-black">{dayNum}</span>
                  {amountLabel && (
                    <span className={`text-[8px] font-black block truncate w-full px-1 text-center ${textClass}`}>
                      {amountLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cumulative Performance Curves & Strategy Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Performance Line Chart */}
        <div className="glass-panel p-6 rounded xl:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-gray-100 text-lg">Group Performance Curve</h3>
              <p className="text-xs text-[#8E9297] mt-1">
                Real-time cumulative ledger synchronization inside active room
              </p>
            </div>
            <div className="flex items-center space-x-2 bg-[#121417] border border-[#2A2D31] px-2.5 py-1 rounded">
              <span className="w-2 h-2 rounded-full bg-[#5865F2] animate-pulse"></span>
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                Live Feed
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                  <XAxis
                    dataKey="date"
                    stroke="#72767D"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#72767D"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#121417",
                      borderColor: "#2A2D31",
                      borderRadius: "4px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  {uniqueTraders.map((trader, idx) => (
                    <Line
                      key={trader}
                      type="monotone"
                      dataKey={trader}
                      stroke={lineColors[idx % lineColors.length]}
                      strokeWidth={2.5}
                      dot={{ r: 2, strokeWidth: 1, stroke: "#0F1113" }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <BarChart2 className="w-12 h-12 text-gray-700 mb-2 animate-pulse" />
                <p className="text-sm font-semibold">Waiting for Sync Ledger Records</p>
              </div>
            )}
          </div>
        </div>

        {/* Strategy Analytics */}
        <div className="glass-panel p-6 rounded flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-100 text-lg flex items-center gap-2 mb-1">
              <BarChart2 className="text-[#5865F2] w-5 h-5" /> Strategy Analytics
            </h3>
            <p className="text-xs text-[#8E9297] mb-4">
              Your win ratios grouped by technical setups
            </p>
          </div>

          <div className="flex-grow overflow-y-auto space-y-3 no-scrollbar max-h-[250px]">
            {strategyStats.length > 0 ? (
              strategyStats.map((item) => (
                <div
                  key={item.strategy}
                  className="p-3 bg-[#121417] border border-[#2A2D31]/60 rounded flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-200">{item.strategy}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {item.total} setups executed
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xs font-black ${
                        item.winRate >= 50 ? "text-[#43B581]" : "text-[#F04747]"
                      }`}
                    >
                      {item.winRate}% WR
                    </p>
                    <p
                      className={`text-xs font-bold mt-0.5 ${
                        item.pnl >= 0 ? "text-[#43B581]" : "text-[#F04747]"
                      }`}
                    >
                      {formatCurrency(item.pnl)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-[#72767D] italic text-xs">
                Log setups to compute strategy ratios
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
