import React from 'react';
import { Scan, Eye, Edit3, LayoutGrid } from 'lucide-react';
import { motion } from 'motion/react';
import { AppMode } from '../types';

interface ModeSelectorProps {
  onSelect: (mode: AppMode) => void;
}

export default function ModeSelector({ onSelect }: ModeSelectorProps) {
  const modes = [
    { id: 'scan' as AppMode, label: 'スキャン', icon: Scan, color: 'bg-blue-600', desc: '依頼入力' },
    { id: 'quick' as AppMode, label: '定番商品', icon: LayoutGrid, color: 'bg-amber-500', desc: 'リストから選択' },
    { id: 'view' as AppMode, label: '閲覧', icon: Eye, color: 'bg-green-600', desc: '状況確認' },
    { id: 'edit' as AppMode, label: '編集', icon: Edit3, color: 'bg-orange-600', desc: '完了・修正' },
  ];

  return (
    <div className="flex flex-col h-screen max-h-screen p-4 bg-gray-50 overflow-hidden">
      <header className="py-8 text-center shrink-0">
        <h1 className="text-5xl font-black text-blue-600 tracking-tighter">I.R.I.S</h1>
        <p className="text-[11px] text-gray-400 font-medium uppercase mt-2 tracking-[0.25em] leading-none font-condensed">
          Inventory Replenishment Information System
        </p>
      </header>

      <div className="flex-1 flex flex-col gap-3 max-w-lg mx-auto w-full pb-6">
        {modes.map((mode) => (
          <motion.button
            key={mode.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(mode.id)}
            className="flex-1 flex items-center p-6 bg-white rounded-[32px] shadow-lg shadow-gray-200/50 border border-white transition-all active:shadow-none min-h-0"
            id={`mode-btn-${mode.id}`}
          >
            <div className={`${mode.color} p-4 rounded-2xl text-white mr-6 shrink-0`}>
              <mode.icon size={28} />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-black text-gray-900 leading-tight">{mode.label}</h2>
              <p className="text-sm text-gray-500 font-medium mt-0.5">{mode.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
