import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../App';
import { Staff } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MessageSquare, Users, ChefHat, Bike, ChevronRight, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';
import StaffMessages from '../../components/StaffMessages';

export default function CommunicationHub() {
  const { restaurant } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [search, setSearch] = useState('');
  const [selectedThread, setSelectedThread] = useState<{ id: string; name: string; role: string } | null>(null);

  useEffect(() => {
    if (!restaurant) return;

    const staffRef = collection(db, 'restaurants', restaurant.id, 'staff');
    const unsubscribe = onSnapshot(staffRef, (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });

    return () => unsubscribe();
  }, [restaurant]);

  const filteredStaff = staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6">
      {/* Sidebar - Thread List */}
      <div className="w-80 flex flex-col gap-6">
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Messages</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">Staff Communication Hub</p>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search staff..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
            {/* Global Chat Option */}
            <button
              onClick={() => setSelectedThread(null)}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-2xl transition-all group",
                selectedThread === null 
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                  : "hover:bg-slate-50 text-slate-600"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                selectedThread === null ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-100 text-slate-400 group-hover:bg-white"
              )}>
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-sm">Global Chat</p>
                <p className={cn("text-[10px] font-medium", selectedThread === null ? "text-slate-400" : "text-slate-400")}>
                  All Kitchen Staff
                </p>
              </div>
              <ChevronRight className={cn("w-4 h-4 transition-transform", selectedThread === null ? "rotate-90" : "opacity-0 group-hover:opacity-100")} />
            </button>

            <div className="py-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-2">Direct Messages</p>
              <div className="h-px bg-slate-50 mx-4 mb-4" />
            </div>

            {filteredStaff.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedThread({ id: member.id, name: member.name, role: member.role })}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-2xl transition-all group",
                  selectedThread?.id === member.id 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                    : "hover:bg-slate-50 text-slate-600"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center transition-colors",
                  selectedThread?.id === member.id ? "bg-slate-800" : "bg-slate-100"
                )}>
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    member.role === 'Chef' ? <ChefHat className="w-5 h-5" /> : <Bike className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-sm">{member.name}</p>
                  <p className={cn("text-[10px] font-medium", selectedThread?.id === member.id ? "text-slate-400" : "text-slate-400")}>
                    {member.role}
                  </p>
                </div>
                <ChevronRight className={cn("w-4 h-4 transition-transform", selectedThread?.id === member.id ? "rotate-90" : "opacity-0 group-hover:opacity-100")} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <StaffMessages 
          targetStaffId={selectedThread?.id || 'all'} 
          targetStaffName={selectedThread?.name} 
        />
      </div>
    </div>
  );
}
