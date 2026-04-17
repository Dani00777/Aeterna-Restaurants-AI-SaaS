import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, History, Bot, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAIResponse } from '../services/geminiService';
import { Restaurant, MenuItem } from '../types';
import { cn } from '../lib/utils';

interface AssistantPopupProps {
  restaurant: Restaurant | null;
  menu: MenuItem[];
  ingredients: any[];
  staff: any[];
  trainingNotes: string;
}

interface Message {
  id: number;
  role: 'user' | 'model';
  text: string;
}

export const AssistantPopup: React.FC<AssistantPopupProps> = ({ restaurant, menu, ingredients, staff, trainingNotes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !restaurant) return;

    const userMsg: Message = { id: Date.now(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const aiResponse = await getAIResponse(restaurant, menu, ingredients, staff, trainingNotes, [userMsg]);
      setMessages(prev => [...prev, { id: Date.now(), role: 'model', text: aiResponse }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'model', text: 'Error fetching data.' }]);
    } finally {
      setLoading(false);
    }
  };

  const startLongPress = (id: number) => {
    longPressTimer.current = setTimeout(() => setDeleteId(id), 500);
  };

  const endLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const deleteMessage = (id: number) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    setDeleteId(null);
  };

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-6 right-6 p-4 bg-slate-900 text-white rounded-full shadow-lg hover:bg-slate-800 transition-all z-[9999]">
        <MessageSquare className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="fixed bottom-24 right-6 w-80 bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 z-[9999] overflow-hidden flex flex-col h-[450px]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Aeterna Consultant</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 hover:bg-slate-700 rounded-full"><History className="w-4 h-4" /></button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-slate-700 rounded-full"><X className="w-4 h-4" /></button>
              </div>
            </div>
            
            {showHistory ? (
              <div className="flex-1 p-4 space-y-2">
                <button onClick={() => { setMessages([]); setShowHistory(false); }} className="w-full text-left p-3 bg-white rounded-xl text-sm text-red-600 font-bold hover:bg-red-50">Clear All History</button>
              </div>
            ) : (
              <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex relative", msg.role === 'user' ? "justify-end" : "justify-start")} onMouseDown={() => startLongPress(msg.id)} onMouseUp={endLongPress} onTouchStart={() => startLongPress(msg.id)} onTouchEnd={endLongPress}>
                    <div className={cn("p-3 rounded-xl text-sm max-w-[85%] shadow-sm", msg.role === 'user' ? "bg-slate-900 text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none")}>
                      {msg.text}
                    </div>
                    {deleteId === msg.id && (
                      <button onClick={() => deleteMessage(msg.id)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"><Trash2 className="w-3 h-3" /></button>
                    )}
                  </div>
                ))}
                {loading && <div className="text-xs text-slate-400 italic">Fetching...</div>}
              </div>
            )}
            
            {!showHistory && (
              <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 text-sm border border-slate-200 rounded-full px-4 py-2 focus:ring-2 focus:ring-slate-900 outline-none" placeholder="Ask about menu, staff or stock..." />
                <button type="submit" className="p-2 bg-slate-900 text-white rounded-full hover:bg-slate-800"><Send className="w-4 h-4" /></button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
