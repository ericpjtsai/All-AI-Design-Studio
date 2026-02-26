export type AgentStatus = 'idle' | 'working' | 'reviewing' | 'waiting' | 'complete' | 'done' | 'error';

export type WorkflowPhase =
  | 'briefing'
  | 'scoping'
  | 'designing'
  | 'implementing'
  | 'reviewing'
  | 'complete';

export interface AgentRuntimeState {
  index: number;
  status: AgentStatus;
  currentTask: string;
  progress: number; // 0–100
  isActive: boolean; // true = CEO↔agent edge lights up in graph
}

export interface ActivityEntry {
  id: string;
  agentIndex: number;
  message: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn';
}

export interface ConfirmationPayload {
  id: string;
  title: string;
  question: string;
  context?: string;
  options: ConfirmationOption[];
}

/** Options can be either a simple string key or a rich object from the backend. */
export type ConfirmationOption =
  | string
  | { id: string; label: string; description?: string };
