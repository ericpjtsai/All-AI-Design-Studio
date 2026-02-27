export const PLAYER_INDEX = 0;
export const TOTAL_COUNT = 5;

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

export const AGENTS: AgentData[] = [
  {
    index: 0,
    role: 'CEO',
    department: 'Executive',
    expertise: ['Strategy', 'Leadership', 'Vision'],
    mission: 'Direct the AI design team to ship world-class products',
    personality: 'Decisive & inspiring',
    color: '#f59e0b',   // amber — stands out as the player
    isPlayer: true,
  },
  {
    index: 1,
    role: 'Design Manager',
    department: 'Leadership',
    expertise: ['Orchestration', 'Strategy', 'Review'],
    mission: 'Coordinate the team and gate quality at every step',
    personality: 'Decisive & communicative',
    color: '#7EACEA',  // cyan — orchestrator
    isPlayer: false,
  },
  {
    index: 2,
    role: 'Senior Designer',
    department: 'UX & Strategy',
    expertise: ['User Flows', 'IA', 'Wireframes'],
    mission: 'Define the UX strategy and information architecture',
    personality: 'Analytical & user-focused',
    color: '#22c55e',  // green
    isPlayer: false,
  },
  {
    index: 3,
    role: 'Junior Designer',
    department: 'UI Implementation',
    expertise: ['React', 'TypeScript', 'Components'],
    mission: 'Build production-ready UI components',
    personality: 'Detail-oriented & precise',
    color: '#ef4444',  // red
    isPlayer: false,
  },
  {
    index: 4,
    role: 'Visual Designer',
    department: 'Design Systems',
    expertise: ['Tokens', 'Brand', 'Figma'],
    mission: 'Define the visual language and design tokens',
    personality: 'Creative & systematic',
    color: '#EF52BA',  // pink
    isPlayer: false,
  },
];

export function getAgent(index: number): AgentData | undefined {
  return AGENTS[index];
}
