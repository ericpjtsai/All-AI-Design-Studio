import * as THREE from 'three/webgpu';
import { storage } from 'three/tsl';
import { AgentBehavior } from '../../../playground/types';

/**
 * CPU/GPU buffer that stores per-instance agent state.
 *
 * Each instance maps to one vec4:
 *   .x = waypoint X  (used when state == GOTO)
 *   .y = 0           (reserved)
 *   .z = waypoint Z  (used when state == GOTO)
 *   .w = AgentBehavior  (0 = BOIDS, 1 = FROZEN, 2 = GOTO)
 */
export class AgentStateBuffer {
  public readonly array: Float32Array;
  public readonly attribute: THREE.StorageInstancedBufferAttribute;
  public readonly storageNode: any;

  constructor(private readonly count: number) {
    this.array = new Float32Array(count * 4);
    this.attribute = new THREE.StorageInstancedBufferAttribute(this.array, 4);
    this.storageNode = storage(this.attribute, 'vec4', count);
  }

  public getState(index: number): AgentBehavior {
    return this.array[index * 4 + 3] as AgentBehavior;
  }

  public setState(index: number, state: AgentBehavior): void {
    this.array[index * 4 + 3] = state;
    this.attribute.needsUpdate = true;
  }

  public setWaypoint(index: number, x: number, z: number): void {
    this.array[index * 4 + 0] = x;
    this.array[index * 4 + 2] = z;
    this.attribute.needsUpdate = true;
  }

  public getWaypoint(index: number): { x: number; z: number } {
    return {
      x: this.array[index * 4 + 0],
      z: this.array[index * 4 + 2],
    };
  }

  public resetAllNPCsToState(state: AgentBehavior, startIndex = 1): void {
    for (let i = startIndex; i < this.count; i++) {
      this.array[i * 4 + 3] = state;
    }
    this.attribute.needsUpdate = true;
  }
}
