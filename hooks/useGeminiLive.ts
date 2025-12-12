import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, createPcmBlob, decodeAudioData } from '../utils/audio';

// Constants
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const FRAME_RATE = 2; // Frames per second sent to model

interface UseGeminiLiveProps {
  onConnectionStateChange: (connected: boolean) => void;
  onError?: (error: string) => void;
  systemInstruction?: string;
}

export const useGeminiLive = ({ onConnectionStateChange, onError, systemInstruction }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Refs for audio context and processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const videoIntervalRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();

    // Stop microphone tracks explicitly to turn off hardware light
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    setIsConnected(false);
    onConnectionStateChange(false);
    setVolumeLevel(0);
  }, [onConnectionStateChange]);

  const connect = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key is missing");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Audio Context Setup
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: INPUT_SAMPLE_RATE,
      });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: OUTPUT_SAMPLE_RATE,
      });

      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      // Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream; // Store for cleanup
      
      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemInstruction || "You are SenseBridge, a helpful assistive AI.",
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            setIsConnected(true);
            onConnectionStateChange(true);
            
            // Start Audio Processing Loop
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualization
              let sum = 0;
              for(let i=0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolumeLevel(Math.sqrt(sum / inputData.length));

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
            
            // Start Video Processing Loop
            startVideoStream(videoElement, sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
               const ctx = outputAudioContextRef.current;
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               
               const audioBytes = base64ToUint8Array(base64Audio);
               const audioBuffer = await decodeAudioData(audioBytes, ctx, OUTPUT_SAMPLE_RATE);
               
               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(outputNode);
               
               source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
               });

               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               sourcesRef.current.add(source);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log('Gemini Live Session Closed');
            cleanup();
          },
          onerror: (err) => {
            console.error('Gemini Live Error', err);
            const errorMessage = "Connection Error";
            setError(errorMessage);
            if(onError) onError(errorMessage);
            cleanup();
          }
        }
      });
      
      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || "Failed to start session";
      setError(errorMessage);
      if(onError) onError(errorMessage);
      cleanup();
    }
  }, [cleanup, onConnectionStateChange, systemInstruction, onError]);

  const startVideoStream = (videoEl: HTMLVideoElement, sessionPromise: Promise<any>) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Send frames at specific interval
    videoIntervalRef.current = window.setInterval(() => {
        if (!ctx || !videoEl.videoWidth) return;
        
        // Resize for performance/latency (360p is usually enough for context)
        const scale = 0.5;
        canvas.width = videoEl.videoWidth * scale;
        canvas.height = videoEl.videoHeight * scale;
        
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        
        const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        
        sessionPromise.then(session => {
             session.sendRealtimeInput({
                media: {
                    mimeType: 'image/jpeg',
                    data: base64Data
                }
            });
        });

    }, 1000 / FRAME_RATE); 
  };
  
  const sendMessage = useCallback((text: string) => {
      if(sessionRef.current) {
          sessionRef.current.sendRealtimeInput({
              content: { parts: [{ text }] }
          });
      }
  }, []);

  return { connect, disconnect: cleanup, isConnected, error, volumeLevel, sendMessage };
};