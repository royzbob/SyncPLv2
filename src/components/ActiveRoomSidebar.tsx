import React from "react";
import {
  LayoutDashboard,
  MessageSquareCode,
  Trophy,
  History,
  SlidersHorizontal,
  PlusCircle,
  Volume2,
  Mic,
  MicOff,
  VolumeX,
  PhoneOff,
  Sparkles,
  Bot,
  Crown,
  Shield,
  Plus,
  MessageSquare,
  Activity,
} from "lucide-react";
import { Room, Channel, VoiceUser, UserProfile } from "../types";

interface ActiveRoomSidebarProps {
  activeRoom: Room;
  channels: Channel[];
  activeChannelName: string;
  onSelectChannel: (chanName: string, type: "text" | "voice") => void;
  activeVoiceChannel: string | null;
  onToggleVoiceRoom: (chanName: string) => void;
  voiceUsers: VoiceUser[];
  profile: UserProfile | null;
  activeTab: string;
  onSwitchTab: (tab: string) => void;
  onOpenLogModal: () => void;
  onDisconnectVoice: () => void;
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onSimulateAiAdvisor: () => void;
  isCreatorOrMod: boolean;
  onAddChannelClick: (type: "text" | "voice") => void;
  onCopyRoomCode: () => void;
  isChatSidePanelOpen?: boolean;
}

