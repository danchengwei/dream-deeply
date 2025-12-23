
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
  
  // New State for Animations & Loading Logs
  const [interactingId, setInteractingId] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState<string[]>(["正在连接神经元...", "解析梦境主题..."]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  // Initialize Sound Engine
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, audioContextRef.current.currentTime);
        gain.gain.setValueAtTime(0.05, audioContextRef.current.currentTime);
        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);
        osc.start();
        oscRef.current = osc;
      }
    };

    const handleInteraction = () => {
      initAudio();
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);

    return () => {
      oscRef.current?.stop();
      audioContextRef.current?.close();
    };
  }, []);

  // Helper to add logs
  const addLog = (text: string) => {
    setLoadingLogs(prev => [...prev.slice(-4), text]); // Keep last 5 lines
  };

  // Initialize Game
  useEffect(() => {
    const initGame = async () => {
       try {
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

         // Small delay to let user read the final log
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
         setGameState(prev => ({ ...prev, isLoading: false, narrative: "初始化失败，请重试。" }));
       }
    };

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
    setInteractingId(null); // Reset interaction

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
      });

    } catch (e) {
      console.error(e);
      setGameState(prev => ({ ...prev, isImageLoading: false }));
    }
  };

  const handleInteract = (item: StoryInteractable) => {
    if (gameState.isLoading || interactingId) return;
    
    // Set interacting state to trigger animation
    setInteractingId(item.id);

    // Play sound
    if (oscRef.current && audioContextRef.current) {
        oscRef.current.frequency.setValueAtTime(400, audioContextRef.current.currentTime);
        oscRef.current.frequency.exponentialRampToValueAtTime(100, audioContextRef.current.currentTime + 0.5);
    }

    let actionDesc = item.description;
    if (item.type === 'PICKUP') {
      actionDesc = `拾取了 ${item.label}。 ${item.description}`;
      setGameState(prev => ({...prev, inventory: [...prev.inventory, item.label]}));
    }

    // Delay actual load to allow animation to play
    setTimeout(() => {
        loadScene(gameState.history, actionDesc, theme, gameState.userRole);
    }, 1000); 
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAction.trim() || gameState.isLoading) return;
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
        {!gameState.isLoading && !isTyping && gameState.interactables.map((item, idx) => {
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
              // Animation Logic:
              // - Default: scale-in when appearing.
              // - Interacting (PICKUP): scale up and fade out (consumed).
              // - Interacting (EXAMINE): pulse/shake.
              // - Interacting (TRANSITION): move to right.
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
           
           <div className="flex gap-2">
             {gameState.inventory.map((inv, i) => (
               <div key={i} className="px-3 py-1 bg-black/40 border border-white/20 rounded-full text-[10px] text-amber-200 backdrop-blur shadow-lg animate-scale-in">
                 {inv}
               </div>
             ))}
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

           <div className="flex-1 w-full">
              <div className="relative">
                 <div className="md:hidden absolute -top-6 left-0 text-white font-serif text-sm tracking-widest drop-shadow-md mb-2">
                    {gameState.userRole}
                 </div>

                 {/* Clickable Dialogue Box */}
                 <div 
                    onClick={skipTyping}
                    className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl md:rounded-tl-2xl p-6 min-h-[120px] shadow-2xl relative overflow-hidden group hover:bg-black/50 transition-colors cursor-pointer"
                 >
                    <p className="text-sm md:text-lg leading-relaxed text-slate-100 font-medium drop-shadow-md select-none">
                      {displayedText}
                      {isTyping && <span className="inline-block w-2 h-4 bg-white/50 ml-1 animate-pulse align-middle" />}
                    </p>

                    {gameState.isImageLoading && !isTyping && (
                       <div className="absolute bottom-4 right-4 flex items-center gap-2 text-[10px] text-white/40 animate-pulse">
                          <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce"></div>
                          <span>环境构建中...</span>
                       </div>
                    )}
                 </div>
              </div>

              <form onSubmit={handleCustomSubmit} className="mt-2 relative group w-full max-w-lg ml-auto">
                <input
                  type="text"
                  value={customAction}
                  onChange={(e) => setCustomAction(e.target.value)}
                  placeholder="自定义行动..."
                  className="w-full bg-transparent border-b border-white/10 py-2 text-xs text-slate-400 focus:text-white focus:border-white/50 focus:outline-none transition-all text-right pr-8 cursor-none"
                  disabled={gameState.isLoading}
                  onClick={(e) => e.stopPropagation()} 
                />
                <button 
                  type="submit" 
                  disabled={!customAction.trim() || gameState.isLoading}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-none"
                >
                  <Icons.Send />
                </button>
              </form>
           </div>
        </div>
      </div>
      
      {/* Initial Loading Screen with Logs */}
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
              <div className="w-full bg-black/30 backdrop-blur border border-white/5 rounded-lg p-4 font-mono text-xs text-green-400/80 h-32 overflow-hidden flex flex-col justify-end shadow-inner">
                 {loadingLogs.map((log, i) => (
                    <div key={i} className="animate-fade-in-up truncate">
                       <span className="opacity-50 mr-2">{'>'}</span>
                       {log}
                    </div>
                 ))}
                 <div className="animate-pulse">_</div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default InteractiveStoryView;
