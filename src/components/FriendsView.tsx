import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Check,
  X,
  Search,
  Crown,
  Sparkles,
  UserCheck,
  Activity,
  ArrowRight,
  TrendingUp,
  Flame,
  CheckCircle,
  MessageSquare,
  Shield,
  Clock,
  ExternalLink,
  LifeBuoy,
  MoreVertical,
  Moon,
  AlertOctagon,
  Trash2,
  Circle
} from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  getDoc
} from "firebase/firestore";
import { User } from "firebase/auth";
import { UserProfile, Friendship } from "../types";

interface FriendsViewProps {
  currentUser: User;
  db: any;
  profile: UserProfile | null;
  onJoinRoomCode: (code: string) => Promise<void>;
  triggerToast: (title: string, body: string, type: "success" | "error" | "info") => void;
}

interface FriendDetail {
  friendshipId: string;
  friendId: string;
  username: string;
  avatarColor: string;
  avatarVal: string;
  avatarType?: "emoji" | "url";
  activeGroupId: string;
  subscriptionTier: string;
  status: "pending" | "accepted";
  isIncoming: boolean;
  marketPresence?: "active" | "idle" | "dnd" | "offline";
  customStatus?: string;
}

export default function FriendsView({
  currentUser,
  db,
  profile,
  onJoinRoomCode,
  triggerToast
}: FriendsViewProps) {
  const [searchUsername, setSearchUsername] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [friendships, setFriendships] = useState<FriendDetail[]>([]);
  const [activeTab, setActiveTab] = useState<"online" | "all" | "pending" | "add_partner" | "perks_support">("online");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  
  // User's own status presence states
  const [myPresence, setMyPresence] = useState<"active" | "idle" | "dnd" | "offline">("active");
  const [myCustomStatus, setMyCustomStatus] = useState("Analyzing Markets");
  const [isUpdatingOwnPresence, setIsUpdatingOwnPresence] = useState(false);

  // VIP Hotline states
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const [supportTicketResponse, setSupportTicketResponse] = useState<string | null>(null);

  // Expanded menu for friend ID to show delete confirmation inline
  const [activeMenuFriendId, setActiveMenuFriendId] = useState<string | null>(null);

  // Load my status from public user document on mount
  useEffect(() => {
    if (!currentUser) return;
    const fetchMyStatus = async () => {
      try {
        const publicRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(publicRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.marketPresence) setMyPresence(data.marketPresence);
          if (data.customStatus !== undefined) setMyCustomStatus(data.customStatus);
        }
      } catch (err) {
        console.error("Error loading my status:", err);
      }
    };
    fetchMyStatus();
  }, [currentUser?.uid, db]);

  // Sync public user document once on load & update status presence
  useEffect(() => {
    if (currentUser && profile) {
      const syncPublic = async () => {
        try {
          const publicRef = doc(db, "users", currentUser.uid);
          await setDoc(publicRef, {
            uid: currentUser.uid,
            username: profile.username || "Trader",
            avatarColor: profile.avatarColor || "indigo",
            avatarType: profile.avatarType || "emoji",
            avatarVal: profile.avatarVal || "🐂",
            subscriptionTier: (profile.subscriptionStatus === "active" || profile.subscriptionStatus === "trialing") ? "premium" : "free",
            activeGroupId: profile.activeGroupId || "",
            marketPresence: myPresence,
            customStatus: myCustomStatus,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("Failed to sync public user doc:", err);
        }
      };
      syncPublic();
    }
  }, [currentUser?.uid, profile, myPresence, myCustomStatus]);

  // Read Friendships in Real-time
  useEffect(() => {
    if (!currentUser) return;

    const friendshipsRef = collection(db, "friendships");
    
    // Listen to friendships where current user is either sender or receiver
    const unsub = onSnapshot(friendshipsRef, async (snapshot) => {
      const friendshipList: FriendDetail[] = [];
      const fetchPromises: Promise<void>[] = [];

      snapshot.docs.forEach((d) => {
        const data = d.data() as Friendship;
        if (data.senderId === currentUser.uid) {
          // Current user sent the request
          const p = getDoc(doc(db, "users", data.receiverId)).then((userSnap) => {
            const userData = userSnap.exists() ? userSnap.data() : null;
            friendshipList.push({
              friendshipId: d.id,
              friendId: data.receiverId,
              username: userData?.username || data.receiverName,
              avatarColor: userData?.avatarColor || data.receiverAvatarColor,
              avatarVal: userData?.avatarVal || data.receiverAvatarVal,
              avatarType: userData?.avatarType || "emoji",
              activeGroupId: userData?.activeGroupId || "",
              subscriptionTier: userData?.subscriptionTier || "free",
              status: data.status,
              isIncoming: false,
              marketPresence: userData?.marketPresence || "active",
              customStatus: userData?.customStatus || "Analyzing Markets"
            });
          }).catch((err) => {
            console.error(err);
            friendshipList.push({
              friendshipId: d.id,
              friendId: data.receiverId,
              username: data.receiverName,
              avatarColor: data.receiverAvatarColor,
              avatarVal: data.receiverAvatarVal,
              avatarType: "emoji",
              activeGroupId: "",
              subscriptionTier: "free",
              status: data.status,
              isIncoming: false,
              marketPresence: "active",
              customStatus: "Analyzing Markets"
            });
          });
          fetchPromises.push(p);
        } else if (data.receiverId === currentUser.uid) {
          // Current user received the request
          const p = getDoc(doc(db, "users", data.senderId)).then((userSnap) => {
            const userData = userSnap.exists() ? userSnap.data() : null;
            friendshipList.push({
              friendshipId: d.id,
              friendId: data.senderId,
              username: userData?.username || data.senderName,
              avatarColor: userData?.avatarColor || data.senderAvatarColor,
              avatarVal: userData?.avatarVal || data.senderAvatarVal,
              avatarType: userData?.avatarType || "emoji",
              activeGroupId: userData?.activeGroupId || "",
              subscriptionTier: userData?.subscriptionTier || "free",
              status: data.status,
              isIncoming: true,
              marketPresence: userData?.marketPresence || "active",
              customStatus: userData?.customStatus || "Analyzing Markets"
            });
          }).catch((err) => {
            console.error(err);
            friendshipList.push({
              friendshipId: d.id,
              friendId: data.senderId,
              username: data.senderName,
              avatarColor: data.senderAvatarColor,
              avatarVal: data.senderAvatarVal,
              avatarType: "emoji",
              activeGroupId: "",
              subscriptionTier: "free",
              status: data.status,
              isIncoming: true,
              marketPresence: "active",
              customStatus: "Analyzing Markets"
            });
          });
          fetchPromises.push(p);
        }
      });

      await Promise.all(fetchPromises);
      setFriendships(friendshipList);
    }, (err) => {
      console.error("Failed to subscribe to friendships:", err);
    });

    return () => unsub();
  }, [currentUser?.uid, db]);

  // Update own custom presence in database
  const handleUpdatePresenceAndStatus = async (presence: "active" | "idle" | "dnd" | "offline", statusText: string) => {
    setIsUpdatingOwnPresence(true);
    setMyPresence(presence);
    setMyCustomStatus(statusText);
    try {
      const publicRef = doc(db, "users", currentUser.uid);
      await setDoc(publicRef, {
        marketPresence: presence,
        customStatus: statusText,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      triggerToast("Presence Updated", `Node status set to ${presence.toUpperCase()}`, "success");
    } catch (err: any) {
      console.error(err);
      triggerToast("Sync Error", "Could not broadcast presence update.", "error");
    } finally {
      setIsUpdatingOwnPresence(false);
    }
  };

  // Add Friend Logic
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim() || !profile) return;
    setIsSearching(true);

    try {
      const cleanUsername = searchUsername.trim();
      
      if (cleanUsername.toLowerCase() === profile.username?.toLowerCase()) {
        triggerToast("Self Referral Blocked", "You cannot establish a co-trader link with your own node.", "error");
        setIsSearching(false);
        return;
      }

      // Check if already friends
      const alreadyConnected = friendships.find(f => f.username.toLowerCase() === cleanUsername.toLowerCase());
      if (alreadyConnected) {
        if (alreadyConnected.status === "accepted") {
          triggerToast("Connection Active", `${cleanUsername} is already linked to your node.`, "info");
        } else {
          triggerToast("Pending Link", `A pending request already exists with ${cleanUsername}.`, "info");
        }
        setIsSearching(false);
        return;
      }

      // Find user in /users collection
      const usersCol = collection(db, "users");
      const q = query(usersCol, where("username", "==", cleanUsername));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        triggerToast("Trader Not Found", `Could not locate active node with username "${cleanUsername}".`, "error");
        setIsSearching(false);
        return;
      }

      const targetDoc = querySnap.docs[0];
      const targetUser = targetDoc.data();
      const targetUid = targetDoc.id;

      // Add a pending friendship document
      const friendshipId = `friend_${currentUser.uid}_${targetUid}`;
      await setDoc(doc(db, "friendships", friendshipId), {
        id: friendshipId,
        senderId: currentUser.uid,
        senderName: profile.username || "Trader",
        senderAvatarColor: profile.avatarColor || "indigo",
        senderAvatarVal: profile.avatarVal || "🐂",
        receiverId: targetUid,
        receiverName: targetUser.username,
        receiverAvatarColor: targetUser.avatarColor || "indigo",
        receiverAvatarVal: targetUser.avatarVal || "🐂",
        status: "pending",
        createdAt: new Date().toISOString()
      });

      triggerToast("Request Dispatched", `Sent a co-trader synchronization request to ${cleanUsername}.`, "success");
      setSearchUsername("");
      setActiveTab("pending"); // Switch tab to pending so they see it
    } catch (err: any) {
      console.error("Failed to add friend:", err);
      triggerToast("Error", err.message || "Failed to dispatch request.", "error");
    } finally {
      setIsSearching(false);
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (friendshipId: string, friendName: string) => {
    try {
      const friendshipRef = doc(db, "friendships", friendshipId);
      await updateDoc(friendshipRef, {
        status: "accepted"
      });
      triggerToast("Connection Established", `You are now synchronized with ${friendName}.`, "success");
    } catch (err: any) {
      console.error(err);
      triggerToast("Error", "Could not accept request.", "error");
    }
  };

  // Decline/Cancel/Remove Friend
  const handleRemoveFriendship = async (friendshipId: string, label: string) => {
    try {
      await deleteDoc(doc(db, "friendships", friendshipId));
      triggerToast("Connection Terminated", `Safely terminated link: ${label}.`, "info");
      setActiveMenuFriendId(null);
    } catch (err: any) {
      console.error(err);
      triggerToast("Error", "Could not remove connection.", "error");
    }
  };

  // Join friend's workspace desk instantly
  const handleJoinFriendDesk = async (roomId: string, friendName: string) => {
    if (!roomId) return;
    try {
      await onJoinRoomCode(roomId);
      triggerToast("Desk Entered", `Successfully hopped onto ${friendName}'s active workspace!`, "success");
    } catch (err: any) {
      console.error(err);
      triggerToast("Navigation Error", "Could not enter desk: " + err.message, "error");
    }
  };

  // Elite Hotline Support Simulation (Elite Perk)
  const handleSubmitSupportTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) return;
    setSubmittingSupport(true);

    setTimeout(() => {
      setSubmittingSupport(false);
      setSupportTicketResponse(
        "🚨 [VIP HOTLINE DISPATCHER]: Your Elite Priority request has been logged. Under our sub-minute SLA, support node #702 is already auditing your synchronized ledger records. Rest assured, your position tracking is protected by institutional-grade protocols."
      );
      triggerToast("Hotline Dispatched", "Your VIP Support packet was accepted with priority priority status.", "success");
      setSupportSubject("");
      setSupportMessage("");
    }, 1200);
  };

  const isPremium = profile?.subscriptionStatus === "active" || profile?.subscriptionStatus === "trialing";

  // Organize friends list
  const acceptedFriends = friendships.filter(f => f.status === "accepted");
  const pendingRequests = friendships.filter(f => f.status === "pending");
  const incomingPendingCount = pendingRequests.filter(r => r.isIncoming).length;

  // Search filter
  const filteredFriends = acceptedFriends.filter(f => 
    f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
    (f.customStatus || "").toLowerCase().includes(friendSearchQuery.toLowerCase())
  );

  // Split into Online vs Offline
  // In our trading layout, anyone whose status is active, idle, or dnd is grouped into "Online"
  const onlineFriends = filteredFriends.filter(f => f.marketPresence !== "offline");
  const offlineFriends = filteredFriends.filter(f => f.marketPresence === "offline");

  const getTierColor = (status?: string, tier?: string) => {
    if (status === "active" || status === "trialing" || tier === "premium" || tier === "pro" || tier === "elite") {
      return "text-indigo-400 border-indigo-500/30 bg-indigo-500/10";
    }
    return "text-gray-400 border-gray-700 bg-gray-800/40";
  };

  const getPresenceIndicatorColor = (presence?: string) => {
    switch (presence) {
      case "active":
        return "bg-emerald-500";
      case "idle":
        return "bg-amber-500";
      case "dnd":
        return "bg-rose-500";
      case "offline":
      default:
        return "bg-gray-600";
    }
  };

  const getPresenceLabel = (presence?: string) => {
    switch (presence) {
      case "active":
        return "Active Desk";
      case "idle":
        return "AFK / Analyzing";
      case "dnd":
        return "Deep Trading (DND)";
      case "offline":
      default:
        return "Offline";
    }
  };

  return (
    <div id="friends-view-root" className="flex-1 flex flex-col bg-[#0f1115] text-gray-200 h-full overflow-hidden">
      
      {/* 1. DISCORD-STYLE HEADER BAR */}
      <div className="h-14 border-b border-[#1e2229] px-4 flex items-center justify-between shrink-0 bg-[#0b0d10] select-none">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto scrollbar-none py-1">
          <div className="flex items-center gap-2 text-white font-bold text-sm shrink-0">
            <Users className="w-5 h-5 text-gray-400" />
            <span className="tracking-tight">Co-Traders</span>
          </div>

          <div className="h-5 w-[1px] bg-gray-800 shrink-0 hidden md:block" />

          {/* Tab Selection */}
          <nav className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <button
              onClick={() => setActiveTab("online")}
              className={`px-3 py-1 rounded text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === "online" ? "bg-[#35373c] text-white" : "text-gray-400 hover:text-gray-200 hover:bg-[#35373c]/30"
              }`}
            >
              Active ({onlineFriends.length})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 rounded text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === "all" ? "bg-[#35373c] text-white" : "text-gray-400 hover:text-gray-200 hover:bg-[#35373c]/30"
              }`}
            >
              All Partners
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === "pending" ? "bg-[#35373c] text-white animate-pulse" : "text-gray-400 hover:text-gray-200 hover:bg-[#35373c]/30"
              }`}
            >
              Pending
              {pendingRequests.length > 0 && (
                <span className="bg-[#f23f43] text-white font-black text-[10px] px-1.5 py-0.2 rounded-full leading-normal">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab("add_partner")}
              className={`px-2.5 py-1 rounded text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === "add_partner"
                  ? "bg-emerald-600 text-white"
                  : "bg-indigo-600/95 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Friend
            </button>
          </nav>
        </div>

        {/* Support & Privileges Right Side Link */}
        <button
          onClick={() => setActiveTab("perks_support")}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-extrabold tracking-tight transition cursor-pointer ${
            activeTab === "perks_support"
              ? "bg-[#fac132]/10 border-[#fac132]/30 text-[#fac132]"
              : "bg-[#161a22] border-indigo-500/10 text-indigo-400 hover:border-indigo-500/30"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          VIP Hotline & Perks
        </button>
      </div>

      {/* 2. MAIN SCROLLABLE CONTENT AND PRESENCE BOARD CONTAINER */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* LEFT AREA: MAIN TAB PANEL */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">

          {/* PRESENCE CONTROLLER: Quick local user status selection (Always on top for high fidelity) */}
          <div className="bg-[#12151c] border border-[#222834]/40 rounded-xl p-3 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {profile?.avatarType === "url" && profile?.avatarVal ? (
                    <div className="w-10 h-10 rounded-full border border-indigo-500/30 overflow-hidden flex items-center justify-center bg-[#08090A]">
                      <img
                        src={profile.avatarVal}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black bg-${profile?.avatarColor || "indigo"}-500/10 border border-${profile?.avatarColor || "indigo"}-500/30 text-${profile?.avatarColor || "indigo"}-400`}>
                      {profile?.avatarVal || "🐂"}
                    </div>
                  )}
                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#12151c] ${getPresenceIndicatorColor(myPresence)}`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-white">{profile?.username || "Your Node"}</span>
                    <span className="text-[10px] text-gray-500 uppercase font-mono font-bold tracking-wider">Local Terminal</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 rounded border border-indigo-500/20 uppercase font-bold">
                      {getPresenceLabel(myPresence)}
                    </span>
                    <span className="text-xs text-gray-400 truncate max-w-[150px] sm:max-w-[300px]" title="Your current custom message">
                      "{myCustomStatus}"
                    </span>
                  </div>
                </div>
              </div>

              {/* Status selectors */}
              <div className="w-full sm:w-auto flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0 border-t border-[#222834]/40 sm:border-0">
                <button
                  onClick={() => handleUpdatePresenceAndStatus("active", myCustomStatus)}
                  disabled={isUpdatingOwnPresence}
                  className={`p-1.5 rounded-lg border transition text-xs flex items-center gap-1 cursor-pointer ${
                    myPresence === "active" ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400" : "bg-transparent border-gray-800 text-gray-500 hover:text-gray-300"
                  }`}
                  title="Active Desk - Ready to Trade"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold">Active</span>
                </button>
                <button
                  onClick={() => handleUpdatePresenceAndStatus("idle", myCustomStatus)}
                  disabled={isUpdatingOwnPresence}
                  className={`p-1.5 rounded-lg border transition text-xs flex items-center gap-1 cursor-pointer ${
                    myPresence === "idle" ? "bg-amber-950/20 border-amber-500/30 text-amber-400" : "bg-transparent border-gray-800 text-gray-500 hover:text-gray-300"
                  }`}
                  title="AFK - Analyzing Charts"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-bold">AFK</span>
                </button>
                <button
                  onClick={() => handleUpdatePresenceAndStatus("dnd", myCustomStatus)}
                  disabled={isUpdatingOwnPresence}
                  className={`p-1.5 rounded-lg border transition text-xs flex items-center gap-1 cursor-pointer ${
                    myPresence === "dnd" ? "bg-rose-950/20 border-rose-500/30 text-rose-400" : "bg-transparent border-gray-800 text-gray-500 hover:text-gray-300"
                  }`}
                  title="DND - Lockout Session"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-bold">DND</span>
                </button>
                <button
                  onClick={() => handleUpdatePresenceAndStatus("offline", myCustomStatus)}
                  disabled={isUpdatingOwnPresence}
                  className={`p-1.5 rounded-lg border transition text-xs flex items-center gap-1 cursor-pointer ${
                    myPresence === "offline" ? "bg-gray-950/20 border-gray-500/30 text-gray-400" : "bg-transparent border-gray-800 text-gray-500 hover:text-gray-300"
                  }`}
                  title="Invisible - Offline Mode"
                >
                  <span className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-[10px] font-bold">Invisible</span>
                </button>
              </div>
            </div>

            {/* Custom status quick-input */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                placeholder="Broadcast a custom market status message..."
                value={myCustomStatus}
                onChange={(e) => setMyCustomStatus(e.target.value)}
                onBlur={() => handleUpdatePresenceAndStatus(myPresence, myCustomStatus)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUpdatePresenceAndStatus(myPresence, myCustomStatus);
                  }
                }}
                className="flex-1 bg-[#090b0e] border border-dark-border/20 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-indigo-500 transition placeholder:text-gray-700"
              />
              <span className="text-[9px] text-gray-600 uppercase font-mono font-bold shrink-0">Press Enter</span>
            </div>
          </div>

          {/* 3. CONDITIONAL TABS RENDERING */}
          {(activeTab === "online" || activeTab === "all") && (
            <div className="space-y-4">
              
              {/* Discord Search Bar */}
              <div className="relative shrink-0">
                <input
                  type="text"
                  placeholder="Search co-traders or active statuses..."
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  className="w-full bg-[#12151c] border border-dark-border/10 rounded-xl py-2 px-3 pl-10 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition placeholder:text-gray-600"
                />
                <Search className="w-4 h-4 text-gray-600 absolute left-3 top-2.5" />
                {friendSearchQuery && (
                  <button
                    onClick={() => setFriendSearchQuery("")}
                    className="absolute right-3 top-2 text-gray-500 hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* LIST BODY */}
              <div className="space-y-6">
                
                {/* ACTIVE CATEGORY */}
                {activeTab === "online" && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider px-1">
                      Active Presence — {onlineFriends.length}
                    </div>
                    
                    {onlineFriends.length === 0 ? (
                      <div className="p-8 text-center bg-[#0d0e11]/40 border border-[#212329]/30 rounded-xl">
                        <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 font-semibold">No active co-traders online.</p>
                        <p className="text-[10px] text-gray-600 mt-1">Add friends or invite them to share your node stream.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {onlineFriends.map((f) => (
                          <div
                            key={f.friendshipId}
                            className="p-3 bg-[#11141b]/70 hover:bg-[#181d26] border border-[#202530]/40 rounded-xl flex items-center justify-between gap-3 transition-colors duration-100 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Avatar with absolute status badge */}
                              <div className="relative shrink-0 select-none">
                                {f.avatarType === "url" && f.avatarVal ? (
                                  <div className="w-10 h-10 rounded-full border border-[#202530]/40 overflow-hidden flex items-center justify-center bg-[#08090A]">
                                    <img
                                      src={f.avatarVal}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                ) : (
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-black bg-${f.avatarColor}-500/10 border border-${f.avatarColor}-500/30 text-${f.avatarColor}-400`}>
                                    {f.avatarVal || "📈"}
                                  </div>
                                )}
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#11141b] group-hover:border-[#181d26] transition ${getPresenceIndicatorColor(f.marketPresence)}`} />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-white hover:text-indigo-400 transition truncate">{f.username}</span>
                                  {f.subscriptionTier === "premium" && (
                                    <Crown className="w-3.5 h-3.5 text-indigo-400" title="Premium Workspace" />
                                  )}
                                  {f.activeGroupId && (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono font-bold">
                                      Desk Active
                                    </span>
                                  )}
                                </div>
                                
                                {/* Status description */}
                                <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                  <span className="font-medium text-gray-400">{f.customStatus || "Analyzing Markets"}</span>
                                  {f.activeGroupId && (
                                    <span className="text-gray-600 text-[10px] font-mono"> • Desk: {f.activeGroupId}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action elements */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Jump desk button */}
                              {f.activeGroupId && (
                                <button
                                  onClick={() => handleJoinFriendDesk(f.activeGroupId, f.username)}
                                  className="p-2 bg-[#202530] hover:bg-indigo-600 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title={`Jump onto ${f.username}'s active workspace desk`}
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* More action indicator toggle */}
                              <div className="relative">
                                <button
                                  onClick={() => setActiveMenuFriendId(activeMenuFriendId === f.friendshipId ? null : f.friendshipId)}
                                  className="p-2 hover:bg-[#202530] text-gray-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Connection options"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {/* Inline delete dialog dropdown */}
                                {activeMenuFriendId === f.friendshipId && (
                                  <div className="absolute right-0 top-10 w-44 bg-[#181a1f] border border-[#2b303b] rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                      onClick={() => handleRemoveFriendship(f.friendshipId, f.username)}
                                      className="w-full text-left px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 font-bold cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Terminate Node Link
                                    </button>
                                    <button
                                      onClick={() => setActiveMenuFriendId(null)}
                                      className="w-full text-left px-3 py-1.5 text-[10px] text-gray-400 hover:bg-[#252a35] font-semibold cursor-pointer"
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ALL / OFFLINE CATEGORY */}
                {activeTab === "all" && (
                  <div className="space-y-4">
                    
                    {/* ALL ACTIVE */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider px-1">
                        Active Co-Traders ({onlineFriends.length})
                      </div>
                      
                      {onlineFriends.map((f) => (
                        <div
                          key={f.friendshipId}
                          className="p-3 bg-[#11141b]/70 hover:bg-[#181d26] border border-[#202530]/40 rounded-xl flex items-center justify-between gap-3 transition-colors duration-100 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0 select-none">
                              {f.avatarType === "url" && f.avatarVal ? (
                                <div className="w-10 h-10 rounded-full border border-[#202530]/40 overflow-hidden flex items-center justify-center bg-[#08090A]">
                                  <img
                                    src={f.avatarVal}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ) : (
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-black bg-${f.avatarColor}-500/10 border border-${f.avatarColor}-500/30 text-${f.avatarColor}-400`}>
                                  {f.avatarVal || "🐂"}
                                </div>
                              )}
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#11141b] group-hover:border-[#181d26] transition ${getPresenceIndicatorColor(f.marketPresence)}`} />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-white truncate">{f.username}</span>
                                {f.subscriptionTier === "premium" && (
                                  <Crown className="w-3.5 h-3.5 text-indigo-400" />
                                )}
                              </div>
                              <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                "{f.customStatus || "Analyzing Markets"}"
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {f.activeGroupId && (
                              <button
                                onClick={() => handleJoinFriendDesk(f.activeGroupId, f.username)}
                                className="p-2 bg-[#202530] hover:bg-indigo-600 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title="Jump Desk"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveFriendship(f.friendshipId, f.username)}
                              className="p-2 hover:bg-rose-950/20 text-gray-500 hover:text-rose-400 border border-transparent hover:border-rose-500/10 rounded-lg transition cursor-pointer"
                              title="Delete Friend"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* OFFLINE */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider px-1">
                        Offline / Invisible ({offlineFriends.length})
                      </div>

                      {offlineFriends.length === 0 ? (
                        <p className="text-[10px] text-gray-600 italic px-1">No offline co-traders.</p>
                      ) : (
                        <div className="space-y-1">
                          {offlineFriends.map((f) => (
                            <div
                              key={f.friendshipId}
                              className="p-3 bg-[#11141b]/40 hover:bg-[#181d26]/60 border border-transparent rounded-xl flex items-center justify-between gap-3 transition-colors duration-100 opacity-60 hover:opacity-100"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0 select-none">
                                  {f.avatarType === "url" && f.avatarVal ? (
                                    <div className="w-10 h-10 rounded-full border border-gray-800 overflow-hidden flex items-center justify-center bg-[#08090A]">
                                      <img
                                        src={f.avatarVal}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  ) : (
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-black bg-gray-900 border border-gray-800 text-gray-500`}>
                                      {f.avatarVal || "🐂"}
                                    </div>
                                  )}
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#11141b] bg-gray-700`} />
                                </div>

                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-gray-400 truncate block">{f.username}</span>
                                  <span className="text-[10px] text-gray-600 truncate block">Offline node</span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleRemoveFriendship(f.friendshipId, f.username)}
                                className="p-2 hover:bg-rose-950/20 text-gray-600 hover:text-rose-400 rounded-lg transition cursor-pointer"
                                title="Remove connection"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}

              </div>
            </div>
          )}

          {/* PENDING TAB */}
          {activeTab === "pending" && (
            <div className="space-y-4">
              <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider px-1">
                Awaiting Connection Confirmation ({pendingRequests.length})
              </div>

              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 bg-[#0d0e11]/40 border border-[#212329]/30 rounded-2xl">
                  <Clock className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-semibold">No pending requests at this interval.</p>
                  <p className="text-[10px] text-gray-600 mt-1">All synchronization pipelines are fully active and resolved.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingRequests.map((r) => (
                    <div
                      key={r.friendshipId}
                      className="p-3 bg-[#11141b] border border-dark-border/10 rounded-xl flex items-center justify-between gap-3 shadow-md"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {r.avatarType === "url" && r.avatarVal ? (
                          <div className="w-9 h-9 rounded-xl border border-indigo-500/30 overflow-hidden flex items-center justify-center bg-[#08090A] shrink-0">
                            <img
                              src={r.avatarVal}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black bg-${r.avatarColor}-500/10 border border-${r.avatarColor}-500/30 text-${r.avatarColor}-400 shrink-0`}>
                            {r.avatarVal || "🐂"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-xs font-black text-white truncate block">{r.username}</span>
                          <span className="text-[10px] text-indigo-400/80 uppercase font-mono font-bold tracking-wider">
                            {r.isIncoming ? "Inbound Sync" : "Outbound Sync"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {r.isIncoming ? (
                          <>
                            <button
                              onClick={() => handleAcceptRequest(r.friendshipId, r.username)}
                              className="p-1.5 bg-emerald-950/20 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white rounded-lg transition cursor-pointer"
                              title="Accept Invitation"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveFriendship(r.friendshipId, r.username)}
                              className="p-1.5 bg-rose-950/25 hover:bg-rose-600 border border-rose-500/20 text-rose-400 hover:text-white rounded-lg transition cursor-pointer"
                              title="Decline Request"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleRemoveFriendship(r.friendshipId, r.username)}
                            className="px-2.5 py-1.5 bg-[#1a1f29] hover:bg-rose-950/20 text-gray-400 hover:text-rose-400 border border-gray-800 hover:border-rose-500/20 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition cursor-pointer"
                            title="Cancel Request"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADD PARTNER FORM TAB */}
          {activeTab === "add_partner" && (
            <div className="space-y-6">
              <div className="bg-[#12151c] border border-dark-border/20 rounded-2xl p-5 md:p-6 shadow-2xl">
                <form onSubmit={handleAddFriend} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest">Co-Trader Nickname</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={searchUsername}
                        onChange={(e) => setSearchUsername(e.target.value)}
                        placeholder="Enter peer's nickname exactly (e.g., Satoshi)"
                        className="w-full bg-[#090b0e] border border-dark-border/20 rounded-xl py-3 px-4 pl-10 text-xs text-white focus:outline-none focus:border-indigo-500 transition font-mono placeholder:text-gray-700"
                      />
                      <Search className="w-4 h-4 text-gray-600 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSearching || !searchUsername.trim()}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-900 disabled:border-gray-800 disabled:text-gray-700 border border-indigo-500/30 text-white rounded-xl text-xs font-black uppercase tracking-widest transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10"
                  >
                    {isSearching ? "Searching Network Node..." : "Add friend"}
                  </button>
                </form>
              </div>

              {/* Perks grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#12151c]/60 border border-dark-border/15 rounded-xl p-4 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    🟢
                  </div>
                  <h5 className="text-xs font-bold text-white">Live Desk Status</h5>
                  <p className="text-[11px] text-gray-500 leading-relaxed">Know immediately when co-traders are online, AFK, or deep inside position checkouts.</p>
                </div>

                <div className="bg-[#12151c]/60 border border-dark-border/15 rounded-xl p-4 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                    🚀
                  </div>
                  <h5 className="text-xs font-bold text-white">Instant Desk-Hopping</h5>
                  <p className="text-[11px] text-gray-500 leading-relaxed">Jump onto friend circles' voice channels or workspace rooms directly with one click.</p>
                </div>

                <div className="bg-[#12151c]/60 border border-dark-border/15 rounded-xl p-4 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                    👑
                  </div>
                  <h5 className="text-xs font-bold text-white">Shared Alpha</h5>
                  <p className="text-[11px] text-gray-500 leading-relaxed">Publish and stream ledger updates, rules, checklists, and active position metrics safely.</p>
                </div>
              </div>
            </div>
          )}

          {/* VIP HOTLINE & PERKS TAB */}
          {activeTab === "perks_support" && (
            <div className="space-y-6">
              
              {/* Subscription Tiers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Free Tier */}
                <div className={`border rounded-2xl p-5 md:p-6 shadow-2xl relative flex flex-col justify-between overflow-hidden transition-all duration-300 ${
                  !isPremium
                    ? "bg-[#12151c] border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/30"
                    : "bg-[#0c0d10]/80 border-dark-border/20 opacity-70"
                }`}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Standard Tier</span>
                        <h3 className="text-base font-black text-white mt-1">Free Sandbox Access</h3>
                      </div>
                      {!isPremium && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                          Active Status
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 font-mono">
                      <div className="text-2xl font-black text-white">$0.00</div>
                      <div className="text-[10px] text-gray-500">Essential co-trader limits</div>
                    </div>

                    <div className="border-t border-[#1e2229] pt-4 space-y-3">
                      <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">Privileges Included:</h5>
                      <ul className="space-y-2 text-[11px] text-gray-400">
                        <li className="flex gap-2 items-center text-gray-500">
                          <Check className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>1 Concurrent Workspace Desk node</span>
                        </li>
                        <li className="flex gap-2 items-center text-gray-500">
                          <Check className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>Basic Co-Trader Friends & text chats</span>
                        </li>
                        <li className="flex gap-2 items-center text-gray-500">
                          <Check className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>Standard P&L logging limits</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Premium Tier */}
                <div className={`border rounded-2xl p-5 md:p-6 shadow-2xl relative flex flex-col justify-between overflow-hidden transition-all duration-300 ${
                  isPremium
                    ? "bg-[#12151c] border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/30"
                    : "bg-[#0c0d10]/80 border-dark-border/20"
                }`}>
                  {isPremium && (
                    <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Active Premium
                    </div>
                  )}
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-bold">Full-Access Tier</span>
                        <h3 className="text-base font-black text-white mt-1">SyncPL Premium Workspace</h3>
                      </div>
                    </div>

                    <div className="space-y-1 font-mono">
                      <div className="text-2xl font-black text-white">$25.00<span className="text-xs text-gray-500"> /mo</span></div>
                      <div className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> 3-Day Free Trial Included!
                      </div>
                    </div>

                    <div className="border-t border-[#1e2229] pt-4 space-y-3">
                      <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">Premium Perks Included:</h5>
                      <ul className="space-y-2 text-[11px] text-gray-400">
                        <li className="flex gap-2 items-center">
                          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>**Unlimited Workspace Desks** limits</span>
                        </li>
                        <li className="flex gap-2 items-center">
                          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Unlock **Smart Position Sizer** tool</span>
                        </li>
                        <li className="flex gap-2 items-center">
                          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Enable **Hard Rule Lockouts** checker</span>
                        </li>
                        <li className="flex gap-2 items-center">
                          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Dynamic Signal Feeds & custom metrics stream</span>
                        </li>
                        <li className="flex gap-2 items-center">
                          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Bespoke Custom Desk skins (Solar Gold & Neon Cyber)</span>
                        </li>
                        <li className="flex gap-2 items-center">
                          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Advanced Desk Attendance & peak attendance analytics</span>
                        </li>
                        <li className="flex gap-2 items-center">
                          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Priority VIP Support Hotline sub-minute Response</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Premium Exclusive VIP Hotline Support Console */}
              <div className="bg-[#12151c] border border-dark-border/20 rounded-2xl p-4 md:p-6 shadow-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Crown className="w-4 h-4 text-indigo-400 animate-pulse" />
                      Premium VIP Support Hotline
                    </h4>
                    <p className="text-xs text-gray-500">
                      Exclusive sub-minute response SLA. Submit technical, sync, or ledger inquiries directly to dispatch.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                      isPremium ? "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" : "text-gray-600 border-gray-800"
                    }`}>
                      {isPremium ? "Hotline Status: CONNECTED" : "Hotline Locked - Premium Tier Required"}
                    </span>
                  </div>
                </div>

                {isPremium ? (
                  <form onSubmit={handleSubmitSupportTicket} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest">Inquiry Subject</label>
                        <input
                          type="text"
                          required
                          value={supportSubject}
                          onChange={(e) => setSupportSubject(e.target.value)}
                          placeholder="e.g. High-frequency websocket stream latency"
                          className="w-full bg-[#090b0e] border border-dark-border/20 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition font-sans placeholder:text-gray-700"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest">Detail Description</label>
                      <textarea
                        required
                        rows={3}
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        placeholder="Provide full node metadata, transaction IDs, or logs to debug..."
                        className="w-full bg-[#090b0e] border border-dark-border/20 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition font-sans placeholder:text-gray-700"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingSupport}
                      className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 border border-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-widest transition cursor-pointer shadow-lg shadow-indigo-500/10"
                    >
                      {submittingSupport ? "Broadcasting Support Packet..." : "Submit Priority Hotline Ticket"}
                    </button>

                    {supportTicketResponse && (
                      <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 text-indigo-400 rounded-xl text-xs font-mono leading-relaxed animate-in fade-in duration-200">
                        {supportTicketResponse}
                      </div>
                    )}
                  </form>
                ) : (
                  <div className="p-8 bg-[#0c0d10]/40 border border-dashed border-gray-800 rounded-xl text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600 mx-auto">
                      <LifeBuoy className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">The sub-minute Hotline is exclusive to Premium members.</p>
                    <p className="text-[11px] text-gray-600">Upgrade your Workspace Desk subscription to unlock immediate institutional support lines.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT AREA: MINI DISCORD-LIKE ACTIVITY PANEL (Brings it all together beautifully) */}
        <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-[#1e2229] bg-[#0c0e12] p-4 flex flex-col justify-between shrink-0 select-none overflow-y-auto">
          <div className="space-y-4">
            <h5 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Active Desks Overview</h5>
            
            {/* Quick mini-status feed */}
            <div className="space-y-3">
              <div className="bg-[#12151c]/50 p-3 rounded-lg border border-[#222834]/20">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Sync Metrics</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="text-center bg-[#090b0e] p-1.5 rounded">
                    <span className="text-[8px] text-gray-500 block uppercase">Linked</span>
                    <span className="text-xs font-mono text-white font-black">{acceptedFriends.length}</span>
                  </div>
                  <div className="text-center bg-[#090b0e] p-1.5 rounded">
                    <span className="text-[8px] text-gray-500 block uppercase">Pending</span>
                    <span className="text-xs font-mono text-white font-black">{pendingRequests.length}</span>
                  </div>
                </div>
              </div>

              {/* Status information legends */}
              <div className="space-y-2 text-[10px] text-gray-500 font-medium px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Green Bull: Active on a desk</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Orange Moon: AFK / Offline</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Red Bear: DND deep trade lockout</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1e2229]/60 text-[9.5px] text-gray-600 leading-relaxed space-y-1 mt-6">
            <p className="font-semibold text-gray-500 uppercase tracking-wider text-[8.5px]">Node Authority Protocol</p>
            <p>Synchronization links are end-to-end securely isolated on your local Firestore database cluster.</p>
          </div>
        </div>

      </div>

    </div>
  );
}
