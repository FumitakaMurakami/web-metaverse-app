/**
 * Custom Socket.IO adapter for Networked-A-Frame.
 * Implements the full NAF NetworkAdapter interface.
 */
import { io, Socket } from "socket.io-client";

class SocketIoAdapter {
  app: string;
  room: string;
  clientId: string | null;
  socket: Socket | null;
  occupants: Record<string, boolean>;
  onOccupantsChanged:
    | ((occupants: Record<string, boolean>) => void)
    | null;
  onOccupantConnected: ((clientId: string) => void) | null;
  onOccupantDisconnected: ((clientId: string) => void) | null;
  serverUrl: string;
  private timeOffset: number;
  private connectSuccess: ((clientId: string) => void) | null;
  private connectFailure: ((error: Error) => void) | null;
  private onDataChannelMessage:
    | ((clientId: string, dataType: string, data: unknown) => void)
    | null;

  constructor() {
    this.app = "";
    this.room = "";
    this.clientId = null;
    this.socket = null;
    this.occupants = {};
    this.onOccupantsChanged = null;
    this.onOccupantConnected = null;
    this.onOccupantDisconnected = null;
    this.serverUrl = "";
    this.timeOffset = 0;
    this.connectSuccess = null;
    this.connectFailure = null;
    this.onDataChannelMessage = null;
  }

  setServerUrl(url: string) {
    this.serverUrl = url;
  }

  setApp(app: string) {
    this.app = app;
  }

  setRoom(room: string) {
    this.room = room;
  }

  setWebRtcOptions() {
    // No WebRTC for data-only mode
  }

  setServerConnectListeners(
    successListener: (clientId: string) => void,
    failureListener: (error: Error) => void
  ) {
    this.connectSuccess = successListener;
    this.connectFailure = failureListener;
  }

  setRoomOccupantListener(
    occupantListener: (occupants: Record<string, boolean>) => void
  ) {
    this.onOccupantsChanged = occupantListener;
  }

  setDataChannelListeners(
    openListener: (clientId: string) => void,
    closedListener: (clientId: string) => void,
    messageListener: (clientId: string, dataType: string, data: unknown) => void
  ) {
    this.onOccupantConnected = openListener;
    this.onOccupantDisconnected = closedListener;
    this.onDataChannelMessage = messageListener;
  }

  connect() {
    const url = this.serverUrl || "http://localhost:8888";
    this.socket = io(url, { transports: ["websocket"] });

    this.socket.on("connectSuccess", (data: { clientId: string; serverTime?: number }) => {
      this.clientId = data.clientId;
      if (data.serverTime) {
        this.timeOffset = data.serverTime - Date.now();
      }
      if (this.connectSuccess) this.connectSuccess(data.clientId);
    });

    this.socket.on(
      "occupantsChanged",
      (data: { occupants: Record<string, boolean> }) => {
        const prevOccupants = { ...this.occupants };
        this.occupants = data.occupants;

        for (const id of Object.keys(data.occupants)) {
          if (!prevOccupants[id] && id !== this.clientId) {
            if (this.onOccupantConnected) this.onOccupantConnected(id);
          }
        }
        for (const id of Object.keys(prevOccupants)) {
          if (!data.occupants[id]) {
            if (this.onOccupantDisconnected) this.onOccupantDisconnected(id);
          }
        }

        if (this.onOccupantsChanged) this.onOccupantsChanged(data.occupants);
      }
    );

    this.socket.on(
      "send",
      (data: { from: string; dataType: string; data: unknown }) => {
        if (this.onDataChannelMessage) {
          this.onDataChannelMessage(data.from, data.dataType, data.data);
        }
      }
    );

    this.socket.on("connect_error", (error: Error) => {
      if (this.connectFailure) this.connectFailure(error);
    });

    this.socket.emit("joinRoom", { room: this.room });
  }

  // --- Methods required by NAF ---

  getServerTime(): number {
    return Date.now() + this.timeOffset;
  }

  shouldStartConnectionTo() {
    return true;
  }

  startStreamConnection() {
    // No stream for data-only mode
  }

  closeStreamConnection() {
    // No stream
  }

  getConnectStatus(_clientId?: string): string {
    if (this.socket && this.socket.connected) return "IS_CONNECTED";
    return "NOT_CONNECTED";
  }

  getMediaStream() {
    return Promise.reject(new Error("Media stream not supported"));
  }

  enableMicrophone() {
    // No audio support
  }

  sendData(clientId: string, dataType: string, data: unknown) {
    if (this.socket) {
      this.socket.emit("send", { target: clientId, dataType, data });
    }
  }

  sendDataGuaranteed(clientId: string, dataType: string, data: unknown) {
    this.sendData(clientId, dataType, data);
  }

  broadcastData(dataType: string, data: unknown) {
    if (this.socket) {
      this.socket.emit("broadcast", { dataType, data });
    }
  }

  broadcastDataGuaranteed(dataType: string, data: unknown) {
    this.broadcastData(dataType, data);
  }

  kick(_clientId: string, _permsToken: unknown) {
    // Not implemented
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default SocketIoAdapter;
