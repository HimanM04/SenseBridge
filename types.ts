export enum AppMode {
  IDLE = 'IDLE',
  NARRATION = 'NARRATION',
  OBJECT_FINDER = 'OBJECT_FINDER',
  DOCUMENT_READER = 'DOCUMENT_READER',
  TASK_GUIDANCE = 'TASK_GUIDANCE',
  WALKING_ASSIST = 'WALKING_ASSIST'
}

export interface ModeConfig {
  mode: AppMode;
  label: string;
  systemInstruction: string;
  icon: string;
  description: string;
}

export interface AudioState {
  isPlaying: boolean;
  isListening: boolean;
  volume: number;
}