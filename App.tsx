
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
  const [customTopic, setCustomTopic] = useState('');
  
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

  const startSimulationWithTemplate = (type: SimulationType, prompt: string) => {
    setSelectedSimType(type);
    setCustomTopic(prompt);
    setMode(AppMode.SIMULATION);
  };

  const handleStartCustomSim = () => {
    if (customTopic.trim()) {
      startSimulationWithTemplate(SimulationType.CUSTOM, customTopic);
    }
  };

  const handleStartStory = () => {
    if (storyTheme.trim()) {
      setMode(AppMode.INTERACTIVE_STORY);
    }
  };

  const storyPresets = [
    "爱伦·坡式：失落的庄园遗产",
    "赛博朋克：霓虹雨夜的谋杀案",
    "切尔诺贝利：废弃控制室",
    "深海恐惧：幽灵潜艇内部"
  ];

  // Render content based on mode
  const renderContent = () => {
    switch (mode) {
      case AppMode.SIMULATION:
        return (
          <SimulationView 
            type={selectedSimType} 
            customTopic={customTopic}
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
                <span className="text-white font-semibold">生成式 AI</span> 驱动的多模态模拟与思辨伙伴。
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
                             2D 动态交互梦境
                          </h2>
                          
                          <p className="text-slate-200/90 text-sm md:text-lg max-w-2xl leading-relaxed font-light">
                             打破传统界限。结合 <span className="text-white font-medium">角色扮演</span> 与 <span className="text-white font-medium">实时图像生成</span>，沉浸于由你定义的无限可能性中。每一次选择都在重构世界。
                          </p>
                          
                          {/* Input & Start Row */}
                          <div className="flex flex-col sm:flex-row gap-3 mt-6 max-w-xl mx-auto md:mx-0">
                             <input 
                                type="text"
                                value={storyTheme}
                                onChange={(e) => setStoryTheme(e.target.value)}
                                placeholder="描述你的梦境主题（如：赛博朋克侦探...）"
                                className="flex-1 bg-black/20 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-300/60 focus:outline-none focus:border-purple-300 focus:bg-black/40 focus:ring-1 focus:ring-purple-300 transition-all backdrop-blur-sm font-medium"
                             />
                             <button 
                                onClick={handleStartStory}
                                disabled={!storyTheme.trim()}
                                className="px-8 py-3 bg-white text-purple-900 font-bold rounded-xl hover:bg-purple-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
                             >
                                <Icons.Sparkles /> 开启旅程
                             </button>
                          </div>
                       </div>

                       {/* Right Visual/Preset Area */}
                       <div className="w-full md:w-1/3 flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                          <span className="text-xs font-bold text-purple-200 uppercase tracking-wider mb-1 opacity-90 flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                             热门剧本
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
                                      {preset.split('：')[1].substring(0, 10)}...
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
                     情境模拟
                   </h2>
                   <span className="text-[10px] font-medium text-slate-300 bg-surface/30 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 shadow-lg">
                     自由输入 · 多重结局
                   </span>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* History Card */}
                    <div className="bg-surface/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-amber-500/50 transition-all duration-300 hover:bg-surface/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/20 group relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none group-hover:bg-amber-500/20 transition-all duration-500" />
                       <div className="flex items-center gap-2 mb-3">
                          <div className="text-amber-400 bg-amber-400/10 p-2 rounded-lg group-hover:scale-110 transition-transform"><Icons.History /></div>
                          <h3 className="font-bold text-base text-white">历史回响</h3>
                       </div>
                       <div className="space-y-2">
                          <button onClick={() => startSimulationWithTemplate(SimulationType.HISTORY, "你是1789年7月13日巴黎的一名农民。局势高度紧张，面包价格飞涨，巴士底狱的阴影笼罩着城市。你需要决定如何参与这场革命。")} className="w-full text-left text-xs p-3 rounded-lg bg-dark/40 hover:bg-amber-500/10 hover:text-amber-200 transition-colors border border-white/5 active:scale-[0.98] truncate">
                            🏰 巴士底狱前夜
                          </button>
                          <button onClick={() => startSimulationWithTemplate(SimulationType.HISTORY, "你是荆轲。此时正值战国末期，你带着樊於期的首级和燕督亢地图，站在秦王宫的大殿前。")} className="w-full text-left text-xs p-3 rounded-lg bg-dark/40 hover:bg-amber-500/10 hover:text-amber-200 transition-colors border border-white/5 active:scale-[0.98] truncate">
                            ⚔️ 刺客列传：荆轲刺秦
                          </button>
                       </div>
                    </div>

                    {/* Chemistry Card */}
                    <div className="bg-surface/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-emerald-500/50 transition-all duration-300 hover:bg-surface/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/20 group relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />
                       <div className="flex items-center gap-2 mb-3">
                          <div className="text-emerald-400 bg-emerald-400/10 p-2 rounded-lg group-hover:scale-110 transition-transform"><Icons.Chemistry /></div>
                          <h3 className="font-bold text-base text-white">化学实验室</h3>
                       </div>
                       <div className="space-y-2">
                          <button onClick={() => startSimulationWithTemplate(SimulationType.CHEMISTRY, "你身处高中化学实验室。你有烧杯A（水）和烧杯B（浓硫酸）。你需要配制稀硫酸。注意操作顺序。")} className="w-full text-left text-xs p-3 rounded-lg bg-dark/40 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors border border-white/5 active:scale-[0.98] truncate">
                            🧪 实验：稀释浓硫酸
                          </button>
                          <button onClick={() => startSimulationWithTemplate(SimulationType.CHEMISTRY, "实验室发生火灾，起因是金属钠遇水。你身边有沙土、水桶、干粉灭火器和泡沫灭火器。")} className="w-full text-left text-xs p-3 rounded-lg bg-dark/40 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors border border-white/5 active:scale-[0.98] truncate">
                            🔥 应急：金属钠火灾
                          </button>
                       </div>
                    </div>

                    {/* Physics Card */}
                    <div className="bg-surface/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-blue-500/50 transition-all duration-300 hover:bg-surface/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/20 group relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none group-hover:bg-blue-500/20 transition-all duration-500" />
                       <div className="flex items-center gap-2 mb-3">
                          <div className="text-blue-400 bg-blue-400/10 p-2 rounded-lg group-hover:scale-110 transition-transform"><Icons.Physics /></div>
                          <h3 className="font-bold text-base text-white">物理世界</h3>
                       </div>
                       <div className="space-y-2">
                          <button onClick={() => startSimulationWithTemplate(SimulationType.PHYSICS, "你是伽利略，站在比萨斜塔的顶端。你手里拿着一个重铁球和一个轻木球。")} className="w-full text-left text-xs p-3 rounded-lg bg-dark/40 hover:bg-blue-500/10 hover:text-blue-200 transition-colors border border-white/5 active:scale-[0.98] truncate">
                            🔭 思想实验：比萨斜塔
                          </button>
                          <button onClick={() => startSimulationWithTemplate(SimulationType.PHYSICS, "你是一束光子，正飞向一个开着两条狭缝的挡板。后面是探测屏。")} className="w-full text-left text-xs p-3 rounded-lg bg-dark/40 hover:bg-blue-500/10 hover:text-blue-200 transition-colors border border-white/5 active:scale-[0.98] truncate">
                            🌌 量子力学：双缝干涉
                          </button>
                       </div>
                    </div>

                    {/* Custom Card */}
                    <div className="bg-surface/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-primary/50 transition-all duration-300 hover:bg-surface/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/20 group relative overflow-hidden flex flex-col">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none group-hover:bg-primary/20 transition-all duration-500" />
                       <div className="flex items-center gap-2 mb-3 shrink-0">
                          <div className="text-primary bg-primary/10 p-2 rounded-lg group-hover:scale-110 transition-transform"><Icons.Code /></div>
                          <h3 className="font-bold text-base text-white">自定义场景</h3>
                       </div>
                       <div className="flex flex-col gap-3">
                          <textarea 
                            placeholder="输入你想模拟的场景..."
                            className="w-full h-16 bg-dark/40 border border-white/10 rounded-lg p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none placeholder-slate-500 transition-all hover:bg-dark/60"
                            value={customTopic}
                            onChange={(e) => setCustomTopic(e.target.value)}
                          />
                          <button 
                            onClick={handleStartCustomSim}
                            disabled={!customTopic.trim()}
                            className="w-full py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-dark transition-all disabled:opacity-50 disabled:hover:bg-primary shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.98]"
                          >
                            开始生成
                          </button>
                       </div>
                    </div>
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
                        虚拟伙伴
                      </h2>
                    </div>

                    <div className="flex-1 mb-3">
                      <p className="text-xs text-slate-400">选择怀疑论者、激进派或导师，进行辩论或协作。</p>
                    </div>

                    <button 
                      onClick={() => setMode(AppMode.DEBATE)}
                      className="w-full py-2 rounded-lg bg-gradient-to-r from-secondary to-pink-600 text-white font-bold text-xs shadow-lg hover:shadow-secondary/30 hover:scale-[1.01] active:scale-95 transition-all"
                    >
                      进入对话空间
                    </button>
                 </div>

                 {/* Report Archives Section - Compact */}
                 <div className="bg-surface/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10 flex flex-col flex-1 min-h-[250px] shadow-lg">
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                       <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                         <span className="p-1.5 bg-slate-700/80 backdrop-blur rounded-lg text-white"><Icons.Report /></span>
                         历史档案
                       </h2>
                       <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded-full">{savedRecords.length} 份</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                       {savedRecords.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs p-4 border-2 border-dashed border-white/10 rounded-xl">
                           <p>暂无数据报告</p>
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
                                  record.type === SimulationType.PHYSICS ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-300'
                               }`}>
                                 {record.type}
                               </span>
                               <span className="text-[9px] text-slate-400">{new Date(record.timestamp).toLocaleDateString()}</span>
                             </div>
                             <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white truncate mb-1">
                               {record.topic}
                             </h4>
                             <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500">评分: <span className={`font-bold ${record.report.score > 80 ? 'text-green-400' : 'text-amber-400'}`}>{record.report.score}</span></span>
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
