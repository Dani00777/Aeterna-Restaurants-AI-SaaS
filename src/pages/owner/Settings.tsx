import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../App';
import { MenuItem, Ingredient } from '../../types';
import { motion } from 'motion/react';
import { QrCode, Download, Save, Loader2, Info, Smartphone, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import AISimulator from '../../components/owner/AISimulator';

export default function Settings() {
  const { restaurant } = useAuth();
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurant) return;

    const fetchSettings = async () => {
      const resRef = doc(db, 'restaurants', restaurant.id);
      const resSnap = await getDoc(resRef);
      if (resSnap.exists()) {
        const data = resSnap.data();
        setTableCount(data.tableCount || 0);
        setWhatsappNumber(data.whatsappNumber || '');
        setWhatsappApiKey(data.whatsappApiKey || '');
      }
    };

    const menuRef = collection(db, 'restaurants', restaurant.id, 'menu_items');
    const unsubscribeMenu = onSnapshot(menuRef, (snap) => {
      setMenu(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
      setLoading(false);
    });

    const ingredientsRef = collection(db, 'restaurants', restaurant.id, 'ingredients');
    const unsubscribeIngredients = onSnapshot(ingredientsRef, (snap) => {
      setIngredients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient)));
    });

    fetchSettings();
    return () => {
        unsubscribeMenu();
        unsubscribeIngredients();
    }
  }, [restaurant]);

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);
    try {
      const resRef = doc(db, 'restaurants', restaurant.id);
      await updateDoc(resRef, { 
        tableCount,
        whatsappNumber,
        whatsappApiKey
      });
      toast.success('Settings updated successfully!');
    } catch (error) {
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const downloadQR = (tableNum: number) => {
    const canvas = document.getElementById(`qr-table-${tableNum}`) as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Table-${tableNum}-QR.png`;
      link.href = url;
      link.click();
    }
  };

  if (loading) return <div className="animate-pulse bg-slate-100 rounded-3xl h-96 w-full" />;

  return (
    <div className="space-y-10 max-w-4xl">
      {/* DEBUG BUTTON */}
      <button
        onClick={async () => {
          if (!restaurant) return;
          const ordersRef = collection(db, 'restaurants', restaurant.id, 'orders');
          await addDoc(ordersRef, {
            status: "remaining",
            orderType: "Delivery",
            items: [{name: "Test Burger", price: 500, quantity: 1}],
            tableNumber: "T1",
            createdAt: new Date().toISOString(),
            restaurantId: restaurant.id
          });
          toast.success('Dummy order created!');
        }}
        className="w-full bg-red-600 text-white py-6 font-bold text-xl hover:bg-red-700 transition-all rounded-3xl shadow-lg"
      >
        DEBUG: CREATE DUMMY ORDER
      </button>
      {/* END DEBUG BUTTON */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="text-slate-500 mt-1 font-medium">Configure your restaurant's physical setup and digital presence.</p>
      </div>

      {/* Table Management */}
      <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold">Table Management</h3>
        </div>

        <div className="space-y-6">
          <div className="max-w-xs">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Number of Tables</label>
            <div className="flex gap-3">
              <input 
                type="number"
                min="0"
                max="100"
                className="flex-1 px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-lg"
                value={tableCount}
                onChange={e => setTableCount(parseInt(e.target.value) || 0)}
              />
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-slate-900 text-white px-6 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              Updating the table count will automatically generate unique QR codes for each table. 
              Customers scanning these codes will be automatically assigned to the specific table in the system.
            </p>
          </div>
        </div>
      </section>

      {/* AI Live Simulator */}
      {restaurant && tableCount > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold">AI Live Simulator</h3>
          </div>
          <AISimulator restaurant={restaurant} menu={menu} ingredients={ingredients} tableCount={tableCount} />
        </section>
      )}

      {/* QR Code Generator */}
      {tableCount > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <QrCode className="w-6 h-6 text-emerald-600" />
              Table QR Codes
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {Array.from({ length: tableCount }).map((_, i) => {
              const tableNum = i + 1;
              const chatUrl = `${window.location.origin}/chat/${restaurant?.id}?table=${tableNum}`;
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={tableNum}
                  className="bg-white border border-slate-100 rounded-3xl p-6 flex flex-col items-center text-center group hover:shadow-xl hover:shadow-slate-100 transition-all"
                >
                  <div className="bg-slate-50 p-4 rounded-2xl mb-4 group-hover:bg-white transition-colors">
                    <QRCodeSVG 
                      id={`qr-table-${tableNum}`}
                      value={chatUrl}
                      size={120}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">Table {tableNum}</h4>
                  
                  <div className="w-full mb-4">
                    <div className="relative">
                      <input 
                        type="text" 
                        readOnly 
                        value={chatUrl}
                        className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-mono text-slate-500 focus:ring-0"
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(chatUrl);
                          toast.success('URL copied!');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-900"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 w-full">
                    <button 
                      onClick={() => {
                        const svg = document.getElementById(`qr-table-${tableNum}`);
                        if (svg) {
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement("canvas");
                          const ctx = canvas.getContext("2d");
                          const img = new Image();
                          img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx?.drawImage(img, 0, 0);
                            const pngFile = canvas.toDataURL("image/png");
                            const downloadLink = document.createElement("a");
                            downloadLink.download = `Table-${tableNum}-QR.png`;
                            downloadLink.href = pngFile;
                            downloadLink.click();
                          };
                          img.src = "data:image/svg+xml;base64," + btoa(svgData);
                        }
                      }}
                      className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all font-bold text-xs flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download PNG
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
