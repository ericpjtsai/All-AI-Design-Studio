
import { Engine } from '../core/Engine';
import { PlaygroundStage as Stage } from './PlaygroundStage';
import { CharacterManager } from './entities/CharacterManager';
import { InputManager } from './input/InputManager';
import { BehaviorManager } from './behavior/BehaviorManager';
import { AGENTS, PLAYER_INDEX } from '../../playground/agents';
import { usePlaygroundStore } from '../../playground/store';
import { AgentBehavior, ChatMessage } from '../../playground/types';
import { playgroundGemini } from '../../services/playgroundGemini';
import * as THREE from 'three/webgpu';

export class PlaygroundScene {
  private engine: Engine;
  private stage: Stage;
  private characters: CharacterManager;

  private inputManager: InputManager | null = null;
  private behaviorManager: BehaviorManager | null = null;
  private selectedIndex: number | null = null;

  private frameCount = 0;
  private lastTime = 0;
  private unsubs: (() => void)[] = [];
  private isDisposed = false;

  constructor(container: HTMLElement) {
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
    window.addEventListener('resize', this.onResize.bind(this));

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

    this.inputManager = new InputManager(
      this.engine.renderer.domElement,
      this.stage.camera,
      () => this.characters.getCPUPositions(),
      () => this.characters.getCount(),
      (index) => {
        const state = usePlaygroundStore.getState();
        if (state.isChatting) {
          state.endChat();
        }
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
          const systemInstruction = `You are ${agent.role} at the AI Design Studio.
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional, matching your corporate persona.`;

          const responseText = await playgroundGemini.chat(
            systemInstruction,
            usePlaygroundStore.getState().chatMessages.slice(0, -1),
            text
          );

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
          console.error("Playground Gemini Error:", error);
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

    this.unsubs.push(sub1, sub2);
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.engine.onResize(w, h);
    this.stage.onResize(w, h);
  }

  private animate() {
    this.engine.timer.update();
    const delta = this.engine.timer.getDelta();

    this.stage.update();
    this.characters.update(delta, this.engine.renderer);

    const { isDebugOpen } = usePlaygroundStore.getState();
    this.characters.syncFromGPU(this.engine.renderer).then((positions) => {
      if (!positions) return;
      this.behaviorManager?.update(positions);
      if (isDebugOpen) {
        usePlaygroundStore.getState().setDebugPositions(new Float32Array(positions));
        const stateBuffer = this.characters.getAgentStateBuffer();
        if (stateBuffer) {
          usePlaygroundStore.getState().setDebugStates(new Float32Array(stateBuffer.array));
        }
      }
    });

    const { isChatting, selectedNpcIndex, setSelectedPosition } = usePlaygroundStore.getState();
    const followIdx = this.selectedIndex ?? PLAYER_INDEX;
    const pos = this.characters.getCPUPosition(followIdx);
    this.stage.setFollowTarget(pos);

    if (selectedNpcIndex !== null) {
      const npcPos = this.characters.getCPUPosition(selectedNpcIndex);
      if (npcPos) {
        const screenPos = npcPos.clone();
        screenPos.y += 1.3;
        screenPos.project(this.stage.camera);
        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
        setSelectedPosition({ x, y });
      }
    } else {
      setSelectedPosition(null);
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
      const systemInstruction = `You are ${agent.role} at the AI Design Studio.
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional. Introduce yourself very briefly and ask how you can help.`;

      const responseText = await playgroundGemini.chat(
        systemInstruction,
        [],
        "Hello! Please introduce yourself briefly."
      );

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
    window.removeEventListener('resize', this.onResize.bind(this));
    this.inputManager?.dispose();
    this.engine.dispose();
    if (this.stage.controls) this.stage.controls.dispose();
  }
}
