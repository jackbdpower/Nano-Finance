/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Landmark, Phone, KeyRound, CheckCircle2, User as UserIcon, ArrowLeft, Mail, Calendar, MapPin } from 'lucide-react';

import { User } from '../types';
import { safeFetchJson } from '../utils/safeFetch';
import { cleanNumericInput } from '../utils/digitConverter';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  initialPhone?: string;
  settings?: any;
}

export default function LoginScreen({ onLoginSuccess, initialPhone = '', settings }: LoginScreenProps) {
  const appName = settings?.appName || 'ন্যানো-ফাইন্যান্স';
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Login states
  const [phone, setPhone] = useState(initialPhone && initialPhone !== '01712345678' ? initialPhone : '');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Registration states
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regGender, setRegGender] = useState('পুরুষ');
  const [regDob, setRegDob] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCurrentAddress, setRegCurrentAddress] = useState('');
  const [regPermanentAddress, setRegPermanentAddress] = useState('');
  const [regBkash, setRegBkash] = useState('');
  const [regNagad, setRegNagad] = useState('');

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phone.length < 11 || !phone.startsWith('01')) {
      setErrorMsg('সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন (যেমন: 017xxxxxxxx)');
      return;
    }
    if (pin.length < 4) {
      setErrorMsg('সঠিক পিন (PIN) কোড প্রদান করুন (কমপক্ষে ৪ ডিজিট)');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const data = await safeFetchJson<any>('/api/user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, pin }),
      });
      setIsLoading(false);

      if (data && data.success) {
        onLoginSuccess(data.user);
      } else {
        setErrorMsg((data && data.error) || 'লগইন করতে ব্যর্থ হয়েছে। পিন সঠিক কিনা পরীক্ষা করুন।');
      }
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setErrorMsg('সার্ভারে সংযোগ করা যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setErrorMsg('অনুগ্রহ করে আপনার পুরো নাম প্রদান করুন');
      return;
    }
    if (regPhone.length < 11 || !regPhone.startsWith('01')) {
      setErrorMsg('সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন (যেমন: 01xxxxxxxxx)');
      return;
    }
    if (!regGender) {
      setErrorMsg('অনুগ্রহ করে আপনার লিঙ্গ নির্বাচন করুন');
      return;
    }
    if (!regDob) {
      setErrorMsg('অনুগ্রহ করে আপনার জন্ম তারিখ প্রদান করুন');
      return;
    }
    if (regEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      setErrorMsg('সঠিক ইমেইল আইডি প্রদান করুন (অথবা এটি খালি রাখুন)');
      return;
    }
    if (!regCurrentAddress.trim()) {
      setErrorMsg('অনুগ্রহ করে আপনার বর্তমান ঠিকানা প্রদান করুন');
      return;
    }
    if (!regPermanentAddress.trim()) {
      setErrorMsg('অনুগ্রহ করে আপনার স্থায়ী ঠিকানা প্রদান করুন');
      return;
    }
    if (!regBkash.trim() && !regNagad.trim()) {
      setErrorMsg('নিবন্ধনের জন্য বিকাশ অথবা নগদ নম্বর - যেকোনো অন্তত একটি প্রদান করুন।');
      return;
    }
    if (regBkash.trim() && (regBkash.trim().length !== 11 || !regBkash.trim().startsWith('01'))) {
      setErrorMsg('বিকাশ নম্বরটি অবশ্যই সঠিক ১১ ডিজিটের মোবাইল নম্বর হতে হবে।');
      return;
    }
    if (regNagad.trim() && (regNagad.trim().length !== 11 || !regNagad.trim().startsWith('01'))) {
      setErrorMsg('নগদ নম্বরটি অবশ্যই সঠিক ১১ ডিজিটের মোবাইল নম্বর হতে হবে।');
      return;
    }
    if (regPin.length < 4 || regPin.length > 6 || !/^\d+$/.test(regPin)) {
      setErrorMsg('নিরাপত্তা পিন অবশ্যই ৪ থেকে ৬ ডিজিটের সংখ্যা হতে হবে');
      return;
    }
    if (/^(\d)\1+$/.test(regPin) || regPin === '1234' || regPin === '5678' || regPin === '123456') {
      setErrorMsg('নিরাপত্তার স্বার্থে সহজ বা ধারাবাহিক পিন দেওয়া যাবে না! (যেমন: 1111 বা 1234)');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const data = await safeFetchJson<any>('/api/user/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: regName,
          phone: regPhone,
          pin: regPin,
          gender: regGender,
          dob: regDob,
          email: regEmail,
          currentAddress: regCurrentAddress,
          permanentAddress: regPermanentAddress,
          bkashNo: regBkash,
          nagadNo: regNagad
        }),
      });
      setIsLoading(false);

      if (data && data.success) {
        setPhone(regPhone);
        setPin(regPin);
        setIsRegisterMode(false);
        setSuccessMsg(`নিবন্ধন সফল হয়েছে! মোবাইল: ${regPhone} এবং পিন: ${regPin} দিয়ে লগইন করুন।`);
      } else {
        setErrorMsg((data && data.error) || 'নিবন্ধন করতে ব্যর্থ হয়েছে। দয়া করে আবার চেষ্টা করুন।');
      }
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setErrorMsg('সার্ভারে সংযোগ করা যাচ্ছে না। পুনরায় চেষ্টা করুন।');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-zinc-300 p-6 select-none overflow-y-auto no-scrollbar justify-between">
      {/* Top Header toggle */}
      {isRegisterMode ? (
        <div className="flex items-center gap-3 pt-2 pb-4 border-b border-zinc-900/60 -mx-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setSuccessMsg('');
              setIsRegisterMode(false);
            }}
            className="p-1.5 hover:bg-zinc-900 w-8 h-8 flex items-center justify-center rounded-lg text-[#c5a059] hover:text-[#dfc187] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-[14px] font-bold font-serif italic text-white leading-none">নতুন অ্যাকাউন্ট</h3>
            <p className="text-[9px] text-[#c5a059] font-sans mt-1">{appName} মেম্বারশিপ নিবন্ধন ফরম</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center pt-6 pb-2 shrink-0">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#c5a059] to-[#8c6b2d] rounded-xl shadow-md mb-3">
            <Landmark className="w-6 h-6 text-zinc-950" />
          </div>
          <span className="text-[#c5a059] text-[9px] uppercase tracking-[0.25em] font-semibold mb-1 block italic">Curated Quality</span>
          <h2 className="text-xl font-serif italic text-white tracking-tight font-bold">
            {appName}
          </h2>
          <p className="text-[10px] text-zinc-500 font-sans tracking-wide">
            আপনার স্বপ্ন, আমাদের পরিশীলিত অঙ্গীকার
          </p>
        </div>
      )}

      {/* Dynamic Forms */}
      {!isRegisterMode ? (
        /* ==================== LOGIN VIEW ==================== */
        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4 my-auto pt-6 shrink-0">
          <div className="text-center -mt-2 mb-2">
            <span className="text-[#c5a059] text-xs font-semibold uppercase tracking-wider block">
              পিন (PIN) দিয়ে প্রবেশ করুন
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl text-xs font-sans leading-relaxed">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-xl text-xs font-sans leading-relaxed flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Phone input field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-400 font-sans mb-1">
              মোবাইল নম্বর
            </label>
            <div className="relative flex items-center">
              <Phone className="absolute left-4 w-4 h-4 text-zinc-650" />
              <input
                type="tel"
                id="input-login-phone"
                name="username"
                autoComplete="username"
                maxLength={11}
                value={phone}
                onChange={(e) => {
                  setPhone(cleanNumericInput(e.target.value));
                  if (errorMsg) setErrorMsg('');
                  if (successMsg) setSuccessMsg('');
                }}
                placeholder="01XXXXXXXXX"
                className="w-full bg-[#121212] border border-zinc-800/80 focus:border-[#c5a059]/40 rounded-xl py-3 pl-11 pr-4 text-sm font-mono text-zinc-200 focus:outline-none transition-all font-normal"
                required
              />
            </div>
          </div>

          {/* PIN Input Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-400 font-sans mb-1">
              নিরাপত্তা পিন (Security PIN)
            </label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-4 w-4 h-4 text-zinc-650" />
              <input
                type="password"
                id="input-login-pin"
                name="password"
                autoComplete="current-password"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(cleanNumericInput(e.target.value));
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="••••••"
                className="w-full bg-[#121212] border border-zinc-800/80 focus:border-[#c5a059]/40 rounded-xl py-3 pl-11 pr-4 text-sm font-mono tracking-[0.25em] text-zinc-200 focus:outline-none transition-all font-normal"
                required
              />
            </div>
          </div>

          <div className="h-1" />

          {/* Submit Button */}
          <button
            type="submit"
            id="btn-login-submit"
            disabled={isLoading}
            className="w-full bg-[#c5a059] hover:bg-[#dfc187] active:scale-[0.98] text-zinc-950 py-3.5 px-4 rounded-xl font-bold transition-all font-sans text-xs uppercase tracking-wider flex justify-center items-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
            ) : (
              'লগইন করুন'
            )}
          </button>

          {/* Registration Direct Toggle */}
          <button
            type="button"
            id="btn-goto-register"
            onClick={() => {
              setErrorMsg('');
              setSuccessMsg('');
              setIsRegisterMode(true);
            }}
            className="w-full mt-1 bg-zinc-900/60 hover:bg-zinc-900 border border-[#1d1d22]/80 hover:border-zinc-700/80 text-[#c5a059] py-3 rounded-xl font-bold transition-all text-xs font-sans tracking-wide cursor-pointer flex justify-center items-center gap-1.5 focus:outline-none"
          >
            নতুন অ্যাকাউন্ট খুলুন (Open New Account)
          </button>
        </form>
      ) : (
        /* ==================== REGISTER VIEW ==================== */
        <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4 my-auto pt-6 shrink-0">
          <div className="text-center -mt-2 mb-2">
            <span className="text-[#c5a059] text-xs font-semibold uppercase tracking-wider block">
              সদস্য নিবন্ধন করুন
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl text-xs font-sans leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Full Name input */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-400 font-sans mb-1">
              আপনার পুরো নাম
            </label>
            <div className="relative flex items-center">
              <UserIcon className="absolute left-4 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={regName}
                onChange={(e) => {
                  setRegName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="যেমন: আরিফ রহমান"
                className="w-full bg-[#121212] border border-zinc-800/80 focus:border-[#c5a059]/40 rounded-xl py-3 pl-11 pr-4 text-sm font-sans text-zinc-200 focus:outline-none transition-all font-normal"
                required
              />
            </div>
          </div>

          {/* Reg Phone Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-400 font-sans mb-1">
              মোবাইল নম্বর
            </label>
            <div className="relative flex items-center">
              <Phone className="absolute left-4 w-4 h-4 text-zinc-600" />
              <input
                type="tel"
                id="reg-phone-input"
                name="username"
                autoComplete="username"
                maxLength={11}
                value={regPhone}
                onChange={(e) => {
                  setRegPhone(cleanNumericInput(e.target.value));
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="01XXXXXXXXX"
                className="w-full bg-[#121212] border border-zinc-800/80 focus:border-[#c5a059]/40 rounded-xl py-3 pl-11 pr-4 text-sm font-mono text-zinc-200 focus:outline-none transition-all font-normal"
                required
              />
            </div>
          </div>

          {/* Gender Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-400 font-sans mb-1">
              লিঙ্গ (Gender)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['পুরুষ', 'মহিলা', 'অন্যান্য'].map((genderOption) => (
                <button
                  key={genderOption}
                  type="button"
                  onClick={() => {
                    setRegGender(genderOption);
                    if (errorMsg) setErrorMsg('');
                  }}
                  className={`py-2 px-3 text-xs font-sans rounded-xl border transition-all cursor-pointer ${
                    regGender === genderOption
                      ? 'bg-[#c5a059] border-[#c5a059] text-zinc-950 font-bold'
                      : 'bg-[#121212] border-zinc-800/60 text-zinc-400 hover:border-[#c5a059]/20'
                  }`}
                >
                  {genderOption}
                </button>
              ))}
            </div>
          </div>

          {/* Date of Birth Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-400 font-sans mb-1">
              জন্ম তারিখ (Date of Birth)
            </label>
            <div className="relative flex items-center">
              <Calendar className="absolute left-4 w-4 h-4 text-zinc-600 pointer-events-none" />
              <input
                type="date"
                value={regDob}
                onChange={(e) => {
                  setRegDob(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full bg-[#121212] border border-zinc-800/80 focus:border-[#c5a059]/40 rounded-xl py-3 pl-11 pr-4 text-sm font-sans text-zinc-200 focus:outline-none transition-all font-normal"
                required
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-400 font-sans mb-1">
              ইমেইল ঠিকানা (Email Address - ঐচ্ছিক)
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 w-4 h-4 text-zinc-600" />
              <input
                type="email"
                value={regEmail}
                onChange={(e) => {
                  setRegEmail(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="name@example.com"
                className="w-full bg-[#121212] border border-zinc-800/80 focus:border-[#c5a059]/40 rounded-xl py-3 pl-11 pr-4 text-sm font-sans text-zinc-200 focus:outline-none transition-all font-normal"
              />
            </div>
          </div>

          {/* Current Address Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-400 font-sans mb-1">
              বর্তমান ঠিকানা (Current Address)
            </label>
            <div className="relative flex items-start">
              <MapPin className="absolute left-4 top-3 w-4 h-4 text-zinc-600" />
              <textarea
                value={regCurrentAddress}
                onChange={(e) => {
                  setRegCurrentAddress(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="বাড়ি নং, গ্রাম, থানা, জেলা"
                className="w-full bg-[#121212] border border-zinc-800/80 focus:border-[#c5a059]/40 rounded-xl py-2.5 pl-11 pr-4 text-sm font-sans text-zinc-200 focus:outline-none transition-all font-normal h-16 resize-none"
                required
              />
            </div>
          </div>

          {/* Permanent Address Field */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-zinc-400 font-sans">
                স্থায়ী ঠিকানা (Permanent Address)
              </label>
              <div className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="same-address"
                  className="rounded border-[#c5a059]/40 bg-zinc-900 text-[#c5a059] focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setRegPermanentAddress(regCurrentAddress);
                    }
                  }}
                />
                <label htmlFor="same-address" className="text-[10px] text-[#c5a059] font-semibold cursor-pointer">
                  বর্তমান ঠিকানার মতই (Same)
                </label>
              </div>
            </div>
            <div className="relative flex items-start">
              <MapPin className="absolute left-4 top-3 w-4 h-4 text-zinc-600" />
              <textarea
                value={regPermanentAddress}
                onChange={(e) => {
                  setRegPermanentAddress(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="স্থায়ী গ্রাম, থানা ও জেলা"
                className="w-full bg-[#121212] border border-zinc-800/80 focus:border-[#c5a059]/40 rounded-xl py-2.5 pl-11 pr-4 text-sm font-sans text-zinc-200 focus:outline-none transition-all font-normal h-16 resize-none"
                required
              />
            </div>
          </div>

          {/* bKash and Nagad Wallet Numbers */}
          <div className="bg-zinc-950/20 p-3.5 rounded-xl border border-zinc-900/65 flex flex-col gap-2.5">
            <span className="text-[10px] text-[#c5a059] font-bold font-sans">মোবাইল ফিন্যান্সিয়াল সার্ভিস (MFS) অ্যাকাউন্ট</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* bKash input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-semibold text-zinc-400 font-sans mb-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500" /> বিকাশ অ্যাকাউন্ট নম্বর
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-[9px] uppercase font-serif font-black text-pink-500">bKash</span>
                  <input
                    type="tel"
                    id="reg-bkash-no"
                    maxLength={11}
                    value={regBkash}
                    onChange={(e) => {
                      setRegBkash(cleanNumericInput(e.target.value));
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-[#0d0d0f] border border-zinc-850/80 focus:border-pink-500/40 rounded-xl py-2.5 pl-14 pr-3 text-xs font-mono text-zinc-200 focus:outline-none transition-all font-normal"
                  />
                </div>
              </div>

              {/* Nagad input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-semibold text-zinc-400 font-sans mb-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> নগদ অ্যাকাউন্ট নম্বর
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-[9px] uppercase font-serif font-black text-orange-500">Nagad</span>
                  <input
                    type="tel"
                    id="reg-nagad-no"
                    maxLength={11}
                    value={regNagad}
                    onChange={(e) => {
                      setRegNagad(cleanNumericInput(e.target.value));
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-[#0d0d0f] border border-zinc-850/80 focus:border-orange-500/40 rounded-xl py-2.5 pl-14 pr-3 text-xs font-mono text-zinc-200 focus:outline-none transition-all font-normal"
                  />
                </div>
              </div>
            </div>
            <p className="text-[9px] text-zinc-550 leading-tight">বিকাশ ও নগদের যেকোনো একটি বা দুটি দিতে পারবেন। নিবন্ধনের জন্য অন্তত একটি প্রয়োজনীয়।</p>
          </div>

          {/* Choose PIN Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-400 font-sans mb-1">
              নিরাপত্তা পিন সেট করুন (Security PIN)
            </label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-4 w-4 h-4 text-zinc-600" />
              <input
                type="password"
                id="reg-pin-input"
                name="password"
                autoComplete="new-password"
                maxLength={6}
                value={regPin}
                onChange={(e) => {
                  setRegPin(cleanNumericInput(e.target.value));
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="কমপক্ষে ৪ ডিজিট পিন"
                className="w-full bg-[#121212] border border-zinc-800/80 focus:border-[#c5a059]/40 rounded-xl py-3 pl-11 pr-4 text-sm font-mono tracking-[0.25em] text-zinc-200 focus:outline-none transition-all font-normal"
                required
              />
            </div>
          </div>

          <div className="h-2" />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#c5a059] hover:bg-[#dfc187] active:scale-[0.98] text-zinc-950 py-3.5 px-4 rounded-xl font-bold transition-all font-sans text-xs uppercase tracking-wider flex justify-center items-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
            ) : (
              'নিবন্ধন সম্পন্ন করুন'
            )}
          </button>

          {/* Back to Login selector */}
          <div className="text-center mt-1">
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setIsRegisterMode(false);
              }}
              className="text-[11px] text-zinc-500 hover:text-zinc-350 transition-colors font-sans cursor-pointer focus:outline-none"
            >
              ইতিমধ্যে অ্যাকাউন্ট আছে? {" "}
              <span className="text-[#c5a059] font-bold underline">লগইন করুন</span>
            </button>
          </div>
        </form>
      )}

      {/* Footer copyright context */}
      <div className="text-center pt-6 pb-2 border-t border-zinc-900/40 mt-8 shrink-0">
        <span className="text-[10px] text-zinc-500 font-sans font-medium">
          © ২০২৬ {appName} লিমিটেড | সর্বস্বত্ব সংরক্ষিত
        </span>
      </div>
    </div>
  );
}
