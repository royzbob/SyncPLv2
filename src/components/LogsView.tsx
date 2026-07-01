import React, { useState } from "react";
import { Download, Plus, Filter, Award, Trash2, X, Clipboard, FolderOpen, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { PnlLog, UserProfile } from "../types";
import { formatCurrency, getLocalDateString } from "../utils/helpers";

interface LogsViewProps {
  pnlLogs: PnlLog[];
  userId: string;
  username: string;
  onDeleteLog: (id: string, asset: string, amount: number) => Promise<void>;
  onOpenLogModal: () => void;
  roomCode: string;
  traders: UserProfile[];
}

export default function LogsView({
  pnlLogs,
  userId,
  username,
  onDeleteLog,
  onOpenLogModal,
  roomCode,
  traders,
}: LogsViewProps) {
  const [scope, setScope] = useState<"all" | "me">("all");
  const [selectedFlexLog, setSelectedFlexLog] = useState<PnlLog | null>(null);
  const [copiedState, setCopiedState] = useState(false);

  // Filter list
  const filteredLogs = pnlLogs.filter((log) => {
    if (scope === "me") return log.userId === userId;
    return true;
  });

  const handleExportCSV = () => {
    if (pnlLogs.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,Date,Trader,Asset,Strategy,Notes,P&L Amount,Status\n";

    pnlLogs.forEach((log) => {
      const status = log.amount >= 0 ? "Profit" : "Loss";
      const notesClean = log.notes ? log.notes.replace(/"/g, '""') : "";
      csvContent += `"${log.date}","${log.username}","${log.asset}","${log.strategy}","${notesClean}",${log.amount},"${status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SyncPL-Ledger-${roomCode}-${getLocalDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyFlexCardText = () => {
    if (!selectedFlexLog) return;
    const certCode = selectedFlexLog.id.substring(0, 8).toUpperCase();
    const copyText = `SyncPL Shared Ledger Certificate: Code: #${certCode} | Profit: ${formatCurrency(
      selectedFlexLog.amount
    )} on ${selectedFlexLog.asset} by ${
      selectedFlexLog.username
    }. Verified in Room Code: ${roomCode}!`;

    navigator.clipboard.writeText(copyText);
    setCopiedState(true);
    setTimeout(() => {
      setCopiedState(false);
      setSelectedFlexLog(null);
    }, 1500);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto h-full text-[#DCDDDE]">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="font-black text-2xl text-white tracking-tight">Ledger Logs</h3>
          <p className="text-xs text-[#8E9297] mt-1">
            Comprehensive ledger logs reported within active workspace
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="bg-[#1E2023] hover:bg-[#24272C] border border-[#2A2D31] text-[#8E9297] hover:text-white font-bold text-xs px-3 py-2 rounded transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={onOpenLogModal}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs px-3 py-2 rounded transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="glass-panel p-3 rounded flex gap-3 items-center flex-wrap border border-[#2A2D31] bg-[#121417]">
        <div className="flex items-center space-x-2 text-xs font-bold text-[#8E9297] uppercase tracking-wider">
          <Filter className="w-4 h-4 text-indigo-400" />
          <span>Filter Scope:</span>
        </div>
        <button
          onClick={() => setScope("all")}
          className={`px-3 py-1.5 rounded text-xs font-bold transition ${
            scope === "all" ? "bg-[#5865F2]/10 text-[#5865F2]" : "text-[#8E9297] hover:text-white"
          }`}
        >
          Group Entries
        </button>
        <button
          onClick={() => setScope("me")}
          className={`px-3 py-1.5 rounded text-xs font-bold transition ${
            scope === "me" ? "bg-[#5865F2]/10 text-[#5865F2]" : "text-[#8E9297] hover:text-white"
          }`}
        >
          Only Me
        </button>
      </div>

      {/* Ledger Table */}
      <div className="glass-panel rounded overflow-hidden border border-[#2A2D31]">
        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto font-sans">
            <table className="min-w-full divide-y divide-[#2A2D31]">
              <thead className="bg-[#121417]">
                <tr className="text-left text-[10px] font-bold text-[#8E9297] uppercase tracking-wider">
                  <th scope="col" className="px-6 py-4">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Trader
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Asset
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Strategy / Notes
                  </th>
                  <th scope="col" className="px-6 py-4 text-right">
                    P&L Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D31]">
                {filteredLogs.map((log) => {
                  const isProfit = log.amount >= 0;
                  const amtStr = formatCurrency(log.amount);
                  const isOwner = !log.userId || log.userId === userId || log.username === username;

                  return (
                    <tr key={log.id} className="hover:bg-[#1E2023]/40 transition duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-[#8E9297] font-medium">
                        {log.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-300">{log.username}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-[#1E2023] text-indigo-400 border border-[#2A2D31]">
                          {log.asset}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400 max-w-xs truncate">
                        <span className="font-bold text-indigo-300 mr-2 uppercase text-[9px] border border-[#2A2D31] px-1 py-0.5 rounded bg-[#121417]">
                          {log.strategy}
                        </span>
                        {log.notes || <span className="text-gray-600 italic">No notes</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                        <span className={isProfit ? "text-[#43B581]" : "text-[#F04747]"}>
                          {isProfit ? "+" : ""}
                          {amtStr}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setSelectedFlexLog(log)}
                            className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition"
                            title="Generate Shareable Flex Card"
                          >
                            <Award className="w-4 h-4" />
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => onDeleteLog(log.id, log.asset, log.amount)}
                              className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded transition"
                              title="Delete Log Entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
            <FolderOpen className="w-12 h-12 text-gray-600 mb-2 animate-pulse" />
            <p className="text-sm font-semibold">No P&L sync records found.</p>
          </div>
        )}
      </div>

      {/* Shareable Flex Card Modal */}
      {selectedFlexLog && (() => {
        const logTrader = traders?.find((t) => t.username === selectedFlexLog.username);
        const initials = selectedFlexLog.username.substring(0, 2).toUpperCase();
        const avatarBgClass =
          logTrader?.avatarColor === "pink"
            ? "bg-pink-500/10 border-pink-500/30 text-pink-400"
            : logTrader?.avatarColor === "emerald"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : logTrader?.avatarColor === "amber"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
            : logTrader?.avatarColor === "sky"
            ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
            : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400";

        return (
          <div className="fixed inset-0 z-50 bg-[#0F1113]/90 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="w-full max-w-sm animate-in zoom-in-95 duration-200">
              <div className="glass-panel p-6 rounded-2xl border border-[#2A2D31] text-center relative overflow-hidden shadow-2xl bg-[#1E2023]">
                {/* Ambient glow backgrounds */}
                <div className="absolute -top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 filter blur-3xl" />
                <div className="absolute -bottom-[20%] -left-[20%] w-[60%] h-[60%] rounded-full bg-pink-500/10 filter blur-3xl" />

                {/* Card Header Info */}
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-tr from-indigo-500 to-pink-500 rounded text-white">
                      <Award className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black tracking-widest text-indigo-300 uppercase">
                      SYNCPL VERIFIED
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-extrabold text-[#8E9297] uppercase">
                    {selectedFlexLog.date.replace(/-/g, "/")}
                  </span>
                </div>

                {/* Main performance stats */}
                <div className="space-y-4 relative z-10 my-6">
                  <p className="text-xs text-[#8E9297] font-bold tracking-widest uppercase">
                    LEDGER PERFORMANCE FLEX
                  </p>
                  <p
                    className={`text-4xl font-black tracking-tight ${
                      selectedFlexLog.amount >= 0 ? "text-[#43B581]" : "text-[#F04747]"
                    }`}
                  >
                    {selectedFlexLog.amount >= 0 ? "+" : ""}
                    {formatCurrency(selectedFlexLog.amount)}
                  </p>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#08090A] border border-[#2A2D31] rounded-lg text-xs font-mono uppercase font-bold text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5865F2]" />
                    <span>{selectedFlexLog.asset}</span>
                  </div>

                  <p className="text-xs text-gray-300 italic max-w-xs mx-auto px-4">
                    {selectedFlexLog.notes
                      ? `"${selectedFlexLog.notes}"`
                      : '"Executed technical breakout set support level."'}
                  </p>
                </div>

                {/* Footer containing authentication & matching profile picture */}
                <div className="pt-4 border-t border-[#2A2D31] mt-6 relative z-10 flex justify-between items-center text-left text-xs">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {/* Trader Profile Picture */}
                    {logTrader?.avatarType === "url" && logTrader?.avatarVal ? (
                      <div className="w-8 h-8 rounded-full border border-[#2A2D31] overflow-hidden flex items-center justify-center bg-[#08090A] shrink-0">
                        <img
                          src={logTrader.avatarVal}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarBgClass}`}
                      >
                        {logTrader?.avatarVal || initials}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="block text-[8px] text-[#72767D] uppercase tracking-wider font-extrabold">
                        AUTHENTICATED TRADER
                      </span>
                      <span className="font-bold text-gray-200 truncate block">
                        {selectedFlexLog.username}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="block text-[8px] text-[#72767D] uppercase tracking-wider font-extrabold">
                      VERIFICATION SIGN
                    </span>
                    <span className="font-mono font-bold text-indigo-400">
                      {selectedFlexLog.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setSelectedFlexLog(null)}
                  className="w-1/3 bg-[#121417] hover:bg-[#08090A] border border-[#2A2D31] text-gray-300 font-semibold text-xs py-2 rounded transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleCopyFlexCardText}
                  className="w-2/3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2 rounded transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Clipboard className="w-4 h-4" /> {copiedState ? "Copied to Clipboard!" : "Copy Verification Text"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
