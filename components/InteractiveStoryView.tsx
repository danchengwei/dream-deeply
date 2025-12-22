
import React, { useState, useEffect, useRef } from 'react';
import { generateStoryScene, generateSimulationImage, initializeStoryRole } from '../services/geminiService';
import { StorySceneState, StoryInteractable } from '../types';
import { Icons } from '../constants';

interface InteractiveStoryViewProps {
  theme: string;
  onExit: () => void;
}

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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  // Ref to track loading state inside the typewriter closure without resetting it
  const isImageLoadingRef = useRef(gameState.isImageLoading);
  useEffect(() => {
    isImageLoadingRef.current = gameState.isImageLoading;
  }, [gameState.isImageLoading]);

  // Initialize Sound Engine
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        // Create a dark ambient drone
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, audioContextRef.current.currentTime); // Low frequency
        
        // Add some wobble/LFO
        const lfo = audioContextRef.current.createOscillator();
        lfo.frequency.value = 0.2;
        const lfoGain = audioContextRef.current.createGain();
        lfoGain.gain.value = 10;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        gain.gain.setValueAtTime(0.05, audioContextRef.current.currentTime); // Very quiet
        
        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);
        osc.start();
        oscRef.current = osc;
      }
    };

    // Initialize on first click to respect browser autoplay policies
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

  // Initialize Game (Role -> Scene)
  useEffect(() => {
    const initGame = async () => {
       try {
         // 1. Initialize Role
         const roleData = await initializeStoryRole(theme);
         
         // 2. Start Generating Character Image (Async)
         const charImagePromise = generateSimulationImage(roleData.visualPrompt);
         
         // 3. Generate First Scene
         const scene = await generateStoryScene([], "开始探索", theme, roleData.role);
         
         // 4. Generate Background Image
         const bgImagePromise = generateSimulationImage(scene.visualPrompt);

         const [charImg, bgImg] = await Promise.all([charImagePromise, bgImagePromise]);

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

       } catch (e) {
         console.error("Init failed", e);
         setGameState(prev => ({ ...prev, isLoading: false, narrative: "初始化失败，请重试。" }));
       }
    };

    initGame();
  }, [theme]);

  // Optimized Typewriter Effect with Dynamic Speed
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

      // DYNAMIC SPEED STRATEGY:
      // If the image is still loading, we slow down the text significantly (70ms).
      // This buys time for the image to generate without the user feeling "stuck".
      // If image is ready, we go fast (25ms).
      const speed = isImageLoadingRef.current ? 70 : 25;
      
      timeoutId = setTimeout(typeChar, speed);
    };

    // Start typing
    timeoutId = setTimeout(typeChar, 30);

    return () => clearTimeout(timeoutId);
  }, [gameState.narrative]);

  // Randomize positions when interactables change
  useEffect(() => {
    if (gameState.interactables.length > 0) {
      const newPos = gameState.interactables.map(() => ({
        top: `${20 + Math.random() * 50}%`, // Keep strictly within central-upper area
        left: `${15 + Math.random() * 70}%` // Keep strictly within central area
      }));
      setPositions(newPos);
    }
  }, [gameState.interactables]);

  const loadScene = async (history: string[], action: string, currentTheme: string, role: string) => {
    setGameState(prev => ({ ...prev, isLoading: true })); // Keep image visible, just lock interaction

    try {
      const scene = await generateStoryScene(history, action, currentTheme, role);
      
      setGameState(prev => ({
        ...prev,
        narrative: scene.narrative,
        visualPrompt: scene.visualPrompt,
        interactables: scene.interactables,
        history: [...prev.history, scene.narrative],
        isLoading: false,
        isImageLoading: true // Start loading new BG, keeping old one for now
      }));

      // Generate Image in parallel
      generateSimulationImage(scene.visualPrompt).then(img => {
        setGameState(prev => ({ ...prev, bgImage: img, isImageLoading: false }));
      });

    } catch (e) {
      console.error(e);
      setGameState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleInteract = (item: StoryInteractable) => {
    if (gameState.isLoading || isTyping) {
       // If typing, skip to end
       if (isTyping) {
         setDisplayedText(gameState.narrative);
         setIsTyping(false);
         return;
       }
       // If loading, ignore
       if (gameState.isLoading) return;
    }
    
    let actionDesc = item.description;
    if (item.type === 'PICKUP') {
      actionDesc = `拾取了 ${item.label}。 ${item.description}`;
      // Add to inventory
      setGameState(prev => ({...prev, inventory: [...prev.inventory, item.label]}));
    }

    loadScene(gameState.history, actionDesc, theme, gameState.userRole);
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
      onClick={skipTyping} // Global click to skip typing
    >
      {/* Background Layer with Transition Effect */}
      <div className="absolute inset-0 z-0 bg-black">
        {gameState.bgImage ? (
          <img 
            src={gameState.bgImage} 
            alt="Scene" 
            className={`w-full h-full object-cover transition-all duration-[2000ms] ease-in-out ${
              gameState.isImageLoading 
                ? 'scale-110 opacity-60 blur-md grayscale-[50%]' // Dream-like blur when loading next scene
                : 'scale-100 opacity-100 blur-0 grayscale-0'
            }`}
          />
        ) : (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
            <div className="animate-pulse text-slate-500 flex flex-col items-center gap-4">
               <div className="w-12 h-12 border-4 border-slate-700 border-t-slate-300 rounded-full animate-spin"></div>
               <p>正在潜入梦境...</p>
            </div>
          </div>
        )}
        {/* Cinematic Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />
      </div>

      {/* Interactive Layer (Hotspots) - Only show when ready */}
      <div className="absolute inset-0 z-10">
        {!gameState.isImageLoading && !gameState.isLoading && !isTyping && gameState.interactables.map((item, idx) => (
          <div
            key={item.id}
            onClick={(e) => {
              e.stopPropagation(); // Prevent skipping typing when clicking an item
              handleInteract(item);
            }}
            style={{ 
              top: positions[idx]?.top || '50%', 
              left: positions[idx]?.left || '50%' 
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-none animate-scale-in"
          >
            {/* The "Ghost Orb" */}
            <div className="relative w-16 h-16 flex items-center justify-center">
               <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse" />
               <div className="absolute inset-0 border-2 border-white/30 rounded-full animate-ping opacity-20" />
               
               {/* Icon Circle */}
               <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm border border-white/50 flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,255,255,0.5)] group-hover:scale-110 transition-transform duration-300">
                 {item.type === 'PICKUP' ? <Icons.Sparkles /> : item.type === 'TRANSITION' ? <Icons.ArrowRight /> : <div className="w-2 h-2 bg-white rounded-full" />}
               </div>

               {/* Floating Label */}
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-max px-3 py-1 bg-black/60 text-white text-[10px] tracking-widest uppercase border border-white/20 rounded backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-y-2 group-hover:translate-y-0 pointer-events-none">
                 {item.label}
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* UI Layer */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between">
        
        {/* Top Bar: Inventory & Exit */}
        <div className="flex justify-between items-start p-6 pointer-events-auto">
           <button onClick={onExit} className="px-4 py-2 bg-black/40 hover:bg-red-900/40 border border-white/10 rounded-full text-xs text-slate-300 hover:text-white transition-all backdrop-blur-md cursor-none flex items-center gap-2">
             <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
             退出梦境
           </button>
           
           <div className="flex gap-2">
             {gameState.inventory.map((inv, i) => (
               <div key={i} className="px-3 py-1 bg-black/40 border border-white/20 rounded-full text-[10px] text-amber-200 backdrop-blur animate-fade-in shadow-lg">
                 {inv}
               </div>
             ))}
           </div>
        </div>

        {/* Bottom Dialogue Area (Genshin Style) */}
        <div className="w-full pb-8 pt-20 px-4 md:px-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-auto flex flex-col md:flex-row items-end gap-6">
           
           {/* Character Portrait */}
           {gameState.characterImage && (
             <div className="shrink-0 relative hidden md:block">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-white/20 overflow-hidden bg-black/50 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative z-10 translate-y-4">
                  <img src={gameState.characterImage} alt="Character" className="w-full h-full object-cover" />
                </div>
                {/* Name Tag Badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-purple-600 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-lg z-20 whitespace-nowrap border border-white/20">
                  {gameState.userRole}
                </div>
             </div>
           )}

           {/* Dialogue Box */}
           <div className="flex-1 w-full">
              <div className="relative">
                 {/* Mobile Name Tag */}
                 <div className="md:hidden absolute -top-3 left-0 px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-t-lg">
                    {gameState.userRole || "..."}
                 </div>

                 {/* Text Container - More Transparent */}
                 <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl rounded-tl-none md:rounded-tl-2xl p-6 min-h-[120px] shadow-2xl relative overflow-hidden group hover:bg-black/40 transition-colors">
                    {/* Corner Decorations */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/30 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-white/30 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-white/30 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/30 rounded-br-lg" />
                    
                    {/* Text */}
                    <p className="text-sm md:text-lg leading-relaxed text-slate-100 font-medium drop-shadow-md select-none">
                      {displayedText}
                      {isTyping && <span className="inline-block w-2 h-4 bg-white/50 ml-1 animate-pulse align-middle" />}
                    </p>

                    {/* Image Loading Indicator (When text is done but image isn't) */}
                    {!isTyping && gameState.isImageLoading && (
                       <div className="absolute bottom-4 right-4 flex items-center gap-2 text-[10px] text-indigo-300 animate-pulse bg-black/40 px-2 py-1 rounded-full border border-indigo-500/30">
                          <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                          <span>场景显现中...</span>
                       </div>
                    )}

                    {/* Next Indicator (Only when everything is ready) */}
                    {!isTyping && !gameState.isLoading && !gameState.isImageLoading && (
                       <div className="absolute bottom-4 right-4 animate-bounce text-white/50">
                          <Icons.ArrowRight />
                       </div>
                    )}
                 </div>
              </div>

              {/* Custom Input (Integrated below dialogue) */}
              <form onSubmit={handleCustomSubmit} className="mt-2 relative group w-full max-w-lg ml-auto">
                <input
                  type="text"
                  value={customAction}
                  onChange={(e) => setCustomAction(e.target.value)}
                  placeholder="自定义行动..."
                  className="w-full bg-transparent border-b border-white/10 py-2 text-xs text-slate-400 focus:text-white focus:border-white/50 focus:outline-none transition-all text-right pr-8 cursor-none"
                  disabled={gameState.isLoading}
                  onClick={(e) => e.stopPropagation()} // Allow clicking input without skipping text
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
      
      {/* Loading Overlay (Initial) */}
      {gameState.isLoading && !gameState.bgImage && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-white space-y-4">
           <h2 className="text-2xl font-light tracking-[0.5em] animate-pulse">NEXUS</h2>
           <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
             <div className="h-full bg-white animate-slide-in-right w-1/2"></div>
           </div>
           <p className="text-xs text-slate-500 uppercase">Generating World State...</p>
        </div>
      )}

    </div>
  );
};

export default InteractiveStoryView;
