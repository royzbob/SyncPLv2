import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.services.mozilla.com" },
  ],
};

export interface WebRtcVoiceConfig {
  myUid: string;
  groupId: string;
  channelName: string;
  selectedMicId?: string;
  isMuted: boolean;
  isDeafened: boolean;
  isMutedAll: boolean;
  globalVolume: number; // 0..100
  inputVolume?: number; // 0..100
  mutedUsers: string[];
  userVolumes: Record<string, number>; // uid -> 0..100
  onError?: (err: any) => void;
}

export class WebRtcVoiceManager {
  private myUid: string;
  private groupId: string;
  private channelName: string;
  private selectedMicId?: string;
  private isMuted: boolean;
  private isDeafened: boolean;
  private isMutedAll: boolean;
  private globalVolume: number;
  private inputVolume: number;
  private mutedUsers: string[];
  private userVolumes: Record<string, number>;
  private onError?: (err: any) => void;

  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private unsubSignals: (() => void) | null = null;
  private unsubUsers: (() => void) | null = null;
  private isDestroyed: boolean = false;

  constructor(config: WebRtcVoiceConfig) {
    this.myUid = config.myUid;
    this.groupId = config.groupId;
    this.channelName = config.channelName;
    this.selectedMicId = config.selectedMicId;
    this.isMuted = config.isMuted;
    this.isDeafened = config.isDeafened;
    this.isMutedAll = config.isMutedAll;
    this.globalVolume = config.globalVolume;
    this.inputVolume = config.inputVolume ?? 80;
    this.mutedUsers = config.mutedUsers;
    this.userVolumes = config.userVolumes;
    this.onError = config.onError;
  }

