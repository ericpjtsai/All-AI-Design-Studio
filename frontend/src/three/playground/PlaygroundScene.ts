
import { Engine } from '../core/Engine';
import { PlaygroundStage as Stage } from './PlaygroundStage';
import { CharacterManager } from './entities/CharacterManager';
import { InputManager } from './input/InputManager';
import { BehaviorManager } from './behavior/BehaviorManager';
import { AGENTS, PLAYER_INDEX } from '../../playground/agents';
import { usePlaygroundStore } from '../../playground/store';
import { AgentBehavior, ChatMessage } from '../../playground/types';
import { playgroundGemini } from '../../services/playgroundGemini';
import { useStore } from '../../store/useStore';
import * as THREE from 'three/webgpu';
import { FormationController } from './behavior/FormationController';
import { DataStreamRenderer } from './effects/DataStreamRenderer';

/**
 * Map playground NPC index → backend agent index.
 * Playground: 0=CEO(player), 1=Manager, 2=Senior, 3=Junior, 4=Visual
 * Backend:    0=Manager,      1=Senior,  2=Junior, 3=Visual
 * Returns null for the CEO (no backend agent).
 */
function toBackendAgentIndex(playgroundIndex: number): number | null {
  if (playgroundIndex === PLAYER_INDEX) return null;
  return playgroundIndex - 1;
}

export class PlaygroundScene {
  private engine: Engine;
  private stage: Stage;
  private characters: CharacterManager;
  private container: HTMLElement;

  private inputManager: InputManager | null = null;
  private behaviorManager: BehaviorManager | null = null;
  private selectedIndex: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private frameCount = 0;
  private lastTime = 0;
  private unsubs: (() => void)[] = [];
  private isDisposed = false;

