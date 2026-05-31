import React, { useState } from 'react';
import { Scan, Eye, Edit3, LayoutGrid, QrCode, Maximize2, Copy, Check, Lock, MessageSquare, Database, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppMode } from '../types';

interface ModeSelectorProps {
  onSelect: (mode: AppMode) => void;
  onLock: () => void;
  username: string;
  onChangeUsername: (username: string) => void;
  unreadBbsCount?: number;
}

export default function ModeSelector({ onSelect, onLock, username, onChangeUsername, unreadBbsCount = 0 }: ModeSelectorProps) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.href : '';

  const inputGroup = [
    { 
      id: 'scan' as AppMode, 
      label: 'スキャン', 
      icon: Scan, 
      color: 'bg-red-50 text-red-500 border border-red-100/70', 
      hoverBg: 'hover:bg-red-50/20 hover:border-red-100',
      desc: 'スキャンまたは手入力で補充依頼' 
    },
    { 
      id: 'quick' as AppMode, 
      label: 'STD発注', 
      icon: Star, 
      color: 'bg-amber-50 text-amber-500 border border-amber-100/70', 
      hoverBg: 'hover:bg-amber-50/20 hover:border-amber-100',
      desc: '定番商品リストからの簡易補充依頼' 
    }
  ];

  const checkGroup = [
    { 
      id: 'view' as AppMode, 
      label: '補充チェック', 
      icon: Eye, 
      color: 'bg-blue-50 text-blue-500 border border-blue-100/70', 
      hoverBg: 'hover:bg-blue-50/20 hover:border-blue-100',
      desc: '状況確認・リスト編集' 
    },
    { 
      id: 'bbs' as AppMode, 
      label: '連絡事項', 
      icon: MessageSquare, 
      color: 'bg-emerald-50 text-emerald-500 border border-emerald-100/70', 
      hoverBg: 'hover:bg-emerald-50/20 hover:border-emerald-100',
      desc: 'スタッフへの連絡事項' 
    }
  ];

  const settingsGroup = [
    { 
      id: 'master' as AppMode, 
      label: '商品マスタ', 
      icon: Database, 
      color: 'bg-indigo-50 text-indigo-500 border border-indigo-100/70', 
      hoverBg: 'hover:bg-indigo-50/20 hover:border-indigo-100',
      desc: '商品マスタ情報の閲覧・登録・管理' 
    }
  ];

  const renderModeButton = (mode: typeof inputGroup[0]) => {
    const hasUnreadBbs = mode.id === 'bbs' && unreadBbsCount > 0;
    return (
      <motion.button
        key={mode.id}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onSelect(mode.id)}
        className={`w-full flex items-center p-4 sm:p-5 bg-white rounded-[22px] shadow-sm hover:shadow-md border border-gray-100/80 hover:border-gray-200/50 transition-all cursor-pointer ${mode.hoverBg}`}
        id={`mode-btn-${mode.id}`}
      >
        <div className={`${mode.color} p-3 sm:p-3.5 rounded-xl mr-4 shrink-0 relative flex items-center justify-center`}>
          <mode.icon size={22} className="sm:w-6 sm:h-6" />
          {hasUnreadBbs && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
            </span>
          )}
        </div>
        <div className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">{mode.label}</h2>
            {hasUnreadBbs && (
              <span className="bg-emerald-500 text-white text-[10px] sm:text-xs font-black min-w-[20px] h-5 px-2 rounded-full flex items-center justify-center shrink-0 animate-pulse">
                {unreadBbsCount}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">{mode.desc}</p>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] p-4 pb-6 bg-gray-50 overflow-hidden">
      <header className="py-2.5 sm:py-4 shrink-0 relative flex items-center justify-between max-w-lg mx-auto w-full">
        {/* Blank placeholder for header balance */}
        <div className="w-10 h-10 invisible" />
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-blue-600 tracking-tighter">I.R.I.S</h1>
          <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium uppercase mt-1 tracking-[0.25em] leading-none font-condensed">
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

      <div className="flex-1 flex flex-col gap-6 max-w-lg mx-auto w-full overflow-y-auto pt-4 pb-6 px-1">
        {/* 入力グループ */}
        <div className="relative border-2 border-gray-200/60 rounded-[24px] p-4 pt-6 bg-white/10 shadow-sm flex flex-col gap-2.5">
          <span className="absolute -top-3 left-5 px-3 py-0.5 bg-gray-50 rounded-full text-[10px] font-extrabold tracking-widest text-red-500 border border-gray-200/60 uppercase">
            入力
          </span>
          {inputGroup.map(renderModeButton)}
        </div>

        {/* 確認グループ */}
        <div className="relative border-2 border-gray-200/60 rounded-[24px] p-4 pt-6 bg-white/10 shadow-sm flex flex-col gap-2.5">
          <span className="absolute -top-3 left-5 px-3 py-0.5 bg-gray-50 rounded-full text-[10px] font-extrabold tracking-widest text-blue-500 border border-gray-200/60 uppercase">
            確認
          </span>
          {checkGroup.map(renderModeButton)}
        </div>

        {/* 設定グループ */}
        <div className="relative border-2 border-gray-200/60 rounded-[24px] p-4 pt-6 bg-white/10 shadow-sm flex flex-col gap-2.5">
          <span className="absolute -top-3 left-5 px-3 py-0.5 bg-gray-50 rounded-full text-[10px] font-extrabold tracking-widest text-indigo-500 border border-gray-200/60 uppercase">
            設定
          </span>
          {settingsGroup.map(renderModeButton)}
        </div>
      </div>

      <footer className="mt-auto pt-3 pb-safe border-t border-gray-100 flex items-center justify-between max-w-lg mx-auto w-full shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
            <QrCode size={20} />
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-gray-900 leading-none">I.R.I.Sを紹介</p>
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
              <p className="text-xs text-gray-400 font-medium px-4 mb-4 leading-relaxed">
                カメラで下のコードをスキャンすると、スマートフォンなどの他の端末で表示・操作が可能です。
              </p>

              <div className="bg-blue-50/80 border border-blue-100/50 rounded-2xl p-3 mb-5 text-left text-xs">
                <p className="font-black text-blue-900 flex items-center gap-1 mb-1">
                  💡 ログイン案内
                </p>
                <ul className="text-[11px] text-blue-800 font-bold space-y-1 list-disc pl-4 leading-snug">
                  <li>パスコード： <span className="text-blue-600 font-extrabold text-xs">3120</span></li>
                  <li>初回ログイン時に判別しやすい名前をつけてください。</li>
                </ul>
              </div>

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
