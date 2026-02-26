import * as THREE from 'three/webgpu';
import { Engine } from './core/Engine';
import { Stage } from './core/Stage';
import { InteractionGraphManager } from './graph/InteractionGraphManager';
import { useStore } from '../store/useStore';

export class SceneManager {
  private engine: Engine;
  private stage: Stage;
  private graph: InteractionGraphManager | null = null;
  private isDisposed = false;

  private boundOnResize: () => void;

  constructor(container: HTMLElement) {
    this.engine = new Engine(container);
    this.stage = new Stage(this.engine.renderer.domElement);
    this.boundOnResize = this.onResize.bind(this);
    this.init();
  }

  private async init(): Promise<void> {
    await this.engine.init();
    if (this.isDisposed) return;

    this.graph = new InteractionGraphManager(this.stage.scene);

    // Apply initial graphVisible state
    this.graph.setVisible(useStore.getState().graphVisible);

    // React to toggle
    useStore.subscribe((state, prev) => {
      if (state.graphVisible !== prev.graphVisible) {
        this.graph?.setVisible(state.graphVisible);
      }
    });

    this.engine.renderer.setAnimationLoop(this.animate.bind(this));
    window.addEventListener('resize', this.boundOnResize);
  }

  private onResize(): void {
    const canvas = this.engine.renderer.domElement;
    const container = canvas.parentElement;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.engine.onResize(w, h);
    this.stage.onResize(w, h);
  }

  private animate(): void {
    this.engine.timer.update();
    const elapsed = this.engine.timer.getElapsed();

    this.stage.update();

    const { agentStates, graphVisible } = useStore.getState();

    // Determine which NPC the Design Manager is currently delegating to
    const activeNpc = agentStates.find((a) => a.index !== 0 && a.isActive) ?? null;
    this.graph?.setActiveNpc(activeNpc?.index ?? null);

    if (graphVisible && this.graph) {
      this.graph.update(elapsed);

      // Project node world positions → screen space for HTML labels
      const worldPositions = this.graph.getNodeWorldPositions();
      const canvas = this.engine.renderer.domElement;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      const screenPositions = worldPositions.map((pos) => {
        const projected = pos.clone().project(this.stage.camera);
        if (projected.z > 1) return null; // behind camera
        return {
          x: (projected.x * 0.5 + 0.5) * w,
          y: (projected.y * -0.5 + 0.5) * h,
        };
      });

      useStore.getState().setGraphNodeScreenPositions(screenPositions);
    }

    this.engine.render(this.stage.scene, this.stage.camera);
  }

  public dispose(): void {
    this.isDisposed = true;
    this.engine.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.boundOnResize);
    this.graph?.dispose();
    this.stage.controls.dispose();
    this.engine.dispose();
  }
}
