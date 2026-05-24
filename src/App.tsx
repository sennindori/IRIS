/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppMode } from './types';
import ModeSelector from './components/ModeSelector';
import ScannerMode from './components/ScannerMode';
import ViewEditMode from './components/ViewEditMode';
import QuickMode from './components/QuickMode';
import PasscodeLock from './components/PasscodeLock';
import UsernameSetup from './components/UsernameSetup';
import BBSMode from './components/BBSMode';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';

export default function App() {
  const [mode, setMode] = useState<AppMode>('menu');
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
    setLoading(false);
  }, []);

  // Real-time tracking of unread BBS posts for badge
  useEffect(() => {
    if (!username) {
      setUnreadBbsCount(0);
      return;
    }

    const q = query(collection(db, 'bbs_messages'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        const readBy = data.readBy || [];
        const isAuthor = data.author === username;
        const isRead = readBy.includes(username);
        
        if (!isAuthor && !isRead) {
          count++;
        }
      });
      setUnreadBbsCount(count);
    }, (error) => {
      console.error('BBS unread count subscription failed:', error);
    });

    return () => unsubscribe();
  }, [username]);

  const handlePasscodeSuccess = () => {
    localStorage.setItem('app_passcode_verified', 'true');
    setIsAuthorized(true);
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

  if (!username) {
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
          >
            <ModeSelector
              onSelect={setMode}
              onLock={handleLock}
              username={username}
              unreadBbsCount={unreadBbsCount}
              onChangeUsername={(name) => {
                localStorage.setItem('app_username', name);
                setUsername(name);
              }}
            />
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
            <BBSMode onBack={() => setMode('menu')} username={username} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
