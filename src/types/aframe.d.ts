declare module "aframe" {
  const AFRAME: {
    registerComponent: (name: string, definition: Record<string, unknown>) => void;
    registerAdapter: (name: string, adapter: unknown) => void;
    components: Record<string, unknown>;
    [key: string]: unknown;
  };
  export default AFRAME;
}

declare module "networked-aframe" {
  const NAF: unknown;
  export default NAF;
}
