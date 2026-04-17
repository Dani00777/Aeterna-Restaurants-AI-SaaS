import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  limit,
  doc,
  getDoc,
  deleteDoc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { StaffMessage } from '../types';
import { Send, User, Bot, Loader2, Trash2, Check, CheckCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface StaffMessagesProps {
  targetStaffId?: string; // 'all' for global, or specific staffId
  targetStaffName?: string;
}

export default function StaffMessages({ targetStaffId = 'all', targetStaffName }: StaffMessagesProps) {
  const { restaurant, user, role, staffId } = useAuth();
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [staffName, setStaffName] = useState('Staff');
  const scrollRef = useRef<HTMLDivElement>(null);

  const myId = role === 'owner' ? restaurant?.ownerUid : staffId;
  const threadId = (targetStaffId === 'all' || !myId || !targetStaffId) 
    ? null 
    : [String(myId), String(targetStaffId)].sort().join('_');

  useEffect(() => {
    if (!restaurant || !myId) return;

    // Fetch staff name if not owner
    if (role !== 'owner' && staffId && restaurant) {
      const staffDocRef = doc(db, 'restaurants', restaurant.id, 'staff', staffId);
      getDoc(staffDocRef).then(snap => {
        if (snap.exists()) {
          setStaffName(snap.data().name);
        }
      });
    } else if (role === 'owner') {
      setStaffName('Owner');
    }

    const msgsRef = collection(db, 'restaurants', restaurant.id, 'staffMessages');
    
    let q;
    if (targetStaffId === 'all') {
      q = query(
        msgsRef, 
        where('receiverId', '==', 'all')
      );
    } else {
      q = query(
        msgsRef, 
        where('threadId', '==', threadId)
      );
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedMessages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMessage));
      // Sort in memory to avoid index requirements
      fetchedMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [restaurant?.id, role, staffId, targetStaffId, threadId, myId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !restaurant || !user) return;

    setLoading(true);
    try {
      const msgsRef = collection(db, 'restaurants', restaurant.id, 'staffMessages');
      await addDoc(msgsRef, {
        senderId: myId,
        senderName: staffName,
        senderRole: role,
        receiverId: targetStaffId,
        threadId: threadId,
        text: input.trim(),
        createdAt: new Date().toISOString()
      });
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (!restaurant || !confirm('Are you sure you want to clear this chat?')) return;
    
    try {
      const msgsRef = collection(db, 'restaurants', restaurant.id, 'staffMessages');
      let q;
      if (targetStaffId === 'all') {
        q = query(msgsRef, where('receiverId', '==', 'all'));
      } else {
        q = query(msgsRef, where('threadId', '==', threadId));
      }
      
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      toast.success('Chat cleared!');
    } catch (error) {
      toast.error('Failed to clear chat.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Header */}
      <div className="p-6 bg-[#1e293b] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            {targetStaffId === 'all' ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-white">
              {targetStaffId === 'all' ? 'Global Communication' : targetStaffName || 'Private Chat'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {targetStaffId === 'all' ? 'Internal Kitchen Chat' : 'Direct Message'}
            </p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2 text-slate-500 hover:text-red-400 transition-colors"
          title="Clear Chat"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-900/50 scrollbar-hide"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.senderId === myId;
            return (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                {!isMe && targetStaffId === 'all' && (
                  <div className="flex items-center gap-2 mb-1 px-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {msg.senderName} • {msg.senderRole}
                    </span>
                  </div>
                )}
                <div className={cn(
                  "p-4 rounded-2xl text-sm shadow-lg relative group",
                  isMe 
                    ? "bg-emerald-600 text-white rounded-tr-none" 
                    : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                )}>
                  {msg.text}
                  <div className={cn(
                    "flex items-center gap-1 mt-1 justify-end",
                    isMe ? "text-emerald-200" : "text-slate-500"
                  )}>
                    <span className="text-[9px] font-medium">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && <CheckCheck className="w-3 h-3" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 bg-[#1e293b] border-t border-slate-800 flex items-center gap-3">
        <input 
          type="text"
          placeholder="Type a message to staff..."
          className="flex-1 bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button 
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-emerald-600 text-white p-4 rounded-2xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
}
