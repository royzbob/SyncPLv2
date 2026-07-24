import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  X,
  Volume2,
  Info,
  AlertTriangle,
  Compass,
  LogOut,
  Sliders,
  CheckCircle,
  Menu,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  Clock,
  Settings,
  Lock,
  Bell,
  Coins,
  ExternalLink,
} from "lucide-react";

import { auth, db } from "./lib/firebase";
import { Room, Channel, VoiceUser, UserProfile, PnlLog, ChatMessage, LiveTrade, TradingRule } from "./types";
import { generateRandomRoomCode, initialTickers, TickerInfo, formatCurrency, getLocalDateString, getLocalTimeString } from "./utils/helpers";
import { playJoinSound, playLeaveSound } from "./utils/audio";
import { WebRtcVoiceManager } from "./lib/webrtcVoice";

const isMobileOrTablet = typeof window !== "undefined" && (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 1024);

// Firestore Error Logging Support for Security Rule Verification
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Import Modular Sub-views
import SidebarRail from "./components/SidebarRail";
import ActiveRoomSidebar from "./components/ActiveRoomSidebar";
import OnboardingView from "./components/OnboardingView";
import DashboardView from "./components/DashboardView";
import ChatView from "./components/ChatView";
import LeaderboardView from "./components/LeaderboardView";
import LogsView from "./components/LogsView";
import SettingsView from "./components/SettingsView";
import ChecklistView from "./components/ChecklistView";
import FriendsView from "./components/FriendsView";
import UpdateNotifier from "./components/UpdateNotifier";

