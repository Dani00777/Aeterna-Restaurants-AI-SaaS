export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';
export type OrderStatus = 'remaining' | 'pending' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'completed';
export type StaffRole = 'Chef' | 'Rider';
export type UserRole = 'owner' | 'Chef' | 'Rider' | 'customer';

export interface Restaurant {
  id: string;
  name: string;
  ownerUid: string;
  phone: string;
  subscriptionPlan: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndDate: string;
  isApproved: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
  recipe?: { ingredientId: string; ingredientName: string; quantity: number; unit: string }[];
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  restaurantId: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
  orderType: 'Indoor' | 'Delivery';
  tableId?: string;
  tableNumber?: string | number;
  chatHistory: { role: 'user' | 'model'; text: string }[];
  createdAt: string;
  assignedChefId?: string;
  assignedRiderId?: string;
  prepTimeMinutes?: number;
  claimedBy?: string;
  claimedAt?: string;
  readyAt?: string;
  completedAt?: string;
  totalCompletionTimeMinutes?: number;
  urgentAlert?: string;
}

export interface StaffMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  receiverId: string; // 'all' or specific staffId/ownerUid
  threadId?: string; // For private chats: [id1, id2].sort().join('_')
  text: string;
  createdAt: string;
}

export interface Staff {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
  phone: string;
  experience: string;
  photo: string;
  currentLocation?: { lat: number; lng: number };
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantityInStock: number;
  unitPrice: number;
  lowStockThreshold: number;
}

export interface Recipe {
  id: string;
  menuItemId: string;
  ingredientId: string;
  quantityUsed: number;
}
