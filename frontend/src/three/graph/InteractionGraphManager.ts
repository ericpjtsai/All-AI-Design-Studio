import * as THREE from 'three/webgpu';
import { AGENTS } from '../../data/agents';

// ── Layout ─────────────────────────────────────────────────────────────────────
// Design Manager sits at the hub (top). Three specialists form a triangle below.
const NODE_REST_POSITIONS: THREE.Vector3[] = [
  new THREE.Vector3(0, 7.4, 0),        // Design Manager — top hub
  new THREE.Vector3(-2.8, 5.2, -1.5),  // Senior Designer — front-left
  new THREE.Vector3(2.8, 5.2, -1.5),   // Junior Designer — front-right
  new THREE.Vector3(0, 5.2, 2.8),      // Visual Designer — back-center
];

// Hub-and-spoke (Design Manager ↔ all) + cross-connections between specialists
const EDGE_CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2], [0, 3],
  [1, 2], [2, 3], [1, 3],
];

const PARTICLE_COUNT = 12;

interface NodeObject {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  glowMesh: THREE.Mesh;
  restPosition: THREE.Vector3;
  springPhase: number;
  springFreq: number;
}

interface EdgeObject {
  lineMesh: THREE.Line;
  lineGeo: THREE.BufferGeometry;
  particleMesh: THREE.Points;
  particleGeo: THREE.BufferGeometry;
  fromIndex: number;
  toIndex: number;
  isActive: boolean;
  particleOffset: number;
}

export class InteractionGraphManager {
  private root: THREE.Group;
  private nodes: NodeObject[] = [];
  private edges: EdgeObject[] = [];
  private activeNpcIndex: number | null = null;

