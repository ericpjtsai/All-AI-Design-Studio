// SceneManager is no longer used — the 3D graph was replaced by the 2D SVG
// AgentGraph component in the left panel. This file is kept to avoid
// breaking the TypeScript project include, but is not instantiated anywhere.

export class SceneManager {
  constructor(_container: HTMLElement) {}
  dispose(): void {}
}
