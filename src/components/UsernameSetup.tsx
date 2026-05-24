import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, ArrowRight } from 'lucide-react';

interface UsernameSetupProps {
  onSuccess: (username: string) => void;
}

export default function UsernameSetup({ onSuccess }: UsernameSetupProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('ユーザー名を入力してください');
      return;
    }
    if (trimmed.length > 20) {
      setError('ユーザー名は20文字以内で入力してください');
      return;
    }
    onSuccess(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-gray-950 flex flex-col items-center justify-center p-6 select-none">
      {/* Decorative background element */}
      <div className="absolute inset-0 bg-radial-gradient from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-sm bg-gray-900/40 border border-gray-800/60 p-6 sm:p-8 rounded-3xl backdrop-blur-md shadow-xl z-10 flex flex-col items-center">
        {/* Header Icon */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-6"
        >
          <User size={28} />
        </motion.div>

        <h2 className="text-xl font-black tracking-wider text-white mb-2 text-center">
          ユーザー名を入力
        </h2>
        <p className="text-xs text-gray-400 font-bold mb-6 text-center leading-relaxed">
          報告や連絡を共有する際に使用されます。<br />
          同僚が認識しやすい名前（名字など）にしてください。
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
              }}
              placeholder="例: 山田"
              className="w-full bg-gray-950 border border-gray-800 text-white font-bold placeholder-gray-600 rounded-2xl px-5 py-3.5 outline-none focus:border-blue-500 transition-colors text-center text-lg"
              autoFocus
              maxLength={20}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 font-bold text-center mt-1">
              {error}
            </p>
          )}

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-base py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors mt-2 hover:shadow-lg hover:shadow-blue-500/10 active:scale-95"
          >
            設定完了
            <ArrowRight size={18} />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