  constructor(private scene: THREE.Scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.buildNodes();
    this.buildEdges();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private buildNodes(): void {
    AGENTS.forEach((agent, i) => {
      const isHub = i === 0;

      // Core sphere
      const coreGeo = new THREE.SphereGeometry(isHub ? 0.34 : 0.22, 28, 28);
      const coreMat = new THREE.MeshBasicNodeMaterial();
      coreMat.color.set(agent.color);
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);

      // Outer glow — back-face, semi-transparent
      const glowGeo = new THREE.SphereGeometry(isHub ? 0.62 : 0.44, 28, 28);
      const glowMat = new THREE.MeshBasicNodeMaterial();
      glowMat.color.set(agent.color);
      glowMat.transparent = true;
      glowMat.opacity = 0.12;
      glowMat.side = THREE.BackSide;
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);

      const group = new THREE.Group();
      group.add(coreMesh, glowMesh);
      group.position.copy(NODE_REST_POSITIONS[i]);
      this.root.add(group);

      this.nodes.push({
        group,
        coreMesh,
        glowMesh,
        restPosition: NODE_REST_POSITIONS[i].clone(),
        springPhase: Math.random() * Math.PI * 2,
        springFreq: 0.65 + Math.random() * 0.5,
      });
    });
  }

  private buildEdges(): void {
    EDGE_CONNECTIONS.forEach(([i, j]) => {
      // Line
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(6), 3),
      );
      const lineMat = new THREE.LineBasicNodeMaterial();
      lineMat.color.set('#334155');
      lineMat.transparent = true;
      lineMat.opacity = 0.22;
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      this.root.add(lineMesh);

      // Flow particles
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3),
      );
      const particleMat = new THREE.PointsMaterial({
        color: AGENTS[i].color,
        size: 0.08,
        transparent: true,
        opacity: 0,
        sizeAttenuation: true,
      });
      const particleMesh = new THREE.Points(particleGeo, particleMat);
      this.root.add(particleMesh);

      this.edges.push({
        lineMesh,
        lineGeo,
        particleMesh,
        particleGeo,
        fromIndex: i,
        toIndex: j,
        isActive: false,
        particleOffset: Math.random(),
      });
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Activate the edge between Design Manager (0) and the specified NPC. */
  public setActiveNpc(npcIndex: number | null): void {
    this.activeNpcIndex = npcIndex;
  }

  /** Show or hide the whole graph. */
  public setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  /** Returns the current animated world-space positions for all nodes. */
  public getNodeWorldPositions(): THREE.Vector3[] {
    return this.nodes.map((n) => n.group.position.clone());
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  public update(elapsed: number): void {
    this.updateNodes(elapsed);
    this.updateEdges(elapsed);
  }

  private updateNodes(elapsed: number): void {
    this.nodes.forEach((node, i) => {
      const t = elapsed * node.springFreq + node.springPhase;
      const vert  = Math.sin(t) * 0.06;
      const horiz = i !== 0 ? Math.cos(elapsed * 0.6 + node.springPhase + 1.5) * 0.04 : 0;

      node.group.position.set(
        node.restPosition.x + horiz,
        node.restPosition.y + vert,
        node.restPosition.z,
      );

      // Hub (Design Manager) pulses
      if (i === 0) {
        const pulse = 1.0 + Math.sin(elapsed * 2.4) * 0.07;
        node.coreMesh.scale.setScalar(pulse);
        (node.glowMesh.material as THREE.MeshBasicNodeMaterial).opacity =
          0.10 + Math.sin(elapsed * 1.1) * 0.05;
      }
    });
  }

  private updateEdges(elapsed: number): void {
    this.edges.forEach((edge) => {
      const fromPos = this.nodes[edge.fromIndex].group.position;
      const toPos   = this.nodes[edge.toIndex].group.position;

      // Keep line vertices in sync with animated nodes
      const pos = edge.lineGeo.attributes.position.array as Float32Array;
      pos[0] = fromPos.x; pos[1] = fromPos.y; pos[2] = fromPos.z;
      pos[3] = toPos.x;   pos[4] = toPos.y;   pos[5] = toPos.z;
      edge.lineGeo.attributes.position.needsUpdate = true;

      // Edge is "active" only on the direct Design Manager ↔ active NPC connection
      const shouldBeActive =
        this.activeNpcIndex !== null &&
        ((edge.fromIndex === 0 && edge.toIndex === this.activeNpcIndex) ||
         (edge.toIndex === 0 && edge.fromIndex === this.activeNpcIndex));

      if (shouldBeActive !== edge.isActive) {
        edge.isActive = shouldBeActive;
        const lineMat  = edge.lineMesh.material   as THREE.LineBasicNodeMaterial;
        const pointMat = edge.particleMesh.material as THREE.PointsMaterial;

        if (shouldBeActive) {
          const npcIdx = edge.fromIndex === 0 ? edge.toIndex : edge.fromIndex;
          lineMat.color.set(AGENTS[npcIdx].color);
          lineMat.opacity = 0.85;
          pointMat.color.set(AGENTS[npcIdx].color);
          pointMat.opacity = 0.85;
        } else {
          lineMat.color.set('#334155');
          lineMat.opacity = 0.22;
          pointMat.opacity = 0;
        }
      }

      // Animate particles flowing along the active edge
      if (edge.isActive) {
        edge.particleOffset = (edge.particleOffset + 0.005) % 1.0;
        const pPos = edge.particleGeo.attributes.position.array as Float32Array;
        for (let p = 0; p < PARTICLE_COUNT; p++) {
          const t = (edge.particleOffset + p / PARTICLE_COUNT) % 1.0;
          pPos[p * 3]     = fromPos.x + (toPos.x - fromPos.x) * t;
          pPos[p * 3 + 1] = fromPos.y + (toPos.y - fromPos.y) * t;
          pPos[p * 3 + 2] = fromPos.z + (toPos.z - fromPos.z) * t;
        }
        edge.particleGeo.attributes.position.needsUpdate = true;
      }
    });
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  public dispose(): void {
    this.nodes.forEach((n) => {
      n.coreMesh.geometry.dispose();
      n.glowMesh.geometry.dispose();
    });
    this.edges.forEach((e) => {
      e.lineGeo.dispose();
      e.particleGeo.dispose();
    });
    this.scene.remove(this.root);
  }
}
