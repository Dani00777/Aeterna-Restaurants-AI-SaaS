import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  getDoc,
  updateDoc, 
  orderBy,
  limit,
  setDoc,
  addDoc,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Order, OrderStatus, Staff, MenuItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, CheckCircle, ChefHat, AlertCircle, Timer, LogOut, MessageSquare, List, Bell, User, Bot } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import StaffMessages from '../components/StaffMessages';

export default function ChefPortal() {
  const { restaurant, logout, staffId } = useAuth();
  const navigate = useNavigate();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [prepTime, setPrepTime] = useState(15);
  const [activeTab, setActiveTab] = useState<'orders' | 'messages' | 'history'>('orders');
  const [staffName, setStaffName] = useState('Chef');
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [riders, setRiders] = useState<Staff[]>([]);
  const [selectedThread, setSelectedThread] = useState<{ id: string; name: string; role: string } | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'indoor' | 'outdoor'>('all');
  const prevPendingCountRef = useRef(0);

  const playNotification = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play();
    } catch (e) {
      console.error('Audio play failed', e);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    if (!restaurant || !staffId) return;

    const staffRef = doc(db, 'restaurants', restaurant.id, 'staff', staffId);
    getDoc(staffRef).then(snap => {
      if (snap.exists()) {
        setStaffName(snap.data().name);
      }
    });

    const normalizedResId = restaurant.id.trim().toUpperCase();
    const ordersRef = collection(db, 'restaurants', normalizedResId, 'orders');
    const q = query(ordersRef);

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setAllOrders(fetchedOrders);
    }, (error) => {
      console.error('Firestore Error in ChefPortal:', error);
    });

    const staffColRef = collection(db, 'restaurants', restaurant.id, 'staff');
    const unsubscribeStaff = onSnapshot(staffColRef, (snap) => {
      const allStaff = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      setStaff(allStaff);
      setRiders(allStaff.filter(s => s.role === 'Rider'));
    });

    const msgsRef = collection(db, 'restaurants', restaurant.id, 'staffMessages');
    const qMsgs = query(
      msgsRef,
      where('receiverId', 'in', ['all', staffId])
    );

    const unsubscribeMsgs = onSnapshot(qMsgs, (snap) => {
      if (activeTab !== 'messages' && !snap.empty) {
        setHasNewMessages(true);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStaff();
      unsubscribeMsgs();
    };
  }, [restaurant?.id, staffId]);

  useEffect(() => {
    let filteredOrders = allOrders.filter(o => {
      const status = (o.status || '').toLowerCase();
      if (activeTab === 'history') {
        const isHistory = ['ready', 'completed', 'delivered'].includes(status);
        if (!isHistory) return false;
        
        if (historyFilter === 'indoor') return !!o.tableNumber;
        if (historyFilter === 'outdoor') return o.orderType === 'Delivery';
        return true;
      } else {
        return status === 'remaining' || status === 'pending' || status === 'preparing';
      }
    });

    filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const pendingCount = filteredOrders.filter(o => o.status === 'remaining' || o.status === 'pending').length;
    
    if (activeTab === 'orders' && pendingCount > prevPendingCountRef.current) {
      toast.success('New Order Received!', { icon: '🔔' });
      playNotification();
    }
    prevPendingCountRef.current = pendingCount;
    
    setOrders(filteredOrders);
  }, [allOrders, activeTab, historyFilter]);

  useEffect(() => {
    if (activeTab === 'messages') setHasNewMessages(false);
  }, [activeTab]);

  const updateStatus = async (orderId: string, status: OrderStatus, extraData: any = {}) => {
    if (!restaurant) return;
    const normalizedResId = restaurant.id.trim().toUpperCase();
    try {
      // CONSISTENCY FIX: Use nested collection path
      const orderRef = doc(db, 'restaurants', normalizedResId, 'orders', orderId);
      
      // Calculate completion time if marking as ready or completed
      let completionData = {};
      if (status === 'ready' || status === 'completed') {
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const data = orderSnap.data() as Order;
          const createdAt = new Date(data.createdAt).getTime();
          const now = new Date().getTime();
          const diffMins = Math.round((now - createdAt) / 60000);
          completionData = {
            readyAt: status === 'ready' ? new Date().toISOString() : (data.readyAt || null),
            completedAt: status === 'completed' ? new Date().toISOString() : (data.completedAt || null),
            totalCompletionTimeMinutes: diffMins
          };
          
          if (status === 'completed') {
            const batch = writeBatch(db);
            for (const item of data.items) {
              const menuItemRef = doc(db, 'restaurants', normalizedResId, 'menu_items', item.menuItemId);
              const menuItemSnap = await getDoc(menuItemRef);
              if (menuItemSnap.exists()) {
                const menuItemData = menuItemSnap.data() as MenuItem;
                if (menuItemData.recipe) {
                  for (const ing of menuItemData.recipe) {
                    const ingRef = doc(db, 'restaurants', normalizedResId, 'ingredients', ing.ingredientId);
                    batch.update(ingRef, { quantityInStock: increment(-(ing.quantity * item.quantity)) });
                  }
                }
              }
            }
            await batch.commit();
          }
        }
      }

      await updateDoc(orderRef, { 
        status, 
        ...extraData,
        ...completionData,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Order marked as ${status}`);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Update Error:', error);
      toast.error('Failed to update order.');
    }
  };

  const claimOrder = async (orderId: string) => {
    await updateStatus(orderId, 'preparing', { 
      claimedBy: staffName,
      claimedAt: new Date().toISOString(),
      prepTimeMinutes: prepTime
    });
  };

  const CountdownTimer = ({ claimedAt, prepTimeMinutes }: { claimedAt: string, prepTimeMinutes: number }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
      const calculate = () => {
        const start = new Date(claimedAt).getTime();
        const end = start + prepTimeMinutes * 60 * 1000;
        const now = new Date().getTime();
        const diff = end - now;

        if (diff <= 0) {
          setTimeLeft('OVERDUE');
          return;
        }

        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      };

      calculate();
      const interval = setInterval(calculate, 1000);
      return () => clearInterval(interval);
    }, [claimedAt, prepTimeMinutes]);

    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-bold text-[10px]",
        timeLeft === 'OVERDUE' ? "bg-red-500 text-white animate-pulse" : "bg-emerald-500/20 text-emerald-500"
      )}>
        <Timer className="w-3 h-3" />
        {timeLeft}
      </div>
    );
  };

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col font-sans">
      {/* TEST BUTTONS */}
      <div className="p-4 bg-red-900 flex gap-4">
        <button 
          onClick={async () => {
            const orderRef = doc(collection(db, 'restaurants', restaurant.id, 'orders'));
            await setDoc(orderRef, {
              restaurantId: restaurant.id,
              status: 'ready',
              orderType: 'Delivery',
              items: [{ name: 'Zinger Burger', price: 500, quantity: 1 }],
              subtotal: 500,
              createdAt: new Date().toISOString(),
              customerId: '1234567890',
              assignedRiderId: riders.length > 0 ? riders[0].id : null
            });
            toast.success('Dummy order created!');
          }}
          className="bg-white text-red-900 font-bold px-4 py-2 rounded-xl"
        >
          System Test: Create Dummy Order
        </button>
      </div>

      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#1e293b]">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl">
            <ChefHat className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">KITCHEN DISPLAY</h1>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">
              {restaurant.name} • Live Feed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveTab('orders')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all relative",
              activeTab === 'orders' ? "bg-emerald-500 text-emerald-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            )}
          >
            <List className="w-4 h-4" />
            ORDERS
            {orders.filter(o => o.status === 'remaining' || o.status === 'pending').length > 0 && activeTab !== 'orders' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#1e293b] animate-pulse" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all relative",
              activeTab === 'history' ? "bg-emerald-500 text-emerald-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            )}
          >
            <Clock className="w-4 h-4" />
            HISTORY
          </button>
          <button 
            onClick={() => setActiveTab('messages')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all relative",
              activeTab === 'messages' ? "bg-emerald-500 text-emerald-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            MESSAGES
            {hasNewMessages && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#1e293b] animate-pulse" />
            )}
          </button>
          <div className="h-8 w-px bg-slate-800 mx-2" />
          <div className="text-right">
            <p className="text-xs text-slate-500 font-bold uppercase">Active Orders</p>
            <p className="text-2xl font-mono font-bold text-emerald-500">{orders.filter(o => o.status !== 'completed' && o.status !== 'ready').length}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-3 bg-slate-800 text-slate-400 hover:text-red-400 rounded-2xl transition-all"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'history' && (
          <div className="flex gap-2 p-6 pb-0">
            {(['all', 'indoor', 'outdoor'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setHistoryFilter(filter)}
                className={cn(
                  "px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                  historyFilter === filter ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        )}
        {activeTab === 'orders' || activeTab === 'history' ? (
          <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto">
            <AnimatePresence>
              {orders.map((order) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={order.id}
                  className={cn(
                    "bg-[#1e293b] rounded-3xl border-2 transition-all overflow-hidden flex flex-col",
                    (order.status === 'remaining' || order.status === 'pending') ? "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.1)]" : 
                    order.status === 'preparing' ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]" :
                    order.status === 'ready' ? "border-blue-500/50" :
                    "border-slate-700"
                  )}
                >
                  <div className="p-5 border-b border-slate-800 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider inline-block",
                          (order.status === 'remaining' || order.status === 'pending') ? "bg-amber-500/20 text-amber-500" : 
                          order.status === 'preparing' ? "bg-emerald-500/20 text-emerald-500" :
                          "bg-blue-500/20 text-blue-400"
                        )}>
                          {order.status === 'remaining' || order.status === 'pending' ? 'Remaining' : order.status}
                        </span>
                        {order.status === 'preparing' && order.claimedAt && order.prepTimeMinutes && (
                          <CountdownTimer claimedAt={order.claimedAt} prepTimeMinutes={order.prepTimeMinutes} />
                        )}
                      </div>
                      <h3 className="text-lg font-mono font-bold">#{order.id.slice(-4).toUpperCase()}</h3>
                      {order.tableNumber && (
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">
                          Table {order.tableNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs font-bold text-slate-400 mt-1">{order.orderType}</span>
                    </div>
                  </div>

                  <div className="flex-1 p-5 space-y-4">
                    {order.urgentAlert && (
                      <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-red-400 leading-relaxed">{order.urgentAlert}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center font-bold text-emerald-500">
                              {item.quantity}
                            </span>
                            <span className="font-bold text-slate-200">{item.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800/30">
                    {activeTab === 'history' ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                          <span>Completion Time</span>
                          <span className="text-emerald-500">{order.totalCompletionTimeMinutes} mins</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                          <span>Chef</span>
                          <span className="text-slate-300">{order.claimedBy}</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {order.status === 'remaining' || order.status === 'pending' ? (
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="w-full py-4 bg-amber-500 text-amber-950 font-bold rounded-2xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                          >
                            <Timer className="w-5 h-5" />
                            Start Cooking
                          </button>
                        ) : order.status === 'preparing' ? (
                          <button 
                            onClick={async () => {
                              console.log('Marking order as ready, orderId:', order.id);
                              // Mark as ready
                              await updateStatus(order.id, 'ready');
                              
                              // Trigger Chatbot Notification
                              const msgRef = collection(db, 'restaurants', restaurant.id, 'staffMessages');
                              await addDoc(msgRef, {
                                senderId: 'system',
                                receiverId: order.customerId || 'unknown-customer',
                                text: "Sahab, aapka order ready ho chuka hai!",
                                createdAt: new Date().toISOString(),
                                type: 'customer-notification'
                              });
                              toast.success('Customer notified!');
                            }}
                            className="w-full py-4 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Mark as Ready
                          </button>
                        ) : order.status === 'ready' && order.orderType === 'Delivery' ? (
                          <div className="space-y-2">
                            <button
                              onClick={() => {
                                if (riders.length > 0) {
                                  updateDoc(doc(db, 'restaurants', restaurant.id, 'orders', order.id), {
                                    assignedRiderId: riders[0].id,
                                    status: 'ready'
                                  });
                                  toast.success(`Assigned to ${riders[0].name}`);
                                } else {
                                  toast.error('No riders available');
                                }
                              }}
                              className="w-full py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 mb-2"
                            >
                              Test Assign to {riders[0]?.name || 'Rider'}
                            </button>
                            <select 
                              onChange={(e) => {
                                const riderId = e.target.value;
                                if (riderId) {
                                  updateDoc(doc(db, 'restaurants', restaurant.id, 'orders', order.id), {
                                    assignedRiderId: riderId,
                                    status: 'ready' // Keep ready until picked up
                                  });
                                  toast.success('Order assigned to rider!');
                                }
                              }}
                              className="w-full py-4 bg-slate-700 text-white font-bold rounded-2xl px-4"
                            >
                              <option value="">Select Rider</option>
                              {riders.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : order.status === 'ready' ? (
                          <button 
                            onClick={() => updateStatus(order.id, 'completed')}
                            className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Mark Completed
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {orders.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                <List className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-sm">No orders found</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex gap-6 p-6 overflow-hidden">
            {/* Thread Sidebar */}
            <div className="w-80 flex flex-col gap-4">
              <div className="bg-[#1e293b] rounded-3xl p-6 border border-slate-800 flex flex-col h-full">
                <h3 className="text-lg font-bold mb-4">Messages</h3>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedThread(null)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-2xl transition-all",
                      selectedThread === null ? "bg-emerald-500 text-emerald-950" : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    )}
                  >
                    <Bot className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-bold text-sm">Global Chat</p>
                      <p className="text-[10px] opacity-60">All Staff</p>
                    </div>
                  </button>

                  <div className="py-2">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-4 mb-2">Direct Messages</p>
                  </div>

                  {/* Owner Thread */}
                  <button
                    onClick={() => setSelectedThread({ id: restaurant.ownerUid, name: 'Owner', role: 'owner' })}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-2xl transition-all",
                      selectedThread?.id === restaurant.ownerUid ? "bg-emerald-500 text-emerald-950" : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    )}
                  >
                    <User className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-bold text-sm">Owner</p>
                      <p className="text-[10px] opacity-60">Restaurant Admin</p>
                    </div>
                  </button>

                  {staff.filter(s => s.id !== staffId).map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedThread({ id: s.id, name: s.name, role: s.role })}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-2xl transition-all",
                        selectedThread?.id === s.id ? "bg-emerald-500 text-emerald-950" : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                      )}
                    >
                      <User className="w-5 h-5" />
                      <div className="text-left">
                        <p className="font-bold text-sm">{s.name}</p>
                        <p className="text-[10px] opacity-60">{s.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1">
              <StaffMessages 
                targetStaffId={selectedThread?.id || 'all'} 
                targetStaffName={selectedThread?.name} 
              />
            </div>
          </div>
        )}
      </div>

      {/* Prep Time Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1e293b] w-full max-w-md rounded-3xl p-8 border border-slate-700 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-2">Set Prep Time</h2>
              <p className="text-slate-400 mb-8">How long will this order take to prepare?</p>
              
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[10, 15, 20, 30, 60].map(t => (
                  <button
                    key={t}
                    onClick={() => setPrepTime(t)}
                    className={cn(
                      "py-4 rounded-2xl font-bold transition-all border-2",
                      prepTime === t 
                        ? "bg-emerald-500 border-emerald-400 text-emerald-950" 
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                    )}
                  >
                    {t === 60 ? '1h' : `${t}m`}
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-4 bg-slate-800 text-slate-400 font-bold rounded-2xl hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => claimOrder(selectedOrder.id)}
                  className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Start Cooking
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
