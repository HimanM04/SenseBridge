import React, { useState, useEffect, useRef } from 'react';
import { CameraView } from './components/CameraView';
import { ControlPanel, getSystemInstructionForMode } from './components/ControlPanel';
import { useGeminiLive } from './hooks/useGeminiLive';
import { useFeedback } from './hooks/useFeedback';
import { AppMode } from './types';
import { Power, Activity, Volume2, Search, ArrowRight, Mic } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.NARRATION);
  const [active, setActive] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [searchQuery, setSearchQuery] = useState('');
  const [isListeningForSearch, setIsListeningForSearch] = useState(false);
  const isConnecting = useRef(false);
  
  const { playSound, triggerHaptic } = useFeedback();

  // Screen reader announcer helper
  const announce = (message: string) => {
    setAnnouncement(message);
    setTimeout(() => setAnnouncement(''), 3000);
  };

  const handleConnectionChange = (connected: boolean) => {
    isConnecting.current = false;
    if (connected) {
        playSound('on');
        triggerHaptic('success');
        announce("Agent connected. Scene Narration mode active.");
    } else {
        // Only set active false if we were previously connected (avoids flickering state during startup errors)
        setActive(false);
        playSound('off');
        triggerHaptic('medium');
        announce("Agent disconnected.");
    }
  };

  const handleError = (err: string) => {
      isConnecting.current = false;
      setActive(false);
      playSound('error');
      triggerHaptic('failure');
      announce(`Error: ${err}`);
  };

  const { connect, disconnect, isConnected, error, volumeLevel, sendMessage } = useGeminiLive({
    onConnectionStateChange: handleConnectionChange,
    onError: handleError,
    systemInstruction: "You are SenseBridge. Wait for instructions."
  });

  // Auto-connect effect when camera is ready and user wants to be active
  useEffect(() => {
    const connectToGemini = async () => {
        if (active && videoElement && !isConnected && !isConnecting.current) {
            isConnecting.current = true;
            try {
                await connect(videoElement);
            } catch (e) {
                isConnecting.current = false;
                setActive(false); // Reset UI on immediate fail
            }
        }
    };
    
    connectToGemini();
  }, [active, videoElement, isConnected, connect]);

  // Handle Page Visibility API (Stop camera/mic when minimized)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);

      if (!visible && active) {
        console.log("App minimized, disconnecting session...");
        disconnect();
        setActive(false); // Ensure UI reflects stopped state
        announce("App minimized. Agent disconnected to save battery.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [active, disconnect]);

  const toggleSession = () => {
    if (active) {
      disconnect();
      setActive(false);
    } else {
      triggerHaptic('light');
      setActive(true);
      // Connection will happen via useEffect once camera initializes and onVideoReady fires
      announce("Starting camera...");
    }
  };

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    const instruction = getSystemInstructionForMode(newMode);
    
    announce(`Switched to ${newMode.replace('_', ' ').toLowerCase()} mode.`);
    
    if (isConnected && instruction) {
       sendMessage(`System Update: User switched to ${newMode}. ${instruction}`);
    }
  };

  const handleFeedback = (type: 'mode' | 'click') => {
      playSound(type);
      triggerHaptic(type === 'mode' ? 'medium' : 'light');
  };

  const handleFlipCamera = () => {
      const newMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(newMode);
      announce(`Switched to ${newMode === 'user' ? 'front' : 'back'} camera`);
      handleFeedback('click');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim() || !isConnected) return;
      
      triggerHaptic('medium');
      const message = `I am looking for: ${searchQuery}. Guide me to it.`;
      sendMessage(message);
      announce(`Searching for ${searchQuery}`);
  };

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        announce("Voice recognition not supported in this browser.");
        return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        setIsListeningForSearch(true);
        announce("Listening for object name...");
        triggerHaptic('light');
    };

    recognition.onend = () => {
        setIsListeningForSearch(false);
    };

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        announce(`Heard ${transcript}. Searching now.`);
        
        if (isConnected) {
            const message = `I am looking for: ${transcript}. Guide me to it.`;
            sendMessage(message);
        }
    };

    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListeningForSearch(false);
        announce("Could not hear you. Please try again.");
    };

    recognition.start();
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-yellow-500 selection:text-black">
      {/* Screen Reader Announcer */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Header */}
      <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                <Activity className="text-black" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">SenseBridge</h1>
        </div>
        
        <div className="flex items-center space-x-4">
            {isConnected && (
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-green-900/30 border border-green-500/50 text-green-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold uppercase tracking-wider">Live</span>
                </div>
            )}
        </div>
      </header>

      <main className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 gap-6">
        
        {/* Left Column: Visual Feed & Main Toggle */}
        <div className="flex-1 flex flex-col space-y-6">
            <div className="relative">
                {/* Camera View active only when user starts session AND page is visible */}
                <CameraView 
                    onVideoReady={setVideoElement} 
                    isActive={active && isPageVisible} 
                    facingMode={facingMode}
                    onFlipCamera={handleFlipCamera}
                    mode={mode}
                />
                
                {/* Visualizer Overlay (Decorative) */}
                {isConnected && (
                    <div className="absolute bottom-4 left-4 right-4 h-12 flex items-end justify-center gap-1 pointer-events-none" aria-hidden="true">
                        {Array.from({ length: 12 }).map((_, i) => (
                             <div 
                                key={i}
                                className="w-2 bg-yellow-400 rounded-t-sm transition-all duration-75"
                                style={{ 
                                    height: `${Math.max(10, Math.min(100, volumeLevel * 200 * (Math.random() * 0.5 + 0.5)))}%`,
                                    opacity: 0.8
                                }}
                             />
                        ))}
                    </div>
                )}
            </div>

            {/* Main Action Button - Oversized for accessibility */}
            <button
                onClick={toggleSession}
                className={`
                    w-full py-8 rounded-3xl text-3xl font-black uppercase tracking-widest transition-all transform active:scale-95
                    flex items-center justify-center space-x-4 shadow-2xl focus:outline-none focus:ring-8 focus:ring-white
                    ${active 
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30 ring-red-400' 
                        : 'bg-yellow-400 hover:bg-yellow-300 text-black shadow-yellow-900/30 ring-yellow-200 animate-pulse-slow'}
                `}
                aria-label={active ? "Stop Agent. Currently listening." : "Start Agent. Tap to begin."}
            >
                <Power size={48} strokeWidth={3} />
                <span>{active ? "Stop" : "Start"}</span>
            </button>
            
            {error && (
                <div className="p-4 bg-red-900/50 border-l-4 border-red-500 text-red-200 rounded-r-lg" role="alert">
                    <p className="font-bold">Connection Error</p>
                    <p>{error}</p>
                </div>
            )}
        </div>

        {/* Right Column: Controls */}
        <div className="flex-1">
             <div className="bg-zinc-900/50 rounded-3xl border border-zinc-800 p-2 h-full">
                
                {/* Object Finder Search Input */}
                {mode === AppMode.OBJECT_FINDER && isConnected && (
                    <div className="mx-4 mt-4 bg-zinc-800/50 border border-yellow-500/30 p-4 rounded-2xl animate-in fade-in slide-in-from-top-4">
                        <label htmlFor="object-search" className="block text-yellow-400 font-bold mb-2 uppercase tracking-wider text-xs">
                            What are you looking for?
                        </label>
                        <form onSubmit={handleSearchSubmit} className="flex gap-2 relative">
                            <input 
                                id="object-search"
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="e.g. My Keys, Wallet..."
                                className="flex-1 bg-black text-white pl-4 pr-12 py-3 rounded-xl border border-zinc-700 focus:border-yellow-500 outline-none transition-colors text-lg"
                                autoComplete="off"
                            />
                            
                            {/* Voice Search Button */}
                            <button
                                type="button"
                                onClick={handleVoiceSearch}
                                className={`absolute right-16 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${isListeningForSearch ? 'bg-red-600 text-white animate-pulse' : 'bg-transparent text-zinc-400 hover:text-white'}`}
                                aria-label="Use Voice Search"
                            >
                                <Mic size={20} />
                            </button>

                            <button 
                                type="submit"
                                aria-label="Start Searching"
                                className="bg-yellow-500 text-black p-3 rounded-xl font-bold hover:bg-yellow-400 active:scale-95 transition-transform"
                            >
                                <ArrowRight size={24} />
                            </button>
                        </form>
                    </div>
                )}

                <div className="p-4 mb-2">
                    <h2 className="text-xl font-bold text-zinc-400 uppercase tracking-widest text-sm mb-4" id="mode-select-label">Select Mode</h2>
                    <ControlPanel 
                        currentMode={mode} 
                        onModeSelect={handleModeChange} 
                        isConnected={isConnected}
                        onFeedback={handleFeedback}
                    />
                </div>
                
                {!isConnected && (
                    <div className="px-8 pb-8 text-center text-zinc-500" aria-hidden="true">
                        <p className="text-lg">Press <strong>Start</strong> to begin.</p>
                    </div>
                )}
             </div>
        </div>
      </main>
    </div>
  );
};

export default App;