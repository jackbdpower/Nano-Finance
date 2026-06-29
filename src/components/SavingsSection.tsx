/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TrendingUp, Plus, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Transaction } from '../types';

interface SavingsSectionProps {
  savingsBalance: number;
  transactions: Transaction[];
  onNavigate: (screen: any) => void;
}

export default function SavingsSection({ savingsBalance, transactions, onNavigate }: SavingsSectionProps) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const formatBDT = (amount: number) => {
    return `৳ ${amount.toLocaleString('bn-BD')}`;
  };

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  // Dynamic calculations based on real user actions
  const activeTransactions = transactions || [];
  
  const thisMonthDepositsVal = activeTransactions
    .filter(tx => tx.type === 'deposit' && tx.status === 'completed')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalWithdrawalsVal = activeTransactions
    .filter(tx => tx.type === 'withdraw' && tx.status === 'completed')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const profitReceivedVal = Math.round(savingsBalance * 0.05);
  const availableBalanceVal = savingsBalance;

  // Savings Graph Data Points (January to June)
  const graphPoints = [
    { month: 'জানু', val: 120000, x: 20, y: 120 },
    { month: 'ফেব্রু', val: 140000, x: 80, y: 100 },
    { month: 'মার্চ', val: 135000, x: 140, y: 110 },
    { month: 'এপ্রিল', val: 170000, x: 200, y: 70 },
    { month: 'মে', val: 190000, x: 260, y: 50 },
    { month: 'জুন', val: 250000, x: 320, y: 15 },
  ];

  // SVG dimensions
  const svgWidth = 340;
  const svgHeight = 140;

  // Render SVG Path dynamically
  const pathD = graphPoints.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    // Creating cubic bezier curves for smooth layout representation shown in Screen 4
    const prev = graphPoints[i - 1];
    const cp1x = prev.x + (p.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (p.x - prev.x) / 2;
    const cp2y = p.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
  }, '');

  return (
    <div className="flex flex-col h-full bg-[#0a0a09] text-zinc-300 select-none overflow-y-auto no-scrollbar pb-6 px-5">
      {/* Upper header title status */}
      <div className="pt-5 pb-3">
        <h3 className="text-md font-serif italic text-white tracking-tight">
          সঞ্চয় ড্যাশবোর্ড
        </h3>
        <p className="text-xs text-zinc-400 font-sans mt-1">আপনার সঞ্চয় হিসাব সংক্ষেপ ও বিশ্লেষণ</p>
      </div>

      {/* Screen 4 Savings Amount Card Block */}
      <div className="relative bg-[#121214] text-white p-5 rounded-3xl border border-zinc-800 overflow-hidden mt-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#c5a059]/5 rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <span className="text-xs uppercase tracking-widest text-[#dfc187] font-sans font-bold block">মোট সঞ্চয়</span>
        <h2 className="text-2xl font-serif italic text-white mt-1 tracking-tight">
          {formatBDT(savingsBalance)}
        </h2>
        <div className="border-t border-zinc-800 mt-4 pt-3 flex justify-between items-center text-xs text-zinc-455">
          <span className="font-mono text-xs">হিসাব নম্বর: {toBanglaDigits('1234567890')}</span>
          <span className="bg-[#c5a059]/10 text-[#dfc187] border border-[#c5a059]/20 px-2 py-0.5 rounded-full font-sans font-bold text-xs">সক্রিয়</span>
        </div>
      </div>

      {/* Stats micro-cards grids */}
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <div className="bg-[#111113] p-3 rounded-xl border border-zinc-850/80 flex flex-col justify-between">
          <span className="text-xs text-zinc-350 font-sans font-semibold">এই মাসের জমা</span>
          <span className="text-sm font-bold text-zinc-100 font-sans mt-1">{formatBDT(thisMonthDepositsVal)}</span>
        </div>
        <div className="bg-[#111113] p-3 rounded-xl border border-zinc-850/80 flex flex-col justify-between">
          <span className="text-xs text-zinc-350 font-sans font-semibold">মোট উত্তোলন</span>
          <span className="text-sm font-bold text-zinc-100 font-sans mt-1">{formatBDT(totalWithdrawalsVal)}</span>
        </div>
        <div className="bg-[#111113] p-3 rounded-xl border border-zinc-850/80 flex flex-col justify-between">
          <span className="text-xs text-zinc-350 font-sans font-semibold">মুনাফা (প্রাপ্ত)</span>
          <span className="text-sm font-bold text-emerald-400 font-sans mt-1">{formatBDT(profitReceivedVal)}</span>
        </div>
        <div className="bg-[#111113] p-3 rounded-xl border border-[#c5a059]/20 flex flex-col justify-between bg-[#c5a059]/5">
          <span className="text-xs text-zinc-300 font-sans font-bold">উপলব্ধ ব্যালেন্স</span>
          <span className="text-sm font-bold text-[#dfc187] font-sans mt-1">{formatBDT(availableBalanceVal)}</span>
        </div>
      </div>

      {/* Screen 4 Core Action Buttons deposit/withdrawal */}
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <button
          onClick={() => onNavigate('deposit')}
          id="btn-savings-deposit"
          className="flex items-center justify-center gap-1.5 bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3 px-4 rounded-xl font-bold text-xs shadow-xs transition-colors font-sans cursor-pointer"
        >
          <Plus className="w-4 h-4 cursor-pointer" />
          টাকা জমা দিন
        </button>

        <button
          onClick={() => onNavigate('withdraw')}
          id="btn-savings-withdraw"
          className="flex items-center justify-center gap-1.5 bg-[#141416] hover:bg-zinc-800 text-zinc-200 border border-zinc-700 py-3 px-4 rounded-xl font-bold text-xs shadow-xs transition-colors font-sans cursor-pointer"
        >
          <Minus className="w-4 h-4 cursor-pointer" />
          টাকা উত্তোলন
        </button>
      </div>

      {/* Screen 4 Savings Graph Trends */}
      <div className="bg-[#111113] rounded-2xl p-4 border border-zinc-850/80 mt-4 flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-xs font-bold text-zinc-400 font-sans flex items-center gap-1.5 tracking-wider uppercase">
            <TrendingUp className="w-4 h-4 text-[#c5a059]" />
            সঞ্চয়ের গ্রাফ (৬ মাস)
          </h4>
          {selectedPoint !== null && (
            <span className="text-xs text-[#0a0a09] bg-[#c5a059] px-2.5 py-0.5 rounded-full font-black font-sans transition-all">
              {graphPoints[selectedPoint].month}: {formatBDT(graphPoints[selectedPoint].val)}
            </span>
          )}
        </div>

        {/* Vector SVG Graph implementation */}
        <div className="relative h-36 bg-zinc-950/40 border border-zinc-900 rounded-xl p-2 pt-4">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
            {/* Horizontal Gridlines */}
            <line x1="0" y1="20" x2={svgWidth} y2="20" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.04" />
            <line x1="0" y1="65" x2={svgWidth} y2="65" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.04" />
            <line x1="0" y1="110" x2={svgWidth} y2="110" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.04" />

            {/* Gradient background under path */}
            <path
              d={`${pathD} L ${graphPoints[graphPoints.length - 1].x} ${svgHeight - 10} L ${graphPoints[0].x} ${svgHeight - 10} Z`}
              fill="url(#savingsGradient)"
              opacity="0.1"
            />

            {/* Trend Curve Path line */}
            <path d={pathD} fill="none" stroke="#c5a059" strokeWidth="2.5" strokeLinecap="round" />

            {/* Interactive Points mapping */}
            {graphPoints.map((p, idx) => (
              <g key={idx} className="cursor-pointer">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={selectedPoint === idx ? '5.5' : '3.5'}
                  fill={selectedPoint === idx ? '#c5a059' : '#0a0a0a'}
                  stroke="#c5a059"
                  strokeWidth="2"
                  onMouseEnter={() => setSelectedPoint(idx)}
                  onMouseLeave={() => setSelectedPoint(null)}
                  onClick={() => setSelectedPoint(idx)}
                  className="transition-all"
                />
              </g>
            ))}

            {/* Gradients defs */}
            <defs>
              <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c5a059" />
                <stop offset="100%" stopColor="#c5a059" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Month labels footer */}
          <div className="flex justify-between px-2 mt-1">
            {graphPoints.map((p, idx) => (
              <span
                key={idx}
                className={`text-xs font-sans font-medium ${selectedPoint === idx ? 'text-[#c5a059] font-bold' : 'text-zinc-400'}`}
              >
                {p.month}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Screen 4 Recent Transactions List section */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-xs font-bold text-zinc-400 font-sans tracking-wider uppercase">সাম্প্রতিক লেনদেন</h4>
          <button
            onClick={() => onNavigate('transaction_history')}
            id="link-savings-all-txs"
            className="text-xs text-[#c5a059] font-sans hover:underline cursor-pointer"
          >
            সব দেখুন &gt;
          </button>
        </div>

        {/* List of latest items */}
        <div className="flex flex-col gap-2">
          {transactions.slice(0, 3).map((tx) => {
            const isAddValue = tx.type === 'deposit' || tx.type === 'loan_disburse';
            return (
              <div
                key={tx.id}
                className="bg-[#121214] p-3 rounded-xl border border-zinc-850 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${isAddValue ? 'bg-emerald-950/20 border border-emerald-900/35 text-emerald-400' : 'bg-rose-950/20 border border-rose-900/35 text-rose-400'}`}
                  >
                    {isAddValue ? <ArrowUpRight className="w-4.5 h-4.5" /> : <ArrowDownRight className="w-4.5 h-4.5" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-200 font-sans">{tx.titleBangla}</p>
                    <p className="text-[11px] text-zinc-400 font-sans mt-0.5">{tx.date}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-xs font-extrabold font-mono ${isAddValue ? 'text-emerald-450' : 'text-rose-450'}`}>
                    {isAddValue ? '+' : '-'} {formatBDT(tx.amount)}
                  </p>
                  <span className="text-[11px] bg-zinc-900 border border-zinc-850 text-zinc-300 px-1.5 py-0.2 rounded font-sans">
                    সফল
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