  public async start() {
    try {
      // 1. Request microphone audio stream with requested hardware deviceId if present
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
      };

      if (this.selectedMicId) {
        (audioConstraints as any).deviceId = { exact: this.selectedMicId };
      }

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (e) {
        console.warn("[WebRTC] Precise mic deviceId not available or disconnected, falling back to default mic:", e);
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      // Apply initial mute state
      this.setMuted(this.isMuted);

      // 2. Listen to signaling messages for WebRTC peer offers/answers/ICE
      this.listenToSignaling();

      // 3. Listen to active voice users in the channel
      this.listenToVoiceUsers();
    } catch (err) {
      console.error("[WebRTC] Failed capturing local microphone:", err);
      if (this.onError) this.onError(err);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public updateAudioSettings(
    isDeafened: boolean,
    isMutedAll: boolean,
    globalVolume: number,
    mutedUsers: string[],
    userVolumes: Record<string, number>,
    inputVolume?: number,
    selectedMicId?: string
  ) {
    this.isDeafened = isDeafened;
    this.isMutedAll = isMutedAll;
    this.globalVolume = globalVolume;
    this.mutedUsers = mutedUsers;
    this.userVolumes = userVolumes;
    if (typeof inputVolume === "number") this.inputVolume = inputVolume;

    // If hardware mic changed while active, update input stream
    if (selectedMicId !== undefined && selectedMicId !== this.selectedMicId) {
      this.selectedMicId = selectedMicId;
      this.restartLocalMicStream();
    }

    this.audioElements.forEach((audio, peerUid) => {
      this.applyAudioVolumeAndMute(peerUid, audio);
    });
  }

  private async restartLocalMicStream() {
    if (this.isDestroyed) return;
    try {
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
      }

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
      };
      if (this.selectedMicId) {
        (audioConstraints as any).deviceId = { exact: this.selectedMicId };
      }

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }

      this.setMuted(this.isMuted);

      // Replace audio tracks across existing peer connections
      const newAudioTrack = this.localStream.getAudioTracks()[0];
      if (newAudioTrack) {
        this.peerConnections.forEach((pc) => {
          const senders = pc.getSenders();
          const sender = senders.find((s) => s.track && s.track.kind === "audio");
          if (sender) {
            sender.replaceTrack(newAudioTrack).catch((err) => {
              console.warn("[WebRTC] Failed to replace track on sender:", err);
            });
          }
        });
      }
    } catch (err) {
      console.warn("[WebRTC] Could not restart mic stream with new device:", err);
    }
  }

  private applyAudioVolumeAndMute(peerUid: string, audio: HTMLAudioElement) {
    const isPeerMuted =
      this.isDeafened ||
      this.isMutedAll ||
      this.mutedUsers.includes(peerUid);

    audio.muted = isPeerMuted;

    const userVol = this.userVolumes[peerUid] ?? 100;
    const finalVol = (userVol / 100) * (this.globalVolume / 100);
    audio.volume = Math.max(0, Math.min(1, finalVol));
  }

  private listenToVoiceUsers() {
    const q = query(
      collection(db, "voice_users"),
      where("groupId", "==", this.groupId),
      where("channel", "==", this.channelName)
    );

    this.unsubUsers = onSnapshot(q, (snapshot) => {
      if (this.isDestroyed) return;

      const currentPeerUids = new Set<string>();

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const peerUid = data.id || data.userId || docSnap.id;
        if (peerUid && peerUid !== this.myUid) {
          currentPeerUids.add(peerUid);

          // Deterministic offer initiator:
          // Lower UID initiates offer to higher UID
          if (!this.peerConnections.has(peerUid) && this.myUid < peerUid) {
            this.initiateOffer(peerUid);
          }
        }
      });

      // Close connection for peers who left the voice channel
      this.peerConnections.forEach((_, peerUid) => {
        if (!currentPeerUids.has(peerUid)) {
          this.closePeer(peerUid);
        }
      });
    });
  }

  private createPeerConnection(peerUid: string): RTCPeerConnection {
    // If a connection already exists, close it cleanly first
    if (this.peerConnections.has(peerUid)) {
      this.closePeer(peerUid);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio track
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Send ICE candidates to Firestore signaling
    pc.onicecandidate = async (event) => {
      if (event.candidate && !this.isDestroyed) {
        try {
          await addDoc(collection(db, "voice_signals"), {
            from: this.myUid,
            to: peerUid,
            groupId: this.groupId,
            channel: this.channelName,
            type: "ice",
            candidate: event.candidate.toJSON(),
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn("[WebRTC] Error broadcasting ICE candidate:", err);
        }
      }
    };

    // Receive incoming remote audio track
    pc.ontrack = (event) => {
      if (this.isDestroyed) return;

      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      this.attachRemoteAudioStream(peerUid, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerUid} connection state: ${pc.connectionState}`);
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        // Retry connection if needed
        if (this.myUid < peerUid && !this.isDestroyed) {
          setTimeout(() => {
            if (!this.isDestroyed && this.peerConnections.has(peerUid)) {
              console.log(`[WebRTC] Retrying offer to ${peerUid}`);
              this.initiateOffer(peerUid);
            }
          }, 1500);
        }
      }
    };

    this.peerConnections.set(peerUid, pc);
    return pc;
  }

  private async initiateOffer(peerUid: string) {
    console.log(`[WebRTC] Creating offer for ${peerUid}`);
    const pc = this.createPeerConnection(peerUid);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);

      await addDoc(collection(db, "voice_signals"), {
        from: this.myUid,
        to: peerUid,
        groupId: this.groupId,
        channel: this.channelName,
        type: "offer",
        sdp: offer.sdp,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(`[WebRTC] Failed creating offer for ${peerUid}:`, err);
    }
  }

  private listenToSignaling() {
    const q = query(
      collection(db, "voice_signals"),
      where("to", "==", this.myUid),
      where("groupId", "==", this.groupId),
      where("channel", "==", this.channelName)
    );

    this.unsubSignals = onSnapshot(q, async (snapshot) => {
      if (this.isDestroyed) return;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const docRef = doc(db, "voice_signals", docSnap.id);
        const fromUid = data.from;

        if (!fromUid || fromUid === this.myUid) {
          deleteDoc(docRef).catch(() => {});
          continue;
        }

        try {
          if (data.type === "offer") {
            await this.handleOffer(fromUid, data.sdp);
            await deleteDoc(docRef);
          } else if (data.type === "answer") {
            await this.handleAnswer(fromUid, data.sdp);
            await deleteDoc(docRef);
          } else if (data.type === "ice" && data.candidate) {
            await this.handleIceCandidate(fromUid, data.candidate);
            await deleteDoc(docRef);
          }
        } catch (err) {
          console.warn(`[WebRTC] Error processing ${data.type} from ${fromUid}:`, err);
          deleteDoc(docRef).catch(() => {});
        }
      }
    });
  }

  private async handleOffer(fromUid: string, sdp: string) {
    console.log(`[WebRTC] Received offer from ${fromUid}`);
    let pc = this.peerConnections.get(fromUid);
    if (!pc || pc.signalingState !== "stable") {
      pc = this.createPeerConnection(fromUid);
    }

    await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
    await this.flushPendingCandidates(fromUid);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await addDoc(collection(db, "voice_signals"), {
      from: this.myUid,
      to: fromUid,
      groupId: this.groupId,
      channel: this.channelName,
      type: "answer",
      sdp: answer.sdp,
      createdAt: serverTimestamp(),
    });
  }

  private async handleAnswer(fromUid: string, sdp: string) {
    console.log(`[WebRTC] Received answer from ${fromUid}`);
    const pc = this.peerConnections.get(fromUid);
    if (pc && (pc.signalingState === "have-local-offer" || pc.signalingState !== "stable")) {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
      await this.flushPendingCandidates(fromUid);
    }
  }

  private async handleIceCandidate(fromUid: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(fromUid);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("[WebRTC] Error adding remote ICE candidate:", e);
      }
    } else {
      // Queue candidate if remote description isn't set yet
      const queue = this.pendingCandidates.get(fromUid) || [];
      queue.push(candidate);
      this.pendingCandidates.set(fromUid, queue);
    }
  }

  private async flushPendingCandidates(fromUid: string) {
    const pc = this.peerConnections.get(fromUid);
    const queue = this.pendingCandidates.get(fromUid);
    if (pc && pc.remoteDescription && pc.remoteDescription.type && queue && queue.length > 0) {
      console.log(`[WebRTC] Flushing ${queue.length} pending ICE candidates for ${fromUid}`);
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[WebRTC] Failed adding queued ICE candidate:", e);
        }
      }
      this.pendingCandidates.delete(fromUid);
    }
  }

  private attachRemoteAudioStream(peerUid: string, stream: MediaStream) {
    let audio = this.audioElements.get(peerUid);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
      audio.style.display = "none";
      audio.id = `remote-voice-${peerUid}`;
      document.body.appendChild(audio);
      this.audioElements.set(peerUid, audio);
    }

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }

    this.applyAudioVolumeAndMute(peerUid, audio);

    const attemptPlay = () => {
      if (!audio) return;
      audio.play().catch((err) => {
        console.warn(`[WebRTC] Audio autoPlay blocked for peer ${peerUid}:`, err);
        const unlock = () => {
          audio?.play().catch(() => {});
          window.removeEventListener("click", unlock);
          window.removeEventListener("pointerdown", unlock);
          window.removeEventListener("keydown", unlock);
        };
        window.addEventListener("click", unlock, { once: true });
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
      });
    };

    attemptPlay();
  }

  private closePeer(peerUid: string) {
    const pc = this.peerConnections.get(peerUid);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerUid);
    }

    this.pendingCandidates.delete(peerUid);

    const audio = this.audioElements.get(peerUid);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.audioElements.delete(peerUid);
    }
  }

  public destroy() {
    this.isDestroyed = true;

    if (this.unsubSignals) {
      this.unsubSignals();
      this.unsubSignals = null;
    }

    if (this.unsubUsers) {
      this.unsubUsers();
      this.unsubUsers = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.pendingCandidates.clear();

    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    this.audioElements.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }
}
