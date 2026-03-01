/**
 * FormationController — positions NPCs in a circular "Command Center" formation.
 *
 * When the workflow starts, all 4 NPCs walk (GOTO) to their fixed positions
 * around a central holographic table, then freeze and face the center.
 *
 * Also provides LookAt helpers so agents can face each other during
 * passing_data / reviewing workflow events.
 */

import { AgentStateBuffer } from './AgentStateBuffer';
import { AgentBehavior } from '../../../playground/types';

// NPC indices 1–4 map to Design Manager, Senior, Visual, Junior.
// Positions are on a circle of radius FORMATION_RADIUS in the XZ plane.
const FORMATION_RADIUS = 3.2;
const ARRIVAL_THRESHOLD = 0.28 * 0.28; // squared for cheap distance check

// Evenly-spaced angles so each agent has a clear "seat" at the table.
// Offset by 45° so none of them point directly at the camera default.
const ANGLES_DEG = [45, 135, 225, 315]; // NPC 1→4

export interface FormationSlot {
  x: number;
  z: number;
}

export const FORMATION_SLOTS: FormationSlot[] = ANGLES_DEG.map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * FORMATION_RADIUS, z: Math.sin(rad) * FORMATION_RADIUS };
});

export class FormationController {
  private active = false;
  private arrived = new Set<number>();
  private facingTargets = new Map<number, number>(); // npcIdx → targetNpcIdx
  private returnToCenter = new Set<number>();         // after LookAt, face center again

  constructor(private readonly stateBuffer: AgentStateBuffer) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.arrived.clear();
    this.facingTargets.clear();
    this.returnToCenter.clear();

    for (let i = 1; i <= 4; i++) {
      const slot = FORMATION_SLOTS[i - 1];
      this.stateBuffer.setWaypoint(i, slot.x, slot.z);
      this.stateBuffer.setState(i, AgentBehavior.GOTO);
    }
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.arrived.clear();
    this.facingTargets.clear();
    this.returnToCenter.clear();

    for (let i = 1; i <= 4; i++) {
      this.stateBuffer.setState(i, AgentBehavior.BOIDS);
    }
  }

  // ── Per-frame update (called inside syncFromGPU.then) ─────────────────────

  update(positions: Float32Array): void {
    if (!this.active) return;

    for (let i = 1; i <= 4; i++) {
      const px = positions[i * 4];
      const pz = positions[i * 4 + 2];

      if (!this.arrived.has(i)) {
        const slot = FORMATION_SLOTS[i - 1];
        const dx = slot.x - px;
        const dz = slot.z - pz;
        if (dx * dx + dz * dz < ARRIVAL_THRESHOLD) {
          this.stateBuffer.setState(i, AgentBehavior.FROZEN);
          this._applyFacing(i, positions);
          this.arrived.add(i);
        }
        continue; // still walking — don't override GOTO with facing
      }

      // Already in position — apply facing updates
      if (this.facingTargets.has(i) || this.returnToCenter.has(i)) {
        this._applyFacing(i, positions);
      }
    }
  }

  // ── Facing helpers ────────────────────────────────────────────────────────

  /** Make sourceNpcIdx look toward targetNpcIdx. */
  lookAt(sourceNpcIdx: number, targetNpcIdx: number): void {
    this.facingTargets.set(sourceNpcIdx, targetNpcIdx);
    this.returnToCenter.delete(sourceNpcIdx);
  }

  /** Make sourceNpcIdx look back at the center after a LookAt. */
  faceCenter(npcIdx: number): void {
    this.facingTargets.delete(npcIdx);
    this.returnToCenter.add(npcIdx);
  }

  /** Make all arrived agents face the center. */
  allFaceCenter(): void {
    this.facingTargets.clear();
    this.returnToCenter.clear();
    for (const i of this.arrived) {
      this.returnToCenter.add(i);
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _applyFacing(npcIdx: number, positions: Float32Array): void {
    const px = positions[npcIdx * 4];
    const pz = positions[npcIdx * 4 + 2];
    const targetNpcIdx = this.facingTargets.get(npcIdx);

    let dx: number;
    let dz: number;

    if (targetNpcIdx !== undefined) {
      // Face another agent
      const tx = positions[targetNpcIdx * 4];
      const tz = positions[targetNpcIdx * 4 + 2];
      dx = tx - px;
      dz = tz - pz;
    } else {
      // Face center (0, 0)
      dx = -px;
      dz = -pz;
    }

    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0.01) {
      this.stateBuffer.setWaypoint(npcIdx, dx / len, dz / len);
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  isActive(): boolean { return this.active; }
  isArrived(npcIdx: number): boolean { return this.arrived.has(npcIdx); }
  allArrived(): boolean { return this.arrived.size >= 4; }
  getSlot(npcIdx: number): FormationSlot | null {
    return npcIdx >= 1 && npcIdx <= 4 ? FORMATION_SLOTS[npcIdx - 1] : null;
  }
}
