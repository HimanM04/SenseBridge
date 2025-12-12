import { useCallback, useRef } from 'react';

export const useFeedback = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  };

  const playSound = useCallback((type: 'click' | 'on' | 'off' | 'error' | 'mode') => {
    try {
        initAudio();
        const ctx = audioCtxRef.current!;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        
        switch (type) {
          case 'click': // Sharp tick
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
            gain.gain.setValueAtTime(0.1, now); // Lower volume to prevent ear fatigue
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
          case 'mode': // Soft ping
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
          case 'on': // Ascending
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.15);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
          case 'off': // Descending
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(300, now + 0.15);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
          case 'error': // Low buzz
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        }
    } catch (e) {
        console.warn("Audio feedback failed", e);
    }
  }, []);

  const triggerHaptic = useCallback((pattern: 'light' | 'medium' | 'heavy' | 'success' | 'failure') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            switch (pattern) {
              case 'light': navigator.vibrate(10); break;
              case 'medium': navigator.vibrate(40); break;
              case 'heavy': navigator.vibrate(70); break;
              case 'success': navigator.vibrate([30, 50, 30]); break;
              case 'failure': navigator.vibrate([50, 50, 50, 50, 50]); break;
            }
        } catch (e) {
            // Ignore vibration errors
        }
    }
  }, []);

  return { playSound, triggerHaptic };
};