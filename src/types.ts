export interface Room {
  id: string;
  creatorId: string;
  creatorName: string;
  moderators: string[];
  createdAt: string;
  name?: string;
}

export interface UserProfile {
  username: string;
  avatarColor: "indigo" | "pink" | "emerald" | "amber" | "sky";
  avatarType: "emoji" | "url";
  avatarVal: string;
  groupIds: string[];
  activeGroupId: string;
  createdAt?: string;
}

export interface PnlLog {
  id: string;
  userId: string;
  username: string;
  groupId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  strategy: string;
  asset: string;
  notes: string;
  win: boolean;
  timestamp: string;
  isLive?: boolean;
  direction?: "long" | "short";
  entryPrice?: number;
  tp?: number;
  sl?: number;
  currentPrice?: number;
  status?: "open" | "closed";
  outcome?: "TP" | "SL" | "manual" | "";
}

export interface Channel {
  id: string;
  name: string;
  type: "text" | "voice";
  groupId: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatarColor: string;
  avatarType: "emoji" | "url";
  avatarVal: string;
  groupId: string;
  text: string;
  channel: string;
  timestamp: string;
  isEmbed?: boolean;
  amount?: number;
  asset?: string;
  notes?: string;
}

export interface VoiceUser {
  id: string;
  userId: string;
  username: string;
  groupId: string;
  channel: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  joinedAt: string;
  avatarColor?: string;
  avatarType?: "emoji" | "url";
  avatarVal?: string;
}

export interface LiveTrade {
  id: string;
  userId: string;
  username: string;
  groupId: string;
  asset: string;
  direction: "long" | "short";
  entryPrice: number;
  tp: number;
  sl: number;
  currentPrice: number;
  status: "open" | "closed";
  outcome: "TP" | "SL" | "manual" | "";
  profitAmount?: number;
  notes: string;
  timestamp: string;
  isLive?: boolean;
  quantity?: number;
  exitPrice?: number;
}

