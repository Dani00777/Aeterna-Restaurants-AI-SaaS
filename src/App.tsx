import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { AssistantPopup } from './components/AssistantPopup';
import { Restaurant, UserRole, MenuItem } from './types';

// Pages
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const OwnerDashboard = React.lazy(() => import('./pages/OwnerDashboard'));
const ChefPortal = React.lazy(() => import('./pages/ChefPortal'));
const RiderPortal = React.lazy(() => import('./pages/RiderPortal'));
const CustomerChat = React.lazy(() => import('./pages/CustomerChat'));

interface AuthContextType {
  user: User | null;
  restaurant: Restaurant | null;
  role: UserRole | null;
  staffId: string | null;
  loading: boolean;
  login: (restaurantId: string, role: UserRole, staffId?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const savedResId = localStorage.getItem('aeterna_restaurant_id');
        const savedRole = localStorage.getItem('aeterna_role') as UserRole;
        const savedStaffId = localStorage.getItem('aeterna_staff_id');

        if (savedResId) {
          const resRef = doc(db, 'restaurants', savedResId);
          const resSnap = await getDoc(resRef);
          if (resSnap.exists()) {
            setRestaurant({ id: resSnap.id, ...resSnap.data() } as Restaurant);
            setRole(savedRole || (firebaseUser.isAnonymous ? 'Chef' : 'owner'));
            setStaffId(savedStaffId);
          }
        } else if (!firebaseUser.isAnonymous) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const resId = userSnap.data().restaurantId;
            const resRef = doc(db, 'restaurants', resId);
            const resSnap = await getDoc(resRef);
            if (resSnap.exists()) {
              const resData = { id: resSnap.id, ...resSnap.data() } as Restaurant;
              setRestaurant(resData);
              setRole('owner');
              localStorage.setItem('aeterna_restaurant_id', resId);
              localStorage.setItem('aeterna_role', 'owner');
            }
          }
        }
      } else {
        setRestaurant(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Data fetch for AI context
  useEffect(() => {
    if (restaurant) {
      const targetRestaurantId = restaurant.id;
      const menuRef = collection(db, 'restaurants', targetRestaurantId, 'menu_items');
      const ingredientsRef = collection(db, 'restaurants', targetRestaurantId, 'ingredients');
      const staffRef = collection(db, 'restaurants', targetRestaurantId, 'staff');

      const unsubMenu = onSnapshot(menuRef, (snap) => setMenu(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem))));
      const unsubIngr = onSnapshot(ingredientsRef, (snap) => setIngredients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
      const unsubStaff = onSnapshot(staffRef, (snap) => setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

      return () => { unsubMenu(); unsubIngr(); unsubStaff(); };
    }
  }, [restaurant]);

  const login = async (restaurantId: string, userRole: UserRole, sId?: string) => {
    const resRef = doc(db, 'restaurants', restaurantId);
    const resSnap = await getDoc(resRef);
    if (resSnap.exists()) {
      setRestaurant({ id: resSnap.id, ...resSnap.data() } as Restaurant);
      setRole(userRole);
      setStaffId(sId || null);
      localStorage.setItem('aeterna_restaurant_id', restaurantId);
      localStorage.setItem('aeterna_role', userRole);
      if (sId) localStorage.setItem('aeterna_staff_id', sId);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem('aeterna_restaurant_id');
    localStorage.removeItem('aeterna_role');
    localStorage.removeItem('aeterna_staff_id');
    setRestaurant(null);
    setRole(null);
    setStaffId(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, restaurant, role, staffId, loading, login, logout: handleLogout }}>
      <ErrorBoundary>
        <Router>
          <React.Suspense fallback={<div className="min-h-screen bg-white" />}>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route 
                path="/owner/*" 
                element={role === 'owner' ? <OwnerDashboard /> : <Navigate to="/" />} 
              />
              <Route 
                path="/dashboard/staff" 
                element={role === 'Chef' ? <ChefPortal /> : <Navigate to="/" />} 
              />
              <Route 
                path="/rider-portal" 
                element={role === 'Rider' ? <RiderPortal /> : <Navigate to="/" />} 
              />
              <Route path="/chat/:restaurantId" element={<CustomerChat />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </React.Suspense>
        </Router>
        <Toaster position="top-right" />
        {restaurant && <AssistantPopup restaurant={restaurant} menu={menu} ingredients={ingredients} staff={staff} trainingNotes="" />}
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}
