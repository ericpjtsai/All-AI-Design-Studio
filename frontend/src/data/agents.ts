export interface AgentData {
  index: number;
  role: string;
  department: string;
  expertise: string[];
  mission: string;
  personality: string;
  color: string;
  isOrchestrator: boolean;
}

export const AGENTS: AgentData[] = [
  {
    index: 0,
    role: 'Design Manager',
    department: 'Leadership',
    expertise: ['Orchestration', 'Strategy', 'Review'],
    mission: 'Coordinate the team and gate quality at every step',
    personality: 'Decisive & communicative',
    color: '#7EACEA',
    isOrchestrator: true,
  },
  {
    index: 1,
    role: 'Senior Designer',
    department: 'UX & Strategy',
    expertise: ['User Flows', 'IA', 'Wireframes'],
    mission: 'Define the UX strategy and information architecture',
    personality: 'Analytical & user-focused',
    color: '#22c55e',
    isOrchestrator: false,
  },
  {
    index: 2,
    role: 'Junior Designer',
    department: 'UI Implementation',
    expertise: ['React', 'TypeScript', 'Components'],
    mission: 'Build production-ready UI components',
    personality: 'Detail-oriented & precise',
    color: '#ef4444',
    isOrchestrator: false,
  },
  {
    index: 3,
    role: 'Visual Designer',
    department: 'Design Systems',
    expertise: ['Tokens', 'Brand', 'Figma'],
    mission: 'Define the visual language and design tokens',
    personality: 'Creative & systematic',
    color: '#EF52BA',
    isOrchestrator: false,
  },
];
