/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, Download, ShieldCheck, CheckCircle2, Ticket, FileText } from 'lucide-react';
import { EmiInstallment, PaymentMethod, LoanItem, User } from '../types';
import OnlineCheckoutGateway from './OnlineCheckoutGateway';
import { cleanNumericInput } from '../utils/digitConverter';
import { generatePaymentReceiptPDF } from '../utils/pdfGenerator';

interface PaymentSectionProps {
  user?: User;
  savingsBalance: number;
  emiInstallments: EmiInstallment[];
  activeLoans: LoanItem[];
  onBack: () => void;
  onPaySuccess: (installmentNo: number, amount: number, method: PaymentMethod) => void;
  onDepositComplete?: (amount: number, method: PaymentMethod) => void;
  settings?: any;
}

export default function PaymentSection({ user, savingsBalance, emiInstallments, activeLoans, onBack, onPaySuccess, onDepositComplete, settings }: PaymentSectionProps) {
  // Screen views: 'schedule' (Screen 11), 'pay' (Screen 12)
  const [panel, setPanel] = useState<'schedule' | 'pay'>('schedule');
  const [selectedEmi, setSelectedEmi] = useState<EmiInstallment | null>(null);
  const [activeTab, setActiveTab] = useState<'loan' | 'savings'>('loan');

  // Pay Form States
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successTxId, setSuccessTxId] = useState('');
  const [pin, setPin] = useState('');

  React.useEffect(() => {
    if (isSuccess && !successTxId) {
      setSuccessTxId(`TX${Math.floor(22485 + Math.random() * 6800)}`);
    } else if (!isSuccess && successTxId) {
      setSuccessTxId('');
    }
  }, [isSuccess]);

  // Savings Deposit specific states within PaymentSection
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

  const depositChips = getPresets();

  const [depositAmount, setDepositAmount] = useState<string>(() => String(depositChips[0] || 100));
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('bkash');
  const [isDepositProcessing, setIsDepositProcessing] = useState(false);
  const [isDepositSuccess, setIsDepositSuccess] = useState(false);
  const [depositPin, setDepositPin] = useState('');

  const formatBDT = (amount: number) => {
    return `৳ ${amount.toLocaleString('bn-BD')}`;
  };

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  // Triggers mock PDF compile and browser files trigger
  const handleDownloadPDF = () => {
    alert('কিংডম পিডিএফ মেকার ভিউয়ার দ্বারা ইএমআই ডাউনলোড করা হচ্ছে... পিডিএফ ফাইল আপনার ডিভাইসে সংরক্ষিত হয়েছে (সিমুলেটেড ডাউনলোড)।');
    const pdfContent = `Nano-Finance\nEMI SCHEDULE REPORT\nDate: 08-06-2026\nAccount: 1234567890\nRemaining dues: ৳ 1,82,740\n\nGenerated secure report.`;
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'emi_schedule_nanofinance.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePayTrigger = (emi: EmiInstallment) => {
    if (emi.status === 'paid') {
      alert('এই কিস্তিটি ইতিমধ্যেই পরিশোধ করা হয়েছে!');
      return;
    }
    setSelectedEmi(emi);
    setPanel('pay');
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(selectedEmi?.amount) > savingsBalance) {
      alert('দুঃখিত, আপনার সঞ্চয় ব্যালেন্স পর্যাপ্ত নেই। এগিয়ে যাওয়ার পূর্বে সঞ্চয় ড্যাশবোর্ড থেকে টাকা জমা করুন!');
      return;
    }
    setIsProcessing(true);
  };

  const handleConfirmPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      alert('সঠিক ওয়ান-টাইম পিন লিখুন।');
      return;
    }

    // Process payment success
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
    }, 1000);
  };

  const handleDownloadReceipt = () => {
    if (!selectedEmi) return;

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
      role: 'user'
    };

    const loanId = activeLoans[0]?.id || 'LN5923';

    generatePaymentReceiptPDF({
      user: activeUser,
      amount: selectedEmi.amount,
      installmentNo: selectedEmi.installmentNo,
      paymentMethod,
      transactionId: successTxId,
      loanId,
      dateString,
    });
  };

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(depositAmount);
    if (!depositAmount || numAmount <= 0) {
      alert('অনুগ্রহ করে সঠিক পরিমাণ লিখুন।');
      return;
    }
    setIsDepositProcessing(true);
  };

  const handleConfirmDepositPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositPin.length < 4) {
      alert('সঠিক ওয়ান-টাইম পিন লিখুন।');
      return;
    }

    // Process deposit complete
    setTimeout(() => {
      setIsDepositProcessing(false);
      setIsDepositSuccess(true);
    }, 1000);
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
    <div className="flex flex-col h-full bg-[#0a0a09] text-zinc-300 select-none overflow-y-auto no-scrollbar pb-6 relative font-sans">
      {/* Header Panel */}
      <div className="bg-zinc-950 px-5 py-4 flex items-center gap-3 sticky top-0 border-b border-zinc-900 z-10 shadow-xs">
        <button
          onClick={() => {
            if (panel === 'pay') {
              setPanel('schedule');
            } else {
              onBack();
            }
          }}
          id="btn-payment-back"
          className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-450 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-base font-bold font-serif italic text-white font-medium animate-fade-in">
            {panel === 'pay' ? 'কিস্তি পরিশোধ করুন' : activeTab === 'loan' ? 'EMI সূচি ও পেমেন্ট' : 'সঞ্চয় জমা করুন'}
          </h3>
          <p className="text-[10px] text-zinc-550 font-sans mt-0.5 animate-fade-in">
            {panel === 'pay' ? 'নিরাপদ মোবাইল গেটওয়ের মাধ্যমে পরিশোধ' : activeTab === 'loan' ? 'ঋণের চলমান মাসিক কিস্তিসমূহ' : 'নিরাপদ গেটওয়ের মাধ্যমে সঞ্চয় ফান্ড জমা'}
          </p>
        </div>
      </div>

      {/* SEGMENTED TAB SWITCHER */}
      {panel === 'schedule' && (
        <div className="px-4 pt-4 pb-1">
          <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-zinc-850">
            <button
              onClick={() => setActiveTab('loan')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all font-sans text-center cursor-pointer ${
                activeTab === 'loan'
                  ? 'bg-[#c5a059] text-zinc-950 font-black'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              ঋণের কিস্তি
            </button>
            <button
              onClick={() => setActiveTab('savings')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all font-sans text-center cursor-pointer ${
                activeTab === 'savings'
                  ? 'bg-[#c5a059] text-zinc-950 font-black'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              সঞ্চয় জমা (ডিপোজিট)
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 11: EMI INSTALLMENTS SCHEDULE VIEW / SAVINGS DEPOSIT VIEW */}
      {panel === 'schedule' && (() => {
        if (activeTab === 'loan') {
          const approvedLoans = activeLoans ? activeLoans.filter((l) => l.status === 'approved') : [];
          const hasApprovedLoan = approvedLoans.length > 0;
          const activeApprovedLoan = approvedLoans[0];

          return (
            <div className="p-4 flex-grow flex flex-col gap-4 animate-fade-in justify-between">
              {!hasApprovedLoan ? (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center my-auto min-h-[350px]">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900/40 text-[#c5a059] border border-zinc-850/80 flex items-center justify-center mb-4">
                    <Ticket className="w-8 h-8 animate-pulse" />
                  </div>
                  <h4 className="text-zinc-200 text-sm font-bold font-serif italic mb-2">কোনো সক্রিয় ঋণ চালু নেই</h4>
                  <p className="text-zinc-550 text-xs font-sans leading-relaxed max-w-[260px] mb-6">
                    আপনার অ্যাকাউন্টে কোনো পরিশোধযোগ্য ঋণ বা কিস্তি পাওয়া যায়নি। কিস্তির হিসাব পেতে হলে দয়া করে প্রথমে হোম পেজ থেকে ঋণের জন্য আবেদন করুন।
                  </p>
                  <button
                    onClick={onBack}
                    className="w-full bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3 rounded-xl text-xs font-bold transition-all text-center font-sans tracking-wide cursor-pointer"
                  >
                    ড্যাশবোর্ডে ফিরে যান
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    {/* Informational loan summary cards banner */}
                    <div className="bg-[#111113] p-4 rounded-xl border border-zinc-850 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">
                          চলতি {activeApprovedLoan.categoryBangla}
                        </span>
                        <span className="text-md font-bold text-[#dfc187] block font-sans tracking-tight mt-1">
                          {formatBDT(activeApprovedLoan.emiAmount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">সুদের বার্ষিক হার</span>
                        <span className="font-bold text-zinc-300 text-xs mt-1 block">{toBanglaDigits(activeApprovedLoan.interestRate)}%</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">অবশিষ্ট কিস্তি</span>
                        <span className="font-bold text-zinc-300 text-xs mt-1 block">
                          {toBanglaDigits(activeApprovedLoan.totalInstallments - activeApprovedLoan.repaidCount)}/{toBanglaDigits(activeApprovedLoan.totalInstallments)}
                        </span>
                      </div>
                    </div>

                    {/* List header titles */}
                    <h4 className="text-[10px] font-bold text-zinc-500 font-sans tracking-widest uppercase mt-4 mb-3">কিস্তির তালিকা</h4>

                    {/* Table layout blocks mapping installments */}
                    <div className="flex flex-col gap-2">
                      {emiInstallments.map((emi) => {
                        const getStatusText = (st: string) => {
                          switch (st) {
                            case 'paid': return 'Paid';
                            case 'pending': return 'Pending';
                            case 'due': return 'Due';
                            case 'overdue': return 'Overdue';
                            default: return '';
                          }
                        };

                        const getStatusStyle = (st: string) => {
                          switch (st) {
                            case 'paid': return 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30';
                            case 'pending': return 'bg-amber-950/20 text-amber-400 border border-amber-900/30';
                            case 'due': return 'bg-zinc-900 text-zinc-400 border border-zinc-850';
                            case 'overdue': return 'bg-rose-950/25 text-rose-400 border border-rose-900/30 font-bold';
                            default: return '';
                          }
                        };

                        return (
                          <button
                            key={emi.installmentNo}
                            onClick={() => handlePayTrigger(emi)}
                            className="flex justify-between items-center p-3.5 bg-[#111113] border border-zinc-850/80 hover:border-[#c5a059]/20 hover:shadow-xs rounded-2xl transition-all shadow-3xs text-left w-full cursor-pointer"
                          >
                            <div className="flex items-center gap-3 font-sans">
                              <div className="w-8 h-8 rounded-xl bg-zinc-950 text-zinc-400 border border-zinc-900 flex items-center justify-center font-bold text-xs font-serif">
                                # {toBanglaDigits(emi.installmentNo)}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-zinc-200">পরিশোধ তারিখ: {toBanglaDigits(emi.dueDate)}</p>
                                <span className="text-[9.5px] text-zinc-500">{activeApprovedLoan.categoryBangla}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-xs font-bold text-[#dfc187] font-sans block">{formatBDT(emi.amount)}</p>
                              <span className={`text-[8px] font-black border rounded-md px-1.5 py-0.2 mt-1.5 inline-block ${getStatusStyle(emi.status)}`}>
                                {getStatusText(emi.status)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action PDF button */}
                  <button
                    onClick={handleDownloadPDF}
                    id="btn-payment-pdf-download"
                    className="w-full bg-[#c5a059]/10 text-[#dfc187] border border-[#c5a059]/20 hover:bg-[#c5a059]/15 py-3 rounded-xl font-bold font-sans text-xs transition-colors text-center mt-6 flex justify-center items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    PDF ডাউনলোড করুন
                  </button>
                </>
              )}
            </div>
          );
        } else {
          // RENDER SAVINGS DEPOSIT FORM
          return (
            <div className="p-4 flex-grow flex flex-col gap-4 animate-fade-in justify-between">
              <div className="flex flex-col gap-4">
                {/* Preset chips Grid */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 font-sans tracking-wider uppercase">পরিমাণ presets</label>
                  <div className="grid grid-cols-4 gap-2">
                    {depositChips.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDepositAmount(val.toString())}
                        className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all font-sans text-center cursor-pointer ${depositAmount === val.toString() ? 'bg-[#c5a059]/10 text-[#dfc187] border-[#c5a059]/40' : 'bg-[#111113] text-zinc-400 border-zinc-850/80 shadow-3xs'}`}
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
                      id="input-[#payment-deposit-amount]"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(cleanNumericInput(e.target.value))}
                      placeholder="পরিমাণ লিখুন"
                      className="w-full bg-zinc-950 border border-zinc-850 focus:border-[#c5a059]/40 rounded-xl py-3 pl-8 pr-4 font-bold text-white text-md focus:outline-none transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Wallet Balance Info */}
                <div className="bg-zinc-900/40 rounded-xl p-3 border border-zinc-850/70 flex justify-between items-center text-xs font-sans">
                  <span className="text-zinc-500 font-semibold">আপনার বর্তমান সঞ্চয় ব্যালেন্স:</span>
                  <span className="font-bold text-[#dfc187]">{formatBDT(savingsBalance)}</span>
                </div>

                {/* Payment Methods selector */}
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
                          setDepositMethod(method.id as PaymentMethod);
                        }}
                        className={`flex items-center justify-between p-3 bg-[#111113] border rounded-2xl transition-all shadow-3xs text-left cursor-pointer ${
                          method.disabled 
                            ? 'opacity-40 cursor-not-allowed border-zinc-900' 
                            : depositMethod === method.id 
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
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${depositMethod === method.id ? 'border-[#c5a059]' : 'border-zinc-750'}`}>
                            {depositMethod === method.id && (
                              <div className="w-2.5 h-2.5 bg-[#c5a059] rounded-full" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cryptographic Secure Disclaimer Block */}
                <div className="bg-zinc-900/20 rounded-2xl p-4 border border-zinc-850/50 flex gap-3 text-zinc-455">
                  <ShieldCheck className="w-9 h-9 text-[#c5a059] flex-shrink-0 animate-pulse" />
                  <div>
                    <h5 className="text-xs font-bold text-zinc-300 font-sans">ইনস্ট্যান্ট ফান্ডিং গেটওয়ে</h5>
                    <p className="text-[10px] text-zinc-500 font-sans leading-relaxed mt-0.5">
                      আপনার জমাকৃত টাকা সরাসরি সিকিউরড মেথডে মূল সঞ্চয় ফান্ডিংয়ে সাথে সাথে যুক্ত হবে।
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Submit Button */}
              <button
                onClick={handleDepositSubmit}
                id="btn-payment-deposit-submit"
                className="w-full bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3.5 rounded-xl font-bold text-xs shadow-md transition-all font-sans text-center mt-6 cursor-pointer"
              >
                টাকা জমা নিশ্চিত করুন
              </button>
            </div>
          );
        }
      })()}

      {/* SCREEN 12: EMI INSTALLMENT PAY INPUT VIEW */}
      {panel === 'pay' && selectedEmi && (
        <div className="p-5 flex-grow flex flex-col gap-4 animate-fade-in justify-between">
          <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-4">
            {/* Header info card */}
            <div className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-850 flex gap-3 text-zinc-300">
              <Ticket className="w-8 h-8 text-[#c5a059] flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-[11px] font-bold text-zinc-400 font-sans">কিস্তি পরিশোধ্য পরিমাণ</h5>
                <p className="text-lg font-bold text-[#dfc187] font-sans mt-0.5">{formatBDT(selectedEmi.amount)}</p>
                <span className="text-[10px] text-zinc-550 font-sans mt-0.5 block">কিস্তি নং: #{toBanglaDigits(selectedEmi.installmentNo)} • তারিখ: {toBanglaDigits(selectedEmi.dueDate)}</span>
              </div>
            </div>

            {/* Wallet status banner */}
            <div className="bg-[#111113] p-3.5 rounded-xl border border-zinc-850/85 shadow-3xs flex justify-between items-center text-xs font-sans">
              <span className="text-zinc-500 font-semibold">আপনার সঞ্চয় ব্যালেন্স:</span>
              <span className="font-bold text-zinc-200">{formatBDT(savingsBalance)}</span>
            </div>

            {/* Payment Method chips */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-500 font-sans tracking-wider uppercase">পেমেন্ট মাধ্যম</label>
              <div className="flex flex-col gap-2">
                {[
                  { id: 'bkash', name: 'bKash Wallet', desc: 'বিকাশ ইনস্ট্যান্ট পেমেন্ট', color: 'bg-pink-900/30 text-pink-400 border border-pink-900/40', logo: 'bK' },
                  { id: 'nagad', name: 'Nagad Wallet', desc: 'নগদ ক্যাশ পেমেন্ট', color: 'bg-[#ff6a00]/15 text-orange-400 border border-[#ff6a00]/20', logo: 'N' },
                  { id: 'rocket', name: 'Rocket Wallet', desc: 'রকেট কুইক পে (সাময়িকভাবে নিষ্ক্রিয়)', color: 'bg-indigo-950/10 text-indigo-400/40 border border-indigo-950/20', logo: 'R', disabled: true },
                  { id: 'bank', name: 'Bank Account Transfer', desc: 'ব্যবহৃত ব্যাংক অ্যাকাউন্ট থেকে (সাময়িকভাবে নিষ্ক্রিয়)', color: 'bg-zinc-900/50 text-zinc-500 border border-zinc-900', logo: '🏛️', disabled: true },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (m.disabled) {
                        alert('দুঃখিত, এই পেমেন্ট সার্ভিসটি এখন রক্ষণাবেক্ষণের জন্য সাময়িকভাবে নিষ্ক্রিয় আছে।');
                        return;
                      }
                      setPaymentMethod(m.id as PaymentMethod);
                    }}
                    className={`flex items-center justify-between p-3.5 bg-[#111113] border rounded-2xl transition-all shadow-3xs text-left cursor-pointer ${
                      m.disabled 
                        ? 'opacity-40 cursor-not-allowed border-zinc-900' 
                        : paymentMethod === m.id 
                        ? 'border-[#c5a059]/40 ring-1 ring-[#c5a059]/10' 
                        : 'border-zinc-850/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${m.color} flex items-center justify-center font-bold text-[11px] font-sans overflow-hidden`}>
                        {m.logo}
                      </div>
                      <div>
                        <h5 className="text-[11.5px] font-bold text-zinc-200 font-sans">{m.name}</h5>
                        <p className="text-[9.5px] text-zinc-505 font-sans mt-0.5">{m.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${paymentMethod === m.id ? 'border-[#c5a059]' : 'border-zinc-750'}`}>
                        {paymentMethod === m.id && (
                          <div className="w-2.5 h-2.5 bg-[#c5a059] rounded-full" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
               type="submit"
               id="btn-payment-submit"
               className="w-full bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3.5 rounded-xl font-bold font-sans text-xs shadow-md transition-all text-center mt-4 cursor-pointer"
            >
              এখনই পেমেন্ট করুন
            </button>
          </form>
        </div>
      )}

      {/* Pin confirmation overlay / Official Gateway overlay */}
      {isProcessing && selectedEmi && (paymentMethod === 'bkash' || paymentMethod === 'nagad') ? (
        <OnlineCheckoutGateway
          type={paymentMethod}
          amount={selectedEmi.amount}
          merchantName={`${settings?.appName || 'Nano-Finance'} EMI Repayment #${selectedEmi.installmentNo}`}
          onSuccess={(accountNumber) => {
            setIsProcessing(false);
            setIsSuccess(true);
          }}
          onCancel={() => setIsProcessing(false)}
          settings={settings}
        />
      ) : isProcessing && selectedEmi ? (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-5 z-20">
          <div className="bg-[#111113] rounded-3xl p-5 w-full max-w-[280px] border border-zinc-800 shadow-2xl flex flex-col items-center animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-[#c5a059]/15 text-[#dfc187] flex items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-zinc-200 font-sans text-center mb-1">
              পেমেন্ট পিন লিখুন
            </h4>
            <p className="text-[9px] text-zinc-500 text-center mb-4 leading-relaxed font-sans">
              আপনার {getMethodNameDesc(paymentMethod)} সিকিউরিটি কোড লিখে পেমেন্ট সম্পন্ন করুন
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
                  className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 rounded-xl text-xs font-semibold font-sans transition-all text-center"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 rounded-xl text-xs font-semibold font-sans transition-all text-center font-bold cursor-pointer"
                >
                  নিশ্চিত
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Success alert card */}
      {isSuccess && selectedEmi && (
        <div className="absolute inset-0 bg-[#0a0a09] flex flex-col items-center justify-center p-6 z-20 text-center animate-fade-in select-none overflow-y-auto">
          <div className="relative flex items-center justify-center w-16 h-16 bg-emerald-950/20 text-emerald-400 rounded-full border-4 border-emerald-900/30 mb-4 animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-base font-bold text-emerald-450 mb-1">কিস্তি পরিশোধ সম্পন্ন হয়েছে!</h3>
          <p className="text-[11px] text-zinc-400 font-sans leading-relaxed max-w-[250px] mb-4">
            আপনার ঋণ কিস্তি #{toBanglaDigits(selectedEmi.installmentNo)} সফলভাবে পরিশোধ অবমুক্ত করা হয়েছে।
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
              <span>পরিশোধ মাধ্যম:</span>
              <span className="font-bold text-zinc-200">{getMethodNameDesc(paymentMethod)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>কিস্তির পরিমাণ:</span>
              <span className="font-extrabold text-[#dfc187] font-mono">{formatBDT(selectedEmi.amount)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>কিস্তি সনাক্তকরণ নম্বর:</span>
              <span className="text-zinc-200 font-bold">#{toBanglaDigits(selectedEmi.installmentNo)} নং কিস্তি</span>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-850">
              <span>ডেস্কটপ ট্রানজেকশন আইডি:</span>
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
                setPanel('schedule');
                onPaySuccess(selectedEmi.installmentNo, selectedEmi.amount, paymentMethod);
              }}
              id="btn-payment-success-ok"
              className="w-full bg-[#1c1c1e] text-zinc-300 hover:bg-zinc-800 py-2.5 rounded-xl font-bold font-sans text-xs transition-colors border border-zinc-800 text-center cursor-pointer"
            >
              কিস্তির তালিকায় ফিরে যান
            </button>
          </div>
        </div>
      )}

      {/* Deposit Gateway trigger / pin code */}
      {isDepositProcessing && (depositMethod === 'bkash' || depositMethod === 'nagad') ? (
        <OnlineCheckoutGateway
          type={depositMethod}
          amount={Number(depositAmount)}
          merchantName={`${settings?.appName || 'Nano-Finance'} Cash-In Deposit (Payment)`}
          onSuccess={(accountNumber) => {
            setIsDepositProcessing(false);
            setIsDepositSuccess(true);
          }}
          onCancel={() => setIsDepositProcessing(false)}
          settings={settings}
        />
      ) : isDepositProcessing ? (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-5 z-20 animate-fade-in">
          <div className="bg-[#111113] rounded-3xl p-5 w-full max-w-[280px] border border-zinc-800 shadow-2xl flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-[#c5a059]/10 text-[#c5a059] flex items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-zinc-100 font-sans text-center mb-1">
              নিরাপত্তা পিন লিখুন
            </h4>
            <p className="text-[9px] text-zinc-500 text-center mb-4 leading-relaxed font-sans">
              আপনার {getMethodNameDesc(depositMethod)} পিন নম্বর দিয়ে জমা নিশ্চিত করুন
            </p>

            <form onSubmit={handleConfirmDepositPinSubmit} className="w-full flex flex-col gap-4">
              <input
                type="password"
                maxLength={5}
                required
                value={depositPin}
                onChange={(e) => setDepositPin(cleanNumericInput(e.target.value))}
                placeholder="•••••"
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-[#c5a059]/40 rounded-xl py-2.5 text-center font-bold tracking-widest text-md text-white focus:outline-none transition-all"
              />

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDepositProcessing(false)}
                  className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 rounded-xl text-xs font-semibold font-sans transition-all text-center"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 rounded-xl text-xs font-semibold font-sans transition-all text-center font-bold shadow-xs cursor-pointer"
                >
                  নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Deposit Success Card Block */}
      {isDepositSuccess && (
        <div className="absolute inset-0 bg-[#0a0a09] flex flex-col items-center justify-center p-6 z-20 text-center animate-fade-in select-none">
          <div className="relative flex items-center justify-center w-20 h-20 bg-emerald-950/20 text-emerald-400 rounded-full border-4 border-emerald-950/30 mb-5 animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <h3 className="text-lg font-bold font-serif italic text-white mb-1">সঞ্চয় জমা সফল!</h3>
          <p className="text-xs text-zinc-450 font-sans leading-relaxed max-w-[240px] mb-6">
            আপনার সঞ্চয় অ্যাকাউন্টে {formatBDT(Number(depositAmount))} সফলভাবে জমা করা হয়েছে।
          </p>

          <div className="bg-[#111113] rounded-2xl p-4 w-full flex flex-col gap-2.5 text-left mb-6 font-sans border border-zinc-850">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>লেনদেন মাধ্যম:</span>
              <span className="font-bold text-zinc-200">{getMethodNameDesc(depositMethod)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>পরিমাণ:</span>
              <span className="font-bold text-[#dfc187]">{formatBDT(Number(depositAmount))}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>তারিখ:</span>
              <span className="text-zinc-200">{toBanglaDigits('০৮ জুন, ২০২৬')}</span>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-550 pt-2 border-t border-zinc-850">
              <span>লেনদেন আইডি:</span>
              <span className="font-mono">TX{Math.floor(1000 + Math.random() * 9000)}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setIsDepositSuccess(false);
              onDepositComplete?.(Number(depositAmount), depositMethod);
              setActiveTab('savings');
            }}
            id="btn-payment-deposit-ok"
            className="w-full bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3 rounded-xl font-bold font-sans text-xs transition-colors shadow-md text-center cursor-pointer"
          >
            ধন্যবাদ, ঠিক আছে
          </button>
        </div>
      )}
    </div>
  );
}
