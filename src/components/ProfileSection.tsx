/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  UserCheck, 
  ShieldCheck, 
  FileCheck, 
  Key, 
  Settings, 
  LogOut, 
  ArrowRight, 
  Camera, 
  TrendingUp,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  Activity,
  Monitor,
  Smartphone,
  RefreshCw,
  X,
  LockKeyhole,
  Sun,
  Moon
} from 'lucide-react';
import { User, SecurityLog } from '../types';
import { safeFetchJson } from '../utils/safeFetch';

interface ProfileSectionProps {
  user: User;
  onLogout: () => void;
  onNavigate: (screen: any) => void;
  onUpdateUser?: (updatedUser: any) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export default function ProfileSection({ 
  user, 
  onLogout, 
  onNavigate, 
  onUpdateUser,
  theme = 'dark',
  onToggleTheme
}: ProfileSectionProps) {
  const [isChangingPin, setIsChangingPin] = useState(false);
  
  // Local theme state with safe localStorage hydration
  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jf_theme');
      return (saved as 'dark' | 'light') || (document.documentElement.classList.contains('light') ? 'light' : 'dark');
    }
    return 'dark';
  });

  const handleToggleTheme = () => {
    const targetTheme = (onToggleTheme ? theme : localTheme) === 'dark' ? 'light' : 'dark';
    setLocalTheme(targetTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('jf_theme', targetTheme);
      if (targetTheme === 'light') {
        document.documentElement.classList.add('light');
        document.body.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.body.classList.remove('light');
      }
    }
    if (onToggleTheme) {
      onToggleTheme();
    }
  };

  const activeTheme = onToggleTheme ? theme : localTheme;

  
  // Form states
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  const handleUnderConstruction = (title: string) => {
    alert(`"${title}" সেকশনটি বর্তমানে ডেভেলপমেন্ট মোডে আছে। পরবর্তী আপডেটে এটি সম্পূর্ণ উন্মুক্ত করা হবে!`);
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin || !newPin || !confirmPin) {
      setErrorMsg('সবগুলো ফিল্ড পূরণ করা আবশ্যক।');
      return;
    }
    if (newPin.length < 4 || newPin.length > 6) {
      setErrorMsg('নতুন পিন অবশ্যই ৪ থেকে ৬ ডিজিটের মধ্যে হতে হবে।');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('নতুন পিন ও নিশ্চিতকরণ পিন মিলছে না!');
      return;
    }
    if (newPin === currentPin) {
      setErrorMsg('নতুন পিন আপনার বর্তমান পিনের মতো একই হতে পারবে না।');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const data = await safeFetchJson<any>('/api/user/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: user.phone,
          currentPin,
          newPin
        }),
      });

      setIsLoading(false);

      if (data && data.success) {
        setSuccessMsg('আপনার পিন কোডটি সফলভাবে পরিবর্তন করা হয়েছে!');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        if (onUpdateUser) {
          onUpdateUser(data.user);
        }
        setTimeout(() => {
          setIsChangingPin(false);
          setSuccessMsg('');
        }, 2200);
      } else {
        setErrorMsg((data && data.error) || 'পিন পরিবর্তন করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আপনার সঠিক বর্তমান পিন দিন।');
      }
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setErrorMsg('সার্ভারে সংযোগ করা যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।');
    }
  };

  // Get dynamic logs from user instance
  const logsList: SecurityLog[] = user.securityLogs || [
    {
      id: 'SEC_DEMO_1',
      eventType: 'info',
      status: 'info',
      details: 'নিরাপত্তা ডাটাবেজ সুরক্ষায়ন অ্যাক্টিভেট করা হয়েছে',
      ip: '127.0.0.1',
      device: 'সিস্টেম সার্ভার (Cloud VM)',
      timeLabel: '০৯ জুন, ২০২৬ (আজ)',
      timestamp: Date.now()
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a09] text-zinc-300 select-none overflow-y-auto no-scrollbar pb-10 font-sans">
      {/* Top banner layout */}
      <div className="bg-[#111113] border-b border-zinc-850/70 text-white pt-8 pb-14 px-5 rounded-b-[2rem] shadow-sm flex flex-col items-center relative select-none">
        <div className="absolute top-5 right-5">
          <span className="bg-[#c5a059]/15 border border-[#c5a059]/20 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-[#dfc187] uppercase tracking-widest">
            Member
          </span>
        </div>

        {/* Profile Avatar block */}
        <div className="relative mb-3.5 group cursor-pointer">
          <img
            src={user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260"}
            alt="User avatar"
            className="w-20 h-20 rounded-full border-4 border-zinc-800/80 object-cover shadow-md referrerpolicy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-0 right-0 p-1.5 bg-[#c5a059] text-zinc-950 rounded-full border-2 border-zinc-900 shadow-md hover:scale-105 transition-transform">
            <Camera className="w-3.5 h-3.5" />
          </div>
        </div>

        <h3 className="text-base font-bold font-serif italic text-white mb-1">
          {user.name}
        </h3>
        <p className="text-[10px] text-zinc-500 font-sans">মোবাইল: {toBanglaDigits(user.phone)}</p>

        {/* Floating status badges */}
        <div className="absolute -bottom-6 bg-zinc-950/90 backdrop-blur-md py-2 px-4 rounded-xl shadow-md border border-zinc-800 flex items-center gap-2 text-zinc-300 z-10 select-none">
          {user.role === 'main_admin' ? (
            <>
              <ShieldCheck className="w-4.5 h-4.5 text-amber-500" />
              <span className="text-[10px] font-bold text-zinc-400 font-sans">অ্যাডমিন স্ট্যাটাস:</span>
              <span className="bg-amber-950/20 text-[#dfc187] border border-amber-900/40 text-[9.5px] font-bold px-2 py-0.2 rounded-full font-sans">
                মেইন অ্যাডমিন 🛡️
              </span>
            </>
          ) : user.role === 'sub_admin' ? (
            <>
              <ShieldCheck className="w-4.5 h-4.5 text-blue-400" />
              <span className="text-[10px] font-bold text-zinc-400 font-sans">অ্যাডমিন স্ট্যাটাস:</span>
              <span className="bg-blue-950/20 text-blue-400 border border-blue-900/40 text-[9.5px] font-bold px-2 py-0.2 rounded-full font-sans">
                অ্যাডমিন 👤
              </span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-zinc-400 font-sans">KYC স্ট্যাটাস:</span>
              <span className="bg-emerald-950/20 text-emerald-400 border border-emerald-900/40 text-[9.5px] font-bold px-2 py-0.2 rounded-full">
                Verified
              </span>
            </>
          )}
        </div>
      </div>

      {/* Spacing adjustments */}
      <div className="h-10" />

      {/* Profile Checklists Options mapped precisely */}
      <div className="px-5 flex flex-col gap-3.5">
        {[
          { id: 'history', label: 'লেনদেন ইতিহাস', desc: 'সঞ্চয় জমা, উত্তোলন ও ঋণের কিস্তির হিসাব', icon: <TrendingUp className="w-5 h-5 text-[#c5a059]" /> },
          { id: 'edit', label: 'প্রোফাইল সম্পাদনা', desc: 'আইডি তথ্য, ছবি ও ইমেইল আপডেট', icon: <UserCheck className="w-5 h-5 text-indigo-400" /> },
          { id: 'pass', label: 'নিরাপত্তা পিন কোড পরিবর্তন', desc: 'অ্যাকাউন্টের ৪-৬ ডিজিট সিকিউরিটি পিন আপডেট', icon: <Key className="w-5 h-5 text-amber-500" /> },
          { id: 'kyc', label: 'KYC স্ট্যাটাস', desc: 'জাতীয় পরিচয়পত্র ভেরিফিকেশন কোড', icon: <ShieldCheck className="w-5 h-5 text-emerald-400" /> },
          { id: 'theme', label: activeTheme === 'dark' ? 'লাইট থিম সক্রিয় করুন' : 'ডার্ক থিম সক্রিয় করুন', desc: activeTheme === 'dark' ? 'উজ্জ্বল ও পরিষ্কার সাদা ইন্টারফেসে পরিবর্তন করুন' : 'অন্ধকারে আরামদায়ক কালো ইন্টারফেসে পরিবর্তন করুন', icon: activeTheme === 'dark' ? <Sun className="w-5 h-5 text-amber-500 animate-spin-slow" /> : <Moon className="w-5 h-5 text-[#c5a059]" /> },
          { id: 'docs', label: 'আমার নথি', desc: 'আপলোডকৃত এনআইডি ও অন্যান্য ফরম', icon: <FileCheck className="w-5 h-5 text-purple-400" /> },
          { id: 'settings', label: 'সেটিংস', desc: 'অ্যাপের নোটিফিকেশন ও ভাষা পরিবর্তন', icon: <Settings className="w-5 h-5 text-zinc-400" /> },
        ].filter(item => {
          if (user.role === 'main_admin' || user.role === 'sub_admin') {
            return !['history', 'kyc', 'docs'].includes(item.id);
          }
          return true;
        }).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.id === 'theme') {
                handleToggleTheme();
              } else if (item.id === 'kyc') {
                alert('আপনার জাতীয় পরিচয়পত্র (KYC) যাচাই প্রক্রিয়া সফলভাবে সম্পন্ন হয়েছে। আপনার বর্তমান স্ট্যাটাস: ভেরিফাইড (Verified).');
              } else if (item.id === 'docs') {
                onNavigate('loan_status');
              } else if (item.id === 'history') {
                onNavigate('transaction_history');
              } else if (item.id === 'pass') {
                setIsChangingPin(true);
              } else {
                handleUnderConstruction(item.label);
              }
            }}
            className="flex items-center justify-between p-3.5 bg-[#111113] border border-zinc-850/80 hover:border-[#c5a059]/10 rounded-2xl transition-all shadow-3xs text-left cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-900 flex items-center justify-center">
                {item.icon}
              </div>
              <div>
                <h5 className="text-xs font-bold text-zinc-200 font-sans">{item.label}</h5>
                <p className="text-[10px] text-zinc-500 font-sans mt-0.5">{item.desc}</p>
              </div>
            </div>
            {item.id === 'theme' ? (
              <div className={`w-8.5 h-5 rounded-full p-0.5 transition-colors duration-300 flex items-center ${activeTheme === 'light' ? 'bg-[#c5a059]' : 'bg-zinc-800 border border-zinc-700'}`}>
                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform duration-300 transform ${activeTheme === 'light' ? 'translate-x-[14px]' : 'translate-x-0'}`} />
              </div>
            ) : (
              <ArrowRight className="w-4 h-4 text-zinc-600" />
            )}
          </button>
        ))}

        {/* Dynamic Security & Audit Log Timeline */}
        <div className="mt-4 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-850/75">
          <div className="flex items-center gap-2 mb-3.5 border-b border-zinc-850/60 pb-2">
            <Activity className="w-4 h-4 text-[#c5a059] animate-pulse" />
            <span className="text-xs font-bold text-zinc-300 font-sans uppercase tracking-wider">
              নিরাপত্তা ও লগইন সেশন রেকর্ডস
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {logsList.slice(0, 4).map((log) => {
              // Custom log mapping style
              const isSuccess = log.status === 'success' || log.status === 'pin_change';
              const isLocked = log.status === 'locked';
              const isFailed = log.status === 'failed';
              
              let LogIcon = Smartphone;
              if (log.eventType === 'pin_change') LogIcon = LockKeyhole;
              else if (log.eventType === 'account_lockout') LogIcon = ShieldAlert;
              else if (log.eventType === 'register') LogIcon = ShieldCheck;
              else if (log.device.includes('Desktop') || log.device.includes('ডেস্কটপ')) LogIcon = Monitor;

              return (
                <div key={log.id} className="flex gap-2.5 items-start p-2 bg-zinc-950/45 rounded-xl border border-zinc-900/40">
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    isSuccess ? 'bg-emerald-950/25 text-emerald-400 border border-emerald-900/30' :
                    isLocked || isFailed ? 'bg-red-950/25 text-red-400 border border-red-900/30' :
                    'bg-amber-950/20 text-[#c5a059] border border-zinc-850'
                  }`}>
                    <LogIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[10.5px] font-bold text-zinc-200 leading-snug">{log.details}</span>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-zinc-500 font-sans tracking-wide">
                      <span className="truncate">{log.device}</span>
                      <span>•</span>
                      <span>IP: {log.ip}</span>
                    </div>
                    <span className="text-[8px] text-[#c5a059] mt-0.5 font-mono">
                      {log.timeLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Logout Option */}
        <button
          onClick={onLogout}
          id="btn-profile-logout"
          type="button"
          className="flex items-center justify-between p-3.5 bg-rose-950/5 hover:bg-rose-950/10 border border-rose-950/25 text-rose-400 rounded-2xl transition-all shadow-3xs text-left mt-3 cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-950 text-rose-455 border border-zinc-900 flex items-center justify-center">
              <LogOut className="w-5 h-5 cursor-pointer" />
            </div>
            <div>
              <h5 className="text-xs font-bold font-sans text-rose-455">লগআউট</h5>
              <p className="text-[10px] text-rose-500/60 font-sans mt-0.5">সুরক্ষিতভাবে সেশন শেষ করুন</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-rose-500/20" />
        </button>
      </div>

      {/* ==================== CHANGE PASSWORD INLINE DIALOG ==================== */}
      {isChangingPin && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-5 select-none animate-fade-in">
          <div className="w-full max-w-sm bg-[#0e0e0f] rounded-2xl border border-zinc-850 shadow-2xl p-5 overflow-hidden flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500 animate-bounce" />
                <h4 className="text-sm font-bold font-sans text-zinc-200">নিরাপত্তা পিন পরিবর্তন</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  setIsChangingPin(false);
                }}
                className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl text-[11px] leading-relaxed font-sans font-medium">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-xl text-[11px] leading-relaxed font-sans font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleChangePinSubmit} className="flex flex-col gap-3.5">
              {/* Current PIN field */}
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-semibold text-zinc-400 font-sans">
                  বর্তমান নিরাপত্তা পিন (৪-৬ ডিজিট)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPins ? "text" : "password"}
                    maxLength={6}
                    value={currentPin}
                    onChange={(e) => {
                      setCurrentPin(e.target.value.replace(/[^0-9]/g, ''));
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="••••"
                    className="w-full bg-[#141415] border border-zinc-800/80 focus:border-[#c5a059]/50 rounded-xl py-2.5 px-3.5 text-xs font-mono tracking-[0.2em] text-zinc-100 focus:outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPins(!showPins)}
                    className="absolute right-3.5 text-zinc-500 hover:text-zinc-300 focus:outline-none cursor-pointer"
                  >
                    {showPins ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New PIN Field */}
              <div className="flex flex-col gap-1 border-t border-zinc-900 pt-3">
                <label className="text-[10.5px] font-semibold text-zinc-400 font-sans">
                  নতুন নিরাপত্তা পিন কোড
                </label>
                <input
                  type={showPins ? "text" : "password"}
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value.replace(/[^0-9]/g, ''));
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="কমপক্ষে ৪ ডিজিট"
                  className="w-full bg-[#141415] border border-zinc-800/80 focus:border-[#c5a059]/50 rounded-xl py-2.5 px-3.5 text-xs font-mono tracking-[0.2em] text-zinc-100 focus:outline-none transition-all"
                  required
                />
              </div>

              {/* Confirm New PIN */}
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-semibold text-zinc-400 font-sans">
                  নতুন পিন নিশ্চিত করুন (Confirm)
                </label>
                <input
                  type={showPins ? "text" : "password"}
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/[^0-9]/g, ''));
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="পুনরায় পিন টাইপ করুন"
                  className="w-full bg-[#141415] border border-zinc-800/80 focus:border-[#c5a059]/50 rounded-xl py-2.5 px-3.5 text-xs font-mono tracking-[0.2em] text-zinc-100 focus:outline-none transition-all"
                  required
                />
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 font-bold transition-all text-[11px] font-sans text-center cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-1/2 bg-[#c5a059] hover:bg-[#dfc187] active:scale-[0.98] text-zinc-950 py-2.5 px-4 rounded-xl font-bold transition-all font-sans text-[11px] tracking-wide flex justify-center items-center gap-1.5 cursor-pointer"
                >
                  {isLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'পিন কোড বদলান'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
