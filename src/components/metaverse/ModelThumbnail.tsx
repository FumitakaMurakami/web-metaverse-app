"use client";

import { useEffect, useState, useRef } from "react";

interface ModelThumbnailProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Renders a static thumbnail of a GLB/GLTF model using Three.js.
 * Creates an offscreen canvas, loads the model, renders one frame,
 * captures it as a data URL, then disposes of all GPU resources.
 */
export default function ModelThumbnail({
  src,
  alt,
  className = "",
}: ModelThumbnailProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const renderingRef = useRef(false);

  useEffect(() => {
    if (renderingRef.current) return;
    renderingRef.current = true;

    let disposed = false;

    const render = async () => {
      try {
        // Wait for THREE to be available (loaded by A-Frame)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const THREE = (window as any).THREE;
        if (!THREE) {
          // Retry after a short delay if THREE isn't loaded yet
          await new Promise((resolve) => setTimeout(resolve, 1000));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const retryTHREE = (window as any).THREE;
          if (!retryTHREE) {
            throw new Error("THREE.js not available");
          }
          return renderWithThree(retryTHREE);
        }
        return renderWithThree(THREE);
      } catch {
        if (!disposed) {
          setError(true);
          setLoading(false);
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderWithThree = async (THREE: any) => {
      const SIZE = 256;

      // Create offscreen canvas and renderer
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(SIZE, SIZE);
      renderer.setClearColor(0x374151, 1); // gray-700 background
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // Scene setup
      const scene = new THREE.Scene();

      // Camera
      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(2, 3, 4);
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
      fillLight.position.set(-2, 1, -1);
      scene.add(fillLight);

      // Load model using GLTFLoader
      const { GLTFLoader } = await import(
        // @ts-expect-error - three addons path
        "three/addons/loaders/GLTFLoader.js"
      );

      const loader = new GLTFLoader();

      const gltf = await new Promise<{ scene: typeof scene }>(
        (resolve, reject) => {
          loader.load(
            src,
            resolve,
            undefined,
            reject
          );
        }
      );

      if (disposed) {
        renderer.dispose();
        return;
      }

      const model = gltf.scene;
      scene.add(model);

      // Calculate bounding box and fit camera
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Position camera to fit the model
      const fov = camera.fov * (Math.PI / 180);
      const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * 1.5;

      camera.position.set(
        center.x + cameraDistance * 0.7,
        center.y + cameraDistance * 0.5,
        center.z + cameraDistance * 0.7
      );
      camera.lookAt(center);
      camera.near = cameraDistance * 0.01;
      camera.far = cameraDistance * 10;
      camera.updateProjectionMatrix();

      // Render one frame
      renderer.render(scene, camera);

      // Capture as data URL
      const url = canvas.toDataURL("image/png");

      if (!disposed) {
        setDataUrl(url);
        setLoading(false);
      }

      // Dispose resources
      renderer.dispose();
      scene.traverse((obj: { geometry?: { dispose: () => void }; material?: { dispose: () => void } | Array<{ dispose: () => void }> }) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };

    render();

    return () => {
      disposed = true;
    };
  }, [src]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400" />
      </div>
    );
  }

  if (error || !dataUrl) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={alt}
      className={className}
    />
  );
}
