
import React, { useState, useEffect, useMemo } from 'react';
import { AppMode, SimulationType, SavedRecord } from './types';
import SimulationView from './components/SimulationView';
import DebateView from './components/DebateView';
import ReportView from './components/ReportView';
import InteractiveStoryView from './components/InteractiveStoryView';
import { Icons } from './constants';

// Helper component for Starfield to prevent re-renders causing twinkling reset
const StarField = () => {
  const stars = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 1 + 'px',
      delay: `${Math.random() * 3}s`,
      opacity: Math.random() * 0.5 + 0.3
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            opacity: star.opacity
          }}
        />
      ))}
    </div>
  );
};

// Component for the complex planet background
const CosmicBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
     {/* Deep Space Gradient Base */}
     <div className="absolute inset-0 bg-gradient-to-b from-[#0B1021] via-[#0f172a] to-[#1e1b4b] opacity-80" />
     
     <StarField />

     {/* Nebula Glows */}
     <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse-slow" />
     <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-fuchsia-900/10 rounded-full blur-[100px] animate-float-delayed" />

     {/* Planet 1: Large Blue Planet (Bottom Left) */}
     <div className="absolute -bottom-20 -left-20 w-64 h-64 md:w-96 md:h-96 rounded-full animate-float z-0">
        <div className="w-full h-full rounded-full planet-gradient-1 relative">
           {/* Atmosphere Glow */}
           <div className="absolute inset-0 rounded-full ring-2 ring-indigo-400/20 blur-sm" />
           {/* Orbit Ring */}
           <div className="absolute top-[50%] left-[50%] w-[160%] h-[160%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 animate-spin-slower" style={{ transformOrigin: 'center' }}>
              <div className="absolute top-0 left-[50%] w-3 h-3 bg-indigo-200 rounded-full blur-[1px] shadow-[0_0_10px_white]" />
           </div>
        </div>
     </div>

     {/* Planet 2: Pink/Purple Planet (Top Right) */}
     <div className="absolute top-10 right-[-5%] md:right-10 w-32 h-32 md:w-48 md:h-48 rounded-full animate-float-delayed z-0 opacity-80">
        <div className="w-full h-full rounded-full planet-gradient-2 relative">
            <div className="absolute inset-0 rounded-full ring-4 ring-pink-500/10" />
            {/* Tilted Ring System */}
            <div className="absolute top-[50%] left-[50%] w-[180%] h-[60%] -translate-x-1/2 -translate-y-1/2 border-[3px] border-white/10 rounded-[100%] rotate-[-30deg]" />
        </div>
     </div>
     
     {/* Floating Asteroid/Element */}
     <div className="absolute top-[30%] left-[20%] w-4 h-4 bg-slate-400 rounded-full blur-[1px] animate-float animation-delay-1000 opacity-60" />
     <div className="absolute bottom-[40%] right-[30%] w-2 h-2 bg-slate-300 rounded-full blur-[1px] animate-twinkle animation-delay-2000 opacity-80" />
  </div>
);

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [selectedSimType, setSelectedSimType] = useState<SimulationType>(SimulationType.HISTORY);
  
  // Split Title and Prompt to avoid long titles in header
  const [selectedSimTitle, setSelectedSimTitle] = useState('');
  const [selectedSimPrompt, setSelectedSimPrompt] = useState('');
  
  // Custom Inputs for each category
  const [inputs, setInputs] = useState({
    [SimulationType.HISTORY]: '',
    [SimulationType.CHEMISTRY]: '',
    [SimulationType.PHYSICS]: '',
    [SimulationType.LITERATURE]: '',
  });

  // Interactive Story State
  const [storyTheme, setStoryTheme] = useState('');
  
  // Data Persistence
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Load from LocalStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('nexus_archives');
    if (stored) {
      try {
        setSavedRecords(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load archives", e);
      }
    }
  }, []);

  // Save Record Handler
  const handleSaveRecord = (record: SavedRecord) => {
    const updated = [record, ...savedRecords];
    setSavedRecords(updated);
    localStorage.setItem('nexus_archives', JSON.stringify(updated));
  };

  const handleViewRecord = (id: string) => {
    setSelectedRecordId(id);
    setMode(AppMode.REPORT_VIEW);
  };

  // Delete Record
  const handleDeleteRecord = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = savedRecords.filter(r => r.id !== id);
    setSavedRecords(updated);
    localStorage.setItem('nexus_archives', JSON.stringify(updated));
  };

  const startSimulation = (type: SimulationType, title: string, prompt: string) => {
    setSelectedSimType(type);
    setSelectedSimTitle(title);
    setSelectedSimPrompt(prompt);
    setMode(AppMode.SIMULATION);
  };

  const handleCustomInputChange = (type: SimulationType, val: string) => {
    setInputs(prev => ({ ...prev, [type]: val }));
  };

  const handleStartCustomSim = (type: SimulationType) => {
    const userInput = inputs[type];
    if (userInput.trim()) {
      // Create a short title from the input
      const title = userInput.length > 12 ? userInput.substring(0, 12) + '...' : userInput;
      // Build a full prompt
      const prompt = `知识点设定: ${userInput}。请创建一个具有教育意义的模拟环境，用于教学演示。`;
      
      startSimulation(type, title, prompt);
      setInputs(prev => ({ ...prev, [type]: '' })); // Reset
    }
  };

  const handleStartStory = () => {
    if (storyTheme.trim()) {
      setMode(AppMode.INTERACTIVE_STORY);
    }
  };

  // Educational Story Presets
  const storyPresets = [
    "文学：鲁迅《药》·茶馆看客视角",
    "化学：微观世界·原电池原理探险",
    "物理：牛顿的苹果园·万有引力",
    "历史：1919年·五四运动前夜"
  ];

  // Helper to extract a cleaner title from preset label
  const getShortTitle = (label: string) => {
    // Split by Chinese or English colon
    const parts = label.split(/[:：]/);
    return parts.length > 1 ? parts[1].trim() : label;
  };

  // Helper function to render a simulation card
  const renderSimCard = (
    type: SimulationType, 
    title: string, 
    icon: React.ReactNode, 
    colorClass: string, 
    gradientClass: string,
    presets: { label: string, prompt: string }[]
  ) => {
    return (
      <div className={`bg-surface/40 backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:border-${colorClass}-500/50 transition-all duration-300 hover:bg-surface/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-${colorClass}-500/20 group relative overflow-hidden flex flex-col`}>
         {/* Background Glow */}
         <div className={`absolute top-0 right-0 w-32 h-32 bg-${colorClass}-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-${colorClass}-500/20 transition-all duration-500`} />
         
         {/* Header */}
         <div className="flex items-center gap-3 mb-4 shrink-0">
            <div className={`text-${colorClass}-400 bg-${colorClass}-400/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform shadow-lg shadow-${colorClass}-500/10`}>
              {icon}
            </div>
            <h3 className="font-bold text-lg text-white tracking-wide">{title}</h3>
         </div>

         {/* Presets */}
         <div className="space-y-2 mb-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 pl-1">精选课题</div>
            {presets.map((preset, idx) => (
              <button 
                key={idx}
                // Pass Short Title and Long Prompt
                onClick={() => startSimulation(type, getShortTitle(preset.label), preset.prompt)} 
                className={`w-full text-left text-xs p-3 rounded-lg bg-dark/40 hover:bg-${colorClass}-500/10 hover:text-${colorClass}-200 transition-colors border border-white/5 hover:border-${colorClass}-500/30 active:scale-[0.98] truncate flex items-center justify-between group/btn`}
              >
                <span>{preset.label}</span>
                <span className="opacity-0 group-hover/btn:opacity-100 transition-opacity"><Icons.ArrowRight /></span>
              </button>
            ))}
         </div>

         <div className="my-2 border-t border-white/5"></div>

         {/* Custom Input */}
         <div className="mt-2 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">输入课题名称</div>
            <div className="flex gap-2">
              <input 
                type="text"
                value={inputs[type]}
                onChange={(e) => handleCustomInputChange(type, e.target.value)}
                placeholder={`例如：${type === SimulationType.LITERATURE ? '孔乙己' : '光电效应'}...`}
                className={`flex-1 bg-dark/30 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-${colorClass}-400/50 focus:bg-dark/50 transition-all placeholder-slate-600`}
                onKeyDown={(e) => e.key === 'Enter' && handleStartCustomSim(type)}
              />
              <button 
                onClick={() => handleStartCustomSim(type)}
                disabled={!inputs[type]?.trim()}
                className={`px-3 py-2 rounded-lg bg-${colorClass}-600/20 text-${colorClass}-400 hover:bg-${colorClass}-600 hover:text-white border border-${colorClass}-600/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                <Icons.Send />
              </button>
            </div>
         </div>
      </div>
    );
  };

  // Render content based on mode
  const renderContent = () => {
    switch (mode) {
      case AppMode.SIMULATION:
        return (
          <SimulationView 
            type={selectedSimType} 
            title={selectedSimTitle}
            initialContext={selectedSimPrompt}
            onExit={() => setMode(AppMode.HOME)} 
            onSaveRecord={handleSaveRecord}
          />
        );
      case AppMode.DEBATE:
        return <DebateView onExit={() => setMode(AppMode.HOME)} />;
      case AppMode.REPORT_VIEW:
        const record = savedRecords.find(r => r.id === selectedRecordId);
        return (
          <ReportView 
            record={record} 
            onExit={() => setMode(AppMode.HOME)} 
          />
        );
      case AppMode.INTERACTIVE_STORY:
        return (
          <InteractiveStoryView 
            theme={storyTheme || "神秘梦境"}
            onExit={() => setMode(AppMode.HOME)}
          />
        );
      default:
        return (
          // Modified: Use h-full and overflow-y-auto to allow scrolling within the fixed parent
          <div className="h-full w-full bg-dark/50 text-slate-200 font-sans flex flex-col items-center p-4 md:p-8 overflow-y-auto scroll-smooth relative z-10">
            
            {/* Hero Section */}
            <header className="max-w-4xl w-full text-center space-y-4 mb-8 relative z-10 animate-fade-in-up shrink-0">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-surface/40 backdrop-blur-xl border border-white/10 shadow-xl mb-2 hover:scale-110 transition-transform duration-300 ring-1 ring-white/5">
                <div className="text-primary animate-pulse-slow"><Icons.Sparkles /></div>
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white to-purple-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                Nexus Learn
              </h1>
              <p className="text-sm md:text-base text-slate-300 max-w-xl mx-auto leading-relaxed opacity-90 drop-shadow-md">
                下一代沉浸式学习平台。
                让<span className="text-white font-semibold">书本知识</span> 变得触手可及、身临其境。
              </p>
            </header>

            {/* Main Layout Grid */}
            <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 pb-10 shrink-0">
              
              {/* FEATURED: Interactive Story (Span 12 - Hero Card) */}
              <div className="lg:col-span-12 animate-fade-in-up">
                 <div className="relative w-full overflow-hidden rounded-3xl border border-purple-500/30 group shadow-[0_0_40px_rgba(147,51,234,0.15)] hover:shadow-[0_0_60px_rgba(147,51,234,0.25)] transition-shadow duration-500">
                    {/* Animated Backgrounds */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#2e1065] via-[#581c87] to-[#2e1065] bg-[length:200%_200%] animate-gradient-xy opacity-90" />
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-40 animate-pulse-slow" />
                    <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
                    
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-400/20 rounded-full blur-[100px] -mr-16 -mt-16 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] -ml-16 -mb-16 pointer-events-none" />

                    {/* Content */}
                    <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row gap-8 items-center">
                       {/* Left Text Area */}
                       <div className="flex-1 space-y-5 text-center md:text-left">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-400/20 border border-purple-400/30 text-purple-200 text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-lg">
                             <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                             Core Experience
                          </div>
                          
                          <h2 className="text-3xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-300 drop-shadow-sm tracking-tight leading-tight">
                             课文情境 · 角色扮演
                          </h2>
                          
                          <p className="text-slate-200/90 text-sm md:text-lg max-w-2xl leading-relaxed font-light">
                             化身为<span className="text-white font-medium">孔乙己</span>、<span className="text-white font-medium">牛顿</span>或<span className="text-white font-medium">拿破仑</span>。在AI构建的还原场景中，亲身体验那些关键的历史时刻与文学冲突。
                          </p>
                          
                          {/* Input & Start Row */}
                          <div className="flex flex-col sm:flex-row gap-3 mt-6 max-w-xl mx-auto md:mx-0">
                             <input 
                                type="text"
                                value={storyTheme}
                                onChange={(e) => setStoryTheme(e.target.value)}
                                placeholder="输入课文名或知识点（如：鸿门宴）..."
                                className="flex-1 bg-black/20 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-300/60 focus:outline-none focus:border-purple-300 focus:bg-black/40 focus:ring-1 focus:ring-purple-300 transition-all backdrop-blur-sm font-medium"
                             />
                             <button 
                                onClick={handleStartStory}
                                disabled={!storyTheme.trim()}
                                className="px-8 py-3 bg-white text-purple-900 font-bold rounded-xl hover:bg-purple-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
                             >
                                <Icons.Sparkles /> 开始体验
                             </button>
                          </div>
                       </div>

                       {/* Right Visual/Preset Area */}
                       <div className="w-full md:w-1/3 flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                          <span className="text-xs font-bold text-purple-200 uppercase tracking-wider mb-1 opacity-90 flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                             推荐课程
                          </span>
                          <div className="grid grid-cols-1 gap-2">
                             {storyPresets.map((preset, idx) => (
                                <button
                                   key={idx}
                                   onClick={() => setStoryTheme(preset)}
                                   className={`text-left px-4 py-3 rounded-lg border transition-all text-xs md:text-sm flex items-center justify-between group/btn ${
                                      storyTheme === preset 
                                      ? 'bg-purple-500 border-purple-400 text-white shadow-lg' 
                                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-purple-300/50 hover:text-white'
                                   }`}
                                >
                                   <span className="truncate mr-2 font-medium">{preset.split('：')[0]}</span>
                                   <span className={`text-[10px] opacity-60 group-hover/btn:opacity-100 ${storyTheme === preset ? 'opacity-100' : ''}`}>
                                      {preset.split('：')[1]}
                                   </span>
                                </button>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Left Column: Simulations (Span 8) */}
              <div className="lg:col-span-8 space-y-4 animate-fade-in-up animation-delay-200">
                 <div className="flex items-center justify-between mb-1">
                   <h2 className="text-xl font-bold flex items-center gap-2 text-white drop-shadow-lg">
                     <span className="p-1.5 bg-primary/80 backdrop-blur rounded-lg text-white shadow-lg shadow-primary/30"><Icons.Sparkles /></span> 
                     知识点模拟
                   </h2>
                   <span className="text-[10px] font-medium text-slate-300 bg-surface/30 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 shadow-lg">
                     AI 导师 · 3D 演示 · 实验还原
                   </span>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Literature Card (New) */}
                    {renderSimCard(
                      SimulationType.LITERATURE,
                      "语文/文学",
                      <Icons.Literature />,
                      "pink", // Used pink/rose tone
                      "from-pink-500/20 to-rose-600/20",
                      [
                        { label: "📖 《孔乙己》：咸亨酒店", prompt: "你身处鲁镇的咸亨酒店。你是掌柜，看着孔乙己排出九文大钱。请分析孔乙己的人物形象和当时社会的凉薄。" },
                        { label: "🎭 《雷雨》：周公馆客厅", prompt: "你是周朴园，正坐在周公馆的客厅里。侍萍突然出现在你面前。请重演这一场充满戏剧张力的冲突，体现人物的阶级局限性。" }
                      ]
                    )}

                    {/* History Card */}
                    {renderSimCard(
                      SimulationType.HISTORY,
                      "历史情境",
                      <Icons.History />,
                      "amber",
                      "from-amber-500/20 to-orange-600/20",
                      [
                        { label: "🏰 凡尔赛和约：签字现场", prompt: "你是1919年巴黎和会上的中国代表顾维钧。面对列强要求将德国在山东权益转让给日本，你需要做出拒绝签字的艰难决定，并阐述理由。" },
                        { label: "⚔️ 辛亥革命：武昌起义", prompt: "你是1911年10月10日武昌新军的一名士兵。金兆龙与排长发生冲突，枪声已响，你需要决定如何响应起义，并观察清军的反应。" }
                      ]
                    )}

                    {/* Chemistry Card */}
                    {renderSimCard(
                      SimulationType.CHEMISTRY,
                      "化学实验",
                      <Icons.Chemistry />,
                      "emerald",
                      "from-emerald-500/20 to-teal-600/20",
                      [
                        { label: "🧪 原电池：铜锌双液", prompt: "你正在微观视角下观察铜-锌原电池（盐桥连接）。请演示电子的流动方向、电极反应式以及溶液中离子的移动方向。" },
                        { label: "🔥 钠与水反应：实验演示", prompt: "你在实验室将一小块金属钠投入滴有酚酞的水中。请观察并解释'浮、熔、游、响、红'五大现象背后的化学原理。" }
                      ]
                    )}

                    {/* Physics Card */}
                    {renderSimCard(
                      SimulationType.PHYSICS,
                      "物理模型",
                      <Icons.Physics />,
                      "blue",
                      "from-blue-500/20 to-cyan-600/20",
                      [
                        { label: "🔭 平抛运动：理想实验", prompt: "你在真空中进行平抛运动实验。改变初速度和高度，观察小球的运动轨迹，验证水平方向匀速直线、竖直方向自由落体的规律。" },
                        { label: "⚡ 楞次定律：感应电流", prompt: "你手里拿着一个强磁铁，面前是一个闭合线圈。请演示将磁铁插入和拔出线圈时，感应电流方向的变化，并解释'阻碍'的含义。" }
                      ]
                    )}

                 </div>
              </div>

              {/* Right Column: Debate & Archives (Span 4) */}
              <div className="lg:col-span-4 flex flex-col gap-4 animate-fade-in-up animation-delay-300">
                 
                 {/* Debate Section - Compact */}
                 <div className="bg-surface/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10 flex flex-col relative overflow-hidden shadow-lg h-auto group hover:border-secondary/50 transition-all duration-300 hover:shadow-xl hover:shadow-secondary/20">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-2xl -mr-8 -mb-8 pointer-events-none group-hover:bg-secondary/20 transition-all duration-500" />
                    
                    <div className="mb-3">
                      <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                        <span className="p-1.5 bg-secondary/80 backdrop-blur rounded-lg text-white shadow-lg shadow-secondary/30 group-hover:scale-110 transition-transform"><Icons.Chat /></span>
                        苏格拉底导师
                      </h2>
                    </div>

                    <div className="flex-1 mb-3">
                      <p className="text-xs text-slate-400">选择一位AI导师，针对你的课题进行辩论、答疑或深度剖析。</p>
                    </div>

                    <button 
                      onClick={() => setMode(AppMode.DEBATE)}
                      className="w-full py-2 rounded-lg bg-gradient-to-r from-secondary to-pink-600 text-white font-bold text-xs shadow-lg hover:shadow-secondary/30 hover:scale-[1.01] active:scale-95 transition-all"
                    >
                      进入学术讨论
                    </button>
                 </div>

                 {/* Report Archives Section - Compact */}
                 <div className="bg-surface/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10 flex flex-col flex-1 min-h-[250px] shadow-lg">
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                       <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                         <span className="p-1.5 bg-slate-700/80 backdrop-blur rounded-lg text-white"><Icons.Report /></span>
                         学习记录
                       </h2>
                       <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded-full">{savedRecords.length} 份</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                       {savedRecords.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs p-4 border-2 border-dashed border-white/10 rounded-xl">
                           <p>暂无学习报告</p>
                         </div>
                       ) : (
                         savedRecords.map((record, idx) => (
                           <div 
                             key={record.id}
                             onClick={() => handleViewRecord(record.id)}
                             style={{ animationDelay: `${idx * 100}ms` }}
                             className="group cursor-pointer p-3 rounded-lg bg-dark/40 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all relative overflow-hidden animate-slide-in-right"
                           >
                             <div className="flex justify-between items-start mb-1">
                               <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  record.type === SimulationType.HISTORY ? 'bg-amber-500/20 text-amber-300' :
                                  record.type === SimulationType.CHEMISTRY ? 'bg-emerald-500/20 text-emerald-300' :
                                  record.type === SimulationType.PHYSICS ? 'bg-blue-500/20 text-blue-300' : 
                                  record.type === SimulationType.LITERATURE ? 'bg-pink-500/20 text-pink-300' : 'bg-slate-700 text-slate-300'
                               }`}>
                                 {record.type}
                               </span>
                               <span className="text-[9px] text-slate-400">{new Date(record.timestamp).toLocaleDateString()}</span>
                             </div>
                             <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white truncate mb-1">
                               {record.topic}
                             </h4>
                             <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500">掌握度: <span className={`font-bold ${record.report.score > 80 ? 'text-green-400' : 'text-amber-400'}`}>{record.report.score}</span></span>
                                <button 
                                  onClick={(e) => handleDeleteRecord(e, record.id)}
                                  className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity"
                                >
                                  删除
                                </button>
                             </div>
                           </div>
                         ))
                       )}
                    </div>
                 </div>

              </div>

            </div>

            <footer className="mt-8 text-slate-600 text-xs font-medium shrink-0 animate-fade-in animation-delay-500 drop-shadow">
              <p>Powered by Google Gemini • Nexus Learn © 2024</p>
            </footer>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-full bg-dark text-slate-200 overflow-hidden relative">
      <CosmicBackground />
      {renderContent()}
    </div>
  );
}

export default App;
