
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateStoryScene, generateSimulationImage, initializeStoryRole } from '../services/geminiService';
import { StorySceneState, StoryInteractable } from '../types';
import { Icons } from '../constants';

interface InteractiveStoryViewProps {
  theme: string;
  onExit: () => void;
}

// Extracted and Memoized Particle Component to prevent re-renders
const StoryParticleBackground = React.memo(() => {
  const particles = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      width: `${Math.random() * 3 + 1}px`,
      height: `${Math.random() * 3 + 1}px`,
      opacity: Math.random() * 0.6 + 0.2,
      animationDuration: '2s',
      animationDelay: `${Math.random() * 2}s`
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
        {particles.map((p) => (
        <div 
            key={p.id}
            className="absolute bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-jump will-change-transform"
            style={{
                top: p.top, 
                left: p.left,
                width: p.width,
                height: p.height,
                opacity: p.opacity,
                animationDuration: p.animationDuration, 
                animationDelay: p.animationDelay
            }}
        />
        ))}
    </div>
  );
});

const InteractiveStoryView: React.FC<InteractiveStoryViewProps> = ({ theme, onExit }) => {
  const [gameState, setGameState] = useState<StorySceneState>({
    narrative: "",
    visualPrompt: "",
    interactables: [],
    inventory: [],
    bgImage: null,
    history: [],
    userRole: "",
    characterImage: null,
    isLoading: true,
    isImageLoading: true
  });

  const [positions, setPositions] = useState<{top: string, left: string}[]>([]);
  const [customAction, setCustomAction] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [initError, setInitError] = useState<boolean>(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  // Animation & Logs
  const [interactingId, setInteractingId] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState<string[]>(["正在连接神经元...", "解析梦境主题..."]);

  // Audio State
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs for Procedural Sound
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const ambientNodesRef = useRef<{
    oscs: OscillatorNode[];
    gain: GainNode;
    filter: BiquadFilterNode;
  } | null>(null);

  // --- AUDIO ENGINE START ---

  // Initialize Audio Context & Procedural Drone
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        audioContextRef.current = ctx;

        // Master Volume
        const masterGain = ctx.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(ctx.destination);
        masterGainRef.current = masterGain;

        startAmbientDrone(ctx, masterGain, theme);
      } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    const startAmbientDrone = (ctx: AudioContext, dest: AudioNode, currentTheme: string) => {
       // Stop previous drone if exists
       if (ambientNodesRef.current) {
         ambientNodesRef.current.oscs.forEach(o => o.stop());
         ambientNodesRef.current.gain.disconnect();
       }

       // Configure Sound based on Theme
       let baseFreq = 55; // Low A
       let type: OscillatorType = 'sine';
       let detuneAmount = 2; 
       let filterFreq = 400;

       if (currentTheme.includes('赛博') || currentTheme.includes('Cyber')) {
          baseFreq = 65; // C2
          type = 'sawtooth';
          filterFreq = 800; // Brighter
          detuneAmount = 4;
       } else if (currentTheme.includes('恐怖') || currentTheme.includes('Deep') || currentTheme.includes('Poe')) {
          baseFreq = 48; // G1
          type = 'triangle';
          filterFreq = 200; // Darker
          detuneAmount = 10; // Dissonant
       } else if (currentTheme.includes('海')) {
          baseFreq = 110; 
          type = 'sine';
          filterFreq = 300; 
       }

       const osc1 = ctx.createOscillator();
       const osc2 = ctx.createOscillator();
       const osc3 = ctx.createOscillator(); // Sub-bass

       osc1.type = type;
       osc2.type = type;
       osc3.type = 'sine';

       osc1.frequency.value = baseFreq;
       osc2.frequency.value = baseFreq * 1.01; // Detune for chorus
       osc3.frequency.value = baseFreq / 2; // Sub

       osc2.detune.value = detuneAmount;

       // Drone Gain (Mixer)
       const droneGain = ctx.createGain();
       droneGain.gain.value = 0.15; // Low background level

       // LPF to soften harsh waves
       const filter = ctx.createBiquadFilter();
       filter.type = 'lowpass';
       filter.frequency.value = filterFreq;
       filter.Q.value = 1;

       // Connect Graph
       osc1.connect(filter);
       osc2.connect(filter);
       osc3.connect(filter);
       filter.connect(droneGain);
       droneGain.connect(dest);

       // Start
       const now = ctx.currentTime;
       osc1.start(now);
       osc2.start(now);
       osc3.start(now);

       ambientNodesRef.current = { oscs: [osc1, osc2, osc3], gain: droneGain, filter };
    };

    const handleUserGesture = () => {
      initAudio();
      window.removeEventListener('click', handleUserGesture);
    };
    window.addEventListener('click', handleUserGesture);

    return () => {
      if (ambientNodesRef.current) {
          ambientNodesRef.current.oscs.forEach(o => o.stop());
      }
      audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [theme]); // Re-run if theme changes dramatically to adjust drone

  // Update Volume
  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
        const now = audioContextRef.current.currentTime;
        masterGainRef.current.gain.linearRampToValueAtTime(isMuted ? 0 : volume, now + 0.1);
    }
  }, [volume, isMuted]);

  // SFX: Interaction (Pluck/Ding)
  const playInteractSfx = (type: 'PICKUP' | 'EXAMINE' | 'TRANSITION') => {
    const ctx = audioContextRef.current;
    if (!ctx || !masterGainRef.current) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(masterGainRef.current);

    const now = ctx.currentTime;

    if (type === 'PICKUP') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // Slide up
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'TRANSITION') {
        // Noise Burst Logic (simulated with randomized waves for simplicity)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else {
        // Examine - Soft ping
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
  };

  // SFX: Scene Load (Atmospheric Swell)
  const playSceneLoadSfx = () => {
    const ctx = audioContextRef.current;
    if (!ctx || !masterGainRef.current) return;

    // Create a swell using filter sweep
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = 110; 
    
    filter.type = 'lowpass';
    filter.Q.value = 5;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current);

    const now = ctx.currentTime;
    
    // Filter sweep up
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 1.5);

    // Volume fade in/out
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.5);
    gain.gain.linearRampToValueAtTime(0, now + 2);

    osc.start(now);
    osc.stop(now + 2);
  };

  // --- AUDIO ENGINE END ---

  // Helper to add logs
  const addLog = (text: string) => {
    setLoadingLogs(prev => [...prev.slice(-4), text]); 
  };

  const initGame = async () => {
     try {
       setInitError(false);
       setLoadingLogs(["正在连接神经元...", "解析梦境主题..."]);
       setGameState(prev => ({ ...prev, isLoading: true }));

       addLog(`正在生成角色设定: ${theme}...`);
       const roleData = await initializeStoryRole(theme);
       
       addLog(`角色确认: ${roleData.role}`);
       addLog(`视觉参数: ${roleData.visualPrompt.substring(0, 30)}...`);

       const scene = await generateStoryScene([], "开始探索", theme, roleData.role);
       addLog("构建初始场景...");
       
       // Start image generations
       const [charImg, bgImg] = await Promise.all([
         generateSimulationImage(roleData.visualPrompt),
         generateSimulationImage(scene.visualPrompt)
       ]);

       addLog("渲染完成。");

       // Trigger Scene Sound
       playSceneLoadSfx();

       setTimeout(() => {
           setGameState(prev => ({
              ...prev,
              userRole: roleData.role,
              characterImage: charImg,
              narrative: scene.narrative,
              visualPrompt: scene.visualPrompt,
              interactables: scene.interactables,
              history: [scene.narrative],
              bgImage: bgImg,
              isLoading: false,
              isImageLoading: false
           }));
       }, 800);

     } catch (e) {
       console.error("Init failed", e);
       setInitError(true);
       setLoadingLogs(prev => [...prev, "系统响应超时，请重试。"]);
       // Keep isLoading true to show the error screen instead of main game
     }
  };

  // Initialize Game on mount
  useEffect(() => {
    initGame();
  }, [theme]);

  // Standard Typewriter Effect
  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    
    if (!gameState.narrative) return;

    let currentIndex = 0;
    const fullText = gameState.narrative;
    let timeoutId: any;

    const typeChar = () => {
      if (currentIndex >= fullText.length) {
        setIsTyping(false);
        return;
      }
      setDisplayedText(fullText.slice(0, currentIndex + 1));
      currentIndex++;
      timeoutId = setTimeout(typeChar, 30); 
    };

    timeoutId = setTimeout(typeChar, 30);
    return () => clearTimeout(timeoutId);
  }, [gameState.narrative]);

  // Randomize positions
  useEffect(() => {
    if (gameState.interactables.length > 0) {
      const newPos = gameState.interactables.map(() => ({
        top: `${20 + Math.random() * 50}%`,
        left: `${15 + Math.random() * 70}%`
      }));
      setPositions(newPos);
    }
  }, [gameState.interactables]);

  const loadScene = async (history: string[], action: string, currentTheme: string, role: string) => {
    setGameState(prev => ({ ...prev, isImageLoading: true })); 
    setInteractingId(null); 
    setShowCustomInput(false);

    try {
      const scene = await generateStoryScene(history, action, currentTheme, role);
      
      setGameState(prev => ({
        ...prev,
        narrative: scene.narrative,
        visualPrompt: scene.visualPrompt,
        interactables: scene.interactables,
        history: [...prev.history, scene.narrative],
        isImageLoading: true 
      }));

      generateSimulationImage(scene.visualPrompt).then(img => {
        setGameState(prev => ({ 
          ...prev, 
          bgImage: img || prev.bgImage, 
          isImageLoading: false 
        }));
        playSceneLoadSfx(); // Play sound when background updates
      });

    } catch (e) {
      console.error(e);
      // Don't leave user in image loading state if text gen fails
      setGameState(prev => ({ ...prev, isImageLoading: false }));
      // Optional: Flash a small error notification (simplified here by not breaking flow)
    }
  };

  const handleInteract = (item: StoryInteractable) => {
    if (gameState.isLoading || interactingId) return;
    
    setInteractingId(item.id);
    playInteractSfx(item.type); // Improved SFX

    let actionDesc = item.description;
    if (item.type === 'PICKUP') {
      actionDesc = `拾取了 ${item.label}。 ${item.description}`;
      setGameState(prev => ({...prev, inventory: [...prev.inventory, item.label]}));
    }

    setTimeout(() => {
        loadScene(gameState.history, actionDesc, theme, gameState.userRole);
    }, 1000); 
  };

  // --- NEW: Handle Continue Button Click ---
  const handleContinue = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent bubbling to skipTyping
    if (gameState.isLoading || gameState.isImageLoading || interactingId) return;

    playInteractSfx('TRANSITION');
    // Send a passive "Continue" action to the AI to generate the next segment
    loadScene(gameState.history, "（继续剧情/观察环境）", theme, gameState.userRole);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAction.trim() || gameState.isLoading) return;
    
    playInteractSfx('EXAMINE'); // Simple feedback sound for text input
    loadScene(gameState.history, `玩家尝试执行动作: ${customAction}`, theme, gameState.userRole);
    setCustomAction('');
  };

  const skipTyping = () => {
    if (isTyping) {
      setDisplayedText(gameState.narrative);
      setIsTyping(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black text-slate-200 font-sans overflow-hidden cursor-none select-none"
      ref={containerRef}
    >
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 bg-black transition-opacity duration-1000">
        {gameState.bgImage ? (
          <img 
            src={gameState.bgImage} 
            alt="Scene" 
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
             <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black" />
          </div>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />
      </div>

      {/* Interactables Layer */}
      <div className="absolute inset-0 z-10">
        {!gameState.isLoading && !isTyping && !gameState.isImageLoading && gameState.interactables.map((item, idx) => {
          const isInteracting = interactingId === item.id;
          
          return (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                handleInteract(item);
              }}
              style={{ 
                top: positions[idx]?.top || '50%', 
                left: positions[idx]?.left || '50%' 
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 group cursor-none 
                ${isInteracting 
                    ? item.type === 'PICKUP' ? 'animate-[ping_0.5s_ease-out_forwards]' 
                    : item.type === 'TRANSITION' ? 'animate-[slideInRight_1s_ease-in]'
                    : 'animate-pulse' 
                    : 'animate-scale-in'}
              `}
            >
              <div className={`relative w-16 h-16 flex items-center justify-center transition-transform duration-300 ${isInteracting ? 'scale-150' : 'group-hover:scale-110'}`}>
                 <div className={`absolute inset-0 bg-white/10 rounded-full blur-xl ${isInteracting ? 'opacity-100' : 'animate-pulse'}`} />
                 <div className="absolute inset-0 border border-white/30 rounded-full opacity-40 hover:opacity-100 transition-opacity" />
                 
                 <div className={`w-8 h-8 rounded-full backdrop-blur-sm border border-white/50 flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,255,255,0.3)]
                    ${isInteracting ? 'bg-white text-black' : 'bg-black/40'}
                 `}>
                   {item.type === 'PICKUP' ? <Icons.Sparkles /> : item.type === 'TRANSITION' ? <Icons.ArrowRight /> : <div className="w-2 h-2 bg-white rounded-full" />}
                 </div>

                 {!isInteracting && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-max px-3 py-1 bg-black/60 text-white text-[10px] tracking-widest uppercase border border-white/20 rounded backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                      {item.label}
                    </div>
                 )}
              </div>
            </div>
          );
        })}
      </div>

      {/* UI Layer */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between">
        
        {/* Top Bar */}
        <div className="flex justify-between items-start p-6 pointer-events-auto">
           
           <button onClick={onExit} className="px-4 py-2 bg-black/40 hover:bg-red-900/40 border border-white/10 rounded-full text-xs text-slate-300 hover:text-white transition-all backdrop-blur-md cursor-none flex items-center gap-2">
             <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
             退出
           </button>
           
           {/* Center Inventory */}
           <div className="flex gap-2 mx-auto">
             {gameState.inventory.map((inv, i) => (
               <div key={i} className="px-3 py-1 bg-black/40 border border-white/20 rounded-full text-[10px] text-amber-200 backdrop-blur shadow-lg animate-scale-in">
                 {inv}
               </div>
             ))}
           </div>

           {/* Audio Controls */}
           <div className="relative flex items-center" onMouseEnter={() => setShowVolumeSlider(true)} onMouseLeave={() => setShowVolumeSlider(false)}>
              <div className={`transition-all duration-300 overflow-hidden ${showVolumeSlider ? 'w-24 opacity-100 mr-2' : 'w-0 opacity-0'}`}>
                 <input 
                   type="range" 
                   min="0" max="1" step="0.05"
                   value={volume}
                   onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if(parseFloat(e.target.value) > 0) setIsMuted(false);
                   }}
                   className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                 />
              </div>
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 bg-black/40 hover:bg-white/10 border border-white/10 rounded-full text-slate-300 hover:text-white transition-all backdrop-blur-md cursor-none"
              >
                {isMuted || volume === 0 ? <Icons.SpeakerXMark /> : <Icons.SpeakerWave />}
              </button>
           </div>
        </div>

        {/* Bottom Dialogue */}
        <div className="w-full pb-8 pt-20 px-4 md:px-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-auto flex flex-col md:flex-row items-end gap-6">
           
           {gameState.characterImage && (
             <div className="shrink-0 relative hidden md:flex flex-col items-center">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border border-white/30 overflow-hidden bg-black/50 shadow-[0_0_20px_rgba(255,255,255,0.1)] relative z-10 translate-y-2">
                  <img src={gameState.characterImage} alt="Character" className="w-full h-full object-cover" />
                </div>
                {/* Simplified Character Name */}
                <div className="mt-2 text-white font-serif text-lg tracking-widest drop-shadow-md z-20">
                  {gameState.userRole}
                </div>
             </div>
           )}

           <div className="flex-1 w-full relative">
              <div className="relative">
                 <div className="md:hidden absolute -top-6 left-0 text-white font-serif text-sm tracking-widest drop-shadow-md mb-2">
                    {gameState.userRole}
                 </div>

                 {/* Clickable Dialogue Box */}
                 <div 
                    onClick={skipTyping}
                    className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl md:rounded-tl-2xl p-6 min-h-[120px] shadow-2xl relative overflow-hidden group hover:bg-black/50 transition-colors cursor-pointer"
                 >
                    <p className="text-sm md:text-lg leading-relaxed text-slate-100 font-medium drop-shadow-md select-none pr-8">
                      {displayedText}
                      {isTyping && <span className="inline-block w-2 h-4 bg-white/50 ml-1 animate-pulse align-middle" />}
                    </p>

                    {/* OBVIOUS LOADING INDICATOR */}
                    {gameState.isImageLoading && !isTyping && (
                       <div className="absolute bottom-4 right-4 flex items-center gap-3 px-3 py-1.5 bg-black/60 rounded-full border border-white/10 animate-fade-in shadow-lg">
                          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs text-indigo-300 font-bold tracking-wide">环境生成中...</span>
                       </div>
                    )}

                    {/* CONTINUE / NEXT ARROW (Bottom Right) */}
                    {!isTyping && !gameState.isImageLoading && !interactingId && (
                       <button 
                         onClick={handleContinue}
                         className="absolute bottom-3 right-3 animate-bounce bg-white/10 p-1.5 rounded-full backdrop-blur-sm border border-white/5 hover:bg-white/20 transition-colors cursor-pointer z-30"
                         title="继续对话"
                       >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                       </button>
                    )}
                 </div>
              </div>

              {/* CUSTOM ACTION AREA */}
              <div className="mt-3 relative flex justify-end">
                {/* Toggle Button */}
                {!showCustomInput && !gameState.isLoading && (
                  <button 
                    onClick={() => setShowCustomInput(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg border border-white/10 backdrop-blur-md shadow-lg transition-all hover:scale-105 active:scale-95 cursor-none"
                  >
                    <Icons.Keyboard />
                    <span className="text-xs font-bold">自定义行动</span>
                  </button>
                )}

                {/* Pop-out Input Form */}
                {showCustomInput && (
                  <form onSubmit={handleCustomSubmit} className="relative w-full max-w-lg animate-scale-in">
                    <input
                      type="text"
                      value={customAction}
                      onChange={(e) => setCustomAction(e.target.value)}
                      placeholder="描述你想做的事情..."
                      autoFocus
                      className="w-full bg-black/60 border border-indigo-500/50 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all cursor-none shadow-xl backdrop-blur-md"
                      disabled={gameState.isLoading}
                    />
                    <button 
                      type="submit" 
                      disabled={!customAction.trim() || gameState.isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg cursor-none transition-colors"
                    >
                      <Icons.Send />
                    </button>
                    {/* Close Button */}
                    <button
                       type="button"
                       onClick={() => setShowCustomInput(false)}
                       className="absolute -top-3 -right-3 w-6 h-6 bg-red-500/80 text-white rounded-full flex items-center justify-center text-xs shadow-md cursor-none hover:bg-red-400"
                    >
                       ✕
                    </button>
                  </form>
                )}
              </div>
           </div>
        </div>
      </div>
      
      {/* Initial Loading Screen with Logs & Retry */}
      {gameState.isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#020617]">
           {/* Deep Space Gradient */}
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0f172a] to-black opacity-90 animate-pulse-slow"></div>
           
           {/* Use Memoized Particle Component */}
           <StoryParticleBackground />

           {/* Central Content */}
           <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-in-up w-full max-w-2xl px-4">
              <div className="text-center space-y-4">
                 <h2 className="text-3xl md:text-6xl font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-purple-100 via-white to-indigo-200 tracking-[0.1em] drop-shadow-[0_0_30px_rgba(167,139,250,0.6)]">
                    进入梦境当中
                 </h2>
                 <div className="flex items-center gap-3 justify-center text-indigo-300/60 text-[10px] md:text-xs uppercase tracking-[0.3em] font-mono">
                    <span className="w-8 h-[1px] bg-indigo-500/50"></span>
                    <span>Synchronizing Reality</span>
                    <span className="w-8 h-[1px] bg-indigo-500/50"></span>
                 </div>
              </div>

              {/* Scrolling Log for Character Prompts */}
              <div className="w-full bg-black/30 backdrop-blur border border-white/5 rounded-lg p-4 font-mono text-xs text-green-400/80 h-32 overflow-hidden flex flex-col justify-end shadow-inner transition-colors">
                 {loadingLogs.map((log, i) => (
                    <div key={i} className={`animate-fade-in-up truncate ${log.includes("超时") || log.includes("失败") ? "text-red-400" : ""}`}>
                       <span className="opacity-50 mr-2">{'>'}</span>
                       {log}
                    </div>
                 ))}
                 {!initError && <div className="animate-pulse">_</div>}
              </div>

              {/* Retry Button */}
              {initError && (
                 <button 
                   onClick={() => initGame()}
                   className="px-6 py-2 bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500 hover:text-white rounded-lg transition-all animate-bounce cursor-none"
                 >
                    重新连接神经元 (RETRY)
                 </button>
              )}
           </div>
        </div>
      )}

    </div>
  );
};

export default InteractiveStoryView;
