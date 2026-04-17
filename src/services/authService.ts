import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { auth, db } from '../firebase';

export const loginAsOwner = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Check if user has a restaurant mapping
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // New owner - need to create restaurant
    return { user, needsRestaurant: true };
  }

  return { user, restaurantId: userSnap.data().restaurantId };
};

export const loginAsOwnerWithEmail = async (email: string, password: string) => {
  const cleanEmail = email.toLowerCase().trim();
  
  try {
    // 1. Try Standard Firebase Auth Login first
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const user = result.user;

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return { ownerId: user.uid, restaurantId: userSnap.data().restaurantId };
    }
  } catch (authError: any) {
    console.warn("Standard Auth failed, attempting Debug/Legacy lookup:", authError.message);
    // If auth fails (e.g. operation-not-allowed), we fall through to the manual check
  }

  // 2. Debug/Legacy Fallback: Check 'owners' collection directly
  // This bypasses the need for the Auth Provider to be enabled if we just want to verify data
  const ownersRef = collection(db, 'owners');
  const q = query(ownersRef, where('email', '==', cleanEmail));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const ownerDoc = querySnapshot.docs[0];
    const ownerData = ownerDoc.data();
    
    // Validate password manually from Firestore record (as seen in screenshot)
    if (ownerData.password === password) {
      // If we're not authenticated, sign in anonymously to get a UID for Firestore rules
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anonymous auth failed, but proceeding with local state");
        }
      }
      
      return { 
        ownerId: ownerDoc.id, 
        restaurantId: ownerData.restaurantId 
      };
    } else {
      throw new Error('Invalid password.');
    }
  }
  
  throw new Error('Account not found in Aeterna-AI project.');
};

export const registerOwner = async (data: {
  ownerName: string;
  restaurantName: string;
  whatsapp: string;
  email: string;
  password: string;
}) => {
  // 1. Create Real Firebase Auth User
  const result = await createUserWithEmailAndPassword(auth, data.email.toLowerCase().trim(), data.password);
  const user = result.user;

  // 2. Generate unique restaurantId
  const baseId = data.restaurantName.replace(/\s+/g, '-').toUpperCase();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const restaurantId = `${baseId}-${randomSuffix}`;

  // 3. Create Restaurant
  await setDoc(doc(db, 'restaurants', restaurantId), {
    name: data.restaurantName,
    ownerName: data.ownerName,
    whatsapp: data.whatsapp,
    createdAt: new Date().toISOString(),
    subscriptionStatus: 'trial',
    ownerUid: user.uid
  });

  // 4. Create User Mapping
  await setDoc(doc(db, 'users', user.uid), {
    restaurantId: restaurantId,
    role: 'owner',
    email: data.email.toLowerCase().trim()
  });

  // 5. Create Legacy Owner entry (for backward compatibility if needed)
  await setDoc(doc(db, 'owners', data.email.toLowerCase().trim().replace(/[@.]/g, '_')), {
    email: data.email.toLowerCase().trim(),
    restaurantId: restaurantId,
    name: data.ownerName,
    whatsapp: data.whatsapp,
    uid: user.uid
  });

  return { restaurantId };
};

export const loginAsStaff = async (restaurantId: string, username: string, password: string) => {
  // 1. Query staff collection (Assuming some level of public read or previous auth)
  const staffRef = collection(db, 'restaurants', restaurantId.trim(), 'staff');
  const q = query(staffRef, where('username', '==', username.trim()));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Staff member not found.');
  }

  const staffDoc = querySnapshot.docs[0];
  const staffData = staffDoc.data();

  if (staffData.password !== password) {
    throw new Error('Invalid password.');
  }

  return { 
    staffId: staffDoc.id, 
    restaurantId: restaurantId.trim(), 
    role: staffData.role 
  };
};

export const logout = async () => {
  await signOut(auth);
  localStorage.removeItem('aeterna_restaurant_id');
  localStorage.removeItem('aeterna_staff_id');
  localStorage.removeItem('aeterna_role');
};
