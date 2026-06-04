/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppMode } from './types';
import ModeSelector from './components/ModeSelector';
import AssistModeSelector from './components/AssistModeSelector';
import ScannerMode from './components/ScannerMode';
import ViewEditMode from './components/ViewEditMode';
import QuickMode from './components/QuickMode';
import PasscodeLock from './components/PasscodeLock';
import UsernameSetup from './components/UsernameSetup';
import BBSMode from './components/BBSMode';
import MasterMode from './components/MasterMode';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import { HelpCircle, ChevronRight, Sparkles, LayoutGrid } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<AppMode>('menu');
  const [subMode, setSubMode] = useState<'selection' | 'assist' | 'advanced'>('selection');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [unreadBbsCount, setUnreadBbsCount] = useState<number>(0);

  useEffect(() => {
    const verified = localStorage.getItem('app_passcode_verified');
    if (verified === 'true') {
      setIsAuthorized(true);
    }
    const savedName = localStorage.getItem('app_username') || '';
    setUsername(savedName);
    
    const savedSubMode = localStorage.getItem('app_sub_mode');
    if (savedSubMode === 'assist' || savedSubMode === 'advanced') {
      setSubMode(savedSubMode as 'assist' | 'advanced');
    } else {
      setSubMode('selection');
    }
    setLoading(false);
  }, []);

  const savedUsername = localStorage.getItem('app_username') || '';
  const displayUsername = username || savedUsername;

  // Sync state if username state is empty but we have a saved username in localStorage
  if (!username && savedUsername) {
    setUsername(savedUsername);
  }

  // Real-time tracking of unread BBS posts for badge
  useEffect(() => {
    if (!displayUsername) {
      setUnreadBbsCount(0);
      return;
    }

    const q = query(collection(db, 'bbs_messages'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        const readBy = data.readBy || [];
        const isAuthor = data.author === displayUsername;
        const isRead = readBy.includes(displayUsername);
        
        if (!isAuthor && !isRead) {
          count++;
        }
      });
      setUnreadBbsCount(count);
    }, (error) => {
      console.error('BBS unread count subscription failed:', error);
    });

    return () => unsubscribe();
  }, [displayUsername]);

  const handlePasscodeSuccess = () => {
    localStorage.setItem('app_passcode_verified', 'true');
    setIsAuthorized(true);
    
    // Explicitly load and set username right after successful passcode validation
    const savedName = localStorage.getItem('app_username') || '';
    if (savedName) {
      setUsername(savedName);
    }
  };

  const handleLock = () => {
    localStorage.removeItem('app_passcode_verified');
    setIsAuthorized(false);
    setMode('menu');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return <PasscodeLock onSuccess={handlePasscodeSuccess} />;
  }

  if (!username && !savedUsername) {
    return (
      <UsernameSetup
        onSuccess={(name) => {
          localStorage.setItem('app_username', name);
          setUsername(name);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans antialiased text-gray-900 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {mode === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            {subMode === 'selection' && (
              <div className="flex flex-col h-[100dvh] max-h-[100dvh] p-6 bg-slate-50 overflow-hidden select-none">
                <header className="py-4 text-center shrink-0">
                  <h1 className="text-3xl font-black text-blue-600 tracking-tighter">I.R.I.S</h1>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Inventory Replenishment Information System
                  </p>
                </header>

                <div className="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full gap-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-black text-gray-800">
                      操作モードを選んでください
                    </h2>
                    <p className="text-xs text-gray-500 font-bold leading-relaxed px-4">
                      ご自身の習熟状況に合わせて最適な操作メニューをはじめます。<br />
                      設定は後からいつでも左上のボタンで切り替え可能です。
                    </p>
                  </div>

                  <div className="w-full flex flex-col gap-4">
                    {/* アシストモード */}
                    <button
                      onClick={() => {
                        setSubMode('assist');
                        localStorage.setItem('app_sub_mode', 'assist');
                      }}
                      className="group relative p-6 bg-white hover:bg-amber-50/10 border border-amber-500/30 hover:border-amber-500 rounded-[28px] transition-all transform active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer text-left flex items-start gap-4"
                      id="select-assist-mode"
                    >
                      <div className="p-3.5 bg-amber-500 text-white rounded-2xl shrink-0 shadow-sm mt-0.5">
                        <Sparkles size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            おすすめ
                          </span>
                          <h3 className="text-lg font-black text-gray-950 leading-none">
                            アシストモード
                          </h3>
                        </div>
                        <p className="text-[11px] text-gray-500 font-bold mt-2 leading-relaxed">
                          機能名ではなく、やりたこと（補充、調べる）から選んで直感的に操作できる初心者用メニュー。
                        </p>
                      </div>
                    </button>

                    {/* アドバンスドモード */}
                    <button
                      onClick={() => {
                        setSubMode('advanced');
                        localStorage.setItem('app_sub_mode', 'advanced');
                      }}
                      className="group relative p-6 bg-white hover:bg-indigo-50/10 border border-indigo-500/25 hover:border-indigo-500 rounded-[28px] transition-all transform active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer text-left flex items-start gap-4"
                      id="select-advanced-mode"
                    >
                      <div className="p-3.5 bg-indigo-600 text-white rounded-2xl shrink-0 shadow-sm mt-0.5">
                        <LayoutGrid size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-gray-950 leading-none mb-1">
                          アドバンスドモード
                        </h3>
                        <p className="text-[11px] text-gray-500 font-bold mt-2 leading-relaxed">
                          すべての管理業務やスキャン、定番補充、チェックリスト等に直接アクセスできる、通常業務用のメニュー。
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <footer className="mt-auto text-center py-2 shrink-0 text-[10px] text-gray-400 font-bold">
                  ログインアカウント: {displayUsername}
                </footer>
              </div>
            )}
            {subMode === 'assist' && (
              <AssistModeSelector
                onSelect={setMode}
                onToggleSubMode={() => {
                  setSubMode('advanced');
                  localStorage.setItem('app_sub_mode', 'advanced');
                }}
                username={displayUsername}
                unreadBbsCount={unreadBbsCount}
                onChangeUsername={(name) => {
                  localStorage.setItem('app_username', name);
                  setUsername(name);
                }}
                onLock={handleLock}
              />
            )}
            {subMode === 'advanced' && (
              <ModeSelector
                onSelect={setMode}
                onLock={handleLock}
                username={displayUsername}
                unreadBbsCount={unreadBbsCount}
                onChangeUsername={(name) => {
                  localStorage.setItem('app_username', name);
                  setUsername(name);
                }}
                onToggleSubMode={() => {
                  setSubMode('assist');
                  localStorage.setItem('app_sub_mode', 'assist');
                }}
              />
            )}
          </motion.div>
        )}

        {mode === 'scan' && (
          <motion.div
            key="scan"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-white"
          >
            <ScannerMode onBack={() => setMode('menu')} />
          </motion.div>
        )}

        {mode === 'view' && (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-950"
          >
            <ViewEditMode initialTab="view" onBack={() => setMode('menu')} />
          </motion.div>
        )}

        {mode === 'edit' && (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-950"
          >
            <ViewEditMode initialTab="edit" onBack={() => setMode('menu')} />
          </motion.div>
        )}

        {mode === 'quick' && (
          <motion.div
            key="quick"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-gray-50"
          >
            <QuickMode onBack={() => setMode('menu')} />
          </motion.div>
        )}

        {mode === 'bbs' && (
          <motion.div
            key="bbs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 bg-gray-50"
          >
            <BBSMode onBack={() => setMode('menu')} username={displayUsername} />
          </motion.div>
        )}

        {mode === 'master' && (
          <motion.div
            key="master"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-gray-950"
          >
            <MasterMode onBack={() => setMode('menu')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
