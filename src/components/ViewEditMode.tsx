import React, { useEffect, useState, useRef } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { 
  ArrowLeft, 
  Eye, 
  Edit3, 
  Package, 
  Clock, 
  Hash, 
  Check, 
  Trash2, 
  Edit2, 
  X, 
  Save, 
  Search, 
  Volume2, 
  VolumeX 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReplenishmentItem } from '../types';

interface ViewEditModeProps {
  initialTab: 'view' | 'edit';
  onBack: () => void;
}

export default function ViewEditMode({ initialTab, onBack }: ViewEditModeProps) {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>(initialTab);
  
  // Data states
  const [items, setItems] = useState<ReplenishmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Audio state & control for live updates
  const [audioMuted, setAudioMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevPendingCount = useRef<number>(0);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ productName: '', maker: '', quantity: '', unit: '', fulfilledQuantity: 0, subcategory: '通常' });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Clear modal/dropdown handles
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Bulk complete states
  const [isCompletingAll, setIsCompletingAll] = useState(false);
  const [showBulkCompleteConfirm, setShowBulkCompleteConfirm] = useState(false);

  // Search filter for requested list items section
  const [listSearchQuery, setListSearchQuery] = useState('');

  // Firestore Real-time subscriptions
  useEffect(() => {
    // 1. Subscription to all replenishment items (needed for Edit/View)
    const q1 = query(
      collection(db, 'replenishment_list'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const allItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReplenishmentItem[];

      // Calculate the number of pending items
      const pendingItems = allItems.filter(item => item.status === 'pending');
      
      // Chime notify if pending request count increases
      if (pendingItems.length > prevPendingCount.current && prevPendingCount.current !== 0 && !audioMuted) {
        audioRef.current?.play().catch(e => console.debug("Sound notification play failed", e));
      }

      prevPendingCount.current = pendingItems.length;
      setItems(allItems);
      setIsLoading(false);
    }, (error) => {
      console.error("Replenishment fetch failed", error);
    });

    return () => {
      unsubscribe1();
    };
  }, [audioMuted]);

  // Format creation datetime 
  const formatTime = (ts: Timestamp) => {
    if (!ts) return '';
    const date = ts.toDate();
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: Timestamp) => {
    if (!ts) return '';
    const date = ts.toDate();
    return `${date.getMonth() + 1}/${date.getDate()} ${date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Switch status pending <-> completed
  async function toggleStatus(item: ReplenishmentItem) {
    const newStatus = item.status === 'pending' ? 'completed' : 'pending';
    const targetQuantity = parseInt(item.quantity) || 0;
    const updates: any = { status: newStatus };
    if (newStatus === 'completed') {
      updates.fulfilledQuantity = targetQuantity;
    } else {
      if ((item.fulfilledQuantity || 0) >= targetQuantity) {
        updates.fulfilledQuantity = 0;
      }
    }

    try {
      await updateDoc(doc(db, 'replenishment_list', item.id), updates);
    } catch (err) {
      console.error("Update status failed", err);
    }
  }

  // 対応数（実績値）の増減処理
  async function updateFulfilledQuantity(item: ReplenishmentItem, delta: number) {
    const currentFulfilled = item.fulfilledQuantity || 0;
    const targetQuantity = parseInt(item.quantity) || 0;
    const newFulfilled = Math.max(0, currentFulfilled + delta);
    
    let newStatus = item.status;
    if (newFulfilled >= targetQuantity && targetQuantity > 0) {
      newStatus = 'completed';
    } else if (newFulfilled < targetQuantity && item.status === 'completed') {
      newStatus = 'pending';
    }

    try {
      await updateDoc(doc(db, 'replenishment_list', item.id), {
        fulfilledQuantity: newFulfilled,
        status: newStatus
      });
    } catch (err) {
      console.error("Update fulfilled quantity failed", err);
    }
  }

  // Delete specific target document
  async function deleteItem(id: string, coll = 'replenishment_list') {
    try {
      await deleteDoc(doc(db, coll, id));
      setDeletingId(null);
    } catch (err) {
      console.error("Delete failed", err);
      alert("削除に失敗しました");
      setDeletingId(null);
    }
  }

  // Batch delete system (only replenishment list)
  async function clearAll(onlyCompleted = false) {
    setIsClearingAll(true);
    try {
      const snapshot = await getDocs(collection(db, 'replenishment_list'));
      const batch = writeBatch(db);
      
      let count = 0;
      snapshot.docs.forEach((doc) => {
        const item = doc.data() as ReplenishmentItem;
        if (!onlyCompleted || item.status === 'completed') {
          batch.delete(doc.ref);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
      }
      setShowClearConfirm(false);
    } catch (err) {
      console.error("Clear all operation failed", err);
      alert("一括削除に失敗しました");
    } finally {
      setIsClearingAll(false);
    }
  }

  // 一括で補充済みにする（未完了のものを完了ステータスに変更）
  async function bulkCompleteAll() {
    setIsCompletingAll(true);
    try {
      const pendingItems = items.filter(item => item.status === 'pending');
      if (pendingItems.length === 0) {
        alert("未対応の補充依頼はありません");
        setShowBulkCompleteConfirm(false);
        return;
      }

      const batch = writeBatch(db);
      pendingItems.forEach((item) => {
        const docRef = doc(db, 'replenishment_list', item.id);
        const qty = parseInt(item.quantity) || 0;
        batch.update(docRef, { 
          status: 'completed',
          fulfilledQuantity: qty
        });
      });

      await batch.commit();
      setShowBulkCompleteConfirm(false);
    } catch (err) {
      console.error("Bulk complete operation failed", err);
      alert("一括完了に失敗しました");
    } finally {
      setIsCompletingAll(false);
    }
  }

  // Start inline edit context for active request
  function startEdit(item: ReplenishmentItem) {
    setEditingId(item.id);
    setEditValue({ 
      productName: item.productName, 
      maker: item.maker || '',
      quantity: item.quantity,
      unit: item.unit || '個',
      fulfilledQuantity: item.fulfilledQuantity || 0,
      subcategory: item.subcategory || '通常'
    });
  }

  // Persist inline edits to Firestore
  async function saveEdit() {
    if (!editingId) return;
    const { productName, maker, quantity, unit, fulfilledQuantity, subcategory } = editValue;
    
    try {
      if (!productName.trim() || !quantity.trim()) {
        alert("商品名と数量を入力してください");
        return;
      }

      const targetQuantity = parseInt(quantity) || 0;
      const itemToEdit = items.find(i => i.id === editingId);
      let newStatus = itemToEdit ? itemToEdit.status : 'pending';
      if (fulfilledQuantity >= targetQuantity && targetQuantity > 0) {
        newStatus = 'completed';
      } else if (fulfilledQuantity < targetQuantity && newStatus === 'completed') {
        newStatus = 'pending';
      }

      const docRef = doc(db, 'replenishment_list', editingId);
      await updateDoc(docRef, {
        productName: productName.trim(),
        maker: maker.trim() || null,
        quantity: quantity.trim(),
        unit: unit || '個',
        fulfilledQuantity: fulfilledQuantity,
        subcategory: subcategory || '通常',
        status: newStatus
      });
      setEditingId(null);
    } catch (err) {
      console.error("Save edit failing", err);
      alert("保存に失敗しました。しばらく経ってから再度お試しください。");
    }
  }

  // Filter datasets based on status and search queries
  const activePendingItems = items.filter(item => item.status === 'pending');
  
  const filteredReplenishmentList = items.filter(item => {
    if (!listSearchQuery.trim()) return true;
    const q = listSearchQuery.toLowerCase();
    return (
      item.productName.toLowerCase().includes(q) ||
      (item.maker && item.maker.toLowerCase().includes(q)) ||
      (item.janCode && item.janCode.includes(q))
    );
  });

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-gray-950 text-white select-none overflow-hidden pb-safe">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      
      {/* Header Bar */}
      <header className="px-4 py-3.5 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between shrink-0 sticky top-0 z-20 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="w-10 h-10 bg-gray-800 hover:bg-gray-700 hover:text-white rounded-xl flex items-center justify-center transition-all select-none active:scale-95"
            id="back-btn"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="text-left">
            <h1 className="text-base font-black tracking-tight leading-none text-white">補充確認センター</h1>
            <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wider leading-none">
              Control & Verification Board
            </p>
          </div>
        </div>

        {/* Sync Indicator & Controls */}
        <div className="flex items-center gap-2">
          {activeTab === 'view' && (
            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors mr-1"
              title={audioMuted ? "通知音をオン" : "通知音をオフ"}
            >
              {audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-blue-400" />}
            </button>
          )}

          {/* Sync Pulsing Badge */}
          <div className="hidden xs:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-500/10">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
            Syncing
          </div>

          {/* Contextual batch actions (Edit tab only) */}
          {activeTab === 'edit' && (
            <div className="flex items-center gap-2">
              {items.some(item => item.status === 'pending') && (
                <button
                  onClick={() => setShowBulkCompleteConfirm(true)}
                  className="h-10 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/25 rounded-xl flex items-center gap-1.5 text-xs font-black transition-all active:scale-95"
                  title="一括補充完了"
                >
                  <Check size={14} strokeWidth={2.5} />
                  一括完了
                </button>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowClearConfirm(!showClearConfirm)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    showClearConfirm 
                      ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' 
                      : 'bg-gray-800 hover:bg-red-950/20 text-gray-400 hover:text-red-400'
                  }`}
                  title="一括操作"
                >
                  <Trash2 size={18} />
                </button>
                
                <AnimatePresence>
                  {showClearConfirm && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2.5 w-52 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800/80 p-2 z-30"
                    >
                      <p className="text-[9px] text-gray-500 font-black px-3 py-1.5 uppercase tracking-wider">一括削除メニュー</p>
                      
                      <button
                        onClick={() => clearAll(true)}
                        disabled={isClearingAll}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-800 text-gray-300 rounded-xl text-xs font-black flex items-center justify-between"
                      >
                        完了分のみ全削除
                        <Check size={13} className="text-emerald-500" />
                      </button>
                      
                      <button
                        onClick={() => clearAll(false)}
                        disabled={isClearingAll}
                        className="w-full text-left px-3 py-2.5 hover:bg-red-950/30 text-red-400 rounded-xl text-xs font-black flex items-center justify-between"
                      >
                        すべて強制削除
                        <Trash2 size={13} />
                      </button>
                      
                      <div className="h-px bg-gray-800 my-1"></div>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="w-full text-center py-2 text-gray-500 text-[10px] font-bold hover:text-gray-300"
                      >
                        閉じる
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mode Switches (Segment Control tabs) */}
      <div className="px-4 py-2.5 bg-gray-900 border-b border-gray-800/60 shrink-0">
        <div className="flex bg-gray-950 p-1 rounded-2xl max-w-lg mx-auto w-full border border-gray-800/30">
          <button
            onClick={() => {
              setActiveTab('view');
            }}
            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'view' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Eye size={14} />
            状況確認 ({activePendingItems.length})
          </button>
          
          <button
            onClick={() => {
              setActiveTab('edit');
              setListSearchQuery('');
            }}
            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'edit' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Edit3 size={14} />
            リスト編集
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-28">
        
        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 mt-12 text-gray-500">
            <div className="w-10 h-10 border-4 border-blue-500/15 border-t-blue-500 rounded-full animate-spin mb-3"></div>
            <p className="text-xs font-black">データを更新中...</p>
          </div>
        ) : (
          <>
            {/* ----------------- TAB 1: VIEW (REAL-TIME STATUS WATCHER + STANDARD MASTER CATALOG) ----------------- */}
            {activeTab === 'view' && (
              <div className="space-y-8 max-w-6xl mx-auto">
                {/* 1. Situation Confirmation: Pending Replenishments */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-black text-gray-400 flex items-center gap-1.5 uppercase tracking-wider pl-1">
                      <Clock size={14} className="text-emerald-400" />
                      現在の補充依頼 ({activePendingItems.length}件)
                    </h2>
                  </div>

                  {activePendingItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-gray-900/30 rounded-[32px] border border-gray-800/50 text-gray-500 max-w-xl mx-auto shadow-inner">
                      <Package size={52} strokeWidth={1.2} className="mb-3 text-gray-600/75" />
                      <h3 className="text-sm font-black text-gray-400">補充依頼はありません</h3>
                      <p className="text-[10px] text-gray-500 mt-1 max-w-xs leading-relaxed text-center px-4">
                        現在依頼中の在庫補充リクエストはありません。新しい補充が送信されるとリアルタイムに通知音と共に追加されます。
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence initial={false}>
                        {activePendingItems.map((item) => (
                          <motion.div
                            key={item.id}
                            layout="position"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="group relative bg-gray-900 rounded-2xl aspect-[16/9] xs:aspect-auto xs:h-36 sm:h-38 lg:h-40 overflow-hidden border border-gray-800/60 shadow-2xl flex flex-col"
                          >
                            {/* Background product image container */}
                            {item.imageUrl ? (
                              <img 
                                src={item.imageUrl} 
                                alt={item.productName} 
                                className="absolute inset-0 w-full h-full object-contain p-3 bg-white transition-all duration-700 group-hover:scale-105 animate-fade-in" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-700">
                                <Package size={36} strokeWidth={1} className="opacity-30" />
                              </div>
                            )}

                            {/* Linear Gradient dimming on top of the image to keep text legible */}
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent"></div>

                            {/* Content overlay tags and values */}
                            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5 z-10 text-left">
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mb-1">
                                <Hash size={11} className="text-blue-400" /> {item.janCode}
                                <span className="opacity-20">|</span>
                                <Clock size={11} className="text-gray-500" /> {formatTime(item.createdAt)}
                              </div>
                              
                              <h3 className="text-xs sm:text-sm font-black text-white leading-tight mb-1.5 drop-shadow-md truncate">
                                {item.productName}
                              </h3>
                              
                              <div className="flex items-end justify-between gap-2.5">
                                <div className="flex-1 min-w-0">
                                  {item.maker && (
                                    <span className="inline-block mb-1 mr-1 px-1.5 py-0.5 bg-white/10 backdrop-blur-md text-white text-[9px] font-black rounded-md border border-white/25 uppercase tracking-wider truncate max-w-full">
                                      {item.maker}
                                    </span>
                                  )}
                                  <span className={`inline-block mb-1 px-1.5 py-0.5 text-[9px] font-black rounded-md border uppercase tracking-wider truncate max-w-full ${
                                    item.subcategory === '客注' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                                    item.subcategory === '催事' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                    item.subcategory === 'エンド' ? 'bg-purple-500/25 text-purple-300 border-purple-500/30 font-black' :
                                    item.subcategory === 'その他' ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60' :
                                    'bg-blue-500/20 text-blue-350 border-blue-500/30'
                                  }`}>
                                    {item.subcategory || '通常'}
                                  </span>
                                  {/* リアルタイム補充進捗 */}
                                  <div className="text-[10px] font-bold text-emerald-400 drop-shadow flex items-center gap-1.5 mt-0.5">
                                    <span>対応: {item.fulfilledQuantity || 0}</span>
                                    <span className="opacity-35">|</span>
                                    <span className="text-orange-300">残り: {Math.max(0, (parseInt(item.quantity) || 0) - (item.fulfilledQuantity || 0))}</span>
                                  </div>
                                </div>
                                <div className="px-2.5 py-1 bg-blue-600 text-white rounded-lg shadow-[0_0_12px_rgba(37,99,235,0.3)] font-black text-base shrink-0 flex items-baseline">
                                  {item.quantity}
                                  <span className="text-[10px] ml-0.5 opacity-80">{item.unit || '個'}</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>


              </div>
            )}

            {/* ----------------- TAB 2: EDIT (ACTIVE & COMPLETED ITEMS MANAGER) ----------------- */}
            {activeTab === 'edit' && (
              <div className="max-w-3xl mx-auto space-y-4">
                {/* Search / Filter input */}
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-3 text-gray-500" />
                  <input
                    type="text"
                    placeholder="補充リスト内から商品を検索"
                    value={listSearchQuery}
                    onChange={(e) => setListSearchQuery(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-2xl pl-10 pr-10 py-2.5 text-[16px] md:text-xs font-bold text-left outline-none placeholder-gray-500 focus:bg-gray-900 focus:border-blue-500 transition-all text-white"
                  />
                  {listSearchQuery && (
                    <button onClick={() => setListSearchQuery('')} className="absolute right-4 top-3 text-gray-500 hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {items.some(item => item.status === 'pending') && (
                  <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setShowBulkCompleteConfirm(true)}
                    className="w-full py-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition-all active:scale-[0.99] shadow-sm select-none"
                    id="bulk-complete-btn"
                  >
                    <Check size={14} strokeWidth={2.5} />
                    未完了の全 {items.filter(i => i.status === 'pending').length} 件を一括で補充済みにする
                  </motion.button>
                )}

                {filteredReplenishmentList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-gray-900/20 rounded-3xl border border-gray-800/40 text-gray-500">
                    <X size={40} className="mb-2 opacity-30" />
                    <p className="text-xs font-bold text-gray-400">該当する商品は見つかりませんでした</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {filteredReplenishmentList.map((item) => (
                        <motion.div
                          key={item.id}
                          layout="position"
                          className={`relative rounded-2xl overflow-hidden shadow-md border transition-all ${
                            item.status === 'completed' 
                              ? 'bg-gray-950/60 border-gray-900/50 opacity-40 grayscale' 
                              : 'bg-gray-900 border-gray-800/80 hover:border-gray-700/80'
                          }`}
                        >
                          {/* Mini blur-image placeholder back of card */}
                          {item.imageUrl && (
                            <div className="absolute inset-0 z-0">
                              <img src={item.imageUrl} alt="" className="w-full h-full object-contain bg-white p-4 opacity-10" />
                              <div className="absolute inset-0 bg-gray-950/70"></div>
                            </div>
                          )}

                          <div className="relative z-10 p-3 sm:p-3.5 text-left">
                            {editingId === item.id ? (
                              <div className="space-y-3">
                                <div className="text-[10px] text-gray-500 font-black pl-1">商品情報を編集しています</div>
                                <input
                                  type="text"
                                  value={editValue.maker}
                                  onChange={(e) => setEditValue({ ...editValue, maker: e.target.value })}
                                  className="w-full px-4 py-2 bg-gray-950 border border-gray-800 text-white rounded-xl focus:border-blue-500 outline-none font-bold text-[16px] md:text-xs"
                                  placeholder="メーカー名 (任意)"
                                />
                                <input
                                  type="text"
                                  value={editValue.productName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const spaceMatch = val.match(/[\s　]/);
                                    if (spaceMatch && spaceMatch.index !== undefined && !editValue.maker) {
                                      const newMaker = val.substring(0, spaceMatch.index).trim();
                                      const newName = val.substring(spaceMatch.index + 1).trim();
                                      setEditValue({ ...editValue, maker: newMaker, productName: newName });
                                    } else {
                                      setEditValue({ ...editValue, productName: val });
                                    }
                                  }}
                                  className="w-full px-4 py-3 bg-gray-950 border border-gray-800 text-white rounded-xl focus:border-blue-500 outline-none font-bold text-[16px] md:text-sm"
                                  placeholder="商品名"
                                />
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-[9px] text-gray-500 font-bold mb-1 pl-1">依頼数量</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={editValue.quantity}
                                      onChange={(e) => {
                                        const numericVal = e.target.value.replace(/[^0-9]/g, '');
                                        setEditValue({ ...editValue, quantity: numericVal });
                                      }}
                                      className="w-full px-3 py-2 bg-gray-950 border border-gray-850 text-white rounded-xl focus:border-blue-500 outline-none font-bold text-[16px] md:text-xs"
                                      placeholder="依頼数"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-gray-500 font-bold mb-1 pl-1">現対応数</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={editValue.fulfilledQuantity}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                                        setEditValue({ ...editValue, fulfilledQuantity: val });
                                      }}
                                      className="w-full px-3 py-2 bg-gray-950 border border-gray-850 text-white rounded-xl focus:border-blue-500 outline-none font-bold text-[16px] md:text-xs"
                                      placeholder="対応数"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-gray-500 font-bold mb-1 pl-1">単位</label>
                                    <select
                                      value={editValue.unit}
                                      onChange={(e) => setEditValue({ ...editValue, unit: e.target.value })}
                                      className="w-full px-3 py-2 bg-gray-950 border border-gray-850 text-white rounded-xl focus:border-blue-500 outline-none font-bold appearance-none text-[16px] md:text-xs cursor-pointer"
                                    >
                                      <option value="個">個</option>
                                      <option value="ケース">ケース</option>
                                      <option value="点">点</option>
                                      <option value="箱">箱</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[9px] text-gray-500 font-bold mb-1 pl-1">売場サブカテゴリ</label>
                                  <div className="flex bg-gray-950 border border-gray-850 p-1 rounded-xl gap-1 overflow-x-auto scrollbar-none">
                                    {['通常', '催事', 'エンド', '客注', 'その他'].map((s) => (
                                      <button
                                        key={s}
                                        type="button"
                                        onClick={() => setEditValue({ ...editValue, subcategory: s })}
                                        className={`flex-1 min-w-[3.2rem] py-1.5 text-[11px] font-black rounded-lg transition-all ${
                                          editValue.subcategory === s 
                                            ? 'bg-blue-600 text-white' 
                                            : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                      >
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-1.5">
                                  <button onClick={saveEdit} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-1.5 font-black shadow-lg shadow-blue-500/10 text-xs">
                                    <Save size={14} /> 反映する
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="flex-1 py-2.5 bg-gray-800 text-gray-400 rounded-xl font-bold text-xs">
                                    キャンセル
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                      item.status === 'completed' ? 'bg-gray-800 text-gray-500 border border-gray-700/30' : 'bg-blue-600 text-white'
                                    }`}>
                                      {item.status === 'completed' ? '完了' : '未対応'}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-mono tracking-tight font-bold">{item.janCode}</span>
                                    <span className="text-[10px] text-gray-500 ml-auto font-mono">{formatDate(item.createdAt)}</span>
                                  </div>
                                  
                                  <h3 className={`text-xs sm:text-sm font-black leading-tight mb-2 truncate ${item.status === 'completed' ? 'line-through text-gray-600' : 'text-gray-100'}`}>
                                    {item.productName}
                                  </h3>
                                  
                                  <div className="flex flex-wrap items-center justify-between gap-3 mt-1.5 pt-2 border-t border-gray-800/40">
                                    <div className="flex-1 min-w-0">
                                      {item.maker && (
                                        <span className="inline-block px-1.5 py-0.5 bg-gray-800/80 text-gray-400 text-[9px] font-medium rounded-md truncate max-w-full mb-1 mr-1">
                                          {item.maker}
                                        </span>
                                      )}
                                      <span className={`inline-block px-1.5 py-0.5 text-[9px] font-black rounded-md border uppercase tracking-wider truncate max-w-full mb-1 ${
                                        item.subcategory === '客注' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                                        item.subcategory === '催事' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                        item.subcategory === 'エンド' ? 'bg-purple-500/25 text-purple-300 border-purple-500/30 font-black' :
                                        item.subcategory === 'その他' ? 'bg-zinc-800/85 text-zinc-400 border-zinc-700' :
                                        'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                      }`}>
                                        {item.subcategory || '通常'}
                                      </span>
                                      
                                      {/* リアルタイム補充状況 (対応数/依頼数、残数) */}
                                      <div className="text-xs font-bold text-gray-400 flex flex-col gap-0.5 justify-center">
                                        <div className="flex items-center gap-1 leading-none">
                                          <span>補充:</span>
                                          <strong className="text-emerald-400 font-extrabold">{item.fulfilledQuantity || 0}</strong>
                                          <span className="text-gray-500">/</span>
                                          <span>{item.quantity}{item.unit || '個'}</span>
                                        </div>
                                        
                                        {Math.max(0, (parseInt(item.quantity) || 0) - (item.fulfilledQuantity || 0)) > 0 ? (
                                          <div className="text-[10px] font-black tracking-wider text-orange-400 leading-none mt-1">
                                            あと {Math.max(0, (parseInt(item.quantity) || 0) - (item.fulfilledQuantity || 0))}{item.unit || '個'} 不足
                                          </div>
                                        ) : (
                                          <div className="text-[10px] font-black tracking-wider text-emerald-400 flex items-center gap-1 leading-none mt-1">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                            補充完了
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* 対応数の増減コントローラー */}
                                    <div className="flex items-center bg-gray-950 border border-gray-850 rounded-xl p-1 shrink-0 shadow-inner select-none">
                                      <button
                                        onClick={() => updateFulfilledQuantity(item, -1)}
                                        disabled={!(item.fulfilledQuantity && item.fulfilledQuantity > 0)}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors text-sm font-black ${
                                          (item.fulfilledQuantity && item.fulfilledQuantity > 0)
                                            ? 'bg-gray-855 hover:bg-gray-805 active:bg-gray-750 text-gray-300'
                                            : 'text-gray-700 cursor-not-allowed'
                                        }`}
                                        title="-1"
                                      >
                                        ー
                                      </button>
                                      
                                      <div className="px-2 text-center min-w-[2.2rem]">
                                        <div className="text-[7px] text-gray-500 font-bold leading-none mb-0.5 uppercase tracking-wider">実績</div>
                                        <div className="text-xs font-black text-gray-200 leading-none">
                                          {item.fulfilledQuantity || 0}
                                        </div>
                                      </div>
                                      
                                      <button
                                        onClick={() => updateFulfilledQuantity(item, 1)}
                                        disabled={item.status === 'completed'}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors text-sm font-black ${
                                          item.status === 'completed'
                                            ? 'text-gray-750 cursor-not-allowed'
                                            : 'bg-gray-855 hover:bg-gray-805 active:bg-gray-750 text-gray-300 hover:text-white'
                                        }`}
                                        title="+1"
                                      >
                                        ＋
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Controls actions col */}
                                <div className="flex items-center gap-1.5 shrink-0 select-none">
                                  {/* Toggle completed button */}
                                  <button
                                    onClick={() => toggleStatus(item)}
                                    className={`p-2.5 sm:p-3 rounded-xl transition-all shadow-md ${
                                      item.status === 'completed' 
                                        ? 'bg-gray-800 text-gray-600 border border-gray-700/20' 
                                        : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/10 hover:scale-105 active:scale-95'
                                    }`}
                                    title={item.status === 'completed' ? '未完了に戻す' : '完了にする'}
                                  >
                                    <Check size={16} strokeWidth={3} />
                                  </button>

                                  <div className="flex flex-col gap-1">
                                    {/* Inline Edit form launcher */}
                                    <button
                                      onClick={() => startEdit(item)}
                                      className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                                      title="編集"
                                    >
                                      <Edit2 size={13} />
                                    </button>

                                    {/* Safety Guard styled delete */}
                                    <button
                                      onClick={() => {
                                        if (deletingId === item.id) {
                                          deleteItem(item.id);
                                        } else {
                                          setDeletingId(item.id);
                                          setTimeout(() => setDeletingId(null), 3000);
                                        }
                                      }}
                                      className={`p-2 transition-all rounded-xl ${
                                        deletingId === item.id 
                                          ? 'bg-red-600 text-white scale-110' 
                                          : 'text-gray-500 hover:text-red-400'
                                      }`}
                                      title="削除"
                                    >
                                      {deletingId === item.id ? <Trash2 size={13} className="animate-pulse" /> : <Trash2 size={13} />}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* 一括完了確認モーダル */}
      <AnimatePresence>
        {showBulkCompleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with elegant blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isCompletingAll && setShowBulkCompleteConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-sm bg-gray-900 border border-gray-800/80 rounded-3xl p-6 shadow-2xl z-10 text-center"
            >
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <Check size={24} strokeWidth={3} />
              </div>
              
              <h3 className="text-base font-black text-white mb-2">一括で補充済みにしますか？</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                未対応の補充依頼（全 {items.filter(i => i.status === 'pending').length} 件）を一括で補充済みにアップデートします。
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkCompleteConfirm(false)}
                  disabled={isCompletingAll}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-2xl text-xs font-black transition-colors"
                >
                  キャンセル
                </button>
                
                <button
                  onClick={bulkCompleteAll}
                  disabled={isCompletingAll}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {isCompletingAll ? '処理中...' : 'はい、補充済みにする'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
