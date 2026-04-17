import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  orderBy,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Staff, Order, OrderStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bike, CheckCircle, Package, MapPin, Navigation, Phone, LogOut, MessageSquare, List, User, Bot } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import StaffMessages from '../components/StaffMessages';

export default function RiderPortal() {
  const { restaurant, logout, staffId } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'deliveries' | 'history' | 'messages'>('deliveries');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedThread, setSelectedThread] = useState<{ id: string; name: string; role: string } | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    if (!restaurant || !staffId) return;

    // Live Location Tracking
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const staffRef = doc(db, 'restaurants', restaurant.id, 'staff', staffId);
        await updateDoc(staffRef, {
          currentLocation: { lat: latitude, lng: longitude }
        });
      },
      (error) => console.error('Geolocation error:', error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    const ordersRef = collection(db, 'restaurants', restaurant.id, 'orders');
    const q = query(
      ordersRef, 
      where('status', 'in', ['ready', 'picked_up', 'delivered']),
      where('orderType', '==', 'Delivery'),
      where('assignedRiderId', '==', staffId)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      fetchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(fetchedOrders);
    });

    // Fetch staff for messaging
    const staffColRef = collection(db, 'restaurants', restaurant.id, 'staff');
    const unsubscribeStaff = onSnapshot(staffColRef, (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });

    return () => {
      unsubscribe();
      unsubscribeStaff();
      navigator.geolocation.clearWatch(watchId);
    };
  }, [restaurant, staffId]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    if (!restaurant) return;
    try {
      const orderRef = doc(db, 'restaurants', restaurant.id, 'orders', orderId);
      await updateDoc(orderRef, { status });
      toast.success(`Order marked as ${status}`);
    } catch (error) {
      toast.error('Failed to update order.');
    }
  };

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-2xl">
            <Bike className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">RIDER PORTAL</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              {restaurant.name} • Active Deliveries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveTab('deliveries')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all",
              activeTab === 'deliveries' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            <List className="w-4 h-4" />
            DELIVERIES
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all",
              activeTab === 'history' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            <CheckCircle className="w-4 h-4" />
            HISTORY
          </button>
          <button 
            onClick={() => setActiveTab('messages')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all",
              activeTab === 'messages' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            MESSAGES
          </button>
          <div className="h-8 w-px bg-slate-200 mx-2" />
          <button 
            onClick={handleLogout}
            className="p-3 bg-slate-100 text-slate-400 hover:text-red-600 rounded-2xl transition-all"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'deliveries' ? (
          <div className="h-full p-6 space-y-6 max-w-2xl mx-auto w-full overflow-y-auto">
            <AnimatePresence>
              {orders.filter(o => o.status !== 'delivered').map((order) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={order.id}
                  className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Order #{order.id.slice(-4).toUpperCase()}</h3>
                      <p className="text-xs text-slate-500 font-medium">Placed {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider",
                      order.status === 'ready' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {order.status}
                    </span>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Customer Info */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Delivery Address</p>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">
                          Customer Phone: {order.customerId}
                          <br />
                          <span className="text-slate-500 font-medium italic">Address provided in chat history</span>
                        </p>
                      </div>
                      <button className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all">
                        <Phone className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Items Summary */}
                    <div className="bg-slate-50 rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Order Items</p>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="font-bold text-slate-700">{item.quantity}x {item.name}</span>
                            <span className="text-slate-500">Rs. {item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50/50 border-t border-slate-50">
                    {order.status === 'ready' ? (
                      <button 
                        onClick={async () => {
                          await updateStatus(order.id, 'picked_up');
                          // Notify Chatbot
                          const msgRef = collection(db, 'restaurants', restaurant.id, 'staffMessages');
                          await addDoc(msgRef, {
                            senderId: 'system',
                            senderName: 'System',
                            senderRole: 'Chef',
                            receiverId: 'all',
                            text: `Order ${order.id.slice(-4).toUpperCase()} has been picked up by ${staffId}.`,
                            createdAt: new Date().toISOString()
                          });
                        }}
                        className="w-full py-5 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-3"
                      >
                        <CheckCircle className="w-6 h-6" />
                        Pick Order
                      </button>
                    ) : order.status === 'picked_up' ? (
                      <button 
                        onClick={async () => {
                          await updateStatus(order.id, 'delivered');
                          // Notify Chatbot
                          const msgRef = collection(db, 'restaurants', restaurant.id, 'staffMessages');
                          await addDoc(msgRef, {
                            senderId: 'system',
                            senderName: 'System',
                            senderRole: 'Chef',
                            receiverId: 'all',
                            text: `Order ${order.id.slice(-4).toUpperCase()} delivered! Please enjoy and give us your feedback.`,
                            createdAt: new Date().toISOString()
                          });
                        }}
                        className="w-full py-5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-3"
                      >
                        <CheckCircle className="w-6 h-6" />
                        Mark as Delivered
                      </button>
                    ) : (
                      <div className="text-center py-2 text-emerald-600 font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Successfully Delivered
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {orders.filter(o => o.status !== 'delivered').length === 0 && (
                <div className="text-center py-20 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <Package className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active deliveries</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : activeTab === 'history' ? (
          <div className="h-full p-6 space-y-6 max-w-2xl mx-auto w-full overflow-y-auto">
            <AnimatePresence>
              {orders.filter(o => o.status === 'delivered').map((order) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={order.id}
                  className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Order #{order.id.slice(-4).toUpperCase()}</h3>
                      <p className="text-xs text-slate-500 font-medium">Delivered at {new Date(order.createdAt).toLocaleTimeString()}</p>
                    </div>
                    <span className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-700">
                      DELIVERED
                    </span>
                  </div>
                </motion.div>
              ))}
              {orders.filter(o => o.status === 'delivered').length === 0 && (
                <div className="text-center py-20 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <Package className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No delivery history</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="h-full flex gap-6 p-6 max-w-5xl mx-auto w-full overflow-hidden">
            {/* Thread Sidebar */}
            <div className="w-72 flex flex-col gap-4">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 flex flex-col h-full shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-slate-900">Messages</h3>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedThread(null)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-2xl transition-all",
                      selectedThread === null ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    <Bot className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-bold text-sm">Global Chat</p>
                      <p className="text-[10px] opacity-60">All Staff</p>
                    </div>
                  </button>

                  <div className="py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-2">Direct Messages</p>
                  </div>

                  {/* Owner Thread */}
                  <button
                    onClick={() => setSelectedThread({ id: restaurant.ownerUid, name: 'Owner', role: 'owner' })}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-2xl transition-all",
                      selectedThread?.id === restaurant.ownerUid ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    <User className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-bold text-sm">Owner</p>
                      <p className="text-[10px] opacity-60">Admin</p>
                    </div>
                  </button>

                  {staff.filter(s => s.id !== staffId).map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedThread({ id: s.id, name: s.name, role: s.role })}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-2xl transition-all",
                        selectedThread?.id === s.id ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
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
    </div>
  );
}
