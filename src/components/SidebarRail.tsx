import React from "react";
import { Plus, Compass, LogOut, MessageSquare } from "lucide-react";
import { Room } from "../types";

interface SidebarRailProps {
  rooms: Room[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  onLeaveRoom: (roomId: string) => void;
  onOpenJoinCreateModal: () => void;
  userProfileName: string;
  onLogout: () => void;
}

export default function SidebarRail({
  rooms,
  activeRoomId,
  onSelectRoom,
  onLeaveRoom,
  onOpenJoinCreateModal,
  userProfileName,
  onLogout,
}: SidebarRailProps) {
  return (
    <div className="w-[72px] bg-[#08090A] flex flex-col items-center py-4 justify-between h-full border-r border-[#2A2D31] shrink-0 select-none">
      {/* Top Section */}
      <div className="flex flex-col items-center space-y-3 w-full">
        {/* Brand Icon (Home/Lobby logo) */}
        <div
          className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white cursor-pointer hover:rounded-lg transition-all duration-300 shadow-lg"
          title="SyncPL Home Terminal"
        >
          <Compass className="w-5 h-5 animate-pulse" />
        </div>

        <div className="w-8 border-t border-[#2A2D31] my-1"></div>

        {/* Rooms Scroll List */}
        <div className="flex flex-col items-center space-y-3 w-full overflow-y-auto max-h-[calc(100dvh-220px)] no-scrollbar">
          {rooms.map((room) => {
            const isActive = room.id === activeRoomId;
            const displayCode = room.id.replace("PL-", "").substring(0, 3);
            return (
              <div key={room.id} className="relative group flex items-center justify-center w-full">
                {/* Indicator Pill */}
                <div
                  className={`absolute left-0 w-1 bg-white rounded-r-md transition-all duration-300 ${
                    isActive
                      ? "h-10"
                      : "h-0 group-hover:h-5"
                  }`}
                />

                {/* Room Circle */}
                <button
                  onClick={() => onSelectRoom(room.id)}
                  className={`w-12 h-12 rounded-3xl flex items-center justify-center text-xs font-black tracking-wider transition-all duration-300 relative ${
                    isActive
                      ? "bg-indigo-600 text-white rounded-xl shadow-lg"
                      : "bg-[#1E2023] text-[#8E9297] border border-[#2A2D31] hover:bg-indigo-900/40 hover:text-white hover:rounded-xl"
                  }`}
                  title={`Workspace ${room.id}`}
                >
                  {displayCode}
                </button>

                {/* Leave Button overlay or small hover icon */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLeaveRoom(room.id);
                  }}
                  className="absolute -right-2 top-0 bg-[#08090A] border border-[#2A2D31] hover:bg-red-500 hover:text-white text-red-400 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow shadow-black"
                  title="Leave Room"
                >
                  <LogOut className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}

          {/* Plus / Create button */}
          <button
            onClick={onOpenJoinCreateModal}
            className="w-12 h-12 rounded-3xl bg-[#1E2023] border border-dashed border-[#2A2D31] flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-600/20 hover:border-indigo-500/30 hover:rounded-xl transition-all duration-300"
            title="Join or Create a Room"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col items-center space-y-4 w-full">
        <div className="w-8 border-t border-[#2A2D31] my-1"></div>

        {/* Log Out Icon */}
        <button
          onClick={onLogout}
          className="w-10 h-10 rounded-xl bg-[#1E2023] text-gray-500 hover:text-red-400 hover:bg-red-500/10 hover:border hover:border-red-500/20 flex items-center justify-center transition-all duration-300 cursor-pointer"
          title="Log Out (Disconnect)"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
