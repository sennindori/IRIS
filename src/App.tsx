/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppMode } from './types';
import ModeSelector from './components/ModeSelector';
import ScannerMode from './components/ScannerMode';
import ViewMode from './components/ViewMode';
import EditMode from './components/EditMode';
import QuickMode from './components/QuickMode';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [mode, setMode] = useState<AppMode>('menu');

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
            <ModeSelector onSelect={setMode} />
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
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-50 bg-gray-950"
          >
            <ViewMode onBack={() => setMode('menu')} />
          </motion.div>
        )}

        {mode === 'edit' && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 bg-gray-50"
          >
            <EditMode onBack={() => setMode('menu')} />
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
      </AnimatePresence>
    </div>
  );
}
