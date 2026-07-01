import React, { useState } from "react";
import { TrendingUp, User, LogIn, UserPlus, Plus } from "lucide-react";

const renderError = (err: string) => {
  if (!err) return null;
  const lowercase = err.toLowerCase();
  
  if (
    lowercase.includes("operation-not-allowed") ||
    lowercase.includes("error-code:-26") ||
    lowercase.includes("error-code:26") ||
    lowercase.includes("auth/operation-not-allowed")
  ) {
    return (
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-left space-y-2">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
          Authentication Provider Disabled
        </div>
        <p className="text-[10px] text-gray-300 leading-relaxed">
          The <strong>Email/Password</strong> provider is not enabled in your Firebase project. To enable it:
        </p>
        <ol className="list-decimal list-inside text-[10px] text-gray-400 space-y-1 pl-1">
          <li>Go to your <strong>Firebase Console</strong>.</li>
          <li>Click <strong>Authentication</strong> under Build in the left sidebar.</li>
          <li>Go to the <strong>Sign-in method</strong> tab.</li>
          <li>Click <strong>Add new provider</strong> and choose <strong>Email/Password</strong>.</li>
          <li>Toggle it to <strong>Enabled</strong> and click <strong>Save</strong>.</li>
        </ol>
      </div>
    );
  }

  if (lowercase.includes("invalid-email")) {
    return (
      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-medium text-left">
        <strong>Invalid Email:</strong> Please enter a correctly formatted email address (e.g., trader@domain.com).
      </div>
    );
  }

  if (lowercase.includes("user-not-found")) {
    return (
      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-medium text-left">
        <strong>User Not Found:</strong> No registered account matches this email. Check spelling or Register a new account.
      </div>
    );
  }

  if (lowercase.includes("wrong-password") || lowercase.includes("invalid-credential")) {
    return (
      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-medium text-left">
        <strong>Credentials Incorrect:</strong> The email or password entered is invalid. Click "Forgot Password" to receive a reset link.
      </div>
    );
  }

  if (lowercase.includes("email-already-in-use")) {
    return (
      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-medium text-left">
        <strong>Email in Use:</strong> This email address is already registered. Please go to the "Log In" tab.
      </div>
    );
  }

  if (lowercase.includes("weak-password")) {
    return (
      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-medium text-left">
        <strong>Weak Password:</strong> Your password must be at least 6 characters long for security.
      </div>
    );
  }

  if (lowercase.includes("too-many-requests")) {
    return (
      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-medium text-left">
        <strong>Too Many Requests:</strong> This account has been temporarily blocked due to multiple failed login attempts. Please try again later.
      </div>
    );
  }

  return (
    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-medium text-left break-words">
      {err}
    </div>
  );
};