export default function ActiveRoomSidebar({
  activeRoom,
  channels,
  activeChannelName,
  onSelectChannel,
  activeVoiceChannel,
  onToggleVoiceRoom,
  voiceUsers,
  profile,
  activeTab,
  onSwitchTab,
  onOpenLogModal,
  onDisconnectVoice,
  isMuted,
  isDeafened,
  onToggleMic,
  onToggleDeafen,
  onSimulateAiAdvisor,
  isCreatorOrMod,
  onAddChannelClick,
  onCopyRoomCode,
  isChatSidePanelOpen = false,
}: ActiveRoomSidebarProps) {
  // Navigation button class
  const getNavBtnClass = (tabName: string) => {
    const isSelected = activeTab === tabName;
    return `w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition duration-150 border ${
      isSelected
        ? "bg-[#2A2D31] text-white border-[#2A2D31]"
        : "text-[#8E9297] border-transparent hover:bg-[#1E2023] hover:text-[#DCDDDE]"
    }`;
  };

  const textChans = channels.filter((c) => c.type === "text");
  const voiceChans = channels.filter((c) => c.type === "voice");

  return (
    <aside className="w-60 bg-[#121417] border-r border-[#2A2D31] flex flex-col shrink-0 z-20">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#2A2D31] flex items-center justify-between bg-[#08090A]/30">
        <div className="flex flex-col">
          <span className="text-[9px] text-[#72767D] font-extrabold tracking-widest uppercase">
            Active Workspace
          </span>
          <span
            onClick={onCopyRoomCode}
            className="text-base font-black text-indigo-400 tracking-wider font-mono cursor-pointer hover:text-indigo-300 transition flex items-center gap-1.5"
            title="Copy Invite Code"
          >
            {activeRoom.id}
          </span>
        </div>
        <button
          onClick={onCopyRoomCode}
          className="p-1.5 bg-[#1E2023] hover:bg-[#2A2D31] border border-[#2A2D31] text-indigo-400 rounded transition"
          title="Copy invite code"
        >
          <span className="text-[10px] font-bold">Copy</span>
        </button>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="p-3 border-b border-[#2A2D31] space-y-1 bg-[#0F1113]/10">
        <button
          onClick={() => onSwitchTab("dashboard")}
          className={getNavBtnClass("dashboard")}
        >
          <div className="flex items-center space-x-2.5">
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard Overview</span>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab("chat")}
          className={getNavBtnClass("chat")}
        >
          <div className="flex items-center space-x-2.5">
            <MessageSquareCode className="w-4 h-4" />
            <span>Trading Desk Chat</span>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab("live-trades")}
          className={getNavBtnClass("live-trades")}
        >
          <div className="flex items-center space-x-2.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Live Trades Tracker</span>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab("leaderboard")}
          className={getNavBtnClass("leaderboard")}
        >
          <div className="flex items-center space-x-2.5">
            <Trophy className="w-4 h-4" />
            <span>Leaderboard Board</span>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab("logs")}
          className={getNavBtnClass("logs")}
        >
          <div className="flex items-center space-x-2.5">
            <History className="w-4 h-4" />
            <span>Ledger Records</span>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab("partners")}
          className={getNavBtnClass("partners")}
        >
          <div className="flex items-center space-x-2.5">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Workspace Settings</span>
          </div>
        </button>
      </div>

      {/* Channels List Section */}
      <div className="flex-grow overflow-y-auto p-3 space-y-4">
        {/* Text Channels */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
              Text Channels
            </span>
            {isCreatorOrMod && (
              <button
                onClick={() => onAddChannelClick("text")}
                className="text-gray-500 hover:text-white transition cursor-pointer"
                title="Create Text Channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {textChans.map((chan) => {
              const isSelected = (activeTab === "chat" || isChatSidePanelOpen) && activeChannelName === chan.name;
              return (
                <button
                  key={chan.id}
                  onClick={() => {
                    onSelectChannel(chan.name, "text");
                  }}
                  className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs font-semibold transition-all duration-150 border ${
                    isSelected
                      ? "bg-[#2A2D31] text-white border-[#2A2D31]"
                      : "text-[#8E9297] hover:bg-[#1E2023] hover:text-white border-transparent"
                  }`}
                >
                  <span className="text-indigo-400/50 font-black text-sm">#</span>
                  <span className="truncate">{chan.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Channels */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
              Voice Rooms
            </span>
            {isCreatorOrMod && (
              <button
                onClick={() => onAddChannelClick("voice")}
                className="text-gray-500 hover:text-white transition cursor-pointer"
                title="Create Voice Channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {voiceChans.map((chan) => {
              const isConnected = activeVoiceChannel === chan.name;
              const chanUsers = voiceUsers.filter((v) => v.channel === chan.name);
              const count = chanUsers.length;
              const isAi =
                chan.name.includes("🤖") || chan.name.toLowerCase().includes("ai");

              return (
                <div key={chan.id} className="space-y-0.5">
                  <button
                    onClick={() => onToggleVoiceRoom(chan.name)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-semibold transition-all duration-150 border cursor-pointer ${
                      isConnected
                        ? isAi
                          ? "bg-pink-600/10 text-pink-400 border-pink-500/25"
                          : "bg-emerald-600/10 text-emerald-400 border-emerald-500/25"
                        : "text-[#8E9297] hover:bg-[#1E2023] hover:text-white border-transparent"
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {isAi ? (
                        <Bot className={`w-3.5 h-3.5 ${isConnected ? "animate-pulse" : ""}`} />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                      <span className="truncate">{chan.name}</span>
                    </div>
                    <span className="text-[9px] bg-[#0F1113] px-1.5 py-0.5 rounded border border-[#2A2D31] text-gray-400 font-mono font-bold">
                      {count}
                    </span>
                  </button>

                  {/* Render players joined underneath this voice room */}
                  {count > 0 && (
                    <div className="pl-5 pr-1 py-1 space-y-1">
                      {chanUsers.map((user) => {
                        const initials = user.username.substring(0, 2).toUpperCase();
                        const avatarBgClass =
                          user.avatarColor === "pink"
                            ? "bg-pink-500/10 border-pink-500/30 text-pink-400"
                            : user.avatarColor === "emerald"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : user.avatarColor === "amber"
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : user.avatarColor === "sky"
                            ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                            : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400";

                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between py-1 px-2 rounded hover:bg-[#1E2023]/60 transition-all duration-150 text-[10px]"
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              {user.avatarType === "url" && user.avatarVal ? (
                                <div className={`w-4 h-4 rounded border overflow-hidden flex items-center justify-center bg-[#08090A] shrink-0 transition-all duration-200 ${
                                  user.speaking
                                    ? "ring-2 ring-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] scale-105"
                                    : "border-[#2A2D31]"
                                }`}>
                                  <img
                                    src={user.avatarVal}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center font-bold text-[8px] shrink-0 transition-all duration-200 ${
                                    user.speaking
                                      ? "ring-2 ring-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] scale-105"
                                      : "border-white/10"
                                  } ${avatarBgClass}`}
                                >
                                  {user.avatarVal || initials}
                                </div>
                              )}
                              <span className="font-medium text-[#DCDDDE] truncate">
                                {user.username}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              {user.speaking && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              )}
                              {user.muted && <MicOff className="w-2.5 h-2.5 text-rose-400/80" />}
                              {user.deafened && <VolumeX className="w-2.5 h-2.5 text-rose-400/80" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Voice Status Panel */}
      {activeVoiceChannel && (
        <div className="p-3.5 bg-[#0B0C0E] border-t border-[#2A2D31] space-y-3 text-xs shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-black text-[9px] text-emerald-400 uppercase tracking-wider">
                Voice Connected
              </span>
            </div>
            <button
              onClick={onDisconnectVoice}
              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded transition"
              title="Disconnect Voice Room"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speakers Indicators List */}
          <div className="space-y-1.5 max-h-24 overflow-y-auto font-sans">
            {voiceUsers
              .filter((v) => v.channel === activeVoiceChannel)
              .map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-1 px-1.5 rounded bg-gray-900/40 text-[10px] border border-white/5"
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        u.speaking ? "bg-emerald-400 animate-pulse" : "bg-gray-600"
                      }`}
                    ></span>
                    <span className="font-semibold text-gray-300 truncate">
                      {u.username}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    {u.speaking && (
                      <div className="flex items-center space-x-[1px] h-3 pr-1">
                        <div className="w-[1.5px] h-2 bg-emerald-400 rounded voice-bar"></div>
                        <div className="w-[1.5px] h-3 bg-emerald-400 rounded voice-bar"></div>
                        <div className="w-[1.5px] h-1 bg-emerald-400 rounded voice-bar"></div>
                      </div>
                    )}
                    {u.muted && <MicOff className="w-3 h-3 text-rose-400" />}
                    {u.deafened && <VolumeX className="w-3 h-3 text-rose-400" />}
                  </div>
                </div>
              ))}
          </div>

          {/* Voice Chat shortcut link */}
          <button
            onClick={() => {
              onSelectChannel("voice-general-chat", "text");
              onSwitchTab("chat");
            }}
            className="w-full flex items-center justify-center space-x-2 py-1.5 px-3 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/20 text-[#5865F2] hover:text-white rounded text-[10px] font-bold tracking-wider uppercase transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Open Voice Chat</span>
          </button>

          {/* Controls */}
          <div className="flex items-center justify-between border-t border-[#2A2D31]/40 pt-2 text-gray-400">
            <button
              onClick={onToggleMic}
              className={`p-2 rounded transition ${
                isMuted
                  ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                  : "hover:bg-[#1E2023] hover:text-white text-gray-300"
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={onToggleDeafen}
              className={`p-2 rounded transition ${
                isDeafened
                  ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                  : "hover:bg-[#1E2023] hover:text-white text-gray-300"
              }`}
              title={isDeafened ? "Undeafen Audio" : "Deafen Audio"}
            >
              {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onSimulateAiAdvisor}
              className="p-2 hover:bg-pink-500/10 hover:text-pink-400 rounded text-pink-500/75 transition"
              title="Simulate Voice Advisor"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Log Trade Button at Bottom */}
      <div className="p-3 border-t border-[#2A2D31] bg-[#08090A]">
        <button
          onClick={onOpenLogModal}
          className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2.5 px-4 rounded shadow-lg flex items-center justify-center space-x-2 transition active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Log New Trade</span>
        </button>
      </div>
    </aside>
  );
}
