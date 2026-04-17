import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Package, 
  Users, 
  Settings, 
  BrainCircuit, 
  MessageSquare,
  History,
  LogOut,
  ChevronRight,
  Menu as MenuIcon,
  X
} from 'lucide-react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { logout } from '../services/authService';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import StaffMessages from '../components/StaffMessages';

// Sub-pages (to be created)
const DashboardHome = React.lazy(() => import('./owner/DashboardHome'));
const MenuManagement = React.lazy(() => import('./owner/MenuManagement'));
const InventoryManagement = React.lazy(() => import('./owner/InventoryManagement'));
const StaffManagement = React.lazy(() => import('./owner/StaffManagement'));
const SettingsPage = React.lazy(() => import('./owner/Settings'));
const OrderHistory = React.lazy(() => import('./owner/OrderHistory'));
const CommunicationHub = React.lazy(() => import('./owner/CommunicationHub'));

export default function OwnerDashboard() {
  const { restaurant, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [hasNewOrders, setHasNewOrders] = useState(false);

  useEffect(() => {
    if (!restaurant) return;

    // Listen for new messages
    const msgsRef = collection(db, 'restaurants', restaurant.id, 'staffMessages');
    // For owner, listen to messages where receiver is 'all' or owner UID
    const qMsgs = query(
      msgsRef, 
      where('receiverId', 'in', ['all', user.uid])
    );
    const unsubscribeMsgs = onSnapshot(qMsgs, (snap) => {
      if (!location.pathname.includes('messages') && !snap.empty) {
        setHasNewMessages(true);
      }
    });

    // Listen for new orders
    const ordersRef = collection(db, 'restaurants', restaurant.id, 'orders');
    const qOrders = query(ordersRef, where('status', '==', 'remaining'), limit(1));
    const unsubscribeOrders = onSnapshot(qOrders, (snap) => {
      if (!location.pathname.includes('dashboard') && !snap.empty) {
        setHasNewOrders(true);
      }
    });

    return () => {
      unsubscribeMsgs();
      unsubscribeOrders();
    };
  }, [restaurant, location.pathname]);

  useEffect(() => {
    if (location.pathname.includes('messages')) setHasNewMessages(false);
    if (location.pathname === '/owner') setHasNewOrders(false);
  }, [location.pathname]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/owner', badge: hasNewOrders },
    { icon: UtensilsCrossed, label: 'Menu', path: '/owner/menu' },
    { icon: Package, label: 'Inventory', path: '/owner/inventory' },
    { icon: Users, label: 'Staff', path: '/owner/staff' },
    { icon: MessageSquare, label: 'Messages', path: '/owner/messages', badge: hasNewMessages },
    { icon: History, label: 'History', path: '/owner/history' },
    { icon: Settings, label: 'Settings', path: '/owner/settings' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-white flex font-sans text-slate-900">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 border-r border-slate-100 flex-col sticky top-0 h-screen bg-white">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900">AETERNA</h1>
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mt-1">
            Owner Portal
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-2xl transition-all group",
                  isActive 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <item.icon className={cn("w-5 h-5", isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-900")} />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </div>
                  <span className="font-semibold text-sm">{item.label}</span>
                </div>
                {isActive && <motion.div layoutId="active-pill" className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-50">
          <div className="bg-slate-50 rounded-2xl p-4 mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Restaurant ID</p>
            <p className="text-xs font-mono font-bold text-slate-700">{restaurant.id}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all font-semibold text-sm"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-30">
          <h1 className="text-xl font-bold tracking-tighter">AETERNA</h1>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 bg-slate-50 rounded-xl"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full">
          <React.Suspense fallback={<div className="animate-pulse bg-slate-100 rounded-3xl h-96 w-full" />}>
            <Routes>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/menu" element={<MenuManagement />} />
              <Route path="/inventory" element={<InventoryManagement />} />
              <Route path="/staff" element={<StaffManagement />} />
              <Route path="/messages" element={<CommunicationHub />} />
              <Route path="/history" element={<OrderHistory />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </React.Suspense>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 lg:hidden"
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-50">
                <h1 className="text-xl font-bold tracking-tighter">AETERNA</h1>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-50 rounded-xl">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 p-6 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all",
                      location.pathname === item.path ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <item.icon className="w-6 h-6" />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="p-6 border-t border-slate-50">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-4 py-4 text-red-600 font-bold"
                >
                  <LogOut className="w-6 h-6" />
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Switcher (Global UI Switcher) */}
      <div className="fixed bottom-8 right-8 z-40">
        <div className="group relative">
          <button className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-200 flex items-center justify-center hover:scale-110 transition-all">
            <ChevronRight className="w-6 h-6 group-hover:rotate-90 transition-all" />
          </button>
          <div className="absolute bottom-full right-0 mb-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all translate-y-4 group-hover:translate-y-0">
            <button 
              onClick={() => navigate(`/chat/${restaurant.id}`)}
              className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 text-xs font-bold whitespace-nowrap hover:bg-slate-50"
            >
              Customer View
            </button>
            <button 
              onClick={() => navigate('/dashboard/staff')}
              className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 text-xs font-bold whitespace-nowrap hover:bg-slate-50"
            >
              Chef View
            </button>
            <button 
              onClick={() => navigate('/rider')}
              className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 text-xs font-bold whitespace-nowrap hover:bg-slate-50"
            >
              Rider View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
