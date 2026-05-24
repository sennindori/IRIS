import React, { useState } from 'react';
import { Scan, Eye, Edit3, LayoutGrid, QrCode, Maximize2, Copy, Check, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppMode } from '../types';

interface ModeSelectorProps {
  onSelect: (mode: AppMode) => void;
  onLock: () => void;
  username: string;
  onChangeUsername: (username: string) => void;
}

export default function ModeSelector({ onSelect, onLock, username, onChangeUsername }: ModeSelectorProps) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.href : '';

  const modes = [
    { id: 'scan' as AppMode, label: 'スキャン', icon: Scan, color: 'bg-blue-600', desc: '依頼入力' },
    { id: 'quick' as AppMode, label: '定番商品', icon: LayoutGrid, color: 'bg-amber-500', desc: 'リストから選択' },
    { id: 'view' as AppMode, label: '閲覧', icon: Eye, color: 'bg-green-600', desc: '状況確認' },
    { id: 'edit' as AppMode, label: '編集', icon: Edit3, color: 'bg-orange-600', desc: '完了・修正' },
  ];

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] p-4 pb-6 bg-gray-50 overflow-hidden">
      <header className="py-4 sm:py-6 md:py-8 shrink-0 relative flex items-center justify-between max-w-lg mx-auto w-full">
        {/* Blank placeholder for header balance */}
        <div className="w-10 h-10 invisible" />
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-blue-600 tracking-tighter">I.R.I.S</h1>
          <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium uppercase mt-1.5 sm:mt-2 tracking-[0.25em] leading-none font-condensed">
            Inventory Replenishment Information System
          </p>
        </div>
        {/* Device Lock Button */}
        <button
          onClick={onLock}
          className="w-10 h-10 bg-white hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all shadow-md shadow-gray-200/50 border border-gray-100 active:scale-90"
          title="アプリをロックする"
        >
          <Lock size={18} />
        </button>
      </header>

      {/* User Session Bar */}
      <div className="max-w-lg mx-auto w-full mb-3 px-1.5 flex items-center justify-between shrink-0 bg-white/50 border border-gray-100 p-2.5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-xs shadow-sm">
            {username.charAt(0)}
          </div>
          <div className="text-left">
            <p className="text-[9px] text-gray-400 font-bold leading-none uppercase tracking-wider">操作担当者</p>
            <p className="text-sm font-black text-gray-800 mt-0.5 leading-none">{username}</p>
          </div>
        </div>
        <button
          onClick={() => onChangeUsername('')}
          className="text-xs font-bold text-blue-600 hover:text-blue-500 bg-white border border-gray-100 py-1 px-3 rounded-xl transition-all shadow-sm active:scale-95"
        >
          名前変更
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-2.5 sm:gap-3 max-w-lg mx-auto w-full overflow-y-auto pb-3">
        {modes.map((mode) => (
          <motion.button
            key={mode.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelect(mode.id)}
            className="flex-1 flex items-center p-4 sm:p-6 bg-white rounded-[24px] sm:rounded-[32px] shadow-lg shadow-gray-200/50 border border-white transition-all active:shadow-none min-h-[76px] sm:min-h-[90px]"
            id={`mode-btn-${mode.id}`}
          >
            <div className={`${mode.color} p-3 sm:p-4 rounded-xl sm:rounded-2xl text-white mr-4 sm:mr-6 shrink-0`}>
              <mode.icon size={24} className="sm:w-7 sm:h-7" />
            </div>
            <div className="text-left">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">{mode.label}</h2>
              <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">{mode.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

      <footer className="mt-auto pt-3 pb-safe border-t border-gray-100 flex items-center justify-between max-w-lg mx-auto w-full shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
            <QrCode size={20} />
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-gray-900 leading-none">スマホでスキャン</p>
            <p className="text-[10px] text-gray-400 font-medium mt-1">カメラで読み取ってスマホで操作</p>
          </div>
        </div>
        <button 
          onClick={() => setShowQrModal(true)}
          className="p-1 px-3 bg-white border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all shadow-sm rounded-xl flex items-center gap-2"
        >
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(appUrl)}`} 
            alt="QR" 
            className="w-8 h-8 rounded border border-gray-100"
            loading="lazy"
          />
          <Maximize2 size={12} className="text-gray-400" />
        </button>
      </footer>

      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQrModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] p-8 shadow-2xl border border-gray-100 z-10 text-center"
            >
              <h3 className="text-2xl font-black text-gray-900 leading-tight tracking-tight mb-2">スマホと連携</h3>
              <p className="text-xs text-gray-400 font-medium px-4 mb-6 leading-relaxed">
                カメラで下のコードをスキャンすると、スマートフォンなどの他の端末で表示・操作が可能です。
              </p>

              <div className="relative mx-auto w-56 h-56 bg-gray-50 border-4 border-white shadow-xl rounded-[32px] overflow-hidden flex items-center justify-center p-4 mb-6">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appUrl)}`}
                  alt="App Webapp QR Code"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-2xl flex items-center justify-between gap-2 max-w-full text-left mb-6 border border-gray-100">
                <span className="text-[11px] font-mono font-bold text-gray-500 truncate max-w-[200px] pl-1">
                  {appUrl}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(appUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-2 bg-white hover:bg-gray-100 border border-gray-100 active:scale-95 transition-transform rounded-xl text-gray-600 shrink-0 flex items-center gap-1 text-[10px] font-bold"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-green-500" />
                      <span>コピー済</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>コピー</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black active:scale-[0.98] transition-transform shadow-lg shadow-gray-200"
              >
                閉じる
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
