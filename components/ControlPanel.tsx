import React from 'react';
import { Eye, Search, FileText, CheckSquare, Activity, Footprints } from 'lucide-react';
import { AppMode, ModeConfig } from '../types';

interface ControlPanelProps {
  currentMode: AppMode;
  onModeSelect: (mode: AppMode) => void;
  isConnected: boolean;
  onFeedback: (type: 'mode' | 'click') => void;
}

const MODES: ModeConfig[] = [
  {
    mode: AppMode.NARRATION,
    label: "Scene Narration",
    systemInstruction: "You are in Scene Narration Mode. Continuously and concisely describe what you see in the video feed. Mention safety hazards like obstacles, stairs, or traffic immediately.",
    icon: "Eye",
    description: "Real-time environment description"
  },
  {
    mode: AppMode.WALKING_ASSIST,
    label: "Walking Assist",
    systemInstruction: "CRITICAL SAFETY MODE. You are a real-time navigation guide for a blind pedestrian. Your ONLY priority is preventing collisions and falls. \n1. IMMEDIATE FRONTAL OBSTACLES: Prioritize detecting half-open doors, glass panels, poles, wires, or overhanging objects (head/chest level) directly in front. \n2. GROUND HAZARDS: Scan the floor for obstacles, toys, uneven pavement, stairs (up/down), or wet spots. \n3. DYNAMIC THREATS: Warn of approaching people, vehicles, or animals. \n4. COMMUNICATION PROTOCOL: \n   - IMPACT IMMINENT (< 1m): Shout 'STOP! [Obstacle]'. \n   - CAUTION (< 3m): Say 'Caution, [Obstacle] ahead'. \n   - DIRECTIONAL: Use clock-face (e.g., 'Bench at 2 o'clock') for things not directly in path. \n   - CLEAR PATH: If walking and safe, briefly say 'Path clear' every 10 seconds. \n5. Be concise. Do not describe scene aesthetics.",
    icon: "Footprints",
    description: "Obstacle detection & path safety"
  },
  {
    mode: AppMode.OBJECT_FINDER,
    label: "Object Finder",
    systemInstruction: "You are in Object Finder Mode. The user will state an object they are looking for. Your goal is to find it in the video feed. If you see it, give specific directions like 'It is slightly to the left', 'Move forward', 'It is right in front of you'. If you don't see it, ask the user to pan the camera slowly. Be concise and directive.",
    icon: "Search",
    description: "Locate specific items nearby"
  },
  {
    mode: AppMode.DOCUMENT_READER,
    label: "Document Reader",
    systemInstruction: "You are in Document Reader Mode. When a document is visible, read the text aloud. Summarize headers first, then read details if asked. Be precise with numbers and dates.",
    icon: "FileText",
    description: "Read labels, mail, and receipts"
  },
  {
    mode: AppMode.TASK_GUIDANCE,
    label: "Task Guidance",
    systemInstruction: "You are in Task Guidance Mode. Ask the user what task they need help with (e.g., 'Make Tea'). Then break it down into small steps, verifying each step visually before moving on.",
    icon: "CheckSquare",
    description: "Step-by-step help for daily tasks"
  }
];

export const ControlPanel: React.FC<ControlPanelProps> = ({ currentMode, onModeSelect, isConnected, onFeedback }) => {
  
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Eye': return <Eye size={32} />;
      case 'Search': return <Search size={32} />;
      case 'FileText': return <FileText size={32} />;
      case 'CheckSquare': return <CheckSquare size={32} />;
      case 'Footprints': return <Footprints size={32} />;
      default: return <Activity size={32} />;
    }
  };

  const handleModeClick = (mode: AppMode) => {
    if (isConnected) {
        onFeedback('mode');
        onModeSelect(mode);
    } else {
        onFeedback('click'); // Indicate simple interaction but inactive
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      <div className="grid grid-cols-1 gap-4" role="radiogroup" aria-label="Operation Modes">
        {MODES.map((m) => (
          <button
            key={m.mode}
            onClick={() => handleModeClick(m.mode)}
            disabled={!isConnected}
            role="radio"
            aria-checked={currentMode === m.mode}
            className={`
              relative overflow-hidden group
              flex items-center p-6 rounded-2xl border-4 transition-all duration-200
              focus:outline-none focus:ring-4 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-black
              ${currentMode === m.mode 
                ? 'bg-yellow-400 border-yellow-400 text-black scale-105 shadow-[0_0_30px_rgba(250,204,21,0.5)] z-10' 
                : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-yellow-200 hover:text-white'}
              ${!isConnected ? 'opacity-50 cursor-not-allowed grayscale' : 'active:scale-95'}
            `}
            aria-label={`${m.label} mode. ${m.description}`}
          >
            <div className={`mr-5 p-3 rounded-full ${currentMode === m.mode ? 'bg-black/20' : 'bg-zinc-800'}`}>
              {getIcon(m.icon)}
            </div>
            <div className="text-left">
              <h3 className="text-2xl font-bold tracking-tight">{m.label}</h3>
              <p className={`text-sm mt-1 font-medium ${currentMode === m.mode ? 'text-black/80' : 'text-zinc-400'}`}>
                {m.description}
              </p>
            </div>
            
            {/* Active Indicator for low vision */}
            {currentMode === m.mode && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 bg-black rounded-full animate-pulse" aria-hidden="true"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const getSystemInstructionForMode = (mode: AppMode): string | undefined => {
  return MODES.find(m => m.mode === mode)?.systemInstruction;
};