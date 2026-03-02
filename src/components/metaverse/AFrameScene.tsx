"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { VoiceChat } from "./VoiceChat";
import { PhysicsWorld } from "./PhysicsWorld";

const ModelThumbnail = dynamic(() => import("./ModelThumbnail"), { ssr: false });

interface AFrameSceneProps {
  roomCode: string;
  nafServerUrl: string;
  userName?: string;
  sessionId: string;
  environmentPreset?: string;
}

interface UploadedAssetData {
  asset_id: string;
  file_name: string;
  stored_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  created_at: string;
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

const SIZE_MAP = {
  small:  { box: { w: 0.3, h: 0.3, d: 0.3 }, sphere: { r: 0.15 }, cylinder: { r: 0.15, h: 0.3 } },
  medium: { box: { w: 0.7, h: 0.7, d: 0.7 }, sphere: { r: 0.35 }, cylinder: { r: 0.25, h: 0.7 } },
  large:  { box: { w: 1.2, h: 1.2, d: 1.2 }, sphere: { r: 0.6  }, cylinder: { r: 0.4,  h: 1.2 } },
};

export default function AFrameScene({
  roomCode,
  nafServerUrl,
  userName,
  sessionId,
  environmentPreset = "default",
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

  // Object placement state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const [objectSource, setObjectSource] = useState<"primitive" | "asset">("primitive");
  const [objectShape, setObjectShape] = useState<'box' | 'sphere' | 'cylinder'>('box');
  const [objectColor, setObjectColor] = useState('#4CC3D9');
  const [objectSize, setObjectSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [selectedAssetForDialog, setSelectedAssetForDialog] = useState<UploadedAssetData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewRendererRef = useRef<any>(null);
  const previewAnimFrameRef = useRef<number>(0);
  const placedObjectCountRef = useRef(0);

  // Physics & clickable state
  const [physicsEnabled, setPhysicsEnabled] = useState(false);
  const [clickableEnabled, setClickableEnabled] = useState(false);
  const [grabbableEnabled, setGrabbableEnabled] = useState(false);
  const physicsEnabledRef = useRef(false);
  const clickableEnabledRef = useRef(false);
  const grabbableEnabledRef = useRef(false);
  const physicsWorldRef = useRef<PhysicsWorld | null>(null);

  // Crosshair / cursor mode: "default" | "openHand" | "closedHand"
  const [crosshairVisible, setCrosshairVisible] = useState(false);
  const [cursorMode, setCursorMode] = useState<"default" | "openHand" | "closedHand">("default");

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAssetData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Asset placement state
  const [assetPlacementMode, setAssetPlacementMode] = useState(false);
  const selectedAssetRef = useRef<{ stored_name: string; file_type: string } | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);
  useEffect(() => {
    avatarColorRef.current = avatarColor;
  }, [avatarColor]);
  useEffect(() => {
    physicsEnabledRef.current = physicsEnabled;
  }, [physicsEnabled]);
  useEffect(() => {
    clickableEnabledRef.current = clickableEnabled;
  }, [clickableEnabled]);
  useEffect(() => {
    grabbableEnabledRef.current = grabbableEnabled;
  }, [grabbableEnabled]);

  // Track pointer lock state for crosshair visibility
  useEffect(() => {
    const handlePointerLockChange = () => {
      setCrosshairVisible(!!document.pointerLockElement);
      if (!document.pointerLockElement) setCursorMode("default");
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, []);

  // Sync window.__cursorMode (set by A-Frame component) to React state
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__cursorMode = "default";
    const interval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mode = (window as any).__cursorMode as "default" | "openHand" | "closedHand";
      setCursorMode((prev) => (prev !== mode ? mode : prev));
    }, 50);
    return () => clearInterval(interval);
  }, []);

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

