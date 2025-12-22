
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
  CODING = 'CODING',
  CUSTOM = 'CUSTOM'
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
  isEnded: boolean;
  report?: AnalysisReport | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum DebatePersona {
  SKEPTIC = 'SKEPTIC', // Challenges everything
  OPTIMIST = 'OPTIMIST', // Supports blindly
  COLLABORATOR = 'COLLABORATOR', // Constructive teammate
  SOCRATIC = 'SOCRATIC' // Asks questions to guide
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

// --- Interactive Story Types ---

export interface StoryInteractable {
  id: string;
  label: string; // The text shown when hovered
  type: 'EXAMINE' | 'PICKUP' | 'TRANSITION';
  description: string; // What happens when clicked (short prompt context)
}

export interface StorySceneState {
  narrative: string; // The story text
  visualPrompt: string; // Used to generate the BG
  interactables: StoryInteractable[];
  inventory: string[]; // Items collected
  bgImage: string | null;
  
  // New Fields for Character
  userRole: string; // e.g. "Detective", "Space Marine"
  characterImage: string | null; // Base64 of the portrait

  history: string[]; // Narrative history for context
  isLoading: boolean;
  isImageLoading: boolean;
}
