export type ReplenishmentStatus = 'pending' | 'completed';

export interface ReplenishmentItem {
  id: string;
  janCode: string;
  productName: string;
  quantity: string;
  unit: string;
  maker?: string;
  status: ReplenishmentStatus;
  imageUrl?: string;
  createdAt: any; // Firestore Timestamp
}

export type AppMode = 'menu' | 'scan' | 'view' | 'edit' | 'quick';
