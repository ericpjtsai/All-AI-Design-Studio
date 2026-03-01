
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  Fn, instanceIndex, storage, float, vec3, vec4, mat3, mat4, uint,
  If, Loop, uniform, atan, attribute, positionLocal, time, texture,
  sin, cos, uv, vec2
} from 'three/tsl';
import { BoidsParams, AgentBehavior, ExpressionKey } from '../../../playground/types';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { ExpressionBuffer } from '../behavior/ExpressionBuffer';
import { AGENTS, PLAYER_INDEX } from '../../../playground/agents';

export class CharacterManager {
  private instanceCount = 100;

  private posAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private velAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private timeOffsetAttribute: THREE.InstancedBufferAttribute | null = null;
  private colorAttribute: THREE.InstancedBufferAttribute | null = null;
  private positionStorage: any;
  private velocityStorage: any;

  private agentStateBuffer: AgentStateBuffer | null = null;
  private expressionBuffer: ExpressionBuffer | null = null;
  private debugPosArray: Float32Array | null = null;
  private computeNode: any;

  private instancedMeshes: THREE.Mesh[] = [];
  private meshData: { name: string; geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }[] = [];
  private colors: string[] | null = null;

  private bakedWalkBuffer: THREE.StorageBufferAttribute | null = null;
  private bakedIdleBuffer: THREE.StorageBufferAttribute | null = null;
  private bakedTalkBuffer: THREE.StorageBufferAttribute | null = null;
  private numWalkFrames = 0;
  private numIdleFrames = 0;
  private numTalkFrames = 0;
  private walkDuration = 0;
  private idleDuration = 0;
  private talkDuration = 0;
  private numBones = 0;

  private uSpeed = uniform(0.015);
  private uSeparationRadius = uniform(0.6);
  private uSeparationStrength = uniform(0.030);
  private uWorldSize = uniform(20.0);
  private worldSize = 20.0;

  public isLoaded = false;

  private rollInTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(private scene: THREE.Scene) {}

