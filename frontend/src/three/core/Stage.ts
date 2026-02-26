import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Stage {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;

  constructor(rendererElement: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09090b); // zinc-950

    // Camera looks at the center of the interaction graph (y ≈ 6.2)
    const aspect = rendererElement.clientWidth / (rendererElement.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
    this.camera.position.set(0, 10, 18);

    this.controls = new OrbitControls(this.camera, rendererElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.rotateSpeed = 0.7;
    this.controls.minPolarAngle = Math.PI / 8;
    this.controls.maxPolarAngle = (Math.PI / 2) * 0.95;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 32;
    this.controls.target.set(0, 6.2, 0); // center of graph

    this.setupLights();
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5 * Math.PI);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.4 * Math.PI);
    dir.position.set(6, 12, 8);
    this.scene.add(dir);

    // Subtle fill from below
    const fill = new THREE.PointLight(0x334155, 1.5 * Math.PI, 30);
    fill.position.set(0, 2, 0);
    this.scene.add(fill);
  }

  public onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public update(): void {
    this.controls.update();
  }
}