  // Fetch uploaded assets for this session
  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/metaverse/uploads?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setUploadedAssets(data.assets);
      }
    } catch (err) {
      console.error("Failed to fetch assets:", err);
    }
  }, [sessionId]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError("");
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", sessionId);

        const res = await fetch("/api/metaverse/uploads", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          setUploadError(data.error || "アップロードに失敗しました");
          return;
        }

        await fetchAssets();
      } catch {
        setUploadError("アップロードに失敗しました");
      } finally {
        setUploading(false);
      }
    },
    [sessionId, fetchAssets]
  );

  // Handle asset deletion
  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      try {
        const res = await fetch("/api/metaverse/uploads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId }),
        });
        if (res.ok) {
          await fetchAssets();
        }
      } catch (err) {
        console.error("Failed to delete asset:", err);
      }
    },
    [fetchAssets]
  );

  // Fetch assets when upload dialog or item dialog (asset tab) opens
  useEffect(() => {
    if (uploadDialogOpen || itemDialogOpen) {
      fetchAssets();
    }
  }, [uploadDialogOpen, itemDialogOpen, fetchAssets]);

  // Start asset placement mode (for uploaded models/images)
  const handleStartAssetPlacement = useCallback(
    (asset: { stored_name: string; file_type: string }) => {
      // Close whichever dialog is open
      setUploadDialogOpen(false);
      setItemDialogOpen(false);

      selectedAssetRef.current = asset;
      setAssetPlacementMode(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__placementModeActive = true;

      const canvas = sceneRef.current?.querySelector(
        "a-scene canvas"
      ) as HTMLCanvasElement | null;
      if (canvas) canvas.requestPointerLock();

      const sceneEl = sceneRef.current?.querySelector("a-scene");
      if (!sceneEl) return;

      // Show ghost preview of the actual asset
      const assetUrl = `/uploads/${asset.stored_name}`;
      sceneEl.setAttribute(
        "object-placer",
        `active: true; assetUrl: ${assetUrl}; assetType: ${asset.file_type}`
      );
    },
    []
  );

  // Asset placement click handler
  useEffect(() => {
    if (!assetPlacementMode) return;

    const exitAssetPlacement = () => {
      setAssetPlacementMode(false);
      selectedAssetRef.current = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__placementModeActive = false;
      const sceneEl = sceneRef.current?.querySelector("a-scene");
      if (sceneEl) sceneEl.removeAttribute("object-placer");
    };

    const handleAssetPlacementClick = () => {
      const asset = selectedAssetRef.current;
      if (!asset) return;

      const sceneEl = sceneRef.current?.querySelector("a-scene");
      if (!sceneEl) return;
      const ghost = sceneEl.querySelector("#placement-ghost");
      if (!ghost) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pos = (ghost as any).object3D.position;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const naf = (window as any).NAF;
      const clientId = naf?.connection?.adapter?.clientId || "local";
      const objectId = `${clientId}-asset-${placedObjectCountRef.current++}`;
      const assetUrl = `/uploads/${asset.stored_name}`;

      let entity: HTMLElement;
      if (asset.file_type === "model") {
        entity = document.createElement("a-entity");
        entity.setAttribute("gltf-model", `url(${assetUrl})`);
        entity.setAttribute("scale", "1 1 1");
      } else if (asset.file_type === "video") {
        entity = document.createElement("a-video");
        entity.setAttribute("src", assetUrl);
        entity.setAttribute("width", "3");
        entity.setAttribute("height", "1.69");
        entity.setAttribute("autoplay", "true");
        entity.setAttribute("loop", "true");
      } else {
        entity = document.createElement("a-image");
        entity.setAttribute("src", assetUrl);
        entity.setAttribute("width", "2");
        entity.setAttribute("height", "2");
      }

      entity.setAttribute(
        "position",
        `${pos.x} ${pos.y} ${pos.z}`
      );
      entity.setAttribute("shadow", "");
      entity.setAttribute("id", objectId);

      // Add physics-body if enabled
      if (physicsEnabledRef.current) {
        entity.setAttribute(
          "physics-body",
          `type: dynamic; shape: box; size: medium; objectId: ${objectId}`
        );
      }
      // Add clickable-object if enabled
      if (clickableEnabledRef.current) {
        entity.setAttribute("clickable-object", `objectId: ${objectId}`);
      }
      // Add grabbable-object if enabled
      if (grabbableEnabledRef.current) {
        entity.setAttribute("grabbable-object", `objectId: ${objectId}`);
      }

      sceneEl.appendChild(entity);

      // Broadcast to other users
      const adapter = naf?.connection?.adapter;
      if (adapter) {
        adapter.broadcastData("asset-placed", {
          objectId,
          assetUrl,
          fileType: asset.file_type,
          position: { x: pos.x, y: pos.y, z: pos.z },
          physics: physicsEnabledRef.current,
          clickable: clickableEnabledRef.current,
          grabbable: grabbableEnabledRef.current,
        });
      }

      exitAssetPlacement();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitAssetPlacement();
    };

    const timer = setTimeout(() => {
      document.addEventListener("click", handleAssetPlacementClick, {
        once: true,
      });
    }, 100);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleAssetPlacementClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [assetPlacementMode]);

  // Start object placement mode
  const handleStartPlacement = useCallback(() => {
    // If asset tab is active, delegate to asset placement
    if (objectSource === "asset" && selectedAssetForDialog) {
      handleStartAssetPlacement({
        stored_name: selectedAssetForDialog.stored_name,
        file_type: selectedAssetForDialog.file_type,
      });
      setItemDialogOpen(false);
      return;
    }

    setItemDialogOpen(false);
    setPlacementMode(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__placementModeActive = true;

    // Request pointer lock so the user can look around with the mouse
    const canvas = sceneRef.current?.querySelector("a-scene canvas") as HTMLCanvasElement | null;
    if (canvas) {
      canvas.requestPointerLock();
    }

    const sceneEl = sceneRef.current?.querySelector("a-scene");
    if (!sceneEl) return;

    const sizeData = SIZE_MAP[objectSize];
    let sizeParams: string;
    if (objectShape === "box") {
      const s = sizeData.box;
      sizeParams = `${s.w},${s.h},${s.d}`;
    } else if (objectShape === "sphere") {
      sizeParams = `${sizeData.sphere.r}`;
    } else {
      sizeParams = `${sizeData.cylinder.r},${sizeData.cylinder.h}`;
    }

    sceneEl.setAttribute(
      "object-placer",
      `shape: ${objectShape}; color: ${objectColor}; sizeParams: ${sizeParams}; active: true`
    );
  }, [objectShape, objectColor, objectSize, objectSource, selectedAssetForDialog, handleStartAssetPlacement]);

  // Three.js preview rendering
  useEffect(() => {
    if (!itemDialogOpen || !previewCanvasRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const canvas = previewCanvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    let renderer = previewRendererRef.current;
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(width, height);
      previewRendererRef.current = renderer;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(1.5, 1.2, 1.5);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xbbbbbb));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(-0.5, 1, 1);
    scene.add(dirLight);

    const sizeData = SIZE_MAP[objectSize];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geometry: any;
    switch (objectShape) {
      case "box":
        geometry = new THREE.BoxGeometry(sizeData.box.w, sizeData.box.h, sizeData.box.d);
        break;
      case "sphere":
        geometry = new THREE.SphereGeometry(sizeData.sphere.r, 32, 32);
        break;
      case "cylinder":
        geometry = new THREE.CylinderGeometry(
          sizeData.cylinder.r, sizeData.cylinder.r, sizeData.cylinder.h, 32
        );
        break;
    }

    const material = new THREE.MeshStandardMaterial({ color: objectColor });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    scene.add(new THREE.GridHelper(2, 8, 0x444444, 0x333333));

    let angle = 0;
    const animate = () => {
      previewAnimFrameRef.current = requestAnimationFrame(animate);
      angle += 0.01;
      mesh.rotation.y = angle;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(previewAnimFrameRef.current);
      geometry.dispose();
      material.dispose();
    };
  }, [itemDialogOpen, objectShape, objectColor, objectSize]);

  // Cleanup renderer when dialog closes
  useEffect(() => {
    if (!itemDialogOpen && previewRendererRef.current) {
      previewRendererRef.current.dispose();
      previewRendererRef.current = null;
    }
  }, [itemDialogOpen]);

  // Placement mode: click to place, ESC to cancel
  useEffect(() => {
    if (!placementMode) return;

    const exitPlacementMode = () => {
      setPlacementMode(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__placementModeActive = false;
      const sceneEl = sceneRef.current?.querySelector("a-scene");
      if (sceneEl) {
        sceneEl.removeAttribute("object-placer");
      }
    };

    const handlePlacementClick = () => {
      const sceneEl = sceneRef.current?.querySelector("a-scene");
      if (!sceneEl) return;

      const ghost = sceneEl.querySelector("#placement-ghost");
      if (!ghost) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pos = (ghost as any).object3D.position;

      // Generate globally unique object ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const naf = (window as any).NAF;
      const clientId = naf?.connection?.adapter?.clientId || "local";
      const objectId = `${clientId}-obj-${placedObjectCountRef.current++}`;

      const sizeData = SIZE_MAP[objectSize];
      const entity = document.createElement(`a-${objectShape}`);

      if (objectShape === "box") {
        entity.setAttribute("width", String(sizeData.box.w));
        entity.setAttribute("height", String(sizeData.box.h));
        entity.setAttribute("depth", String(sizeData.box.d));
      } else if (objectShape === "sphere") {
        entity.setAttribute("radius", String(sizeData.sphere.r));
      } else {
        entity.setAttribute("radius", String(sizeData.cylinder.r));
        entity.setAttribute("height", String(sizeData.cylinder.h));
      }

      entity.setAttribute("material", `color: ${objectColor}`);
      entity.setAttribute("shadow", "");
      entity.setAttribute("position", `${pos.x} ${pos.y} ${pos.z}`);
      entity.setAttribute("id", objectId);

      // Add physics-body if enabled
      if (physicsEnabledRef.current) {
        entity.setAttribute(
          "physics-body",
          `type: dynamic; shape: ${objectShape}; size: ${objectSize}; objectId: ${objectId}`
        );
      }

      // Add clickable-object if enabled (requires physics)
      if (clickableEnabledRef.current) {
        entity.setAttribute("clickable-object", `objectId: ${objectId}`);
      }
      // Add grabbable-object if enabled (requires physics)
      if (grabbableEnabledRef.current) {
        entity.setAttribute("grabbable-object", `objectId: ${objectId}`);
      }

      sceneEl.appendChild(entity);

      // Broadcast to other users
      const adapter = naf?.connection?.adapter;
      if (adapter) {
        adapter.broadcastData("object-placed", {
          objectId,
          shape: objectShape,
          color: objectColor,
          size: objectSize,
          position: { x: pos.x, y: pos.y, z: pos.z },
          physics: physicsEnabledRef.current,
          clickable: clickableEnabledRef.current,
          grabbable: grabbableEnabledRef.current,
        });
      }

      exitPlacementMode();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        exitPlacementMode();
      }
    };

    // Delay to avoid the same click that initiated placement from triggering place
    const timer = setTimeout(() => {
      const canvas = sceneRef.current?.querySelector("a-scene canvas") as HTMLCanvasElement | null;
      if (canvas) {
        canvas.addEventListener("click", handlePlacementClick);
      }
      window.addEventListener("keydown", handleKeyDown);
    }, 100);

    return () => {
      clearTimeout(timer);
      const canvas = sceneRef.current?.querySelector("a-scene canvas") as HTMLCanvasElement | null;
      if (canvas) {
        canvas.removeEventListener("click", handlePlacementClick);
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [placementMode, objectShape, objectColor, objectSize]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const AFRAME = await import("aframe");
      await import("networked-aframe");
      await import("aframe-environment-component");
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

            // Pointer lock on click (disabled during placement mode)
            this.onClick = () => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((window as any).__placementModeActive) return;
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

      // Object placer: ghost entity follows camera direction
      if (!aframe.components["object-placer"]) {
        aframe.registerComponent("object-placer", {
          schema: {
            shape: { type: "string", default: "box" },
            color: { type: "color", default: "#4CC3D9" },
            sizeParams: { type: "string", default: "0.7,0.7,0.7" },
            distance: { type: "number", default: 3 },
            active: { type: "boolean", default: false },
            assetUrl: { type: "string", default: "" },
            assetType: { type: "string", default: "" }, // "model" or "image"
          },
          init: function () {
            this.ghostEl = null;
            this._camPos = new THREE.Vector3();
            this._camDir = new THREE.Vector3();
          },
          update: function () {
            if (this.ghostEl) {
              this.ghostEl.parentNode?.removeChild(this.ghostEl);
              this.ghostEl = null;
            }
            if (!this.data.active) return;

            const { assetUrl, assetType } = this.data;

            if (assetUrl && assetType) {
              // Asset ghost (3D model or image)
              if (assetType === "model") {
                this.ghostEl = document.createElement("a-entity");
                this.ghostEl.setAttribute("gltf-model", `url(${assetUrl})`);
                this.ghostEl.setAttribute("scale", "1 1 1");
                // Make semi-transparent after model loads
                this.ghostEl.addEventListener("model-loaded", () => {
                  const mesh = this.ghostEl?.object3D;
                  if (!mesh) return;
                  mesh.traverse((node: any) => {
                    if (node.isMesh && node.material) {
                      const mat = node.material;
                      mat.transparent = true;
                      mat.opacity = 0.5;
                      mat.depthWrite = false;
                    }
                  });
                });
              } else if (assetType === "video") {
                // Video asset ghost
                this.ghostEl = document.createElement("a-video");
                this.ghostEl.setAttribute("src", assetUrl);
                this.ghostEl.setAttribute("width", "3");
                this.ghostEl.setAttribute("height", "1.69");
                this.ghostEl.setAttribute(
                  "material",
                  "opacity: 0.5; transparent: true; depthWrite: false"
                );
              } else {
                // Image asset
                this.ghostEl = document.createElement("a-image");
                this.ghostEl.setAttribute("src", assetUrl);
                this.ghostEl.setAttribute("width", "2");
                this.ghostEl.setAttribute("height", "2");
                this.ghostEl.setAttribute(
                  "material",
                  "opacity: 0.5; transparent: true; depthWrite: false"
                );
              }
            } else {
              // Primitive shape ghost
              const shape = this.data.shape;
              const color = this.data.color;
              const params = this.data.sizeParams.split(",").map(Number);

              this.ghostEl = document.createElement(`a-${shape}`);

              if (shape === "box") {
                this.ghostEl.setAttribute("width", params[0]);
                this.ghostEl.setAttribute("height", params[1]);
                this.ghostEl.setAttribute("depth", params[2]);
              } else if (shape === "sphere") {
                this.ghostEl.setAttribute("radius", params[0]);
              } else if (shape === "cylinder") {
                this.ghostEl.setAttribute("radius", params[0]);
                this.ghostEl.setAttribute("height", params[1]);
              }

              this.ghostEl.setAttribute(
                "material",
                `color: ${color}; opacity: 0.5; transparent: true`
              );
            }

            this.ghostEl.setAttribute("id", "placement-ghost");
            this.el.sceneEl.appendChild(this.ghostEl);
          },
          tick: function () {
            if (!this.ghostEl || !this.data.active) return;
            const camera = this.el.sceneEl.camera;
            if (!camera) return;

            camera.getWorldPosition(this._camPos);
            camera.getWorldDirection(this._camDir);

            const pos = this._camPos
              .clone()
              .add(this._camDir.multiplyScalar(this.data.distance));
            this.ghostEl.object3D.position.set(pos.x, pos.y, pos.z);
          },
          remove: function () {
            if (this.ghostEl) {
              this.ghostEl.parentNode?.removeChild(this.ghostEl);
              this.ghostEl = null;
            }
          },
        });
      }

      // Physics world system: steps physics and syncs entity positions
      if (!aframe.systems["physics-world"]) {
        aframe.registerSystem("physics-world", {
          init: function () {
            this.physicsWorld = null;
          },
          tick: function (_t: number, dt: number) {
            if (!this.physicsWorld || !dt) return;
            this.physicsWorld.step(dt / 1000);
            const entities = this.el.querySelectorAll("[physics-body]");
            for (const entity of entities) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const comp = (entity as any).components?.["physics-body"];
              if (comp) comp.syncFromPhysics();
            }
          },
        });
      }

      // Physics body component: creates cannon-es body for the entity
      if (!aframe.components["physics-body"]) {
        aframe.registerComponent("physics-body", {
          schema: {
            type: { type: "string", default: "dynamic" },
            shape: { type: "string", default: "box" },
            size: { type: "string", default: "medium" },
            objectId: { type: "string", default: "" },
          },
          init: function () {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const system = (this.el.sceneEl as any).systems["physics-world"];
            if (!system || !system.physicsWorld) return;
            const pos = this.el.object3D.position;
            system.physicsWorld.addBody(this.data.objectId, {
              type: this.data.type,
              shape: this.data.shape,
              size: this.data.size,
              position: { x: pos.x, y: pos.y, z: pos.z },
            });
          },
          syncFromPhysics: function () {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const system = (this.el.sceneEl as any).systems["physics-world"];
            if (!system || !system.physicsWorld) return;
            const state = system.physicsWorld.getBodyState(this.data.objectId);
            if (!state) return;
            this.el.object3D.position.copy(state.position);
            this.el.object3D.quaternion.copy(state.quaternion);
          },
          remove: function () {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const system = (this.el.sceneEl as any).systems["physics-world"];
            if (system && system.physicsWorld) {
              system.physicsWorld.removeBody(this.data.objectId);
            }
          },
        });
      }

      // Clickable object: marks entity for launch-raycasting
      if (!aframe.components["clickable-object"]) {
        aframe.registerComponent("clickable-object", {
          schema: { objectId: { type: "string", default: "" } },
          init: function () { this.el.classList.add("clickable"); },
          remove: function () { this.el.classList.remove("clickable"); },
        });
      }

      // Grabbable object: marks entity for grab interaction
      if (!aframe.components["grabbable-object"]) {
        aframe.registerComponent("grabbable-object", {
          schema: { objectId: { type: "string", default: "" } },
          init: function () { this.el.classList.add("grabbable"); },
          remove: function () { this.el.classList.remove("grabbable"); },
        });
      }

      // Interaction raycaster: launch (click), grab (hold), hover detection
      if (!aframe.components["launch-raycaster"]) {
        aframe.registerComponent("launch-raycaster", {
          init: function () {
            this._raycaster = new THREE.Raycaster();
            this._mouse = new THREE.Vector2(0, 0);
            this._camPos = new THREE.Vector3();
            this._camDir = new THREE.Vector3();

            // Grab state
            this._grabbedObjectId = null as string | null;
            this._grabDistance = 3;

            // Helper: raycast against a CSS class, return { objectId, distance } or null
            this._raycastClass = (cssClass: string, attrName: string) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const camera = (this.el.sceneEl as any).camera;
              if (!camera) return null;
              this._raycaster.setFromCamera(this._mouse, camera);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const els = (this.el.sceneEl as any).querySelectorAll(`.${cssClass}`);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const meshes: any[] = [];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const idMap = new Map<any, string>();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              els.forEach((el: any) => {
                const mesh = el.getObject3D("mesh");
                if (mesh) {
                  meshes.push(mesh);
                  const attr = el.getAttribute(attrName);
                  idMap.set(mesh, attr?.objectId || el.id);
                }
              });
              const intersects = this._raycaster.intersectObjects(meshes, true);
              if (intersects.length === 0) return null;
              let hitObj = intersects[0].object;
              let objectId = idMap.get(hitObj);
              while (!objectId && hitObj.parent) {
                hitObj = hitObj.parent;
                objectId = idMap.get(hitObj);
              }
              return objectId ? { objectId, distance: intersects[0].distance } : null;
            };

            // --- Mouse down: launch (click) or start grab (hold) ---
            this.onMouseDown = () => {
              if (!document.pointerLockElement) return;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((window as any).__placementModeActive) return;

              // Try grabbable first
              const grabHit = this._raycastClass("grabbable", "grabbable-object");
              if (grabHit) {
                this._grabbedObjectId = grabHit.objectId;
                this._grabDistance = Math.max(1.5, Math.min(grabHit.distance, 5));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const system = (this.el.sceneEl as any).systems?.["physics-world"];
                if (system?.physicsWorld) {
                  system.physicsWorld.setKinematic(grabHit.objectId);
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__cursorMode = "closedHand";
                // Broadcast grab
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const naf = (window as any).NAF;
                const adapter = naf?.connection?.adapter;
                if (adapter) {
                  adapter.broadcastData("object-grabbed", { objectId: grabHit.objectId });
                }
                return;
              }

              // Try clickable (launch)
              const clickHit = this._raycastClass("clickable", "clickable-object");
              if (clickHit) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const camera = (this.el.sceneEl as any).camera;
                const dir = new THREE.Vector3();
                camera.getWorldDirection(dir);
                const impulse = { x: dir.x * 50, y: dir.y * 50 + 15, z: dir.z * 50 };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const system = (this.el.sceneEl as any).systems?.["physics-world"];
                if (system?.physicsWorld) {
                  system.physicsWorld.applyImpulse(clickHit.objectId, impulse);
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const naf = (window as any).NAF;
                const adapter = naf?.connection?.adapter;
                if (adapter) {
                  adapter.broadcastData("object-launched", { objectId: clickHit.objectId, impulse });
                }
              }
            };

            // --- Mouse up: release grab ---
            this.onMouseUp = () => {
              if (!this._grabbedObjectId) return;
              const objectId = this._grabbedObjectId;
              this._grabbedObjectId = null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const system = (this.el.sceneEl as any).systems?.["physics-world"];
              if (system?.physicsWorld) {
                system.physicsWorld.setDynamic(objectId, 5);
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__cursorMode = "default";
              // Broadcast release
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const naf = (window as any).NAF;
              const adapter = naf?.connection?.adapter;
              if (adapter) {
                adapter.broadcastData("object-released", { objectId });
              }
            };

            setTimeout(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const canvas = (this.el.sceneEl as any)?.canvas;
              if (canvas) {
                canvas.addEventListener("mousedown", this.onMouseDown);
                canvas.addEventListener("mouseup", this.onMouseUp);
              }
            }, 100);
          },
          tick: function () {
            if (!document.pointerLockElement) return;

            // --- Hover detection: check if crosshair is over a grabbable ---
            if (!this._grabbedObjectId) {
              const grabHover = this._raycastClass("grabbable", "grabbable-object");
              const mode = grabHover ? "openHand" : "default";
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((window as any).__cursorMode !== mode) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__cursorMode = mode;
              }
            }

            // --- Move grabbed object to follow camera ---
            if (this._grabbedObjectId) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const camera = (this.el.sceneEl as any).camera;
              if (!camera) return;
              camera.getWorldPosition(this._camPos);
              camera.getWorldDirection(this._camDir);
              const target = this._camPos.clone().add(
                this._camDir.multiplyScalar(this._grabDistance)
              );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const system = (this.el.sceneEl as any).systems?.["physics-world"];
              if (system?.physicsWorld) {
                system.physicsWorld.setBodyPosition(this._grabbedObjectId, {
                  x: target.x, y: target.y, z: target.z,
                });
              }
              // Also update A-Frame entity position directly for visual sync
              const escaped = CSS.escape(this._grabbedObjectId);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const entity = (this.el.sceneEl as any).querySelector(`#${escaped}`);
              if (entity) {
                entity.object3D.position.set(target.x, target.y, target.z);
              }
              // Broadcast position to other users (throttle to ~10 Hz)
              const now = performance.now();
              if (!this._lastMoveTime || now - this._lastMoveTime > 100) {
                this._lastMoveTime = now;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const naf = (window as any).NAF;
                const adapter = naf?.connection?.adapter;
                if (adapter) {
                  adapter.broadcastData("object-moved", {
                    objectId: this._grabbedObjectId,
                    position: { x: target.x, y: target.y, z: target.z },
                  });
                }
              }
            }
          },
          remove: function () {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const canvas = (this.el.sceneEl as any)?.canvas;
            if (canvas) {
              canvas.removeEventListener("mousedown", this.onMouseDown);
              canvas.removeEventListener("mouseup", this.onMouseUp);
            }
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

          <!-- Environment (aframe-environment-component) -->
          <a-entity environment="preset: ${environmentPreset}; shadow: true"></a-entity>

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
              launch-raycaster
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

          // Initialize physics world
          const initPhysics = async () => {
            const CANNON = await import("cannon-es");
            const pw = new PhysicsWorld(CANNON);
            pw.createGround();
            physicsWorldRef.current = pw;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const system = (sceneEl as any).systems?.["physics-world"];
            if (system) {
              system.physicsWorld = pw;
            }
          };
          initPhysics();

          // Network receive handlers for object sync
          const initNetworkHandlers = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const naf = (window as any).NAF;
            const adapter = naf?.connection?.adapter;
            if (!adapter?.socket) {
              setTimeout(initNetworkHandlers, 500);
              return;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            adapter.socket.on("send", (msg: any) => {
              const { dataType, data } = msg;
              if (dataType === "object-placed") {
                const escaped = CSS.escape(data.objectId);
                if (sceneEl.querySelector(`#${escaped}`)) return;

                const sizeData = SIZE_MAP[data.size as keyof typeof SIZE_MAP];
                const entity = document.createElement(`a-${data.shape}`);

                if (data.shape === "box") {
                  entity.setAttribute("width", String(sizeData.box.w));
                  entity.setAttribute("height", String(sizeData.box.h));
                  entity.setAttribute("depth", String(sizeData.box.d));
                } else if (data.shape === "sphere") {
                  entity.setAttribute("radius", String(sizeData.sphere.r));
                } else {
                  entity.setAttribute("radius", String(sizeData.cylinder.r));
                  entity.setAttribute("height", String(sizeData.cylinder.h));
                }

                entity.setAttribute("material", `color: ${data.color}`);
                entity.setAttribute("shadow", "");
                entity.setAttribute(
                  "position",
                  `${data.position.x} ${data.position.y} ${data.position.z}`
                );
                entity.setAttribute("id", data.objectId);

                if (data.physics) {
                  entity.setAttribute(
                    "physics-body",
                    `type: dynamic; shape: ${data.shape}; size: ${data.size}; objectId: ${data.objectId}`
                  );
                }
                if (data.clickable) {
                  entity.setAttribute("clickable-object", `objectId: ${data.objectId}`);
                }
                if (data.grabbable) {
                  entity.setAttribute("grabbable-object", `objectId: ${data.objectId}`);
                }

                sceneEl.appendChild(entity);
              } else if (dataType === "object-launched") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const system = (sceneEl as any).systems?.["physics-world"];
                if (system && system.physicsWorld) {
                  system.physicsWorld.applyImpulse(data.objectId, data.impulse);
                }
              } else if (dataType === "asset-placed") {
                const escaped = CSS.escape(data.objectId);
                if (sceneEl.querySelector(`#${escaped}`)) return;

                let entity: HTMLElement;
                if (data.fileType === "model") {
                  entity = document.createElement("a-entity");
                  entity.setAttribute("gltf-model", `url(${data.assetUrl})`);
                  entity.setAttribute("scale", "1 1 1");
                } else if (data.fileType === "video") {
                  entity = document.createElement("a-video");
                  entity.setAttribute("src", data.assetUrl);
                  entity.setAttribute("width", "3");
                  entity.setAttribute("height", "1.69");
                  entity.setAttribute("autoplay", "true");
                  entity.setAttribute("loop", "true");
                } else {
                  entity = document.createElement("a-image");
                  entity.setAttribute("src", data.assetUrl);
                  entity.setAttribute("width", "2");
                  entity.setAttribute("height", "2");
                }

                entity.setAttribute(
                  "position",
                  `${data.position.x} ${data.position.y} ${data.position.z}`
                );
                entity.setAttribute("shadow", "");
                entity.setAttribute("id", data.objectId);

                if (data.physics) {
                  entity.setAttribute(
                    "physics-body",
                    `type: dynamic; shape: box; size: medium; objectId: ${data.objectId}`
                  );
                }
                if (data.clickable) {
                  entity.setAttribute("clickable-object", `objectId: ${data.objectId}`);
                }
                if (data.grabbable) {
                  entity.setAttribute("grabbable-object", `objectId: ${data.objectId}`);
                }

                sceneEl.appendChild(entity);
              } else if (dataType === "object-grabbed") {
                // Another user grabbed an object — make it kinematic
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const system = (sceneEl as any).systems?.["physics-world"];
                if (system && system.physicsWorld) {
                  system.physicsWorld.setKinematic(data.objectId);
                }
              } else if (dataType === "object-released") {
                // Another user released an object — restore dynamic
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const system = (sceneEl as any).systems?.["physics-world"];
                if (system && system.physicsWorld) {
                  system.physicsWorld.setDynamic(data.objectId);
                }
              } else if (dataType === "object-moved") {
                // Another user is moving a grabbed object — update position
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const system = (sceneEl as any).systems?.["physics-world"];
                if (system && system.physicsWorld) {
                  system.physicsWorld.setBodyPosition(data.objectId, data.position);
                }
                // Also update the A-Frame entity position visually
                const escaped = CSS.escape(data.objectId);
                const el = sceneEl.querySelector(`#${escaped}`);
                if (el) {
                  el.setAttribute("position", `${data.position.x} ${data.position.y} ${data.position.z}`);
                }
              }
            });
          };
          setTimeout(initNetworkHandlers, 1000);
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
        if (physicsWorldRef.current) {
          physicsWorldRef.current.destroy();
          physicsWorldRef.current = null;
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
  }, [roomCode, nafServerUrl, userName, environmentPreset]);

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

        {/* Item placement button */}
        <button
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setSettingsOpen(false);
            setItemDialogOpen(true);
          }}
          className="bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          title="オブジェクト設置"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </button>

        {/* Upload asset button */}
        <button
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setSettingsOpen(false);
            setUploadDialogOpen(true);
          }}
          className="bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          title="アセットアップロード"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        </button>
      </div>

      {/* Placement mode overlay */}
      {(placementMode || assetPlacementMode) && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <svg width="32" height="32" viewBox="0 0 32 32" className="text-white/70">
              <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="2" />
              <line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="2" />
              <circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 bg-black/70 text-white px-6 py-3 rounded-full text-sm flex items-center gap-3">
            <span>クリックで設置</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-300">ESCでキャンセル</span>
          </div>
        </>
      )}

      {/* Item dialog */}
      {itemDialogOpen && (
        <>
          <div
            className="absolute inset-0 z-40 bg-black/30"
            onClick={() => setItemDialogOpen(false)}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-900/95 backdrop-blur-sm text-white rounded-xl p-6 w-[560px] max-w-[90vw] max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">オブジェクト設置</h2>
              <button
                onClick={() => setItemDialogOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setObjectSource("primitive")}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  objectSource === "primitive"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                基本形状
              </button>
              <button
                onClick={() => { setObjectSource("asset"); setSelectedAssetForDialog(null); }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  objectSource === "asset"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                アップロードアセット
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {objectSource === "primitive" ? (
                /* === Primitive shapes tab === */
                <div className="flex gap-6">
                  {/* Left column - Property selectors */}
                  <div className="flex-1 space-y-4">
                    {/* Shape selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">形状</label>
                      <div className="flex gap-2">
                        {(["box", "sphere", "cylinder"] as const).map((shape) => (
                          <button
                            key={shape}
                            onClick={() => setObjectShape(shape)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                              objectShape === shape
                                ? "bg-blue-600 text-white"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                          >
                            {shape === "box" ? "ボックス" : shape === "sphere" ? "球体" : "シリンダー"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color palette */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">カラー</label>
                      <div className="grid grid-cols-6 gap-2">
                        {AVATAR_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setObjectColor(color)}
                            className={`w-full aspect-square rounded-lg border-2 transition-all ${
                              objectColor === color
                                ? "border-white scale-110"
                                : "border-transparent hover:border-gray-500"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="color"
                          value={objectColor}
                          onChange={(e) => setObjectColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-gray-600 bg-transparent"
                        />
                        <input
                          type="text"
                          value={objectColor}
                          onChange={(e) => {
                            if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value))
                              setObjectColor(e.target.value);
                          }}
                          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Size selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">サイズ</label>
                      <div className="flex gap-2">
                        {(["small", "medium", "large"] as const).map((size) => (
                          <button
                            key={size}
                            onClick={() => setObjectSize(size)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                              objectSize === size
                                ? "bg-blue-600 text-white"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                          >
                            {size === "small" ? "小" : size === "medium" ? "中" : "大"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right column - 3D Preview */}
                  <div className="w-48 flex flex-col items-center">
                    <label className="block text-sm font-medium text-gray-300 mb-2">プレビュー</label>
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                      <canvas ref={previewCanvasRef} width={180} height={180} />
                    </div>
                  </div>
                </div>
              ) : (
                /* === Upload assets tab === */
                <div className="space-y-3">
                  {/* Upload area */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".glb,.gltf,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full py-2.5 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 hover:bg-gray-800/50 transition-colors text-gray-300 text-sm disabled:opacity-50"
                    >
                      {uploading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          アップロード中...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          ファイルを選択 (.glb, .gltf, .png, .jpg, .webp, .mp4, .webm, .mov)
                        </span>
                      )}
                    </button>
                    {uploadError && (
                      <p className="text-red-400 text-sm mt-1">{uploadError}</p>
                    )}
                  </div>

                  {/* Asset gallery */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      アセット一覧 ({uploadedAssets.length})
                    </label>
                    {uploadedAssets.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-6">
                        まだアセットがありません
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-[240px] overflow-y-auto">
                        {uploadedAssets.map((asset) => (
                          <div
                            key={asset.asset_id}
                            className={`relative group rounded-lg p-2 cursor-pointer transition-all ${
                              selectedAssetForDialog?.asset_id === asset.asset_id
                                ? "bg-blue-600/30 ring-2 ring-blue-500"
                                : "bg-gray-800 hover:bg-gray-700"
                            }`}
                            onClick={() => setSelectedAssetForDialog(asset)}
                          >
                            {/* Thumbnail */}
                            <div className="w-full aspect-square rounded bg-gray-700 flex items-center justify-center overflow-hidden mb-1">
                              {asset.file_type === "image" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`/uploads/${asset.stored_name}`}
                                  alt={asset.file_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : asset.file_type === "video" ? (
                                <video
                                  src={`/uploads/${asset.stored_name}`}
                                  className="w-full h-full object-cover"
                                  preload="metadata"
                                  muted
                                  playsInline
                                />
                              ) : asset.file_type === "model" ? (
                                <ModelThumbnail
                                  src={`/uploads/${asset.stored_name}`}
                                  alt={asset.file_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              )}
                            </div>
                            {/* Filename */}
                            <p className="text-xs text-gray-300 truncate" title={asset.file_name}>
                              {asset.file_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {asset.file_size < 1024 * 1024
                                ? `${(asset.file_size / 1024).toFixed(0)} KB`
                                : `${(asset.file_size / (1024 * 1024)).toFixed(1)} MB`}
                            </p>
                            {/* Delete button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (selectedAssetForDialog?.asset_id === asset.asset_id) {
                                  setSelectedAssetForDialog(null);
                                }
                                handleDeleteAsset(asset.asset_id);
                              }}
                              className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="削除"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Physics & interaction options (shared across both tabs) */}
            <div className="space-y-2 pt-3 mt-3 border-t border-gray-700">
              <label className="block text-sm font-medium text-gray-300 mb-1">オプション</label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={physicsEnabled}
                  onChange={(e) => {
                    setPhysicsEnabled(e.target.checked);
                    if (!e.target.checked) {
                      setClickableEnabled(false);
                      setGrabbableEnabled(false);
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-sm text-gray-300">物理エンジン</span>
                <span className="text-xs text-gray-500">（重力・衝突）</span>
              </label>
              <div className={`space-y-2 ${!physicsEnabled ? "opacity-40 pointer-events-none" : ""}`}>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="interactionMode"
                    checked={!clickableEnabled && !grabbableEnabled}
                    onChange={() => { setClickableEnabled(false); setGrabbableEnabled(false); }}
                    disabled={!physicsEnabled}
                    className="w-4 h-4 border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-gray-300">なし</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="interactionMode"
                    checked={clickableEnabled}
                    onChange={() => { setClickableEnabled(true); setGrabbableEnabled(false); }}
                    disabled={!physicsEnabled}
                    className="w-4 h-4 border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-gray-300">クリックで飛ばす</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="interactionMode"
                    checked={grabbableEnabled}
                    onChange={() => { setGrabbableEnabled(true); setClickableEnabled(false); }}
                    disabled={!physicsEnabled}
                    className="w-4 h-4 border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-gray-300">つかむ</span>
                </label>
              </div>
            </div>

            {/* Place button */}
            <button
              onClick={handleStartPlacement}
              disabled={objectSource === "asset" && !selectedAssetForDialog}
              className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
            >
              設置
            </button>
          </div>
        </>
      )}

      {/* Upload dialog */}
      {uploadDialogOpen && (
        <>
          <div
            className="absolute inset-0 z-40 bg-black/30"
            onClick={() => setUploadDialogOpen(false)}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-900/95 backdrop-blur-sm text-white rounded-xl p-6 w-[520px] max-w-[90vw] max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">アセットアップロード</h2>
              <button
                onClick={() => setUploadDialogOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Upload area */}
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,.gltf,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-3 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 hover:bg-gray-800/50 transition-colors text-gray-300 text-sm disabled:opacity-50"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    アップロード中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    ファイルを選択 (.glb, .gltf, .png, .jpg, .webp, .mp4, .webm, .mov)
                  </span>
                )}
              </button>
              {uploadError && (
                <p className="text-red-400 text-sm mt-2">{uploadError}</p>
              )}
            </div>

            {/* Gallery */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                アップロード済みアセット ({uploadedAssets.length})
              </label>
              {uploadedAssets.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  まだアセットがありません
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {uploadedAssets.map((asset) => (
                    <div
                      key={asset.asset_id}
                      className="relative group bg-gray-800 rounded-lg p-2 cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() =>
                        handleStartAssetPlacement({
                          stored_name: asset.stored_name,
                          file_type: asset.file_type,
                        })
                      }
                    >
                      {/* Thumbnail */}
                      <div className="w-full aspect-square rounded bg-gray-700 flex items-center justify-center overflow-hidden mb-1">
                        {asset.file_type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/uploads/${asset.stored_name}`}
                            alt={asset.file_name}
                            className="w-full h-full object-cover"
                          />
                        ) : asset.file_type === "video" ? (
                          <video
                            src={`/uploads/${asset.stored_name}`}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                          />
                        ) : asset.file_type === "model" ? (
                          <ModelThumbnail
                            src={`/uploads/${asset.stored_name}`}
                            alt={asset.file_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        )}
                      </div>
                      {/* Filename */}
                      <p className="text-xs text-gray-300 truncate" title={asset.file_name}>
                        {asset.file_name}
                      </p>
                      {/* Size */}
                      <p className="text-xs text-gray-500">
                        {asset.file_size < 1024 * 1024
                          ? `${(asset.file_size / 1024).toFixed(0)} KB`
                          : `${(asset.file_size / (1024 * 1024)).toFixed(1)} MB`}
                      </p>
                      {/* Delete button (visible on hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAsset(asset.asset_id);
                        }}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="削除"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hint */}
            {uploadedAssets.length > 0 && (
              <p className="text-gray-500 text-xs text-center mt-3">
                アセットをクリックして配置モードへ
              </p>
            )}
          </div>
        </>
      )}

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

      {/* Crosshair / Hand cursor – visible when pointer is locked */}
      {crosshairVisible && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          {cursorMode === "openHand" ? (
            /* Open hand icon – hovering a grabbable object */
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Palm */}
              <path d="M16 28C10.5 28 8 24 8 19V14" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.9"/>
              <path d="M24 19C24 24 21.5 28 16 28" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.9"/>
              {/* Fingers spread open */}
              <line x1="10" y1="14" x2="10" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              <line x1="14" y1="13" x2="14" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              <line x1="18" y1="13" x2="18" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              <line x1="22" y1="14" x2="22" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              {/* Thumb */}
              <path d="M8 14L6 11" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
            </svg>
          ) : cursorMode === "closedHand" ? (
            /* Closed hand icon – grabbing an object */
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Palm */}
              <path d="M16 28C10.5 28 8 24 8 19V15" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.9"/>
              <path d="M24 19C24 24 21.5 28 16 28" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.9"/>
              {/* Fingers curled */}
              <path d="M10 15C10 13 10.5 12 11 12" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              <path d="M13 14C13 12 13.5 11 14.5 11" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              <path d="M17.5 11C18.5 11 19 12 19 14" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              <path d="M21 12C21.5 12 22 13 22 15" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              {/* Knuckle line */}
              <path d="M9 15H23" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
              {/* Thumb */}
              <path d="M8 15L7 13" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
            </svg>
          ) : (
            /* Default crosshair */
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Horizontal line */}
              <line x1="2" y1="12" x2="10" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              <line x1="14" y1="12" x2="22" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              {/* Vertical line */}
              <line x1="12" y1="2" x2="12" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              <line x1="12" y1="14" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              {/* Center dot */}
              <circle cx="12" cy="12" r="1.5" fill="white" opacity="0.9" />
            </svg>
          )}
        </div>
      )}

      <div ref={sceneRef} className="w-full h-full" />
    </div>
  );
}
