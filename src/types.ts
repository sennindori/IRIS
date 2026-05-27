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
  fulfilledQuantity?: number; // 対応数 (実績値)
  subcategory?: string; // サブカテゴリ (売場 - 通常, 催事, エンド, その他)
}

export interface ProductMasterItem {
  id: string;
  janCode: string;
  productName: string;
  maker?: string;
  size?: string;
  remarks?: string;
  unit?: string;
  createdAt: any;
}

export type AppMode = 'menu' | 'scan' | 'view' | 'edit' | 'quick' | 'bbs' | 'master';

export interface BbsReply {
  id: string;
  author: string;
  content: string;
  createdAt: any; // Firestore Timestamp
}

export interface BbsMessage {
  id: string;
  author: string;
  content: string;
  category: 'notice' | 'handover' | 'chat' | 'urgent';
  createdAt: any; // Firestore Timestamp
  likesCount: number;
  likedBy: string[]; // List of names who liked this post
  replyCount?: number;
  readBy?: string[]; // List of names who read this post
}

