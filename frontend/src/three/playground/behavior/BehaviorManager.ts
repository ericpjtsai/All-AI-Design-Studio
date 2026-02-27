import { AgentBehavior, ActiveEncounter } from '../../../playground/types';
import { AgentStateBuffer } from './AgentStateBuffer';
import { AgentData, PLAYER_INDEX } from '../../../playground/agents';
import { usePlaygroundStore } from '../../../playground/store';

const NPC_COLLISION_RADIUS = 0.8;
const PLAYER_ENCOUNTER_RADIUS = 1.5;
const PLAYER_ARRIVAL_RADIUS = 0.3;
const FROZEN_DURATION_MS = 4000;
const MAX_FROZEN_PAIRS = 10;
const UNFREEZE_COOLDOWN_MS = 800;

interface FrozenPair {
  a: number;
  b: number;
  expiresAt: number;
  talkingA: boolean;
  nextSwap: number;
}

export class BehaviorManager {
  private frozenPairs = new Map<string, FrozenPair>();
  private frozenIndices = new Set<number>();
  private unfreezeTimestamps = new Map<number, number>();
  private currentEncounterNPC: number | null = null;
  private chatNPC: number | null = null;

  constructor(
    private stateBuffer: AgentStateBuffer,
    private agents: AgentData[],
    private onEncounterChange: (encounter: ActiveEncounter | null) => void,
    private onSpeakingTrigger: (index: number, isSpeaking: boolean) => void,
    private onPlayerArrivedAtNPC: (index: number) => void,
  ) {
    stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
  }

  public update(positions: Float32Array): void {
    const now = Date.now();
    const count = this.agents.length;

    // 1. Expire frozen NPC pairs
    for (const [key, pair] of this.frozenPairs) {
      if (now > pair.expiresAt) {
        this.stateBuffer.setState(pair.a, AgentBehavior.BOIDS);
        this.stateBuffer.setState(pair.b, AgentBehavior.BOIDS);
        this.onSpeakingTrigger(pair.a, false);
        this.onSpeakingTrigger(pair.b, false);
        this.frozenIndices.delete(pair.a);
        this.frozenIndices.delete(pair.b);
        this.unfreezeTimestamps.set(pair.a, now);
        this.unfreezeTimestamps.set(pair.b, now);
        this.frozenPairs.delete(key);
      } else {
        if (now > pair.nextSwap) {
          pair.talkingA = !pair.talkingA;
          pair.nextSwap = now + 1500 + Math.random() * 1500;
          this.onSpeakingTrigger(pair.a, pair.talkingA);
          this.onSpeakingTrigger(pair.b, !pair.talkingA);
        }
      }
    }

    for (const [idx, ts] of this.unfreezeTimestamps) {
      if (now - ts > UNFREEZE_COOLDOWN_MS) this.unfreezeTimestamps.delete(idx);
    }

    // 2. Detect new NPC↔NPC collisions
    if (this.frozenPairs.size < MAX_FROZEN_PAIRS) {
      for (let i = 1; i < count - 1; i++) {
        if (this.frozenIndices.has(i)) continue;
        if (this.stateBuffer.getState(i) !== AgentBehavior.BOIDS) continue;
        if (this.unfreezeTimestamps.has(i)) continue;

        for (let j = i + 1; j < count; j++) {
          if (this.frozenIndices.has(j)) continue;
          if (this.stateBuffer.getState(j) !== AgentBehavior.BOIDS) continue;
          if (this.unfreezeTimestamps.has(j)) continue;

          const dx = positions[i * 4] - positions[j * 4];
          const dz = positions[i * 4 + 2] - positions[j * 4 + 2];

          if (dx * dx + dz * dz < NPC_COLLISION_RADIUS * NPC_COLLISION_RADIUS) {
            this.stateBuffer.setState(i, AgentBehavior.TALK);
            this.stateBuffer.setState(j, AgentBehavior.TALK);

            const talkingA = Math.random() > 0.5;
            this.onSpeakingTrigger(i, talkingA);
            this.onSpeakingTrigger(j, !talkingA);

            const dirX = positions[j * 4] - positions[i * 4];
            const dirZ = positions[j * 4 + 2] - positions[i * 4 + 2];
            this.stateBuffer.setWaypoint(i, dirX, dirZ);
            this.stateBuffer.setWaypoint(j, -dirX, -dirZ);

            this.frozenIndices.add(i);
            this.frozenIndices.add(j);
            const key = `${i}-${j}`;
            this.frozenPairs.set(key, {
              a: i, b: j,
              expiresAt: now + FROZEN_DURATION_MS,
              talkingA,
              nextSwap: now + 1500 + Math.random() * 1000
            });

            if (this.frozenPairs.size >= MAX_FROZEN_PAIRS) break;
          }
        }
        if (this.frozenPairs.size >= MAX_FROZEN_PAIRS) break;
      }
    }

    // 3. Detect player GOTO arrival
    if (this.stateBuffer.getState(PLAYER_INDEX) === AgentBehavior.GOTO) {
      const wp = this.stateBuffer.getWaypoint(PLAYER_INDEX);
      const pdx = wp.x - positions[PLAYER_INDEX * 4];
      const pdz = wp.z - positions[PLAYER_INDEX * 4 + 2];
      if (pdx * pdx + pdz * pdz < PLAYER_ARRIVAL_RADIUS * PLAYER_ARRIVAL_RADIUS) {
        this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);

        if (this.chatNPC !== null) {
          const finishedNPC = this.chatNPC;
          const nx = positions[finishedNPC * 4];
          const nz = positions[finishedNPC * 4 + 2];
          const fx = nx - positions[PLAYER_INDEX * 4];
          const fz = nz - positions[PLAYER_INDEX * 4 + 2];
          this.stateBuffer.setWaypoint(PLAYER_INDEX, fx, fz);
          usePlaygroundStore.getState().setAnimation('Wave');
          this.onPlayerArrivedAtNPC(finishedNPC);
          this.chatNPC = null;
        } else {
          this.stateBuffer.setWaypoint(PLAYER_INDEX, pdx, pdz);
        }
      }
    }

