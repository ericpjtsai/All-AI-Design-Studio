import * as THREE from 'three/webgpu';

export class Engine {
  public renderer: THREE.WebGPURenderer;
  public timer: THREE.Timer;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x09090b); // zinc-950
    container.appendChild(this.renderer.domElement);
    this.timer = new THREE.Timer();
  }

  public async init(): Promise<void> {
    try {
      await this.renderer.init();
    } catch (e) {
      console.warn('WebGPU unavailable, falling back to WebGL:', e);
    }
  }

  public onResize(width: number, height: number): void {
    this.renderer.setSize(width, height);
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.renderer.render(scene, camera);
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}
