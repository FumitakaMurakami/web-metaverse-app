"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { VoiceChat } from "./VoiceChat";

interface AFrameSceneProps {
  roomCode: string;
  nafServerUrl: string;
  userName?: string;
}

const AVATAR_COLORS = [
  "#4CC3D9",
  "#EF2D5E",
  "#FFC65D",
  "#7BC8A4",
  "#93648D",
  "#F97316",
  "#3B82F6",
  "#EC4899",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#06B6D4",
];

export default function AFrameScene({
  roomCode,
  nafServerUrl,
  userName,
}: AFrameSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(userName || "Guest");
  const [avatarColor, setAvatarColor] = useState(
    () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  );
  const displayNameRef = useRef(displayName);
  const avatarColorRef = useRef(avatarColor);

  // Voice chat state
  const voiceChatRef = useRef<VoiceChat | null>(null);
  const [voiceJoined, setVoiceJoined] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Keep refs in sync with state
  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);
  useEffect(() => {
    avatarColorRef.current = avatarColor;
  }, [avatarColor]);

  // Apply avatar settings changes to the live scene
  const applyAvatarSettings = useCallback(
    (name: string, color: string) => {
      const sceneEl = sceneRef.current?.querySelector("a-scene");
      if (!sceneEl) return;
      const rig = sceneEl.querySelector("#rig");
      if (!rig) return;

      // Update player-info component on the rig's networked entity
      rig.setAttribute(
        "player-info",
        `name: ${name}; color: ${color}`
      );
    },
    []
  );

  // When displayName or avatarColor changes, apply to avatar
  useEffect(() => {
    if (ready) {
      applyAvatarSettings(displayName, avatarColor);
    }
  }, [displayName, avatarColor, ready, applyAvatarSettings]);

  // Join voice chat
  const handleJoinVoice = useCallback(async () => {
    const vc = voiceChatRef.current;
    if (!vc) return;
    const success = await vc.enable();
    if (success) {
      setVoiceJoined(true);
      setIsMicMuted(false);
      setIsAudioMuted(false);
    } else {
      alert(
        "マイクへのアクセスが拒否されました。\nブラウザの設定からマイクの使用を許可してください。"
      );
    }
  }, []);

  // Toggle mic mute
  const handleMicToggle = useCallback(() => {
    const vc = voiceChatRef.current;
    if (!vc) return;
    const muted = vc.toggleMicMute();
    setIsMicMuted(muted);
  }, []);

  // Toggle speaker mute
  const handleAudioToggle = useCallback(() => {
    const vc = voiceChatRef.current;
    if (!vc) return;
    const muted = vc.toggleAudioMute();
    setIsAudioMuted(muted);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const AFRAME = await import("aframe");
      await import("networked-aframe");
      const { default: SocketIoAdapter } = await import("./SocketIoAdapter");

      if (!mounted) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aframe = (AFRAME as any).default || AFRAME;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const NAF = (window as any).NAF;

      // Register adapter
      if (NAF && NAF.adapters) {
        NAF.adapters.register("custom-socketio", SocketIoAdapter);
      }

      if (!mounted || !sceneRef.current) return;

      // --- Register custom components ---

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const THREE = (window as any).THREE || (aframe as any).THREE;

      // Unified FPS controls: mouse look + WASD movement + avatar sync
      if (!aframe.components["fps-controls"]) {
        aframe.registerComponent("fps-controls", {
          schema: {
            speed: { type: "number", default: 5 },
            sensitivity: { type: "number", default: 0.002 },
          },
          init: function () {
            this.yaw = 0;
            this.pitch = 0;
            this.keys = {};
            this.direction = new THREE.Vector3();
            this.forward = new THREE.Vector3();
            this.right = new THREE.Vector3();
            this.isPointerLocked = false;
            this.camera = this.el.querySelector("#player-camera");

            // Key handlers
            this.onKeyDown = (e: KeyboardEvent) => {
              this.keys[e.code] = true;
            };
            this.onKeyUp = (e: KeyboardEvent) => {
              delete this.keys[e.code];
            };
            window.addEventListener("keydown", this.onKeyDown);
            window.addEventListener("keyup", this.onKeyUp);

            // Mouse look
            this.onMouseMove = (e: MouseEvent) => {
              if (!this.isPointerLocked) return;
              this.yaw -= e.movementX * this.data.sensitivity;
              this.pitch -= e.movementY * this.data.sensitivity;
              // Clamp pitch to ±89°
              this.pitch = Math.max(
                -Math.PI * 0.49,
                Math.min(Math.PI * 0.49, this.pitch)
              );
            };
            document.addEventListener("mousemove", this.onMouseMove);

            // Pointer lock on click
            this.onClick = () => {
              const canvas = this.el.sceneEl?.canvas;
              if (canvas) canvas.requestPointerLock();
            };
            this.onPointerLockChange = () => {
              this.isPointerLocked =
                document.pointerLockElement === this.el.sceneEl?.canvas;
            };

            // Defer to ensure canvas is available
            setTimeout(() => {
              const canvas = this.el.sceneEl?.canvas;
              if (canvas) {
                canvas.addEventListener("click", this.onClick);
              }
              document.addEventListener(
                "pointerlockchange",
                this.onPointerLockChange
              );
            }, 100);
          },
          remove: function () {
            window.removeEventListener("keydown", this.onKeyDown);
            window.removeEventListener("keyup", this.onKeyUp);
            document.removeEventListener("mousemove", this.onMouseMove);
            document.removeEventListener(
              "pointerlockchange",
              this.onPointerLockChange
            );
            const canvas = this.el.sceneEl?.canvas;
            if (canvas) canvas.removeEventListener("click", this.onClick);
          },
          tick: function (_t: number, dt: number) {
            if (!dt) return;

            // --- Apply rotation ---
            // Yaw on rig (synced to other players via NAF "rotation")
            this.el.object3D.rotation.set(0, this.yaw, 0);
            // Pitch on camera only (not synced to rig rotation)
            if (this.camera) {
              this.camera.object3D.rotation.set(this.pitch, 0, 0);
            }

            // --- Movement relative to yaw ---
            this.forward.set(
              -Math.sin(this.yaw),
              0,
              -Math.cos(this.yaw)
            );
            this.right.set(
              Math.cos(this.yaw),
              0,
              -Math.sin(this.yaw)
            );

            this.direction.set(0, 0, 0);
            if (this.keys["KeyW"] || this.keys["ArrowUp"])
              this.direction.add(this.forward);
            if (this.keys["KeyS"] || this.keys["ArrowDown"])
              this.direction.sub(this.forward);
            if (this.keys["KeyD"] || this.keys["ArrowRight"])
              this.direction.add(this.right);
            if (this.keys["KeyA"] || this.keys["ArrowLeft"])
              this.direction.sub(this.right);

            if (this.direction.lengthSq() > 0) {
              this.direction
                .normalize()
                .multiplyScalar(this.data.speed * (dt / 1000));
              this.el.object3D.position.add(this.direction);
            }

            // --- Sync head pitch for NAF (other players see head tilt) ---
            const head = this.el.querySelector(".head");
            if (head) {
              head.object3D.rotation.x = this.pitch;
            }
          },
        });
      }

      // Canvas-based name tag (supports Japanese/CJK characters)
      if (!aframe.components["canvas-nametag"]) {
        aframe.registerComponent("canvas-nametag", {
          schema: {
            text: { type: "string", default: "Guest" },
          },
          init: function () {
            this.canvas = document.createElement("canvas");
            this.canvas.width = 512;
            this.canvas.height = 128;
            this.texture = new THREE.CanvasTexture(this.canvas);
            this.texture.minFilter = THREE.LinearFilter;

            const geo = new THREE.PlaneGeometry(1.2, 0.3);
            const mat = new THREE.MeshBasicMaterial({
              map: this.texture,
              transparent: true,
              side: THREE.DoubleSide,
              depthTest: false,
            });
            this.mesh = new THREE.Mesh(geo, mat);
            this.el.object3D.add(this.mesh);
            this.renderText();
          },
          update: function () {
            if (this.canvas) this.renderText();
          },
          renderText: function () {
            const ctx = this.canvas.getContext("2d");
            const w = this.canvas.width;
            const h = this.canvas.height;

            ctx.clearRect(0, 0, w, h);

            // Rounded background
            const pad = 8;
            const r = 16;
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.beginPath();
            ctx.moveTo(pad + r, pad);
            ctx.lineTo(w - pad - r, pad);
            ctx.quadraticCurveTo(w - pad, pad, w - pad, pad + r);
            ctx.lineTo(w - pad, h - pad - r);
            ctx.quadraticCurveTo(w - pad, h - pad, w - pad - r, h - pad);
            ctx.lineTo(pad + r, h - pad);
            ctx.quadraticCurveTo(pad, h - pad, pad, h - pad - r);
            ctx.lineTo(pad, pad + r);
            ctx.quadraticCurveTo(pad, pad, pad + r, pad);
            ctx.closePath();
            ctx.fill();

            // Text
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 48px 'Hiragino Sans', 'Noto Sans JP', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.data.text, w / 2, h / 2);

            if (this.texture) this.texture.needsUpdate = true;
          },
        });
      }

      // Billboard: always face the camera
      if (!aframe.components["billboard"]) {
        aframe.registerComponent("billboard", {
          init: function () {
            this._worldPos = new THREE.Vector3();
          },
          tick: function () {
            const camera = this.el.sceneEl?.camera;
            if (!camera) return;
            camera.getWorldPosition(this._worldPos);
            this.el.object3D.lookAt(this._worldPos);
          },
        });
      }

      // Hide local avatar so it doesn't block the first-person camera
      if (!aframe.components["hide-local-avatar"]) {
        aframe.registerComponent("hide-local-avatar", {
          init: function () {
            this._hidden = false;
          },
          tick: function () {
            if (this._hidden) return;
            const head = this.el.querySelector(".head");
            const body = this.el.querySelector(".body");
            const nameTag = this.el.querySelector(".name-tag");
            // Wait until NAF attaches the template children
            if (head && body) {
              head.object3D.visible = false;
              body.object3D.visible = false;
              if (nameTag) nameTag.object3D.visible = false;
              this._hidden = true;
            }
          },
        });
      }

      // Player info display
      if (!aframe.components["player-info"]) {
        aframe.registerComponent("player-info", {
          schema: {
            name: { type: "string", default: "Guest" },
            color: { type: "color", default: "#4CC3D9" },
          },
          init: function () {
            this.applyInfo();
          },
          update: function () {
            this.applyInfo();
          },
          applyInfo: function () {
            const nameTag = this.el.querySelector(".name-tag");
            const head = this.el.querySelector(".head");
            const body = this.el.querySelector(".body");
            if (nameTag)
              nameTag.setAttribute("canvas-nametag", "text", this.data.name);
            if (head)
              head.setAttribute("material", "color", this.data.color);
            if (body)
              body.setAttribute("material", "color", this.data.color);
          },
        });
      }

      // --- Build scene FIRST, then register schemas after DOM is ready ---
      const myColor = avatarColorRef.current;
      const myName = displayNameRef.current;

      sceneRef.current.innerHTML = `
        <a-scene
          networked-scene="
            serverURL: ${nafServerUrl};
            adapter: custom-socketio;
            room: ${roomCode};
            connectOnLoad: false;
            audio: false;
            debug: false;
          "
          embedded
          style="width: 100%; height: 100%;"
          vr-mode-ui="enabled: false"
          renderer="antialias: true"
        >
          <a-assets>
            <template id="avatar-template">
              <a-entity class="avatar"
                player-info="name: ${myName}; color: ${myColor}"
              >
                <a-sphere class="head"
                  scale="0.3 0.35 0.3"
                  material="color: ${myColor}"
                ></a-sphere>
                <a-entity class="body"
                  geometry="primitive: cylinder; height: 0.6; radius: 0.2"
                  material="color: ${myColor}; opacity: 0.8"
                  position="0 -0.5 0"
                ></a-entity>
                <a-entity class="name-tag"
                  canvas-nametag="text: ${myName}"
                  billboard
                  position="0 0.55 0"
                  scale="0.8 0.8 0.8"
                ></a-entity>
              </a-entity>
            </template>
          </a-assets>

          <!-- Environment -->
          <a-plane
            rotation="-90 0 0"
            width="30"
            height="30"
            color="#7BC8A4"
            shadow="receive: true"
          ></a-plane>

          <a-sky color="#DCEEFB"></a-sky>

          <a-light type="ambient" color="#BBB"></a-light>
          <a-light type="directional" color="#FFF" intensity="0.6"
            position="-0.5 1 1"
          ></a-light>

          <!-- Environment objects -->
          <a-box position="-3 0.5 -5" width="1" height="1" depth="1"
            color="#4CC3D9" shadow
          ></a-box>
          <a-cylinder position="3 0.75 -5" radius="0.5" height="1.5"
            color="#FFC65D" shadow
          ></a-cylinder>
          <a-sphere position="0 1 -8" radius="1"
            color="#EF2D5E" shadow
          ></a-sphere>

          <!-- Player rig -->
          <a-entity
            id="rig"
            position="0 0.8 0"
            fps-controls="speed: 5; sensitivity: 0.002"
            hide-local-avatar
          >
            <a-entity
              id="player-camera"
              camera
              position="0 0.8 0"
            ></a-entity>
          </a-entity>
        </a-scene>
      `;

      // Wait for scene to be ready, THEN register schemas and connect
      const sceneEl = sceneRef.current.querySelector("a-scene");
      if (sceneEl) {
        const onSceneLoaded = () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nafRef = (window as any).NAF;
          if (nafRef && nafRef.schemas) {
            nafRef.schemas.add({
              template: "#avatar-template",
              components: [
                "position",
                "rotation",
                {
                  selector: ".head",
                  component: "rotation",
                },
                {
                  component: "player-info",
                },
              ],
            });
          }

          // Now add networked component to the rig and connect
          const rig = sceneEl.querySelector("#rig");
          if (rig) {
            rig.setAttribute(
              "networked",
              "template: #avatar-template; attachTemplateToLocal: true;"
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sceneComp = (sceneEl as any).components["networked-scene"];
          if (sceneComp) {
            sceneComp.connect();
          }

          // Initialize VoiceChat after NAF adapter connects
          const initVoice = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const naf = (window as any).NAF;
            const adapter = naf?.connection?.adapter;
            if (adapter?.socket && adapter?.clientId) {
              const vc = new VoiceChat();
              vc.initialize(adapter.socket, adapter.clientId);
              voiceChatRef.current = vc;
            } else {
              setTimeout(initVoice, 500);
            }
          };
          setTimeout(initVoice, 1000);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((sceneEl as any).hasLoaded) {
          onSceneLoaded();
        } else {
          sceneEl.addEventListener("loaded", onSceneLoaded, { once: true });
        }
      }

      // Track user count
      const checkUserCount = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nafRef = (window as any).NAF;
        if (nafRef && nafRef.connection && nafRef.connection.adapter) {
          const occupants = nafRef.connection.adapter.occupants || {};
          setUserCount(Object.keys(occupants).length + 1);
        }
      };

      const interval = setInterval(checkUserCount, 2000);
      cleanupRef.current = () => {
        clearInterval(interval);
        if (voiceChatRef.current) {
          voiceChatRef.current.disable();
          voiceChatRef.current = null;
        }
        const scene = sceneRef.current?.querySelector("a-scene");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (scene) (scene as any).destroy?.();
        if (sceneRef.current) sceneRef.current.innerHTML = "";
      };

      setReady(true);
    }

    init();

    return () => {
      mounted = false;
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [roomCode, nafServerUrl, userName]);

  return (
    <div className="relative w-full h-full">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4" />
            <p>メタバース空間を読み込み中...</p>
          </div>
        </div>
      )}

      {/* User count badge (top-right) */}
      <div className="absolute top-4 right-4 z-20 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
        接続中: {userCount}人
      </div>

      {/* Top-left controls: gear + mic */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        {/* Gear icon button */}
        <button
          onClick={() => setSettingsOpen((prev) => !prev)}
          className="bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          title="アバター設定"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {!voiceJoined ? (
          /* Join voice chat button (headphone icon) */
          <button
            onClick={handleJoinVoice}
            className="bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            title="通話に参加"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 18v-6a9 9 0 0118 0v6"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z"
              />
            </svg>
          </button>
        ) : (
          <>
            {/* Mic mute button */}
            <button
              onClick={handleMicToggle}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isMicMuted
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
              title={isMicMuted ? "マイクをオンにする" : "マイクをオフにする"}
            >
              {isMicMuted ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 10v2a7 7 0 01-14 0v-2"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19v4m-4 0h8"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M3 3l18 18"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 10v2a7 7 0 01-14 0v-2"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19v4m-4 0h8"
                  />
                </svg>
              )}
            </button>

            {/* Speaker mute button */}
            <button
              onClick={handleAudioToggle}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isAudioMuted
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
              title={isAudioMuted ? "音声をオンにする" : "音声をオフにする"}
            >
              {isAudioMuted ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5L6 9H2v6h4l5 4V5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M3 3l18 18"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5L6 9H2v6h4l5 4V5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.54 8.46a5 5 0 010 7.07"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.07 4.93a10 10 0 010 14.14"
                  />
                </svg>
              )}
            </button>
          </>
        )}
      </div>

      {/* Settings panel (left side overlay) */}
      <div
        className={`absolute top-0 left-0 h-full z-30 transition-transform duration-300 ease-in-out ${
          settingsOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full w-72 bg-gray-900/90 backdrop-blur-sm text-white p-5 overflow-y-auto">
          {/* Panel header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">アバター設定</h2>
            <button
              onClick={() => setSettingsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Display name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              表示名
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value || "Guest")}
              maxLength={20}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="表示名を入力"
            />
            <p className="text-xs text-gray-500 mt-1">
              最大20文字
            </p>
          </div>

          {/* Avatar color */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              アバターカラー
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  className={`w-full aspect-square rounded-lg border-2 transition-all ${
                    avatarColor === color
                      ? "border-white scale-110 shadow-lg"
                      : "border-transparent hover:border-gray-500"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Custom color input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              カスタムカラー
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={avatarColor}
                onChange={(e) => setAvatarColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-600 bg-transparent"
              />
              <input
                type="text"
                value={avatarColor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    setAvatarColor(val);
                  }
                }}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="#4CC3D9"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              プレビュー
            </label>
            <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center">
              {/* Simple avatar preview */}
              <div
                className="w-12 h-14 rounded-full mb-1"
                style={{ backgroundColor: avatarColor }}
              />
              <div
                className="w-8 h-16 rounded-md -mt-2"
                style={{ backgroundColor: avatarColor, opacity: 0.8 }}
              />
              <p className="text-sm mt-2 text-center" style={{ color: avatarColor }}>
                {displayName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Click-away overlay to close settings */}
      {settingsOpen && (
        <div
          className="absolute inset-0 z-20"
          onClick={() => setSettingsOpen(false)}
        />
      )}

      <div ref={sceneRef} className="w-full h-full" />
    </div>
  );
}
