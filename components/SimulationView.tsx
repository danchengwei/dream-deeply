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
    isEnded: false,
    report: null
  });

  const [customInput, setCustomInput] = useState('');
  const initialized = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reportSaved = useRef(false);

  // Initialize
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const startSimulation = async () => {
      const initialContext = customTopic;
      
      try {
        const turn = await generateSimulationTurn([], initialContext || "Start", "开始模拟，请描述初始场景");
        setSimState(prev => ({
          ...prev,
          description: turn.description,
          options: turn.options,
          history: [{ role: 'model', text: turn.description }],
          isLoading: false,
          isEnded: turn.isEnded || false,
          report: turn.report
        }));

        const image = await generateSimulationImage(turn.description);
        setSimState(prev => ({ ...prev, imageBase64: image, isImageLoading: false }));
        
      } catch (e) {
        console.error(e);
      }
    };

    startSimulation();
  }, [type, customTopic]);

  useEffect(() => {
    if (!simState.isLoading) {
       bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simState.history, simState.isLoading, simState.isEnded]);

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
    if (!actionText.trim() || simState.isLoading || simState.isEnded) return;

    setSimState(prev => ({ ...prev, isLoading: true, isImageLoading: true }));
    setCustomInput('');

    try {
      const newHistory = [...simState.history, { role: 'user', text: actionText }];
      const context = customTopic || ""; 
      
      const turn = await generateSimulationTurn(newHistory as any, context, actionText);

      setSimState(prev => ({
        ...prev,
        description: turn.description,
        options: turn.options || [],
        history: [...newHistory, { role: 'model', text: turn.description }],
        isLoading: false,
        isEnded: turn.isEnded,
        report: turn.report
      }));

      generateSimulationImage(turn.description).then(image => {
        setSimState(prev => ({ ...prev, imageBase64: image, isImageLoading: false }));
      });

    } catch (e) {
      console.error(e);
      setSimState(prev => ({ ...prev, isLoading: false, isImageLoading: false }));
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(customInput);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-dark text-slate-200 font-sans animate-fade-in">
      
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
           {simState.imageBase64 ? (
             <>
                <img 
                  src={simState.imageBase64} 
                  alt="Simulation State" 
                  className={`w-full h-full object-cover transition-all duration-1000 ${simState.isImageLoading ? 'opacity-50 blur-sm scale-105' : 'opacity-100 scale-100 group-hover:scale-110'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-transparent to-transparent md:bg-gradient-to-l md:from-dark/50" />
             </>
           ) : (
             <div className="flex flex-col items-center text-slate-500">
               <div className="text-4xl mb-4 animate-bounce"><Icons.Sparkles /></div>
               <p className="text-sm font-medium animate-pulse">正在生成场景...</p>
             </div>
           )}
           
           {/* Loading Overlay */}
           {simState.isImageLoading && simState.imageBase64 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] transition-opacity duration-500">
                 <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
           )}

           <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent md:hidden">
             <p className="text-xs text-white/90 line-clamp-2">{simState.description}</p>
           </div>
        </div>

        {/* Narrative & Controls */}
        <div className="w-full md:w-1/2 flex flex-col flex-1 min-h-0 bg-dark relative overflow-hidden">
           
           {/* Chat History */}
           <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
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
              
              {/* Typing Indicator */}
              {simState.isLoading && (
                 <div className="flex items-center gap-2 text-slate-500 text-sm p-4 animate-fade-in">
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce animation-delay-100" />
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce animation-delay-200" />
                 </div>
              )}

              {/* End Report Card */}
              {simState.isEnded && simState.report && (
                <div className="mt-8 mx-auto w-full max-w-md bg-surface rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-scale-in">
                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-600/20 p-6 border-b border-white/5">
                    <div className="flex items-center gap-3 text-green-400 mb-1">
                      <Icons.Report />
                      <h3 className="text-lg font-bold">模拟完成</h3>
                    </div>
                    <p className="text-xs text-slate-400">报告已自动保存到档案库</p>
                  </div>
                  <div className="p-6 text-center">
                    <button onClick={onExit} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors hover:scale-[1.02] active:scale-[0.98]">
                      返回主页查看完整报告
                    </button>
                  </div>
                </div>
              )}
              
              <div ref={bottomRef} className="h-4"></div>
           </div>

           {/* Input Area */}
           {!simState.isEnded && (
             <div className="shrink-0 p-4 md:p-6 bg-surface/50 border-t border-white/5 backdrop-blur-sm z-20 animate-slide-in-right">
                
                {/* Options */}
                {simState.options.length > 0 && (
                  <div className="grid gap-2 mb-4">
                    {simState.options.map((option, idx) => (
                      <button
                        key={idx}
                        disabled={simState.isLoading}
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
                    placeholder="输入你的行动..."
                    className="flex-1 bg-transparent px-4 py-3 text-white placeholder-slate-500 focus:outline-none text-sm"
                    disabled={simState.isLoading}
                  />
                  <button 
                    type="submit"
                    disabled={!customInput.trim() || simState.isLoading}
                    className="p-2 m-1 rounded-lg bg-primary/20 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-30 active:scale-95"
                  >
                    <Icons.Send />
                  </button>
                </form>

             </div>
           )}

        </div>
      </div>
    </div>
  );
};

export default SimulationView;
