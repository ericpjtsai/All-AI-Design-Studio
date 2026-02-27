export const PLAYER_INDEX = 0;
export const TOTAL_COUNT = 4;

export interface AgentData {
  index: number;
  department: string;
  role: string;
  expertise: string[];
  mission: string;
  personality: string;
  isPlayer: boolean;
  color: string;
}

const ROLES = [
  {
    role: 'Design Manager',
    department: 'Leadership',
    expertise: ['Orchestration', 'Strategy', 'Review'],
    mission: 'Coordinate the team and gate quality at every step',
    personality: 'Decisive & communicative',
    color: '#7EACEA',
  },
  {
    role: 'Senior Designer',
    department: 'UX & Strategy',
    expertise: ['User Flows', 'IA', 'Wireframes'],
    mission: 'Define the UX strategy and information architecture',
    personality: 'Analytical & user-focused',
    color: '#22c55e',
  },
  {
    role: 'Junior Designer',
    department: 'UI Implementation',
    expertise: ['React', 'TypeScript', 'Components'],
    mission: 'Build production-ready UI components',
    personality: 'Detail-oriented & precise',
    color: '#ef4444',
  },
  {
    role: 'Visual Designer',
    department: 'Design Systems',
    expertise: ['Tokens', 'Brand', 'Figma'],
    mission: 'Define the visual language and design tokens',
    personality: 'Creative & systematic',
    color: '#EF52BA',
  },
];

const _agents: AgentData[] = [];

// Index 0: the user (Design Manager / player)
_agents.push({
  index: 0,
  ...ROLES[0],
  isPlayer: true,
});

// Indices 1–199: cycle through the 4 roles
for (let i = 1; i < TOTAL_COUNT; i++) {
  const role = ROLES[i % ROLES.length];
  _agents.push({
    index: i,
    ...role,
    isPlayer: false,
  });
}

export const AGENTS: AgentData[] = _agents;

export function getAgent(index: number): AgentData | undefined {
  return _agents[index];
}
