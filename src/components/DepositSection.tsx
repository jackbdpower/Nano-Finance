/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck, CheckCircle2, FileText } from 'lucide-react';
import { PaymentMethod, User } from '../types';
import OnlineCheckoutGateway from './OnlineCheckoutGateway';
import { cleanNumericInput } from '../utils/digitConverter';
import { generateSavingsReceiptPDF } from '../utils/pdfGenerator';

interface DepositSectionProps {
  user?: User;
  onBack: () => void;
  onDepositComplete: (amount: number, method: PaymentMethod) => void;
  settings?: any;
}

export default function DepositSection({ user, onBack, onDepositComplete, settings }: DepositSectionProps) {
  const getPresets = () => {
    if (settings?.depositPresets) {
      const parts = settings.depositPresets.split(',')
        .map((s: string) => s.trim())
        .map(Number)
        .filter((n: number) => !isNaN(n) && n > 0);
      if (parts.length > 0) return parts;
    }
    return [20, 50, 100, 500];
  };

  const chips = getPresets();

  const [amount, setAmount] = useState<string>(() => String(chips[0] || 100));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBtnLoading, setIsBtnLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successTxId, setSuccessTxId] = useState('');
  const [pin, setPin] = useState('');
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isSuccess && !successTxId) {
      setSuccessTxId(`TXD${Math.floor(45100 + Math.random() * 9500)}`);
    } else if (!isSuccess && successTxId) {
      setSuccessTxId('');
    }
  }, [isSuccess]);

  // Initialize live session on server representing Step 0 (loading choice screen)
  React.useEffect(() => {
    let isMounted = true;
    let createdCheckoutId: string | null = null;

    let pName = 'ভিজিটর';
    let pPhone = 'অজানা';
    try {
      const savedUser = localStorage.getItem('jf_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.name) pName = parsed.name;
        if (parsed.phone) pPhone = parsed.phone;
      }
    } catch (err) {
      console.error(err);
    }

    fetch('/api/checkout/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: paymentMethod, 
        amount: Number(amount) || 0, 
        merchantName: `${settings?.appName || 'Nano-Finance'} Cash-In Deposit`, 
        userName: pName, 
        userPhone: pPhone 
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data && data.success && data.checkout) {
        createdCheckoutId = data.checkout.id;
        if (!isMounted) {
          fetch('/api/checkout/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: createdCheckoutId })
          }).catch(err => console.error(err));
        } else {
          setCheckoutId(createdCheckoutId);
        }
      }
    })
    .catch(err => console.error("Error starting checkout session at step 0:", err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync changes of amount or paymentMethod to server live
  React.useEffect(() => {
    if (checkoutId) {
      fetch('/api/checkout/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: checkoutId,
          type: paymentMethod,
          amount: Number(amount) || 0
        })
      }).catch(err => console.error("Error updating type and amount in parent step 0:", err));
    }
  }, [paymentMethod, amount, checkoutId]);

  const handleBack = () => {
    if (checkoutId) {
      fetch('/api/checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: checkoutId })
      }).catch(err => console.error(err));
    }
    onBack();
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!amount || numAmount <= 0) {
       alert('অনুগ্রহ করে সঠিক পরিমাণ লিখুন।');
      return;
    }

    const minD = settings?.minDeposit ?? 500;
    const maxD = settings?.maxDeposit ?? 1000000;
    if (numAmount < minD) {
       alert(`দুঃখিত, সর্বনিম্ন ডিপোজিট পরিমাণ ৳ ${minD.toLocaleString('bn-BD')} হতে হবে।`);
      return;
    }
    if (numAmount > maxD) {
       alert(`দুঃখিত, সর্বোচ্চ ডিপোজিট পরিমাণ ৳ ${maxD.toLocaleString('bn-BD')} এর বেশি হতে পারবে না।`);
      return;
    }

    setIsBtnLoading(true);
    setTimeout(() => {
      setIsBtnLoading(false);
      setIsProcessing(true);
    }, 1500);
  };

  const handleConfirmPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      alert('সঠিক ৪-৫ ডিজিটের পিন লিখুন।');
      return;
    }

    // Process and show feedback
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
    }, 1000);
  };

  const handleDownloadReceipt = () => {
    // generate dynamic date in Bengali
    const currentDateObj = new Date();
    const currentDay = currentDateObj.getDate();
    const monthsBangla = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const currentMonth = monthsBangla[currentDateObj.getMonth()];
    const currentYear = currentDateObj.getFullYear();
    const dateString = `${currentDay.toString().padStart(2, '0')} ${currentMonth}, ${currentYear}`;

    const activeUser: User = user || {
      name: 'সদস্য গ্রাহক',
      phone: '01700000055',
      accountNo: 'LA-98472901-52',
      isLoggedIn: true,
      isVerified: true,
      role: 'user',
    };

    generateSavingsReceiptPDF({
      user: activeUser,
      amount: Number(amount),
      paymentMethod,
      transactionId: successTxId,
      dateString,
    });
  };

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  const formatBDT = (amount: number) => {
    return `৳ ${Math.round(amount).toLocaleString('bn-BD')}`;
  };

  const getMethodNameDesc = (method: PaymentMethod) => {
    switch (method) {
      case 'bkash': return 'bKash Wallet';
      case 'nagad': return 'Nagad Wallet';
      case 'rocket': return 'Rocket Wallet';
      case 'bank': return 'Bank Transfer';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a09] text-zinc-300 select-none overflow-y-auto no-scrollbar pb-6">
      {/* Dynamic Header */}
      <div className="bg-zinc-950 px-5 py-4 flex items-center gap-3 sticky top-0 border-b border-zinc-900 z-10 shadow-xs">
        <button
          onClick={handleBack}
          id="btn-deposit-back"
          className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-450 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-base font-bold font-serif italic text-white font-medium">টাকা জমা করুন</h3>
          <p className="text-[10px] text-zinc-550 font-sans">সঞ্চয় হিসাবে ফান্ড স্থানান্তর</p>
        </div>
      </div>

      {/* Main Content Layout screen 5 */}
      <div className="p-5 flex-grow flex flex-col gap-4">
        {/* Preset chips Grid */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-zinc-500 font-sans tracking-wider uppercase">পরিমাণ presets</label>
          <div className="grid grid-cols-4 gap-2">
            {chips.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val.toString())}
                className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all font-sans text-center ${amount === val.toString() ? 'bg-[#c5a059]/10 text-[#dfc187] border-[#c5a059]/40' : 'bg-[#111113] text-zinc-400 border-zinc-850/80 shadow-3xs'}`}
              >
                ৳ {toBanglaDigits(val.toLocaleString('bn-BD'))}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input amount field */}
        <div className="flex flex-col gap-1.5 bg-[#111113] p-4 rounded-xl border border-zinc-850/80 shadow-3xs">
          <label className="text-[10px] font-bold text-zinc-500 font-sans tracking-wider uppercase">অন্য পরিমাণ লিখুন</label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-md font-bold text-zinc-500">৳</span>
            <input
              type="text"
              id="input-deposit-amount"
              value={amount}
              onChange={(e) => setAmount(cleanNumericInput(e.target.value))}
              placeholder="পরিমাণ লিখুন"
              className="w-full bg-zinc-950 border border-zinc-850 focus:border-[#c5a059]/40 rounded-xl py-3 pl-8 pr-4 font-bold text-white text-md focus:outline-none transition-all font-sans"
            />
          </div>
        </div>

        {/* Payment Methods selector matching Screen 5 precisely */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-zinc-500 font-sans tracking-wider uppercase">পেমেন্ট মাধ্যম</label>
          <div className="flex flex-col gap-2">
            {[
              { id: 'bkash', name: 'bKash Wallet', desc: 'বিকাশ মোবাইল ওয়ালেট', color: 'bg-pink-900/30 text-pink-400 border border-pink-900/40', logo: 'bK' },
              { id: 'nagad', name: 'Nagad Wallet', desc: 'নগদ মোবাইল ওয়ালেট', color: 'bg-orange-950/30 text-orange-405 border border-orange-950/40', logo: 'N' },
              { id: 'rocket', name: 'Rocket Wallet', desc: 'রকেট মোবাইল ওয়ালেট (সাময়িকভাবে নিষ্ক্রিয়)', color: 'bg-purple-950/10 text-purple-500/40 border border-purple-950/20', logo: 'R', disabled: true },
              { id: 'bank', name: 'Bank Transfer', desc: 'অন্যান্য বাণিজ্যিক ব্যাংক সমূহ (সাময়িকভাবে নিষ্ক্রিয়)', color: 'bg-zinc-900/50 text-zinc-500 border border-zinc-900', logo: '🏛️', disabled: true },
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
                className={`flex items-center justify-between p-3 bg-[#111113] border rounded-2xl transition-all shadow-3xs text-left ${
                  method.disabled 
                    ? 'opacity-40 cursor-not-allowed border-zinc-900' 
                    : paymentMethod === method.id 
                    ? 'border-[#c5a059]/40 ring-1 ring-[#c5a059]/10' 
                    : 'border-zinc-850/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${method.color} flex items-center justify-center font-bold text-xs font-sans overflow-hidden`}>
                    {method.logo}
                  </div>
                  <div>
                    <h5 className="text-[11.5px] font-bold text-zinc-200 font-sans">{method.name}</h5>
                    <p className="text-[9.5px] text-zinc-500 font-sans mt-0.5">{method.desc}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === method.id ? 'border-[#c5a059]' : 'border-zinc-750'}`}>
                    {paymentMethod === method.id && (
                      <div className="w-2.5 h-2.5 bg-[#c5a059] rounded-full" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cryptographic Secure Disclaimer Block */}
        <div className="bg-zinc-900/20 rounded-2xl p-4 border border-zinc-850/50 flex gap-3 text-zinc-450 mt-1">
          <ShieldCheck className="w-9 h-9 text-[#c5a059] flex-shrink-0" />
          <div>
            <h5 className="text-xs font-bold text-zinc-300 font-sans">নিরাপদ লেনদেন</h5>
            <p className="text-[10px] text-zinc-500 font-sans leading-relaxed mt-0.5">
              আপনার সকল লেনদেন ১০০% নিরাপদ এবং এন্ড-টু-এন্ড এনক্রিপ্টেড পদ্ধতিতে পরিচালিত হচ্ছে।
            </p>
          </div>
        </div>

        {/* Action Submit Button */}
        <button
          onClick={handleDeposit}
          disabled={isBtnLoading}
          id="btn-deposit-submit"
          className="w-full bg-[#c5a059] hover:bg-[#dfc187] active:scale-[0.99] text-zinc-950 py-3.5 rounded-xl font-bold text-xs shadow-md transition-all font-sans text-center mt-auto cursor-pointer disabled:opacity-80 flex items-center justify-center gap-2"
        >
          {isBtnLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              <span>লোডিং হচ্ছে...</span>
            </>
          ) : (
            'জমা নিশ্চিত করুন'
          )}
        </button>
      </div>

      {/* Online gateway simulator for bKash/Nagad or standard security pock for other methods */}
      {isProcessing && (paymentMethod === 'bkash' || paymentMethod === 'nagad') ? (
        <OnlineCheckoutGateway
          type={paymentMethod}
          amount={Number(amount)}
          merchantName={`${settings?.appName || 'Nano-Finance'} Cash-In Deposit`}
          onSuccess={(accountNumber) => {
            setIsProcessing(false);
            setIsSuccess(true);
          }}
          onCancel={() => setIsProcessing(false)}
          settings={settings}
          checkoutId={checkoutId || undefined}
        />
      ) : isProcessing ? (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-5 z-20">
          <div className="bg-[#111113] rounded-3xl p-5 w-full max-w-[280px] border border-zinc-800 shadow-2xl flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-[#c5a059]/10 text-[#c5a059] flex items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-zinc-100 font-sans text-center mb-1">
              নিরাপত্তা পিন লিখুন
            </h4>
            <p className="text-[9px] text-zinc-500 text-center mb-4 leading-relaxed font-sans">
              আপনার {getMethodNameDesc(paymentMethod)} পিন নম্বর দিয়ে জমা নিশ্চিত করুন
            </p>

            <form onSubmit={handleConfirmPinSubmit} className="w-full flex flex-col gap-4">
              <input
                type="password"
                maxLength={5}
                required
                value={pin}
                onChange={(e) => setPin(cleanNumericInput(e.target.value))}
                placeholder="•••••"
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-[#c5a059]/40 rounded-xl py-2.5 text-center font-bold tracking-widest text-md text-white focus:outline-none transition-all"
              />

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsProcessing(false)}
                  className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 rounded-xl text-xs font-semibold font-sans transition-all text-center"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 rounded-xl text-xs font-semibold font-sans transition-all text-center font-bold shadow-xs cursor-pointer"
                >
                  পরবর্তী
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Success Animation Card Block */}
      {isSuccess && (
        <div className="absolute inset-0 bg-[#0a0a09] flex flex-col items-center justify-center p-6 z-20 text-center animate-fade-in select-none overflow-y-auto">
          <div className="relative flex items-center justify-center w-16 h-16 bg-emerald-950/20 text-[#10b981] rounded-full border-4 border-emerald-900/30 mb-4 animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-base font-bold text-emerald-450 mb-1">সঞ্চয় সফলভাবে যুক্ত হয়েছে!</h3>
          <p className="text-[11px] text-zinc-400 font-sans leading-relaxed max-w-[250px] mb-4">
            আপনার সঞ্চয় অ্যাকাউন্টে {formatBDT(Number(amount))} সফলভাবে জমা অবমুক্ত করা হয়েছে।
          </p>

          <div className="bg-[#111113] rounded-2xl p-4 w-full flex flex-col gap-2.5 text-left mb-5 font-sans border border-emerald-900/10 relative overflow-hidden">
            {/* Watermark-style light stamp in background */}
            <div className="absolute -right-3 -bottom-3 text-[50px] font-black italic select-none text-emerald-900/5 rotate-12 pointer-events-none">
              D-PAID
            </div>

            <div className="flex justify-between items-center text-[10px] pb-1.5 border-b border-zinc-850">
              <span className="text-zinc-500 uppercase font-bold tracking-wider">রসিদ বিবরণী</span>
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase animate-pulse">
                অনুমোদিত • Verified
              </span>
            </div>

            <div className="flex justify-between text-xs text-zinc-400">
              <span>লেনদেন মাধ্যম:</span>
              <span className="font-bold text-zinc-200">{getMethodNameDesc(paymentMethod)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>জমার পরিমাণ:</span>
              <span className="font-extrabold text-[#dfc187] font-mono">{formatBDT(Number(amount))}</span>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-550 pt-2 border-t border-zinc-850">
              <span>ট্রানজেকশন আইডি:</span>
              <span className="font-mono text-zinc-300 font-bold select-all bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-800">{successTxId}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 w-full">
            <button
              onClick={handleDownloadReceipt}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold font-sans text-xs transition-colors shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/10"
            >
              <FileText className="w-4 h-4" />
              অফিশিয়াল রসিদ ডাউনলোড করুন (PDF)
            </button>

            <button
              onClick={() => {
                setIsSuccess(false);
                onDepositComplete(Number(amount), paymentMethod);
              }}
              id="btn-deposit-ok"
              className="w-full bg-[#1c1c1e] text-zinc-300 hover:bg-zinc-800 py-2.5 rounded-xl font-bold font-sans text-xs transition-colors border border-zinc-800 text-center cursor-pointer"
            >
              ড্যাশবোর্ডে ফিরে যান
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
