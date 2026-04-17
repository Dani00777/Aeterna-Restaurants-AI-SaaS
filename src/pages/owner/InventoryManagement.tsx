import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../App';
import { Ingredient } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, AlertTriangle, Package, Trash2, Edit2, X, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';

export default function InventoryManagement() {
  const { restaurant } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    quantityInStock: 0,
    unitPrice: 0,
    lowStockThreshold: 5
  });

  useEffect(() => {
    if (!restaurant) return;

    const invRef = collection(db, 'restaurants', restaurant.id, 'ingredients');
    const unsubscribe = onSnapshot(invRef, (snap) => {
      setIngredients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient)));
    });

    return () => unsubscribe();
  }, [restaurant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    try {
      const invRef = collection(db, 'restaurants', restaurant.id, 'ingredients');
      const dataToSave = {
        ...formData,
        totalStockValue: formData.quantityInStock * formData.unitPrice
      };
      if (editingItem) {
        await updateDoc(doc(db, 'restaurants', restaurant.id, 'ingredients', editingItem.id), dataToSave);
        toast.success('Inventory updated!');
      } else {
        await addDoc(invRef, dataToSave);
        toast.success('Ingredient added!');
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', unit: 'kg', quantityInStock: 0, unitPrice: 0, lowStockThreshold: 5 });
    } catch (error) {
      toast.error('Failed to save ingredient.');
    }
  };

  const updateQuantity = async (id: string, delta: number) => {
    if (!restaurant) return;
    const item = ingredients.find(i => i.id === id);
    if (!item) return;
    
    try {
      const itemRef = doc(db, 'restaurants', restaurant.id, 'ingredients', id);
      await updateDoc(itemRef, { quantityInStock: Math.max(0, item.quantityInStock + delta) });
    } catch (error) {
      toast.error('Failed to update quantity.');
    }
  };

  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Inventory</h2>
          <p className="text-slate-500 mt-1 font-medium">Track your stock levels and set low-stock alerts.</p>
        </div>
        <button 
          onClick={() => {
            setEditingItem(null);
            setFormData({ name: '', unit: 'kg', quantityInStock: 0, lowStockThreshold: 5 });
            setIsModalOpen(true);
          }}
          className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5 text-emerald-400" />
          Add Ingredient
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text"
          placeholder="Search ingredients..."
          className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Inventory List */}
      <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ingredient</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Stock Level</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Status</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((item) => {
              const isLow = item.quantityInStock <= item.lowStockThreshold;
              return (
                <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                      <span className="font-bold text-slate-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-lg">{item.quantityInStock}</span>
                      <span className="text-xs font-bold text-slate-400 uppercase">{item.unit}</span>
                      <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"><ArrowUp className="w-3 h-3" /></button>
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><ArrowDown className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {isLow ? (
                      <span className="flex items-center gap-1.5 text-amber-600 font-bold text-xs bg-amber-50 px-3 py-1.5 rounded-full w-fit">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Low Stock
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-full w-fit">
                        Healthy
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingItem(item);
                          setFormData(item);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('Delete this ingredient?')) {
                            await deleteDoc(doc(db, 'restaurants', restaurant!.id, 'ingredients', item.id));
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
              className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">{editingItem ? 'Edit Ingredient' : 'New Ingredient'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-xl">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Name</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Unit</label>
                    <select 
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.unit || 'kg'}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                    >
                      <option value="kg">kg</option>
                      <option value="pcs">pcs</option>
                      <option value="ltr">ltr</option>
                      <option value="gm">gm</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Initial Stock</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.quantityInStock ?? 0}
                      onChange={e => setFormData({...formData, quantityInStock: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Unit Price</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.unitPrice ?? 0}
                      onChange={e => setFormData({...formData, unitPrice: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Stock Value</label>
                    <input 
                      type="number"
                      disabled
                      className="w-full px-5 py-4 bg-slate-100 border-none rounded-2xl transition-all font-semibold text-slate-500"
                      value={isNaN(formData.quantityInStock * formData.unitPrice) ? 0 : formData.quantityInStock * formData.unitPrice}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Low Stock Threshold</label>
                  <input 
                    type="number"
                    required
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold text-amber-600"
                    value={formData.lowStockThreshold ?? 0}
                    onChange={e => setFormData({...formData, lowStockThreshold: Number(e.target.value)})}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg mt-4"
                >
                  {editingItem ? 'Update Stock' : 'Add to Inventory'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
