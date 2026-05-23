import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { ArrowLeft, Check, Trash2, Edit2, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReplenishmentItem } from '../types';

interface EditModeProps {
  onBack: () => void;
}

export default function EditMode({ onBack }: EditModeProps) {
  const [items, setItems] = useState<ReplenishmentItem[]>([]);
  const [standardItems, setStandardItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'replenishment' | 'standard'>('replenishment');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ productName: '', maker: '', quantity: '', unit: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    // Replenishment items
    const q1 = query(
      collection(db, 'replenishment_list'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReplenishmentItem[]);
    });

    // Standard items
    const q2 = query(
      collection(db, 'standard_items'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      setStandardItems(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, []);

  async function toggleStatus(item: ReplenishmentItem) {
    const newStatus = item.status === 'pending' ? 'completed' : 'pending';
    try {
      await updateDoc(doc(db, 'replenishment_list', item.id), {
        status: newStatus
      });
    } catch (err) {
      console.error("Update failed", err);
    }
  }

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

  async function clearAll(onlyCompleted = false) {
    setIsClearingAll(true);
    try {
      const coll = activeTab === 'replenishment' ? 'replenishment_list' : 'standard_items';
      const snapshot = await getDocs(collection(db, coll));
      const batch = writeBatch(db);
      
      let count = 0;
      snapshot.docs.forEach((doc) => {
        if (activeTab === 'replenishment') {
          const item = doc.data() as ReplenishmentItem;
          if (!onlyCompleted || item.status === 'completed') {
            batch.delete(doc.ref);
            count++;
          }
        } else {
          batch.delete(doc.ref);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
      }
      setShowClearConfirm(false);
    } catch (err) {
      console.error("Clear all failed", err);
      alert("削除に失敗しました");
    } finally {
      setIsClearingAll(false);
    }
  }

  function startEdit(item: ReplenishmentItem) {
    setEditingId(item.id);
    setEditValue({ 
      productName: item.productName, 
      maker: item.maker || '',
      quantity: item.quantity,
      unit: item.unit || '個'
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    const { productName, maker, quantity, unit } = editValue;
    
    try {
      if (activeTab === 'replenishment') {
        if (!productName.trim() || !quantity.trim()) {
          alert("商品名と数量を入力してください");
          return;
        }
        const docRef = doc(db, 'replenishment_list', editingId);
        await updateDoc(docRef, {
          productName: productName.trim(),
          maker: maker.trim() || null,
          quantity: quantity.trim(),
          unit: unit || '個'
        });
      } else {
        if (!productName.trim()) {
          alert("商品名を入力してください");
          return;
        }
        const docRef = doc(db, 'standard_items', editingId);
        await updateDoc(docRef, {
          name: productName.trim(),
          maker: maker.trim() || null
        });
      }
      setEditingId(null);
    } catch (err) {
      console.error("Save edit failed", err);
      alert("反映に失敗しました。しばらく時間を置いてから再度お試しください。");
    }
  }

  function startEditStandard(item: any) {
    setEditingId(item.id);
    setEditValue({ 
      productName: item.name, 
      maker: item.maker || '',
      quantity: '1',
      unit: '個'
    });
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="p-4 bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:text-gray-900" id="back-btn">
              <ArrowLeft size={24} />
            </button>
            <h1 className="ml-2 text-lg font-bold text-gray-900">編集・管理モード</h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowClearConfirm(!showClearConfirm)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors font-medium text-sm ${
                showClearConfirm ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <Trash2 size={18} />
              一括削除
            </button>
            
            <AnimatePresence>
              {showClearConfirm && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-20"
                >
                  <p className="text-[10px] text-gray-400 font-bold px-3 py-2 uppercase tracking-wider">削除オプション</p>
                  {activeTab === 'replenishment' && (
                    <button
                      onClick={() => clearAll(true)}
                      disabled={isClearingAll}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold flex items-center justify-between"
                    >
                      完了分のみ削除
                      <Check size={14} className="text-green-500" />
                    </button>
                  )}
                  <button
                    onClick={() => clearAll(false)}
                    disabled={isClearingAll}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center justify-between"
                  >
                    {activeTab === 'replenishment' ? 'すべて削除' : '定番商品をすべて削除'}
                    <Trash2 size={14} />
                  </button>
                  <div className="h-px bg-gray-100 my-1"></div>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="w-full text-center py-2 text-gray-400 text-xs font-bold hover:text-gray-600"
                  >
                    キャンセル
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('replenishment')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'replenishment' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
            }`}
          >
            補充リスト
          </button>
          <button
            onClick={() => setActiveTab('standard')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'standard' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
            }`}
          >
            定番登録済み
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'replenishment' ? (
          <>
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                className={`relative rounded-3xl overflow-hidden shadow-xl border transition-all ${
                  item.status === 'completed' ? 'opacity-40 grayscale' : 'border-white'
                }`}
              >
                {/* Background Image for Card */}
                {item.imageUrl && (
                  <div className="absolute inset-0 z-0">
                    <img src={item.imageUrl} alt="" className="w-full h-full object-contain bg-white p-4 opacity-30" />
                    <div className="absolute inset-0 bg-white/60"></div>
                  </div>
                )}

                <div className="relative z-10 p-5">
                  {editingId === item.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editValue.maker}
                        onChange={(e) => setEditValue({ ...editValue, maker: e.target.value })}
                        className="w-full px-4 py-2 bg-white/80 backdrop-blur border rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-xs"
                        placeholder="メーカー・カテゴリ (任意)"
                      />
                      <input
                        type="text"
                        value={editValue.productName}
                        onChange={(e) => {
                          const val = e.target.value;
                          const spaceMatch = val.match(/[\s　]/);
                          // Auto-split if maker is empty and we find a space
                          if (spaceMatch && spaceMatch.index !== undefined && !editValue.maker) {
                            const newMaker = val.substring(0, spaceMatch.index).trim();
                            const newName = val.substring(spaceMatch.index + 1).trim();
                            setEditValue({ ...editValue, maker: newMaker, productName: newName });
                          } else {
                            setEditValue({ ...editValue, productName: val });
                          }
                        }}
                        className="w-full px-4 py-3 bg-white/80 backdrop-blur border rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold"
                        placeholder="商品名"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editValue.quantity}
                          onChange={(e) => {
                            const numericVal = e.target.value.replace(/[^0-9]/g, '');
                            setEditValue({ ...editValue, quantity: numericVal });
                          }}
                          className="flex-[2] px-4 py-3 bg-white/80 backdrop-blur border rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold"
                          placeholder="数量"
                        />
                        <select
                          value={editValue.unit}
                          onChange={(e) => setEditValue({ ...editValue, unit: e.target.value })}
                          className="flex-1 px-4 py-3 bg-white/80 backdrop-blur border rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold appearance-none"
                        >
                          <option value="個">個</option>
                          <option value="ケース">ケース</option>
                          <option value="点">点</option>
                          <option value="箱">箱</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg shadow-blue-100">
                          <Save size={18} /> 反映
                        </button>
                        <button onClick={() => setEditingId(null)} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-2xl font-bold">
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.status === 'completed' ? 'bg-gray-400 text-white' : 'bg-blue-600 text-white'
                          }`}>
                            {item.status === 'completed' ? '完了' : '未対応'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono font-bold tracking-tight">{item.janCode}</span>
                        </div>
                        <h3 className={`text-base font-black leading-tight mb-4 truncate ${item.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.productName}
                        </h3>
                        <div className="flex items-end justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            {item.maker && (
                              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg uppercase tracking-tight truncate max-w-full">
                                {item.maker}
                              </span>
                            )}
                          </div>
                          <div className="inline-block px-3 py-1 bg-white border border-gray-100 shadow-sm rounded-xl shrink-0">
                            <p className="text-xl font-black text-blue-600">
                              {item.quantity}
                              <span className="text-xs ml-1 opacity-60">{item.unit || '個'}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleStatus(item)}
                          className={`p-4 rounded-3xl transition-all shadow-md ${
                            item.status === 'completed' 
                              ? 'bg-gray-100 text-gray-400' 
                              : 'bg-green-500 text-white shadow-green-100 hover:scale-105 active:scale-95'
                          }`}
                        >
                          <Check size={24} strokeWidth={3} />
                        </button>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-3 text-gray-400 hover:text-blue-600 bg-white/50 backdrop-blur hover:bg-white rounded-2xl transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => {
                              if (deletingId === item.id) {
                                deleteItem(item.id);
                              } else {
                                setDeletingId(item.id);
                                setTimeout(() => setDeletingId(null), 3000); // 3 seconds timeout
                              }
                            }}
                            className={`p-3 transition-all rounded-2xl ${
                              deletingId === item.id 
                                ? 'bg-red-600 text-white scale-110 shadow-lg shadow-red-100' 
                                : 'text-gray-400 hover:text-red-500 bg-white/50 backdrop-blur hover:bg-white'
                            }`}
                          >
                            {deletingId === item.id ? <Trash2 size={18} className="animate-pulse" /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <X size={48} className="mb-2 opacity-20" />
                <p>データがありません</p>
              </div>
            )}
          </>
        ) : (
          <>
            {standardItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                className="bg-white p-5 rounded-3xl shadow-md border border-gray-100"
              >
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editValue.maker}
                      onChange={(e) => setEditValue({ ...editValue, maker: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-xs"
                      placeholder="メーカー名"
                    />
                    <input
                      type="text"
                      value={editValue.productName}
                      onChange={(e) => setEditValue({ ...editValue, productName: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold"
                      placeholder="商品名"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg shadow-blue-100">
                        <Save size={18} /> 反映
                      </button>
                      <button onClick={() => setEditingId(null)} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-2xl font-bold">
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-black rounded-md mb-1 uppercase tracking-wider">
                        {item.maker || 'Other'}
                      </span>
                      <h3 className="text-base font-black text-gray-900 leading-tight truncate">
                        {item.name}
                      </h3>
                      <p className="text-[10px] text-gray-400 font-mono mt-1">{item.janCode}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => startEditStandard(item)}
                        className="p-3 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-2xl transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => {
                          if (deletingId === item.id) {
                            deleteItem(item.id, 'standard_items');
                          } else {
                            setDeletingId(item.id);
                            setTimeout(() => setDeletingId(null), 3000);
                          }
                        }}
                        className={`p-3 transition-all rounded-2xl ${
                          deletingId === item.id 
                            ? 'bg-red-600 text-white scale-110 shadow-lg shadow-red-100' 
                            : 'text-gray-400 hover:text-red-500 bg-gray-50'
                        }`}
                      >
                        {deletingId === item.id ? <Trash2 size={18} className="animate-pulse" /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            {standardItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <X size={48} className="mb-2 opacity-20" />
                <p>定番登録された商品はまだありません</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