    // 4. Detect player↔NPC proximity
    const px = positions[PLAYER_INDEX * 4];
    const pz = positions[PLAYER_INDEX * 4 + 2];
    let nearestNPC: number | null = null;
    let nearestDist2 = PLAYER_ENCOUNTER_RADIUS * PLAYER_ENCOUNTER_RADIUS;

    for (let i = 1; i < count; i++) {
      const dx = px - positions[i * 4];
      const dz = pz - positions[i * 4 + 2];
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestDist2) {
        nearestDist2 = d2;
        nearestNPC = i;
      }
    }

    if (nearestNPC !== this.currentEncounterNPC) {
      this.currentEncounterNPC = nearestNPC;
      if (nearestNPC !== null) {
        const agent = this.agents[nearestNPC];
        this.onEncounterChange({
          npcIndex: nearestNPC,
          npcDepartment: agent.department,
          npcRole: agent.role,
          npcMission: agent.mission,
          npcPersonality: agent.personality,
        });
      } else {
        this.onEncounterChange(null);
      }
    }
  }

  public setPlayerWaypoint(x: number, z: number): void {
    this.chatNPC = null;
    this.stateBuffer.setWaypoint(PLAYER_INDEX, x, z);
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.GOTO);
  }

  public startChat(npcIndex: number, positions: Float32Array): void {
    const nx = positions[npcIndex * 4];
    const nz = positions[npcIndex * 4 + 2];
    const px = positions[PLAYER_INDEX * 4];
    const pz = positions[PLAYER_INDEX * 4 + 2];

    let dx = px - nx;
    let dz = pz - nz;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.01) { dx = 1; dz = 0; }
    else { dx /= dist; dz /= dist; }

    const targetX = nx + dx * 1.2;
    const targetZ = nz + dz * 1.2;

    this.stateBuffer.setWaypoint(PLAYER_INDEX, targetX, targetZ);
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.GOTO);
    this.chatNPC = npcIndex;

    this.stateBuffer.setState(npcIndex, AgentBehavior.FROZEN);
    this.stateBuffer.setWaypoint(npcIndex, dx, dz);

    for (const [key, pair] of this.frozenPairs) {
      if (pair.a === npcIndex || pair.b === npcIndex) {
        const other = pair.a === npcIndex ? pair.b : pair.a;
        this.stateBuffer.setState(other, AgentBehavior.BOIDS);
        this.frozenIndices.delete(pair.a);
        this.frozenIndices.delete(pair.b);
        this.frozenPairs.delete(key);
        break;
      }
    }
  }

  public endChat(npcIndex: number | null): void {
    this.chatNPC = null;
    if (npcIndex !== null) {
      this.stateBuffer.setState(npcIndex, AgentBehavior.BOIDS);
    }
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
  }
}
