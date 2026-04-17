import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Restaurant, MenuItem, OrderItem, Ingredient } from '../../types';
import { getAIResponse } from '../../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Send, CheckCircle2, Smartphone, User, Bot, Loader2, Menu as MenuIcon, X, ShoppingBag, Plus, Minus, ShoppingCart } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';

interface AISimulatorProps {
  restaurant: Restaurant;
  menu: MenuItem[];
  ingredients: Ingredient[];
  tableCount: number;
}

export default function AISimulator({ restaurant, menu, ingredients, tableCount }: AISimulatorProps) {
  const [selectedTable, setSelectedTable] = useState('1');
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; showMenuButton?: boolean; showConfirmButton?: boolean }>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [cart, setCart] = useState<{ [itemId: string]: number }>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial greeting
    setMessages([{ role: 'model', text: 'As-salamu alaykum Sahab! Main is restaurant ka AI Manager hoon. Main apki kaise madad kar sakta hoon? Kya ap menu dekhna chahain ge?' }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !restaurant) return;

    const lowerInput = input.toLowerCase().trim();
    const isConfirmation = ['confirm', 'haan', 'ok', 'theek', 'bhej do', 'order bhej do'].some(keyword => lowerInput.includes(keyword));

    const userMsg = { role: 'user' as const, text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setOrderConfirmed(false);

    if (isConfirmation) {
        // Find the last assistant message that had order data
        const lastOrderMsg = messages.reverse().find(m => m.text.includes('selected'));
        if (lastOrderMsg) {
            // Hardcoded trigger for order creation logic (simulating order confirmation)
            // Ideally, we'd trigger the actual createOrder if we had the data here
            // For now, this flows into the AI to confirm for simplicity
        }
    }

    try {
      const aiResponse = await getAIResponse(restaurant, menu, ingredients, [], "", [...messages, userMsg], selectedTable);
      
      if (aiResponse) {
        const hasMenuButton = aiResponse.includes('[SHOW_MENU_BUTTON]');
        const hasConfirmButton = aiResponse.includes('[SHOW_CONFIRM_BUTTON]');
        const cleanText = aiResponse.replace(/\[.*?\]/g, '').trim();
        
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: cleanText,
          showMenuButton: hasMenuButton,
          showConfirmButton: hasConfirmButton
        }]);
        
        if (aiResponse.includes('[ORDER_DATA:')) {
          const match = aiResponse.match(/\[ORDER_DATA: (.*?)\]/);
          if (match) {
            try {
              const orderData = JSON.parse(match[1]);
              await createOrder(orderData);
            } catch (e) {
              console.error('Failed to parse order data', e);
            }
          }
        }
      }
    } catch (error: any) {
      toast.error('AI is currently busy. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const categories = ['All', ...Array.from(new Set(menu.map(m => m.category || 'Uncategorized')))];
  
  const filteredMenu = menu.filter(item => 
    (selectedCategory === 'All' || (item.category || 'Uncategorized') === selectedCategory) &&
    (item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCartConfirmManual = async () => {
    const selectedItems = Object.entries(cart)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([id, qty]) => {
        const item = menu.find(m => m.id === id);
        return {
          menuItemId: id,
          name: item?.name || '',
          quantity: qty as number,
          price: item?.price || 0
        };
      });

    if (selectedItems.length === 0) {
      toast.error('Please select items first');
      return;
    }

    const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 1. Trigger order placement directly
    await createOrder({ items: selectedItems, subtotal });
    
    // 2. Close menu
    setShowMenu(false);
    setCart({}); // Clear cart
    
    // 3. AI Notification
    setMessages(prev => [...prev, { 
      role: 'model' as const, 
      text: "Aapka order kitchen bhej diya gaya hai!"
    }]);
  };

  const createOrder = async (data: { items: OrderItem[], subtotal: number }) => {
    try {
      const orderRef = collection(db, 'restaurants', restaurant.id, 'orders');
      const itemsSummary = data.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
      
      const docRef = await addDoc(orderRef, {
        restaurantId: restaurant.id,
        customerId: 'Simulator',
        tableNumber: selectedTable,
        items: data.items,
        subtotal: data.subtotal,
        status: 'remaining',
        orderType: 'Indoor',
        chatHistory: messages,
        urgentAlert: `Order Received from Table ${selectedTable}! Summary: ${itemsSummary}`,
        createdAt: new Date().toISOString()
      });

      // Listen for updates to this order in the simulator
      onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const orderData = snap.data();
          if (orderData.claimedBy && orderData.prepTimeMinutes && !messages.some(m => m.text.includes(orderData.claimedBy))) {
            setMessages(prev => [...prev, {
              role: 'model',
              text: `Apka order Chef ${orderData.claimedBy} ne note kar liya hai, yeh ${orderData.prepTimeMinutes} mins mein ready ho jayega.`
            }]);
          }
          
          // Trigger AI notification if ready
          if (orderData.status === 'ready' && !messages.some(m => m.text.includes('ready hai'))) {
            setMessages(prev => [...prev, {
              role: 'model',
              text: `Ji Sahab, aapka order Table Number ${orderData.tableNumber || 'Walking'} ke liye ready hai!`
            }]);
          }
        }
      });

      setOrderConfirmed(true);
      setCart({});
      toast.success('Simulation Order placed!');
    } catch (error) {
      toast.error('Failed to place simulation order.');
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col h-[600px]">
      {/* Simulator Header */}
      <div className="bg-slate-900 p-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold">AI Live Simulator</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">WhatsApp Style Testing</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Table</label>
          <select 
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="bg-slate-800 border-none rounded-xl text-xs font-bold px-3 py-2 focus:ring-2 focus:ring-emerald-500"
          >
            {Array.from({ length: tableCount }).map((_, i) => (
              <option key={i + 1} value={i + 1}>Table {i + 1}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#E5DDD5] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat relative"
      >
        {messages.map((msg, i) => (
          <div key={i} className="flex flex-col gap-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "max-w-[80%] p-3 rounded-2xl shadow-sm text-sm relative",
                msg.role === 'user' 
                  ? "bg-[#DCF8C6] self-end ml-auto rounded-tr-none" 
                  : "bg-white self-start mr-auto rounded-tl-none"
              )}
            >
              <p className="leading-relaxed">{msg.text}</p>
              <span className="block text-[9px] text-slate-400 text-right mt-1">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
            
            {msg.showMenuButton && (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setShowMenu(true)}
                className="self-start ml-2 bg-white text-emerald-600 border border-emerald-100 px-6 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm hover:bg-emerald-50 transition-all"
              >
                <MenuIcon className="w-4 h-4" />
                VIEW MENU
              </motion.button>
            )}

            {msg.showConfirmButton && !orderConfirmed && (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setInput('Order Confirm Karein');
                  // We'll trigger handleSend in the next tick or just call it
                  // To hide the button immediately, we can update the message
                  const newMessages = [...messages];
                  newMessages[i].showConfirmButton = false;
                  setMessages(newMessages);
                  
                  // Now send
                  const userMsg = { role: 'user' as const, text: 'Order Confirm Karein' };
                  setMessages(prev => [...prev, userMsg]);
                  setInput('');
                  setLoading(true);
                  setOrderConfirmed(false);
                  
                  getAIResponse(restaurant, menu, [], [], "", [...messages, userMsg], selectedTable)
                    .then(async (aiResponse) => {
                      if (aiResponse) {
                        const hasMenuButton = aiResponse.includes('[SHOW_MENU_BUTTON]');
                        const hasConfirmButton = aiResponse.includes('[SHOW_CONFIRM_BUTTON]');
                        const cleanText = aiResponse.replace(/\[.*?\]/g, '').trim();
                        
                        setMessages(prev => [...prev, { 
                          role: 'model', 
                          text: cleanText,
                          showMenuButton: hasMenuButton,
                          showConfirmButton: hasConfirmButton
                        }]);
                        
                        if (aiResponse.includes('[ORDER_DATA:')) {
                          const match = aiResponse.match(/\[ORDER_DATA: (.*?)\]/);
                          if (match) {
                            try {
                              const orderData = JSON.parse(match[1]);
                              await createOrder(orderData);
                            } catch (e) {
                              console.error('Failed to parse order data', e);
                            }
                          }
                        }
                      }
                    })
                    .catch(() => toast.error('AI is busy'))
                    .finally(() => setLoading(false));
                }}
                className="self-start ml-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                ORDER CONFIRM KAREIN
              </motion.button>
            )}
          </div>
        ))}

        {orderConfirmed && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center space-y-2 mx-auto max-w-xs"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-emerald-900 text-sm">Order Sent to Kitchen!</h4>
            <p className="text-[10px] text-emerald-700">This simulated order is now visible on the Chef Portal for Table {selectedTable}.</p>
          </motion.div>
        )}

        {/* Simulator Menu Modal */}
        <AnimatePresence>
          {showMenu && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-0 bg-white z-50 flex flex-col rounded-t-[2.5rem] shadow-2xl"
            >
              <div className="p-6 border-b space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">Digital Menu</h3>
                  <button onClick={() => setShowMenu(false)} className="p-2 bg-slate-50 rounded-xl">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <input 
                  type="text"
                  placeholder="Search items..."
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn("px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap", selectedCategory === cat ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600")}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
                {filteredMenu.map(item => {
                  const quantity = cart[item.id] || 0;
                  return (
                    <div key={item.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl">
                      <div className="w-16 h-16 bg-white rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm">{item.name}</h4>
                        <p className="text-emerald-600 font-bold text-xs">Rs. {item.price}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <button onClick={() => setCart({ ...cart, [item.id]: Math.max(0, quantity - 1) })} className="p-1 bg-white rounded border border-slate-200"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs font-bold">{quantity}</span>
                          <button onClick={() => setCart({ ...cart, [item.id]: quantity + 1 })} className="p-1 bg-white rounded border border-slate-200"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t bg-white">
                <button 
                  onClick={handleCartConfirmManual}
                  disabled={Object.values(cart).every(v => (v as number) === 0)}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Confirm & Send to Kitchen
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="bg-white p-4 border-t border-slate-100 flex items-center gap-3">
        <input 
          type="text"
          placeholder="Type a message to test AI..."
          className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-all"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button 
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-emerald-600 text-white p-4 rounded-2xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-100"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
