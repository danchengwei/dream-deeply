
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateSimulationTurn, generateSimulationImage } from '../services/geminiService';
import { SimulationType, SimulationState, SavedRecord } from '../types';
import { Icons } from '../constants';
import Matter from 'matter-js';

interface SimulationViewProps {
  type: SimulationType;
  customTopic?: string;
  onExit: () => void;
  onSaveRecord: (record: SavedRecord) => void;
}

const TYPE_LABELS = {
  [SimulationType.HISTORY]: "历史",
  [SimulationType.CHEMISTRY]: "化学",
  [SimulationType.PHYSICS]: "物理",
  [SimulationType.CODING]: "编程",
  [SimulationType.CUSTOM]: "自定义"
};

// --- Context-Aware Physics Engine ---
const PhysicsCanvas = React.memo(({ type, description, topic }: { type: SimulationType, description: string, topic?: string }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  // Initialize World
  useEffect(() => {
      if (!boxRef.current) return;

      // Module Aliases
      const Engine = Matter.Engine,
            Render = Matter.Render,
            Runner = Matter.Runner,
            World = Matter.World,
            Bodies = Matter.Bodies,
            Mouse = Matter.Mouse,
            MouseConstraint = Matter.MouseConstraint;

      // Clean up previous instance if exists (safety check)
      if (engineRef.current) {
        World.clear(engineRef.current.world, false);
        Engine.clear(engineRef.current);
      }

      const engine = Engine.create();
      engineRef.current = engine;

      const width = boxRef.current.clientWidth;
      const height = boxRef.current.clientHeight;

      const render = Render.create({
          element: boxRef.current,
          engine: engine,
          options: {
              width,
              height,
              background: '#0f172a',
              wireframes: false, // Solid shapes
              pixelRatio: window.devicePixelRatio
          }
      });
      renderRef.current = render;

      // Walls
      const wallOptions = { isStatic: true, render: { fillStyle: '#1e293b' } };
      World.add(engine.world, [
          Bodies.rectangle(width / 2, height + 30, width, 60, wallOptions), // Ground
          Bodies.rectangle(width / 2, -30, width, 60, wallOptions), // Ceiling
          Bodies.rectangle(width + 30, height / 2, 60, height, wallOptions), // Right
          Bodies.rectangle(-30, height / 2, 60, height, wallOptions) // Left
      ]);

      // --- Contextual Initialization ---
      const combinedText = (description + " " + (topic || "")).toLowerCase();
      
      if (type === SimulationType.CHEMISTRY) {
           engine.gravity.y = 0; // Microgravity for molecules
           engine.gravity.scale = 0;
           
           // Determine molecule type/color based on text
           let color = '#6366f1'; // Default Indigo
           if (combinedText.includes('acid') || combinedText.includes('red') || combinedText.includes('fire')) color = '#ef4444'; // Red
           else if (combinedText.includes('base') || combinedText.includes('blue') || combinedText.includes('water')) color = '#3b82f6'; // Blue
           else if (combinedText.includes('gas') || combinedText.includes('steam')) color = '#cbd5e1'; // White/Grey

           const particles = [];
           const count = combinedText.includes('explosion') || combinedText.includes('fast') ? 60 : 30;
           const speed = combinedText.includes('heat') || combinedText.includes('hot') ? 15 : 5;

           for(let i=0; i<count; i++) {
               const r = 6 + Math.random() * 8;
               const particle = Bodies.circle(
                   Math.random() * (width - 100) + 50, 
                   Math.random() * (height - 100) + 50, 
                   r, 
                   { 
                       restitution: 0.9, 
                       frictionAir: 0.005,
                       render: { fillStyle: color, opacity: 0.8 } 
                   }
               );
               Matter.Body.setVelocity(particle, { 
                   x: (Math.random()-0.5) * speed, 
                   y: (Math.random()-0.5) * speed 
               });
               particles.push(particle);
           }
           World.add(engine.world, particles);

      } else {
           // PHYSICS
           engine.gravity.y = 1;
           engine.gravity.scale = 0.001; // Normal gravity

           // Detect scenario
           if (combinedText.includes('pendulum') || combinedText.includes('swing')) {
               // Pendulum setup
               const ball = Bodies.circle(width/2, height/2, 20, { density: 0.04, render: { fillStyle: '#f43f5e' } });
               const anchor = { x: width/2, y: 100 };
               const constraint = Matter.Constraint.create({
                   pointA: anchor,
                   bodyB: ball,
                   stiffness: 0.9,
                   length: 200,
                   render: { strokeStyle: '#cbd5e1' }
               });
               World.add(engine.world, [ball, constraint]);
           } 
           else if (combinedText.includes('ramp') || combinedText.includes('slide') || combinedText.includes('incline')) {
               // Ramp setup
               const ramp = Bodies.rectangle(width/2, height - 150, 400, 20, { 
                   isStatic: true, 
                   angle: Math.PI * 0.15,
                   render: { fillStyle: '#475569' }
               });
               const box = Bodies.rectangle(width/2 - 150, height - 300, 40, 40, { render: { fillStyle: '#facc15' } });
               const circle = Bodies.circle(width/2 - 100, height - 300, 20, { render: { fillStyle: '#f43f5e' } });
               World.add(engine.world, [ramp, box, circle]);
           }
           else {
               // Default Stack (Gravity test)
               const stack = Matter.Composites.stack(width/2 - 50, 100, 4, 4, 0, 0, (x, y) => {
                   return Bodies.rectangle(x, y, 40, 40, { 
                     render: { fillStyle: '#6366f1' },
                     restitution: 0.6
                   });
               });
               World.add(engine.world, stack);
           }
      }

      // Mouse Interaction
      const mouse = Mouse.create(render.canvas);
      const mouseConstraint = MouseConstraint.create(engine, {
          mouse: mouse,
          constraint: { stiffness: 0.2, render: { visible: false } }
      });
      World.add(engine.world, mouseConstraint);
      render.mouse = mouse;

      // Start
      Render.run(render);
      const runner = Runner.create();
      runnerRef.current = runner;
      Runner.run(runner, engine);

      return () => {
          Render.stop(render);
          Runner.stop(runner);
          if (engineRef.current) {
             World.clear(engineRef.current.world, false);
             Engine.clear(engineRef.current);
          }
          if (render.canvas) render.canvas.remove();
          renderRef.current = null;
          runnerRef.current = null;
          engineRef.current = null;
      };
  }, [type, topic]); // Re-init on fundamental type change

  // Dynamic Updates based on Description Changes (User moves forward in simulation)
  useEffect(() => {
      if (!engineRef.current) return;
      const combinedText = description.toLowerCase();
      const World = Matter.World;
      const Bodies = Matter.Bodies;
      const width = boxRef.current?.clientWidth || 800;

      // React to specific event keywords in the new turn
      if (combinedText.includes('explode') || combinedText.includes('boom')) {
          const bodies = Matter.Composite.allBodies(engineRef.current.world);
          bodies.forEach(body => {
              if (!body.isStatic) {
                  Matter.Body.applyForce(body, body.position, { 
                      x: (body.position.x - width/2) * 0.002, 
                      y: (body.position.y - 300) * 0.002 
                  });
              }
          });
      }
      
      if (combinedText.includes('add') || combinedText.includes('appear') || combinedText.includes('drop')) {
          // Spawn a new object
          const newBody = Bodies.polygon(width/2 + (Math.random()-0.5)*100, 50, Math.floor(Math.random() * 5) + 3, 30, {
              render: { fillStyle: '#ffffff' },
              restitution: 0.6
          });
          World.add(engineRef.current.world, newBody);
      }

  }, [description]);

  return <div ref={boxRef} className="w-full h-full relative cursor-crosshair" />;
});


