import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  collection, 
  doc, 
  getDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Restaurant, MenuItem, Order, OrderItem } from '../types';
import { getAIResponse } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Menu as MenuIcon, X, ShoppingBag, CheckCircle2, Plus, Minus, ShoppingCart, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function CustomerChat() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; showMenuButton?: boolean; showConfirmButton?: boolean }>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [cart, setCart] = useState<{ [itemId: string]: number }>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!restaurantId) return;

    // Fetch Restaurant
    const fetchRes = async () => {
      const resRef = doc(db, 'restaurants', restaurantId);
      const resSnap = await getDoc(resRef);
      if (resSnap.exists()) {
        setRestaurant({ id: resSnap.id, ...resSnap.data() } as Restaurant);
      }
    };
    fetchRes();

    // Fetch Menu, Ingredients, Staff
    const targetRestaurantId = 'DANISH-RESTO-6671';
    
    const menuRef = collection(db, 'restaurants', targetRestaurantId, 'menu_items');
    const ingredientsRef = collection(db, 'restaurants', targetRestaurantId, 'ingredients');
    const staffRef = collection(db, 'restaurants', targetRestaurantId, 'staff');

    const unsubscribeMenu = onSnapshot(menuRef, (snap) => {
      const menuItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      console.log(`DEBUG: I see ${menuItems.length} items in Firestore`);
      setMenu(menuItems);
    });

    // We don't need to store ingredients/staff in state for UI, but we need them for AI context
    // So we fetch them once or use onSnapshot to keep them updated
    const unsubscribeIngredients = onSnapshot(ingredientsRef, (snap) => {
      setIngredients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeStaff = onSnapshot(staffRef, (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeMenu();
      unsubscribeIngredients();
      unsubscribeStaff();
    };
  }, [restaurantId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent, overrideText?: string, systemContext?: string) => {
    e?.preventDefault();
    const messageText = overrideText || input;
    if (!messageText.trim() || !restaurant) return;

    const userMsg = { role: 'user' as const, text: messageText };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) setInput('');
    setLoading(true);

    try {
      // Combine user message with system context if provided (but don't show context to user)
      const historyForAI = [...messages, userMsg];
      const menuContext = `The current menu is: ${JSON.stringify(menu.map(m => ({ name: m.name, price: m.price, isAvailable: m.isAvailable })))}`;
      historyForAI.push({ role: 'user', text: `(System Context: ${menuContext} ${systemContext || ''})` });

      const aiResponse = await getAIResponse(restaurant, menu, ingredients, staff, "", historyForAI, tableNumber || undefined);
      
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
          console.log('CustomerChat: AI tried to send [ORDER_DATA], but we are ignoring it as per manual logic.');
        }
      }
    } catch (error: any) {
      console.error('AI Error:', error);
      toast.error(error.message || 'AI is currently busy. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCartConfirm = () => {
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

    const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * (item.quantity as number)), 0);
    const summaryText = selectedItems.map(i => `${i.quantity}x ${i.name}`).join(', ');
    
    const userMsg = { 
      role: 'user' as const, 
      text: `I have selected: ${summaryText}. Total Rs. ${subtotal}. Please confirm my order.` 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setShowMenu(false);
    setLoading(true);

    // Call AI to acknowledge selection
    getAIResponse(restaurant!, menu, ingredients, staff, "", [...messages, userMsg], tableNumber || undefined)
      .then(res => {
        const hasConfirmButton = res.includes('[SHOW_CONFIRM_BUTTON]');
        const cleanText = res.replace(/\[.*?\]/g, '').trim();
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: cleanText,
          showConfirmButton: hasConfirmButton
        }]);
      })
      .catch(error => {
        console.error('AI Error (Cart):', error);
        toast.error(error.message || 'AI is currently busy. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  const createOrder = async (data: { items: OrderItem[], subtotal: number }) => {
    // Normalize ID: Trim and Uppercase to avoid case-sensitivity issues
    // Force DANISH-RESTO-6671 if the URL param is missing or empty
    const rawId = (restaurantId && restaurantId.trim()) ? restaurantId : 'DANISH-RESTO-6671';
    const targetRestaurantId = rawId.trim().toUpperCase();
    
    console.log('CustomerChat: Creating order for restaurantId:', targetRestaurantId);
    
    try {
      // CONSISTENCY FIX: Use nested collection path just like working messages
      const orderRef = collection(db, 'restaurants', targetRestaurantId, 'orders');
      const itemsSummary = data.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
      
      const orderPayload = {
        restaurantId: targetRestaurantId,
        customerId: 'Customer',
        tableNumber: tableNumber || 'Walking',
        items: data.items,
        subtotal: data.subtotal,
        status: 'remaining', // EXACT MATCH for Kitchen Display
        orderType: 'Indoor',
        chatHistory: messages,
        urgentAlert: `Order Received from Table ${tableNumber || 'Walking'}! Summary: ${itemsSummary}`,
        createdAt: new Date().toISOString()
      };

      console.log('CustomerChat: Sending order to path:', `restaurants/${targetRestaurantId}/orders`);
      console.log('CustomerChat: Payload:', orderPayload);

      const docRef = await addDoc(orderRef, orderPayload).catch(error => {
        console.error('Firestore Error in createOrder:', JSON.stringify({
          error: error.message,
          operationType: 'create',
          path: `restaurants/${targetRestaurantId}/orders`,
          restaurantId: targetRestaurantId
        }));
        throw error;
      });

      // Listen to this specific order
      onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const orderData = { id: snap.id, ...snap.data() } as Order;
          setCurrentOrder(orderData);
          
          // Trigger AI notification if claimed
          if (orderData.claimedBy && orderData.prepTimeMinutes && !messages.some(m => m.text.includes(orderData.claimedBy!))) {
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
      toast.success('Order placed successfully!');
    } catch (error) {
      toast.error('Failed to place order.');
    }
  };

  if (!restaurant) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#E5DDD5] flex flex-col font-sans max-w-lg mx-auto shadow-2xl relative overflow-hidden">
      {/* FORCE VISIBLE DEBUG BUTTON */}
      <button
        onClick={async () => {
          if (!restaurantId) return;
          const ordersRef = collection(db, 'restaurants', restaurantId, 'orders');
          await addDoc(ordersRef, {
            restaurantId: restaurantId,
            status: 'remaining',
            orderType: 'Delivery',
            tableNumber: 'DEBUG-1',
            items: [{ name: 'Test Zinger Burger', price: 500, quantity: 1 }],
            subtotal: 500,
            createdAt: new Date().toISOString(),
            customerId: 'DEBUG-CUSTOMER'
          });
          toast.success('Test order sent!');
        }}
        className="w-full bg-red-600 text-white py-4 font-bold text-sm hover:bg-red-700 transition-all z-50"
      >
        SEND DUMMY ORDER
      </button>

      {/* Header */}
      <div className="bg-[#075E54] p-4 flex items-center gap-3 text-white shadow-md z-10">
        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden">
          {restaurant.name[0]}
        </div>
        <div>
          <h2 className="font-bold text-sm leading-tight">{restaurant.name}</h2>
          <p className="text-[10px] opacity-80">Online • System Data</p>
        </div>
      </div>

      {/* DEBUG BUTTON */}
      <button
        onClick={async () => {
          if (!restaurantId) return;
          const ordersRef = collection(db, 'restaurants', restaurantId, 'orders');
          await addDoc(ordersRef, {
            restaurantId: restaurantId,
            status: 'remaining',
            orderType: 'Delivery',
            tableNumber: 'DEBUG-1',
            items: [{ name: 'Test Zinger Burger', price: 500, quantity: 1 }],
            subtotal: 500,
            createdAt: new Date().toISOString(),
            customerId: 'DEBUG-CUSTOMER'
          });
          toast.success('Test order sent!');
        }}
        className="w-full bg-red-600 text-white py-2 font-bold text-xs hover:bg-red-700 transition-all"
      >
        DEBUG: Send Test Order
      </button>
      {/* END DEBUG BUTTON */}

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"
      >
        <div className="flex justify-center mb-4">
          <span className="bg-[#D1E9FF] text-[10px] px-2 py-1 rounded-md shadow-sm uppercase font-bold text-slate-600">
            Today
          </span>
        </div>

        {messages.map((msg, i) => (
          <div key={i} className="flex flex-col gap-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "max-w-[85%] p-3 rounded-2xl shadow-sm text-sm relative",
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

            {msg.showConfirmButton && (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={async () => {
                  setLoading(true);
                  try {
                    // 1. Calculate order data from cart
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

                    if (selectedItems.length > 0) {
                      const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                      
                      // 2. MANUAL FRONTEND WRITE (Confirm first)
                      await createOrder({ items: selectedItems, subtotal });
                      
                      // 3. Talk later (AI response after success)
                      setMessages(prev => {
                        const newMsgs = [...prev];
                        const lastMsg = { ...newMsgs[newMsgs.length - 1] };
                        lastMsg.showConfirmButton = false;
                        newMsgs[newMsgs.length - 1] = lastMsg;
                        return newMsgs;
                      });
                      
                      // Trigger AI response without showing the system instruction to the user
                      await handleSend(undefined, 'Order Confirm Karein.', 'Order has been successfully saved to Firestore. Please thank the customer and confirm it is sent to the kitchen.');
                    }
                  } catch (err) {
                    toast.error('Failed to confirm order. Please try again.');
                  } finally {
                    setLoading(false);
                  }
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center space-y-2"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-emerald-900">Order Confirmed!</h3>
            <p className="text-xs text-emerald-700">Your order has been sent to the kitchen. You can track it here.</p>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="bg-[#F0F0F0] p-2 flex items-center gap-2">
        <button 
          type="button"
          onClick={() => setShowMenu(true)}
          className="p-2 text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <input 
          type="text"
          placeholder="Type a message..."
          className="flex-1 bg-white border-none rounded-full px-4 py-2 text-sm focus:ring-0"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button 
          type="submit"
          className="bg-[#128C7E] text-white p-2 rounded-full hover:bg-[#075E54] transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      {/* Full-Screen E-commerce Menu Modal */}
      <AnimatePresence>
        {showMenu && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white z-50 flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-6 border-b flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Digital Menu</h2>
                <p className="text-xs text-slate-500 font-medium">Select items to add to your order</p>
              </div>
              <button 
                onClick={() => setShowMenu(false)} 
                className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"
              >
                <X className="w-6 h-6 text-slate-900" />
              </button>
            </div>

            {/* Modal Content - Categories & Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-10 pb-32">
              {Array.from(new Set(menu.map(m => m.category))).map(cat => (
                <div key={cat} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.2em]">{cat}</h3>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {menu.filter(m => m.category === cat).map(item => {
                      const quantity = cart[item.id] || 0;
                      return (
                        <div key={item.id} className="flex gap-4 p-4 bg-slate-50 rounded-[2rem] group hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all border border-transparent hover:border-slate-100">
                          <div className="w-24 h-24 bg-white rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-200">
                                <ShoppingBag className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                              <div className="flex justify-between items-start">
                                <h4 className="font-bold text-slate-900 text-lg">{item.name}</h4>
                                <p className="text-emerald-600 font-bold">Rs. {item.price}</p>
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-medium">{item.description}</p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                                <button 
                                  onClick={() => setCart({ ...cart, [item.id]: Math.max(0, quantity - 1) })}
                                  className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-slate-900"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-6 text-center font-bold text-sm">{quantity}</span>
                                <button 
                                  onClick={() => setCart({ ...cart, [item.id]: quantity + 1 })}
                                  className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-slate-900"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              {quantity === 0 && (
                                <button 
                                  onClick={() => setCart({ ...cart, [item.id]: 1 })}
                                  className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-4 py-2 bg-emerald-50 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                                >
                                  Add to Cart
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Sticky Checkout Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex items-center justify-between gap-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
              <div className="flex flex-col">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</p>
                <p className="text-2xl font-bold text-slate-900">
                  Rs. {Object.entries(cart).reduce((sum, [id, qty]) => {
                    const item = menu.find(m => m.id === id);
                    return sum + (item?.price || 0) * (qty as number);
                  }, 0)}
                </p>
              </div>
              <button 
                onClick={handleCartConfirm}
                disabled={Object.values(cart).every(v => (v as number) === 0)}
                className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:shadow-none"
              >
                <ShoppingCart className="w-5 h-5" />
                Confirm Selection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
