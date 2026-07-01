import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Crown,
  Shield,
  ShieldPlus,
  ShieldAlert,
  Bot,
  User,
  TrendingUp,
  Menu,
} from "lucide-react";
import { ChatMessage, Room, UserProfile } from "../types";
import { formatCurrency } from "../utils/helpers";

interface ChatViewProps {
  activeRoom: Room;
  activeChannelName: string;
  chatMessages: ChatMessage[];
  roomTraders: UserProfile[]; // Derived profiles in the room
  userId: string;
  onSendChatMessage: (text: string) => Promise<void>;
  roomAdminId: string;
  roomMods: string[];
  onToggleModRole: (targetUid: string, username: string) => Promise<void>;
  onOpenSidebar?: () => void;
}

export default function ChatView({
  activeRoom,
  activeChannelName,
  chatMessages,
  roomTraders,
  userId,
  onSendChatMessage,
  roomAdminId,
  roomMods,
  onToggleModRole,
  onOpenSidebar,
}: ChatViewProps) {
  const [inputText, setInputText] = useState("");
  const messageStreamRef = useRef<HTMLDivElement>(null);

  // Auto scroll down
  useEffect(() => {
    if (messageStreamRef.current) {
      messageStreamRef.current.scrollTop = messageStreamRef.current.scrollHeight;
    }
  }, [chatMessages, activeChannelName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const msg = inputText.trim();
    setInputText("");
    await onSendChatMessage(msg);
  };

  // Filter messages for current active channel
  const currentChanMessages = chatMessages.filter(
    (msg) => msg.channel === activeChannelName
  );

  return (
    <div className="flex-1 h-full min-h-0 flex w-full bg-[#1E2023] relative overflow-hidden">
      {/* Middle Chat Panel */}
      <div className="flex-1 h-full min-h-0 flex flex-col">
        {/* Message Stream */}
        <div
          ref={messageStreamRef}
          className="flex-grow p-4 md:p-6 overflow-y-auto space-y-3 no-scrollbar bg-[#1E2023]"
        >
          {currentChanMessages.length > 0 ? (
            currentChanMessages.map((msg) => {
              const isSystemEmbed = msg.isEmbed === true;
              const isMe = msg.userId === userId;
              const msgTime = msg.timestamp
                ? new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              if (isSystemEmbed) {
                // High-End Glowing Trade Ledger Embed
                const amount = msg.amount || 0;
                const isProfit = amount >= 0;
                return (
                  <div
                    key={msg.id}
                    className="flex items-start space-x-3 max-w-lg mx-auto py-1 animate-in fade-in zoom-in-95 duration-200 w-full"
                  >
                    <div className="w-8 h-8 rounded bg-[#2A2D31] flex items-center justify-center text-white shrink-0 shadow">
                      <TrendingUp className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-[10px] text-[#8E9297] uppercase tracking-widest">
                          SyncPL Ledger Node
                        </span>
                        <span className="text-[9px] text-[#72767D] font-mono font-bold">
                          {msgTime}
                        </span>
                      </div>
                      <div
                        className={`mt-1.5 p-3.5 bg-[#121417] border ${
                          isProfit
                            ? "border-emerald-500/20 shadow-emerald-500/5"
                            : "border-red-500/20 shadow-red-500/5"
                        } rounded relative overflow-hidden shadow-md`}
                      >
                        {/* Background flare */}
                        <div
                          className={`absolute top-0 right-0 w-20 h-20 rounded-full ${
                            isProfit ? "bg-emerald-500/5" : "bg-red-500/5"
                          } filter blur-xl`}
                        />

                        <div className="flex items-center justify-between relative z-10">
                          <div className="space-y-1">
                            <span className="block text-[8px] text-[#72767D] uppercase tracking-widest font-black">
                              TRADER
                            </span>
                            <span className="font-bold text-gray-200 text-xs">
                              {msg.username}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[8px] text-[#72767D] uppercase tracking-widest font-black">
                              ROOM CONTRACT
                            </span>
                            <span className="font-mono text-xs font-extrabold text-indigo-400">
                              {activeRoom.id}
                            </span>
                          </div>
                        </div>

                        <div className="my-2.5 border-t border-[#2A2D31] relative z-10" />

                        <div className="flex items-center justify-between gap-4 relative z-10">
                          <span className="px-2 py-0.5 rounded bg-[#1E2023] text-[9px] font-mono font-black text-indigo-300 border border-[#2A2D31] uppercase tracking-wider">
                            {msg.asset}
                          </span>
                          <span
                            className={`font-black text-sm font-mono flex items-center gap-1 ${
                              isProfit ? "text-[#43B581]" : "text-[#F04747]"
                            }`}
                          >
                            {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                            {formatCurrency(amount)}
                          </span>
                        </div>

                        {msg.notes && (
                          <div className="mt-2.5 p-2 bg-[#08090A]/40 border border-[#2A2D31]/40 rounded relative z-10">
                            <p className="text-[10px] text-[#8E9297] leading-relaxed italic">
                              "{msg.notes}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Standard Chat message
              const initials = msg.username.substring(0, 2).toUpperCase();
              const avatarBgClass =
                msg.avatarColor === "pink"
                  ? "bg-pink-500/10 border-pink-500/30 text-pink-400"
                  : msg.avatarColor === "emerald"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : msg.avatarColor === "amber"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : msg.avatarColor === "sky"
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                  : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400";

              return (
                <div
                  key={msg.id}
                  className="flex w-full py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150 justify-start"
                >
                  <div className="flex items-start space-x-2.5 max-w-[85%]">
                    {/* Avatar */}
                    {msg.avatarType === "url" && msg.avatarVal ? (
                      <div className="w-8 h-8 rounded border border-[#2A2D31] overflow-hidden flex items-center justify-center bg-[#08090A] shrink-0">
                        <img
                          src={msg.avatarVal}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-8 h-8 rounded border border-[#2A2D31] flex items-center justify-center font-bold text-xs ${avatarBgClass} shrink-0`}
                      >
                        {msg.avatarVal || initials}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2 mb-0.5">
                        <span className={`font-bold text-[11px] tracking-wide ${
                          isMe ? "text-indigo-400" : "text-[#B9BBBE]"
                        }`}>
                          {msg.username}
                        </span>
                        {isMe && (
                          <span className="text-[8px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-1 py-0.2 rounded font-black uppercase tracking-wider scale-90">
                            Me
                          </span>
                        )}
                        <span className="text-[9px] text-[#72767D] font-mono font-bold">
                          {msgTime}
                        </span>
                      </div>
                      <div className={`p-2.5 border rounded text-xs font-semibold leading-relaxed break-all text-gray-200 shadow-sm ${
                        isMe
                          ? "border-indigo-500/25 bg-indigo-950/15"
                          : "border-[#2A2D31]/50 bg-[#121417]/40"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center min-h-[300px] py-16 text-[#72767D] w-full">
              <Bot className="w-12 h-12 text-[#2A2D31] mb-2 animate-pulse shrink-0" />
              <p className="text-sm font-bold">#{activeChannelName} is empty</p>
              <p className="text-xs text-center px-4 max-w-sm mt-1.5 leading-relaxed">
                Send a secure sync packet to initiate trading discussions inside this room node!
              </p>
            </div>
          )}
        </div>

        {/* Message Input Form */}
        {activeChannelName === "pnl-flex" ? (
          <div className="p-4 border-t border-[#2A2D31] shrink-0 bg-[#121417] text-center flex items-center justify-center text-xs font-bold text-[#8E9297] gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span>#pnl-flex is a read-only channel. Verified trade ledgers are automatically posted here.</span>
          </div>
        ) : (
          <div className="p-3 border-t border-[#2A2D31] shrink-0 bg-[#1E2023]">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                required
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Send a secure sync packet to #${activeChannelName}...`}
                className="w-full bg-[#08090A] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-medium placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs px-4 rounded transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Right Sidebar: Active Members list */}
      <div className="hidden lg:flex w-52 bg-[#121417] border-l border-[#2A2D31] flex-col shrink-0 text-gray-300 h-full min-h-0">
        <div className="p-4 space-y-3 overflow-y-auto flex-grow no-scrollbar">
          <div className="px-1 mb-2">
            <span className="text-[10px] font-black text-[#8E9297] uppercase tracking-widest">
              Active Partners — {roomTraders.length}
            </span>
          </div>
          {roomTraders.map((trader) => {
            const isCreator = trader.activeGroupId
              ? trader.username === activeRoom.creatorName
              : false; // fallback check
            const isMod = roomMods.includes(trader.username) || false; // simpler matching for mocks
            const showModButton = userId === activeRoom.creatorId;

            const initials = trader.username.substring(0, 2).toUpperCase();
            const avatarBgClass =
              trader.avatarColor === "pink"
                ? "bg-pink-500/10 border-pink-500/30 text-pink-400"
                : trader.avatarColor === "emerald"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : trader.avatarColor === "amber"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : trader.avatarColor === "sky"
                ? "bg-sky-400/10 border-sky-400/30 text-sky-400"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400";

            return (
              <div
                key={trader.username}
                className="flex items-center justify-between p-1 hover:bg-[#1E2023] rounded transition group"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="relative">
                    {trader.avatarType === "url" && trader.avatarVal ? (
                      <div className="w-7 h-7 rounded border border-[#2A2D31] overflow-hidden flex items-center justify-center bg-[#08090A] shrink-0">
                        <img
                          src={trader.avatarVal}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-7 h-7 rounded border border-[#2A2D31] flex items-center justify-center font-bold text-xs ${avatarBgClass} shrink-0`}
                      >
                        {trader.avatarVal || initials}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-gray-950"></span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-gray-200 block truncate">
                        {trader.username}
                      </span>
                      {isCreator ? (
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Creator" />
                      ) : isMod ? (
                        <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" title="Moderator" />
                      ) : null}
                    </div>
                    <span className="text-[8px] text-[#72767D] block truncate font-mono">
                      Active Sync
                    </span>
                  </div>
                </div>

                {/* Mod Toggles inside Creator's panel */}
                {showModButton && !isCreator && (
                  <button
                    onClick={() => onToggleModRole(trader.username, trader.username)}
                    className="p-1 hover:bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition duration-150"
                    title={isMod ? "Remove Mod Role" : "Grant Mod Role"}
                  >
                    {isMod ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <ShieldPlus className="w-3.5 h-3.5 text-sky-400" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
