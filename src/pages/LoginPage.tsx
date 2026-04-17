import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginAsOwner, loginAsStaff, loginAsOwnerWithEmail } from '../services/authService';
import { useAuth } from '../App';
import { motion } from 'motion/react';
import { Store, Users, ArrowRight, Loader2, Database, Mail, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../firebase';
import { doc, setDoc, collection } from 'firebase/firestore';

export default function LoginPage() {
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [ownerFormData, setOwnerFormData] = useState({
    email: '',
    password: ''
  });
  const [formData, setFormData] = useState({
    restaurantId: '',
    username: '',
    password: ''
  });
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const seedTestData = async () => {
    setSeeding(true);
    try {
      // Create Restaurant
      const restId = 'Aeterna-001';
      await setDoc(doc(db, 'restaurants', restId), {
        name: 'Aeterna Test Kitchen',
        ownerUid: 'system',
        createdAt: new Date().toISOString(),
        subscriptionStatus: 'active'
      });

      // Create Staff at EXACT path: restaurants/Aeterna-001/staff/admin
      const staffRef = doc(db, 'restaurants', restId, 'staff', 'admin');
      await setDoc(staffRef, {
        username: "admin",
        password: "password123",
        role: "Chef",
        name: "System Admin",
        phone: "+92 300 0000000",
        experience: "5 Years"
      });

      // Create Test Owner at owners/test_owner
      await setDoc(doc(db, 'owners', 'test_owner'), {
        email: "owner@test.com",
        password: "password123",
        restaurantId: restId,
        name: "Test Owner"
      });

      toast.success('Test data seeded! Owner: owner@test.com / password123. Staff: Aeterna-001 / admin / password123');
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to seed data. Check Firestore rules.');
    } finally {
      setSeeding(false);
    }
  };

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { restaurantId } = await loginAsOwnerWithEmail(
        ownerFormData.email,
        ownerFormData.password
      );
      await login(restaurantId, 'owner');
      navigate('/owner');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { user, restaurantId, needsRestaurant } = await loginAsOwner();
      if (needsRestaurant) {
        toast.success('Welcome! Please set up your restaurant.');
        navigate('/owner/setup');
      } else {
        await login(restaurantId, 'owner');
        navigate('/owner');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { restaurantId, role, staffId } = await loginAsStaff(
        formData.restaurantId,
        formData.username,
        formData.password
      );
      await login(restaurantId, role, staffId);
      if (role === 'Rider') {
        navigate('/rider-portal');
      } else {
        navigate('/dashboard/staff');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tighter text-slate-900 mb-2">AETERNA AI</h1>
          <p className="text-slate-500 font-medium">Restaurant Management Reimagined</p>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
          <div className="flex p-1 bg-slate-50 rounded-2xl mb-8">
            <button 
              onClick={() => setIsStaff(false)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${!isStaff ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
            >
              <Store className="w-4 h-4 inline-block mr-2" />
              Owner
            </button>
            <button 
              onClick={() => setIsStaff(true)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${isStaff ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
            >
              <Users className="w-4 h-4 inline-block mr-2" />
              Staff
            </button>
          </div>

          {!isStaff ? (
            <form onSubmit={handleOwnerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Owner Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="email"
                    required
                    placeholder="owner@test.com"
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                    value={ownerFormData.email}
                    onChange={e => setOwnerFormData({...ownerFormData, email: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                    value={ownerFormData.password}
                    onChange={e => setOwnerFormData({...ownerFormData, password: e.target.value})}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center hover:bg-slate-800 transition-all disabled:opacity-50 mt-4"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login as Owner'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { restaurantId } = await loginAsOwnerWithEmail('aeternabydanish@gmail.com', '123456');
                    await login(restaurantId, 'owner');
                    navigate('/owner');
                  } catch (error: any) {
                    toast.error("Debug Login Failed: " + error.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-amber-100 transition-all mt-2"
              >
                Debug Login (Danish)
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Or</span></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Continue with Google
              </button>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                  New to Aeterna?{' '}
                  <Link to="/register" className="text-emerald-600 font-bold hover:underline">
                    Create Account
                  </Link>
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Restaurant ID</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. AETERNA-8297"
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-mono text-sm"
                  value={formData.restaurantId}
                  onChange={e => setFormData({...formData, restaurantId: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Username</label>
                <input 
                  type="text"
                  required
                  placeholder="chef_ali"
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center hover:bg-emerald-700 transition-all disabled:opacity-50 mt-4"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    Login to Portal
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-8 text-center">
          <button 
            onClick={seedTestData}
            disabled={seeding}
            className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2 mx-auto uppercase tracking-widest"
          >
            {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
            Seed Test Data (Aeterna-001)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