  public async load() {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync('/models/character.glb');
      const model = gltf.scene;

      const skinnedMeshes: THREE.SkinnedMesh[] = [];
      model.traverse((child) => {
        if ((child as any).isSkinnedMesh) {
          skinnedMeshes.push(child as THREE.SkinnedMesh);
        }
      });

      const walkClip = gltf.animations[2];
      const talkClip = gltf.animations[1];
      const idleClip = gltf.animations[0];
      if (skinnedMeshes.length === 0 || !walkClip) return;

      this.meshData = skinnedMeshes.map(m => ({
        name: m.name,
        geometry: m.geometry,
        material: m.material as THREE.MeshStandardMaterial
      }));

      const firstMesh = skinnedMeshes[0];

      const walkData = this.bakeAnimation(firstMesh, walkClip, model);
      this.bakedWalkBuffer = walkData.buffer;
      this.numWalkFrames = walkData.numFrames;
      this.walkDuration = walkData.duration;
      this.numBones = walkData.numBones;

      if (idleClip) {
        const idleData = this.bakeAnimation(firstMesh, idleClip, model);
        this.bakedIdleBuffer = idleData.buffer;
        this.numIdleFrames = idleData.numFrames;
        this.idleDuration = idleData.duration;
      } else {
        this.bakedIdleBuffer = this.bakedWalkBuffer;
        this.numIdleFrames = this.numWalkFrames;
        this.idleDuration = this.walkDuration;
      }

      if (talkClip) {
        const talkData = this.bakeAnimation(firstMesh, talkClip, model);
        this.bakedTalkBuffer = talkData.buffer;
        this.numTalkFrames = talkData.numFrames;
        this.talkDuration = talkData.duration;
      } else {
        this.bakedTalkBuffer = this.bakedIdleBuffer;
        this.numTalkFrames = this.numIdleFrames;
        this.talkDuration = this.idleDuration;
      }

      this.initInstances();
      this.isLoaded = true;
    } catch (err) {
      console.error("Failed to load character:", err);
    }
  }

  public setInstanceCount(count: number) {
    if (this.instanceCount === count) return;
    this.instanceCount = count;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }

  public updateBoidsParams(params: BoidsParams) {
    this.uSpeed.value = params.speed;
    this.uSeparationRadius.value = params.separationRadius;
    this.uSeparationStrength.value = params.separationStrength;
  }

  public updateWorldSize(size: number) {
    this.uWorldSize.value = size;
    this.worldSize = size;
  }

  public async syncFromGPU(renderer: any): Promise<Float32Array | null> {
    if (!this.posAttribute) return null;
    try {
      const buffer = await renderer.getArrayBufferAsync(this.posAttribute);
      this.debugPosArray = new Float32Array(buffer);
    } catch {
      // WebGPU readback not available
    }
    return this.debugPosArray;
  }

  public update(delta: number, renderer: any) {
    if (this.expressionBuffer) {
      this.expressionBuffer.update(delta);
    }
    if (this.computeNode) {
      renderer.compute(this.computeNode);
    }
  }

  private cleanupInstances() {
    for (const mesh of this.instancedMeshes) {
      this.scene.remove(mesh);
    }
    this.instancedMeshes = [];
    this.computeNode = null;
    this.expressionBuffer = null;
  }

  private initInstances() {
    if (this.meshData.length === 0) return;

    const posArray = new Float32Array(this.instanceCount * 4);
    const velArray = new Float32Array(this.instanceCount * 4);
    const timeOffsetArray = new Float32Array(this.instanceCount);
    const colorArray = new Float32Array(this.instanceCount * 3);

    const tempColor = new THREE.Color();
    const spawnRadius = this.worldSize;

    const npcCount = Math.min(this.instanceCount, AGENTS.length);

    for (let i = 0; i < this.instanceCount; i++) {
      const agent = AGENTS[i] || AGENTS[0];
      const colorOverride = this.colors && this.colors[i] ? this.colors[i] : agent.color;

      if (i === PLAYER_INDEX) {
        posArray[i * 4 + 0] = 0;
        posArray[i * 4 + 2] = 0;
        posArray[i * 4 + 3] = 1;
        tempColor.set(colorOverride);
      } else if (i < npcCount) {
        // NPCs start inside the world, visible from the beginning
        const angle = ((i - 1) / (npcCount - 1)) * Math.PI * 2 + Math.random() * 0.4;
        const radius = this.worldSize * 0.25 + Math.random() * this.worldSize * 0.35;
        posArray[i * 4 + 0] = Math.cos(angle) * radius;
        posArray[i * 4 + 2] = Math.sin(angle) * radius;
        posArray[i * 4 + 3] = 1;
        tempColor.set(colorOverride);
      } else {
        posArray[i * 4 + 0] = (Math.random() - 0.5) * spawnRadius * 2;
        posArray[i * 4 + 2] = (Math.random() - 0.5) * spawnRadius * 2;
        posArray[i * 4 + 3] = 1;
        velArray[i * 4 + 0] = (Math.random() - 0.5) * 0.1;
        velArray[i * 4 + 2] = (Math.random() - 0.5) * 0.1;
        tempColor.set(colorOverride);
      }

      timeOffsetArray[i] = Math.random() * 10;
      colorArray[i * 3 + 0] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    }

    this.debugPosArray = new Float32Array(posArray);

    this.posAttribute = new THREE.StorageInstancedBufferAttribute(posArray, 4);
    this.velAttribute = new THREE.StorageInstancedBufferAttribute(velArray, 4);
    this.timeOffsetAttribute = new THREE.InstancedBufferAttribute(timeOffsetArray, 1);
    this.colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);

    this.positionStorage = storage(this.posAttribute, 'vec4', this.instanceCount);
    this.velocityStorage = storage(this.velAttribute, 'vec4', this.instanceCount);

    this.agentStateBuffer = new AgentStateBuffer(this.instanceCount);
    this.agentStateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
    // NPCs start as BOIDS immediately — visible from the beginning
    for (let i = 1; i < npcCount; i++) {
      this.agentStateBuffer.setState(i, AgentBehavior.BOIDS);
    }

    this.expressionBuffer = new ExpressionBuffer(this.instanceCount);

    this.initComputeNode();
    this.createInstancedMesh();
  }

  private initComputeNode() {
    const agentStorage = this.agentStateBuffer!.storageNode;

    this.computeNode = Fn(() => {
      const index = instanceIndex;

      const posElement = this.positionStorage.element(index);
      const velElement = this.velocityStorage.element(index);
      const agentData = agentStorage.element(index);
      const agentState = agentData.w;

      const pos = posElement.xyz.toVar();

      const isFrozen = agentState.greaterThan(float(0.5)).and(agentState.lessThan(float(1.5)));
      const isTalk = agentState.greaterThan(float(2.5));
      const shouldStay = isFrozen.or(isTalk);

      If(shouldStay.or(agentState.greaterThan(float(1.5))), () => {
        If(agentState.greaterThan(float(1.5)).and(agentState.lessThan(float(2.5))), () => {
          const waypointXZ = vec3(agentData.x, float(0), agentData.z);
          const toTarget = waypointXZ.sub(pos);
          const dist = toTarget.length();
          If(dist.greaterThan(float(0.2)), () => {
            const gotoVel = toTarget.normalize().mul(this.uSpeed.mul(3.0));
            velElement.assign(vec4(gotoVel, 0.0));
            posElement.assign(vec4(pos.add(gotoVel), 1.0));
          }).Else(() => {
            posElement.assign(vec4(pos, 1.0));
          });
        }).Else(() => {
          const facing = vec3(agentData.x, float(0), agentData.z);
          If(facing.length().greaterThan(float(0.001)), () => {
            velElement.assign(vec4(facing, 0.0));
          });
          posElement.assign(vec4(pos, 1.0));
        });
      }).Else(() => {
        const vel = velElement.xyz.toVar();
        const accel = vec3(0).toVar();

        const halfSize = this.uWorldSize;
        If(pos.x.abs().greaterThan(halfSize).or(pos.z.abs().greaterThan(halfSize)), () => {
          accel.addAssign(pos.negate().normalize().mul(0.01));
        });

        Loop({ start: uint(0), end: uint(this.instanceCount), type: 'uint' }, ({ i }) => {
          const otherPos = this.positionStorage.element(i).xyz;
          const diff = pos.sub(otherPos);
          const dist = diff.length();
          If(dist.lessThan(this.uSeparationRadius).and(dist.greaterThan(0.01)), () => {
            accel.addAssign(diff.normalize().mul(this.uSeparationStrength));
          });
        });

        const newVel = vel.add(accel).toVar();
        const speed = newVel.length();
        If(speed.greaterThan(0.001), () => {
          newVel.assign(newVel.normalize().mul(this.uSpeed));
        }).Else(() => {
          newVel.assign(vec3(0, 0, this.uSpeed));
        });

        velElement.assign(vec4(newVel, 0.0));
        posElement.assign(vec4(pos.add(newVel), 1.0));
      });
    })().compute(this.instanceCount);
  }

  private createInstancedMesh() {
    for (const { name, geometry, material: baseMaterial } of this.meshData) {
      const instancedGeometry = new THREE.InstancedBufferGeometry();
      instancedGeometry.copy(geometry as any);
      instancedGeometry.instanceCount = this.instanceCount;

      if (this.timeOffsetAttribute) instancedGeometry.setAttribute('instanceTimeOffset', this.timeOffsetAttribute);
      if (this.colorAttribute) instancedGeometry.setAttribute('instanceColor', this.colorAttribute);

      const material = new THREE.MeshStandardNodeMaterial();
      material.roughness = 1;
      material.metalness = 0.25;

      const instanceColor = attribute('instanceColor', 'vec3') as any;
      const map = (baseMaterial as any).map;

      const expressionData = this.expressionBuffer!.storageNode.element(instanceIndex);
      const isEyes = name.toLowerCase().includes('eyes');
      const isMouth = name.toLowerCase().includes('mouth');

      const mat = material as any;

      if (isEyes) {
        mat.uvNode = uv().add(expressionData.xy);
      } else if (isMouth) {
        mat.uvNode = uv().add(expressionData.zw);
      }

      if (name.toLowerCase().includes('body')) {
        if (map) {
          const texColor = texture(map);
          mat.colorNode = (vec4 as any)(texColor.rgb.mul(instanceColor), texColor.a);
        } else {
          mat.colorNode = (vec4 as any)(instanceColor, 1.0);
        }
      } else {
        material.transparent = true;
        if (map) {
          const texColor = isEyes || isMouth ? texture(map, mat.uvNode) : texture(map);
          mat.colorNode = texColor;
        } else {
          mat.opacityNode = float(0);
        }
      }

      const vertexNode = this.createVertexNode();
      mat.positionNode = vertexNode;
      mat.castShadowPositionNode = vertexNode;

      const instancedMesh = new THREE.Mesh(instancedGeometry, material);
      instancedMesh.frustumCulled = false;
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      this.scene.add(instancedMesh);
      this.instancedMeshes.push(instancedMesh);
    }
  }

  private createVertexNode() {
    return Fn(() => {
      const instancePos = this.positionStorage.element(instanceIndex).xyz;
      const rawVel = this.velocityStorage.element(instanceIndex).xyz;
      const timeOffset = attribute('instanceTimeOffset');

      const isMoving = rawVel.length().greaterThan(float(0.001));
      const safeVel = vec3(0, 0, 1).toVar();
      If(isMoving, () => { safeVel.assign(rawVel); });

      const angle = atan(safeVel.z, safeVel.x).negate().add(float(Math.PI / 2));
      const rotationMat = mat3(
        vec3(cos(angle), float(0), sin(angle).negate()),
        vec3(float(0), float(1), float(0)),
        vec3(sin(angle), float(0), cos(angle))
      );

      const finalPosition = positionLocal.toVar();

      if (this.bakedWalkBuffer && this.bakedIdleBuffer && this.bakedTalkBuffer) {
        const walkBuffer = (storage as any)(this.bakedWalkBuffer, 'mat4', this.numWalkFrames * this.numBones);
        const idleBuffer = (storage as any)(this.bakedIdleBuffer, 'mat4', this.numIdleFrames * this.numBones);
        const talkBuffer = (storage as any)(this.bakedTalkBuffer, 'mat4', this.numTalkFrames * this.numBones);
        const agentState = this.agentStateBuffer!.storageNode.element(instanceIndex).w;

        const skinIndex = attribute('skinIndex', 'vec4') as any;
        const skinWeight = attribute('skinWeight', 'vec4') as any;
        const skinMat = (mat4 as any)(0).toVar();

        const isFrozen = agentState.greaterThan(float(0.5)).and(agentState.lessThan(float(1.5)));
        const isTalk = agentState.greaterThan(float(2.5));

        const buildSkinMat = (animBuf: any, numFrames: number, duration: number) => {
          const animTime = time.add(timeOffset as any);
          const t = animTime.div(float(duration)).fract();
          const currentFrame = t.mul(float(numFrames)).toInt();
          const safeFrame = (currentFrame as any).min(uint(numFrames - 1));
          const addInfluence = (boneIdxNode: any, weightNode: any) => {
            If(weightNode.greaterThan(0), () => {
              const address = safeFrame.mul(uint(this.numBones)).add(boneIdxNode.toInt());
              skinMat.addAssign(animBuf.element(address).mul(weightNode));
            });
          };
          addInfluence(skinIndex.x, skinWeight.x);
          addInfluence(skinIndex.y, skinWeight.y);
          addInfluence(skinIndex.z, skinWeight.z);
          addInfluence(skinIndex.w, skinWeight.w);
        };

        If(isFrozen, () => {
          buildSkinMat(idleBuffer, this.numIdleFrames, this.idleDuration);
        }).Else(() => {
          If(isTalk, () => {
            buildSkinMat(talkBuffer, this.numTalkFrames, this.talkDuration);
          }).Else(() => {
            buildSkinMat(walkBuffer, this.numWalkFrames, this.walkDuration);
          });
        });

        finalPosition.assign(skinMat.mul(vec4(positionLocal, 1.0)).xyz);
      }

      return rotationMat.mul(finalPosition).add(instancePos);
    })();
  }

  private bakeAnimation(mesh: THREE.SkinnedMesh, clip: THREE.AnimationClip, root: THREE.Object3D) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const skeleton = mesh.skeleton;
    const duration = clip.duration;
    const numFrames = Math.ceil(duration * 60);
    const numBones = skeleton.bones.length;
    const data = new Float32Array(numFrames * numBones * 16);
    for (let f = 0; f < numFrames; f++) {
      mixer.setTime((f / numFrames) * duration);
      root.updateMatrixWorld(true);
      skeleton.update();
      for (let b = 0; b < numBones; b++) {
        const i = (f * numBones + b) * 16;
        for (let k = 0; k < 16; k++) data[i + k] = skeleton.boneMatrices![b * 16 + k];
      }
    }
    return {
      buffer: new THREE.StorageBufferAttribute(data, 16),
      numFrames,
      numBones,
      duration,
    };
  }

  /**
   * Animate NPCs walking into the scene from off-screen, staggered.
   * Each NPC gets a GOTO waypoint to a position inside the world.
   * After all arrive, they switch to BOIDS for free movement.
   */
  public rollIn() {
    if (!this.agentStateBuffer) return;

    // Clear any pending timers from previous rollIn
    for (const t of this.rollInTimers) clearTimeout(t);
    this.rollInTimers = [];

    const npcCount = Math.min(this.instanceCount, AGENTS.length);
    const staggerMs = 500;

    for (let i = 1; i < npcCount; i++) {
      const delay = (i - 1) * staggerMs;
      const t = setTimeout(() => {
        // Target: spread NPCs around the world interior
        const angle = ((i - 1) / (npcCount - 1)) * Math.PI * 2 + Math.random() * 0.4;
        const radius = this.worldSize * 0.25 + Math.random() * this.worldSize * 0.35;
        const tx = Math.cos(angle) * radius;
        const tz = Math.sin(angle) * radius;

        this.agentStateBuffer!.setWaypoint(i, tx, tz);
        this.agentStateBuffer!.setState(i, AgentBehavior.GOTO);
      }, delay);
      this.rollInTimers.push(t);
    }

    // After all have walked in, switch to BOIDS
    const totalDelay = (npcCount - 2) * staggerMs + 4000;
    const t = setTimeout(() => {
      if (this.agentStateBuffer) {
        this.agentStateBuffer.resetAllNPCsToState(AgentBehavior.BOIDS);
      }
    }, totalDelay);
    this.rollInTimers.push(t);
  }

  public fadeToAction(_name: string) {}
  public getCount() { return this.instanceCount; }

  public getAgentStateBuffer(): AgentStateBuffer | null {
    return this.agentStateBuffer;
  }

  public getCPUPositions(): Float32Array | null {
    return this.debugPosArray;
  }

  public getCPUPosition(index: number): THREE.Vector3 | null {
    if (!this.debugPosArray || index < 0 || index >= this.instanceCount) return null;
    const i = index * 4;
    return new THREE.Vector3(this.debugPosArray[i], this.debugPosArray[i + 1], this.debugPosArray[i + 2]);
  }

  public getAgentState(index: number): number {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return 0;
    return this.agentStateBuffer.getState(index);
  }

  public setExpression(index: number, name: ExpressionKey) {
    if (this.expressionBuffer) {
      this.expressionBuffer.setExpression(index, name);
    }
  }

  public setSpeaking(index: number, isSpeaking: boolean) {
    if (this.expressionBuffer) {
      this.expressionBuffer.setSpeaking(index, isSpeaking);
    }
    if (this.agentStateBuffer) {
      if (isSpeaking) {
        // Switch to TALK unless the NPC is mid-walk (GOTO) — don't interrupt pathfinding
        const currentState = this.agentStateBuffer.getState(index);
        if (currentState !== AgentBehavior.GOTO) {
          this.agentStateBuffer.setState(index, AgentBehavior.TALK);
        }
      } else {
        // Return to wandering if we were the ones who set TALK
        if (this.agentStateBuffer.getState(index) === AgentBehavior.TALK) {
          this.agentStateBuffer.setState(index, AgentBehavior.BOIDS);
        }
      }
    }
  }

  public setColors(hexColors: string[]) {
    this.colors = hexColors;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }
}
