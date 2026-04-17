import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../App';
import { Staff } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Users, Trash2, Edit2, X, ChefHat, Bike, Phone, Star, Upload, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { optimizeImage } from '../../lib/imageUtils';

export default function StaffManagement() {
  const { restaurant } = useAuth();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Staff | null>(null);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'Chef' as const,
    phone: '',
    experience: '',
    photo: ''
  });

  useEffect(() => {
    if (!restaurant) return;

    const staffRef = collection(db, 'restaurants', restaurant.id, 'staff');
    const unsubscribe = onSnapshot(staffRef, (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });

    return () => unsubscribe();
  }, [restaurant]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const optimizedBase64 = await optimizeImage(file, 400, 400); // Smaller for profile photos
      setFormData({ ...formData, photo: optimizedBase64 });
      toast.success('Photo processed successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to process photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    try {
      const staffRef = collection(db, 'restaurants', restaurant.id, 'staff');
      if (editingItem) {
        await updateDoc(doc(db, 'restaurants', restaurant.id, 'staff', editingItem.id), formData);
        toast.success('Staff profile updated!');
      } else {
        await addDoc(staffRef, formData);
        toast.success('Staff member added!');
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', username: '', password: '', role: 'Chef', phone: '', experience: '', photo: '' });
    } catch (error) {
      toast.error('Failed to save staff member.');
    }
  };

  const filtered = staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Staff Management</h2>
          <p className="text-slate-500 mt-1 font-medium">Manage your kitchen and delivery team.</p>
        </div>
        <button 
          onClick={() => {
            setEditingItem(null);
            setFormData({ name: '', username: '', password: '', role: 'Chef', phone: '', experience: '', photo: '' });
            setIsModalOpen(true);
          }}
          className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Add Staff Member
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text"
          placeholder="Search staff..."
          className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {filtered.map((member) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={member.id}
              className="bg-white border border-slate-100 rounded-[2.5rem] p-6 hover:shadow-xl hover:shadow-slate-100 transition-all group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden relative">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        {member.role === 'Chef' ? <ChefHat className="w-8 h-8" /> : <Bike className="w-8 h-8" />}
                      </div>
                    )}
                    <div className={cn(
                      "absolute bottom-0 right-0 w-4 h-4 border-2 border-white rounded-full",
                      "bg-emerald-500" // Assume online for demo
                    )} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">{member.name}</h4>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{member.role}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => navigate('/owner/messages')}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setEditingItem(member);
                      setFormData({...member, password: ''}); // Don't show password
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={async () => {
                      if (confirm('Remove this staff member?')) {
                        await deleteDoc(doc(db, 'restaurants', restaurant!.id, 'staff', member.id));
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-slate-500">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm font-medium">{member.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <Star className="w-4 h-4" />
                  <span className="text-sm font-medium">{member.experience} Experience</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Username</p>
                  <p className="text-sm font-mono font-bold text-slate-700">{member.username}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                  <p className="text-xs font-bold text-emerald-600">Active</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">{editingItem ? 'Edit Staff Profile' : 'Add New Staff'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-xl">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                    <input 
                      type="text"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Role</label>
                    <select 
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value as any})}
                    >
                      <option value="Chef">Chef</option>
                      <option value="Rider">Rider</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Username</label>
                    <input 
                      type="text"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold font-mono"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
                    <input 
                      type="password"
                      required={!editingItem}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phone</label>
                    <input 
                      type="text"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Experience</label>
                    <input 
                      type="text"
                      placeholder="e.g. 5 Years"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.experience}
                      onChange={e => setFormData({...formData, experience: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Staff Photo</label>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-slate-50 rounded-3xl overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center relative group">
                      {formData.photo ? (
                        <>
                          <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => setFormData({ ...formData, photo: '' })}
                            className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </>
                      ) : (
                        <Users className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <label className={cn(
                      "flex-1 py-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-1",
                      uploading ? "bg-slate-50 border-slate-200" : "bg-slate-50 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30"
                    )}>
                      {uploading ? (
                        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Upload Photo</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg mt-4"
                >
                  {editingItem ? 'Update Profile' : 'Add Staff Member'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
