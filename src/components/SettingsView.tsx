import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Globe,
  PlusCircle,
  Volume2,
  Mic,
  Settings,
  Pencil,
  Trash2,
  Lock,
  RefreshCw,
  Play,
  Square,
  Sparkles,
} from "lucide-react";
import { Channel, Room, UserProfile } from "../types";

interface SettingsViewProps {
  profile: UserProfile | null;
  activeRoom: Room;
  channels: Channel[];
  onUpdateProfile: (
    username: string,
    color: "indigo" | "pink" | "emerald" | "amber" | "sky",
    type: "emoji" | "url",
    val: string
  ) => Promise<void>;
  onAddChannel: (name: string, type: "text" | "voice") => Promise<void>;
  onDeleteChannel: (id: string, name: string) => Promise<void>;
  onRenameChannel: (id: string, name: string) => void;
  onCopyRoomCode: () => void;
  onJoinRoomCode: (code: string) => Promise<void>;
  onCreateNewRoom: () => Promise<void>;
  isCreatorOrMod: boolean;
  onSimulateAiAdvisor: () => void;
  voiceName: string;
  setVoiceName: (val: string) => void;
  vocalPrompt: string;
  setVocalPrompt: (val: string) => void;
}

export default function SettingsView({
  profile,
  activeRoom,
  channels,
  onUpdateProfile,
  onAddChannel,
  onDeleteChannel,
  onRenameChannel,
  onCopyRoomCode,
  onJoinRoomCode,
  onCreateNewRoom,
  isCreatorOrMod,
  onSimulateAiAdvisor,
  voiceName,
  setVoiceName,
  vocalPrompt,
  setVocalPrompt,
}: SettingsViewProps) {
  // Profile settings state
  const [username, setUsername] = useState(profile?.username || "");
  const [avatarColor, setAvatarColor] = useState<"indigo" | "pink" | "emerald" | "amber" | "sky">(
    profile?.avatarColor || "indigo"
  );
  const [avatarType, setAvatarType] = useState<"emoji" | "url">(profile?.avatarType || "emoji");
  const [avatarVal, setAvatarVal] = useState(profile?.avatarVal || "🐂");

  // New channel state
  const [newChanName, setNewChanName] = useState("");
  const [newChanType, setNewChanType] = useState<"text" | "voice">("text");

  // Room action state
  const [joinCode, setJoinCode] = useState("");

  // Mic hardware testing state
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState("");
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [dbLevel, setDbLevel] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Sync profile edits with props when loaded
  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setAvatarColor(profile.avatarColor);
      setAvatarType(profile.avatarType);
      setAvatarVal(profile.avatarVal);
    }
  }, [profile]);

  // Enumerate Mic Hardware on mount
  useEffect(() => {
    enumerateMics();
  }, []);

  const enumerateMics = async () => {
    try {
      // Trigger temporary permit dialog
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
    } catch (e) {
      console.warn("Audio hardware capture permission denied or unavailable", e);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    await onUpdateProfile(username.trim(), avatarColor, avatarType, avatarVal);
    alert("Profile configurations updated!");
  };

  const handleAddChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim()) return;
    const formatted = newChanName.trim().toLowerCase().replace(/\s+/g, "-");
    await onAddChannel(formatted, newChanType);
    setNewChanName("");
    alert(`Channel #${formatted} created successfully!`);
  };

  const handleJoinRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    await onJoinRoomCode(joinCode.trim().toUpperCase());
    setJoinCode("");
    alert(`Successfully synchronized workspace room ${joinCode.trim().toUpperCase()}!`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
      alert("Please upload an image smaller than 500KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarType("url");
        setAvatarVal(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Mic Testing Diagnostics
  const toggleMicTest = async () => {
    if (isTestingMic) {
      stopMicTest();
    } else {
      await startMicTest();
    }
  };

  const startMicTest = async () => {
    try {
      const constraints = selectedMicId
        ? { audio: { deviceId: { exact: selectedMicId } } }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source.connect(analyser);
      setIsTestingMic(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawWave = () => {
        if (!analyserRef.current || !canvasRef.current) return;
        animationRef.current = requestAnimationFrame(drawWave);

        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setDbLevel(Math.round(average));

        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext("2d");
        if (!canvasCtx) return;

        canvasCtx.fillStyle = "#060913";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 4;
          const greenVal = Math.min(255, 120 + barHeight * 3);
          const blueVal = Math.max(0, 200 - barHeight * 4);
          canvasCtx.fillStyle = `rgb(16, ${greenVal}, ${blueVal})`;

          const y = (canvas.height - barHeight) / 2;
          canvasCtx.fillRect(x, y, barWidth, barHeight);

          x += barWidth + 1.5;
        }
      };

      drawWave();
    } catch (e) {
      console.error("Mic test diagnostics failed", e);
      alert("Microphone permission denied or blocked by iframe constraint.");
    }
  };

  const stopMicTest = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setDbLevel(0);
    setIsTestingMic(false);

    const canvas = canvasRef.current;
    if (canvas) {
      const canvasCtx = canvas.getContext("2d");
      if (canvasCtx) {
        canvasCtx.fillStyle = "#060913";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto h-full text-[#DCDDDE]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-2xl text-white tracking-tight">
            Workspace Configuration Hub
          </h3>
          <p className="text-xs text-[#8E9297] mt-1">
            Configure trade channels, custom profile tags, and test the vocal speech advisor.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <div className="space-y-6">
          <form
            onSubmit={handleProfileSubmit}
            className="glass-panel p-5 rounded space-y-4 border border-[#2A2D31]"
          >
            <h4 className="font-bold text-gray-100 text-sm flex items-center gap-2">
              <User className="text-[#5865F2] w-4.5 h-4.5" /> Sync Profile Settings
            </h4>

            <div>
              <label className="block text-[10px] font-bold text-[#8E9297] uppercase mb-1.5 tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                maxLength={18}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Trader Nickname"
                className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#8E9297] uppercase mb-1.5 tracking-wider">
                Profile Icon Color
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(["indigo", "pink", "emerald", "amber", "sky"] as const).map((color) => {
                  const bgClass =
                    color === "indigo"
                      ? "bg-[#5865F2]"
                      : color === "pink"
                      ? "bg-pink-500"
                      : color === "emerald"
                      ? "bg-emerald-500"
                      : color === "amber"
                      ? "bg-amber-500"
                      : "bg-sky-400";
                  const isSel = avatarColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarColor(color)}
                      className={`w-8 h-8 rounded border border-white/10 ${bgClass} ${
                        isSel ? "ring-2 ring-[#5865F2] ring-offset-2 ring-offset-[#0F1113]" : ""
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[#8E9297] uppercase tracking-wider">
                Avatar Type
              </label>
              <div className="flex rounded overflow-hidden border border-[#2A2D31]">
                <button
                  type="button"
                  onClick={() => setAvatarType("emoji")}
                  className={`flex-grow py-2 text-xs font-bold transition ${
                    avatarType === "emoji"
                      ? "bg-[#5865F2]/10 text-[#5865F2] border-r border-[#2A2D31]"
                      : "bg-[#121417] text-[#8E9297] border-r border-[#2A2D31]"
                  }`}
                >
                  Emoji Icon
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarType("url")}
                  className={`flex-grow py-2 text-xs font-bold transition ${
                    avatarType === "url" ? "bg-[#5865F2]/10 text-[#5865F2]" : "bg-[#121417] text-[#8E9297]"
                  }`}
                >
                  Image URL
                </button>
              </div>

              {avatarType === "emoji" ? (
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-[#8E9297] uppercase tracking-widest">
                    Trading Icon Preset
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {["🐂", "🐻", "🐳", "🚀", "📈", "💰", "⚡", "🧠", "👑", "🎯"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatarVal(emoji)}
                        className={`p-2 bg-[#121417] border border-[#2A2D31] rounded text-sm hover:border-[#5865F2] transition ${
                          avatarVal === emoji ? "border-[#5865F2] bg-[#5865F2]/10" : ""
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-[#8E9297] uppercase tracking-widest">
                      Custom Image Upload
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="custom-pfp-upload"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById("custom-pfp-upload")?.click()}
                      className="w-full bg-[#1E2023] hover:bg-[#24272C] border border-[#2A2D31] text-white font-bold text-xs py-2 rounded transition"
                    >
                      Upload File from PC
                    </button>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[#8E9297] uppercase tracking-widest">
                      Or Paste Image Address Link
                    </label>
                    <input
                      type="url"
                      value={avatarType === "url" ? avatarVal : ""}
                      onChange={(e) => setAvatarVal(e.target.value)}
                      placeholder="https://example.com/avatar.png"
                      className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2.5 rounded transition shadow"
            >
              Apply Profile Changes
            </button>
          </form>

          {/* Room Sync integration */}
          <div className="glass-panel p-5 rounded space-y-4 border border-[#2A2D31]">
            <h4 className="font-bold text-gray-100 text-sm flex items-center gap-2">
              <Globe className="text-[#5865F2] w-4.5 h-4.5" /> Room Integration
            </h4>

            <div className="bg-[#121417] p-3 rounded border border-[#2A2D31]">
              <span className="text-[10px] font-bold text-[#8E9297] uppercase tracking-widest">
                Active Shared Room
              </span>
              <div className="flex items-center justify-between mt-1 font-mono">
                <span className="font-black text-[#5865F2] tracking-wider text-sm">
                  {activeRoom.id}
                </span>
                <button
                  type="button"
                  onClick={onCopyRoomCode}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                >
                  Copy Link
                </button>
              </div>
            </div>

            <form onSubmit={handleJoinRoomSubmit} className="space-y-2">
              <label className="block text-[10px] font-bold text-[#8E9297] uppercase mb-1.5 tracking-wider">
                Enter Another Room Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="PL-XXXX"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-sm text-white uppercase font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-[#5865F2] flex-grow font-mono"
                />
                <button
                  type="submit"
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs px-4 rounded transition"
                >
                  Join
                </button>
              </div>
            </form>

            <button
              onClick={onCreateNewRoom}
              className="w-full bg-[#1E2023] border border-[#2A2D31] hover:bg-[#24272C] text-gray-200 font-bold text-xs py-2.5 px-4 rounded transition"
            >
              Establish New Room Code
            </button>
          </div>
        </div>

        {/* Channels Administration */}
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded space-y-4 relative overflow-hidden border border-[#2A2D31]">
            {!isCreatorOrMod && (
              <div className="absolute inset-0 bg-[#0F1113]/95 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-6">
                <div className="p-3 bg-[#1E2023] text-[#8E9297] rounded border border-[#2A2D31] mb-3 shadow">
                  <Lock className="w-5 h-5" />
                </div>
                <h5 className="text-sm font-bold text-gray-200">Creation Restricted</h5>
                <p className="text-xs text-[#8E9297] mt-1 max-w-[180px]">
                  Only room creators or moderators can establish channels here.
                </p>
              </div>
            )}

            <h4 className="font-bold text-gray-100 text-sm flex items-center gap-2">
              <PlusCircle className="text-[#5865F2] w-4.5 h-4.5" /> Add Trading Channels
            </h4>

            <form onSubmit={handleAddChannelSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#8E9297] uppercase mb-1.5 tracking-wider font-semibold">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="crypto-scalps"
                  value={newChanName}
                  onChange={(e) => setNewChanName(e.target.value)}
                  className="w-full bg-[#121417] border border-[#2A2D31] rounded px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold lowercase font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8E9297] uppercase mb-1.5 tracking-wider font-semibold">
                  Channel Type
                </label>
                <div className="flex rounded overflow-hidden border border-[#2A2D31]">
                  <button
                    type="button"
                    onClick={() => setNewChanType("text")}
                    className={`flex-grow py-2 text-xs font-bold transition ${
                      newChanType === "text"
                        ? "bg-[#5865F2]/10 text-[#5865F2] border-r border-[#2A2D31]"
                        : "bg-[#121417] text-[#8E9297] border-r border-[#2A2D31]"
                    }`}
                  >
                    # Text Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChanType("voice")}
                    className={`flex-grow py-2 text-xs font-bold transition ${
                      newChanType === "voice"
                        ? "bg-[#5865F2]/10 text-[#5865F2]"
                        : "bg-[#121417] text-[#8E9297]"
                    }`}
                  >
                    🔊 Voice Room
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-xs py-2.5 rounded transition flex items-center justify-center gap-1.5 shadow"
              >
                Create Channel
              </button>
            </form>
          </div>

          {/* Manage Channels list */}
          <div className="glass-panel p-5 rounded space-y-3 border border-[#2A2D31]">
            <h4 className="font-bold text-gray-100 text-sm flex items-center gap-2">
              <Settings className="text-[#5865F2] w-4.5 h-4.5" /> Manage Channels
            </h4>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
              {channels.map((chan) => (
                <div
                  key={chan.id}
                  className="flex items-center justify-between p-2 bg-[#121417] border border-[#2A2D31] rounded"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-xs text-[#8E9297] font-bold">
                      {chan.type === "text" ? "#" : "🔊"}
                    </span>
                    <span className="text-xs text-gray-300 font-semibold truncate">
                      {chan.name}
                    </span>
                  </div>

                  {isCreatorOrMod ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onRenameChannel(chan.id, chan.name)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition p-1.5 hover:bg-[#1E2023] rounded"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteChannel(chan.id, chan.name)}
                        className="text-xs text-rose-400 hover:text-rose-300 transition p-1.5 hover:bg-rose-500/10 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[8px] text-gray-500 bg-[#121417] px-2 py-1 rounded">
                      Locked
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hardware Mic Visualizer & AI Synth settings */}
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded space-y-4 border border-[#2A2D31] shadow-lg">
            <h4 className="font-bold text-gray-100 text-sm flex items-center gap-2">
              <Mic className="text-[#5865F2] w-4.5 h-4.5" /> Mic Hardware Diagnostic
            </h4>
            <p className="text-xs text-[#8E9297] leading-relaxed">
              Enumerate physical hardware microphones and trace decibels before entering voice nodes.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-[#8E9297] uppercase mb-1.5 tracking-wider">
                Select Audio Input Device
              </label>
              <select
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                className="w-full bg-[#121417] border border-[#2A2D31] text-sm rounded px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#5865F2] text-white font-medium"
              >
                <option value="">Default Microphone</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone (${device.deviceId.substring(0, 5)})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-[#8E9297] uppercase tracking-wider">
                <span>Decibel Strength</span>
                <span className="font-mono text-[#43B581] font-bold">{dbLevel} dB</span>
              </div>
              <div className="h-10 bg-[#121417] rounded border border-[#2A2D31] overflow-hidden relative flex items-center px-1">
                <canvas ref={canvasRef} className="w-full h-8 block" />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleMicTest}
                className={`flex-grow border font-bold text-xs py-2.5 px-3 rounded transition flex items-center justify-center gap-1.5 ${
                  isTestingMic
                    ? "bg-rose-600/20 hover:bg-rose-600/35 border-rose-500/30 text-rose-400 animate-pulse"
                    : "bg-[#5865F2]/20 hover:bg-[#5865F2]/30 border-[#5865F2]/30 text-indigo-400"
                }`}
              >
                {isTestingMic ? (
                  <>
                    <Square className="w-3.5 h-3.5" /> Stop Testing
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Test Microphone
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={enumerateMics}
                className="bg-[#1E2023] hover:bg-[#24272C] border border-[#2A2D31] text-gray-300 p-2.5 rounded transition"
                title="Refresh hardware"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Co-Pilot Voice Engine Settings */}
          <div className="glass-panel p-5 rounded space-y-4 border border-[#2A2D31]">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-100 text-sm flex items-center gap-2">
                <Settings className="text-[#5865F2] w-4.5 h-4.5" /> Co-Pilot Voice Engine
              </h4>
              <span className="bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">
                GEMINI TTS
              </span>
            </div>
            <p className="text-xs text-[#8E9297] leading-relaxed">
              Custom-tailor your voice assistant's speaking parameters. SyncPL uses Gemini to synthesize speaking outputs dynamically.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-[#8E9297] uppercase mb-1.5 tracking-wider">
                Vocal Actor Presets
              </label>
              <select
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full bg-[#121417] border border-[#2A2D31] text-sm rounded px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#5865F2] text-white font-medium"
              >
                <option value="Zephyr">Zephyr (Bright)</option>
                <option value="Puck">Puck (Upbeat)</option>
                <option value="Charon">Charon (Informative)</option>
                <option value="Kore">Kore (Firm)</option>
                <option value="Fenrir">Fenrir (Excitable)</option>
                <option value="Leda">Leda (Youthful)</option>
                <option value="Sulafat">Sulafat (Warm)</option>
                <option value="Schedar">Schedar (Even)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#8E9297] uppercase mb-1.5 tracking-wider">
                Vocal Style Prompt
              </label>
              <input
                type="text"
                value={vocalPrompt}
                onChange={(e) => setVocalPrompt(e.target.value)}
                placeholder="Say critically like a risk analyst..."
                className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-mono"
              />
            </div>

            <button
              type="button"
              onClick={onSimulateAiAdvisor}
              className="w-full bg-[#43B581] hover:bg-[#3ca374] text-white font-bold text-xs py-2.5 px-4 rounded transition flex items-center justify-center gap-1.5 shadow"
            >
              <Sparkles className="w-4.5 h-4.5" />
              <span>Test Voice Co-Pilot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
