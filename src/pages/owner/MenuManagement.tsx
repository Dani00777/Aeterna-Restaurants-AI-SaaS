import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../App';
import { MenuItem, Ingredient } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Filter, MoreVertical, Edit2, Trash2, Image as ImageIcon, Loader2, X, Upload, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { optimizeImage } from '../../lib/imageUtils';

export default function MenuManagement() {
  const { restaurant } = useAuth();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    category: 'Main Course',
    description: '',
    imageUrl: '',
    isAvailable: true
  });

  const [recipeData, setRecipeData] = useState<{ ingredientId: string; ingredientName: string; quantity: number }[]>([]);

  useEffect(() => {
    if (!restaurant) return;

    const menuRef = collection(db, 'restaurants', restaurant.id, 'menu_items');
    const ingredientsRef = collection(db, 'restaurants', restaurant.id, 'ingredients');
    
    const unsubscribeMenu = onSnapshot(menuRef, (snap) => {
      setMenu(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
      setLoading(false);
    });

    const unsubscribeIngredients = onSnapshot(ingredientsRef, (snap) => {
      setIngredients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient)));
    });

    return () => {
      unsubscribeMenu();
      unsubscribeIngredients();
    };
  }, [restaurant]);

  const saveRecipe = async () => {
    if (!restaurant || !editingItem) return;
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id, 'menu_items', editingItem.id), {
        recipe: recipeData
      });
      toast.success('Recipe saved!');
      setIsRecipeModalOpen(false);
    } catch (error) {
      toast.error('Failed to save recipe.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const optimizedBase64 = await optimizeImage(file);
      setFormData({ ...formData, imageUrl: optimizedBase64 });
      toast.success('Image processed successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to process image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    try {
      const menuRef = collection(db, 'restaurants', restaurant.id, 'menu_items');
      if (editingItem) {
        await updateDoc(doc(db, 'restaurants', restaurant.id, 'menu_items', editingItem.id), formData);
        toast.success('Item updated!');
      } else {
        await addDoc(menuRef, formData);
        toast.success('Item added to menu!');
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', price: 0, category: 'Main Course', description: '', imageUrl: '', isAvailable: true });
    } catch (error) {
      toast.error('Failed to save item.');
    }
  };

  const deleteItem = async (id: string) => {
    if (!restaurant || !confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'restaurants', restaurant.id, 'menu_items', id));
      toast.success('Item removed.');
    } catch (error) {
      toast.error('Failed to delete item.');
    }
  };

  const categories = ['All', ...Array.from(new Set(menu.map(m => m.category)))];
  const filteredMenu = menu.filter(m => 
    (categoryFilter === 'All' || m.category === categoryFilter) &&
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Menu Management</h2>
          <p className="text-slate-500 mt-1 font-medium">Create and manage your digital menu items.</p>
        </div>
        <button 
          onClick={() => {
            setEditingItem(null);
            setFormData({ name: '', price: 0, category: 'Main Course', description: '', imageUrl: '', isAvailable: true });
            setIsModalOpen(true);
          }}
          className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
        >
          <Plus className="w-5 h-5" />
          Add New Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Search menu..."
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "px-6 py-4 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border",
                categoryFilter === cat 
                  ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                  : "bg-white text-slate-500 border-slate-100 hover:border-slate-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {filteredMenu.map((item) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={item.id}
              className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden group hover:shadow-xl hover:shadow-slate-100 transition-all"
            >
              <div className="aspect-square bg-slate-50 relative overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingItem(item);
                      setFormData(item);
                      setIsModalOpen(true);
                    }}
                    className="p-2 bg-white/90 backdrop-blur-sm text-slate-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-2 bg-white/90 backdrop-blur-sm text-slate-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {!item.isAvailable && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="bg-white text-slate-900 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest">Unavailable</span>
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-slate-900 text-lg">{item.name}</h4>
                  <p className="text-emerald-600 font-bold">Rs. {item.price}</p>
                </div>
                <p className="text-xs text-slate-400 font-medium mb-4 line-clamp-2">{item.description}</p>
                {item.recipe && item.recipe.length > 0 && (
                  <p className="text-[10px] text-emerald-600 font-bold mb-4">
                    Recipe: {item.recipe.map(r => `${r.quantity}${r.unit} ${r.ingredientName}`).join(', ')}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-wider">
                    {item.category}
                  </span>
                  <button 
                    onClick={() => {
                      setEditingItem(item);
                      setRecipeData(item.recipe || []);
                      setIsRecipeModalOpen(true);
                    }}
                    className="p-1 bg-slate-100 text-slate-500 rounded-md hover:bg-emerald-100 hover:text-emerald-600 transition-all ml-auto"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
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
                <h3 className="text-2xl font-bold">{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-xl">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Item Name</label>
                    <input 
                      type="text"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Price (Rs.)</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Item Image</label>
                  <div className="flex flex-col gap-4">
                    {formData.imageUrl && (
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-100">
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, imageUrl: '' })}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <label className={cn(
                      "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all",
                      uploading ? "bg-slate-50 border-slate-200" : "bg-slate-50 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30"
                    )}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {uploading ? (
                          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-slate-400 mb-2" />
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Choose Image</p>
                          </>
                        )}
                      </div>
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

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                  <input 
                    type="checkbox"
                    id="isAvailable"
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                    checked={formData.isAvailable}
                    onChange={e => setFormData({...formData, isAvailable: e.target.checked})}
                  />
                  <label htmlFor="isAvailable" className="text-sm font-bold text-slate-700">Available for Ordering</label>
                </div>

                <button
                  type="submit"
                  className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-4"
                >
                  {editingItem ? 'Update Item' : 'Add to Menu'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recipe Modal */}
      <AnimatePresence>
        {isRecipeModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">Manage Recipe: {editingItem?.name}</h3>
                <button onClick={() => setIsRecipeModalOpen(false)} className="p-2 bg-slate-50 rounded-xl">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {recipeData.map((r, index) => (
                  <div key={index} className="flex gap-4 items-center">
                    <span className="flex-1 font-semibold">{r.ingredientName} ({r.unit})</span>
                    <input 
                      type="number"
                      step="any"
                      className="w-24 px-3 py-2 bg-slate-50 border-none rounded-xl font-semibold"
                      value={r.quantity}
                      onChange={e => {
                        const newRecipe = [...recipeData];
                        const val = parseFloat(e.target.value);
                        newRecipe[index].quantity = isNaN(val) ? 0 : val;
                        setRecipeData(newRecipe);
                      }}
                    />
                    <button 
                      onClick={() => setRecipeData(recipeData.filter((_, i) => i !== index))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="pt-6 border-t border-slate-100">
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold mb-4"
                    onChange={e => {
                      const ing = ingredients.find(i => i.id === e.target.value);
                      if (ing) {
                        setRecipeData([...recipeData, { ingredientId: ing.id, ingredientName: ing.name, quantity: 1, unit: ing.unit }]);
                      }
                    }}
                    value=""
                  >
                    <option value="" disabled>Add Ingredient...</option>
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={saveRecipe}
                  className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Save Recipe
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
