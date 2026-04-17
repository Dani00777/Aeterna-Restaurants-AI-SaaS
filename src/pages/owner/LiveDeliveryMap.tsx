import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../App';
import { Staff } from '../../types';
import { MapPin } from 'lucide-react';

export default function LiveDeliveryMap() {
  const { restaurant } = useAuth();
  const [riders, setRiders] = useState<Staff[]>([]);

  useEffect(() => {
    if (!restaurant) return;

    const staffColRef = collection(db, 'restaurants', restaurant.id, 'staff');
    const q = query(staffColRef, where('role', '==', 'Rider'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setRiders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });

    return () => unsubscribe();
  }, [restaurant]);

  if (!restaurant) return null;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-emerald-600" />
        Live Delivery Map
      </h2>
      <div className="h-64 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-bold">
        {riders.length > 0 ? (
          <div className="text-center">
            <p>Active Riders: {riders.length}</p>
            <p className="text-xs">Map visualization would be here</p>
          </div>
        ) : (
          <p>No active riders</p>
        )}
      </div>
    </div>
  );
}
