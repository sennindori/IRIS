import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Minus, 
  Check, 
  Loader2, 
  TrendingUp, 
  Star, 
  Building,
  GripVertical,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { ProductMasterItem } from '../types';

const MASTER_GENRES = [
  '水・炭酸水',
  '茶系飲料',
  'ジュース',
  '紅茶・コーヒー',
  '健康飲料',
  'エナジー飲料',
  'その他'
];

interface QuickModeProps {
  onBack: () => void;
}

export default function QuickMode({ onBack }: QuickModeProps) {
  const [search, setSearch] = useState('');
  const [standardItems, setStandardItems] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<ProductMasterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // App states
  const [isReorderingMode, setIsReorderingMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedGenre, setDraggedGenre] = useState<string | null>(null);
  const touchStartY = useRef<number>(0);
  const touchStartIndex = useRef<number | null>(null);
  const [collapsedGenres, setCollapsedGenres] = useState<Record<string, boolean>>({});
  
  // Order parameters
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('ケース');
  const [subcategory, setSubcategory] = useState('通常');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Subscribe to standard items list
  useEffect(() => {
    const qStds = query(collection(db, 'standard_items'));
    const unsubscribeStds = onSnapshot(qStds, (snapshot) => {
      const items = snapshot.docs
        .filter(doc => !doc.data().isDeleted)
        .map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          maker: doc.data().maker || '',
          janCode: doc.data().janCode || '',
          sortOrder: typeof doc.data().sortOrder === 'number' ? doc.data().sortOrder : 999999,
          createdAt: doc.data().createdAt
        }));
      setStandardItems(items);
    }, (error) => {
      console.error("Failed to load standard items:", error);
    });

    const qMaster = query(collection(db, 'product_master'));
    const unsubscribeMaster = onSnapshot(qMaster, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProductMasterItem[];
      setMasterItems(items);
      setIsLoading(false);
    }, (error) => {
      console.error("Failed to load product master items:", error);
      setIsLoading(false);
    });

    return () => {
      unsubscribeStds();
      unsubscribeMaster();
    };
  }, []);

  // Merge standard_items with their latest configurations from product_master
  // AND FILTER OUT items that do not exist in the product_master (completely synchronize with master database)
  const mergedItems = standardItems
    .map(std => {
      const master = masterItems.find(m => m.janCode === std.janCode);
      if (!master) return null;
      return {
        ...std,
        // Prefer fields from the master database since they are single source of truth
        displayName: master.productName,
        maker: master.maker || '',
        size: master.size || '',
        unit: master.unit || '個',
        remarks: master.remarks || '',
        genre: master.genre || 'その他'
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Sort items based on custom sortOrder, with fallback to createdAt timestamp
  const sortedItems = [...mergedItems].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return timeA - timeB;
  });

  // Filter sorted items by search input
  const filteredItems = sortedItems.filter(item => {
    const term = search.toLowerCase();
    return (
      item.displayName.toLowerCase().includes(term) ||
      item.maker.toLowerCase().includes(term) ||
      item.janCode.includes(term) ||
      item.size.toLowerCase().includes(term)
    );
  });

  // Drag and Drop & Touch Sorting Handlers
  const handleDragStart = (genre: string, index: number) => {
    setDraggedGenre(genre);
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow drop functionality
  };

  const handleDragEnter = (genre: string, index: number) => {
    if (draggedGenre === null || draggedGenre !== genre || draggedIndex === null || draggedIndex === index) return;

    // Get all items in the current active genre from the current sortedItems
    const genreItems = sortedItems.filter(item => (item.genre || 'その他') === genre);
    const draggedItem = genreItems[draggedIndex];

    if (!draggedItem) return;

    // Rearrange item position inside subarray
    genreItems.splice(draggedIndex, 1);
    genreItems.splice(index, 0, draggedItem);

    // Reconstruct the new flat list with stable sequential sortOrders per genre
    const newFlatList: any[] = [];
    let globalCounter = 0;
    
    MASTER_GENRES.forEach((g) => {
      const itemsOfGenre = g === genre
        ? genreItems
        : sortedItems.filter(item => (item.genre || 'その他') === g);
        
      itemsOfGenre.forEach((item) => {
        newFlatList.push({
          ...item,
          sortOrder: globalCounter++
        });
      });
    });

    // Optimistically update standardItems order state for smooth layout animation
    setStandardItems(newFlatList);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    setDraggedGenre(null);
    try {
      // Re-index all active items in standard_items on Firestore to store stable, non-temporary indexes
      const promises = sortedItems.map((item, idx) => 
        updateDoc(doc(db, 'standard_items', item.id), {
          sortOrder: idx
        })
      );
      await Promise.all(promises);
    } catch (err) {
      console.error("Firestore reorder failed:", err);
    }
  };

  const handleTouchStart = (genre: string, index: number, e: React.TouchEvent) => {
    if (!isReorderingMode) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartIndex.current = index;
    setDraggedGenre(genre);
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isReorderingMode || touchStartIndex.current === null || !draggedGenre) return;
    const currentY = e.touches[0].clientY;

    // Retrieve active element under finger positioning dynamically
    const element = document.elementFromPoint(e.touches[0].clientX, currentY);
    if (!element) return;

    // Search for a list item container with data-genre-idx attribute
    const itemContainer = element.closest('[data-genre-idx]');
    if (itemContainer) {
      const targetGenre = itemContainer.getAttribute('data-genre');
      const targetIndex = parseInt(itemContainer.getAttribute('data-genre-idx') || '', 10);
      if (targetGenre === draggedGenre && !isNaN(targetIndex) && targetIndex !== draggedIndex && draggedIndex !== null) {
        handleDragEnter(draggedGenre, targetIndex);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isReorderingMode) return;
    touchStartIndex.current = null;
    handleDragEnd();
  };

  // Open item sheet/modal for replenishment
  const handleSelectItem = (item: any) => {
    setSelectedItem(item);
    setQuantity(1);
    setUnit(item.unit || '個');
    setSubcategory('通常');
  };

  // Add item to replenishment list
  const handlePostRequest = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'replenishment_list'), {
        janCode: selectedItem.janCode,
        productName: selectedItem.displayName,
        maker: selectedItem.maker || null,
        quantity: String(quantity),
        unit: unit,
        subcategory: subcategory,
        imageUrl: null,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedItem(null);
      }, 1200);
    } catch (err) {
      console.error("Replenishment request failed:", err);
      alert("補充依頼の送信に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-gray-50 overflow-hidden pb-safe">
      
      {/* HEADER */}
      <header className="p-4 bg-white border-b border-gray-100 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95">
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
          <div className="text-left">
            <h2 className="text-sm font-black text-gray-900 leading-none">STD (定番) 補充発注</h2>
            <p className="text-[9px] text-gray-400 font-bold mt-1 leading-none uppercase tracking-wider">
              Standard Replenishment Mode
            </p>
          </div>
        </div>

        {/* Mode Toggle Button */}
        <button
          onClick={() => setIsReorderingMode(!isReorderingMode)}
          className={`px-4 py-2 rounded-full text-[10px] font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95 truncate cursor-pointer ${
            isReorderingMode
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-200'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          title={isReorderingMode ? "通常発注モードへ戻る" : "定番アイテムを並べ替える"}
        >
          <TrendingUp size={12} strokeWidth={3} className={isReorderingMode ? "animate-pulse" : ""} />
          {isReorderingMode ? '発注モードへ' : '並べ替え'}
        </button>
      </header>

      {/* CONTENT REGION */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
        
        {/* INFO NOTICE */}
        <div className="bg-amber-50/50 border-b border-amber-100/50 p-2.5 px-4 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-bold text-amber-800 leading-relaxed">
            <Star size={11} className="text-amber-500 fill-amber-500 shrink-0" />
            <span>
              {isReorderingMode 
                ? "【並べ替え中】商品カードをドラッグして、または指で上下にスライドして任意の並び順に変更できます。" 
                : "よく使われる定番登録(STD)商品の一覧です。タップして補充依頼を送信できます。"}
            </span>
          </div>
        </div>

        {/* SEARCH BAR (hidden in reorder mode for clarity, or available) */}
        {!isReorderingMode && (
          <div className="p-3 bg-white border-b border-gray-100 shrink-0">
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="定番リスト内から商品名やメーカーを検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-2xl shadow-inner outline-none font-bold text-xs text-gray-800 transition-all placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {/* ITEMS LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 pb-24">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Loader2 className="animate-spin text-amber-500" size={24} />
              <span className="text-xs font-bold font-sans">製品をロード中...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-12 h-12 bg-gray-200/55 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <Star size={20} className="stroke-[2.5]" />
              </div>
              <p className="text-xs font-bold text-gray-400 max-w-xs mx-auto leading-relaxed">
                {search 
                  ? "一致する定番商品がありません。" 
                  : "登録されているSTD商品がありません。「商品マスタ」から商品マスタデータを定番登録(STD)してください。"}
              </p>
            </div>
          ) : (
            /* Collapsible sections grouped by genre (supported for both Normal and Reordering modes) */
            <div className="space-y-4">
              {MASTER_GENRES.map((genre) => {
                const genreItems = filteredItems.filter(item => (item.genre || 'その他') === genre);
                if (genreItems.length === 0) return null;

                const isCollapsed = collapsedGenres[genre] ?? false;

                return (
                  <div key={genre} className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden text-left">
                    {/* Fold / Unfold trigger button */}
                    <button
                      type="button"
                      onClick={() => setCollapsedGenres(prev => ({ ...prev, [genre]: !prev[genre] }))}
                      className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between border-b border-gray-100 hover:bg-gray-100/50 transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-3.5 bg-amber-500 rounded-full" />
                        <span className="text-xs font-black text-gray-800">{genre}</span>
                        <span className="text-[10px] font-black text-gray-500 bg-gray-200/50 px-2 py-0.5 rounded-full font-mono">
                          {genreItems.length}
                        </span>
                      </div>
                      <div className="text-gray-400">
                        {isCollapsed ? (
                          <ChevronDown size={14} strokeWidth={3} />
                        ) : (
                          <ChevronUp size={14} strokeWidth={3} />
                        )}
                      </div>
                    </button>

                    {/* Subitems under this genre category */}
                    {!isCollapsed && (
                      <div className="p-3 space-y-2.5">
                        {genreItems.map((item, subIdx) => {
                          const isCurrentlyDragged = draggedGenre === genre && draggedIndex === subIdx;
                          return (
                            <div
                              key={item.id}
                              data-genre={genre}
                              data-genre-idx={subIdx}
                              draggable={isReorderingMode}
                              onDragStart={() => handleDragStart(genre, subIdx)}
                              onDragOver={handleDragOver}
                              onDragEnter={() => handleDragEnter(genre, subIdx)}
                              onDragEnd={handleDragEnd}
                              onTouchStart={(e) => handleTouchStart(genre, subIdx, e)}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                              className={`bg-white border rounded-2xl p-3 flex items-center justify-between hover:shadow-md transition-all relative overflow-hidden select-none ${
                                isReorderingMode 
                                  ? 'cursor-grab active:cursor-grabbing border-amber-200 bg-amber-50/5 shadow-sm' 
                                  : 'border-gray-100 hover:border-amber-100'
                              } ${isCurrentlyDragged ? 'opacity-40 border-dashed border-amber-500 bg-amber-50/30 scale-[0.98]' : ''}`}
                            >
                              <div className="flex-1 min-w-0 pr-4 text-left">
                                <div className="flex flex-wrap items-center gap-1.5 mb-1 text-[9px] font-bold">
                                  {item.maker && (
                                    <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-0.5 border border-amber-100/50">
                                      <Building size={8} />
                                      {item.maker}
                                    </span>
                                  )}
                                  {item.size && (
                                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                      {item.size}
                                    </span>
                                  )}
                                  <span className="text-[8px] font-mono font-bold text-gray-400 bg-gray-50 px-1 rounded border border-gray-100">
                                    JAN: {item.janCode}
                                  </span>
                                </div>

                                <h3 className="text-xs font-extrabold text-gray-900 leading-snug truncate">
                                  {item.displayName}
                                </h3>
                              </div>

                              {isReorderingMode ? (
                                <div className="flex items-center gap-1 shrink-0 p-2 rounded-xl bg-amber-50 border border-amber-200/50 cursor-grab active:cursor-grabbing">
                                  <GripVertical size={16} strokeWidth={2.5} className="text-amber-600 animate-pulse" />
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleSelectItem(item)}
                                  className="px-3.5 py-2.5 bg-gray-900 hover:bg-amber-600 text-white hover:text-white rounded-xl font-bold text-[10px] active:scale-95 transition-all truncate shrink-0 cursor-pointer shadow-sm shadow-gray-200/50"
                                >
                                  補 充
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* REPLENISHMENT MODAL (BOTTOM DRAWER/BOTTOM SHEET) */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isSubmitting) setSelectedItem(null); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-b-[32px] p-6 shadow-2xl z-10 text-left overflow-hidden flex flex-col font-sans"
            >
              <div className="flex items-start justify-between pb-3.5 border-b border-gray-100 mb-5">
                <div className="text-left min-w-0 pr-4">
                  <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-705 text-[8px] font-black rounded border border-amber-200 mb-1.5 uppercase tracking-wider">
                    {selectedItem.maker || '定番'}
                  </span>
                  <h3 className="text-sm font-extrabold text-gray-900 leading-snug truncate">
                    {selectedItem.displayName}
                  </h3>
                  {selectedItem.size && (
                    <p className="text-[10px] font-extrabold text-gray-500 mt-1">
                      規格: {selectedItem.size}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
                >
                  <span className="text-[10px] font-bold px-1.5 py-1">キャンセル</span>
                </button>
              </div>

              {/* CONTROLS AREA */}
              <div className="space-y-5 flex-1 select-none">
                
                {/* QUANTITY PICKER */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">数量を選択</span>
                  <div className="flex items-center justify-center gap-6 py-1 bg-gray-50 border border-gray-100 rounded-2xl max-w-xs mx-auto">
                    <button 
                      onClick={() => setQuantity(Math.max(0, quantity - 1))}
                      className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-650 hover:bg-gray-50 active:scale-90 transition-all font-bold shadow-sm cursor-pointer"
                    >
                      <Minus size={20} strokeWidth={2.5} />
                    </button>
                    
                    <div className="relative min-w-[4rem] h-14 flex flex-col items-center justify-center bg-gray-250/20 hover:bg-gray-200/40 rounded-xl transition-all cursor-pointer select-none">
                      <span className="text-4xl font-extrabold text-gray-950 font-mono leading-none">
                        {quantity}
                      </span>
                      <span className="text-[8px] font-black tracking-wider text-amber-700 leading-none mt-1 uppercase font-sans shrink-0">
                        変更 ▼
                      </span>
                      <select
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none text-base"
                      >
                        {Array.from({ length: 100 }, (_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-12 h-12 rounded-full bg-gray-900 hover:bg-gray-800 flex items-center justify-center text-white active:scale-90 transition-all font-bold shadow-md shadow-gray-300 cursor-pointer"
                    >
                      <Plus size={20} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* UNIT SELECTION */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">デフォルト単位</span>
                  <div className="flex flex-wrap bg-gray-50/70 border border-gray-100 p-1.5 rounded-2xl gap-1">
                    {['ケース', '個', '袋', '本', 'パック', '缶', 'その他'].map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnit(u)}
                        className={`flex-1 py-2 font-black text-[10px] rounded-xl transition-all cursor-pointer ${
                          unit === u 
                            ? 'bg-gray-900 text-white shadow-md scale-[1.02]' 
                            : 'bg-white hover:bg-gray-50 text-gray-50 border border-transparent hover:border-gray-100'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SUBCATEGORY SELECTION */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">売場 (サブカテゴリ)</span>
                  <div className="flex bg-gray-50/70 border border-gray-100 p-1 rounded-2xl gap-1">
                    {['通常', '催事', 'エンド', '客注', 'その他'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSubcategory(s)}
                        className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all cursor-pointer ${
                          subcategory === s 
                            ? 'bg-gray-900 text-white shadow-md scale-[1.02]' 
                            : 'bg-white hover:bg-gray-50 text-gray-550 border border-transparent'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* ACTION BUTTON */}
              <div className="pt-6 mt-6 border-t border-gray-100">
                <button
                  onClick={handlePostRequest}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 disabled:from-gray-300 disabled:to-gray-450 text-white font-extrabold rounded-2xl active:scale-[0.98] transition-all text-xs text-center flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-white" />
                      <span>送信中...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} strokeWidth={2.5} />
                      <span>補充依頼を送信する</span>
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST SUCCESS FEEDBACK */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-green-600 text-white px-8 py-4 rounded-full shadow-[0_0_40px_rgba(22,163,74,0.45)] flex items-center gap-2.5 z-[160] pointer-events-none font-black text-xs"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check size={14} strokeWidth={3} />
            </div>
            <span>補充依頼が送信されました</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
