/**
 * DataStreamRenderer — draws animated "data-passing" beams between agents.
 *
 * Each stream consists of:
 *   • A dashed arc line (animating dashOffset for the "flowing" effect)
 *   • 5 small pulse spheres moving along the arc
 *
 * Streams fade in, run for `durationMs`, then fade out and self-remove.
 *
 * Works with three/webgpu (WebGPU Three.js build) — uses only standard
 * material APIs that are compatible with the WebGPU backend.
 */

import * as THREE from 'three/webgpu';

const NUM_PULSES   = 5;
const ARC_SEGMENTS = 24;
const BEAM_HEIGHT  = 1.25; // world-space Y of the beam at character "chest"
const ARC_LIFT     = 1.0;  // extra Y for the arc midpoint

export interface StreamConfig {
  sourceNpcIdx: number; // playground NPC index (1–4)
  targetNpcIdx: number;
  color: string;        // hex, e.g. '#22c55e'
  durationMs: number;
}

interface ActiveStream {
  id: string;
  line: THREE.Line;
  pulses: THREE.Mesh[];
  pulseProgress: number[];  // 0–1, staggered start
  curve: THREE.QuadraticBezierCurve3;
  config: StreamConfig;
  dashMat: THREE.LineDashedMaterial;
  startMs: number;
  lastElapsedSec: number;
}

export class DataStreamRenderer {
  private streams = new Map<string, ActiveStream>();
  private sharedPulseGeom: THREE.SphereGeometry;

  constructor(private readonly scene: THREE.Scene) {
    // Single shared geometry for all pulse spheres
    this.sharedPulseGeom = new THREE.SphereGeometry(0.055, 8, 6);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Trigger a new data stream. Idempotent — if id already exists, ignored. */
  addStream(id: string, config: StreamConfig): void {
    if (this.streams.has(id)) return;

    const threeColor = new THREE.Color(config.color);

    // ── Arc geometry (placeholder positions, updated each frame) ──
    const pts = this._buildArcPoints(
      new THREE.Vector3(0, BEAM_HEIGHT, 0),
      new THREE.Vector3(1, BEAM_HEIGHT, 1),
    );
    const curve = new THREE.QuadraticBezierCurve3(pts[0], pts[1], pts[2]);
    const linePoints = curve.getPoints(ARC_SEGMENTS);
    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);

    const dashMat = new THREE.LineDashedMaterial({
      color: threeColor,
      dashSize: 0.2,
      gapSize: 0.12,
      opacity: 0,
      transparent: true,
      linewidth: 1.5,
    });

    const line = new THREE.Line(lineGeom, dashMat);
    line.computeLineDistances();
    this.scene.add(line);

    // ── Pulse spheres ──
    const pulses: THREE.Mesh[] = [];
    const pulseProgress: number[] = [];

    for (let p = 0; p < NUM_PULSES; p++) {
      const mat = new THREE.MeshBasicMaterial({
        color: threeColor,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(this.sharedPulseGeom, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      pulses.push(mesh);
      // Stagger starting positions so they don't bunch together
      pulseProgress.push(p / NUM_PULSES);
    }

    this.streams.set(id, {
      id,
      line,
      pulses,
      pulseProgress,
      curve,
      config,
      dashMat,
      startMs: Date.now(),
      lastElapsedSec: 0,
    });
  }

  /** Remove a stream immediately (without waiting for it to expire). */
  removeStream(id: string): void {
    const s = this.streams.get(id);
    if (!s) return;

    this.scene.remove(s.line);
    s.line.geometry.dispose();
    (s.line.material as THREE.Material).dispose();

    for (const p of s.pulses) {
      this.scene.remove(p);
      (p.material as THREE.Material).dispose();
    }
    // Shared geometry — only dispose when renderer is destroyed
    this.streams.delete(id);
  }

  /** Call every frame from PlaygroundScene.animate(). */
  update(positions: Float32Array, elapsedSec: number): void {
    const toRemove: string[] = [];

    for (const [id, s] of this.streams) {
      const elapsed = Date.now() - s.startMs;
      const t = Math.min(elapsed / s.config.durationMs, 1);
      const dt = elapsedSec - s.lastElapsedSec;
      s.lastElapsedSec = elapsedSec;

      if (t >= 1) {
        toRemove.push(id);
        continue;
      }

      // ── Update arc endpoints from live positions ──
      const si = s.config.sourceNpcIdx;
      const ti = s.config.targetNpcIdx;
      const src = new THREE.Vector3(positions[si * 4], BEAM_HEIGHT, positions[si * 4 + 2]);
      const dst = new THREE.Vector3(positions[ti * 4], BEAM_HEIGHT, positions[ti * 4 + 2]);

      const [p0, ctrl, p2] = this._buildArcPoints(src, dst);
      s.curve.v0.copy(p0);
      s.curve.v1.copy(ctrl);
      s.curve.v2.copy(p2);

      const linePoints = s.curve.getPoints(ARC_SEGMENTS);
      (s.line.geometry as THREE.BufferGeometry).setFromPoints(linePoints);
      s.line.computeLineDistances();

      // ── Fade in / out envelope ──
      const fade = t < 0.12 ? t / 0.12 : t > 0.88 ? (1 - t) / 0.12 : 1;

      // ── Animate dashes (move "forward" along the line) ──
      s.dashMat.opacity = 0.65 * fade;
      s.dashMat.dashOffset -= dt * 2.2;

      // ── Move pulse spheres ──
      for (let p = 0; p < NUM_PULSES; p++) {
        s.pulseProgress[p] = (s.pulseProgress[p] + dt * 0.55) % 1;
        const progress = s.pulseProgress[p];
        const pt = s.curve.getPoint(progress);
        s.pulses[p].position.copy(pt);

        // Fade edges of the arc
        const distFromMid = Math.abs(progress - 0.5);
        const pulseFade = Math.max(0, (0.5 - distFromMid) * 2.2);
        const mat = s.pulses[p].material as THREE.MeshBasicMaterial;
        mat.opacity = Math.min(pulseFade * fade, 0.95);
        s.pulses[p].visible = mat.opacity > 0.05;
      }
    }

    for (const id of toRemove) this.removeStream(id);
  }

  dispose(): void {
    for (const [id] of this.streams) this.removeStream(id);
    this.sharedPulseGeom.dispose();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _buildArcPoints(
    src: THREE.Vector3,
    dst: THREE.Vector3,
  ): [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
    const mid = src.clone().lerp(dst, 0.5);
    mid.y += ARC_LIFT;
    return [src.clone(), mid, dst.clone()];
  }
}