interface OnboardingViewProps {
  onGuestAuth: (username: string) => Promise<void>;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailRegister: (username: string, email: string, pass: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  onCreateRoom: () => Promise<void>;
  isAuthenticated: boolean;
}

export default function OnboardingView({
  onGuestAuth,
  onEmailLogin,
  onEmailRegister,
  onPasswordReset,
  onJoinRoom,
  onCreateRoom,
  isAuthenticated,
}: OnboardingViewProps) {
  const [activeTab, setActiveTab] = useState<"guest" | "login" | "register" | "forgot">("guest");
  const [guestName, setGuestName] = useState("Trader");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPass, setRegisterPass] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    try {
      await onGuestAuth(guestName.trim() || "Trader");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to enter as guest");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    try {
      await onEmailLogin(loginEmail, loginPass);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    try {
      await onEmailRegister(registerName, registerEmail, registerPass);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setIsLoading(true);
    setErrorMsg("");
    setResetSuccess(false);
    try {
      await onPasswordReset(resetEmail.trim());
      setResetSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      await onJoinRoom(roomCode);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not find or join room");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F1113] z-40 flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full ambient-glow-1 z-0"></div>
      <div className="absolute bottom-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full ambient-glow-2 z-0"></div>

      <div className="glass-panel p-6 rounded max-w-sm w-full relative z-10 space-y-4 text-center shadow-2xl border border-[#2A2D31] bg-[#1E2023]">
        <div className="flex flex-col items-center space-y-2">
          <div className="p-3.5 bg-[#5865F2] rounded text-white shadow-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tight text-white">
              SyncPL
            </h1>
            <p className="text-[9px] text-[#8E9297] font-bold tracking-wider uppercase mt-0.5">
              Institutional Multi-Device Sync
            </p>
          </div>
        </div>

        {renderError(errorMsg)}

        {!isAuthenticated ? (
          <>
            <div className="flex rounded bg-[#08090A] p-1 border border-[#2A2D31]">
              <button
                onClick={() => setActiveTab("guest")}
                className={`flex-grow py-1.5 rounded text-xs font-bold transition ${
                  activeTab === "guest"
                    ? "text-[#5865F2] bg-[#5865F2]/10"
                    : "text-[#8E9297] hover:text-white"
                }`}
              >
                Guest Access
              </button>
              <button
                onClick={() => setActiveTab("login")}
                className={`flex-grow py-1.5 rounded text-xs font-bold transition ${
                  activeTab === "login"
                    ? "text-[#5865F2] bg-[#5865F2]/10"
                    : "text-[#8E9297] hover:text-white"
                }`}
              >
                Log In
              </button>
              <button
                onClick={() => setActiveTab("register")}
                className={`flex-grow py-1.5 rounded text-xs font-bold transition ${
                  activeTab === "register"
                    ? "text-[#5865F2] bg-[#5865F2]/10"
                    : "text-[#8E9297] hover:text-white"
                }`}
              >
                Register
              </button>
            </div>

            {activeTab === "guest" && (
              <form onSubmit={handleGuestSubmit} className="space-y-3.5 text-left">
                <p className="text-[11px] text-[#8E9297] leading-relaxed text-center">
                  Access instantly as a temporary Guest. Register to persist ledger records permanently.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-[#8E9297] uppercase tracking-wider">
                    Trader Nickname
                  </label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-[#08090A] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2.5 px-3 rounded shadow flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-50"
                >
                  <User className="w-4 h-4" />
                  <span>{isLoading ? "Connecting..." : "Enter as Guest"}</span>
                </button>
              </form>
            )}

            {activeTab === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-left">
                <p className="text-[11px] text-[#8E9297] leading-relaxed text-center">
                  Sign in with your SyncPL credentials to access your permanent trading workspaces.
                </p>
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[9px] font-bold text-[#8E9297] uppercase mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@domain.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-[#08090A] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[#8E9297] uppercase mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      className="w-full bg-[#08090A] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg("");
                          setResetSuccess(false);
                          setResetEmail(loginEmail);
                          setActiveTab("forgot");
                        }}
                        className="text-[10px] text-[#8E9297] hover:text-[#5865F2] transition font-bold"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2.5 px-3 rounded shadow flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isLoading ? "Authenticating..." : "Log In to Workspace"}</span>
                </button>
              </form>
            )}

            {activeTab === "forgot" && (
              <form onSubmit={handleResetSubmit} className="space-y-3.5 text-left">
                <p className="text-[11px] text-[#8E9297] leading-relaxed text-center">
                  Enter your email address and we will send you a secure, free link to choose a new password.
                </p>
                
                {resetSuccess ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-[11px] text-emerald-400 font-semibold text-center space-y-1.5">
                    <p>Password reset link has been dispatched!</p>
                    <p className="font-medium text-[#8E9297] text-[10px]">Please check your email inbox and spam folder.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-[#8E9297] uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@domain.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-[#08090A] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || resetSuccess}
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2.5 px-3 rounded shadow flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-50"
                >
                  <span>{isLoading ? "Sending link..." : "Send Reset Link"}</span>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg("");
                      setResetSuccess(false);
                      setActiveTab("login");
                    }}
                    className="text-[10px] text-[#8E9297] hover:text-white transition font-bold uppercase tracking-wider underline underline-offset-2"
                  >
                    Back to Log In
                  </button>
                </div>
              </form>
            )}

            {activeTab === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-left">
                <p className="text-[11px] text-[#8E9297] leading-relaxed text-center">
                  Create a permanent account to protect your synced dashboards and logs.
                </p>
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[9px] font-bold text-[#8E9297] uppercase mb-1">
                      Trader Nickname
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="TradingAlias"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full bg-[#08090A] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[#8E9297] uppercase mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@domain.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full bg-[#08090A] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[#8E9297] uppercase mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 6 characters"
                      value={registerPass}
                      onChange={(e) => setRegisterPass(e.target.value)}
                      className="w-full bg-[#08090A] border border-[#2A2D31] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#5865F2] font-semibold"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-2.5 px-3 rounded shadow flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isLoading ? "Creating..." : "Register Account"}</span>
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="pt-1 space-y-3">
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#2A2D31]"></div>
              <span className="flex-shrink mx-3 text-gray-500 text-[9px] font-bold uppercase tracking-wider">
                Sync Room Connection
              </span>
              <div className="flex-grow border-t border-[#2A2D31]"></div>
            </div>

            <div className="space-y-3">
              <button
                onClick={onCreateRoom}
                disabled={isLoading}
                className="w-full bg-[#1E2023] border border-[#2A2D31] hover:bg-[#24272C] text-[#5865F2] font-bold text-xs py-2.5 px-3 rounded transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Establish New Sync Room</span>
              </button>

              <form onSubmit={handleJoinSubmit} className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="PL-XXXX"
                  required
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="bg-[#08090A] border border-[#2A2D31] rounded px-3 py-2.5 text-xs text-white uppercase font-bold tracking-widest focus:outline-none focus:ring-1 focus:ring-[#5865F2] flex-grow text-center font-mono"
                />
                <button
                  type="submit"
                  disabled={isLoading || !roomCode.trim()}
                  className="bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white font-bold text-xs px-4 rounded transition"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