  private formationController: FormationController | null = null;
  private dataStreamRenderer: DataStreamRenderer | null = null;
  private holoDisc: THREE.Mesh | null = null;
  private holoOuterRing: THREE.Mesh | null = null;
  private holoSpinGroup: THREE.Group | null = null;
  private holoInnerRingMat: THREE.MeshBasicMaterial | null = null;
  private lookAtTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.engine = new Engine(container);
    this.stage = new Stage(this.engine.renderer.domElement);
    this.characters = new CharacterManager(this.stage.scene);
    this.init();
  }

  private async init() {
    await this.engine.init();
    if (this.isDisposed) return;
    await this.characters.load();
    if (this.isDisposed) return;

    const state = usePlaygroundStore.getState();

    this.characters.setInstanceCount(state.instanceCount);
    this.characters.updateBoidsParams(state.boidsParams);
    this.characters.updateWorldSize(state.worldSize);
    this.stage.updateDimensions(state.worldSize);

    this.engine.renderer.setAnimationLoop(this.animate.bind(this));
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
    this.onResize();

    const stateBuffer = this.characters.getAgentStateBuffer();
    if (stateBuffer) {
      this.behaviorManager = new BehaviorManager(
        stateBuffer,
        AGENTS,
        (encounter) => usePlaygroundStore.getState().setActiveEncounter(encounter),
        (index, isSpeaking) => this.characters.setSpeaking(index, isSpeaking),
        (npcIndex) => {
          const state = usePlaygroundStore.getState();
          if (state.isChatting && state.selectedNpcIndex === npcIndex) {
            this.handleNpcGreeting(npcIndex);
          }
        }
      );
    }

    // ── Formation Controller ─────────────────────────────────────────────────
    if (stateBuffer) {
      this.formationController = new FormationController(stateBuffer);
    }

    // ── DataStream Renderer ──────────────────────────────────────────────────
    this.dataStreamRenderer = new DataStreamRenderer(this.stage.scene);

    // ── Holographic Command Table (hidden until formation is active) ─────────
    {
      const tableGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.04, 48);
      const tableMat = new THREE.MeshBasicMaterial({ color: 0x7EACEA, transparent: true, opacity: 0.1 });
      this.holoDisc = new THREE.Mesh(tableGeom, tableMat);
      this.holoDisc.position.y = 0.02;
      this.holoDisc.visible = false;
      this.stage.scene.add(this.holoDisc);

      const outerRingGeom = new THREE.RingGeometry(1.17, 1.22, 64);
      const outerRingMat = new THREE.MeshBasicMaterial({ color: 0x7EACEA, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      this.holoOuterRing = new THREE.Mesh(outerRingGeom, outerRingMat);
      this.holoOuterRing.rotation.x = -Math.PI / 2;
      this.holoOuterRing.position.y = 0.06;
      this.holoOuterRing.visible = false;
      this.stage.scene.add(this.holoOuterRing);

      this.holoSpinGroup = new THREE.Group();
      this.holoSpinGroup.position.y = 0.08;
      this.holoSpinGroup.visible = false;
      this.stage.scene.add(this.holoSpinGroup);

      const innerRingGeom = new THREE.RingGeometry(0.45, 0.5, 48);
      this.holoInnerRingMat = new THREE.MeshBasicMaterial({ color: 0xA0CFFF, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const innerRing = new THREE.Mesh(innerRingGeom, this.holoInnerRingMat);
      innerRing.rotation.x = -Math.PI / 2;
      this.holoSpinGroup.add(innerRing);
    }

    this.inputManager = new InputManager(
      this.engine.renderer.domElement,
      this.stage.camera,
      () => this.characters.getCPUPositions(),
      () => this.characters.getCount(),
      (index) => {
        this.selectedIndex = index;
        usePlaygroundStore.getState().setSelectedNpc(index !== PLAYER_INDEX ? index : null);
      },
      (x, z) => {
        const { worldSize } = usePlaygroundStore.getState();
        if (Math.abs(x) <= worldSize && Math.abs(z) <= worldSize) {
          this.behaviorManager?.setPlayerWaypoint(x, z);
        }
      },
      (index, pos) => { usePlaygroundStore.getState().setHoveredNpc(index, pos); },
    );

    usePlaygroundStore.setState({
      startChat: async (index: number) => {
        const positions = this.characters.getCPUPositions();
        if (positions) {
          this.behaviorManager?.startChat(index, positions);
          usePlaygroundStore.setState({
            selectedNpcIndex: index,
            isChatting: true,
            chatMessages: [],
            isThinking: false
          });
        }
      },
      endChat: () => {
        const { selectedNpcIndex } = usePlaygroundStore.getState();
        this.behaviorManager?.endChat(selectedNpcIndex);
        usePlaygroundStore.setState({
          isChatting: false,
          isTyping: false,
          isThinking: false,
          chatMessages: []
        });
      },
      sendMessage: async (text: string) => {
        const state = usePlaygroundStore.getState();
        if (state.selectedNpcIndex === null || state.isThinking) return;

        const agent = AGENTS[state.selectedNpcIndex];
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const userMessage: ChatMessage = { role: 'user', text, timestamp };

        usePlaygroundStore.setState((s) => ({
          chatMessages: [...s.chatMessages, userMessage],
          isThinking: true,
          isTyping: false
        }));

        try {
          const sessionId = useStore.getState().sessionId;
          const backendIdx = toBackendAgentIndex(state.selectedNpcIndex);

          let responseText: string;

          if (sessionId && backendIdx !== null) {
            // Dual-mode: backend chat with session context
            const history = usePlaygroundStore.getState().chatMessages.slice(0, -1);
            const res = await fetch(`/api/sessions/${sessionId}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agent_index: backendIdx,
                message: text,
                history: history.map(m => ({ role: m.role, text: m.text })),
              }),
            });
            if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
            const data = await res.json();
            responseText = data.reply;
          } else {
            // Fallback: client-side Gemini (no session or CEO)
            const systemInstruction = `You are ${agent.role} at the AI Design Studio.
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional, matching your corporate persona.`;

            responseText = await playgroundGemini.chat(
              systemInstruction,
              usePlaygroundStore.getState().chatMessages.slice(0, -1),
              text
            );
          }

          const modelMessage: ChatMessage = {
            role: 'model',
            text: responseText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          usePlaygroundStore.setState((s) => ({
            chatMessages: [...s.chatMessages, modelMessage],
            isThinking: false
          }));

          this.characters.fadeToAction('Wave');
          setTimeout(() => this.characters.fadeToAction('Idle'), 2000);
        } catch (error) {
          console.error("Playground chat error:", error);
          usePlaygroundStore.setState({ isThinking: false });
        }
      }
    });

    const sub1 = usePlaygroundStore.subscribe((state) => {
      this.characters.fadeToAction(state.currentAction);
    });

    const sub2 = usePlaygroundStore.subscribe((state, prevState) => {
      if (state.instanceCount !== prevState.instanceCount) {
        this.characters.setInstanceCount(state.instanceCount);
      }
      if (state.boidsParams !== prevState.boidsParams) {
        this.characters.updateBoidsParams(state.boidsParams);
      }
      if (state.worldSize !== prevState.worldSize) {
        this.characters.updateWorldSize(state.worldSize);
        this.stage.updateDimensions(state.worldSize);
      }
      if (state.lastSpeakingTrigger !== prevState.lastSpeakingTrigger && state.lastSpeakingTrigger) {
        this.characters.setSpeaking(state.lastSpeakingTrigger.index, state.lastSpeakingTrigger.isSpeaking);
      }
      if (state.isChatting !== prevState.isChatting || state.isThinking !== prevState.isThinking || state.isTyping !== prevState.isTyping) {
        if (state.isChatting && state.selectedNpcIndex !== null) {
          this.characters.setSpeaking(state.selectedNpcIndex, state.isThinking);
          this.characters.setSpeaking(PLAYER_INDEX, state.isTyping);
        } else if (!state.isChatting && prevState.isChatting) {
          const prevNpcIndex = prevState.selectedNpcIndex;
          if (prevNpcIndex !== null) {
            this.characters.setSpeaking(prevNpcIndex, false);
          }
          this.characters.setSpeaking(PLAYER_INDEX, false);
        }
      }
    });

    // Auto-start chat with Design Manager (index 1) when scoping begins;
    // end chat when the session concludes.
    const sub3 = useStore.subscribe((state, prevState) => {
      if (prevState.workflowPhase !== 'scoping' && state.workflowPhase === 'scoping') {
        usePlaygroundStore.getState().startChat(1);
      }
      if (prevState.workflowPhase !== 'complete' && state.workflowPhase === 'complete') {
        usePlaygroundStore.getState().endChat();
      }
    });

    // Mirror agent work status onto NPC animations
    // Backend agent index 0-3 → playground NPC index 1-4 (index 0 = CEO/player)
    const sub4 = useStore.subscribe((state, prevState) => {
      state.agentStates.forEach((agentState) => {
        const prev = prevState.agentStates.find((s) => s.index === agentState.index);
        if (!prev || agentState.status === prev.status) return;

        const npcIndex = agentState.index + 1; // backend 0 → playground 1, etc.
        const isWorking = agentState.status === 'working' || agentState.status === 'reviewing';
        this.characters.setSpeaking(npcIndex, isWorking);
      });
    });

    // Formation + DataStream: react to workflow phase transitions
    const sub5 = useStore.subscribe((state, prevState) => {
      if (state.workflowPhase === prevState.workflowPhase) return;

      const activePhases = ['designing', 'implementing', 'reviewing'];
      const wasActive = activePhases.includes(prevState.workflowPhase);
      const isNowActive = activePhases.includes(state.workflowPhase);

      if (!wasActive && isNowActive) {
        this.formationController?.enter();
        if (this.holoDisc) this.holoDisc.visible = true;
        if (this.holoOuterRing) this.holoOuterRing.visible = true;
        if (this.holoSpinGroup) this.holoSpinGroup.visible = true;
      } else if (wasActive && !isNowActive) {
        this.formationController?.exit();
        if (this.holoDisc) this.holoDisc.visible = false;
        if (this.holoOuterRing) this.holoOuterRing.visible = false;
        if (this.holoSpinGroup) this.holoSpinGroup.visible = false;
      }

      if (this.lookAtTimer) clearTimeout(this.lookAtTimer);

      if (state.workflowPhase === 'designing') {
        // Design Manager (1) delegates to Senior (2) and Visual (4)
        this.dataStreamRenderer?.addStream('dm-senior', { sourceNpcIdx: 1, targetNpcIdx: 2, color: AGENTS[1].color, durationMs: 4500 });
        this.dataStreamRenderer?.addStream('dm-visual',  { sourceNpcIdx: 1, targetNpcIdx: 4, color: AGENTS[1].color, durationMs: 4500 });
        this.formationController?.lookAt(1, 2);
        this.lookAtTimer = setTimeout(() => this.formationController?.allFaceCenter(), 4700);
      } else if (state.workflowPhase === 'implementing') {
        // Senior (2) and Visual (4) hand off to Junior (3)
        this.dataStreamRenderer?.addStream('senior-junior', { sourceNpcIdx: 2, targetNpcIdx: 3, color: AGENTS[2].color, durationMs: 4500 });
        this.dataStreamRenderer?.addStream('visual-junior',  { sourceNpcIdx: 4, targetNpcIdx: 3, color: AGENTS[4].color, durationMs: 4500 });
        this.formationController?.lookAt(2, 3);
        this.formationController?.lookAt(4, 3);
        this.lookAtTimer = setTimeout(() => this.formationController?.allFaceCenter(), 4700);
      } else if (state.workflowPhase === 'reviewing') {
        // Junior (3) submits to Design Manager (1) for review
        this.dataStreamRenderer?.addStream('junior-dm', { sourceNpcIdx: 3, targetNpcIdx: 1, color: AGENTS[3].color, durationMs: 4500 });
        this.formationController?.lookAt(3, 1);
        this.formationController?.lookAt(1, 3);
        this.lookAtTimer = setTimeout(() => this.formationController?.allFaceCenter(), 4700);
      }
    });

    this.unsubs.push(sub1, sub2, sub3, sub4, sub5);
  }

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.engine.onResize(w, h);
    this.stage.onResize(w, h);
  }

  private animate() {
    this.engine.timer.update();
    const delta = this.engine.timer.getDelta();
    const elapsedSec = this.engine.timer.getElapsed();

    this.stage.update();
    this.characters.update(delta, this.engine.renderer);

    const { isDebugOpen } = usePlaygroundStore.getState();
    this.characters.syncFromGPU(this.engine.renderer).then((positions) => {
      if (!positions) return;
      this.behaviorManager?.update(positions);
      this.formationController?.update(positions);
      this.dataStreamRenderer?.update(positions, elapsedSec);

      // Keep the chat NPC frozen and facing the player — runs last so it
      // overrides both BehaviorManager and FormationController every frame.
      const { isChatting, selectedNpcIndex } = usePlaygroundStore.getState();
      if (isChatting && selectedNpcIndex !== null && selectedNpcIndex !== PLAYER_INDEX) {
        const stateBuffer = this.characters.getAgentStateBuffer();
        if (stateBuffer) {
          const px = positions[PLAYER_INDEX * 4];
          const pz = positions[PLAYER_INDEX * 4 + 2];
          const nx = positions[selectedNpcIndex * 4];
          const nz = positions[selectedNpcIndex * 4 + 2];
          let dx = px - nx;
          let dz = pz - nz;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len > 0.01) { dx /= len; dz /= len; }
          stateBuffer.setState(selectedNpcIndex, AgentBehavior.FROZEN);
          stateBuffer.setWaypoint(selectedNpcIndex, dx, dz);
        }
      }

      if (isDebugOpen) {
        usePlaygroundStore.getState().setDebugPositions(new Float32Array(positions));
        const stateBuffer = this.characters.getAgentStateBuffer();
        if (stateBuffer) {
          usePlaygroundStore.getState().setDebugStates(new Float32Array(stateBuffer.array));
        }
      }
    });

    const { isChatting, selectedNpcIndex, setSelectedPosition, setNpcScreenPositions } = usePlaygroundStore.getState();
    const followIdx = this.selectedIndex ?? PLAYER_INDEX;
    const pos = this.characters.getCPUPosition(followIdx);
    this.stage.setFollowTarget(pos);

    if (selectedNpcIndex !== null) {
      const npcPos = this.characters.getCPUPosition(selectedNpcIndex);
      if (npcPos) {
        const screenPos = npcPos.clone();
        screenPos.y += 1.3;
        screenPos.project(this.stage.camera);
        const rect = this.container.getBoundingClientRect();
        const x = (screenPos.x * 0.5 + 0.5) * rect.width;
        const y = (screenPos.y * -0.5 + 0.5) * rect.height;
        setSelectedPosition({ x, y });
      }
    } else {
      setSelectedPosition(null);
    }

    // Project all NPC positions to screen space for status badges
    {
      const rect = this.container.getBoundingClientRect();
      const positions: Record<number, { x: number; y: number } | null> = {};
      for (let i = 1; i <= 4; i++) {
        const npcPos = this.characters.getCPUPosition(i);
        if (npcPos) {
          const sp = npcPos.clone();
          sp.y += 1.8;
          sp.project(this.stage.camera);
          positions[i] = {
            x: (sp.x * 0.5 + 0.5) * rect.width,
            y: (sp.y * -0.5 + 0.5) * rect.height,
          };
        } else {
          positions[i] = null;
        }
      }
      setNpcScreenPositions(positions);
    }

    // Animate holographic command table
    if (this.holoDisc?.visible) {
      const pulse = 0.5 + 0.5 * Math.sin(elapsedSec * 2);
      (this.holoOuterRing!.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.4 * pulse;
      if (this.holoInnerRingMat) this.holoInnerRingMat.opacity = 0.3 + 0.3 * pulse;
      if (this.holoSpinGroup) this.holoSpinGroup.rotation.y += delta * 0.6;
    }

    if (isChatting) {
      const playerState = this.characters.getAgentState(PLAYER_INDEX);
      if (playerState === AgentBehavior.GOTO) {
        if (this.stage.controls) this.stage.controls.enabled = false;
        if (this.stage.controls) {
          this.stage.controls.minDistance = THREE.MathUtils.lerp(this.stage.controls.minDistance, 4, 0.05);
          this.stage.controls.maxDistance = THREE.MathUtils.lerp(this.stage.controls.maxDistance, 6, 0.05);
        }
      } else {
        if (this.stage.controls) {
          this.stage.controls.enabled = true;
          this.stage.controls.minDistance = THREE.MathUtils.lerp(this.stage.controls.minDistance, 3, 0.05);
          this.stage.controls.maxDistance = THREE.MathUtils.lerp(this.stage.controls.maxDistance, 10, 0.05);
        }
      }
    } else {
      if (this.stage.controls) {
        this.stage.controls.enabled = true;
        this.stage.controls.minDistance = THREE.MathUtils.lerp(this.stage.controls.minDistance, 3, 0.05);
        this.stage.controls.maxDistance = THREE.MathUtils.lerp(this.stage.controls.maxDistance, 50, 0.05);
      }
    }

    this.engine.render(this.stage.scene, this.stage.camera);
    this.updateStats();
  }

  private async handleNpcGreeting(npcIndex: number) {
    const agent = AGENTS[npcIndex];
    usePlaygroundStore.setState({ isThinking: true });

    try {
      const sessionId = useStore.getState().sessionId;
      const backendIdx = toBackendAgentIndex(npcIndex);

      let responseText: string;

      if (sessionId && backendIdx !== null) {
        const res = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_index: backendIdx,
            message: "Hello! Please introduce yourself briefly and mention what you're currently working on.",
            history: [],
          }),
        });
        if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
        const data = await res.json();
        responseText = data.reply;
      } else {
        const systemInstruction = `You are ${agent.role} at the AI Design Studio.
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional. Introduce yourself very briefly and ask how you can help.`;

        responseText = await playgroundGemini.chat(
          systemInstruction,
          [],
          "Hello! Please introduce yourself briefly."
        );
      }

      const modelMessage: ChatMessage = {
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      usePlaygroundStore.setState((s) => ({
        chatMessages: [modelMessage],
        isThinking: false
      }));

      this.characters.fadeToAction('Wave');
      setTimeout(() => this.characters.fadeToAction('Idle'), 2000);
    } catch (error) {
      console.error("Auto-presentation error:", error);
      usePlaygroundStore.setState({ isThinking: false });
    }
  }

  private updateStats() {
    this.frameCount++;
    const elapsed = this.engine.timer.getElapsed();
    if (this.frameCount >= 20) {
      const fps = Math.round(20 / (elapsed - this.lastTime));
      const info = this.engine.renderer.info;
      const count = this.characters.getCount();

      usePlaygroundStore.getState().updatePerformance({
        fps,
        drawCalls: info.render.drawCalls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        entities: count
      });

      this.frameCount = 0;
      this.lastTime = elapsed;
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.unsubs.forEach(unsub => unsub());
    if (this.lookAtTimer) clearTimeout(this.lookAtTimer);
    this.dataStreamRenderer?.dispose();
    this.resizeObserver?.disconnect();
    this.inputManager?.dispose();
    this.engine.dispose();
    if (this.stage.controls) this.stage.controls.dispose();
  }
}
