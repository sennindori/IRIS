import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Loader2, 
  Database,
  Barcode,
  Building,
  Maximize,
  Clipboard,
  Check,
  AlertCircle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { ProductMasterItem } from '../types';

interface MasterModeProps {
  onBack: () => void;
}

export default function MasterMode({ onBack }: MasterModeProps) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ProductMasterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Registration form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newJan, setNewJan] = useState('');
  const [newName, setNewName] = useState('');
  const [newMaker, setNewMaker] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newRemarks, setNewRemarks] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMaker, setEditMaker] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm state
  const [deletingItem, setDeletingItem] = useState<ProductMasterItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Real-time Master DB listener
  useEffect(() => {
    const q = query(collection(db, 'product_master'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProductMasterItem[];
      setItems(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Failed to fetch product master items:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter items in UI
  const filteredItems = items.filter(item => {
    const term = search.toLowerCase();
    return (
      item.productName.toLowerCase().includes(term) ||
      (item.maker && item.maker.toLowerCase().includes(term)) ||
      item.janCode.includes(term) ||
      (item.size && item.size.toLowerCase().includes(term)) ||
      (item.remarks && item.remarks.toLowerCase().includes(term))
    );
  });

  // Paste JAN from Clipboard helper
  async function handlePasteJan() {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/[^0-9]/g, '');
      if (digits.length >= 8) {
        setNewJan(digits);
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      } else {
        alert("クリップボードに有効な数字コード（8桁または13桁以上）が見つかりませんでした。");
      }
    } catch (err) {
      alert("クリップボードの読み取り権限がないか、取得できません。");
    }
  }

  // Register master item handler
  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newJan.trim() || !newName.trim()) {
      alert("JANコードと商品名は必須項目です。");
      return;
    }
    
    // Check if JAN is already registered to avoid duplicates
    const duplicated = items.find(item => item.janCode === newJan.trim());
    if (duplicated) {
      alert(`このJANコード（${newJan.trim()}）はすでに「${duplicated.productName}」として登録されています。`);
      return;
    }

    setIsRegistering(true);
    try {
      await addDoc(collection(db, 'product_master'), {
        janCode: newJan.trim(),
        productName: newName.trim(),
        maker: newMaker.trim() || null,
        size: newSize.trim() || null,
        remarks: newRemarks.trim() || null,
        createdAt: serverTimestamp()
      });
      // Reset form states
      setNewJan('');
      setNewName('');
      setNewMaker('');
      setNewSize('');
      setNewRemarks('');
      setShowAddForm(false);
    } catch (err) {
      console.error("Failed to register master item:", err);
      alert("登録に失敗しました。認証やフォーマットを確認してください。");
    } finally {
      setIsRegistering(false);
    }
  }

  // Start edit handler
  function startEdit(item: ProductMasterItem) {
    setEditingId(item.id);
    setEditName(item.productName);
    setEditMaker(item.maker || '');
    setEditSize(item.size || '');
    setEditRemarks(item.remarks || '');
  }

  // Cancel edit
  function cancelEdit() {
    setEditingId(null);
  }

  // Save edit handler
  async function handleSaveEdit(id: string) {
    if (!editName.trim()) {
      alert("商品名は必須です。");
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'product_master', id), {
        productName: editName.trim(),
        maker: editMaker.trim() || null,
        size: editSize.trim() || null,
        remarks: editRemarks.trim() || null
      });
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update item:", err);
      alert("更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  // Delete item handler
  async function handleDeleteItem() {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'product_master', deletingItem.id));
      setDeletingItem(null);
    } catch (err) {
      console.error("Failed to delete master item:", err);
      alert("削除に失敗しました。");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-gray-950 font-sans text-white overflow-hidden">
      
      {/* HEADER SECTION */}
      <header className="px-4 py-4 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full active:scale-90 transition-transform"
            title="メニューに戻る"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-1.5 leading-none">
              <Database size={16} className="text-blue-400" />
              商品マスタデータベース
            </h1>
            <p className="text-[10px] text-gray-400 font-bold mt-1 leading-none uppercase tracking-wider">
              Product Master Manager ({items.length}件登録)
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl active:scale-95 transition-all shadow-lg shadow-blue-950/20"
        >
          <Plus size={14} />
          新規追加
        </button>
      </header>

      {/* SEARCH / CONTROLS */}
      <div className="p-4 bg-gray-900/50 border-b border-gray-800 shrink-0">
        <div className="relative max-w-xl mx-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="品番（JAN）、商品名、メーカー、サイズから検索..."
            className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 text-sm font-bold placeholder:text-gray-500 text-white outline-none transition-all"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-700 hover:bg-gray-600 rounded-full"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ITEMS LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
            <Loader2 className="animate-spin text-blue-500" size={36} />
            <p className="text-xs font-black tracking-widest uppercase">マスタデータを取得中...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 max-w-sm mx-auto">
            <AlertCircle size={44} className="text-gray-600 mb-3" />
            <p className="text-sm font-black text-gray-300">商品マスタが見つかりません</p>
            <p className="text-xs text-gray-500 leading-relaxed mt-2.5">
              まだマスタデータが登録されていないか、検索キーワードに該当がないようです。右上の<strong>「新規追加」</strong>から手動で登録、またはバーコードリーダーから保存してください。
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3 pb-8">
            {filteredItems.map((item) => {
              const isEditing = editingId === item.id;
              
              return (
                <div 
                  key={item.id}
                  className={`bg-gray-900 border ${
                    isEditing ? 'border-blue-500/50 ring-4 ring-blue-950/30' : 'border-gray-800 hover:border-gray-700/80'
                  } rounded-2xl p-4 transition-all shadow-md`}
                >
                  {isEditing ? (
                    /* EDITING VIEW */
                    <div className="space-y-3 text-left">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
                        <span className="text-xs font-bold font-mono text-gray-400 flex items-center gap-1.5">
                          <Barcode size={13} className="text-blue-400" />
                          JAN: {item.janCode}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={cancelEdit}
                            className="p-1 px-2.5 bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-white font-bold text-[10px] rounded-lg transition-all"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={isSaving}
                            className="p-1 px-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black text-[10px] rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-blue-900/30"
                          >
                            {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                            マスタに保存
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-gray-400 font-black uppercase">商品名 (必須)</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 font-bold text-xs text-white"
                            placeholder="商品名"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 font-black uppercase">メーカー</label>
                          <input
                            type="text"
                            value={editMaker}
                            onChange={(e) => setEditMaker(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 font-bold text-xs text-white"
                            placeholder="メーカー名"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 font-black uppercase">サイズ (容量等)</label>
                          <input
                            type="text"
                            value={editSize}
                            onChange={(e) => setEditSize(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 font-bold text-xs text-white"
                            placeholder="例: 500ml, 3P"
                          />
                        </div>

                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-gray-400 font-black uppercase">備考</label>
                          <input
                            type="text"
                            value={editRemarks}
                            onChange={(e) => setEditRemarks(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 font-bold text-xs text-white"
                            placeholder="追記したい仕様や保管棚番号など"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* DISPLAY VIEW */
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-xs font-black font-mono tracking-tight text-gray-300 bg-gray-800 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm border border-gray-750">
                            <Barcode size={11} className="text-blue-400" />
                            {item.janCode}
                          </span>
                          {item.maker && (
                            <span className="text-[10px] font-black text-blue-400 bg-blue-950/40 border border-blue-900/40 px-1.5 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wider">
                              <Building size={9} />
                              {item.maker}
                            </span>
                          )}
                          {item.size && (
                            <span className="text-[10px] font-extrabold text-orange-400 bg-orange-950/30 border border-orange-900/30 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              {item.size}
                            </span>
                          )}
                        </div>
                        
                        <h3 className="text-sm font-black text-white tracking-tight leading-snug truncate">
                          {item.productName}
                        </h3>

                        {item.remarks && (
                          <p className="text-[11px] text-gray-400 font-medium leading-normal mt-1 flex items-start gap-1 p-1 px-2 bg-gray-800/30 border border-gray-800/20 rounded-lg">
                            <span className="text-gray-500 mt-0.5 font-bold shrink-0">備考:</span>
                            <span>{item.remarks}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0 justify-end">
                        <button
                          onClick={() => startEdit(item)}
                          className="p-2.5 bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-white rounded-xl active:scale-95 transition-all shadow-sm flex items-center justify-center border border-gray-750"
                          title="マスタ情報を編集"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeletingItem(item)}
                          className="p-2.5 bg-red-950/45 hover:bg-red-900/45 text-red-400 hover:text-red-300 rounded-xl active:scale-95 transition-all shadow-sm flex items-center justify-center border border-red-900/20"
                          title="削除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE MASTER ITEM BOTTOM SHEET / OVERLAY */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-gray-900 border-t border-gray-800 rounded-t-[32px] sm:rounded-b-[32px] sm:border p-6 shadow-2xl z-10 text-left overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-800">
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Plus size={16} className="text-blue-400" />
                  マスタに新規商品を登録
                </h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateItem} className="space-y-4 font-sans text-xs">
                
                {/* JAN input */}
                <div className="space-y-1.5">
                  <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">JANコード (品番) *必須</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={newJan}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setNewJan(val);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm tracking-widest font-mono"
                      placeholder="例: 4901301236547"
                    />
                    <button
                      type="button"
                      onClick={handlePasteJan}
                      className="px-3 bg-gray-800 hover:bg-gray-755 border border-gray-700 hover:border-gray-600 rounded-xl font-bold flex items-center gap-1 active:scale-95 transition-all text-gray-200 shadow-sm"
                      title="クリップボードからJANを抽出貼り付け"
                    >
                      {pasteSuccess ? (
                        <>
                          <Check size={14} className="text-green-400" />
                          <span className="text-[10px] font-black">貼付完了</span>
                        </>
                      ) : (
                        <>
                          <Clipboard size={14} />
                          <span className="text-[10px] font-black">貼付(📋)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Product Name */}
                <div className="space-y-1.5">
                  <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">商品名 *必須</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm"
                    placeholder="例: アタック抗菌EX部屋干し用 詰め替え"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Maker */}
                  <div className="space-y-1.5">
                    <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">メーカー (ブランド)</label>
                    <input
                      type="text"
                      value={newMaker}
                      onChange={(e) => setNewMaker(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm"
                      placeholder="例: 花王"
                    />
                  </div>

                  {/* Size */}
                  <div className="space-y-1.5">
                    <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">サイズ / 容量 / 仕様</label>
                    <input
                      type="text"
                      value={newSize}
                      onChange={(e) => setNewSize(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm"
                      placeholder="例: 1000g, 4.2kg"
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">備考 (保管場所や発注詳細など)</label>
                  <textarea
                    value={newRemarks}
                    onChange={(e) => setNewRemarks(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-xs leading-relaxed resize-none"
                    placeholder="例: A-3棚上、バラ、催事コーナー等"
                  />
                </div>

                <div className="pt-4 flex gap-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-4 bg-gray-800 text-gray-300 font-bold rounded-xl active:scale-95 hover:bg-gray-750 transition-all text-center text-xs"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="flex-[2] py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl active:scale-[0.98] transition-all text-center tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-950/20"
                  >
                    {isRegistering ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Plus size={15} />
                    )}
                    マスターに登録
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION INTERFACE */}
      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl z-10 text-center"
            >
              <div className="w-14 h-14 bg-red-950/40 text-red-400 border border-red-900/45 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce" style={{ animationDuration: '3s' }}>
                <Trash2 size={24} />
              </div>
              
              <h3 className="text-base font-black text-white leading-tight mb-2">
                マスタから削除しますか？
              </h3>
              
              <p className="text-xs text-gray-400 font-medium leading-relaxed px-4 mb-5">
                本当に 「<strong className="text-gray-200">{deletingItem.productName}</strong>」 のマスタ情報を完全に削除してもよろしいですか？この操作は取り消せません。
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeletingItem(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-750 text-gray-300 font-bold rounded-xl active:scale-95 transition-all text-xs"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteItem}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white font-black rounded-xl active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : null}
                  完全に削除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
