/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, Landmark, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PaymentMethod } from '../types';
import { cleanNumericInput } from '../utils/digitConverter';

interface WithdrawSectionProps {
  savingsBalance: number;
  onBack: () => void;
  onWithdrawComplete: (amount: number, method: PaymentMethod, pin: string) => Promise<boolean>;
  settings?: any;
}

export default function WithdrawSection({ savingsBalance, onBack, onWithdrawComplete, settings }: WithdrawSectionProps) {
  const [amount, setAmount] = useState<string>('5000');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pin, setPin] = useState('');

  const [bankName, setBankName] = useState('Sonali Bank PLC');
  const [accountNo, setAccountNo] = useState('02938475819');

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!amount || numAmount <= 0) {
      alert('অনুগ্রহ করে সঠিক পরিমাণ লিখুন।');
      return;
    }

    const minW = settings?.minWithdraw ?? 100;
    const maxW = settings?.maxWithdraw ?? 50000;
    if (numAmount < minW) {
      alert(`দুঃখিত, সর্বনিম্ন উত্তোলনের পরিমাণ ৳ ${minW.toLocaleString('bn-BD')} হতে হবে।`);
      return;
    }
    if (numAmount > maxW) {
      alert(`দুঃখিত, সর্বোচ্চ উত্তোলনের পরিমাণ ৳ ${maxW.toLocaleString('bn-BD')} এর বেশি হতে পারবে না।`);
      return;
    }

    if (numAmount > savingsBalance) {
      alert('দুঃখিত, আপনার পর্যাপ্ত সঞ্চয় ব্যালেন্স নেই।');
      return;
    }

    setPin('');
    setIsProcessing(true);
  };

  const handleConfirmPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      alert('সঠিক পিন লিখুন।');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onWithdrawComplete(Number(amount), paymentMethod, pin);
      if (success) {
        setIsProcessing(false);
        setIsSuccess(true);
      }
    } catch (err) {
      console.error(err);
      alert('উত্তোলন প্রক্রিয়াকরণে ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatBDT = (amount: number) => {
    return `৳ ${amount.toLocaleString('bn-BD')}`;
  };

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  const getMethodNameDesc = (method: PaymentMethod) => {
    switch (method) {
      case 'bkash': return 'bKash Wallet';
      case 'nagad': return 'Nagad Wallet';
      case 'rocket': return 'Rocket Wallet';
      case 'bank': return 'Bank Account';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a09] text-zinc-300 select-none overflow-y-auto no-scrollbar pb-6">
      {/* Dynamic Header */}
      <div className="bg-zinc-950 px-5 py-4 flex items-center gap-3 sticky top-0 border-b border-zinc-900 z-10 shadow-xs">
        <button
          onClick={onBack}
          id="btn-withdraw-back"
          className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-450 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-base font-bold font-serif italic text-white font-medium">টাকা উত্তোলন</h3>
          <p className="text-[10px] text-zinc-550 font-sans">সঞ্চয় তহবিল থেকে ফান্ড উত্তোলন</p>
        </div>
      </div>

      {/* Main Content Layout screen 6 */}
      <div className="p-5 flex-grow flex flex-col gap-4">
        {/* Available Balance stats */}
        <div className="bg-[#111113] p-4 rounded-xl border border-zinc-850 shadow-3xs flex justify-between items-center">
          <div>
            <p className="text-[10px] text-zinc-500 font-sans uppercase font-bold tracking-wider">টাকা উত্তোলনে উপলব্ধ ব্যালেন্স</p>
            <p className="text-md font-bold text-[#dfc187] mt-0.5 font-sans">
              {formatBDT(savingsBalance)}
            </p>
          </div>
          <span className="text-[9px] bg-[#c5a059]/10 text-[#dfc187] border border-[#c5a059]/20 px-2.5 py-1 rounded-lg font-sans font-bold">
            সঞ্চয় হিসাব
          </span>
        </div>

        {/* Withdrawal input field */}
        <div className="flex flex-col gap-1.5 bg-[#111113] p-4 rounded-xl border border-zinc-850/80 shadow-3xs">
          <label className="text-[10px] font-bold text-zinc-500 font-sans tracking-wider uppercase">উত্তোলনের পরিমাণ</label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-md font-bold text-zinc-500">৳</span>
            <input
              type="text"
              id="input-withdraw-amount"
              value={amount}
              onChange={(e) => setAmount(cleanNumericInput(e.target.value))}
              placeholder="উত্তোলনের পরিমাণ লিখুন"
              className="w-full bg-zinc-950 border border-zinc-850 focus:border-[#c5a059]/40 rounded-xl py-2.5 pl-9 pr-4 text-sm font-sans text-zinc-200 focus:outline-none transition-all font-normal"
            />
          </div>
        </div>

        {/* Payment Methods selector matching Screen 6 list perfectly */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-zinc-500 font-sans tracking-wider uppercase">পেমেন্ট মাধ্যম</label>
          <div className="flex flex-col gap-2">
            {[
              { id: 'bkash', name: 'bKash Wallet', desc: 'বিকাশ মোবাইল ক্যাশ-আউট', color: 'bg-white p-1 border border-pink-900/10', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/BKash_logo.svg/100px-BKash_logo.svg.png', isImage: true },
              { id: 'nagad', name: 'Nagad Wallet', desc: 'নগদ মোবাইল ক্যাশ-আউট', color: 'bg-white p-1 border border-orange-900/10', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagad_logo.svg/512px-Nagad_logo.svg.png', isImage: true },
              { id: 'bank', name: 'Bank Account', desc: 'সরাসরি ব্যাংক হিসাবে স্থানান্তর (Sonali, DBBL) (সাময়িকভাবে নিষ্ক্রিয়)', color: 'bg-zinc-900/50 text-zinc-500 border border-zinc-900', logo: '🏛️', isImage: false, disabled: true },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  if (method.disabled) {
                    alert('দুঃখিত, এই পেমেন্ট সার্ভিসটি এখন রক্ষণাবেক্ষণের জন্য সাময়িকভাবে নিষ্ক্রিয় আছে।');
                    return;
                  }
                  setPaymentMethod(method.id as PaymentMethod);
                }}
                className={`flex flex-col p-3 bg-[#111113] border rounded-2xl transition-all shadow-3xs text-left ${
                  method.disabled 
                    ? 'opacity-40 cursor-not-allowed border-zinc-900' 
                    : paymentMethod === method.id 
                    ? 'border-[#c5a059]/40 ring-1 ring-[#c5a059]/10' 
                    : 'border-zinc-850/80'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center ${method.color} font-bold text-xs font-sans`}>
                      {method.isImage ? (
                        <img src={method.logo} alt={method.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        method.logo
                      )}
                    </div>
                    <div>
                      <h5 className="text-[11.5px] font-bold text-zinc-200 font-sans">{method.name}</h5>
                      <p className="text-[9.5px] text-zinc-505 font-sans mt-0.5">{method.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === method.id ? 'border-[#c5a059]' : 'border-zinc-750'}`}>
                      {paymentMethod === method.id && (
                        <div className="w-2.5 h-2.5 bg-[#c5a059] rounded-full" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Bank Fields expands dynamically when bank is active */}
                {method.id === 'bank' && paymentMethod === 'bank' && (
                  <div className="mt-3.5 pt-3.5 border-t border-zinc-850 flex flex-col gap-3.5 w-full animate-fade-in font-sans">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[9px] text-[#c5a059] font-bold mb-1 block">ব্যাংকের নাম</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-[#c5a059]/30"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#c5a059] font-bold mb-1 block">হিসাব নম্বর</label>
                        <input
                          type="text"
                          value={accountNo}
                          onChange={(e) => setAccountNo(cleanNumericInput(e.target.value))}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-[#c5a059]/30 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Withdrawal Disclaimer warning */}
        <div className="bg-amber-950/10 rounded-2xl p-4 border border-amber-900/20 flex gap-3 text-amber-350/80 mt-1">
          <AlertTriangle className="w-7 h-7 text-amber-500 flex-shrink-0" />
          <div>
            <h5 className="text-xs font-bold text-amber-200 font-sans">উত্তোলন চার্জ ও নীতিমালা</h5>
            <p className="text-[10px] text-amber-400/60 font-sans leading-relaxed mt-0.5">
              উত্তোলনের ক্ষেত্রে নিজস্ব ওয়ালেট বা ব্যাংক অ্যাকাউন্টে ফান্ড স্থানান্তর হতে সর্বোচ্চ ২৪ ঘন্টা সময় লাগতে পারে।
            </p>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={handleWithdraw}
          id="btn-withdraw-submit"
          className="w-full bg-[#c5a059] hover:bg-[#dfc187] active:scale-[0.99] text-zinc-950 py-3.5 rounded-xl font-bold text-xs shadow-md transition-all font-sans text-center mt-auto cursor-pointer"
        >
          আবেদন করুন
        </button>
      </div>

      {/* Pine confirmation overlay simulator */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-5 z-20">
          <div className="bg-[#111113] rounded-3xl p-5 w-full max-w-[280px] border border-zinc-800 shadow-2xl flex flex-col items-center animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/20 text-rose-400 flex items-center justify-center mb-3">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-zinc-200 font-sans text-center mb-1">
              উত্তোলন নিশ্চিত করুন
            </h4>
            <p className="text-[9px] text-zinc-500 text-center mb-4 leading-relaxed font-sans">
              আপনার পাসওয়ার্ড বা পিন কোড লিখে উত্তোলন অনুরোধ সাবমিট করুন
            </p>

            <form onSubmit={handleConfirmPinSubmit} className="w-full flex flex-col gap-4">
              <input
                type="password"
                maxLength={5}
                required
                disabled={isSubmitting}
                value={pin}
                onChange={(e) => setPin(cleanNumericInput(e.target.value))}
                placeholder="•••••"
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-[#c5a059]/40 rounded-xl py-2.5 text-center font-bold tracking-widest text-md text-white focus:outline-none transition-all disabled:opacity-50"
              />

              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsProcessing(false)}
                  className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 rounded-xl text-xs font-semibold font-sans transition-all text-center disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 rounded-xl text-xs font-semibold font-sans transition-all text-center font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'প্রসেসিং...' : 'নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Animation Card Block */}
      {isSuccess && (
        <div className="absolute inset-0 bg-[#0a0a09] flex flex-col items-center justify-center p-6 z-20 text-center animate-fade-in select-none">
          <div className="relative flex items-center justify-center w-20 h-20 bg-emerald-950/20 text-emerald-400 rounded-full animate-bounce duration-1000 border-4 border-emerald-900/30 mb-5 animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <h3 className="text-lg font-bold font-serif italic text-white mb-1">আবেদন সফল হয়েছে!</h3>
          <p className="text-xs text-zinc-450 font-sans leading-relaxed max-w-[240px] mb-6">
            আপনার উত্তোলনের অনুরোধটি সফলভাবে গ্রহণ করা হয়েছে। এটি ২৪ ঘন্টার মাঝে প্রসেস করা হবে।
          </p>

          <div className="bg-[#111113] rounded-2xl p-4 w-full flex flex-col gap-2.5 text-left mb-6 font-sans border border-zinc-850">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>লেনদেন মাধ্যম:</span>
              <span className="font-bold text-zinc-200 font-sans">
                {paymentMethod === 'bank' ? `${bankName} A/C` : getMethodNameDesc(paymentMethod)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>পরিমাণ:</span>
              <span className="font-bold text-rose-450">{formatBDT(Number(amount))}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>তারিখ:</span>
              <span className="text-zinc-200">{toBanglaDigits('০৮ জুন, ২০২৬')}</span>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-550 pt-2 border-t border-zinc-850">
              <span>লেনদেন আইডি:</span>
              <span className="font-mono">TX{Math.floor(11000 + Math.random() * 9000)}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setIsSuccess(false);
              onBack();
            }}
            id="btn-withdraw-ok"
            className="w-full bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3 rounded-xl font-bold font-sans text-xs transition-colors shadow-md text-center cursor-pointer"
          >
            ড্যাশবোর্ডে ফিরে যান
          </button>
        </div>
      )}
    </div>
  );
}
