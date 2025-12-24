
export enum AppMode {
  HOME = 'HOME',
  SIMULATION = 'SIMULATION',
  DEBATE = 'DEBATE',
  REPORT_VIEW = 'REPORT_VIEW',
  INTERACTIVE_STORY = 'INTERACTIVE_STORY'
}

export enum SimulationType {
  HISTORY = 'HISTORY',
  CHEMISTRY = 'CHEMISTRY',
  PHYSICS = 'PHYSICS',
  LITERATURE = 'LITERATURE',
  CODING = 'CODING',
  CUSTOM = 'CUSTOM'
}

// --- 3D Scene Configuration Types ---
export type SceneObjectType = 'BEAKER' | 'FLASK' | 'SPHERE' | 'CUBE' | 'PLANE' | 'CYLINDER';

export interface SceneObjectConfig {
  id: string;
  type: SceneObjectType;
  position: [number, number, number];
  scale?: [number, number, number];
  color?: string; // Hex string
  label?: string; // Floating text
  liquidColor?: string; // Only for containers
  liquidLevel?: number; // 0 to 1
  roughness?: number;
  metalness?: number;
}

export interface SceneConfig {
  objects: SceneObjectConfig[];
  lightingColor?: string;
  environment?: 'LAB' | 'SPACE' | 'DEFAULT';
}

export interface AnalysisReport {
  score: number;
  evaluation: string;
  keyLearnings: string[];
  suggestions: string;
}

export interface SimulationState {
  description: string;
  imageBase64: string | null;
  options: string[];
  history: { role: 'user' | 'model'; text: string }[];
  isLoading: boolean;
  isImageLoading: boolean;
  waitingForVisualChoice: boolean;
  isEnded: boolean;
  report?: AnalysisReport | null;
  // New: Store the current 3D configuration
  sceneConfig?: SceneConfig | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum DebatePersona {
  SKEPTIC = 'SKEPTIC', 
  OPTIMIST = 'OPTIMIST', 
  COLLABORATOR = 'COLLABORATOR', 
  SOCRATIC = 'SOCRATIC' 
}

export interface DebateConfig {
  topic: string;
  persona: DebatePersona;
}

export interface SavedRecord {
  id: string;
  timestamp: number;
  type: SimulationType;
  topic: string;
  report: AnalysisReport;
  transcript: { role: 'user' | 'model'; text: string }[];
}

export interface StoryInteractable {
  id: string;
  label: string; 
  type: 'EXAMINE' | 'PICKUP' | 'TRANSITION';
  description: string; 
}

export interface StorySceneState {
  narrative: string; 
  visualPrompt: string; 
  interactables: StoryInteractable[];
  inventory: string[]; 
  bgImage: string | null;
  userRole: string; 
  characterImage: string | null; 
  history: string[]; 
  isLoading: boolean;
  isImageLoading: boolean;
}
