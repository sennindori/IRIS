import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Sparkles, 
  Lock, 
  HelpCircle, 
  ChevronRight, 
  PlusCircle, 
  Search, 
  Calendar, 
  MessageSquare, 
  TableProperties,
  ArrowLeftRight
} from 'lucide-react';
import { AppMode } from '../types';

interface AssistModeSelectorProps {
  onSelect: (mode: AppMode) => void;
  onToggleSubMode: () => void;
  username: string;
  onChangeUsername: (username: string) => void;
  unreadBbsCount?: number;
  onLock: () => void;
}

export default function AssistModeSelector({
  onSelect,
  onToggleSubMode,
  username,
  onChangeUsername,
  unreadBbsCount = 0,
  onLock,
}: AssistModeSelectorProps) {
  // Current screen state in Assist Mode: 'top' | 'register' | 'search'
  const [screen, setScreen] = useState<'top' | 'register' | 'search'>('top');

  // Stagger animation container
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] p-4 pb-6 bg-slate-50 overflow-hidden select-none">
      
      {/* HEADER REGION */}
      <header className="py-2.5 sm:py-4 shrink-0 flex items-center justify-between max-w-lg mx-auto w-full border-b border-gray-100">
        {/* Mode Switcher Button (Top Left) */}
        <button
          onClick={onToggleSubMode}
          className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl flex items-center gap-1 shadow-md active:scale-95 transition-all text-[11px] font-black cursor-pointer"
          title="通常（アドバンス）モードに切り替える"
          id="assist-toggle-to-advanced"
        >
          <ArrowLeftRight size={11} strokeWidth={3} />
          <span>通常モードへ</span>
        </button>

        {/* LOGO */}
        <div className="text-center flex-1">
          <h1 className="text-2xl font-black text-gray-800 tracking-tighter leading-none flex items-center justify-center gap-1">
            あいりす <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-black tracking-normal uppercase shrink-0">アシスト</span>
          </h1>
        </div>

        {/* Device Lock Button */}
        <button
          onClick={onLock}
          className="w-10 h-10 bg-white hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all shadow-sm border border-gray-150 active:scale-90"
          title="アプリをロックする"
          id="assist-lock-app"
        >
          <Lock size={16} />
        </button>
      </header>

      {/* User Session Bar */}
      <div className="max-w-lg mx-auto w-full my-3 px-1.5 flex items-center justify-between shrink-0 bg-white border border-gray-200/65 p-2.5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 font-extrabold flex items-center justify-center text-xs shadow-sm">
            {username.charAt(0)}
          </div>
          <div className="text-left">
            <p className="text-[9px] text-gray-400 font-bold leading-none uppercase tracking-wider">操作担当者</p>
            <p className="text-sm font-black text-gray-850 mt-0.5 leading-none">{username}</p>
          </div>
        </div>
        <button
          onClick={() => onChangeUsername('')}
          className="text-xs font-bold text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 py-1 px-3 rounded-xl transition-all active:scale-95"
          id="assist-change-username"
        >
          名前変更
        </button>
      </div>

      {/* QUESTION SECTION */}
      <div className="max-w-lg mx-auto w-full text-center py-4 shrink-0">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-amber-200/50 rounded-full shadow-sm text-sm font-bold text-amber-800"
        >
          <HelpCircle size={15} className="text-amber-500 animate-pulse" />
          {screen === 'top' && <span>「何をしたいですか？」</span>}
          {screen === 'register' && <span>「どのように登録しますか？」</span>}
          {screen === 'search' && <span>「何を調べたいですか？」</span>}
        </motion.div>
      </div>

      {/* DYNAMIC SCENARIOS VIEW */}
      <div className="flex-1 max-w-lg mx-auto w-full overflow-y-auto px-1 py-2">
        <AnimatePresence mode="wait">
          {screen === 'top' && (
            <motion.div
              key="top"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="space-y-4"
              id="assist-screen-top"
            >
              {/* Option 1: 欲しいものを登録する */}
              <motion.button
                variants={itemVariants}
                onClick={() => setScreen('register')}
                className="w-full relative group p-6 bg-gradient-to-br from-amber-50 to-amber-100/50 hover:from-amber-100/40 hover:to-amber-200/35 border-2 border-amber-200/60 hover:border-amber-400 rounded-[32px] transition-all transform active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer text-left flex items-center justify-between"
                id="assist-btn-register"
              >
                <div className="space-y-2 flex-1 min-w-0 pr-4">
                  <div className="inline-flex px-2 py-0.5 bg-amber-500 text-white font-extrabold text-[9px] rounded-md tracking-wider uppercase">
                    欲しい商品を伝える
                  </div>
                  <h3 className="text-xl font-extrabold text-amber-950 leading-none">
                    🎁 欲しいものを登録する
                  </h3>
                  <p className="text-xs text-amber-800/80 font-bold leading-normal">
                    いつもの商品の補充、または新しく入荷した商品のスキャンはこちらです。
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <PlusCircle size={24} />
                </div>
              </motion.button>

              {/* Option 2: 欲しいものを調べる */}
              <motion.button
                variants={itemVariants}
                onClick={() => setScreen('search')}
                className="w-full relative group p-6 bg-gradient-to-br from-blue-50 to-blue-150/40 hover:from-blue-100/40 hover:to-blue-200/35 border-2 border-blue-200/60 hover:border-blue-400 rounded-[32px] transition-all transform active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer text-left flex items-center justify-between"
                id="assist-btn-search"
              >
                <div className="space-y-2 flex-1 min-w-0 pr-4">
                  <div className="inline-flex px-2 py-0.5 bg-blue-500 text-white font-extrabold text-[9px] rounded-md tracking-wider uppercase">
                    現在の状態をチェック
                  </div>
                  <h3 className="text-xl font-extrabold text-blue-950 leading-none">
                    🔍 欲しいものを調べる
                  </h3>
                  <p className="text-xs text-blue-800/80 font-bold leading-normal">
                    補充リストの確認、伝言板メッセージの確認、商品マスタの確認はこちらです。
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform relative">
                  <Search size={24} />
                  {unreadBbsCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white text-[8px] font-black items-center justify-center text-white scale-110">
                        {unreadBbsCount}
                      </span>
                    </span>
                  )}
                </div>
              </motion.button>
            </motion.div>
          )}

          {screen === 'register' && (
            <motion.div
              key="register"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="space-y-4"
              id="assist-screen-register"
            >
              {/* Option 2-1: いつもの商品が欲しい */}
              <motion.button
                variants={itemVariants}
                onClick={() => onSelect('quick')}
                className="w-full relative group p-5 bg-white hover:bg-amber-50/50 border-2 border-gray-200/65 hover:border-amber-400 rounded-[28px] transition-all transform active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer text-left flex items-center justify-between"
                id="assist-btn-std"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="text-lg font-black text-gray-900 leading-tight mb-1 flex items-center gap-1.5">
                    ⭐ いつもの商品が欲しい 
                  </h4>
                  <p className="text-xs text-gray-500 font-bold leading-normal">
                    定番（STD）リストから商品を選んで、ボタンをタップするだけで補充依頼します。
                  </p>
                </div>
                <div className="p-3.5 bg-amber-100 text-amber-600 rounded-2xl font-black text-xs shrink-0 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>進む</span>
                  <ChevronRight size={14} strokeWidth={2.5} />
                </div>
              </motion.button>

              {/* Option 2-2: かわった商品が欲しい */}
              <motion.button
                variants={itemVariants}
                onClick={() => onSelect('scan')}
                className="w-full relative group p-5 bg-white hover:bg-amber-50/50 border-2 border-gray-200/65 hover:border-amber-400 rounded-[28px] transition-all transform active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer text-left flex items-center justify-between"
                id="assist-btn-custom"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="text-lg font-black text-gray-900 leading-tight mb-1 flex items-center gap-1.5">
                    📸 かわった商品が欲しい
                  </h4>
                  <p className="text-xs text-gray-500 font-bold leading-normal">
                    バーコードをスキャンしたり、数字を手入力して特別な商品の補充依頼を登録します。
                  </p>
                </div>
                <div className="p-3.5 bg-amber-100 text-amber-600 rounded-2xl font-black text-xs shrink-0 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>進む</span>
                  <ChevronRight size={14} strokeWidth={2.5} />
                </div>
              </motion.button>

              {/* Back button */}
              <motion.button
                variants={itemVariants}
                onClick={() => setScreen('top')}
                className="w-full py-4.5 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 border border-slate-300/40 cursor-pointer"
                id="assist-btn-back-to-top"
              >
                <ArrowLeft size={16} strokeWidth={3} />
                <span>戻る</span>
              </motion.button>
            </motion.div>
          )}

          {screen === 'search' && (
            <motion.div
              key="search"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="space-y-4"
              id="assist-screen-search"
            >
              {/* Option 3-1: 必要なものを探す */}
              <motion.button
                variants={itemVariants}
                onClick={() => onSelect('view')}
                className="w-full relative group p-5 bg-white hover:bg-blue-50/55 border-2 border-gray-200/65 hover:border-blue-400 rounded-[28px] transition-all transform active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer text-left flex items-center justify-between"
                id="assist-btn-find-needed"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="text-lg font-black text-gray-900 leading-tight mb-1 flex items-center gap-1.5">
                    📋 必要なものを探す
                  </h4>
                  <p className="text-xs text-gray-500 font-bold leading-normal">
                    現在補充リストに登録されている商品の確認や、完了チェック、並び替え等を行います。
                  </p>
                </div>
                <div className="p-3.5 bg-blue-100 text-blue-600 rounded-2xl font-black text-xs shrink-0 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>進む</span>
                  <ChevronRight size={14} strokeWidth={2.5} />
                </div>
              </motion.button>

              {/* Option 3-2: メッセージを確認する */}
              <motion.button
                variants={itemVariants}
                onClick={() => onSelect('bbs')}
                className="w-full relative group p-5 bg-white hover:bg-blue-50/55 border-2 border-gray-200/65 hover:border-blue-400 rounded-[28px] transition-all transform active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer text-left flex items-center justify-between"
                id="assist-btn-check-bbs"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="text-lg font-black text-gray-900 leading-tight mb-1 flex items-center gap-1.5">
                    💬 メッセージを確認する
                  </h4>
                  <p className="text-xs text-gray-500 font-bold leading-normal">
                    スタッフ間で連絡事項をやり取りするための伝言板・掲示板を開きます。
                  </p>
                </div>
                <div className="p-3.5 bg-blue-100 text-blue-600 rounded-2xl font-black text-xs shrink-0 flex items-center gap-1 group-hover:translate-x-1 transition-transform relative">
                  <span>進む</span>
                  <ChevronRight size={14} strokeWidth={2.5} />
                  {unreadBbsCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5">
                      <span className="relative inline-flex rounded-full h-4.5 w-4.5 bg-emerald-500 border-2 border-white text-[9px] font-black items-center justify-center text-white scale-110">
                        {unreadBbsCount}
                      </span>
                    </span>
                  )}
                </div>
              </motion.button>

              {/* Option 3-3: 商品情報を閲覧する */}
              <motion.button
                variants={itemVariants}
                onClick={() => onSelect('master')}
                className="w-full relative group p-5 bg-white hover:bg-blue-50/55 border-2 border-gray-200/65 hover:border-blue-400 rounded-[28px] transition-all transform active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer text-left flex items-center justify-between"
                id="assist-btn-read-master"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="text-lg font-black text-gray-900 leading-tight mb-1 flex items-center gap-1.5">
                    🗂️ 商品情報を閲覧する
                  </h4>
                  <p className="text-xs text-gray-500 font-bold leading-normal">
                    全ての商品が登録されているシステムマスタの閲覧や、新しい商品の登録・更新を行います。
                  </p>
                </div>
                <div className="p-3.5 bg-blue-100 text-blue-600 rounded-2xl font-black text-xs shrink-0 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>進む</span>
                  <ChevronRight size={14} strokeWidth={2.5} />
                </div>
              </motion.button>

              {/* Back button */}
              <motion.button
                variants={itemVariants}
                onClick={() => setScreen('top')}
                className="w-full py-4.5 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 border border-slate-300/40 cursor-pointer"
                id="assist-btn-back-to-top"
              >
                <ArrowLeft size={16} strokeWidth={3} />
                <span>戻る</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
    </div>
  );
}