// Extracted and Memoized Particle Component
const ParticleBackground = React.memo(() => {
  const particles = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      width: `${Math.random() * 3 + 1}px`,
      height: `${Math.random() * 3 + 1}px`,
      opacity: Math.random() * 0.5 + 0.1,
      animationDuration: `${1.5 + Math.random()}s`,
      animationDelay: `${Math.random() * 2}s`
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
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

const SimulationView: React.FC<SimulationViewProps> = ({ type, customTopic, onExit, onSaveRecord }) => {
  const [simState, setSimState] = useState<SimulationState>({
    description: "正在初始化模拟环境...",
    imageBase64: null,
    options: [],
    history: [],
    isLoading: true,
    isImageLoading: true, // Only true when we are actually fetching something
    waitingForVisualChoice: false,
    isEnded: false,
    report: null
  });

  const [visualStyle, setVisualStyle] = useState<'ARTISTIC' | 'SCHEMATIC' | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [loadingLogs, setLoadingLogs] = useState<string[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  
  const initialized = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reportSaved = useRef(false);

  const isScientificMode = type === SimulationType.PHYSICS || type === SimulationType.CHEMISTRY;

  const scrollToBottom = () => {
    setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Fake logs
  useEffect(() => {
    if(simState.isLoading) {
        const logs = [
            `> Initializing ${type} Module...`,
            "> Connecting to Neural Core...",
            "> Analyzing scenario parameters...",
            "> Awaiting User Input..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            const text = i < logs.length ? logs[i] : `> Computing probability fields...`;
            setLoadingLogs(prev => [...prev.slice(-4), text]);
            i++;
        }, 400); 
        return () => clearInterval(interval);
    }
  }, [simState.isLoading, type]);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const startSimulation = async () => {
      const initialContext = customTopic;
      
      try {
        const turn = await generateSimulationTurn([], initialContext || "Start", "开始模拟，请描述初始场景");
        
        // Update Text State ONLY first
        setSimState(prev => ({
          ...prev,
          description: turn.description,
          options: turn.options,
          history: [{ role: 'model' as const, text: turn.description }],
          isLoading: false,
          isEnded: turn.isEnded || false,
          report: turn.report,
          // CRITICAL: Stop loading image by default. Wait for user.
          isImageLoading: false, 
          waitingForVisualChoice: false
        }));
        
        scrollToBottom();

        // LOGIC BRANCH:
        if (isScientificMode) {
          // Scientific: Pause and ask user.
          setSimState(prev => ({ ...prev, waitingForVisualChoice: true }));
        } else {
          // History/Custom: Default to Artistic, but trigger load separate from initial render
          setVisualStyle('ARTISTIC');
          triggerImageGeneration(turn.description, 'ARTISTIC', turn.isEnded || false);
        }
        
      } catch (e) {
        console.error(e);
        setSimState(prev => ({ 
            ...prev, 
            description: "初始化失败，请重试。", 
            isLoading: false, 
            isImageLoading: false,
            waitingForVisualChoice: false
        }));
      }
    };

    startSimulation();
  }, [type, customTopic, isScientificMode]);

  // --- 2. USER ACTION ---
  const handleAction = async (actionText: string) => {
    if (!actionText.trim() || simState.isLoading || simState.isEnded || simState.waitingForVisualChoice) return;

    // Set text loading, keep visual state as is for now
    setSimState(prev => ({ ...prev, isLoading: true }));
    setCustomInput('');

    try {
      const newHistory: { role: 'user' | 'model'; text: string }[] = [...simState.history, { role: 'user', text: actionText }];
      const context = customTopic || ""; 
      
      // Generate Text
      const turn = await generateSimulationTurn(newHistory, context, actionText);

      setSimState(prev => ({
        ...prev,
        description: turn.description,
        options: turn.options || [],
        history: [...newHistory, { role: 'model' as const, text: turn.description }],
        isLoading: false,
        isEnded: turn.isEnded,
        report: turn.report
      }));
      
      scrollToBottom();

      // Handle Visual Update based on CURRENT style
      if (visualStyle === 'ARTISTIC') {
          triggerImageGeneration(turn.description, 'ARTISTIC', turn.isEnded);
      } else if (visualStyle === 'SCHEMATIC') {
          // For Schematic, we rely on the prop update passed to PhysicsCanvas
          // We DO NOT trigger image generation.
          if (turn.isEnded) setTimeout(() => setShowReportModal(true), 1200);
      }

    } catch (e) {
      console.error(e);
      setSimState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // --- 3. VISUAL LOGIC ---
  const triggerImageGeneration = async (description: string, style: 'ARTISTIC' | 'SCHEMATIC', isEnded: boolean) => {
      // If we are in Schematic mode, abort AI image generation completely
      if (style === 'SCHEMATIC') return;

      setSimState(prev => ({ ...prev, isImageLoading: true, waitingForVisualChoice: false }));
      
      try {
        const image = await generateSimulationImage(description, style);
        setSimState(prev => ({ ...prev, imageBase64: image, isImageLoading: false }));

        if (isEnded) setTimeout(() => setShowReportModal(true), 1200);
      } catch (e) {
        setSimState(prev => ({ ...prev, isImageLoading: false }));
        if (isEnded) setShowReportModal(true);
      }
  };

  const handleVisualChoice = (style: 'ARTISTIC' | 'SCHEMATIC') => {
      setVisualStyle(style);
      
      if (style === 'ARTISTIC') {
         // User chose AI Image: Start loading NOW.
         triggerImageGeneration(simState.description, style, simState.isEnded);
      } else {
         // User chose Physics: Just update state to show canvas. 
         // NO AI loading. PhysicsCanvas will mount immediately.
         setSimState(prev => ({ ...prev, isImageLoading: false, waitingForVisualChoice: false }));
      }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(customInput);
  };

  // Auto Save Report Logic
  useEffect(() => {
    if (simState.isEnded && simState.report && !reportSaved.current) {
       reportSaved.current = true;
       const record: SavedRecord = {
         id: Date.now().toString(),
         timestamp: Date.now(),
         type,
         topic: customTopic || simState.history[0]?.text.substring(0, 50) || "Unknown Simulation",
         report: simState.report,
         transcript: simState.history
       };
       onSaveRecord(record);
    }
  }, [simState.isEnded, simState.report, type, customTopic, simState.history, onSaveRecord]);


  // --- Initial Full Screen Loader ---
  if (simState.isLoading && simState.history.length === 0) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#020617] text-slate-200 font-mono">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0f172a] to-black opacity-90 animate-pulse-slow"></div>
           <ParticleBackground />
           <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-6">
              <div className="text-center space-y-2">
                 <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.3)] animate-spin-slow">
                    <Icons.Sparkles />
                 </div>
                 <h2 className="text-2xl font-bold tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-white">
                    {TYPE_LABELS[type]} SIMULATION
                 </h2>
                 <p className="text-[10px] text-indigo-400/60 tracking-widest">ESTABLISHING NEURAL LINK</p>
              </div>
              <div className="w-full bg-black/40 backdrop-blur-md border-l-2 border-indigo-500/50 p-4 h-32 flex flex-col justify-end font-mono text-xs text-indigo-300 shadow-inner rounded-r-lg transition-all">
                 {loadingLogs.map((log, i) => (
                    <div key={i} className="animate-fade-in-up truncate">
                       <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                       {log}
                    </div>
                 ))}
                 <div className="animate-pulse text-indigo-500">_</div>
              </div>
           </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-dark text-slate-200 font-sans animate-fade-in relative">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surface/80 backdrop-blur-md z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
           <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
           </button>
           <div className="flex items-center gap-2">
             <h2 className="text-lg font-bold text-white">
               {TYPE_LABELS[type]} 模拟
             </h2>
             {/* Show current style indicator if set */}
             {visualStyle === 'SCHEMATIC' && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                   仿真引擎: {type === SimulationType.CHEMISTRY ? '分子动力学' : '刚体物理'}
                </span>
             )}
           </div>
        </div>
        <div className={`px-3 py-1 text-xs rounded-full font-bold uppercase tracking-wide border transition-all duration-500 ${
          simState.isEnded ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' : 'bg-green-500/10 text-green-400 border-green-500/20'
        }`}>
          {simState.isEnded ? '模拟结束' : '进行中'}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
        
        {/* Visual Viewport */}
        <div className="w-full md:w-1/2 h-[35vh] md:h-full relative bg-black flex items-center justify-center overflow-hidden border-r border-white/5 shrink-0 group">
           
           {/* LAYER 1: PHYSICS CANVAS (Context Aware) */}
           {/* Only render if style is schematic and NOT waiting for choice */}
           {visualStyle === 'SCHEMATIC' && !simState.waitingForVisualChoice && (
              <div className="w-full h-full relative animate-fade-in">
                 <PhysicsCanvas 
                    type={type} 
                    description={simState.description}
                    topic={customTopic}
                 />
                 <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-[10px] text-white/70 px-3 py-1.5 rounded-full border border-white/10 pointer-events-none select-none z-10">
                     <span className="w-2 h-2 inline-block bg-green-500 rounded-full mr-2 animate-pulse"></span>
                     Real-time Physics: Interactive
                 </div>
              </div>
           )}

           {/* LAYER 2: AI IMAGE */}
           {visualStyle === 'ARTISTIC' && !simState.waitingForVisualChoice && (
               simState.imageBase64 ? (
                <div className="absolute inset-0">
                    <img 
                      src={simState.imageBase64} 
                      alt="Simulation State" 
                      className={`w-full h-full object-cover transition-all duration-700 ${simState.isImageLoading ? 'opacity-30 blur-md scale-105 saturate-0' : 'opacity-100 scale-100 group-hover:scale-110'}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-transparent to-transparent md:bg-gradient-to-l md:from-dark/50" />
                </div>
               ) : (
                // Fallback while first image loads
                <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center">
                    {!simState.isImageLoading && (
                        <div className="text-slate-600 flex flex-col items-center">
                          <Icons.Sparkles />
                          <span className="text-xs mt-2">准备生成...</span>
                        </div>
                    )}
                </div>
               )
           )}

           {/* LAYER 3: SELECTION OVERLAY (Scientific Mode Only) */}
           {simState.waitingForVisualChoice && (
              <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in p-6 text-center">
                 <div className="mb-8">
                    <h3 className="text-2xl font-bold text-white mb-2">选择模拟引擎</h3>
                    <p className="text-sm text-slate-400">检测到科学场景，请选择一种可视化方式</p>
                 </div>
                 
                 <div className="flex flex-col md:flex-row gap-6 w-full max-w-lg">
                     <button 
                       onClick={() => handleVisualChoice('SCHEMATIC')}
                       className="flex-1 group relative overflow-hidden bg-slate-800 border border-white/10 rounded-xl p-6 hover:border-blue-500/50 transition-all hover:bg-slate-800/80 active:scale-95"
                     >
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center gap-4">
                           <div className="p-4 bg-blue-500/20 text-blue-400 rounded-full group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                           </div>
                           <div className="text-left">
                              <div className="font-bold text-slate-200 text-center text-lg">实时物理仿真</div>
                              <div className="text-xs text-slate-500 text-center mt-1">
                                 Matter.js 引擎 · 交互式 · {type === SimulationType.CHEMISTRY ? '粒子碰撞' : '刚体动力学'}
                              </div>
                           </div>
                        </div>
                     </button>

                     <button 
                       onClick={() => handleVisualChoice('ARTISTIC')}
                       className="flex-1 group relative overflow-hidden bg-slate-800 border border-white/10 rounded-xl p-6 hover:border-purple-500/50 transition-all hover:bg-slate-800/80 active:scale-95"
                     >
                        <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center gap-4">
                           <div className="p-4 bg-purple-500/20 text-purple-400 rounded-full group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                              <Icons.Sparkles />
                           </div>
                           <div className="text-left">
                              <div className="font-bold text-slate-200 text-center text-lg">AI 场景生成</div>
                              <div className="text-xs text-slate-500 text-center mt-1">
                                 Imagen 3 · 艺术渲染 · 概念图
                              </div>
                           </div>
                        </div>
                     </button>
                 </div>
              </div>
           )}

           {/* LAYER 4: LOADING SPINNER (Only for AI Image) */}
           {simState.isImageLoading && visualStyle === 'ARTISTIC' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-8">
                 <div className="relative mb-6">
                    <div className="w-20 h-20 border-2 border-white/10 border-t-indigo-400 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-10 h-10 bg-indigo-500/20 rounded-full animate-pulse"></div>
                    </div>
                 </div>
                 <div className="text-center space-y-2 max-w-xs w-full">
                    <p className="text-xs font-bold tracking-widest text-white uppercase animate-pulse">Rendering Scene</p>
                 </div>
              </div>
           )}

           <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent md:hidden z-20">
             <p className="text-xs text-white/90 line-clamp-2">{simState.description}</p>
           </div>
        </div>

        {/* Narrative & Controls (Right Side) */}
        <div className="w-full md:w-1/2 flex flex-col flex-1 min-h-0 bg-dark relative overflow-hidden">
           
           {/* Chat History */}
           <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
              {simState.history.slice(1).map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                  <div className={`max-w-[90%] rounded-2xl p-4 shadow-sm transition-transform hover:scale-[1.01] ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-br-none shadow-primary/20' 
                      : 'bg-surface border border-white/5 text-slate-200 rounded-bl-none shadow-black/20'
                  }`}>
                    <p className="text-sm md:text-base leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
              
              {simState.isLoading && (
                 <div className="flex items-center gap-2 text-slate-500 text-sm p-4 animate-fade-in">
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce animation-delay-100" />
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce animation-delay-200" />
                 </div>
              )}
              
              <div ref={bottomRef} className="h-4"></div>
           </div>

           {/* Input Area */}
           {!simState.isEnded && (
             <div className="shrink-0 p-4 md:p-6 bg-surface/50 border-t border-white/5 backdrop-blur-sm z-20 animate-slide-in-right">
                
                {/* Options */}
                {simState.options.length > 0 && !simState.isLoading && (
                  <div className="grid gap-2 mb-4">
                    {simState.options.map((option, idx) => (
                      <button
                        key={idx}
                        disabled={simState.isLoading || simState.waitingForVisualChoice}
                        onClick={() => handleAction(option)}
                        className="w-full text-left px-5 py-3 rounded-xl bg-dark hover:bg-white/5 border border-white/5 hover:border-primary/50 transition-all text-sm text-slate-300 hover:text-white group flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <span>{option}</span>
                        <span className="text-white/20 group-hover:text-primary transition-colors"><Icons.ArrowRight /></span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Text Input */}
                <form onSubmit={handleCustomSubmit} className="relative flex items-center bg-dark rounded-xl border border-white/10 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-inner">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder={simState.waitingForVisualChoice ? "请先选择视觉引擎..." : "输入你的行动..."}
                    className="flex-1 bg-transparent px-4 py-3 text-white placeholder-slate-500 focus:outline-none text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={simState.isLoading || simState.waitingForVisualChoice}
                  />
                  <button 
                    type="submit"
                    disabled={!customInput.trim() || simState.isLoading || simState.waitingForVisualChoice}
                    className="p-2 m-1 rounded-lg bg-primary/20 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-30 active:scale-95"
                  >
                    <Icons.Send />
                  </button>
                </form>

             </div>
           )}

        </div>
      </div>

      {/* RESULT MODAL POPUP */}
      {showReportModal && simState.report && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-surface border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative animate-scale-in flex flex-col max-h-[90vh]">
               {/* Same Result Modal Content as before */}
               <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/30">
                        <Icons.Report />
                     </div>
                     <div>
                        <h3 className="text-lg font-bold text-white">模拟评估报告</h3>
                        <p className="text-xs text-indigo-200">Simulation Complete</p>
                     </div>
                  </div>
                  <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                     </svg>
                  </button>
               </div>
               <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                   <div className="flex items-center justify-center py-4">
                      <div className="relative">
                         <svg className="w-32 h-32 -rotate-90">
                            <circle cx="64" cy="64" r="56" stroke="#0f172a" strokeWidth="8" fill="none" />
                            <circle 
                               cx="64" cy="64" r="56" 
                               stroke={simState.report.score > 80 ? '#4ade80' : simState.report.score > 60 ? '#facc15' : '#f43f5e'} 
                               strokeWidth="8" 
                               fill="none" 
                               strokeDasharray="351" 
                               strokeDashoffset={351 - (351 * simState.report.score) / 100}
                               strokeLinecap="round"
                               className="transition-all duration-1000 ease-out"
                            />
                         </svg>
                         <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-extrabold text-white">{simState.report.score}</span>
                            <span className="text-[10px] uppercase text-slate-500 font-bold">Score</span>
                         </div>
                      </div>
                   </div>
                   <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">综合评价</h4>
                      <p className="text-sm text-slate-200 leading-relaxed">{simState.report.evaluation}</p>
                   </div>
                   <div className="grid grid-cols-1 gap-4">
                      <div>
                         <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">关键收获</h4>
                         <ul className="space-y-1">
                            {simState.report.keyLearnings.map((k, i) => (
                               <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                  <span className="text-indigo-500 mt-1">•</span> {k}
                               </li>
                            ))}
                         </ul>
                      </div>
                      <div>
                         <h4 className="text-xs font-bold text-pink-400 uppercase mb-2">建议</h4>
                         <p className="text-sm text-slate-300 italic">"{simState.report.suggestions}"</p>
                      </div>
                   </div>
               </div>
               <div className="p-4 border-t border-white/10 bg-dark/50 shrink-0 flex gap-3">
                  <button onClick={() => setShowReportModal(false)} className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-sm transition-colors">
                     查看最终场景
                  </button>
                  <button onClick={onExit} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all">
                     返回主页
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default SimulationView;