export default function App() {
  // Authentication & Profile States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [traders, setTraders] = useState<UserProfile[]>([]);
  const [publicUsers, setPublicUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  // Custom Bespoke Skin Selection (Elite Perk)
  const [activeSkin, setActiveSkin] = useState<string>(() => {
    return localStorage.getItem("syncpl_custom_skin") || "default";
  });

  useEffect(() => {
    const handleSkinChange = () => {
      const skin = localStorage.getItem("syncpl_custom_skin") || "default";
      setActiveSkin(skin);
    };
    window.addEventListener("syncpl_skin_updated", handleSkinChange);
    return () => {
      window.removeEventListener("syncpl_skin_updated", handleSkinChange);
    };
  }, []);

  // Active room data subscriptions
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelName, setActiveChannelName] = useState("general-trading");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);
  // Active Voice status
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isMutedAll, setIsMutedAll] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  const [globalVolume, setGlobalVolume] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("syncpl_global_volume");
      return stored ? Number(stored) : 80;
    } catch {
      return 80;
    }
  });
  const [inputVolume, setInputVolume] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("syncpl_input_volume");
      return stored ? Number(stored) : 80;
    } catch {
      return 80;
    }
  });
  const [mutedUsers, setMutedUsers] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("syncpl_muted_users");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem("syncpl_user_volumes");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [selectedMicId, setSelectedMicId] = useState<string>(() => {
    try {
      return localStorage.getItem("syncpl_selected_mic_id") || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = localStorage.getItem("syncpl_selected_mic_id") || "";
        setSelectedMicId(stored);
      } catch (e) {
        console.warn(e);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleToggleMuteUser = (userId: string) => {
    setMutedUsers((prev) => {
      const updated = { ...prev, [userId]: !prev[userId] };
      try {
        localStorage.setItem("syncpl_muted_users", JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });
  };

  const handleChangeUserVolume = (userId: string, volume: number) => {
    setUserVolumes((prev) => {
      const updated = { ...prev, [userId]: volume };
      try {
        localStorage.setItem("syncpl_user_volumes", JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });
  };

  const handleChangeGlobalVolume = (volume: number) => {
    setGlobalVolume(volume);
    try {
      localStorage.setItem("syncpl_global_volume", String(volume));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleChangeInputVolume = (volume: number) => {
    setInputVolume(volume);
    try {
      localStorage.setItem("syncpl_input_volume", String(volume));
    } catch (e) {
      console.warn(e);
    }
  };

  const [pnlLogs, setPnlLogs] = useState<PnlLog[]>([]);
  const [liveTrades, setLiveTrades] = useState<LiveTrade[]>([]);
  const [tradingRules, setTradingRules] = useState<TradingRule[]>([]);

  // PIN lock states
  const [unlockedChannelIds, setUnlockedChannelIds] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("unlocked_channels");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [pendingChannelToUnlock, setPendingChannelToUnlock] = useState<Channel | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");

  const prevVoiceUsersRef = useRef<VoiceUser[] | null>(null);

  // Monitor voice users joins and leaves to play audio notifications
  useEffect(() => {
    if (prevVoiceUsersRef.current !== null) {
      const prev = prevVoiceUsersRef.current;
      const current = voiceUsers;

      // Someone joined a channel or hopped to another
      const joined = current.find(c => {
        const p = prev.find(prevU => prevU.id === c.id);
        return !p || p.channel !== c.channel;
      });

      // Someone left a channel or hopped to another
      const left = prev.find(p => {
        const c = current.find(currU => currU.id === p.id);
        return !c || c.channel !== p.channel;
      });

      if (joined) {
        if (!isMutedAll && !isDeafened && !mutedUsers[joined.id]) {
          const uVol = userVolumes[joined.id] !== undefined ? userVolumes[joined.id] : 100;
          playJoinSound((globalVolume / 100) * (uVol / 100));
        }
      } else if (left) {
        if (!isMutedAll && !isDeafened && !mutedUsers[left.id]) {
          const uVol = userVolumes[left.id] !== undefined ? userVolumes[left.id] : 100;
          playLeaveSound((globalVolume / 100) * (uVol / 100));
        }
      }
    }
    prevVoiceUsersRef.current = voiceUsers;
  }, [voiceUsers, isMutedAll, isDeafened, globalVolume, mutedUsers, userVolumes]);

  // Voice Activity Detection (VAD) loop using actual microphonic capture
  useEffect(() => {
    let micStream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let intervalId: any = null;
    let lastSpeaking = false;

    async function startVAD() {
      if (!currentUser || !activeVoiceChannel || isMuted) {
        return;
      }
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        intervalId = setInterval(async () => {
          if (!analyser || !currentUser || !activeVoiceChannel || isMuted) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          // A standard threshold (average amplitude > 8) to define vocal presence
          const isSpeakingNow = average > 8;

          if (isSpeakingNow !== lastSpeaking) {
            lastSpeaking = isSpeakingNow;
            try {
              const voiceDocRef = doc(db, "voice_users", currentUser.uid);
              await updateDoc(voiceDocRef, { speaking: isSpeakingNow });
            } catch (err) {
              console.warn("VAD Firestore update failed", err);
            }
          }
        }, isMobileOrTablet ? 450 : 150);
      } catch (err) {
        console.warn("Could not initiate Voice Activity Detection loop", err);
      }
    }

    startVAD();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close();
      }
      if (currentUser && lastSpeaking) {
        const voiceDocRef = doc(db, "voice_users", currentUser.uid);
        updateDoc(voiceDocRef, { speaking: false }).catch(() => {});
      }
    };
  }, [currentUser, activeVoiceChannel, isMuted]);

  // WebRTC Real-Time Voice Audio Mesh Connection
  const webrtcVoiceRef = useRef<WebRtcVoiceManager | null>(null);

  useEffect(() => {
    if (!currentUser || !activeVoiceChannel || !activeRoom) {
      if (webrtcVoiceRef.current) {
        webrtcVoiceRef.current.destroy();
        webrtcVoiceRef.current = null;
      }
      return;
    }

    // Skip WebRTC peer mesh for synthetic AI bot channels
    const isAi = activeVoiceChannel.includes("🤖") || activeVoiceChannel.toLowerCase().includes("ai");
    if (isAi) {
      if (webrtcVoiceRef.current) {
        webrtcVoiceRef.current.destroy();
        webrtcVoiceRef.current = null;
      }
      return;
    }

    const mutedUsersList = Array.isArray(mutedUsers)
      ? mutedUsers
      : Object.keys(mutedUsers || {}).filter((k) => mutedUsers[k]);

    const manager = new WebRtcVoiceManager({
      myUid: currentUser.uid,
      groupId: activeRoom.id,
      channelName: activeVoiceChannel,
      selectedMicId,
      isMuted,
      isDeafened,
      isMutedAll,
      globalVolume,
      inputVolume,
      mutedUsers: mutedUsersList,
      userVolumes,
      onError: (err) => {
        console.warn("WebRTC voice initialization notice:", err);
      },
    });

    webrtcVoiceRef.current = manager;
    manager.start();

    return () => {
      manager.destroy();
      if (webrtcVoiceRef.current === manager) {
        webrtcVoiceRef.current = null;
      }
    };
  }, [currentUser?.uid, activeVoiceChannel, activeRoom?.id]);

  // Update WebRTC voice manager when local mute or audio controls change
  useEffect(() => {
    if (webrtcVoiceRef.current) {
      webrtcVoiceRef.current.setMuted(isMuted);
    }
  }, [isMuted]);

  useEffect(() => {
    if (webrtcVoiceRef.current) {
      const mutedUsersList = Array.isArray(mutedUsers)
        ? mutedUsers
        : Object.keys(mutedUsers || {}).filter((k) => mutedUsers[k]);

      webrtcVoiceRef.current.updateAudioSettings(
        isDeafened,
        isMutedAll,
        globalVolume,
        mutedUsersList,
        userVolumes,
        inputVolume,
        selectedMicId
      );
    }
  }, [isDeafened, isMutedAll, globalVolume, inputVolume, mutedUsers, userVolumes, selectedMicId]);

  // Stripe & Subscription state
  const getApiUrl = (path: string): string => {
    const isTauri = typeof window !== "undefined" && (
      (window as any).__TAURI__ || 
      window.location.protocol === "tauri:" || 
      window.location.protocol === "asset:" ||
      window.location.hostname === "tauri.localhost" ||
      window.location.hostname === ""
    );

    if (isTauri) {
      const baseUrl = ((import.meta as any).env.VITE_API_URL || "https://ais-pre-xnvqqymkqsq3dfmi7u62th-361590815324.us-west2.run.app").replace(/\/$/, "");
      return `${baseUrl}${path}`;
    }
    return path;
  };

  const [stripeConfig, setStripeConfig] = useState<{ stripeConfigured: boolean; publishableKey: string }>({
    stripeConfigured: false,
    publishableKey: "",
  });

  useEffect(() => {
    fetch(getApiUrl("/api/payment/config"))
      .then((res) => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
      })
      .then((data) => setStripeConfig(data))
      .catch((err) => console.warn("Failed to load Stripe configuration info:", err));
  }, []);

  const subscriptionState = useMemo(() => {
    if (currentUser?.email?.toLowerCase() === "1nathandrew6@gmail.com") {
      return { isPremium: true, daysRemaining: 365, isExpired: false, status: "active" };
    }
    if (!profile) return { isPremium: true, daysRemaining: 30, isExpired: false, status: "none" };

    if (profile.subscriptionStatus === "active") {
      return { isPremium: true, daysRemaining: 0, isExpired: false, status: "active" };
    }

    const trialEnd = profile.trialEndDate ? new Date(profile.trialEndDate).getTime() : 0;
    const now = Date.now();
    const isExpired = now >= trialEnd;
    const daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));

    return {
      isPremium: !isExpired && profile.subscriptionStatus === "trialing",
      daysRemaining,
      isExpired,
      status: profile.subscriptionStatus || "none",
    };
  }, [profile, currentUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success") === "true";
    const sessionId = params.get("session_id");

    if (success && sessionId && currentUser) {
      triggerToast("Activating...", "Verifying your checkout session with Stripe...", "info");
      fetch(getApiUrl("/api/payment/verify-checkout-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId: currentUser.uid }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Verification failed");
          return res.json();
        })
        .then((data) => {
          if (data.success) {
            triggerToast("Subscription Activated", "Welcome to SyncPL Premium! Enjoy full workspace tools.", "success");
          } else {
            triggerToast("Activation Issue", "Subscription verification returned an unresolved status.", "info");
          }
        })
        .catch((err) => {
          console.error("Error verifying subscription session:", err);
          triggerToast("Activation Failed", "Could not verify subscription automatically. Please contact desk support.", "error");
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (success && !sessionId) {
      triggerToast("Subscription Activated", "Welcome to SyncPL Premium! Enjoy full workspace tools.", "success");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get("canceled") === "true") {
      triggerToast("Checkout Canceled", "Subscription setup was canceled. You remain on the Free Trial tier.", "info");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [currentUser]);

  // Navigation tab & Tickers
  const [activeTab, setActiveTab] = useState("dashboard");
  const [tickers, setTickers] = useState<TickerInfo[]>(initialTickers);

  // Modals status
  const [isJoinCreateOpen, setIsJoinCreateOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameNewName, setRenameNewName] = useState("");

  // Custom Confirmation Modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        try {
          await onConfirm();
        } catch (err) {
          console.error(err);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Responsive & Custom Channel Modals state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024;
    }
    return false;
  });
  const [isChatSidePanelOpen, setIsChatSidePanelOpen] = useState(true);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [createChannelType, setCreateChannelType] = useState<"text" | "voice">("text");
  const [createChannelName, setCreateChannelName] = useState("");

  // Log Trade Form input values
  const [logType, setLogType] = useState<"profit" | "loss">("profit");
  const [logAmount, setLogAmount] = useState("");
  const [logDate, setLogDate] = useState(() => getLocalDateString());
  const [logTime, setLogTime] = useState(() => getLocalTimeString());
  const [logAsset, setLogAsset] = useState("BTC");
  const [logStrategy, setLogStrategy] = useState("Breakout");
  const [logNotes, setLogNotes] = useState("");

  // Voice Customizer
  const [voiceName, setVoiceName] = useState("Kore");
  const [vocalPrompt, setVocalPrompt] = useState("Speak critically like a strict hedge fund risk analyst");

  // Join Room simple input inside Modal
  const [modalJoinCode, setModalJoinCode] = useState("");

  // Dynamic Toast alerts
  const [toast, setToast] = useState<{ title: string; body: string; type: "success" | "error" | "info" } | null>(null);

  // Show status toasts
  const triggerToast = (title: string, body: string, type: "success" | "error" | "info" = "info") => {
    setToast({ title, body, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };
    window.addEventListener("resize", handleResize);
    // Initial check on mount
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch actual real-time market quotes from Yahoo Finance (via multi-tier CORS proxies with local fallbacks)
  const fetchRealMarketData = async () => {
    const symbols = "BTC-USD,ETH-USD,^NDX,^GSPC,SPY,QQQ,EURUSD=X,GC=F";
    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;

    const symbolMap: { [key: string]: string } = {
      "BTC-USD": "BTC/USD",
      "ETH-USD": "ETH/USD",
      "^NDX": "NQ",
      "^GSPC": "SNP500",
      "SPY": "SPY",
      "QQQ": "QQQ",
      "EURUSD=X": "EUR/USD",
      "GC=F": "GOLD"
    };

    let success = false;
    let results: any[] = [];

    // Attempt 1: Direct Fetch (works beautifully inside Tauri apps which have zero CORS restrictions!)
    try {
      const res = await fetch(yahooUrl);
      if (res.ok) {
        const data = await res.json();
        if (data?.quoteResponse?.result) {
          results = data.quoteResponse.result;
          success = true;
        }
      }
    } catch (err) {
      // Expected to fail in web browsers due to CORS, but will succeed in Tauri!
    }

    // Attempt 2: corsproxy.io (primary high-speed raw CORS proxy)
    if (!success) {
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.quoteResponse?.result) {
            results = data.quoteResponse.result;
            success = true;
          }
        }
      } catch (err) {
        console.warn("corsproxy.io failed, trying allorigins fallback...");
      }
    }

    // Attempt 3: api.allorigins.win (highly resilient wrapped fallback CORS proxy)
    if (!success) {
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`);
        if (res.ok) {
          const wrapper = await res.json();
          if (wrapper?.contents) {
            const data = JSON.parse(wrapper.contents);
            if (data?.quoteResponse?.result) {
              results = data.quoteResponse.result;
              success = true;
            }
          }
        }
      } catch (err) {
        console.warn("allorigins proxy failed too:", err);
      }
    }

    // If Yahoo Finance succeeded, map and update all tickers
    if (success && results.length > 0) {
      setTickers((prev) =>
        prev.map((t) => {
          const match = results.find(
            (r) =>
              symbolMap[r.symbol] === t.symbol ||
              symbolMap[r.symbol.toUpperCase()] === t.symbol
          );
          if (match) {
            const rawPrice = match.regularMarketPrice;
            const changePercent = match.regularMarketChangePercent;
            if (rawPrice !== undefined && rawPrice !== null) {
              const decimalPlaces = t.symbol === "EUR/USD" ? 4 : 2;
              return {
                ...t,
                price: Number(Number(rawPrice).toFixed(decimalPlaces)),
                change: changePercent !== undefined && changePercent !== null ? Number(Number(changePercent).toFixed(2)) : t.change
              };
            }
          }
          return t;
        })
      );
    } else {
      // Last-resort fallback: fetch individual public CORS APIs (Coinbase and ExchangeRate) for core items
      try {
        const [btcRes, ethRes] = await Promise.all([
          fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot"),
          fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot"),
        ]);
        let btcPrice: number | null = null;
        let ethPrice: number | null = null;

        if (btcRes.ok) {
          const btcData = await btcRes.json();
          if (btcData?.data?.amount) {
            btcPrice = Number(parseFloat(btcData.data.amount).toFixed(2));
          }
        }
        if (ethRes.ok) {
          const ethData = await ethRes.json();
          if (ethData?.data?.amount) {
            ethPrice = Number(parseFloat(ethData.data.amount).toFixed(2));
          }
        }

        setTickers((prev) =>
          prev.map((t) => {
            if (t.symbol === "BTC/USD" && btcPrice) {
              return { ...t, price: btcPrice };
            }
            if (t.symbol === "ETH/USD" && ethPrice) {
              return { ...t, price: ethPrice };
            }
            return t;
          })
        );
      } catch (err) {
        console.warn("Coinbase backup failed:", err);
      }

      try {
        const fxRes = await fetch("https://open.er-api.com/v6/latest/USD");
        if (fxRes.ok) {
          const data = await fxRes.json();
          if (data?.rates?.EUR) {
            const eurUsdPrice = Number((1 / data.rates.EUR).toFixed(4));
            setTickers((prev) =>
              prev.map((t) => (t.symbol === "EUR/USD" ? { ...t, price: eurUsdPrice } : t))
            );
          }
        }
      } catch (err) {
        console.warn("Forex backup failed:", err);
      }
    }
  };

  // Live real market data sync and active high-frequency tape fluctuation simulation
  useEffect(() => {
    // Initial fetch of actual real market rates
    fetchRealMarketData();

    const isPremiumTier = profile?.subscriptionStatus === "active" || profile?.subscriptionStatus === "trialing" || profile?.subscriptionTier === "premium" || profile?.subscriptionTier === "pro" || profile?.subscriptionTier === "elite";

    // Dynamic speeds: Premium get 15s API polls (60s on mobile), Free get 30s API polls (90s on mobile)
    const apiSpeed = isPremiumTier 
      ? (isMobileOrTablet ? 60000 : 15000)
      : (isMobileOrTablet ? 90000 : 30000);

    // Dynamic tick simulation: Pro/Elite get 4s tape speed (12s on mobile), Free get 12s tape speed (36s on mobile)
    const tickSpeed = isPremiumTier
      ? (isMobileOrTablet ? 12000 : 4000)
      : (isMobileOrTablet ? 36000 : 12000);

    const apiInterval = setInterval(() => {
      fetchRealMarketData();
    }, apiSpeed);

    // Simulate micro tick changes on the UI to keep the tape moving
    const tickInterval = setInterval(() => {
      setTickers((prev) =>
        prev.map((t) => {
          const delta = (Math.random() - 0.495) * 0.08; // small change
          const decimals = t.symbol === "EUR/USD" ? 4 : 2;
          const newPrice = Number((t.price * (1 + delta / 100)).toFixed(decimals));
          const newChange = Number((t.change + delta).toFixed(2));
          return { ...t, price: newPrice, change: newChange };
        })
      );
    }, tickSpeed);

    return () => {
      clearInterval(apiInterval);
      clearInterval(tickInterval);
    };
  }, [profile?.subscriptionTier, profile?.subscriptionStatus, isMobileOrTablet]);

  // 1. Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await initUserProfileAndRoom(user);
      } else {
        setCurrentUser(null);
        setProfile(null);
        setRooms([]);
        setActiveRoom(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize Notification Permission
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // 2. Initialize profile and rooms from database
  const initUserProfileAndRoom = async (user: User) => {
    try {
      // 6-segments path compliance: users/{userId}/profile/info
      const profileRef = doc(db, "users", user.uid, "profile", "info");
      const snap = await getDoc(profileRef);

      let currentProfile: UserProfile;

      if (snap.exists()) {
        currentProfile = snap.data() as UserProfile;
        let needsUpdate = false;
        if (!currentProfile.createdAt) {
          currentProfile.createdAt = new Date().toISOString();
          needsUpdate = true;
        }
        if (!currentProfile.trialEndDate) {
          const createdTime = currentProfile.createdAt ? new Date(currentProfile.createdAt).getTime() : Date.now();
          currentProfile.trialEndDate = new Date(createdTime + 3 * 24 * 60 * 60 * 1000).toISOString();
          needsUpdate = true;
        }
        if (user.email?.toLowerCase() === "1nathandrew6@gmail.com") {
          if (currentProfile.subscriptionStatus !== "active" || currentProfile.subscriptionTier !== "premium") {
            currentProfile.subscriptionStatus = "active";
            currentProfile.subscriptionTier = "premium";
            needsUpdate = true;
          }
        } else if (!currentProfile.subscriptionStatus) {
          currentProfile.subscriptionStatus = "trialing";
          needsUpdate = true;
        }
        if (needsUpdate) {
          await setDoc(profileRef, currentProfile, { merge: true });
        }
      } else {
        // Create initial default profile
        const randomName = `Trader_${user.uid.substring(0, 5)}`;
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const isCreator = user.email?.toLowerCase() === "1nathandrew6@gmail.com";
        currentProfile = {
          username: randomName,
          avatarColor: "indigo",
          avatarType: "emoji",
          avatarVal: "🐂",
          groupIds: [],
          activeGroupId: "",
          createdAt: now.toISOString(),
          trialEndDate: trialEnd.toISOString(),
          subscriptionStatus: isCreator ? "active" : "trialing",
          subscriptionTier: isCreator ? "premium" : "free",
        };
        await setDoc(profileRef, currentProfile);
      }

      setProfile(currentProfile);

      // Setup list of room items dynamically from groupIds
      if (currentProfile.groupIds && currentProfile.groupIds.length > 0) {
        await fetchJoinedRooms(currentProfile.groupIds, currentProfile.activeGroupId);
      } else {
        setRooms([]);
        setActiveRoom(null);
      }
    } catch (e: any) {
      console.error("Failed to load user credentials profile:", e);
      if (e.code === "permission-denied" || e.message?.toLowerCase().includes("permission")) {
        setFirebaseError("Firestore permission denied. Your custom Firestore database's security rules are blocking access.");
      }
    }
  };

  // Real-time observer on user profile so multi-device actions are synchronized immediately
  useEffect(() => {
    if (!currentUser) return;
    const profileRef = doc(db, "users", currentUser.uid, "profile", "info");
    const unsubscribe = onSnapshot(profileRef, async (snap) => {
      if (snap.exists()) {
        let updatedProfile = snap.data() as UserProfile;
        if (currentUser.email?.toLowerCase() === "1nathandrew6@gmail.com") {
          updatedProfile = {
            ...updatedProfile,
            subscriptionStatus: "active",
            subscriptionTier: "premium"
          };
        }
        setProfile(updatedProfile);
        if (updatedProfile.groupIds) {
          await fetchJoinedRooms(updatedProfile.groupIds, updatedProfile.activeGroupId);
        }
      }
    }, (error) => {
      console.error("Profile onSnapshot error:", error);
      if (error.code === "permission-denied") {
        setFirebaseError("Firestore permission denied. Your custom Firestore database's security rules are blocking access.");
      }
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Sync public user profile to users collection whenever local profile updates
  useEffect(() => {
    if (!currentUser || !profile) return;
    const syncPublicUserDoc = async () => {
      try {
        const publicRef = doc(db, "users", currentUser.uid);
        await setDoc(publicRef, {
          uid: currentUser.uid,
          username: profile.username || "Trader",
          avatarColor: profile.avatarColor || "indigo",
          avatarType: profile.avatarType || "emoji",
          avatarVal: profile.avatarVal || "🐂",
          subscriptionTier: (profile.subscriptionStatus === "active" || profile.subscriptionStatus === "trialing" || profile.subscriptionTier === "premium") ? "premium" : "free",
          activeGroupId: profile.activeGroupId || "",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to sync public user doc in App.tsx:", err);
      }
    };
    syncPublicUserDoc();
  }, [currentUser?.uid, profile]);

  const fetchJoinedRooms = async (groupIds: string[], activeGroupId: string) => {
    try {
      const roomPromises = groupIds.map(async (gid) => {
        const roomRef = doc(db, "rooms", gid);
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
          return { id: gid, ...snap.data() } as Room;
        } else {
          // Auto create missing rooms so data stays robust
          const newRoom: Room = {
            id: gid,
            creatorId: currentUser?.uid || "admin",
            creatorName: profile?.username || "Trader",
            moderators: [],
            createdAt: new Date().toISOString(),
          };
          await setDoc(roomRef, newRoom);
          return newRoom;
        }
      });
      const roomList = await Promise.all(roomPromises);
      setRooms(roomList);

      const active = roomList.find((r) => r.id === activeGroupId) || roomList[0] || null;
      setActiveRoom(active);
    } catch (e: any) {
      console.error("Failed to fetch joined workspace rooms:", e);
      if (e.code === "permission-denied" || e.message?.toLowerCase().includes("permission")) {
        setFirebaseError("Firestore permission denied. Your custom Firestore database's security rules are blocking access.");
      }
    }
  };

  // Listeners for active room data
  useEffect(() => {
    if (!currentUser || !activeRoom) {
      setChannels([]);
      setChatMessages([]);
      setVoiceUsers([]);
      setPnlLogs([]);
      setLiveTrades([]);
      setTradingRules([]);
      setTraders([]);
      return;
    }

    const unsubscribers: (() => void)[] = [];

    // Observe channels
    const channelsQuery = query(collection(db, "channels"), where("groupId", "==", activeRoom.id));
    const unsubChannels = onSnapshot(channelsQuery, async (snapshot) => {
      const list: Channel[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, ...data } as Channel);
      });
      const sorted = list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setChannels(sorted);

      // If no channels exist inside room, creator should initialize standard default channels
      if (sorted.length === 0) {
        await initDefaultChannels(activeRoom.id);
      } else {
        // Auto default to first text channel if current active one is deleted/empty
        const currentActiveExists = sorted.some((c) => c.name === activeChannelName && c.type === "text");
        if (!currentActiveExists) {
          const firstText = sorted.find((c) => c.type === "text");
          if (firstText) setActiveChannelName(firstText.name);
        }
      }
    }, (error) => {
      console.error("Channels onSnapshot error:", error);
      if (error.code === "permission-denied") {
        setFirebaseError("Firestore permission denied. Your custom Firestore database's security rules are blocking access.");
      }
    });
    unsubscribers.push(unsubChannels);

    // Observe chat messages
    const chatQuery = query(collection(db, "chat_messages"), where("groupId", "==", activeRoom.id));
    const unsubChat = onSnapshot(chatQuery, (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, ...data } as ChatMessage);
      });

      // Browser Push Notifications on newly broadcasted trade logs or settlements
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msg = change.doc.data();
          if (msg.timestamp && new Date(msg.timestamp).getTime() > Date.now() - 15000) {
            const text = msg.text || "";
            const isTradeLog =
              msg.isEmbed === true ||
              msg.channel === "pnl-flex" ||
              text.includes("logged a verified trade") ||
              text.includes("🏁 POSITION CLOSED") ||
              text.includes("🚨 LIVE POSITION DEPLOYED");

            if (isTradeLog) {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Desk Trade Alert", {
                  body: text || `${msg.username || "Trader"} posted a trade update.`,
                  icon: "/app_icon.png"
                });
              }
            }
          }
        }
      });

      const sorted = list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setChatMessages(sorted);
    }, (error) => {
      console.error("Chat onSnapshot error:", error);
      if (error.code === "permission-denied") {
        setFirebaseError("Firestore permission denied. Your custom Firestore database's security rules are blocking access.");
      }
    });
    unsubscribers.push(unsubChat);

    // Observe voice users
    const voiceQuery = query(collection(db, "voice_users"), where("groupId", "==", activeRoom.id));
    const unsubVoice = onSnapshot(voiceQuery, (snapshot) => {
      const list: VoiceUser[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, ...data } as VoiceUser);
      });
      setVoiceUsers(list);
    }, (error) => {
      console.error("Voice onSnapshot error:", error);
      if (error.code === "permission-denied") {
        setFirebaseError("Firestore permission denied. Your custom Firestore database's security rules are blocking access.");
      }
    });
    unsubscribers.push(unsubVoice);

    // Observe all users to get their dynamic market presence, custom status, and avatars
    const usersQuery = collection(db, "users");
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setPublicUsers(list);
    }, (error) => {
      console.error("Users onSnapshot error:", error);
    });
    unsubscribers.push(unsubUsers);

    // Observe PNL logs (excluding live trades)
    const logsQuery = query(collection(db, "pnl_logs"), where("groupId", "==", activeRoom.id));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const list: PnlLog[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (!data.isLive) {
          list.push({ id: d.id, ...data } as PnlLog);
        }
      });
      const sorted = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPnlLogs(sorted);
    }, (error) => {
      console.error("Logs onSnapshot error:", error);
      if (error.code === "permission-denied") {
        setFirebaseError("Firestore permission denied. Your custom Firestore database's security rules are blocking access.");
      }
    });
    unsubscribers.push(unsubLogs);

    // Observe Live Trades (from pnl_logs where isLive === true)
    const unsubLiveTrades = onSnapshot(logsQuery, (snapshot) => {
      const list: LiveTrade[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.isLive === true) {
          list.push({ id: d.id, ...data } as any as LiveTrade);
        }
      });
      const sorted = list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLiveTrades(sorted);
    }, (error) => {
      console.error("Live trades onSnapshot error:", error);
    });
    unsubscribers.push(unsubLiveTrades);

    // Observe Trading Entry Checklist Rules
    const rulesQuery = query(collection(db, "trading_rules"), where("roomId", "==", activeRoom.id));
    const unsubRules = onSnapshot(rulesQuery, (snapshot) => {
      const list: TradingRule[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, ...data } as TradingRule);
      });
      const sorted = list.sort((a, b) => a.order - b.order);
      setTradingRules(sorted);
    }, (error) => {
      console.error("Rules onSnapshot error:", error);
    });
    unsubscribers.push(unsubRules);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [currentUser?.uid, activeRoom?.id, pnlLogs.length]);

  // Dynamically derive room traders with live presence, status, and custom settings
  useEffect(() => {
    if (!activeRoom) return;

    const derivedTraders: UserProfile[] = [];
    const addedUsernames = new Set<string>();

    // 1. Current user
    const myUsername = profile?.username || "Me";
    const myPublicInfo = publicUsers.find(u => u.uid === currentUser?.uid);
    derivedTraders.push({
      username: myUsername,
      avatarColor: profile?.avatarColor || "indigo",
      avatarType: profile?.avatarType || "emoji",
      avatarVal: profile?.avatarVal || "🐂",
      groupIds: profile?.groupIds || [],
      activeGroupId: activeRoom.id,
      marketPresence: myPublicInfo?.marketPresence || "active",
      customStatus: myPublicInfo?.customStatus || "",
    } as any);
    addedUsernames.add(myUsername.toLowerCase());

    // 2. Other users in the same active room (from Firestore users list)
    publicUsers.forEach((user) => {
      if (user.activeGroupId === activeRoom.id) {
        const lowerName = (user.username || "").toLowerCase();
        if (lowerName && !addedUsernames.has(lowerName)) {
          derivedTraders.push({
            username: user.username,
            avatarColor: user.avatarColor || "indigo",
            avatarType: user.avatarType || "emoji",
            avatarVal: user.avatarVal || "🐂",
            groupIds: user.groupIds || [activeRoom.id],
            activeGroupId: activeRoom.id,
            marketPresence: user.marketPresence || "active",
            customStatus: user.customStatus || "",
          } as any);
          addedUsernames.add(lowerName);
        }
      }
    });

    // 3. Plus any other traders who have logged trades in this room (even if currently in another room / offline)
    pnlLogs.forEach((log) => {
      const lowerName = (log.username || "").toLowerCase();
      if (lowerName && !addedUsernames.has(lowerName)) {
        const matchedUser = publicUsers.find(u => u.username?.toLowerCase() === lowerName);
        if (matchedUser) {
          derivedTraders.push({
            username: matchedUser.username || log.username,
            avatarColor: matchedUser.avatarColor || "pink",
            avatarType: matchedUser.avatarType || "emoji",
            avatarVal: matchedUser.avatarVal || "📈",
            groupIds: matchedUser.groupIds || [activeRoom.id],
            activeGroupId: matchedUser.activeGroupId || activeRoom.id,
            marketPresence: matchedUser.marketPresence || "offline",
            customStatus: matchedUser.customStatus || "",
          } as any);
        } else {
          derivedTraders.push({
            username: log.username,
            avatarColor: "pink",
            avatarType: "emoji",
            avatarVal: "📈",
            groupIds: [activeRoom.id],
            activeGroupId: activeRoom.id,
            marketPresence: "offline",
            customStatus: "",
          } as any);
        }
        addedUsernames.add(lowerName);
      }
    });

    setTraders(derivedTraders);
  }, [profile, pnlLogs, publicUsers, activeRoom, currentUser?.uid]);

  const initDefaultChannels = async (roomId: string) => {
    try {
      const channelsCol = collection(db, "channels");
      const defaults = [
        { name: "general-trading", type: "text", groupId: roomId, createdAt: new Date().toISOString() },
        { name: "pnl-flex", type: "text", groupId: roomId, createdAt: new Date().toISOString() },
        { name: "market-alpha", type: "text", groupId: roomId, createdAt: new Date().toISOString() },
        { name: "voice-general-chat", type: "text", groupId: roomId, createdAt: new Date().toISOString() },
        { name: "Voice Desk 1", type: "voice", groupId: roomId, createdAt: new Date().toISOString() },
        { name: "🤖 AI Risk Assistant", type: "voice", groupId: roomId, createdAt: new Date().toISOString() },
      ];
      for (const item of defaults) {
        await addDoc(channelsCol, item);
      }
    } catch (e) {
      console.error("Failed to seed default channels:", e);
    }
  };

  // Auth Operations
  const handleGuestAuth = async (name: string) => {
    try {
      const cred = await signInAnonymously(auth);
      const profileRef = doc(db, "users", cred.user.uid, "profile", "info");
      const defaultProfile: UserProfile = {
        username: name,
        avatarColor: "indigo",
        avatarType: "emoji",
        avatarVal: "🐂",
        groupIds: [],
        activeGroupId: "",
      };
      await setDoc(profileRef, defaultProfile);
      setProfile(defaultProfile);
      triggerToast("Welcome Guest!", `Logged in safely as ${name}.`, "success");
    } catch (e: any) {
      throw new Error(e.message || "Guest authentication gateway rejected.");
    }
  };

  const handleEmailLogin = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      triggerToast("Logged In", "Synchronized secure profiles successfully.", "success");
    } catch (e: any) {
      throw new Error(e.message || "Credentials incorrect or user not found.");
    }
  };

  const handlePasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      triggerToast("Reset Link Sent", "Check your inbox for password reset instructions.", "success");
    } catch (e: any) {
      throw new Error(e.message || "Failed to send password reset email.");
    }
  };

  const handleEmailRegister = async (name: string, email: string, pass: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const profileRef = doc(db, "users", cred.user.uid, "profile", "info");
      const newProfile: UserProfile = {
        username: name,
        avatarColor: "indigo",
        avatarType: "emoji",
        avatarVal: "🐂",
        groupIds: [],
        activeGroupId: "",
      };
      await setDoc(profileRef, newProfile);
      setProfile(newProfile);
      triggerToast("Account Created", "Institutional profile saved.", "success");
    } catch (e: any) {
      throw new Error(e.message || "Failed to register profile credentials.");
    }
  };

  const handleLogout = async () => {
    if (activeVoiceChannel) {
      await handleDisconnectVoice();
    }
    await signOut(auth);
    triggerToast("Signed Out", "Disconnected active sync nodes.", "info");
  };

  // Multi-Room Switching & Admin triggers
  const handleSelectRoom = async (roomId: string) => {
    if (roomId === activeRoom?.id) return;
    if (activeVoiceChannel) {
      await handleDisconnectVoice();
    }
    // Update activeGroupId in Firestore profile so all connected client tabs match immediately!
    if (currentUser) {
      const profileRef = doc(db, "users", currentUser.uid, "profile", "info");
      await updateDoc(profileRef, { activeGroupId: roomId });
    }
    triggerToast("Room Switched", `Entered contract workspace: ${roomId}`, "success");
  };

  const handleLeaveRoom = async (roomId: string) => {
    if (!currentUser || !profile) return;
    
    triggerConfirm(
      "Exit Room Workspace",
      `Are you sure you want to exit Room ${roomId}?`,
      async () => {
        if (activeVoiceChannel && activeRoom?.id === roomId) {
          await handleDisconnectVoice();
        }

        const updatedGroupIds = profile.groupIds.filter((g) => g !== roomId);
        let nextActive = profile.activeGroupId;
        if (profile.activeGroupId === roomId) {
          nextActive = updatedGroupIds[0] || "";
        }

        const profileRef = doc(db, "users", currentUser.uid, "profile", "info");
        await updateDoc(profileRef, {
          groupIds: updatedGroupIds,
          activeGroupId: nextActive,
        });

        triggerToast("Room Exited", `Safely left Room: ${roomId}`, "info");
      }
    );
  };

  const handleJoinRoom = async (code: string) => {
    if (!currentUser || !profile) return;
    const normalized = code.trim().toUpperCase();

    // Check if room meta document exists
    const roomRef = doc(db, "rooms", normalized);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
      // Create room document dynamically
      await setDoc(roomRef, {
        creatorId: currentUser.uid,
        creatorName: profile.username,
        moderators: [],
        createdAt: new Date().toISOString(),
      });
    }

    const updatedGroupIds = [...profile.groupIds];
    if (!updatedGroupIds.includes(normalized)) {
      updatedGroupIds.push(normalized);
    }

    const profileRef = doc(db, "users", currentUser.uid, "profile", "info");
    await updateDoc(profileRef, {
      groupIds: updatedGroupIds,
      activeGroupId: normalized,
    });

    setIsJoinCreateOpen(false);
    triggerToast("Room Connected", `Synchronized room node: ${normalized}`, "success");
  };

  const handleCreateRoom = async () => {
    if (!currentUser || !profile) return;

    // Enforce subscription limits
    const currentRoomCount = profile.groupIds?.length || 0;
    if (!subscriptionState.isPremium && currentRoomCount >= 1) {
      triggerToast("Limit Reached", "Standard Free members are limited to 1 Workspace Desk. Start your 3-day Free Trial to unlock unlimited desks!", "info");
      return;
    }

    const newCode = generateRandomRoomCode();

    const roomRef = doc(db, "rooms", newCode);
    await setDoc(roomRef, {
      creatorId: currentUser.uid,
      creatorName: profile.username,
      moderators: [],
      createdAt: new Date().toISOString(),
      isPaid: false,
      monthlyPrice: 14.99,
      subscribers: []
    });

    const updatedGroupIds = [...profile.groupIds, newCode];
    const profileRef = doc(db, "users", currentUser.uid, "profile", "info");
    await updateDoc(profileRef, {
      groupIds: updatedGroupIds,
      activeGroupId: newCode,
    });

    setIsJoinCreateOpen(false);
    triggerToast("Room Established", `Share invite code: ${newCode} with friends!`, "success");
  };

  // Channels Operations
  const handleOpenCreateChannelModal = (type: "text" | "voice") => {
    setCreateChannelType(type);
    setCreateChannelName("");
    setIsCreateChannelOpen(true);
  };

  const handleConfirmCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createChannelName.trim()) return;
    let formatted = createChannelName.trim();
    if (createChannelType === "text") {
      formatted = formatted.toLowerCase().replace(/\s+/g, "-");
    }
    await handleAddChannel(formatted, createChannelType);
    setIsCreateChannelOpen(false);
  };

  const handleAddChannel = async (name: string, type: "text" | "voice") => {
    if (!activeRoom) return;
    const channelsCol = collection(db, "channels");
    await addDoc(channelsCol, {
      name,
      type,
      groupId: activeRoom.id,
      createdAt: new Date().toISOString(),
    });
    triggerToast("Channel Created", `Node #${name} is now online.`, "success");
  };

  const handleDeleteChannel = async (id: string, name: string) => {
    triggerConfirm(
      "Delete Channel",
      `Permanently delete channel #${name}?`,
      async () => {
        if (activeVoiceChannel === name) {
          await handleDisconnectVoice();
        }

        const docRef = doc(db, "channels", id);
        await deleteDoc(docRef);
        triggerToast("Channel Deleted", `Node #${name} closed.`, "info");
      }
    );
  };

  const handleRenameChannelTrigger = (id: string, name: string) => {
    setRenameTarget({ id, name });
    setRenameNewName(name);
    setIsRenameOpen(true);
  };

  const handleSaveRename = async () => {
    if (!renameTarget || !renameNewName.trim()) return;
    const formatted = renameNewName.trim().toLowerCase().replace(/\s+/g, "-");

    const docRef = doc(db, "channels", renameTarget.id);
    await updateDoc(docRef, { name: formatted });

    if (activeChannelName === renameTarget.name) {
      setActiveChannelName(formatted);
    }

    setIsRenameOpen(false);
    setRenameTarget(null);
    triggerToast("Channel Renamed", `Updated to #${formatted}`, "success");
  };

  const handleSetChannelPin = async (id: string, pin: string) => {
    try {
      const docRef = doc(db, "channels", id);
      await updateDoc(docRef, { pin: pin || "" });
      triggerToast(
        pin ? "Room Locked" : "Room Unlocked",
        pin ? `PIN code set successfully.` : `PIN requirement removed successfully.`,
        "success"
      );
    } catch (err: any) {
      console.error(err);
      triggerToast("Error", "Failed to update Room PIN: " + err.message, "error");
    }
  };

  const handleSelectChannelWithLockCheck = (name: string, type: "text" | "voice", isMobile: boolean) => {
    const channelObj = channels.find(c => c.name === name && c.type === type);
    if (channelObj && channelObj.pin && !isCreatorOrMod && !unlockedChannelIds[channelObj.id]) {
      setPendingChannelToUnlock(channelObj);
      setEnteredPin("");
      setPinError("");
      return;
    }

    setActiveChannelName(name);
    if (isMobile) {
      setActiveTab("chat");
      setIsMobileSidebarOpen(false);
    } else {
      setIsChatSidePanelOpen(true);
    }
  };

  const handleToggleVoiceRoomWithLockCheck = (roomName: string) => {
    const channelObj = channels.find(c => c.name === roomName && c.type === "voice");
    if (channelObj && channelObj.pin && !isCreatorOrMod && !unlockedChannelIds[channelObj.id]) {
      setPendingChannelToUnlock(channelObj);
      setEnteredPin("");
      setPinError("");
      return;
    }

    handleToggleVoiceRoom(roomName);
  };

  const handleVerifyChannelPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingChannelToUnlock) return;
    
    if (enteredPin.trim() === pendingChannelToUnlock.pin) {
      const updatedUnlocked = { ...unlockedChannelIds, [pendingChannelToUnlock.id]: true };
      setUnlockedChannelIds(updatedUnlocked);
      try {
        localStorage.setItem("unlocked_channels", JSON.stringify(updatedUnlocked));
      } catch (err) {
        console.warn(err);
      }

      if (pendingChannelToUnlock.type === "text") {
        setActiveChannelName(pendingChannelToUnlock.name);
        setIsChatSidePanelOpen(true);
        setActiveTab("chat");
        setIsMobileSidebarOpen(false);
      } else {
        handleToggleVoiceRoom(pendingChannelToUnlock.name);
      }

      setPendingChannelToUnlock(null);
      setEnteredPin("");
      setPinError("");
      triggerToast("Room Unlocked", `Successfully entered #${pendingChannelToUnlock.name}`, "success");
    } else {
      setPinError("Incorrect PIN code. Access Denied.");
    }
  };

  // Stripe & Billing actions
  const handleSubscribe = async () => {
    if (!currentUser) return;
    try {
      const response = await fetch(getApiUrl("/api/payment/create-checkout-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.uid, userEmail: currentUser.email }),
      });
      const data = await response.json();
      if (data.url) {
        // Stripe Checkout pages prevent loading inside an iframe due to security headers.
        // We open the checkout page in a new tab instead.
        window.open(data.url, "_blank");
        triggerToast("Checkout Redirect", "Opening Stripe Checkout in a new window. Check your pop-up blocker if it doesn't open.", "success");
      } else {
        throw new Error(data.error || "Failed to start checkout session.");
      }
    } catch (err: any) {
      console.error(err);
      triggerToast("Checkout Failed", err.message || "Ensure your backend is running and configured.", "error");
    }
  };

  const handleManageBilling = async () => {
    if (!stripeConfig.stripeConfigured) {
      triggerToast("Billing Error", "Stripe configuration is missing on the server.", "error");
      return;
    }
    if (!profile?.stripeCustomerId) {
      triggerToast("No Active Plan", "We couldn't locate an active Stripe Customer ID for your account. Please complete checkout first.", "info");
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/payment/portal-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          stripeCustomerId: profile?.stripeCustomerId || "", 
          userId: currentUser?.uid, 
          userEmail: currentUser?.email 
        }),
      });
      const data = await response.json();
      if (data.url) {
        // Stripe Customer Portal pages prevent loading inside an iframe due to security headers.
        // We open the billing portal in a new tab instead.
        window.open(data.url, "_blank");
        triggerToast("Billing Redirect", "Opening billing portal in a new window. Check your pop-up blocker if it doesn't open.", "success");
      } else {
        throw new Error(data.error || "Failed to launch billing portal.");
      }
    } catch (err: any) {
      console.error(err);
      triggerToast("Portal Failed", err.message || "Failed to load billing portal.", "error");
    }
  };

  // State and Handlers for Workspace Paywalls
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState("");
  const [selectedPaywallChannel, setSelectedPaywallChannel] = useState<"sandbox" | "paypal" | "venmo" | "cashapp" | "stripe" | "custom">("sandbox");
  const [p2pPaymentProof, setP2pPaymentProof] = useState("");

  const isRoomLocked = useMemo(() => {
    return false;
  }, []);

  const handleUpdateSubscriptionTier = async (tier: "free" | "pro" | "elite") => {
    if (!currentUser) return;
    try {
      const profileRef = doc(db, "users", currentUser.uid, "profile", "info");
      await updateDoc(profileRef, {
        subscriptionTier: tier
      });
      triggerToast("Subscription Updated", `Successfully switched to ${tier.toUpperCase()} Plan!`, "success");
    } catch (err: any) {
      console.error(err);
      triggerToast("Upgrade Failed", err.message, "error");
    }
  };

  const handleUpdateRoomMonetization = async (
    isPaid: boolean,
    price: number,
    paypalLink?: string,
    venmoUsername?: string,
    cashappTag?: string,
    stripePaymentLink?: string,
    customPaymentInstructions?: string
  ) => {
    if (!currentUser || !activeRoom) return;
    try {
      const roomRef = doc(db, "rooms", activeRoom.id);
      await updateDoc(roomRef, {
        isPaid,
        monthlyPrice: price,
        paypalLink: paypalLink || "",
        venmoUsername: venmoUsername || "",
        cashappTag: cashappTag || "",
        stripePaymentLink: stripePaymentLink || "",
        customPaymentInstructions: customPaymentInstructions || ""
      });
      triggerToast("Workspace Monetized", `Room settings published: ${isPaid ? "Paid ($" + price.toFixed(2) + "/mo)" : "Free"}`, "success");
    } catch (err: any) {
      console.error(err);
      triggerToast("Update Failed", err.message, "error");
    }
  };

  const handleUpdateStripeConnect = async (linked: boolean, accountId?: string) => {
    if (!currentUser) return;
    try {
      const profileRef = doc(db, "users", currentUser.uid, "profile", "info");
      await updateDoc(profileRef, {
        stripeConnectLinked: linked,
        stripeConnectAccountId: accountId || ""
      });
      triggerToast("Stripe Connect Linked", linked ? "Verified payout wallet successfully linked." : "Payout wallet disconnected.", "success");
    } catch (err: any) {
      console.error(err);
      triggerToast("Sync Failed", err.message, "error");
    }
  };

  const handleUpdateDiscordWebhook = async (url: string) => {
    if (!currentUser) return;
    try {
      const profileRef = doc(db, "users", currentUser.uid, "profile", "info");
      await updateDoc(profileRef, {
        discordWebhookUrl: url
      });
      triggerToast("Discord Webhook Synchronized", "Your Discord webhook alerts have been saved.", "success");
    } catch (err: any) {
      console.error(err);
      triggerToast("Webhook Save Failed", err.message, "error");
    }
  };

  const handleSubscribeToRoom = async () => {
    if (!currentUser || !activeRoom) return;
    setIsSubmittingPayment(true);
    
    if (selectedPaywallChannel !== "sandbox") {
      setPaymentStep(`Authenticating direct ${selectedPaywallChannel.toUpperCase()} payment receipt...`);
      await new Promise(r => setTimeout(r, 1000));
      setPaymentStep(`Submitting proof: "${p2pPaymentProof || "Direct Access"}" to creator...`);
      await new Promise(r => setTimeout(r, 1000));
      setPaymentStep("Granting instant member access to desk...");
      await new Promise(r => setTimeout(r, 800));
    } else {
      setPaymentStep("Securing Stripe checkout tunnel...");
      await new Promise(r => setTimeout(r, 800));
      setPaymentStep("Processing sandboxed test payment token...");
      await new Promise(r => setTimeout(r, 800));
      setPaymentStep("Publishing member credentials to registry...");
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      const roomRef = doc(db, "rooms", activeRoom.id);
      const currentSubscribers = activeRoom.subscribers || [];
      const updatedSubscribers = [...currentSubscribers, currentUser.uid];
      
      // Update room subscribers in Firestore
      await updateDoc(roomRef, {
        subscribers: updatedSubscribers
      });

      // Update Creator's MRR profile in Firestore
      const creatorProfileRef = doc(db, "users", activeRoom.creatorId, "profile", "info");
      const creatorSnap = await getDoc(creatorProfileRef);
      if (creatorSnap.exists()) {
        const creatorData = creatorSnap.data();
        const currentMRR = creatorData.earningsMRR || 0;
        await updateDoc(creatorProfileRef, {
          earningsMRR: currentMRR + (activeRoom.monthlyPrice || 14.99)
        });
      }

      // Add a message in the chat room to notify about the new premium subscriber!
      try {
        const messageId = "notif_" + Date.now();
        const msgRef = doc(db, "rooms", activeRoom.id, "messages", messageId);
        await setDoc(msgRef, {
          id: messageId,
          userId: "system",
          username: "DESK LEDGER",
          avatarColor: "amber",
          avatarType: "emoji",
          avatarVal: "👑",
          groupId: activeRoom.id,
          text: `👑 @${profile?.username || "A new member"} just subscribed via ${selectedPaywallChannel.toUpperCase()} and joined the trading desk!`,
          channel: "general",
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Could not log join message", err);
      }

      triggerToast("Access Granted", `Successfully joined premium desk ${activeRoom.id}!`, "success");
      setP2pPaymentProof("");
      setSelectedPaywallChannel("sandbox");
    } catch (e: any) {
      console.error(e);
      triggerToast("Payment Failed", e.message, "error");
    } finally {
      setIsSubmittingPayment(false);
      setPaymentStep("");
    }
  };

  // Profile configuration updates
  const handleUpdateProfile = async (
    newName: string,
    color: "indigo" | "pink" | "emerald" | "amber" | "sky",
    type: "emoji" | "url",
    val: string
  ) => {
    if (!currentUser) return;
    const profileRef = doc(db, "users", currentUser.uid, "profile", "info");
    await updateDoc(profileRef, {
      username: newName,
      avatarColor: color,
      avatarType: type,
      avatarVal: val,
    });
    triggerToast("Profile Updated", `Your nickname is now ${newName}.`, "success");
  };

  // Log Trade Transaction submission
  const handleLogTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeRoom) return;

    if (subscriptionState.isExpired) {
      triggerToast("Premium Required", "Your free trial period has ended. Please subscribe to continue logging trades.", "error");
      setIsLogModalOpen(false);
      return;
    }

    const parsedAmount = Math.abs(parseFloat(logAmount));
    if (isNaN(parsedAmount)) return;

    const finalAmount = logType === "profit" ? parsedAmount : -parsedAmount;

    const logPayload = {
      userId: currentUser.uid,
      username: profile?.username || "Trader",
      groupId: activeRoom.id,
      amount: finalAmount,
      date: logDate,
      time: logTime,
      strategy: logStrategy,
      asset: logAsset.toUpperCase(),
      notes: logNotes,
      win: logType === "profit",
      timestamp: new Date().toISOString(),
    };

    try {
      // Add P&L transaction
      const logsCol = collection(db, "pnl_logs");
      await addDoc(logsCol, logPayload);

      // Add special Shared Ledger embed inside active chat message node
      const chatCol = collection(db, "chat_messages");
      await addDoc(chatCol, {
        ...logPayload,
        channel: "pnl-flex",
        isEmbed: true,
        text: `${profile?.username || "Trader"} logged a verified trade ledger entry.`,
      });

      // Close Log Modal
      setIsLogModalOpen(false);
      setLogAmount("");
      setLogNotes("");

      triggerToast("Trade Synchronized", "Record added and broadcast to chat ledger!", "success");

      // Trigger Voice Co-Pilot synthesis alert!
      const quoteText = `${profile?.username || "Trader"} logged a verified trade! Resulting in ${formatCurrency(
        finalAmount
      )} profit on ${logAsset.toUpperCase()} using ${logStrategy} strategy.`;
      speakTts(quoteText, currentUser?.uid);
    } catch (err) {
      console.error(err);
      triggerToast("Sync Failed", "Check database synchronization connection.", "error");
    }
  };

  const handleDeleteTradeLog = async (id: string, asset: string, amount: number) => {
    const docPath = `pnl_logs/${id}`;
    triggerConfirm(
      "Remove Trade Log Entry",
      `Permanently remove trade log entry of ${formatCurrency(amount)} on ${asset}?`,
      async () => {
        try {
          const docRef = doc(db, "pnl_logs", id);
          await deleteDoc(docRef);
          triggerToast("Log Removed", "Transaction safely deleted from database.", "info");
        } catch (err: any) {
          console.error("Error deleting ledger entry:", err);
          triggerToast("Delete Failed", `Could not delete log: ${err.message || err}`, "error");
          handleFirestoreError(err, OperationType.DELETE, docPath);
        }
      }
    );
  };

  // Checklist Rule Actions
  const handleAddRule = async (text: string) => {
    if (!activeRoom) return;

    if (subscriptionState.isExpired) {
      triggerToast("Premium Required", "Your free trial period has ended. Please subscribe to continue editing your checklist.", "error");
      return;
    }

    const trimmed = text.trim();
    const isDuplicate = tradingRules.some(r => r.text.trim().toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      triggerToast("Duplicate Rule Blocked", "This rule protocol already exists in your checklist.", "error");
      return;
    }
    try {
      const rulesCol = collection(db, "trading_rules");
      const nextOrder = tradingRules.length > 0 ? Math.max(...tradingRules.map(r => r.order)) + 1 : 0;
      await addDoc(rulesCol, {
        roomId: activeRoom.id,
        text: trimmed,
        order: nextOrder,
        createdAt: new Date().toISOString()
      });
      triggerToast("Rule Protocol Added", "The new protocol requirement is now active.", "success");
    } catch (err: any) {
      console.error("Failed to add rule:", err);
      triggerToast("Failed to Add Rule", err.message || "Error communicating with database.", "error");
    }
  };

  const handleUpdateRule = async (id: string, text: string) => {
    const trimmed = text.trim();
    const isDuplicate = tradingRules.some(r => r.id !== id && r.text.trim().toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      triggerToast("Duplicate Rule Blocked", "Another rule with this identical text already exists.", "error");
      return;
    }
    try {
      const ruleRef = doc(db, "trading_rules", id);
      await updateDoc(ruleRef, { text: trimmed });
      triggerToast("Rule Protocol Updated", "The protocol text has been saved.", "success");
    } catch (err: any) {
      console.error("Failed to update rule:", err);
      triggerToast("Update Failed", err.message || "Could not save changes.", "error");
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const ruleRef = doc(db, "trading_rules", id);
      await deleteDoc(ruleRef);
      triggerToast("Rule Protocol Removed", "Protocol removed from the active checklist.", "info");
    } catch (err: any) {
      console.error("Failed to delete rule:", err);
      triggerToast("Delete Failed", err.message || "Could not remove rule.", "error");
    }
  };

  const handleSeedDefaultRules = async () => {
    if (!activeRoom) return;
    try {
      const rulesCol = collection(db, "trading_rules");
      const presets = [
        "Did I confirm the setup on the higher timeframe (trend alignment)?",
        "Is the risk-to-reward ratio at least 1:2 on this technical setup?",
        "Is my stop loss set at a clear technical support or resistance level?",
        "Am I trading within my defined maximum daily loss and risk limits?",
        "Am I emotionally calm, objective, and fully focused before opening this trade?"
      ];

      let addedCount = 0;
      const currentTexts = new Set(tradingRules.map(r => r.text.trim().toLowerCase()));

      for (let i = 0; i < presets.length; i++) {
        const presetText = presets[i];
        if (!currentTexts.has(presetText.trim().toLowerCase())) {
          const nextOrder = tradingRules.length > 0 ? Math.max(...tradingRules.map(r => r.order)) + 1 + addedCount : addedCount;
          await addDoc(rulesCol, {
            roomId: activeRoom.id,
            text: presetText,
            order: nextOrder,
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        triggerToast("Standard Protocols Seeded", `Successfully loaded ${addedCount} professional rules to your checklist.`, "success");
      } else {
        triggerToast("All Presets Present", "All default standard protocols are already on your checklist.", "info");
      }
    } catch (err: any) {
      console.error("Failed to seed default rules:", err);
      triggerToast("Seed Failed", err.message || "Could not load standard checklist.", "error");
    }
  };

  // Live Trades Handlers
  const handleAddLiveTrade = async (payload: {
    asset: string;
    direction: "long" | "short";
    entryPrice: number;
    tp: number;
    sl: number;
    quantity: number;
    notes: string;
  }) => {
    if (!currentUser || !activeRoom) return;

    if (subscriptionState.isExpired) {
      triggerToast("Premium Required", "Your free trial period has ended. Please subscribe to continue deploying positions.", "error");
      return;
    }

    const tradePayload = {
      userId: currentUser.uid,
      username: profile?.username || "Trader",
      groupId: activeRoom.id,
      asset: payload.asset,
      direction: payload.direction,
      entryPrice: payload.entryPrice,
      tp: payload.tp,
      sl: payload.sl,
      quantity: payload.quantity,
      currentPrice: payload.entryPrice,
      status: "open",
      outcome: "",
      notes: payload.notes,
      timestamp: new Date().toISOString(),
      isLive: true,
      amount: 0,
      date: getLocalDateString(),
      time: getLocalTimeString(),
      strategy: `${payload.direction.toUpperCase()} Live`,
      win: false
    };

    try {
      const tradesCol = collection(db, "pnl_logs");
      await addDoc(tradesCol, tradePayload);

      // Broadcast entry to active desk channel chat
      const chatCol = collection(db, "chat_messages");
      await addDoc(chatCol, {
        userId: "system",
        username: "Desk Alert",
        avatarColor: "indigo",
        avatarType: "emoji",
        avatarVal: "🤖",
        groupId: activeRoom.id,
        channel: activeChannelName,
        text: `🚨 LIVE POSITION DEPLOYED: ${profile?.username || "Trader"} opened a ${payload.direction.toUpperCase()} position on ${payload.asset.toUpperCase()} at ${payload.entryPrice.toLocaleString()}. Targets -> TP: ${payload.tp.toLocaleString()} | SL: ${payload.sl.toLocaleString()} (Size: x${payload.quantity})`,
        timestamp: new Date().toISOString(),
      });

      triggerToast("Position Deployed", `Active ${payload.direction} on ${payload.asset} synchronized.`, "success");
      speakTts(`${profile?.username || "Trader"} opened a live ${payload.direction} position on ${payload.asset}. Monitor targets closely.`, currentUser?.uid);
    } catch (err) {
      console.error(err);
      triggerToast("Execution Error", "Failed to deploy live trade.", "error");
    }
  };

  const handleCloseLiveTrade = async (id: string, outcome: "TP" | "SL" | "manual", finalPrice: number, profitAmount: number) => {
    if (!currentUser || !activeRoom) return;

    try {
      const tradeRef = doc(db, "pnl_logs", id);
      const tradeSnap = await getDoc(tradeRef);
      if (!tradeSnap.exists()) return;

      const tradeData = tradeSnap.data() as LiveTrade;

      // Update state in pnl_logs
      await updateDoc(tradeRef, {
        status: "closed",
        outcome: outcome,
        currentPrice: finalPrice,
        exitPrice: finalPrice,
        profitAmount: profitAmount,
        amount: profitAmount,
        win: profitAmount >= 0,
        strategy: `${tradeData.direction.toUpperCase()} Live (${outcome.toUpperCase()})`
      });

      // Synchronize back to the Main Ledger as a verified transaction!
      const logsCol = collection(db, "pnl_logs");
      await addDoc(logsCol, {
        userId: tradeData.userId,
        username: tradeData.username,
        groupId: activeRoom.id,
        amount: profitAmount,
        date: getLocalDateString(),
        time: getLocalTimeString(),
        strategy: `${tradeData.direction.toUpperCase()} Live (${outcome.toUpperCase()})`,
        asset: tradeData.asset,
        notes: `Automatically synchronized from real-time live position. Entry: ${tradeData.entryPrice} -> Exit: ${finalPrice}. ${tradeData.notes}`,
        win: profitAmount >= 0,
        timestamp: new Date().toISOString(),
        isLive: false
      });

      // Post broadcast to Chat
      const chatCol = collection(db, "chat_messages");
      const sign = profitAmount >= 0 ? "+" : "";
      await addDoc(chatCol, {
        userId: "system",
        username: "Desk Alert",
        avatarColor: "pink",
        avatarType: "emoji",
        avatarVal: "📊",
        groupId: activeRoom.id,
        channel: activeChannelName,
        text: `🏁 POSITION CLOSED [${outcome.toUpperCase()}]: ${tradeData.username}'s ${tradeData.direction.toUpperCase()} on ${tradeData.asset.toUpperCase()} closed at ${finalPrice.toLocaleString()} (Entry: ${tradeData.entryPrice.toLocaleString()}). Realized Profit: ${sign}${formatCurrency(profitAmount)}!`,
        timestamp: new Date().toISOString(),
      });

      triggerToast("Trade Settled", `Position successfully settled at ${finalPrice}.`, "success");
      speakTts(`${tradeData.username}'s position on ${tradeData.asset} settled via ${outcome === "manual" ? "market close" : outcome + " target"}. Net result: ${formatCurrency(profitAmount)}.`, tradeData.userId);
    } catch (err) {
      console.error(err);
      triggerToast("Settlement Failed", "Error closing active trade.", "error");
    }
  };

  const handleUpdateTradePrice = async (id: string, currentPrice: number) => {
    try {
      const tradeRef = doc(db, "pnl_logs", id);
      await updateDoc(tradeRef, { currentPrice });
    } catch (err) {
      console.error("Error updating price:", err);
    }
  };

  const handleDeleteLiveTrade = async (id: string) => {
    const docPath = `pnl_logs/${id}`;
    triggerConfirm(
      "Delete Live Trade Card",
      "Permanently delete this live trade tracking card?",
      async () => {
        try {
          const docRef = doc(db, "pnl_logs", id);
          await deleteDoc(docRef);
          triggerToast("Position Removed", "Live trade node deleted.", "info");
        } catch (err: any) {
          console.error("Error deleting live trade:", err);
          triggerToast("Delete Failed", `Could not delete live trade: ${err.message || err}`, "error");
          handleFirestoreError(err, OperationType.DELETE, docPath);
        }
      }
    );
  };

  // Automatically sync live trade prices with ticker updates and trigger TP/SL targets
  useEffect(() => {
    if (!currentUser) return;
    const activeOpen = liveTrades.filter((t) => t.status === "open" && t.userId === currentUser.uid);
    if (activeOpen.length === 0) return;

    const normalizeSymbol = (sym: string) => sym.toUpperCase().replace(/[^A-Z0-9]/g, "");

    activeOpen.forEach(async (t) => {
      const normAsset = normalizeSymbol(t.asset);
      const matchingTicker = tickers.find((tick) => normalizeSymbol(tick.symbol) === normAsset);
      if (!matchingTicker) return;

      const newPrice = matchingTicker.price;
      if (newPrice === t.currentPrice) return;

      let outcome: "TP" | "SL" | null = null;
      const qty = (t as any).quantity || 1;
      let finalProfit = 0;

      if (t.direction === "long") {
        if (newPrice >= t.tp) {
          outcome = "TP";
        } else if (newPrice <= t.sl) {
          outcome = "SL";
        }
      } else {
        if (newPrice <= t.tp) {
          outcome = "TP";
        } else if (newPrice >= t.sl) {
          outcome = "SL";
        }
      }

      if (outcome) {
        const exitPrice = outcome === "TP" ? t.tp : t.sl;
        const diff = t.direction === "long" ? exitPrice - t.entryPrice : t.entryPrice - exitPrice;
        finalProfit = diff * qty;
        await handleCloseLiveTrade(t.id, outcome, exitPrice, finalProfit);
      } else {
        await handleUpdateTradePrice(t.id, newPrice);
      }
    });
  }, [tickers, liveTrades, currentUser]);

  // Automated trigger to fluctuate prices slightly (+/- 0.2% random walk)
  const handleTriggerPriceFluctuation = async () => {
    const activeOpen = liveTrades.filter((t) => t.status === "open");
    if (activeOpen.length === 0) return;

    triggerToast("Updating Tickers", "Simulating high-frequency market feedback...", "info");

    for (const t of activeOpen) {
      const changePercent = (Math.random() * 0.8 - 0.4) / 100;
      const newPrice = Math.max(0.0001, t.currentPrice * (1 + changePercent));

      let outcome: "TP" | "SL" | null = null;
      const qty = (t as any).quantity || 1;
      let finalProfit = 0;

      if (t.direction === "long") {
        if (newPrice >= t.tp) {
          outcome = "TP";
        } else if (newPrice <= t.sl) {
          outcome = "SL";
        }
      } else {
        if (newPrice <= t.tp) {
          outcome = "TP";
        } else if (newPrice >= t.sl) {
          outcome = "SL";
        }
      }

      if (outcome) {
        const exitPrice = outcome === "TP" ? t.tp : t.sl;
        const diff = t.direction === "long" ? exitPrice - t.entryPrice : t.entryPrice - exitPrice;
        finalProfit = diff * qty;

        await handleCloseLiveTrade(t.id, outcome, exitPrice, finalProfit);
      } else {
        await handleUpdateTradePrice(t.id, parseFloat(newPrice.toFixed(2)));
      }
    }
  };

  // Voice Rooms Operations & Simulation
  const handleToggleVoiceRoom = async (roomName: string) => {
    if (activeVoiceChannel === roomName) {
      await handleDisconnectVoice();
      return;
    }

    if (activeVoiceChannel) {
      await handleDisconnectVoice();
    }

    setActiveVoiceChannel(roomName);
    triggerToast("Voice Connected", `Connected voice Desk: ${roomName}`, "success");

    const isAi = roomName.includes("🤖") || roomName.toLowerCase().includes("ai");
    if (isAi) {
      speakTts("Welcome. I am your co-pilot risk analyst. I am listening to live channel transactions.");
    } else if (currentUser) {
      const voiceDocRef = doc(db, "voice_users", currentUser.uid);
      await setDoc(voiceDocRef, {
        id: currentUser.uid,
        userId: currentUser.uid,
        username: profile?.username || "Trader",
        groupId: activeRoom?.id,
        channel: roomName,
        muted: isMuted,
        deafened: isDeafened,
        speaking: false,
        joinedAt: new Date().toISOString(),
        avatarType: profile?.avatarType || "emoji",
        avatarVal: profile?.avatarVal || "👤",
        avatarColor: profile?.avatarColor || "indigo",
      });
    }
  };

  const handleDisconnectVoice = async () => {
    if (!currentUser) return;
    try {
      const voiceDocRef = doc(db, "voice_users", currentUser.uid);
      await deleteDoc(voiceDocRef);
    } catch (e) {
      console.warn(e);
    }
    setActiveVoiceChannel(null);
    triggerToast("Voice Disconnected", "Voice channel lines safely closed.", "info");
  };

  const handleToggleMic = async () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (currentUser && activeVoiceChannel) {
      const voiceDocRef = doc(db, "voice_users", currentUser.uid);
      await updateDoc(voiceDocRef, { muted: nextMute });
    }
  };

  const handleToggleDeafen = async () => {
    const nextDeafen = !isDeafened;
    setIsDeafened(nextDeafen);
    if (currentUser && activeVoiceChannel) {
      const voiceDocRef = doc(db, "voice_users", currentUser.uid);
      await updateDoc(voiceDocRef, { deafened: nextDeafen });
    }
  };

  const handleToggleMuteAll = async () => {
    const nextMuteAll = !isMutedAll;
    setIsMutedAll(nextMuteAll);
    if (nextMuteAll) {
      triggerToast("Room Audio Muted", "All incoming voice room sound and AI notifications silenced.", "info");
    } else {
      triggerToast("Room Audio Unmuted", "Incoming voice room sounds and alerts restored.", "success");
    }
  };

  const handleRequestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      triggerToast("Not Supported", "Browser push notifications are not supported in this browser.", "info");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        triggerToast("Notifications Enabled", "Desk ledger and settlement desktop alerts active!", "success");
        new Notification("ProDesk Ledger Alerts Active", {
          body: "You will now receive push notifications for trade broadcasts and AI settlements.",
          icon: "/app_icon.png"
        });
      } else if (permission === "denied") {
        triggerToast("Notifications Blocked", "Please enable notifications in your browser configuration.", "error");
      }
    } catch (err) {
      console.error("Error requesting notification permission:", err);
    }
  };

  // HTML5 Web Speech Synthesis API (Perfect offline execution!)
  const speakTts = (text: string, speakerUserId?: string) => {
    if (isMutedAll || isDeafened) {
      console.log("Speech synthesis silenced because room audio is muted/deafened.");
      return;
    }
    if (speakerUserId && mutedUsers[speakerUserId]) {
      console.log(`Speech synthesis for user ${speakerUserId} ignored because they are locally muted.`);
      return;
    }
    if ("speechSynthesis" in window) {
      // Cancel prior synth
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1.0;
      utterance.rate = 1.0;

      let userVol = 100;
      if (speakerUserId && userVolumes[speakerUserId] !== undefined) {
        userVol = userVolumes[speakerUserId];
      }
      utterance.volume = (globalVolume / 100) * (userVol / 100);

      // Select firm risk analyst voice accent
      const voices = window.speechSynthesis.getVoices();
      const targetVoice = voices.find(
        (v) =>
          v.name.includes("Google US English") ||
          v.name.includes("Samantha") ||
          v.name.includes("Zira")
      );
      if (targetVoice) utterance.voice = targetVoice;

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleConsultAiAdvisor = () => {
    if (!activeVoiceChannel) {
      alert("Join a voice channel first to test AI risk assessments!");
      return;
    }
    const quotes = [
      "Attention. Volatility index metrics are spiking. Adjust stop-loss models on BTC.",
      "Net cumulative performance curve indicates steady growth ratios. Hold positive stances.",
      "Hedge fund risk calculations completed. Limit max leverage to three percent of total desk capital.",
      "Technical breakout indicators triggered. Set robust trailing indicators.",
    ];
    const picked = quotes[Math.floor(Math.random() * quotes.length)];
    speakTts(picked);
    triggerToast("Voice Co-Pilot Speaking", picked, "success");
  };

  // Chat dispatching
  const handleSendChatMessage = async (text: string) => {
    if (!currentUser || !activeRoom) return;
    const chatCol = collection(db, "chat_messages");
    await addDoc(chatCol, {
      userId: currentUser.uid,
      username: profile?.username || "Trader",
      avatarColor: profile?.avatarColor || "indigo",
      avatarType: profile?.avatarType || "emoji",
      avatarVal: profile?.avatarVal || "🐂",
      groupId: activeRoom.id,
      text,
      channel: activeChannelName,
      timestamp: new Date().toISOString(),
    });
  };

  const handleDeleteChatMessage = async (id: string) => {
    try {
      const docRef = doc(db, "chat_messages", id);
      await deleteDoc(docRef);
      triggerToast("Message Deleted", "Selected chat packet removed from node history.", "info");
    } catch (err: any) {
      console.error(err);
      triggerToast("Delete Failed", `Could not delete message: ${err.message || err}`, "error");
    }
  };

  // Mods roles promotions/demotions inside workspace settings
  const handleToggleModRole = async (targetUid: string, username: string) => {
    if (!activeRoom || !currentUser || activeRoom.creatorId !== currentUser.uid) {
      alert("Only the room owner can promote moderators.");
      return;
    }

    const currentMods = activeRoom.moderators || [];
    let updatedMods: string[];

    if (currentMods.includes(username)) {
      updatedMods = currentMods.filter((n) => n !== username);
      triggerToast("Moderator Demoted", `${username} is no longer a Moderator.`, "info");
    } else {
      updatedMods = [...currentMods, username];
      triggerToast("Moderator Promoted", `${username} is now a Moderator!`, "success");
    }

    const roomRef = doc(db, "rooms", activeRoom.id);
    await updateDoc(roomRef, { moderators: updatedMods });
    setActiveRoom((prev) => (prev ? { ...prev, moderators: updatedMods } : null));
  };

  // Helper check Mod/Owner status
  const isCreatorOrMod = useMemo(() => {
    if (!currentUser || !activeRoom) return false;
    const isOwner = activeRoom.creatorId === currentUser.uid;
    const isRoomMod = activeRoom.moderators?.includes(profile?.username || "");
    return isOwner || isRoomMod;
  }, [currentUser?.uid, activeRoom, profile?.username]);

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-dark-bg text-gray-200 flex flex-col font-sans overflow-hidden">
      {/* Firebase Permission Error warning */}
      {firebaseError && (
        <div className="bg-[#F04747]/10 border-b border-[#F04747]/30 text-[#F04747] text-xs py-2.5 px-4 flex items-center justify-between gap-3 animate-in fade-in duration-200 z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse text-[#F04747]" />
            <span>
              <strong>Firestore Permission Denied:</strong> Your database security rules are blocking reads/writes. Please copy the rules in <code>firestore.rules</code> and deploy them to your Firebase Console.
            </span>
          </div>
          <button
            onClick={() => setFirebaseError(null)}
            className="text-gray-400 hover:text-white transition font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toast Alert overlay */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 transform transition duration-300 flex items-center bg-[#090d16] border border-indigo-500/20 text-white px-4 py-3.5 rounded-xl shadow-2xl max-w-sm">
          <div
            className={`p-1.5 rounded-lg mr-3 ${
              toast.type === "success"
                ? "bg-emerald-500/10 text-emerald-400"
                : toast.type === "error"
                ? "bg-rose-500/10 text-rose-400"
                : "bg-indigo-600/20 text-indigo-400"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 animate-bounce" />
            ) : toast.type === "error" ? (
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-extrabold">{toast.title}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{toast.body}</p>
          </div>
        </div>
      )}

      {/* Onboarding / Login View if not logged in */}
      {!currentUser && (
        <OnboardingView
          onGuestAuth={handleGuestAuth}
          onEmailLogin={handleEmailLogin}
          onEmailRegister={handleEmailRegister}
          onPasswordReset={handlePasswordReset}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          isAuthenticated={!!currentUser}
        />
      )}

      {/* Welcome Screen if authenticated but hasn't joined any room yet */}
      {currentUser && rooms.length === 0 && (
        <OnboardingView
          onGuestAuth={handleGuestAuth}
          onEmailLogin={handleEmailLogin}
          onEmailRegister={handleEmailRegister}
          onPasswordReset={handlePasswordReset}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          isAuthenticated={!!currentUser}
        />
      )}

      {currentUser && rooms.length > 0 && activeRoom && (
        <>
          <div className="flex-grow flex-1 h-full max-h-full min-h-0 flex overflow-hidden w-full">
            {/* Mobile Drawer Overlay */}
            {isMobileSidebarOpen && (
              <div className="fixed inset-0 z-50 flex md:hidden">
                {/* Backdrop overlay */}
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                  onClick={() => setIsMobileSidebarOpen(false)}
                />
                
                {/* Drawer Content container */}
                <div className="relative flex h-full w-[312px] max-w-[85vw] bg-[#08090A] animate-in slide-in-from-left duration-200 z-10 shadow-2xl shrink-0">
                  <SidebarRail
                    rooms={rooms}
                    activeRoomId={activeRoom.id}
                    onSelectRoom={(roomId) => {
                      handleSelectRoom(roomId);
                      setIsMobileSidebarOpen(false);
                    }}
                    onLeaveRoom={handleLeaveRoom}
                    onOpenJoinCreateModal={() => {
                      setIsJoinCreateOpen(true);
                      setIsMobileSidebarOpen(false);
                    }}
                    userProfileName={profile?.username || "Trader"}
                    onLogout={handleLogout}
                  />

                  <ActiveRoomSidebar
                    activeRoom={activeRoom}
                    channels={channels}
                    activeChannelName={activeChannelName}
                    onSelectChannel={(name, type) => {
                      handleSelectChannelWithLockCheck(name, type, true);
                    }}
                    activeVoiceChannel={activeVoiceChannel}
                    onToggleVoiceRoom={handleToggleVoiceRoomWithLockCheck}
                    voiceUsers={voiceUsers}
                    profile={profile ? {
                      ...profile,
                      marketPresence: publicUsers.find(u => u.uid === currentUser?.uid)?.marketPresence || "active",
                      customStatus: publicUsers.find(u => u.uid === currentUser?.uid)?.customStatus || "",
                    } : null}
                    activeTab={activeTab}
                    onSwitchTab={(tab) => {
                      setActiveTab(tab);
                      setIsMobileSidebarOpen(false);
                    }}
                    onOpenLogModal={() => {
                      setIsLogModalOpen(true);
                      setIsMobileSidebarOpen(false);
                    }}
                    onDisconnectVoice={handleDisconnectVoice}
                    isMuted={isMuted}
                    isDeafened={isDeafened}
                    isMutedAll={isMutedAll}
                    onToggleMic={handleToggleMic}
                    onToggleDeafen={handleToggleDeafen}
                    onToggleMuteAll={handleToggleMuteAll}
                    onConsultAiAdvisor={handleConsultAiAdvisor}
                    isCreatorOrMod={isCreatorOrMod}
                    onAddChannelClick={(type) => {
                      handleOpenCreateChannelModal(type);
                      setIsMobileSidebarOpen(false);
                    }}
                    onCopyRoomCode={() => {
                      navigator.clipboard.writeText(activeRoom.id);
                      triggerToast("Room Code Copied", "Share invite code with your partners.", "info");
                    }}
                    globalVolume={globalVolume}
                    onChangeGlobalVolume={handleChangeGlobalVolume}
                    inputVolume={inputVolume}
                    onChangeInputVolume={handleChangeInputVolume}
                    mutedUsers={mutedUsers}
                    onToggleMuteUser={handleToggleMuteUser}
                    userVolumes={userVolumes}
                    onChangeUserVolume={handleChangeUserVolume}
                  />
                </div>
              </div>
            )}

            {/* Desktop Sidebars: hidden on mobile */}
            <div className="hidden md:flex h-full shrink-0">
              {/* 1. Far Left Narrow Sidebar (Discord-style room swapper rail) */}
              <SidebarRail
                rooms={rooms}
                activeRoomId={activeRoom.id}
                onSelectRoom={handleSelectRoom}
                onLeaveRoom={handleLeaveRoom}
                onOpenJoinCreateModal={() => setIsJoinCreateOpen(true)}
                userProfileName={profile?.username || "Trader"}
                onLogout={handleLogout}
              />

              {/* 2. Room-specific middle navigation bar (collapsible on PC) */}
              {!isSidebarCollapsed && (
                <ActiveRoomSidebar
                  activeRoom={activeRoom}
                  channels={channels}
                  activeChannelName={activeChannelName}
                  onSelectChannel={(name, type) => {
                    handleSelectChannelWithLockCheck(name, type, false);
                  }}
                  activeVoiceChannel={activeVoiceChannel}
                  onToggleVoiceRoom={handleToggleVoiceRoomWithLockCheck}
                  voiceUsers={voiceUsers}
                  profile={profile ? {
                    ...profile,
                    marketPresence: publicUsers.find(u => u.uid === currentUser?.uid)?.marketPresence || "active",
                    customStatus: publicUsers.find(u => u.uid === currentUser?.uid)?.customStatus || "",
                  } : null}
                  activeTab={activeTab}
                  onSwitchTab={setActiveTab}
                  onOpenLogModal={() => setIsLogModalOpen(true)}
                  onDisconnectVoice={handleDisconnectVoice}
                  isMuted={isMuted}
                  isDeafened={isDeafened}
                  isMutedAll={isMutedAll}
                  onToggleMic={handleToggleMic}
                  onToggleDeafen={handleToggleDeafen}
                  onToggleMuteAll={handleToggleMuteAll}
                  onConsultAiAdvisor={handleConsultAiAdvisor}
                  isCreatorOrMod={isCreatorOrMod}
                  onAddChannelClick={handleOpenCreateChannelModal}
                  onCopyRoomCode={() => {
                    navigator.clipboard.writeText(activeRoom.id);
                    triggerToast("Room Code Copied", "Share invite code with your partners.", "info");
                  }}
                  isChatSidePanelOpen={isChatSidePanelOpen}
                  globalVolume={globalVolume}
                  onChangeGlobalVolume={handleChangeGlobalVolume}
                  inputVolume={inputVolume}
                  onChangeInputVolume={handleChangeInputVolume}
                  mutedUsers={mutedUsers}
                  onToggleMuteUser={handleToggleMuteUser}
                  userVolumes={userVolumes}
                  onChangeUserVolume={handleChangeUserVolume}
                />
              )}
            </div>

             {/* 3. Main Central App Dashboard Container */}
             <main className="flex-grow flex-1 min-w-0 flex flex-col overflow-hidden bg-dark-bg relative">
               {/* Glowing decorative ambient orbs */}
               {(() => {
                 const isPremiumSkin = subscriptionState.isPremium;
                 const currentSkin = isPremiumSkin ? activeSkin : "default";
                 if (currentSkin === "amber") {
                   return (
                     <>
                       <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.12)_0%,rgba(245,158,11,0)_70%)] pointer-events-none z-0" />
                       <div className="absolute bottom-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(217,119,6,0.08)_0%,rgba(217,119,6,0)_70%)] pointer-events-none z-0" />
                     </>
                   );
                 }
                 if (currentSkin === "emerald") {
                   return (
                     <>
                       <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.12)_0%,rgba(16,185,129,0)_70%)] pointer-events-none z-0" />
                       <div className="absolute bottom-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(4,120,87,0.08)_0%,rgba(4,120,87,0)_70%)] pointer-events-none z-0" />
                     </>
                   );
                 }
                 return (
                   <>
                     <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full ambient-glow-1 z-0" />
                     <div className="absolute bottom-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full ambient-glow-2 z-0" />
                   </>
                 );
               })()}

              {/* Global Header Bar */}
              <header className="h-14 border-b border-dark-border/30 bg-dark-card/30 backdrop-blur-md px-3 md:px-6 flex items-center justify-between shrink-0 z-10 gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {/* Mobile Hamburger toggle */}
                  <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="md:hidden p-1.5 hover:bg-[#1E2023] text-gray-400 hover:text-white rounded border border-[#2A2D31]/50 transition cursor-pointer flex items-center gap-1 shrink-0"
                    title={activeTab !== "dashboard" ? "Back to Channels & Rooms" : "Open Navigation Drawer"}
                  >
                    {activeTab !== "dashboard" ? (
                      <>
                        <ArrowLeft className="w-4 h-4 text-indigo-400" />
                        <span className="text-[10px] font-black uppercase tracking-wider pr-0.5 hidden sm:inline">Channels</span>
                      </>
                    ) : (
                      <Menu className="w-4.5 h-4.5" />
                    )}
                  </button>

                  {/* PC Sidebar minimize/maximize toggle */}
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="hidden md:flex items-center gap-1.5 p-1.5 hover:bg-[#1E2023] text-gray-400 hover:text-white rounded border border-[#2A2D31]/50 transition cursor-pointer shrink-0"
                    title={isSidebarCollapsed ? "Expand Navigation Sidebar" : "Collapse Navigation Sidebar"}
                  >
                    {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden lg:inline">{isSidebarCollapsed ? "Expand" : "Collapse"}</span>
                  </button>

                  {/* Chat Side-Panel Toggle */}
                  {activeTab !== "chat" && (
                    <button
                      onClick={() => setIsChatSidePanelOpen(!isChatSidePanelOpen)}
                      className="hidden md:flex items-center gap-1.5 p-1.5 rounded border transition cursor-pointer shrink-0 hover:bg-[#1E2023] text-gray-400 hover:text-white border-[#2A2D31]/50"
                      title={isChatSidePanelOpen ? "Close Side Chat Panel" : "Open Side Chat Panel"}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider hidden lg:inline">{isChatSidePanelOpen ? "Hide Chat" : "Show Chat"}</span>
                    </button>
                  )}

                  <h2 className="font-extrabold text-white text-[11px] md:text-sm uppercase tracking-wider truncate flex-1 min-w-0">
                    {activeTab === "dashboard" ? (
                      <>
                        <span className="hidden sm:inline">Dashboard statistics overview</span>
                        <span className="sm:hidden">Dashboard</span>
                      </>
                    ) : activeTab === "chat" ? (
                      <>
                        <span className="hidden sm:inline">Desk Chat (#</span>
                        <span className="text-indigo-400 font-black">#</span>
                        <span>{activeChannelName}</span>
                        <span className="hidden sm:inline">)</span>
                      </>
                    ) : activeTab === "leaderboard" ? (
                      <>
                        <span className="hidden sm:inline">Institutional standing boards</span>
                        <span className="sm:hidden">Leaderboard</span>
                      </>
                    ) : activeTab === "logs" ? (
                      <>
                        <span className="hidden sm:inline">P&L Ledger log sheets</span>
                        <span className="sm:hidden">P&L Logs</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Workspace Customizer settings</span>
                        <span className="sm:hidden">Settings</span>
                      </>
                    )}
                  </h2>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={handleRequestNotificationPermission}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition cursor-pointer text-[10px] md:text-xs font-bold uppercase tracking-wider ${
                      notificationPermission === "granted"
                        ? "bg-emerald-950/15 border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30"
                        : notificationPermission === "denied"
                        ? "bg-rose-950/15 border-rose-500/20 text-rose-400"
                        : "bg-amber-950/15 border-amber-500/20 text-amber-400 hover:bg-amber-950/30 animate-pulse"
                    }`}
                    title={
                      notificationPermission === "granted"
                        ? "Browser Push Notifications Active"
                        : notificationPermission === "denied"
                        ? "Notifications Blocked in Browser Settings"
                        : "Enable Browser Push Notifications"
                    }
                  >
                    <Bell className={`w-3.5 h-3.5 ${notificationPermission === "default" ? "animate-bounce" : ""}`} />
                    <span className="hidden lg:inline">
                      {notificationPermission === "granted"
                        ? "Alerts Active"
                        : notificationPermission === "denied"
                        ? "Alerts Blocked"
                        : "Enable Alerts"}
                    </span>
                  </button>

                  <div className="flex items-center space-x-2.5 text-[10px] md:text-xs bg-indigo-950/20 px-2 md:px-3 py-1.5 rounded-xl border border-indigo-500/10 shrink-0">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                    <span className="text-gray-400 hidden lg:inline">Trading Room:</span>
                    <span className="text-indigo-400 font-mono font-bold tracking-wider">{activeRoom.id}</span>
                  </div>
                </div>
              </header>

              <div className="flex-grow flex-1 min-h-0 w-full relative z-10 overflow-hidden flex flex-row min-w-0">
                {/* Left/Middle Tab Contents */}
                <div className="flex-grow flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
                  {isRoomLocked && activeTab !== "partners" ? (
                    <div className="flex-1 w-full bg-[#121417] flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
                      <div className="max-w-md w-full bg-[#1E2023] border border-[#2A2D31] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#5865F2]/5 rounded-full blur-2xl pointer-events-none" />

                        {/* Lock Icon */}
                        <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full border border-amber-500/25 flex items-center justify-center text-amber-400">
                          <Lock className="w-8 h-8" />
                        </div>

                        {/* Title and Room description */}
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-500/20">
                            Premium Workspace Desk
                          </span>
                          <h3 className="text-xl font-black text-white tracking-tight">
                            Room {activeRoom.id} is Private
                          </h3>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            This synchronized trade station is a paid-only desk hosted by expert trader <span className="text-indigo-400 font-bold">@{activeRoom.creatorName || "Desk Owner"}</span>. Subscribe to unlock premium indicators, voice desks, live checklists, and verified P&L logging feeds.
                          </p>
                        </div>

                        {/* Stats Dashboard to prove worthiness */}
                        <div className="grid grid-cols-3 gap-2 bg-[#121417]/80 p-3.5 rounded-xl border border-[#2A2D31]/40 text-center">
                          <div>
                            <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider">Win Rate</span>
                            <span className="text-xs sm:text-sm font-black text-emerald-400 mt-0.5 block">68.2%</span>
                          </div>
                          <div className="border-x border-[#2A2D31]/60">
                            <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider">Profit Fac.</span>
                            <span className="text-xs sm:text-sm font-black text-indigo-400 mt-0.5 block">2.41</span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider">Total Trades</span>
                            <span className="text-xs sm:text-sm font-black text-white mt-0.5 block">{pnlLogs.length + 14}</span>
                          </div>
                        </div>

                        {/* Price Tag */}
                        <div className="py-2 flex items-center justify-center gap-1">
                          <span className="text-3xl font-black text-white">${(activeRoom.monthlyPrice || 14.99).toFixed(2)}</span>
                          <span className="text-xs text-[#8E9297] font-semibold mt-2">/ month</span>
                        </div>

                        {/* Simulate Checkout action */}
                        <div className="space-y-3">
                          {isSubmittingPayment ? (
                            <div className="space-y-2.5 bg-[#121417] p-4 rounded-xl border border-[#2A2D31]/60">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-mono font-bold text-amber-400">Processing...</span>
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono animate-pulse">{paymentStep}</p>
                            </div>
                          ) : (
                            <div className="space-y-4 text-left">
                              {(() => {
                                const hasDirectPayouts = !!(activeRoom.paypalLink || activeRoom.venmoUsername || activeRoom.cashappTag || activeRoom.stripePaymentLink || activeRoom.customPaymentInstructions);
                                return (
                                  <>
                                    {hasDirectPayouts && (
                                      <div className="space-y-3 bg-[#121417]/90 p-4 rounded-xl border border-[#2A2D31]/60">
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                                          Select Direct Payout Channel:
                                        </span>
                                        
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                          {activeRoom.paypalLink && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedPaywallChannel("paypal")}
                                              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                                                selectedPaywallChannel === "paypal"
                                                  ? "bg-blue-600/10 border-blue-500 text-blue-400"
                                                  : "bg-[#1E2023] border-transparent text-gray-400 hover:text-white"
                                              }`}
                                            >
                                              PayPal
                                            </button>
                                          )}
                                          {activeRoom.venmoUsername && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedPaywallChannel("venmo")}
                                              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                                                selectedPaywallChannel === "venmo"
                                                  ? "bg-[#008CFF]/10 border-[#008CFF] text-[#008CFF]"
                                                  : "bg-[#1E2023] border-transparent text-gray-400 hover:text-white"
                                              }`}
                                            >
                                              Venmo
                                            </button>
                                          )}
                                          {activeRoom.cashappTag && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedPaywallChannel("cashapp")}
                                              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                                                selectedPaywallChannel === "cashapp"
                                                  ? "bg-emerald-600/10 border-emerald-500 text-emerald-400"
                                                  : "bg-[#1E2023] border-transparent text-gray-400 hover:text-white"
                                              }`}
                                            >
                                              Cash App
                                            </button>
                                          )}
                                          {activeRoom.stripePaymentLink && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedPaywallChannel("stripe")}
                                              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                                                selectedPaywallChannel === "stripe"
                                                  ? "bg-[#635BFF]/10 border-[#635BFF] text-[#635BFF]"
                                                  : "bg-[#1E2023] border-transparent text-gray-400 hover:text-white"
                                              }`}
                                            >
                                              Stripe Link
                                            </button>
                                          )}
                                          {activeRoom.customPaymentInstructions && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedPaywallChannel("custom")}
                                              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                                                selectedPaywallChannel === "custom"
                                                  ? "bg-amber-500/10 border-amber-500 text-amber-400"
                                                  : "bg-[#1E2023] border-transparent text-gray-400 hover:text-white"
                                              }`}
                                            >
                                              Alternative
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => setSelectedPaywallChannel("sandbox")}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                                              selectedPaywallChannel === "sandbox"
                                                ? "bg-gray-600/10 border-gray-500 text-gray-300"
                                                : "bg-[#1E2023] border-transparent text-gray-400 hover:text-white"
                                            }`}
                                          >
                                            Sandbox
                                          </button>
                                        </div>

                                        <div className="border-t border-[#2A2D31]/40 pt-2.5 mt-2">
                                          {selectedPaywallChannel === "paypal" && (
                                            <div className="space-y-2">
                                              <p className="text-[11px] text-gray-400">
                                                Transfer exactly <span className="font-bold text-white">${(activeRoom.monthlyPrice || 14.99).toFixed(2)}</span> to the creator's PayPal account to settle.
                                              </p>
                                              <a
                                                href={activeRoom.paypalLink.startsWith("http") ? activeRoom.paypalLink : `https://paypal.me/${activeRoom.paypalLink}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                referrerPolicy="no-referrer"
                                                className="inline-flex w-full justify-center items-center gap-1.5 bg-[#003087] hover:bg-[#0079C1] text-white text-xs font-black py-2 rounded-lg transition"
                                              >
                                                <ExternalLink className="w-3.5 h-3.5" /> Pay on PayPal
                                              </a>
                                            </div>
                                          )}

                                          {selectedPaywallChannel === "venmo" && (
                                            <div className="space-y-2">
                                              <p className="text-[11px] text-gray-400">
                                                Send <span className="font-bold text-white">${(activeRoom.monthlyPrice || 14.99).toFixed(2)}</span> to Venmo handle: <span className="text-blue-400 font-bold font-mono">{activeRoom.venmoUsername}</span>.
                                              </p>
                                              <a
                                                href={`https://venmo.com/${activeRoom.venmoUsername.replace('@', '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                referrerPolicy="no-referrer"
                                                className="inline-flex w-full justify-center items-center gap-1.5 bg-[#008CFF] hover:bg-[#0074D9] text-white text-xs font-black py-2 rounded-lg transition"
                                              >
                                                <ExternalLink className="w-3.5 h-3.5" /> Pay with Venmo
                                              </a>
                                            </div>
                                          )}

                                          {selectedPaywallChannel === "cashapp" && (
                                            <div className="space-y-2">
                                              <p className="text-[11px] text-gray-400">
                                                Send <span className="font-bold text-white">${(activeRoom.monthlyPrice || 14.99).toFixed(2)}</span> to Cash App Cashtag: <span className="text-emerald-400 font-bold font-mono">{activeRoom.cashappTag}</span>.
                                              </p>
                                              <a
                                                href={`https://cash.app/$${activeRoom.cashappTag.replace('$', '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                referrerPolicy="no-referrer"
                                                className="inline-flex w-full justify-center items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2 rounded-lg transition"
                                              >
                                                <ExternalLink className="w-3.5 h-3.5" /> Pay with Cash App
                                              </a>
                                            </div>
                                          )}

                                          {selectedPaywallChannel === "stripe" && (
                                            <div className="space-y-2">
                                              <p className="text-[11px] text-gray-400">
                                                Click below to pay safely using Stripe Credit Card Checkout.
                                              </p>
                                              <a
                                                href={activeRoom.stripePaymentLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                referrerPolicy="no-referrer"
                                                className="inline-flex w-full justify-center items-center gap-1.5 bg-[#635BFF] hover:bg-[#5249EC] text-white text-xs font-black py-2 rounded-lg transition"
                                              >
                                                <ExternalLink className="w-3.5 h-3.5" /> Secure Stripe Checkout
                                              </a>
                                            </div>
                                          )}

                                          {selectedPaywallChannel === "custom" && (
                                            <div className="space-y-2">
                                              <span className="text-[9px] uppercase font-bold text-gray-500">Alternative Instructions:</span>
                                              <div className="bg-[#1E2023] p-2.5 rounded border border-[#2A2D31] text-[11px] text-gray-300 font-mono whitespace-pre-wrap leading-normal">
                                                {activeRoom.customPaymentInstructions}
                                              </div>
                                            </div>
                                          )}

                                          {selectedPaywallChannel === "sandbox" && (
                                            <div className="space-y-1">
                                              <p className="text-[11px] text-gray-400">
                                                Bypass payments instantly to test workspace operations using a sandboxed subscription simulator.
                                              </p>
                                            </div>
                                          )}

                                          {/* Proof of Payment input for P2P */}
                                          {selectedPaywallChannel !== "sandbox" && (
                                            <div className="mt-3.5 space-y-1 animate-in fade-in duration-150">
                                              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                                                Sender Handle / Proof of Transfer
                                              </label>
                                              <input
                                                type="text"
                                                value={p2pPaymentProof}
                                                onChange={(e) => setP2pPaymentProof(e.target.value)}
                                                placeholder="e.g. Sent from @MyVenmo / ref #12345"
                                                className="w-full bg-[#1E2023] border border-[#2A2D31] rounded px-2.5 py-1.5 text-xs text-white"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={handleSubscribeToRoom}
                                      className="w-full bg-amber-500 hover:bg-amber-600 text-[#121417] font-black text-xs py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Coins className="w-4 h-4" /> 
                                      {selectedPaywallChannel === "sandbox" ? "Subscribe via Instant Sandbox Test" : `Confirm Direct ${selectedPaywallChannel.toUpperCase()} Payment`}
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                          <p className="text-[10px] text-[#8E9297]">
                            Payments are completed directly with the room owner. Subscribing grants real-time streaming member credentials instantly.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {activeTab === "dashboard" && (
                        <DashboardView pnlLogs={pnlLogs} userId={currentUser.uid} />
                      )}

                      {activeTab === "chat" && (
                        <ChatView
                          activeRoom={activeRoom}
                          activeChannelName={activeChannelName}
                          chatMessages={chatMessages}
                          roomTraders={traders}
                          userId={currentUser.uid}
                          onSendChatMessage={handleSendChatMessage}
                          onDeleteChatMessage={handleDeleteChatMessage}
                          roomAdminId={activeRoom.creatorId}
                          roomMods={activeRoom.moderators || []}
                          isCreatorOrMod={isCreatorOrMod}
                          onToggleModRole={handleToggleModRole}
                          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                          channels={channels}
                          onSelectChannel={(name, type) => {
                            handleSelectChannelWithLockCheck(name, type, true);
                          }}
                          profile={profile}
                        />
                      )}

                      {activeTab === "leaderboard" && <LeaderboardView pnlLogs={pnlLogs} />}

                      {activeTab === "logs" && (
                        <LogsView
                          pnlLogs={pnlLogs}
                          userId={currentUser.uid}
                          username={profile?.username || "Trader"}
                          onDeleteLog={handleDeleteTradeLog}
                          onOpenLogModal={() => setIsLogModalOpen(true)}
                          roomCode={activeRoom.id}
                          traders={traders}
                          isCreatorOrMod={isCreatorOrMod}
                        />
                      )}

                      {activeTab === "checklist" && (
                        <ChecklistView
                          rules={tradingRules}
                          onAddRule={handleAddRule}
                          onUpdateRule={handleUpdateRule}
                          onDeleteRule={handleDeleteRule}
                          onSeedDefaultRules={handleSeedDefaultRules}
                          isCreatorOrMod={isCreatorOrMod}
                        />
                      )}

                      {activeTab === "friends" && (
                        <FriendsView
                          currentUser={currentUser}
                          db={db}
                          profile={profile}
                          onJoinRoomCode={handleJoinRoom}
                          triggerToast={triggerToast}
                        />
                      )}
                    </>
                  )}

                  {activeTab === "partners" && (
                    <SettingsView
                      profile={profile}
                      activeRoom={activeRoom}
                      channels={channels}
                      onUpdateProfile={handleUpdateProfile}
                      onAddChannel={handleAddChannel}
                      onDeleteChannel={handleDeleteChannel}
                      onRenameChannel={handleRenameChannelTrigger}
                      onSetChannelPin={handleSetChannelPin}
                      onCopyRoomCode={() => {
                        navigator.clipboard.writeText(activeRoom.id);
                        triggerToast("Room Code Copied", "Share invite code with your partners.", "info");
                      }}
                      onJoinRoomCode={handleJoinRoom}
                      onCreateNewRoom={handleCreateRoom}
                      isCreatorOrMod={isCreatorOrMod}
                      onConsultAiAdvisor={handleConsultAiAdvisor}
                      voiceName={voiceName}
                      setVoiceName={setVoiceName}
                      vocalPrompt={vocalPrompt}
                      setVocalPrompt={setVocalPrompt}
                      subscriptionState={subscriptionState}
                      stripeConfig={stripeConfig}
                      onSubscribe={handleSubscribe}
                      onManageBilling={handleManageBilling}
                      onUpdateSubscriptionTier={handleUpdateSubscriptionTier}
                      onUpdateRoomMonetization={handleUpdateRoomMonetization}
                      onUpdateStripeConnect={handleUpdateStripeConnect}
                      onUpdateDiscordWebhook={handleUpdateDiscordWebhook}
                      isRoomOwner={activeRoom.creatorId === currentUser?.uid}
                    />
                  )}
                </div>

                {/* Right-Side Persistent/Collapsible Split-Screen Chat Panel */}
                {activeTab !== "chat" && isChatSidePanelOpen && (
                  <div className="hidden md:flex w-[380px] lg:w-[440px] shrink-0 border-l border-[#2A2D31] bg-[#1E2023] h-full flex flex-col overflow-hidden relative z-20">
                    {/* Header for Chat Side Panel */}
                    <div className="h-10 bg-[#121417] border-b border-[#2A2D31] px-4 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider truncate">
                          Room Chat: #{activeChannelName}
                        </span>
                      </div>
                      <button
                        onClick={() => setIsChatSidePanelOpen(false)}
                        className="p-1 hover:bg-[#2A2D31] text-gray-400 hover:text-white rounded transition cursor-pointer"
                        title="Close Chat Side Panel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 w-full">
                      <ChatView
                        activeRoom={activeRoom}
                        activeChannelName={activeChannelName}
                        chatMessages={chatMessages}
                        roomTraders={traders}
                        userId={currentUser.uid}
                        onSendChatMessage={handleSendChatMessage}
                        onDeleteChatMessage={handleDeleteChatMessage}
                        roomAdminId={activeRoom.creatorId}
                        roomMods={activeRoom.moderators || []}
                        isCreatorOrMod={isCreatorOrMod}
                        onToggleModRole={handleToggleModRole}
                        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                        profile={profile}
                      />
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>

          {/* Modal Overlay: Join / Create Room manually */}
          {isJoinCreateOpen && (
            <div className="fixed inset-0 z-50 bg-[#0F1113]/90 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-[#1E2023] border border-[#2A2D31] rounded w-full max-w-sm overflow-hidden shadow-2xl p-6 relative">
                <button
                  onClick={() => setIsJoinCreateOpen(false)}
                  className="absolute top-4 right-4 text-[#8E9297] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="text-center space-y-4 pt-2">
                  <h3 className="font-extrabold text-lg text-white">Join or Establish a Sync Room</h3>
                  <p className="text-xs text-[#8E9297] leading-relaxed">
                    Collaborate with fellow traders. Paste their invitation room code below or establish a new node.
                  </p>

                  <div className="space-y-3 pt-2">
                    <button
                      onClick={handleCreateRoom}
                      className="w-full bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] font-extrabold text-xs py-2.5 px-4 rounded hover:bg-[#5865F2]/20 transition flex items-center justify-center gap-1.5"
                    >
                      Establish New Sync Room
                    </button>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-[#2A2D31]/50"></div>
                      <span className="flex-shrink mx-3 text-[#72767D] text-[10px] font-bold uppercase tracking-wider">
                        Or enter join code
                      </span>
                      <div className="flex-grow border-t border-[#2A2D31]/50"></div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleJoinRoom(modalJoinCode);
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        required
                        placeholder="PL-XXXX"
                        value={modalJoinCode}
                        onChange={(e) => setModalJoinCode(e.target.value.toUpperCase())}
                        className="bg-[#121417] border border-[#2A2D31] rounded px-4 py-2 text-xs text-white uppercase font-bold tracking-widest focus:outline-none focus:ring-1 focus:ring-[#5865F2] flex-grow text-center font-mono"
                      />
                      <button
                        type="submit"
                        className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs px-5 rounded transition"
                      >
                        Join
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Overlay: Log P&L Trade Setup */}
          {isLogModalOpen && (
            <div className="fixed inset-0 z-40 bg-[#0F1113]/90 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-[#1E2023] border border-[#2A2D31] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in duration-200 max-h-[calc(100vh-2rem)] flex flex-col">
                <div className="p-4 sm:p-5 border-b border-[#2A2D31]/60 flex items-center justify-between bg-[#121417] shrink-0">
                  <h3 className="font-extrabold text-gray-100 text-sm flex items-center gap-2">
                    <TrendingUp className="text-[#5865F2] w-5 h-5" /> Log Verified Trade Setup
                  </h3>
                  <button onClick={() => setIsLogModalOpen(false)} className="text-gray-400 hover:text-white transition cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleLogTradeSubmit} className="flex-grow flex flex-col overflow-hidden">
                  <div className="p-4 sm:p-6 space-y-4 text-[#DCDDDE] overflow-y-auto flex-grow">
                    <div>
                      <label className="block text-xs font-bold text-[#8E9297] uppercase mb-2">
                        P&L Amount ($ USD)
                      </label>
                      <div className="flex rounded overflow-hidden border border-[#2A2D31]">
                        <button
                          type="button"
                          onClick={() => setLogType("profit")}
                          className={`flex-grow py-2.5 text-sm font-extrabold transition cursor-pointer ${
                            logType === "profit" ? "bg-[#43B581]/10 text-[#43B581]" : "bg-[#121417] text-gray-500"
                          }`}
                        >
                          PROFIT (+)
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogType("loss")}
                          className={`flex-grow py-2.5 text-sm font-extrabold transition cursor-pointer ${
                            logType === "loss" ? "bg-[#F04747]/10 text-[#F04747]" : "bg-[#121417] text-gray-500"
                          }`}
                        >
                          LOSS (-)
                        </button>
                      </div>
                      <div className="relative mt-2">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#72767D] font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={logAmount}
                          onChange={(e) => setLogAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#121417] border border-[#2A2D31] rounded pl-8 pr-4 py-2.5 text-lg font-black text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#8E9297] uppercase mb-1.5">Date</label>
                        <input
                          type="date"
                          required
                          value={logDate}
                          onChange={(e) => setLogDate(e.target.value)}
                          className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#8E9297] uppercase mb-1.5">Time</label>
                        <input
                          type="time"
                          required
                          value={logTime}
                          onChange={(e) => setLogTime(e.target.value)}
                          className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#8E9297] uppercase mb-1.5">Asset / Ticker</label>
                        <input
                          type="text"
                          required
                          value={logAsset}
                          onChange={(e) => setLogAsset(e.target.value)}
                          placeholder="BTC"
                          className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white uppercase font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#8E9297] uppercase mb-1.5">Strategy</label>
                        <select
                          value={logStrategy}
                          onChange={(e) => setLogStrategy(e.target.value)}
                          className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white"
                        >
                          <option value="Breakout">Breakout</option>
                          <option value="Mean Reversion">Mean Reversion</option>
                          <option value="Supply/Demand">Supply/Demand</option>
                          <option value="Scalp">Scalp</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#8E9297] uppercase mb-1.5">Notes</label>
                      <textarea
                        value={logNotes}
                        onChange={(e) => setLogNotes(e.target.value)}
                        placeholder="Add technical indicator confirmations or leverage notes..."
                        rows={2}
                        className="w-full bg-[#121417] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-[#121417] border-t border-[#2A2D31]/60 flex gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsLogModalOpen(false)}
                      className="w-1/3 bg-[#1E2023] hover:bg-[#2A2D31] border border-[#2A2D31] text-gray-300 font-semibold text-xs py-2.5 rounded transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2.5 rounded transition shadow cursor-pointer"
                    >
                      Sync Record
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Overlay: Custom Create Channel */}
          {isCreateChannelOpen && (
            <div className="fixed inset-0 z-50 bg-[#0F1113]/90 flex items-center justify-center p-4 backdrop-blur-md">
              <form onSubmit={handleConfirmCreateChannel} className="bg-[#1E2023] border border-[#2A2D31] rounded w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="p-5 border-b border-[#2A2D31]/60 flex items-center justify-between bg-[#121417]">
                  <h3 className="font-extrabold text-gray-100 text-sm flex items-center gap-2">
                    <Plus className="text-[#5865F2] w-5 h-5" />
                    <span>Create {createChannelType === "text" ? "Text Channel" : "Voice Room"}</span>
                  </h3>
                  <button type="button" onClick={() => setIsCreateChannelOpen(false)} className="text-gray-400 hover:text-white transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-[#DCDDDE]">
                  <div>
                    <label className="block text-xs font-bold text-[#8E9297] uppercase tracking-widest mb-2">
                      Channel Type
                    </label>
                    <div className="bg-[#121417] border border-[#2A2D31] rounded p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {createChannelType === "text" ? (
                          <span className="text-indigo-400 font-extrabold text-sm">#</span>
                        ) : (
                          <Volume2 className="text-emerald-400 w-4 h-4" />
                        )}
                        <span className="text-xs font-bold capitalize text-white">
                          {createChannelType} Channel
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">Selected</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                      Channel Name
                    </label>
                    <input
                      type="text"
                      required
                      value={createChannelName}
                      onChange={(e) => setCreateChannelName(e.target.value)}
                      placeholder={createChannelType === "text" ? "e.g. trading-setups" : "e.g. Scalp Room 1"}
                      className="w-full bg-[#121417] border border-[#2A2D31] rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      {createChannelType === "text"
                        ? "Text channels allow sharing charts, links and technical logs."
                        : "Voice rooms support active technical syncs, screen share grids, and audio."}
                    </p>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreateChannelOpen(false)}
                      className="w-1/3 bg-[#121417] hover:bg-[#08090A] border border-[#2A2D31] text-gray-300 font-semibold text-xs py-2 rounded transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2 rounded transition cursor-pointer"
                    >
                      Create Channel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Modal Overlay: Rename Channel */}
          {isRenameOpen && renameTarget && (
            <div className="fixed inset-0 z-50 bg-[#0F1113]/90 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-[#1E2023] border border-[#2A2D31] rounded w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6">
                <h3 className="font-extrabold text-lg text-white mb-2">Rename Workspace Channel</h3>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-[#8E9297] uppercase tracking-widest mb-1.5">
                      Current Name
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={renameTarget.name}
                      className="w-full bg-[#121417] border border-[#2A2D31] rounded px-4 py-2 text-xs text-[#72767D] font-mono cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                      New Name
                    </label>
                    <input
                      type="text"
                      required
                      value={renameNewName}
                      onChange={(e) => setRenameNewName(e.target.value)}
                      placeholder="crypto-setups"
                      className="w-full bg-[#121417] border border-[#2A2D31] rounded px-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-mono lowercase"
                    />
                  </div>
                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={() => {
                        setIsRenameOpen(false);
                        setRenameTarget(null);
                      }}
                      className="w-1/3 bg-[#121417] hover:bg-[#08090A] border border-[#2A2D31] text-gray-300 font-semibold text-xs py-2 rounded transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveRename}
                      className="w-2/3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2 rounded transition"
                    >
                      Save Name
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Overlay: PIN Unlock */}
          {pendingChannelToUnlock && (
            <div className="fixed inset-0 z-[90] bg-[#0F1113]/95 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-[#1E2023] border border-[#2A2D31] rounded w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6">
                <div className="flex items-center gap-2 mb-2 text-amber-500">
                  <Lock className="w-5 h-5 fill-amber-500/10" />
                  <h3 className="font-extrabold text-lg text-white">Unlock Channel</h3>
                </div>
                <p className="text-xs text-[#8E9297] mb-4">
                  The {pendingChannelToUnlock.type === "text" ? "text channel" : "voice room"}{" "}
                  <span className="text-white font-bold">#{pendingChannelToUnlock.name}</span> is PIN-protected. Please enter the room PIN to join.
                </p>
                <form onSubmit={handleVerifyChannelPin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                      Enter PIN Code
                    </label>
                    <input
                      type="password"
                      required
                      autoFocus
                      placeholder="e.g. 1234"
                      value={enteredPin}
                      onChange={(e) => {
                        setEnteredPin(e.target.value);
                        if (pinError) setPinError("");
                      }}
                      className="w-full bg-[#121417] border border-[#2A2D31] rounded px-4 py-2.5 text-center text-lg text-white tracking-widest font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {pinError && (
                      <p className="text-rose-500 text-xs font-semibold mt-1.5 animate-pulse text-center">
                        {pinError}
                      </p>
                    )}
                  </div>
                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingChannelToUnlock(null);
                        setEnteredPin("");
                        setPinError("");
                      }}
                      className="w-1/3 bg-[#121417] hover:bg-[#08090A] border border-[#2A2D31] text-gray-300 font-semibold text-xs py-2 rounded transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2 rounded transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      Unlock Room
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Custom Confirmation Dialog */}
          {confirmDialog.isOpen && (
            <div className="fixed inset-0 z-[100] bg-[#0F1113]/90 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-[#1E2023] border border-[#2A2D31] rounded w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-rose-500/10 text-rose-500 rounded">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-white mb-1">{confirmDialog.title}</h3>
                    <p className="text-xs text-[#8E9297] leading-relaxed">{confirmDialog.message}</p>
                  </div>
                </div>
                <div className="pt-5 flex gap-3 justify-end">
                  <button
                    onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 bg-[#121417] hover:bg-[#08090A] border border-[#2A2D31] text-gray-300 font-semibold text-xs rounded transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDialog.onConfirm}
                    className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded transition cursor-pointer"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}

          <UpdateNotifier />
        </>
      )}
    </div>
  );
}
