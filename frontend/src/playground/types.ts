
export interface PerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  entities: number;
}

export interface BoidsParams {
  speed: number;
  separationRadius: number;
  separationStrength: number;
  alignmentRadius: number;
  cohesionRadius: number;
}

export interface ClarifyingQuestion {
  question: string;
  options: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface CharacterState {
  currentAction: string;
  isThinking: boolean;
  aiResponse: string;
  isDebugOpen: boolean;
  instanceCount: number;
  worldSize: number;
  boidsParams: BoidsParams;
  debugPositions: Float32Array | null;
  debugStates: Float32Array | null;
  activeEncounter: ActiveEncounter | null;
  selectedNpcIndex: number | null;
  selectedPosition: { x: number; y: number } | null;
  hoveredNpcIndex: number | null;
  hoverPosition: { x: number; y: number } | null;
  isChatting: boolean;
  isTyping: boolean;
  chatMessages: ChatMessage[];

  performance: PerformanceStats;
  lastSpeakingTrigger: { index: number, isSpeaking: boolean, timestamp: number } | null;

  setAnimation: (name: string) => void;
  setSpeaking: (index: number, isSpeaking: boolean) => void;
  setThinking: (isThinking: boolean) => void;
  setIsTyping: (isTyping: boolean) => void;
  setAIResponse: (response: string) => void;
  toggleDebug: () => void;
  setInstanceCount: (count: number) => void;
  setWorldSize: (size: number) => void;
  setBoidsParams: (params: Partial<BoidsParams>) => void;
  setDebugPositions: (positions: Float32Array) => void;
  setDebugStates: (states: Float32Array) => void;
  setActiveEncounter: (encounter: ActiveEncounter | null) => void;
  setSelectedNpc: (index: number | null) => void;
  setSelectedPosition: (pos: { x: number; y: number } | null) => void;
  setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => void;
  startChat: (index: number) => void;
  endChat: () => void;
  sendMessage: (text: string) => Promise<void>;
  updatePerformance: (stats: PerformanceStats) => void;
}

export enum AnimationName {
  IDLE = 'Idle',
  WALK = 'Walk'
}

/** Stored as a float in the GPU agent buffer (.w component). */
export enum AgentBehavior {
  BOIDS = 0,
  FROZEN = 1,
  GOTO = 2,
  TALK = 3,
}

export interface ActiveEncounter {
  npcIndex: number;
  npcDepartment: string;
  npcRole: string;
  npcMission: string;
  npcPersonality: string;
}

export type ExpressionKey = 'idle' | 'listening' | 'neutral' | 'surprised' | 'happy' | 'sick' | 'wink' | 'doubtful' | 'sad';

export interface AtlasCoords {
  col: number;
  row: number;
}

export interface ExpressionConfig {
  eyes: AtlasCoords;
  mouth: AtlasCoords;
}
