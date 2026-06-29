/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRight, Landmark } from 'lucide-react';

interface SplashScreenProps {
  onStart: () => void;
  settings?: any;
}

export default function SplashScreen({ onStart, settings }: SplashScreenProps) {
  const appName = settings?.appName || 'ন্যানো-ফাইন্যান্স';
  return (
    <div className="relative flex flex-col justify-between h-full bg-[#0a0a0a] text-[#e0e0e0] p-6 overflow-hidden select-none">
      {/* Decorative concentric circles with subtle gold-bronze lines */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-zinc-900 pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-zinc-850/50 pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-[#c5a059]/5 pointer-events-none animate-pulse" />

      {/* Top Margin Spacer */}
      <div className="h-6" />

      {/* Center Logo branding */}
      <div className="flex flex-col items-center justify-center flex-grow text-center animate-fade-in z-10">
        <div className="relative flex items-center justify-center w-20 h-20 bg-zinc-900/90 rounded-2xl border border-[#c5a059]/20 mb-6 shadow-2xl">
          <Landmark className="w-10 h-10 text-[#c5a059]" />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#c5a059]/40 rounded-full border-2 border-zinc-950 animate-ping" />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#c5a059] rounded-full border-2 border-zinc-950" />
        </div>

        <span className="text-[#c5a059] text-[9px] uppercase tracking-[0.25em] font-semibold mb-2 block italic">Est. 2026</span>
        <h1 className="text-3xl font-serif italic leading-none text-white mb-2 tracking-tight">
          {appName}
        </h1>
        <p className="text-xs text-zinc-500 tracking-wide font-sans mt-1">
          আপনার স্বপ্ন, আমাদের পরিশীলিত অঙ্গীকার
        </p>
      </div>

      {/* Footer and interactive starter button */}
      <div className="flex flex-col items-center gap-5 pb-6 z-10">
        <button
          onClick={onStart}
          id="btn-splash-start"
          className="group flex items-center justify-between w-full bg-[#c5a059] text-zinc-950 hover:bg-[#dfc187] py-3.5 px-5 rounded-xl font-bold tracking-wide transition-all duration-300"
        >
          <span className="font-sans text-xs uppercase tracking-wider">অ্যাপে প্রবেশ করুন</span>
          <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="text-[10px] text-zinc-600 font-mono tracking-wider">
          Secured Microfinance • Refined Dark
        </p>
      </div>
    </div>
  );
}
