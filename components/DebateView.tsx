
import React, { useState, useRef, useEffect } from 'react';
import { generateDebateResponse } from '../services/geminiService';
import { DebatePersona, ChatMessage } from '../types';
import { Icons } from '../constants';

interface DebateViewProps {
  onExit: () => void;
}

const PERSONA_LABELS: Record<DebatePersona, string> = {
  [DebatePersona.SKEPTIC]: '怀疑论者',
  [DebatePersona.OPTIMIST]: '乐观主义者',
  [DebatePersona.COLLABORATOR]: '协作伙伴',
  [DebatePersona.SOCRATIC]: '苏格拉底导师'
};

const DebateView: React.FC<DebateViewProps> = ({ onExit }) => {
  const [topic, setTopic] = useState('');
  const [persona, setPersona] = useState<DebatePersona>(DebatePersona.SKEPTIC);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Small timeout to ensure DOM is updated
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleStart = () => {
    if (!topic.trim()) return;
    setStarted(true);
    // Initial greeting
    const greeting: ChatMessage = {
      id: 'init',
      role: 'model',
      text: `你好！我们将会就 "${topic}" 展开讨论。我是你的${PERSONA_LABELS[persona]}。你准备好了吗？`,
      timestamp: Date.now()
    };
    setMessages([greeting]);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      // Build history for service
      // Note: service now expects standard {role, text} objects
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      history.push({ role: 'user', text: userMsg.text });

      const responseText = await generateDebateResponse(history, topic, persona);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error(e);
      // Fallback message so user isn't stuck
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "抱歉，我的思维连接似乎断开了。请重试。",
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!started) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-dark text-white relative animate-fade-in">
        
        <div className="w-full max-w-md z-10 p-8 bg-surface/50 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl animate-scale-in">
           <div className="text-center mb-8">
             <div className="w-16 h-16 mx-auto mb-4 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary animate-bounce">
               <Icons.Chat />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">建立对话</h2>
             <p className="text-sm text-slate-400">选择一个话题和AI人格开始互动</p>
           </div>

           <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">讨论话题</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例如：人工智能的未来..."
                  className="w-full bg-dark border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI 人格</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(DebatePersona).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPersona(p)}
                      className={`p-3 text-xs font-medium rounded-xl border transition-all ${
                        persona === p 
                          ? 'bg-secondary text-white border-secondary shadow-lg shadow-secondary/20 scale-105' 
                          : 'bg-dark border-white/10 text-slate-400 hover:border-secondary/50 hover:text-white hover:scale-105'
                      }`}
                    >
                      {PERSONA_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
           </div>

           <div className="flex gap-4 pt-8">
              <button onClick={onExit} className="flex-1 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                取消
              </button>
              <button 
                onClick={handleStart}
                disabled={!topic.trim()}
                className="flex-[2] py-3 bg-secondary hover:bg-pink-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-secondary/20 hover:scale-105 active:scale-95"
              >
                开始连接
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-dark text-slate-200 font-sans relative animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-surface/90 backdrop-blur border-b border-white/5 z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {PERSONA_LABELS[persona]}
            </h2>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium px-3 py-1 bg-white/5 rounded-full">
          话题: {topic}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 relative z-10">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
            <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm transition-transform hover:scale-[1.01] ${
              msg.role === 'user'
                ? 'bg-secondary text-white rounded-br-none shadow-secondary/20'
                : 'bg-surface border border-white/5 text-slate-200 rounded-bl-none shadow-black/20'
            }`}>
              <span className="text-[10px] opacity-50 block mb-1 font-medium">
                {msg.role === 'user' ? '你' : PERSONA_LABELS[persona]}
              </span>
              <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-fade-in">
             <div className="bg-surface border border-white/5 px-4 py-3 rounded-2xl rounded-bl-none text-slate-400 text-xs flex items-center gap-1">
               <span>对方正在输入</span>
               <div className="flex gap-1 ml-1">
                 <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></span>
                 <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce animation-delay-100"></span>
                 <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce animation-delay-200"></span>
               </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface/50 border-t border-white/5 z-20 backdrop-blur-sm">
        <div className="relative flex items-center bg-dark border border-white/10 rounded-xl p-1 focus-within:border-secondary/50 focus-within:ring-1 focus-within:ring-secondary/50 transition-all shadow-inner">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 bg-transparent p-3 text-white placeholder-slate-500 focus:outline-none text-sm"
            autoFocus
            disabled={isTyping}
          />
          <button 
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            className="p-2 m-1 bg-secondary text-white rounded-lg hover:bg-pink-600 transition-all disabled:opacity-50 disabled:bg-transparent disabled:text-slate-600 active:scale-95"
          >
            <Icons.Send />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebateView;
