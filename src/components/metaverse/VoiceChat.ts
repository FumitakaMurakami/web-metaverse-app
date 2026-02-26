/**
 * WebRTC-based voice chat for Networked-A-Frame metaverse.
 * Uses the existing Socket.IO signaling server to relay
 * offer/answer/ICE candidate messages between peers.
 *
 * Connection flow:
 *  1. User clicks mic → enable() → getUserMedia + broadcast "voice-ready"
 *  2. Other peers with voice enabled receive "voice-ready"
 *  3. Tie-breaker (higher clientId) creates WebRTC offer
 *  4. Lower clientId replies with targeted "voice-ready" so the
 *     higher side knows to initiate
 *  5. Offer → Answer → ICE exchange → audio flows
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PeerState {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement | null;
}

export type VoiceChatState = {
  isEnabled: boolean;
  isMicMuted: boolean;
  isAudioMuted: boolean;
};

export class VoiceChat {
  private socket: any = null;
  private clientId: string = "";
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerState> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private _isMicMuted: boolean = false;
  private _isAudioMuted: boolean = false;
  private _isEnabled: boolean = false;
  private onStateChange: ((state: VoiceChatState) => void) | null = null;

  private readonly iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  get isMicMuted() {
    return this._isMicMuted;
  }
  get isAudioMuted() {
    return this._isAudioMuted;
  }
  get isEnabled() {
    return this._isEnabled;
  }

  /** Register callback for state changes */
  setOnStateChange(cb: (state: VoiceChatState) => void) {
    this.onStateChange = cb;
  }

  private emitState() {
    if (this.onStateChange) {
      this.onStateChange({
        isEnabled: this._isEnabled,
        isMicMuted: this._isMicMuted,
        isAudioMuted: this._isAudioMuted,
      });
    }
  }

  /**
   * Initialize voice chat with the NAF socket connection.
   * Must be called after NAF adapter is connected.
   */
  initialize(socket: any, clientId: string) {
    this.socket = socket;
    this.clientId = clientId;

    // Listen for WebRTC signaling messages relayed via the NAF socket
    socket.on("send", (msg: any) => {
      switch (msg.dataType) {
        case "voice-ready":
          this.handleVoiceReady(msg.from);
          break;
        case "voice-offer":
          if (this._isEnabled) this.handleOffer(msg.from, msg.data);
          break;
        case "voice-answer":
          if (this._isEnabled) this.handleAnswer(msg.from, msg.data);
          break;
        case "voice-ice":
          if (this._isEnabled) this.handleIce(msg.from, msg.data);
          break;
      }
    });

    // When occupants leave, clean up their peer connections
    socket.on("occupantsChanged", (data: any) => {
      if (!this._isEnabled) return;
      const currentIds = new Set<string>(Object.keys(data.occupants));
      for (const [id] of this.peers) {
        if (!currentIds.has(id)) {
          this.removePeer(id);
        }
      }
    });

    console.log("[VoiceChat] Initialized for client:", clientId);
  }

  /**
   * Handle "voice-ready" from a remote peer.
   * Both sides must have voice enabled for a connection to be created.
   */
  private handleVoiceReady(from: string) {
    if (!this._isEnabled) return;
    if (this.peers.has(from)) return; // Already connected

    if (this.clientId > from) {
      // We are the initiator (higher ID) — create offer
      this.createOffer(from);
    } else {
      // We are the responder — let the initiator know we're ready
      this.socket.emit("send", {
        target: from,
        dataType: "voice-ready",
        data: {},
      });
    }
  }

  /**
   * Enable voice chat — requests microphone permission and
   * broadcasts readiness to the room.
   */
  async enable(): Promise<boolean> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this._isEnabled = true;
      this._isMicMuted = false;
      this._isAudioMuted = false;
      this.emitState();

      // Broadcast "voice-ready" so peers with voice enabled can connect
      if (this.socket) {
        this.socket.emit("broadcast", {
          dataType: "voice-ready",
          data: {},
        });
      }

      console.log("[VoiceChat] Microphone enabled, broadcast voice-ready");
      return true;
    } catch (err) {
      console.error("[VoiceChat] Microphone access failed:", err);
      return false;
    }
  }

  /** Toggle microphone (outgoing audio) mute. Returns the new muted state. */
  toggleMicMute(): boolean {
    if (!this.localStream) return true;
    this._isMicMuted = !this._isMicMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this._isMicMuted;
    });
    this.emitState();
    console.log("[VoiceChat] Mic mute:", this._isMicMuted);
    return this._isMicMuted;
  }

  /** Toggle speaker (incoming audio) mute. Returns the new muted state. */
  toggleAudioMute(): boolean {
    this._isAudioMuted = !this._isAudioMuted;
    for (const [, peer] of this.peers) {
      if (peer.audio) {
        peer.audio.muted = this._isAudioMuted;
      }
    }
    this.emitState();
    console.log("[VoiceChat] Audio mute:", this._isAudioMuted);
    return this._isAudioMuted;
  }

  // ---- WebRTC Peer Connection Management ----

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // Add local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Send ICE candidates to the remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit("send", {
          target: peerId,
          dataType: "voice-ice",
          data: event.candidate.toJSON(),
        });
      }
    };

    // Play remote audio when track arrives
    pc.ontrack = (event) => {
      const audio = document.createElement("audio");
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      audio.muted = this._isAudioMuted;

      const existing = this.peers.get(peerId);
      if (existing) {
        // Clean up previous audio element if any
        if (existing.audio) {
          existing.audio.pause();
          existing.audio.srcObject = null;
        }
        existing.audio = audio;
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        console.log(
          `[VoiceChat] Peer ${peerId} connection ${pc.connectionState}`
        );
        this.removePeer(peerId);
      }
    };

    this.peers.set(peerId, { pc, audio: null });
    return pc;
  }

  private async createOffer(peerId: string) {
    // Remove any stale connection first
    if (this.peers.has(peerId)) {
      this.removePeer(peerId);
    }

    const pc = this.createPeerConnection(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.socket.emit("send", {
        target: peerId,
        dataType: "voice-offer",
        data: { sdp: offer.sdp, type: offer.type },
      });
      console.log(`[VoiceChat] Sent offer to ${peerId}`);
    } catch (err) {
      console.error("[VoiceChat] Failed to create offer:", err);
      this.removePeer(peerId);
    }
  }

  private async handleOffer(from: string, data: any) {
    // Clean up any existing connection to this peer
    if (this.peers.has(from)) {
      this.removePeer(from);
    }

    const pc = this.createPeerConnection(from);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data));

      // Apply any queued ICE candidates
      const pending = this.pendingCandidates.get(from);
      if (pending) {
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this.pendingCandidates.delete(from);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit("send", {
        target: from,
        dataType: "voice-answer",
        data: { sdp: answer.sdp, type: answer.type },
      });
      console.log(`[VoiceChat] Sent answer to ${from}`);
    } catch (err) {
      console.error("[VoiceChat] Failed to handle offer:", err);
      this.removePeer(from);
    }
  }

  private async handleAnswer(from: string, data: any) {
    const peer = this.peers.get(from);
    if (!peer) return;
    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(data));

      // Apply queued ICE candidates
      const pending = this.pendingCandidates.get(from);
      if (pending) {
        for (const candidate of pending) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this.pendingCandidates.delete(from);
      }
      console.log(`[VoiceChat] Connection established with ${from}`);
    } catch (err) {
      console.error("[VoiceChat] Failed to handle answer:", err);
    }
  }

  private async handleIce(from: string, data: any) {
    const peer = this.peers.get(from);
    if (peer && peer.pc.remoteDescription) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (err) {
        console.error("[VoiceChat] Failed to add ICE candidate:", err);
      }
    } else {
      // Queue for later (remote description not set yet)
      if (!this.pendingCandidates.has(from)) {
        this.pendingCandidates.set(from, []);
      }
      this.pendingCandidates.get(from)!.push(data);
    }
  }

  private removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.pc.close();
      if (peer.audio) {
        peer.audio.pause();
        peer.audio.srcObject = null;
      }
      this.peers.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
  }

  /** Disable voice chat and clean up all connections */
  disable() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    for (const [id] of this.peers) {
      this.removePeer(id);
    }
    this.peers.clear();
    this.pendingCandidates.clear();

    this._isEnabled = false;
    this._isMicMuted = true;
    this._isAudioMuted = false;
    this.emitState();
    console.log("[VoiceChat] Disabled");
  }
}
