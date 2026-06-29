/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Bell, HelpCircle, FileText, PiggyBank, Landmark, Users, Sliders } from 'lucide-react';
import { User } from '../types';

interface HomeSectionProps {
  user: User;
  onNavigate: (screen: any) => void;
  savingsBalance: number;
  unreadCount: number;
  settings?: any;
}

export default function HomeSection({ user, onNavigate, savingsBalance, unreadCount, settings }: HomeSectionProps) {
  // Read dynamic limit configuration settings from admin customization
  const minLoanAmount = settings?.minLoanAmount ?? 10000;
  const maxLoanAmount = settings?.maxLoanAmount ?? 200000;
  const rawLoanPresets = settings?.loanAmountPresets ?? "20000, 30000, 50000, 100000";
  
  const minLoanMonths = settings?.minLoanMonths ?? 3;
  const maxLoanMonths = settings?.maxLoanMonths ?? 18;
  const rawMonthPresets = settings?.loanMonthPresets ?? "3, 6, 9, 12";

  // Calculator States matching Setup precisely with bounds
  const [loanAmount, setLoanAmount] = useState<number>(200000);
  const [months, setMonths] = useState<number>(12);
  const [emi, setEmi] = useState<number>(19000);
  const [totalRepay, setTotalRepay] = useState<number>(228000);

  // Sync state boundaries on settings load / update
  useEffect(() => {
    if (loanAmount < minLoanAmount) {
      setLoanAmount(minLoanAmount);
    } else if (loanAmount > maxLoanAmount) {
      setLoanAmount(maxLoanAmount);
    }
  }, [minLoanAmount, maxLoanAmount]);

  useEffect(() => {
    if (months < minLoanMonths) {
      setMonths(minLoanMonths);
    } else if (months > maxLoanMonths) {
      setMonths(maxLoanMonths);
    }
  }, [minLoanMonths, maxLoanMonths]);

  // Parse preset values safely
  const loanAmountPresets = rawLoanPresets
    .split(',')
    .map((x: string) => parseInt(x.trim(), 10))
    .filter((x: number) => !isNaN(x) && x >= minLoanAmount && x <= maxLoanAmount);

  const loanMonthPresets = rawMonthPresets
    .split(',')
    .map((x: string) => parseInt(x.trim(), 10))
    .filter((x: number) => !isNaN(x) && x >= minLoanMonths && x <= maxLoanMonths);

  // Proportional dynamic interest rate from website customisation settings
  const annualInterestRate = settings?.interestRate ?? 14;
  const interestRate = parseFloat(((annualInterestRate * months) / 12).toFixed(2));

  const formatBDT = (amount: number) => {
    return `৳ ${Math.round(amount).toLocaleString('bn-BD')}`;
  };

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  const getAmountBanglaLabel = (amt: number) => {
    if (amt === 100000) return '১ লক্ষ';
    if (amt === 200000) return '২ লক্ষ';
    if (amt === 300000) return '৩ লক্ষ';
    if (amt === 150000) return '১.৫ লক্ষ';
    if (amt >= 1000 && amt < 100000) {
      const thousand = amt / 1000;
      return `${toBanglaDigits(thousand)} হাজার`;
    }
    return toBanglaDigits(amt.toLocaleString('bn-BD'));
  };

  const getBoundaryMonthsLabel = (m: number) => {
    if (m === 12) return '১২ মাস (১ বছর)';
    if (m === 18) return '১৮ মাস (১.৫ বছর)';
    if (m === 24) return '২৪ মাস (২ বছর)';
    if (m === 36) return '৩৬ মাস (৩ বছর)';
    if (m % 12 === 0) {
      return `${toBanglaDigits(m)} মাস (${toBanglaDigits(m / 12)} বছর)`;
    }
    const yrs = (m / 12).toFixed(1);
    return `${toBanglaDigits(m)} মাস (${toBanglaDigits(yrs)} বছর)`;
  };

  // Perform EMI Calculation dynamically based on proportional simple interest rate on an annual basis
  useEffect(() => {
    const totalInterest = loanAmount * (interestRate / 100);
    const total = loanAmount + totalInterest;
    const calculatedEmi = total / months;
    setEmi(Math.round(calculatedEmi));
    setTotalRepay(Math.round(total));
  }, [loanAmount, months, interestRate]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a09] text-zinc-300 select-none overflow-y-auto no-scrollbar pb-6">
      {/* Top Profile block */}
      <div className="relative bg-[#0d0d0e] text-white pt-6 pb-12 px-5 rounded-b-3xl border-b border-zinc-900">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={user.avatarUrl}
                alt="Profile"
                className="w-11 h-11 rounded-full border-2 border-zinc-800 object-cover shadow-sm referrerpolicy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#c5a059] rounded-full border-2 border-[#0d0d0e]" />
            </div>
            <div>
              <div className="flex items-center gap-1.55">
                <p className="text-sm font-semibold tracking-tight font-sans">
                  {user.name}
                </p>
                <span className="bg-[#c5a059] text-zinc-950 text-[10px] items-center px-1.5 py-0.2 rounded-full font-sans font-bold shadow-xs">
                  VERIFIED
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">হিসাব নং: {toBanglaDigits(user.accountNo)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('notifications')}
              id="btn-home-notif"
              className="relative p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 rounded-xl transition-all"
            >
              <Bell className="w-4.5 h-4.5 text-zinc-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#c5a059] text-zinc-950 text-[10px] flex items-center justify-center font-sans font-black rounded-full">
                  {toBanglaDigits(unreadCount)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Dashboard Promotional Slide: Screen 3 Header */}
        <div className="bg-[#141416]/90 backdrop-blur-md rounded-2xl p-4 border border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex-grow">
            <h3 className="text-md font-serif italic text-white leading-snug">
              আপনার স্বপ্ন পূরণে<br />আমরা একসাথে
            </h3>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-3">
              সহজ শর্তে ঋণ, দ্রুত অনুমোদন<br />এবং সঞ্চয় নিয়ে {settings?.appName || 'ন্যানো-ফাইন্যান্স'}।
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate('loan_apply')}
                id="btn-promo-loan"
                className="bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-all font-sans cursor-pointer"
              >
                ঋণের আবেদন
              </button>
              <button
                onClick={() => onNavigate('savings')}
                id="btn-promo-savings"
                className="bg-[#1a1a1a] hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all font-sans cursor-pointer"
              >
                সঞ্চয় দেখুন
              </button>
            </div>
          </div>
          <div className="w-16 h-16 flex items-center justify-center bg-[#c5a059]/10 rounded-full border border-[#c5a059]/15">
            <Landmark className="w-7 h-7 text-[#c5a059]" />
          </div>
        </div>
      </div>

      {/* Floating Balance stats */}
      <div className="relative -mt-6 mx-5 bg-[#121214] rounded-2xl p-4 border border-zinc-800/80 flex justify-between items-center z-10 shadow-xl transition-all duration-300 hover:scale-[1.01]">
        <div>
          <p className="text-xs text-zinc-400 font-sans">সঞ্চয় স্থিতি</p>
          <p className="text-lg font-serif italic font-medium text-[#dfc187] tracking-tight mt-0.5">
            {formatBDT(savingsBalance)}
          </p>
        </div>
        <button
          onClick={() => onNavigate('deposit')}
          id="btn-home-deposit"
          className="bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors font-sans cursor-pointer"
        >
          টাকা জমা দিন
        </button>
      </div>

      {/* Quick Action links */}
      <div className="mt-6 px-5">
        <h4 className="text-xs font-bold text-zinc-400 font-sans tracking-widest uppercase mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#c5a059]" />
          দ্রুত অ্যাক্সেস
        </h4>
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('loan_apply')}
            id="btn-quick-apply"
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-11 h-11 bg-[#c5a059]/10 text-[#dfc187] border border-[#c5a059]/15 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-zinc-300 font-sans text-center group-hover:text-zinc-100 truncate w-full">ঋণের আবেদন</span>
          </button>

          <button
            onClick={() => onNavigate('deposit')}
            id="btn-quick-deposit"
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-11 h-11 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
              <PiggyBank className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-zinc-300 font-sans text-center group-hover:text-zinc-100 truncate w-full">সঞ্চয় জমা</span>
          </button>

          <button
            onClick={() => onNavigate('loan_status')}
            id="btn-quick-status"
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-11 h-11 bg-amber-500/10 text-amber-500 border border-amber-500/15 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
              <Landmark className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-zinc-300 font-sans text-center group-hover:text-zinc-100 truncate w-full">আমার ঋণ</span>
          </button>

          <button
            onClick={() => {
              if (settings?.whatsappNumber) {
                let cleaned = settings.whatsappNumber.replace(/[^0-9]/g, '');
                if (cleaned.startsWith('0') && cleaned.length === 11) {
                  cleaned = '88' + cleaned;
                }
                window.open(`https://api.whatsapp.com/send?phone=${cleaned}`, '_blank');
              } else {
                alert('সাহায্য কেন্দ্র: ০৯৬১-২০০৩০০ হটলাইনে যোগাযোগ করুন অথবা আমাদের সাথে চ্যাট করতে পারেন। আমাদের অফিসিয়াল ইমেল: support@nanofinance.com');
              }
            }}
            id="btn-quick-help"
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-11 h-11 bg-zinc-800/20 text-zinc-400 border border-zinc-800/50 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 overflow-hidden p-1.5">
              {settings?.helpCenterLogo ? (
                <img 
                  src={settings.helpCenterLogo} 
                  alt="সহায়তা কেন্দ্র" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <HelpCircle className="w-4.5 h-4.5" />
              )}
            </div>
            <span className="text-xs font-bold text-zinc-300 font-sans text-center group-hover:text-zinc-100 truncate w-full">সহায়তা কেন্দ্র</span>
          </button>
        </div>
      </div>

      {/* Loan Calculator widget matching Screen 3 precisely */}
      <div className="mt-6 px-5 font-sans">
        <div className="bg-[#111113] rounded-2xl p-5 border border-zinc-850/80 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">ঋণ ক্যালকুলেটর</h4>
            <span className="text-[11px] text-[#dfc187] bg-[#c5a059]/10 px-2 py-0.5 rounded border border-[#c5a059]/15 uppercase font-semibold font-mono tracking-wider">EMI Simulator</span>
          </div>

          {/* Calculator Input sliders */}
          <div className="flex flex-col gap-3.5">
            {/* Amount Slider */}
            <div>
              <div className="flex justify-between items-center text-sm text-zinc-300 font-bold font-sans mb-1.55">
                <span>ঋণের পরিমাণ</span>
                <span className="font-bold text-[#dfc187] font-mono text-sm">{formatBDT(loanAmount)}</span>
              </div>
              <input
                type="range"
                min={minLoanAmount}
                max={maxLoanAmount}
                step={minLoanAmount >= 50000 ? 10000 : 5000}
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-[#c5a059]"
              />
              <div className="flex justify-between text-[11px] text-zinc-400 font-mono mt-1">
                <span>৳ {toBanglaDigits(minLoanAmount.toLocaleString('bn-BD'))}</span>
                <span>৳ {toBanglaDigits(maxLoanAmount.toLocaleString('bn-BD'))}</span>
              </div>

              {/* Dynamic Preset Suggestions */}
              {loanAmountPresets.length > 0 && (
                <div 
                  className="grid gap-2 mt-2.5"
                  style={{ gridTemplateColumns: `repeat(${loanAmountPresets.length}, minmax(0, 1fr))` }}
                >
                  {loanAmountPresets.map((val) => (
                    <button
                      key={val}
                      onClick={() => setLoanAmount(val)}
                      type="button"
                      className={`text-[10px] sm:text-[11px] py-1.5 px-1.5 rounded-lg font-sans text-center transition-all cursor-pointer truncate ${
                        loanAmount === val 
                          ? 'bg-[#c5a059] text-zinc-950 font-bold border border-[#c5a059] shadow-xs' 
                          : 'bg-[#18181b] border border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {getAmountBanglaLabel(val)}
                    </button>
                  ))}
                </div>
              )}
            </div>
 
            {/* Duration Slider */}
            <div>
              <div className="flex justify-between items-center text-sm text-zinc-300 font-bold font-sans mb-1.55">
                <span>মেয়াদ (মাস)</span>
                <span className="font-bold text-[#dfc187] font-sans text-sm">{toBanglaDigits(months)} মাস</span>
              </div>
              <input
                type="range"
                min={minLoanMonths}
                max={maxLoanMonths}
                step={1}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-[#c5a059]"
              />
              <div className="flex justify-between text-[11px] text-zinc-400 font-sans mt-1">
                <span>{toBanglaDigits(minLoanMonths)} মাস</span>
                <span>{getBoundaryMonthsLabel(maxLoanMonths)}</span>
              </div>
 
              {/* Dynamic Months Preset Suggestions */}
              {loanMonthPresets.length > 0 && (
                <div 
                  className="grid gap-2 mt-2.5"
                  style={{ gridTemplateColumns: `repeat(${loanMonthPresets.length}, minmax(0, 1fr))` }}
                >
                  {loanMonthPresets.map((val) => (
                    <button
                      key={val}
                      onClick={() => setMonths(val)}
                      type="button"
                      className={`text-[10px] sm:text-[11px] py-1.5 px-1.5 rounded-lg font-sans text-center transition-all cursor-pointer truncate ${
                        months === val 
                          ? 'bg-[#c5a059] text-zinc-950 font-bold border border-[#c5a059] shadow-xs' 
                          : 'bg-[#18181b] border border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {toBanglaDigits(val)} মাস
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Proportional Display matching LoanSection precisely */}
            <div className="bg-[#141416]/90 p-3.5 rounded-xl border border-zinc-850/80 shadow-3xs flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-zinc-300 font-sans block">ঋণের সুদের হার</span>
                <span className="text-[11px] text-zinc-400 font-sans mt-0.5 block">(১২ মাসের জন্য {toBanglaDigits(annualInterestRate)}% হারে আনুপাতিক হিসেব)</span>
              </div>
              <span className="text-xs font-bold text-[#dfc187] font-sans">{toBanglaDigits(interestRate)}% (স্থির)</span>
            </div>
          </div>

          {/* Calculator Output Display boxes */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850 flex flex-col justify-center">
              <span className="text-xs text-zinc-400 font-sans mb-1 font-medium">মাসিক কিস্তি</span>
              <span className="text-sm font-bold text-white font-sans tracking-tight">
                {formatBDT(emi)}
              </span>
            </div>
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850 flex flex-col justify-center">
              <span className="text-xs text-zinc-400 font-sans mb-1 font-medium">মোট পরিশোধ</span>
              <span className="text-sm font-bold text-white font-sans tracking-tight">
                {formatBDT(totalRepay)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
