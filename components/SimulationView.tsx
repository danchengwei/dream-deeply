
import React, { useState, useEffect, useRef } from 'react';
import { generateSimulationTurn, generateSimulationImage } from '../services/geminiService';
import { SimulationType, SimulationState, SavedRecord } from '../types';
import { Icons } from '../constants';

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

const SimulationView: React.FC<SimulationViewProps> = ({ type, customTopic, onExit, onSaveRecord }) => {
  const [simState, setSimState] = useState<SimulationState>({
    description: "正在初始化模拟环境，分析场景参数...",
    imageBase64: null,
    options: [],
    history: [],
    isLoading: true,
    isImageLoading: true,
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

  // Helper to scroll to bottom safely
  const scrollToBottom = () => {
    setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Fake logs for immersion
  useEffect(() => {
    if(simState.isLoading || simState.isImageLoading) {
        const logs = [
            `> Initializing ${type} Module...`,
            "> Connecting to Neural Core...",
            "> Loading context parameters...",
            "> Synthesizing environmental data...",
            "> Rendering simulation matrix...",
            "> Optimizing visual assets...",
            "> Stabilizing quantum state...",
            "> Finalizing output stream..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            const text = i < logs.length ? logs[i] : `> Processing data chunk ${Math.floor(Math.random() * 9999)}...`;
            setLoadingLogs(prev => [...prev.slice(-4), text]);
            i++;
        }, 400); 
        return () => clearInterval(interval);
    }
  }, [simState.isLoading, simState.isImageLoading, type]);

  // Initialize
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const startSimulation = async () => {
      const initialContext = customTopic;
      
      try {
        const turn = await generateSimulationTurn([], initialContext || "Start", "开始模拟，请描述初始场景");
        
        // 1. Text is ready
        setSimState(prev => ({
          ...prev,
          description: turn.description,
          options: turn.options,
          history: [{ role: 'model' as const, text: turn.description }],
          isLoading: false,
          isEnded: turn.isEnded || false,
          report: turn.report
        }));
        
        scrollToBottom();

        // 2. Logic for Image Generation
        if (isScientificMode) {
          // For Physics/Chemistry, pause and wait for user to choose style ONCE at start
          setSimState(prev => ({ ...prev, waitingForVisualChoice: true, isImageLoading: false }));
        } else {
          // For History/Custom, default to ARTISTIC
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

  // Auto scroll when history updates
  useEffect(() => {
    if (!simState.isLoading) {
       scrollToBottom();
    }
  }, [simState.history, simState.isLoading]);

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

  const handleAction = async (actionText: string) => {
    if (!actionText.trim() || simState.isLoading || simState.isEnded || simState.waitingForVisualChoice) return;

    // Set loading
    setSimState(prev => ({ ...prev, isLoading: true, isImageLoading: true, waitingForVisualChoice: false }));
    setCustomInput('');

    try {
      const newHistory: { role: 'user' | 'model'; text: string }[] = [...simState.history, { role: 'user', text: actionText }];
      const context = customTopic || ""; 
      
      // 1. Generate Text
      const turn = await generateSimulationTurn(newHistory, context, actionText);

      setSimState(prev => ({
        ...prev,
        description: turn.description,
        options: turn.options || [],
        history: [...newHistory, { role: 'model' as const, text: turn.description }],
        isLoading: false, // Text done
        isEnded: turn.isEnded,
        report: turn.report
      }));
      
      scrollToBottom();

      // 2. Handle Image Generation Logic
      // Use the persisted visualStyle, default to ARTISTIC if somehow missing
      const style = visualStyle || 'ARTISTIC';
      triggerImageGeneration(turn.description, style, turn.isEnded);

    } catch (e) {
      console.error(e);
      setSimState(prev => ({ 
        ...prev, 
        isLoading: false, 
        isImageLoading: false,
        history: [...prev.history, { role: 'model' as const, text: "连接中断，请重试。" }]
      }));
      scrollToBottom();
    }
  };

  // New function to separate the actual API call
  const triggerImageGeneration = async (description: string, style: 'ARTISTIC' | 'SCHEMATIC', isEnded: boolean) => {
      setSimState(prev => ({ ...prev, isImageLoading: true, waitingForVisualChoice: false }));
      
      try {
        const image = await generateSimulationImage(description, style);
        setSimState(prev => ({ ...prev, imageBase64: image, isImageLoading: false }));

        if (isEnded) {
             // Wait a moment for user to see the final image before showing the modal
             setTimeout(() => {
                 setShowReportModal(true);
             }, 1200);
        }
      } catch (e) {
        setSimState(prev => ({ ...prev, isImageLoading: false }));
        if (isEnded) setShowReportModal(true);
      }
  };

  const handleVisualChoice = (style: 'ARTISTIC' | 'SCHEMATIC') => {
      setVisualStyle(style);
      triggerImageGeneration(simState.description, style, simState.isEnded);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(customInput);
  };

  // --- Initial Full Screen Loader (Jumping Particles style) ---
  if (simState.isLoading && simState.history.length === 0) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#020617] text-slate-200 font-mono">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0f172a] to-black opacity-90 animate-pulse-slow"></div>
           
           <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(60)].map((_, i) => (
                <div 
                   key={i}
                   className="absolute bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-jump"
                   style={{
                      top: `${Math.random() * 100}%`, 
                      left: `${Math.random() * 100}%`,
                      width: `${Math.random() * 3 + 1}px`,
                      height: `${Math.random() * 3 + 1}px`,
                      opacity: Math.random() * 0.5 + 0.1,
                      animationDuration: `${1.5 + Math.random()}s`, 
                      animationDelay: `${Math.random() * 2}s`
                   }}
                />
              ))}
           </div>

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
                   仿真视图
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
           
           {/* Main Image Display */}
           {simState.imageBase64 && !simState.waitingForVisualChoice ? (
             <div className="absolute inset-0">
                <img 
                  src={simState.imageBase64} 
                  alt="Simulation State" 
                  className={`w-full h-full object-cover transition-all duration-700 ${simState.isImageLoading ? 'opacity-30 blur-md scale-105 saturate-0' : 'opacity-100 scale-100 group-hover:scale-110'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-transparent to-transparent md:bg-gradient-to-l md:from-dark/50" />
             </div>
           ) : (
             <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center">
                 {!simState.waitingForVisualChoice && (
                    <div className="text-slate-600 flex flex-col items-center">
                       <Icons.Sparkles />
                       <span className="text-xs mt-2">等待数据输入...</span>
                    </div>
                 )}
             </div>
           )}

           {/* VISUAL CHOICE OVERLAY (Physics/Chemistry) - Only shows once at start */}
           {simState.waitingForVisualChoice && (
              <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in p-6 text-center">
                 <div className="mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">选择可视化模式</h3>
                    <p className="text-sm text-slate-400">检测到科学模拟场景，请选择全程渲染引擎</p>
                 </div>
                 
                 <div className="flex flex-col md:flex-row gap-4 w-full max-w-md">
                     <button 
                       onClick={() => handleVisualChoice('SCHEMATIC')}
                       className="flex-1 group relative overflow-hidden bg-slate-800 border border-white/10 rounded-xl p-6 hover:border-blue-500/50 transition-all hover:bg-slate-800/80 active:scale-95"
                     >
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center gap-3">
                           <div className="p-3 bg-blue-500/20 text-blue-400 rounded-full group-hover:scale-110 transition-transform">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                              </svg>
                           </div>
                           <div className="text-left">
                              <div className="font-bold text-slate-200 text-center">仿真模型</div>
                              <div className="text-[10px] text-slate-500 text-center">结构图 · 示意图 · 原理展示</div>
                           </div>
                        </div>
                     </button>

                     <button 
                       onClick={() => handleVisualChoice('ARTISTIC')}
                       className="flex-1 group relative overflow-hidden bg-slate-800 border border-white/10 rounded-xl p-6 hover:border-purple-500/50 transition-all hover:bg-slate-800/80 active:scale-95"
                     >
                        <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center gap-3">
                           <div className="p-3 bg-purple-500/20 text-purple-400 rounded-full group-hover:scale-110 transition-transform">
                              <Icons.Sparkles />
                           </div>
                           <div className="text-left">
                              <div className="font-bold text-slate-200 text-center">模型生成</div>
                              <div className="text-[10px] text-slate-500 text-center">艺术渲染 · 沉浸式 · 概念图</div>
                           </div>
                        </div>
                     </button>
                 </div>
              </div>
           )}

           {/* Loading State for Image Generation - Enhanced with Logs and Animations */}
           {simState.isImageLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-8">
                 <div className="relative mb-6">
                    <div className="w-20 h-20 border-2 border-white/10 border-t-indigo-400 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-10 h-10 bg-indigo-500/20 rounded-full animate-pulse"></div>
                    </div>
                 </div>
                 
                 <div className="text-center space-y-2 max-w-xs w-full">
                    <p className="text-xs font-bold tracking-widest text-white uppercase animate-pulse">Rendering Scene</p>
                    
                    {/* Mini Log Console in Image Loader */}
                    <div className="h-16 overflow-hidden text-[10px] font-mono text-indigo-300/80 text-left w-full border-l border-indigo-500/30 pl-3">
                        {loadingLogs.slice(-3).map((log, i) => (
                            <div key={i} className="truncate animate-fade-in-up">{log}</div>
                        ))}
                    </div>
                 </div>

                 {/* Background Particles */}
                 <div className="absolute inset-0 overflow-hidden pointer-events-none">
                   {[...Array(15)].map((_, i) => (
                      <div 
                         key={i}
                         className="absolute bg-indigo-400/40 rounded-full animate-float"
                         style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            width: '2px',
                            height: '2px',
                            animationDuration: `${Math.random() * 2 + 1}s`
                         }}
                      />
                   ))}
                 </div>
              </div>
           )}

           <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent md:hidden z-20">
             <p className="text-xs text-white/90 line-clamp-2">{simState.description}</p>
           </div>
        </div>

        {/* Narrative & Controls */}
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
                    placeholder={simState.waitingForVisualChoice ? "请先选择视觉模式..." : "输入你的行动..."}
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
               
               {/* Decorative Header */}
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

               {/* Scrollable Content */}
               <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                   {/* Score Section */}
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

                   {/* Evaluation */}
                   <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">综合评价</h4>
                      <p className="text-sm text-slate-200 leading-relaxed">{simState.report.evaluation}</p>
                   </div>

                   {/* Details Grid */}
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
               
               {/* Footer Actions */}
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
