import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, ShieldAlert, KeyRound } from 'lucide-react';

interface PasscodeLockProps {
  onSuccess: () => void;
}

export default function PasscodeLock({ onSuccess }: PasscodeLockProps) {
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const correctPasscode = '3120';

  useEffect(() => {
    if (code.length === 4) {
      if (code === correctPasscode) {
        setIsSuccess(true);
        setError(false);
        // Delay onSuccess callback slightly to let success animation play
        const timer = setTimeout(() => {
          onSuccess();
        }, 600);
        return () => clearTimeout(timer);
      } else {
        setError(true);
        // Play error state briefly then clear code
        const timer = setTimeout(() => {
          setCode('');
          setError(false);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [code, onSuccess]);

  const handleKeyPress = (num: string) => {
    if (code.length < 4 && !error && !isSuccess) {
      setCode(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (code.length > 0 && !error && !isSuccess) {
      setCode(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (!error && !isSuccess) {
      setCode('');
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-gray-950 flex flex-col items-center justify-between p-6 select-none">
      {/* Decorative background element */}
      <div className="absolute inset-0 bg-radial-gradient from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      {/* App Header Title */}
      <div className="w-full text-center py-2 sm:py-3 z-10 select-none border-b border-gray-900/30">
        <span className="text-2xl sm:text-3xl font-black tracking-[0.25em] bg-gradient-to-r from-blue-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent font-mono">
          I.R.I.S
        </span>
      </div>

      {/* Header / Info Section */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-xs text-center z-10">
        <motion.div
          animate={
            error
              ? { x: [-10, 10, -10, 10, 0] }
              : isSuccess
              ? { scale: [1, 1.15, 1], rotate: [0, 10, -10, 0] }
              : { y: [0, -4, 0] }
          }
          transition={
            error
              ? { duration: 0.4 }
              : isSuccess
              ? { duration: 0.5 }
              : { repeat: Infinity, duration: 4, ease: "easeInOut" }
          }
          className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 border transition-colors ${
            error
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : isSuccess
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}
        >
          {error ? (
            <ShieldAlert size={28} />
          ) : isSuccess ? (
            <KeyRound size={28} className="animate-pulse" />
          ) : (
            <Lock size={28} />
          )}
        </motion.div>

        <h2 className="text-xl font-black tracking-wider text-white mb-2">
          {error ? 'パスコードが違います' : isSuccess ? 'ロック解除中...' : 'パスコードを入力'}
        </h2>
        
        <div className="flex flex-col items-center mb-8 gap-1.5">
          <div className="text-xs font-black text-amber-500 tracking-widest bg-amber-500/10 py-1 px-4 rounded-full border border-amber-500/20 select-none">
            ⚠️ NOTICE
          </div>
          <p className="text-[10px] text-gray-500 font-black tracking-widest uppercase">
            STAFF ONLY DO NOT ENTER
          </p>
        </div>

        {/* Bullet Indicators */}
        <div className="flex justify-center gap-6 my-4">
          {[0, 1, 2, 3].map((index) => {
            const isActive = code.length > index;
            return (
              <motion.div
                key={index}
                animate={
                  error
                    ? { scale: [1, 1.2, 1], backgroundColor: ['#ef4444', '#ef4444'] }
                    : isSuccess
                    ? { scale: [1, 1.3, 1], backgroundColor: ['#22c55e', '#22c55e'] }
                    : isActive
                    ? { scale: 1.15 }
                    : { scale: 1 }
                }
                transition={{ duration: 0.2 }}
                className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-200 ${
                  isActive
                    ? error
                      ? 'bg-red-500 border-red-500 shadow-lg shadow-red-500/30'
                      : isSuccess
                      ? 'bg-green-500 border-green-500 shadow-lg shadow-green-500/30'
                      : 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-500/35'
                    : 'border-gray-800 bg-transparent'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Tenkey Numeric Keyboard */}
      <div className="w-full max-w-sm z-10 pb-8 sm:pb-12">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <motion.button
              key={num}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleKeyPress(num.toString())}
              className="aspect-[1.5/1] sm:aspect-[1.6/1] bg-gray-900/80 hover:bg-gray-800 text-white font-black text-2xl rounded-2xl flex items-center justify-center transition-colors shadow-lg border border-gray-800/40"
            >
              {num}
            </motion.button>
          ))}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleClear}
            className="aspect-[1.5/1] sm:aspect-[1.6/1] bg-gray-950 hover:bg-red-950/20 text-gray-500 hover:text-red-400 font-bold text-sm rounded-2xl flex items-center justify-center transition-all border border-transparent hover:border-red-900/10"
          >
            クリア
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => handleKeyPress('0')}
            className="aspect-[1.5/1] sm:aspect-[1.6/1] bg-gray-900/80 hover:bg-gray-800 text-white font-black text-2xl rounded-2xl flex items-center justify-center transition-colors shadow-lg border border-gray-800/40"
          >
            0
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleBackspace}
            className="aspect-[1.5/1] sm:aspect-[1.6/1] bg-gray-950 hover:bg-gray-900 text-gray-500 hover:text-white rounded-2xl flex items-center justify-center transition-all active:scale-95 border border-transparent"
          >
            <Delete size={22} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
