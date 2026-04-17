import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../App';
import { Order, Staff, Ingredient } from '../../types';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  AlertTriangle, 
  Sparkles,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import LiveDeliveryMap from './LiveDeliveryMap';

export default function DashboardHome() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    if (!restaurant) return;

    // Listen to orders
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('restaurantId', '==', restaurant.id));
    const unsubscribeOrders = onSnapshot(q, (snap) => {
      const fetchedOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      // Sort in memory to avoid index requirements
      fetchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(fetchedOrders);
    });

    // Listen to staff
    const staffRef = collection(db, 'restaurants', restaurant.id, 'staff');
    const unsubscribeStaff = onSnapshot(staffRef, (snap) => {
      setStaffCount(snap.size);
    });

    // Listen to ingredients
    const ingredientsRef = collection(db, 'restaurants', restaurant.id, 'ingredients');
    const unsubscribeIngredients = onSnapshot(ingredientsRef, (snap) => {
      const lowStock = snap.docs.filter(doc => {
        const data = doc.data();
        return data.quantityInStock <= data.lowStockThreshold;
      });
      setLowStockCount(lowStock.length);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeStaff();
      unsubscribeIngredients();
    };
  }, [restaurant]);

  const totalRevenue = orders.reduce((sum, order) => sum + order.subtotal, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  const stats = [
    { label: 'Total Revenue', value: `Rs. ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active Orders', value: orders.length, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Staff Members', value: staffCount, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Low Stock Items', value: lowStockCount, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back, {restaurant?.name}</h2>
          <p className="text-slate-500 mt-1 font-medium">Here's what's happening at your restaurant today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.open(`/chat/${restaurant?.id}?table=1`, '_blank')}
            className="bg-white border border-slate-200 text-slate-700 px-6 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Sparkles className="w-5 h-5 text-emerald-500" />
            Simulate Order (Table 1)
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-600">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <LiveDeliveryMap />

      {/* AI Insights & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* AI Business Health Report */}
        <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-500/20 rounded-xl">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold">Daily AI Business Insights</h3>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <p className="text-slate-300 leading-relaxed italic">
                  "Based on the last 50 orders, your 'Zinger Burger' is performing exceptionally well during lunch hours. However, inventory for 'Chicken Patties' is dropping faster than expected. Consider increasing your weekend stock by 15%."
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Top Performer</p>
                  <p className="font-bold">Zinger Burger</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Stock Alert</p>
                  <p className="font-bold">Chicken Patties</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
        </div>

        {/* Recent Orders Mini-List */}
        <div className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Recent Orders</h3>
            <Link to="/owner/orders" className="text-emerald-600 font-bold text-xs flex items-center gap-1 hover:underline">
              View All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="space-y-4">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-mono text-[10px] font-bold text-slate-500">
                    #{order.id.slice(-4).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Rs. {order.subtotal}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                  order.status === 'pending' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  {order.status}
                </span>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="text-center py-10">
                <p className="text-slate-400 text-sm font-medium">No orders yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
