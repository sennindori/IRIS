import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, Plus, Minus, Check, Edit2, Save, X, Loader2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { STANDARD_ITEMS } from '../constants/standardItems';

interface QuickModeProps {
  onBack: () => void;
}

export default function QuickMode({ onBack }: QuickModeProps) {
  const [search, setSearch] = useState('');
  const [dbItems, setDbItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('ケース');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Management states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItemData, setEditingItemData] = useState<any | null>(null);
  const [isManaging, setIsManaging] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'standard_items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        maker: doc.data().maker || 'Other',
        name: doc.data().name,
        janCode: doc.data().janCode
      }));
      setDbItems(items);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const allItems = [
    ...dbItems, 
    ...STANDARD_ITEMS.filter(std => !dbItems.some(dbItem => dbItem.name === std.name))
  ];
  
  const filteredItems = allItems.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.maker.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd() {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'replenishment_list'), {
        janCode: selectedItem.janCode || 'STANDARD',
        productName: selectedItem.name,
        maker: selectedItem.maker,
        quantity: String(quantity),
        unit: unit,
        imageUrl: null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedItem(null);
        setSearch('');
        setQuantity(1);
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveStandardItem() {
    if (!editingItemData.name) return;
    setIsManaging(true);
    try {
      if (editingItemData.id && !editingItemData.id.startsWith('std-')) {
        // Update existing DB item
        await updateDoc(doc(db, 'standard_items', editingItemData.id), {
          name: editingItemData.name,
          maker: editingItemData.maker || null,
          janCode: editingItemData.janCode || 'STANDARD',
        });
        // Update selection if we were editing it
        if (selectedItem && selectedItem.id === editingItemData.id) {
          setSelectedItem({ ...editingItemData });
        }
      } else {
        // Create new item
        const docRef = await addDoc(collection(db, 'standard_items'), {
          name: editingItemData.name,
          maker: editingItemData.maker || null,
          janCode: editingItemData.janCode || 'STANDARD',
          createdAt: serverTimestamp(),
        });
        // If it was a hardcoded item being "upgraded" to DB item, switch selection
        if (selectedItem && selectedItem.id === editingItemData.id) {
          setSelectedItem({ 
            id: docRef.id,
            name: editingItemData.name,
            maker: editingItemData.maker || null,
            janCode: editingItemData.janCode || 'STANDARD'
          });
        }
      }
      setShowEditModal(false);
      setEditingItemData(null);
    } catch (err) {
      console.error(err);
      alert('反映に失敗しました');
    } finally {
      setIsManaging(false);
    }
  }

  function openEditModal(item?: any) {
    if (item) {
      setEditingItemData({ ...item });
    } else {
      setEditingItemData({ name: '', maker: '', janCode: 'STANDARD' });
    }
    setShowEditModal(true);
  }

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-gray-50 overflow-hidden pb-safe">
      <header className="p-4 bg-white border-b shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft />
          </button>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">定番商品登録</h2>
        </div>
        {!selectedItem && (
          <button 
            onClick={() => openEditModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-black active:scale-95 transition-all"
          >
            <Plus size={16} strokeWidth={3} />
            新規登録
          </button>
        )}
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        {!selectedItem ? (
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            <div className="relative shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="商品名やメーカーで検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl shadow-sm outline-none font-bold transition-all text-lg"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pb-32">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center gap-2 text-gray-400">
                  <Loader2 className="animate-spin" />
                  <span>読み込み中...</span>
                </div>
              ) : filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="w-full p-4 bg-white hover:bg-blue-50 border border-gray-100 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98]"
                >
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-black rounded-md mb-1 uppercase tracking-wider">
                      {item.maker}
                    </span>
                    <h3 className="text-lg font-black text-gray-900 leading-tight truncate">
                      {item.name}
                    </h3>
                  </div>
                  <Plus className="text-blue-600 shrink-0 ml-4" />
                </button>
              ))}
              {filteredItems.length === 0 && (
                <div className="py-20 text-center text-gray-400">
                  一致する商品は見つかりませんでした
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-start sm:justify-center gap-6 sm:gap-8 pb-16 pt-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-white p-8 rounded-[40px] shadow-2xl border border-gray-100 text-center relative"
            >
              <button 
                onClick={() => openEditModal(selectedItem)}
                className="absolute top-6 right-6 p-3 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-2xl transition-colors"
                title="商品情報を編集"
              >
                <Edit2 size={20} />
              </button>

              <div className="mb-6">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-black rounded-full mb-2 uppercase tracking-[0.2em]">
                  {selectedItem.maker}
                </span>
                <h3 className="text-2xl font-black text-gray-900 leading-tight">
                  {selectedItem.name}
                </h3>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-center gap-6">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200 transition-colors"
                  >
                    <Minus size={28} strokeWidth={3} />
                  </button>
                  <div className="text-6xl font-black text-blue-600 tabular-nums">
                    {quantity}
                  </div>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white active:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                  >
                    <Plus size={28} strokeWidth={3} />
                  </button>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1">
                  {['ケース', '個'].map((u) => (
                    <button
                      key={u}
                      onClick={() => setUnit(u)}
                      className={`flex-1 py-3 font-black rounded-xl transition-all ${
                        unit === u ? 'bg-white text-blue-600 shadow-md scale-[1.02]' : 'text-gray-400'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="w-full max-w-sm flex gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 py-5 bg-white text-gray-900 rounded-[24px] font-black shadow-sm border border-gray-200 active:scale-95 transition-transform"
              >
                キャンセル
              </button>
              <button
                onClick={handleAdd}
                disabled={isSubmitting}
                className="flex-[2] py-5 bg-blue-600 text-white rounded-[24px] font-black shadow-xl shadow-blue-200 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
              >
                {isSubmitting ? '追加中...' : 'リストに追加'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit/Add Standard Item Modal */}
      <AnimatePresence>
        {showEditModal && editingItemData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-900">定番商品の情報</h3>
                <button onClick={() => setShowEditModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">メーカー名</label>
                  <input
                    type="text"
                    value={editingItemData.maker || ''}
                    onChange={(e) => setEditingItemData({ ...editingItemData, maker: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold"
                    placeholder="例: サントリー"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">商品名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingItemData.name || ''}
                    onChange={(e) => setEditingItemData({ ...editingItemData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold"
                    placeholder="例: 天然水 2L"
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-50 flex gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 bg-white text-gray-900 rounded-2xl font-black border border-gray-200 active:scale-95 transition-transform"
                >
                  閉じる
                </button>
                <button
                  onClick={handleSaveStandardItem}
                  disabled={isManaging || !editingItemData.name}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-blue-100"
                >
                  {isManaging ? '反映中...' : <><Save size={18} /> 反映</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-600 text-white px-8 py-4 rounded-full shadow-[0_0_40px_rgba(22,163,74,0.4)] flex items-center gap-3 z-50 pointer-events-none font-black"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Check size={20} strokeWidth={3} />
            </div>
            登録完了
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
