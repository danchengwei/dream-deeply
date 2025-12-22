import React, { useEffect, useState } from 'react';
import { SavedRecord } from '../types';
import { Icons } from '../constants';

interface ReportViewProps {
  record?: SavedRecord;
  onExit: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ record, onExit }) => {
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    setTimeout(() => setShowScore(true), 100);
  }, []);

  if (!record) {
    return <div className="p-10 text-center text-slate-400 animate-fade-in">记录未找到</div>;
  }

  const { report, transcript } = record;
  const strokeDasharray = 440;
  const strokeDashoffset = showScore ? strokeDasharray - (strokeDasharray * report.score) / 100 : strokeDasharray;

  return (
    <div className="h-full flex flex-col bg-dark text-slate-200 font-sans relative overflow-hidden animate-fade-in">
       
       {/* Header */}
       <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surface/90 backdrop-blur z-10 shadow-sm">
          <button onClick={onExit} className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors group">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            返回列表
          </button>
          <div className="text-center">
             <h2 className="text-lg font-bold text-white">
                模拟分析报告
             </h2>
             <p className="text-xs text-slate-500">ID: {record.id.slice(-8)}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
             <p>{new Date(record.timestamp).toLocaleString()}</p>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8">
          
          {/* Main Report Card */}
          <div className="bg-surface border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-scale-in">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none animate-pulse-slow" />

              <div className="relative z-10">
                 <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
                    
                    {/* Score Circle */}
                    <div className="shrink-0 relative">
                       <svg className="w-40 h-40 -rotate-90">
                          <circle cx="80" cy="80" r="70" stroke="#0f172a" strokeWidth="12" fill="none" />
                          <circle 
                            cx="80" cy="80" r="70" 
                            stroke={report.score > 80 ? '#4ade80' : report.score > 60 ? '#facc15' : '#f43f5e'} 
                            strokeWidth="12" 
                            fill="none" 
                            strokeDasharray={strokeDasharray} 
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-[1.5s] ease-out"
                          />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in animation-delay-500">
                          <span className="text-4xl font-extrabold text-white">{report.score}</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">综合评分</span>
                       </div>
                    </div>

                    {/* Report Text */}
                    <div className="flex-1 space-y-6 w-full">
                       <div className="animate-fade-in-up animation-delay-200">
                          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">模拟主题</h3>
                          <p className="text-white text-xl font-medium">{record.topic}</p>
                       </div>
                       
                       <div className="bg-white/5 p-4 rounded-xl border border-white/5 animate-fade-in-up animation-delay-300">
                          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">综合评价</h3>
                          <p className="text-slate-200 text-sm leading-relaxed">
                             {report.evaluation}
                          </p>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="animate-fade-in-up animation-delay-500">
                             <h3 className="text-primary text-xs font-bold uppercase tracking-wider mb-3">关键知识点</h3>
                             <ul className="space-y-2">
                                {report.keyLearnings.map((item, i) => (
                                   <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                     <span className="text-primary mt-1">•</span> {item}
                                   </li>
                                ))}
                             </ul>
                          </div>
                          <div className="animate-fade-in-up animation-delay-500">
                             <h3 className="text-secondary text-xs font-bold uppercase tracking-wider mb-3">改进建议</h3>
                             <p className="text-sm text-slate-300 italic border-l-2 border-secondary/30 pl-3 py-1">
                                "{report.suggestions}"
                             </p>
                          </div>
                       </div>
                    </div>

                 </div>
              </div>
          </div>

          {/* Transcript Log */}
          <div className="bg-surface/50 border border-white/5 rounded-3xl p-6 animate-fade-in-up animation-delay-700">
             <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
                <Icons.History />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">对话记录回放</h3>
             </div>
             
             <div className="space-y-4">
                {transcript.map((msg, idx) => (
                   <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm transition-all hover:scale-[1.01] ${
                         msg.role === 'user' 
                           ? 'bg-primary/20 text-indigo-100 rounded-br-none' 
                           : 'bg-white/5 text-slate-300 rounded-bl-none'
                      }`}>
                         <p className="leading-relaxed">{msg.text}</p>
                      </div>
                   </div>
                ))}
             </div>
          </div>

       </div>
    </div>
  );
};

export default ReportView;
