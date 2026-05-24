import React, { useEffect, useState, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { ArrowLeft, Package, Clock, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReplenishmentItem } from '../types';

interface ViewModeProps {
  onBack: () => void;
}

export default function ViewMode({ onBack }: ViewModeProps) {
  const [items, setItems] = useState<ReplenishmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevItemsCount = useRef<number>(0);

  useEffect(() => {
    const q = query(
      collection(db, 'replenishment_list'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReplenishmentItem[];

      // Play sound if new items arrive
      if (newItems.length > prevItemsCount.current && prevItemsCount.current !== 0) {
        audioRef.current?.play().catch(e => console.error("Sound play failed", e));
      }
      
      prevItemsCount.current = newItems.length;
      setItems(newItems);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatTime = (ts: Timestamp) => {
    if (!ts) return '';
    const date = ts.toDate();
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-gray-950 text-white pb-safe">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      
      <header className="p-6 bg-gray-900 border-b border-gray-800 flex items-center justify-between sticky top-0 z-10 shadow-xl">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-white" id="back-btn">
            <ArrowLeft size={28} />
          </button>
          <div className="ml-4">
            <h1 className="text-2xl font-bold tracking-tight">補充リクエスト状況</h1>
            <p className="text-sm text-gray-500 font-medium">進行中のアイテム: {items.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          リアルタイム更新中
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 md:p-8 md:pb-36">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p>読み込み中...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Package size={80} strokeWidth={1} className="mb-6 opacity-20" />
            <h2 className="text-xl font-semibold opacity-40">現在、補充リクエストはありません</h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative bg-gray-900 rounded-[32px] aspect-[4/3] md:aspect-auto md:h-80 overflow-hidden border border-white/5 shadow-2xl"
                  >
                    {/* Background Image */}
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        alt={item.productName} 
                        className="absolute inset-0 w-full h-full object-contain p-8 bg-white transition-transform duration-700 group-hover:scale-110" 
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-gray-700">
                        <Package size={64} strokeWidth={1} />
                      </div>
                    )}

                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent"></div>

                    {/* Content Overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                      <div className="flex items-center gap-2 text-gray-400 text-xs font-mono mb-3">
                        <Hash size={12} /> {item.janCode}
                        <span className="opacity-30">|</span>
                        <Clock size={12} /> {formatTime(item.createdAt)}
                      </div>
                      
                      <h3 className="text-lg md:text-xl font-black text-white leading-tight mb-6 drop-shadow-sm">
                        {item.productName}
                      </h3>
                      
                      <div className="flex items-end justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {item.maker && (
                            <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md text-white text-[11px] font-black rounded-lg border border-white/20 uppercase tracking-[0.1em] truncate max-w-full">
                              {item.maker}
                            </span>
                          )}
                        </div>
                        <div className="px-6 md:px-8 py-3 bg-blue-600 text-white rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)] font-black text-4xl md:text-5xl shrink-0">
                          {item.quantity}
                          <span className="text-xl md:text-2xl ml-2 opacity-80">{item.unit || '個'}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
