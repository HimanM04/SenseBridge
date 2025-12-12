import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, PowerOff, RefreshCw } from 'lucide-react';
import { AppMode } from '../types';

interface CameraViewProps {
  onVideoReady: (video: HTMLVideoElement) => void;
  isActive: boolean;
  facingMode: 'user' | 'environment';
  onFlipCamera: () => void;
  mode: AppMode;
}

export const CameraView: React.FC<CameraViewProps> = ({ onVideoReady, isActive, facingMode, onFlipCamera, mode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const stopCamera = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
      }
    };

    const startCamera = async () => {
      stopCamera(); // Ensure previous stream is stopped before starting new one (e.g. flip)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        streamRef.current = stream;
        setHasPermission(true);
        setError(null);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
             if(videoRef.current) {
                videoRef.current.play().catch(e => console.error("Play error", e));
                onVideoReady(videoRef.current);
             }
          };
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setError("Camera access denied. Please enable permissions.");
        setHasPermission(false);
      }
    };

    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, facingMode, onVideoReady]);

  return (
    <div className="relative w-full aspect-[4/3] bg-zinc-900 rounded-3xl overflow-hidden border-2 border-zinc-800 shadow-inner group">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-6 text-center">
          <CameraOff size={48} className="mb-4" />
          <p className="text-xl font-bold">{error}</p>
        </div>
      ) : !isActive ? (
         <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 p-6 text-center bg-zinc-950">
            <PowerOff size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">Camera Paused</p>
         </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transition-transform duration-500 ${facingMode === 'user' ? '-scale-x-100' : ''}`}
            playsInline
            muted
            autoPlay
          />
          {!hasPermission && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
               <Camera size={48} className="animate-pulse" />
            </div>
          )}
          
          {/* Object Finder Scanning Overlay */}
          {hasPermission && mode === AppMode.OBJECT_FINDER && (
             <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                <div className="w-full h-2 bg-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-scan blur-sm"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-yellow-500/30 rounded-full animate-ping [animation-duration:3s]"></div>
                </div>
             </div>
          )}

          {/* Walking Assist Safety Overlays */}
          {hasPermission && mode === AppMode.WALKING_ASSIST && (
              <div className="absolute inset-0 pointer-events-none z-10 opacity-60">
                  {/* Ground Plane Grid */}
                  <div className="absolute inset-x-0 bottom-0 h-[40%] bg-[linear-gradient(transparent_0%,_rgba(0,255,100,0.1)_100%),_repeating-linear-gradient(0deg,_transparent_0px,_transparent_19px,_rgba(0,255,100,0.3)_20px),_repeating-linear-gradient(90deg,_transparent_0px,_transparent_39px,_rgba(0,255,100,0.3)_40px)] [transform:perspective(500px)_rotateX(45deg)_scale(1.5)] origin-bottom"></div>
                  
                  {/* Central Collision Zone Bracket (HUD Style) */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-x-4 border-red-500/40 rounded-3xl flex items-center justify-center">
                       <div className="w-4 h-4 bg-red-500/50 rounded-full animate-pulse"></div>
                       <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
                       <div className="absolute bottom-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
                  </div>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-green-400 font-mono text-xs font-bold uppercase tracking-widest bg-black/50 px-2 py-1 rounded">
                      Obstacle Guard Active
                  </div>
              </div>
          )}
          
          {/* Accessibility overlay for low vision - High contrast Reticle */}
          {hasPermission && mode !== AppMode.OBJECT_FINDER && mode !== AppMode.WALKING_ASSIST && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
                <div className="w-64 h-64 border-4 border-yellow-400 rounded-full border-dashed"></div>
                <div className="absolute w-4 h-4 bg-yellow-400 rounded-full"></div>
            </div>
          )}

          {/* Flip Camera Button */}
          {hasPermission && (
             <button
                onClick={(e) => { e.stopPropagation(); onFlipCamera(); }}
                className="absolute top-4 right-4 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-yellow-400 z-20"
                aria-label="Flip Camera"
             >
                <RefreshCw size={24} />
             </button>
          )}
        </>
      )}
    </div>
  );
};