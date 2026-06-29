/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Check, Upload, FileText, ChevronDown, ChevronUp, Clock, FileCheck, CheckCircle, Award, Eye, X, AlertTriangle } from 'lucide-react';
import { LoanItem, NewLoanForm, User } from '../types';
import { generateLoanPDF } from '../utils/pdfGenerator';

interface LoanSectionProps {
  onBack: () => void;
  activeLoans: LoanItem[];
  onSubmitLoan: (newLoan: Omit<LoanItem, 'id' | 'status' | 'date' | 'repaidCount' | 'totalInstallments'> & { id?: string }) => void;
  initialStep?: number;
  user: User;
  settings?: any;
  savingsBalance?: number;
  onGoToSavings?: () => void;
}

export default function LoanSection({ onBack, activeLoans, onSubmitLoan, initialStep = 4, user, settings, savingsBalance, onGoToSavings }: LoanSectionProps) {
  const requireMinSavings = settings?.requireMinSavingsForLoan ?? false;
  const minSavingsRequired = settings?.minSavingsForLoanAmount ?? 500;
  const userSavings = savingsBalance !== undefined ? savingsBalance : (user?.savingsBalance ?? 0);

  // Stepper state: 1 (Category selection), 2 (Amount & Duration), 3 (Documents Upload), 4 (Status lists)
  const [step, setStep] = useState<number>(() => {
    if (requireMinSavings && userSavings < minSavingsRequired && initialStep < 4) {
      return 4;
    }
    return initialStep;
  });

  // Synchronize state when sidebar navigates directly to various stepper screens
  useEffect(() => {
    if (requireMinSavings && userSavings < minSavingsRequired && initialStep < 4) {
      setShowMinSavingsAlert(true);
      setStep(4);
    } else {
      setStep(initialStep);
    }
  }, [initialStep]);

  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'repaid'>('all');
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  // States for document preview modal/lightbox
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [previewFileTitle, setPreviewFileTitle] = useState<string>('');

  // Application form states
  const annualInterestRate = settings?.interestRate ?? 14;
  const [form, setForm] = useState<NewLoanForm>({
    category: '',
    amount: 50000,
    months: 12,
    interestRate: annualInterestRate,
    nidFront: null,
    nidFrontUrl: '',
    nidBack: null,
    nidBackUrl: '',
    selfie: null,
    selfieUrl: '',
    incomeProof: null,
    incomeProofUrl: '',
    addressProof: null,
    addressProofUrl: '',
    addressProofType: 'electricity',
  });

  // Automatically adjust and synchronize dynamic interest rates proportionally based on selected term months (e.g. 14% rate over 12 months)
  useEffect(() => {
    const rate = parseFloat(((annualInterestRate * form.months) / 12).toFixed(2));
    setForm((prev) => ({
      ...prev,
      interestRate: rate
    }));
  }, [form.months, annualInterestRate]);

  // Pre-fill loan files from the most recent previous application if available
  useEffect(() => {
    const lastLoan = activeLoans && activeLoans.length > 0 ? activeLoans[0] : null;
    if (lastLoan && !form.nidFrontUrl && !form.nidBackUrl) {
      const dummyFile = new File([''], 'restored_document.png', { type: 'image/png' });
      setForm((prev) => ({
        ...prev,
        nidFront: prev.nidFront || dummyFile,
        nidFrontUrl: prev.nidFrontUrl || lastLoan.nidFrontUrl || '',
        nidBack: prev.nidBack || dummyFile,
        nidBackUrl: prev.nidBackUrl || lastLoan.nidBackUrl || '',
        selfie: prev.selfie || dummyFile,
        selfieUrl: prev.selfieUrl || lastLoan.selfieUrl || '',
        incomeProof: prev.incomeProof || dummyFile,
        incomeProofUrl: prev.incomeProofUrl || lastLoan.incomeProofUrl || '',
        addressProof: prev.addressProof || dummyFile,
        addressProofUrl: prev.addressProofUrl || lastLoan.addressProofUrl || '',
        addressProofType: prev.addressProofType || lastLoan.addressProofType || 'electricity',
      }));
    }
  }, [activeLoans]);

  const handleAutoFillDemoFiles = () => {
    const dummyFile = new File([''], 'demo_document.png', { type: 'image/png' });
    setForm((prev) => ({
      ...prev,
      nidFront: dummyFile,
      nidFrontUrl: 'https://images.unsplash.com/photo-1557177324-56c540900379?auto=format&fit=crop&q=80&w=300',
      nidBack: dummyFile,
      nidBackUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=300',
      selfie: dummyFile,
      selfieUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260',
      incomeProof: dummyFile,
      incomeProofUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&q=80&w=300',
      addressProof: dummyFile,
      addressProofUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=300',
      addressProofType: 'electricity',
    }));
  };

  const [dragOverField, setDragOverField] = useState<string | null>(null);

  // File Inputs references
  const nidFrontRef = useRef<HTMLInputElement>(null);
  const nidFrontCameraRef = useRef<HTMLInputElement>(null);
  const nidBackRef = useRef<HTMLInputElement>(null);
  const nidBackCameraRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const selfieCameraRef = useRef<HTMLInputElement>(null);
  const incomeRef = useRef<HTMLInputElement>(null);
  const addressProofRef = useRef<HTMLInputElement>(null);
  const addressProofCameraRef = useRef<HTMLInputElement>(null);

  const [activeSelectionField, setActiveSelectionField] = useState<'nidFront' | 'nidBack' | 'selfie' | 'addressProof' | null>(null);
  const [validationError, setValidationError] = useState<{ title: string; message: string } | null>(null);
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [showMinSavingsAlert, setShowMinSavingsAlert] = useState<boolean>(false);

  const handleUploadClick = (field: 'nidFront' | 'nidBack' | 'selfie' | 'addressProof') => {
    setActiveSelectionField(field);
  };

  // Calculations for EMI Preview (Screen 8)
  const getEmiDetails = () => {
    // Proportional calculations: (annualInterestRate * months) / 12 percent over the loan duration.
    const rate = parseFloat(((annualInterestRate * form.months) / 12).toFixed(2));
    const totalInterest = form.amount * (rate / 100);
    const total = form.amount + totalInterest;
    const emi = total / form.months;
    return {
      emi: Math.round(emi),
      total: Math.round(total),
      rate
    };
  };

  const { emi, total, rate: dynamicRate } = getEmiDetails();

  const handleFileChange = async (field: keyof NewLoanForm, file: File | null) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const maxSize = 5 * 1024 * 1024; // Exactly 5 MB

    // 1. Validation size (max 5 MB)
    if (file.size > maxSize) {
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
      setValidationError({
        title: 'ফাইল সাইজ বেশি বড়',
        message: `আপনার সিলেক্ট করা ফাইলটির সাইজ ${sizeInMb} MB। আমাদের সিস্টেমে সর্বোচ্চ ৫ MB সাইজের ফাইল আপলোড করা সম্ভব। অনুগ্রহ করে ফাইলটির সাইজ কমিয়ে পুনরায় আপলোড করুন।`
      });
      return;
    }

    // 2. Validation file format
    if (field === 'addressProof') {
      // bank statement can be image or pdf
      if (!isImage && !isPdf) {
        setValidationError({
          title: 'অসমর্থিত ফাইল ফরম্যাট',
          message: 'ইউটিলিটি বিল অথবা ট্যাক্স রশিদ হিসেবে শুধুমাত্র ইমেজ ফাইল (JPG, JPEG, PNG, WEBP) অথবা PDF ডকুমেন্ট আপলোড করা যাবে।'
        });
        return;
      }
    } else {
      // NID cards and selfie should only be images
      if (!isImage) {
        const fieldNameMap: Record<string, string> = {
          nidFront: 'NID সামনের অংশ',
          nidBack: 'NID পিছনের অংশ',
          selfie: 'সরাসরি সেলফি'
        };
        const displayName = fieldNameMap[field] || 'ডকুমেন্ট';
        setValidationError({
          title: 'শুধুমাত্র ইমেজ গ্রহণযোগ্য',
          message: `${displayName}-এর জন্য শুধুমাত্র ছবি ফরম্যাট (JPG, JPEG, PNG, WEBP) গ্রহণযোগ্য। অনুগ্রহ করে ছবি সিলেক্ট করুন।`
        });
        return;
      }
    }

    setUploadingFields((prev) => ({ ...prev, [field]: true }));

    try {
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const MAX_DIM = 1200;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(event.target?.result as string);
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl);
          };
          img.onerror = () => {
            const fallbackReader = new FileReader();
            fallbackReader.onload = () => resolve(fallbackReader.result as string);
            fallbackReader.readAsDataURL(file);
          };
          img.src = event.target?.result as string;
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

      setForm((prev) => {
        const updated = {
          ...prev,
          [field]: file,
          [`${field}Url`]: base64DataUrl,
        };
        if (field === 'addressProof') {
          updated.incomeProof = file;
          updated.incomeProofUrl = base64DataUrl;
        }
        return updated;
      });
    } catch (err) {
      console.error('File compression to base64 error, using standard file reader base64 fallback:', err);
      try {
        const rawBase64 = await new Promise<string>((resolve, reject) => {
          const fallbackReader = new FileReader();
          fallbackReader.onload = () => resolve(fallbackReader.result as string);
          fallbackReader.onerror = (e) => reject(e);
          fallbackReader.readAsDataURL(file);
        });
        setForm((prev) => {
          const updated = {
            ...prev,
            [field]: file,
            [`${field}Url`]: rawBase64,
          };
          if (field === 'addressProof') {
            updated.incomeProof = file;
            updated.incomeProofUrl = rawBase64;
          }
          return updated;
        });
      } catch (fallbackErr) {
        console.error('Completely failed to read file as base64:', fallbackErr);
      }
    } finally {
      setUploadingFields((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleDragOver = (e: React.DragEvent, field: string) => {
    e.preventDefault();
    setDragOverField(field);
  };

  const handleDragLeave = () => {
    setDragOverField(null);
  };

  const handleDrop = (e: React.DragEvent, field: keyof NewLoanForm) => {
    e.preventDefault();
    setDragOverField(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(field, e.dataTransfer.files[0]);
    }
  };

  // Submit Loan Application
  const handleFormSubmit = () => {
    if (!form.nidFront || !form.nidBack || !form.selfie) {
      alert('অনুগ্রহ করে এনআইডি ফ্রন্ট, ব্যাক এবং সেলফি ছবি আপলোড করুন।');
      return;
    }

    if (!form.addressProofType) {
      alert('অনুগ্রহ করে ইউটিলিটি বিল অথবা ট্যাক্স রশিদের ধরণ নির্বাচন করুন।');
      return;
    }

    if (!form.addressProof) {
      alert('অনুগ্রহ করে নির্বাচিত ইউটিলিটি বিল (বিদ্যুৎ/গ্যাস) অথবা ট্যাক্স রশিদ আপলোড করুন।');
      return;
    }

    const categoryNames: Record<string, string> = {
      business: 'ব্যবসায়িক ঋণ',
      agriculture: 'কৃষি ঋণ',
      home: 'গৃহ ঋণ',
      education: 'শিক্ষা ঋণ',
      women: 'নারী উদ্যোক্তা ঋণ',
      personal: 'ব্যক্তিগত ঋণ',
    };

    const loanId = `LN${Math.floor(10125 + Math.random() * 900)}`;
    const categoryBangla = categoryNames[form.category] || 'সাধারণ ঋণ';

    // Generate dynamic submission date in Bengali
    const currentDateObj = new Date();
    const currentDay = currentDateObj.getDate();
    const monthsBangla = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const currentMonth = monthsBangla[currentDateObj.getMonth()];
    const currentYear = currentDateObj.getFullYear();
    const dynamicDateString = `${toBanglaDigits(currentDay.toString().padStart(2, '0'))} ${currentMonth}, ${toBanglaDigits(currentYear)}`;

    // Generate and download PDF receipt automatically
    try {
      generateLoanPDF({
        user,
        form,
        emi,
        total,
        applicationId: loanId,
        categoryBangla,
        dateString: dynamicDateString
      });
    } catch (e) {
      console.error('Failed to generate PDF:', e);
    }

    onSubmitLoan({
      category: form.category as any,
      categoryBangla,
      amount: form.amount,
      months: form.months,
      interestRate: form.interestRate,
      emiAmount: emi,
      id: loanId,
      nidFrontUrl: form.nidFrontUrl,
      nidBackUrl: form.nidBackUrl,
      selfieUrl: form.selfieUrl,
      incomeProofUrl: form.incomeProofUrl,
      addressProofUrl: form.addressProofUrl,
      addressProofType: form.addressProofType,
    });

    // Take user to Status Tab list directly (Step 4)
    setStep(4);
    setStatusTab('all');

    // Reset Form fields safely
    setForm({
      category: '',
      amount: 50000,
      months: 12,
      interestRate: annualInterestRate,
      nidFront: null,
      nidFrontUrl: '',
      nidBack: null,
      nidBackUrl: '',
      selfie: null,
      selfieUrl: '',
      incomeProof: null,
      incomeProofUrl: '',
      addressProof: null,
      addressProofUrl: '',
      addressProofType: 'electricity',
    });
  };

  const handleNewApplication = () => {
    if (requireMinSavings && userSavings < minSavingsRequired) {
      setShowMinSavingsAlert(true);
    } else {
      const lastLoan = activeLoans && activeLoans.length > 0 ? activeLoans[0] : null;
      if (lastLoan) {
        const dummyFile = new File([''], 'restored_document.png', { type: 'image/png' });
        setForm({
          category: '',
          amount: 50000,
          months: 12,
          interestRate: annualInterestRate,
          nidFront: dummyFile,
          nidFrontUrl: lastLoan.nidFrontUrl || '',
          nidBack: dummyFile,
          nidBackUrl: lastLoan.nidBackUrl || '',
          selfie: dummyFile,
          selfieUrl: lastLoan.selfieUrl || '',
          incomeProof: dummyFile,
          incomeProofUrl: lastLoan.incomeProofUrl || '',
          addressProof: dummyFile,
          addressProofUrl: lastLoan.addressProofUrl || '',
          addressProofType: lastLoan.addressProofType || 'electricity',
        });
      } else {
        setForm({
          category: '',
          amount: 50000,
          months: 12,
          interestRate: annualInterestRate,
          nidFront: null,
          nidFrontUrl: '',
          nidBack: null,
          nidBackUrl: '',
          selfie: null,
          selfieUrl: '',
          incomeProof: null,
          incomeProofUrl: '',
          addressProof: null,
          addressProofUrl: '',
          addressProofType: 'electricity',
        });
      }
      setStep(1);
    }
  };

  const formatBDT = (amount: number) => {
    return `৳ ${Math.round(amount).toLocaleString('bn-BD')}`;
  };

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  // Loan status filter calculation
  const filteredLoans = activeLoans
    .filter((loan) => {
      if (statusTab === 'all') return true;
      if (statusTab === 'active') return loan.status === 'approved' || loan.status === 'pending';
      if (statusTab === 'repaid') return loan.status === 'paid';
      return true;
    })
    .sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      const idA = parseInt(a.id.replace(/\D/g, '')) || 0;
      const idB = parseInt(b.id.replace(/\D/g, '')) || 0;
      return idB - idA;
    });

  return (
    <div className="flex flex-col h-full bg-[#0a0a09] text-zinc-300 select-none overflow-y-auto no-scrollbar pb-6">
      {/* Header with back navigation context */}
      <div className="bg-zinc-950 px-5 py-4 flex items-center gap-3 sticky top-0 border-b border-zinc-900 z-10 shadow-xs justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (step > 1 && step < 4) {
                setStep(step - 1);
              } else {
                onBack();
              }
            }}
            id="btn-loan-back"
            className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-450 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-base font-bold font-serif italic text-white font-medium">
              {step === 4 ? 'আমার ঋণসমূহ' : 'ঋণ আবেদন'}
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              {step === 4 ? 'বর্তমান ঋণের তালিকা ও স্থিতি' : `ধাপ ${toBanglaDigits(step)}: ঋণ ক্যালকুলেশন`}
            </p>
          </div>
        </div>

        {step === 4 && (
          <button
            onClick={handleNewApplication}
            id="btn-loan-new-apply"
            className="bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 text-xs font-bold py-2 px-3.5 rounded-xl transition-colors font-sans cursor-pointer"
          >
            নতুন আবেদন
          </button>
        )}
      </div>

      {/* STEP INDICATORS for Application workflow (Screens 7, 8, 9) */}
      {step < 4 && (
        <div className="bg-[#111113]/30 py-3.5 px-6 border-b border-zinc-900 flex justify-between items-center z-10">
          <div className="flex items-center justify-between w-full max-w-sm mx-auto">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${step === s ? 'bg-[#c5a059] text-zinc-950 shadow-xs scale-110' : step > s ? 'bg-emerald-950/20 border border-emerald-900/30 text-emerald-400' : 'bg-zinc-900 border border-zinc-850 text-zinc-650'}`}
                  >
                    {step > s ? <Check className="w-4 h-4 cursor-pointer" /> : toBanglaDigits(s)}
                  </div>
                  <span className={`text-xs font-sans font-bold transition-colors ${step === s ? 'text-[#dfc187]' : step > s ? 'text-emerald-500' : 'text-zinc-450'}`}>
                    {s === 1 ? 'ধাপ ১' : s === 2 ? 'ধাপ ২' : 'ধাপ ৩'}
                  </span>
                </div>
                {s < 3 && <div className={`h-[1px] flex-grow mx-2 border-t border-dashed transition-all ${step > s ? 'border-emerald-950/40' : 'border-zinc-850'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* SCREEN 7: STEP 1 - Loan Category selection */}
      {step === 1 && (
        <div className="p-5 flex-grow flex flex-col gap-4 animate-fade-in justify-between">
          <div>
            <h4 className="text-xs font-bold text-zinc-400 font-sans tracking-widest uppercase mb-3">ঋণের ধরণ নির্বাচন করুন</h4>
            <div className="flex flex-col gap-2">
              {[
                { id: 'personal', title: 'ব্যক্তিগত ঋণ', desc: 'জরুরি ব্যক্তিগত প্রয়োজন মেটানোর জন্য', icon: '👤' },
                { id: 'business', title: 'ব্যবসায়িক ঋণ', desc: 'ব্যবসা বাড়ানোর বা পরিচালনার জন্য', icon: '💼' },
                { id: 'agriculture', title: 'কৃষি ঋণ', desc: 'বীজ, সার এবং কৃষি সেচ ক্রয়ের জন্য', icon: '🌱' },
                { id: 'home', title: 'গৃহ ঋণ', desc: 'বাড়ি সংস্কার বা নতুন নির্মাণের জন্য', icon: '🏠' },
                { id: 'education', title: 'শিক্ষা ঋণ', desc: 'ভর্তির ফি ও উচ্চ শিক্ষার জন্য', icon: '🎓' },
                { id: 'women', title: 'নারী উদ্যোক্তা ঋণ', desc: 'অনুদানের মাধ্যমে ব্যবসায়িক সহায়তায়', icon: '👩‍💼' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, category: cat.id as any }))}
                  className={`flex items-center justify-between p-3.5 bg-[#111113] border rounded-2xl transition-all shadow-3xs text-left ${form.category === cat.id ? 'border-[#c5a059]/40 ring-1 ring-[#c5a059]/10 bg-[#c5a059]/5' : 'border-zinc-850/80'}`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <h5 className="text-sm font-bold text-zinc-100 font-sans">{cat.title}</h5>
                      <p className="text-xs text-zinc-400 font-sans mt-0.5">{cat.desc}</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${form.category === cat.id ? 'border-[#c5a059] bg-[#c5a059] text-zinc-950' : 'border-zinc-750'}`}>
                    {form.category === cat.id && <Check className="w-3" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={!form.category}
            onClick={() => setStep(2)}
            id="btn-loan-step1-next"
            className="w-full bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed py-3.5 rounded-xl font-bold font-sans text-xs shadow-md transition-all text-center mt-6 cursor-pointer"
          >
            পরবর্তী
          </button>
        </div>
      )}

      {/* SCREEN 8: STEP 2 - Slider Calculation */}
      {step === 2 && (
        <div className="p-5 flex-grow flex flex-col gap-5 animate-fade-in justify-between">
          <div>
            <span className="text-xs font-bold text-zinc-300 font-sans block tracking-widest uppercase mb-4">ঋণের পরিমাণ ও মেয়াদ নির্ধারণ</span>

            {/* Slider 1: Amount */}
            <div className="bg-[#111113] p-4 rounded-xl border border-zinc-850/80 shadow-3xs flex flex-col gap-3 mb-4">
              <div className="flex justify-between items-center text-sm text-zinc-300 font-sans">
                <span>ঋণের পরিমাণ (BDT)</span>
                <span className="font-bold text-[#dfc187] text-base">{formatBDT(form.amount)}</span>
              </div>
              <input
                type="range"
                min={20000}
                max={150000}
                step={5000}
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-[#c5a059]"
              />
              <div className="flex justify-between text-xs text-zinc-400 font-sans">
                <span>৳ ২০,০০০</span>
                <span>৳ ১,৫০,০০০</span>
              </div>
              <div className="flex gap-1.5 mt-1 border-t border-zinc-900/40 pt-2 shrink-0">
                {[20000, 50000, 100000, 150000].map((presetAmt) => (
                  <button
                    key={presetAmt}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, amount: presetAmt }))}
                    className={`flex-1 py-1 text-xs font-sans font-bold rounded-lg border transition-all cursor-pointer ${form.amount === presetAmt ? 'bg-[#c5a059] border-[#c5a059] text-zinc-950 px-1' : 'bg-zinc-950/60 border-zinc-850 text-zinc-300 hover:border-zinc-750'}`}
                  >
                    {presetAmt === 150000 ? '১.৫ লক্ষ' : presetAmt === 100000 ? '১ লক্ষ' : toBanglaDigits(presetAmt / 1000) + ' হাজার'}
                  </button>
                ))}
              </div>
            </div>

            {/* Slider 2: Month duration */}
            <div className="bg-[#111113] p-4 rounded-xl border border-zinc-850/80 shadow-3xs flex flex-col gap-3 mb-4">
              <div className="flex justify-between items-center text-sm text-zinc-300 font-sans">
                <span>ঋণের মেয়াদ</span>
                <span className="font-bold text-[#dfc187] text-base">{toBanglaDigits(form.months)} মাস</span>
              </div>
              <input
                type="range"
                min={3}
                max={12}
                step={3}
                value={form.months}
                onChange={(prev) => setForm((p) => ({ ...p, months: Number(prev.target.value) }))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-[#c5a059]"
              />
              <div className="flex justify-between text-xs text-zinc-400 font-sans">
                <span>৩ মাস</span>
                <span>১২ মাস</span>
              </div>
              <div className="flex gap-1.5 mt-1 border-t border-zinc-900/40 pt-2 shrink-0">
                {[3, 6, 9, 12].map((presetMonths) => (
                  <button
                    key={presetMonths}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, months: presetMonths }))}
                    className={`flex-1 py-1 text-xs font-sans font-bold rounded-lg border transition-all cursor-pointer ${form.months === presetMonths ? 'bg-[#c5a059] border-[#c5a059] text-zinc-950' : 'bg-zinc-950/60 border-zinc-850 text-zinc-300 hover:border-zinc-750'}`}
                  >
                    {toBanglaDigits(presetMonths)} মাস
                  </button>
                ))}
              </div>
            </div>

            {/* Display static Interest rate banner of settings rate */}
            <div className="bg-[#111113] p-4 rounded-xl border border-zinc-850/80 shadow-3xs flex justify-between items-center mb-4">
              <div>
                <span className="text-xs font-bold text-zinc-300 font-sans block">ঋণের সুদের হার</span>
                <span className="text-xs text-zinc-400 font-sans mt-0.5 block">(১২ মাসের জন্য {toBanglaDigits(annualInterestRate)}% হারে আনুপাতিক হিসেব)</span>
              </div>
              <span className="text-xs font-bold text-[#dfc187] font-sans">{toBanglaDigits(dynamicRate)}% (স্থির)</span>
            </div>

            {/* Calculations display */}
            <div className="bg-zinc-900/45 p-4 rounded-xl border border-zinc-850 flex justify-between items-center mb-2">
              <div>
                <p className="text-xs text-zinc-400 font-sans">আনুমানিক মাসিক কিস্তি (EMI)</p>
                <p className="text-lg font-bold text-[#dfc187] mt-1 font-sans">{formatBDT(emi)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400 font-sans">মোট পরিশোধযোগ্য</p>
                <p className="text-sm font-semibold text-zinc-200 font-sans mt-1">{formatBDT(total)}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(3)}
            id="btn-loan-step2-next"
            className="w-full bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3.5 rounded-xl font-bold font-sans text-xs shadow-md transition-all text-center mt-6 cursor-pointer"
          >
            পরবর্তী
          </button>
        </div>
      )}

      {/* SCREEN 9: STEP 3 - Documents upload with Drag zones & real previews */}
      {step === 3 && (
        <div className="p-4 flex-grow flex flex-col gap-4 animate-fade-in justify-between">
          <div>
            <span className="text-xs font-bold text-zinc-300 font-sans block tracking-widest uppercase mb-2">প্রয়োজনীয় নথি আপলোড করুন</span>

            {/* Quick Demo Docs Filler helper for high-fidelity interactive sandbox */}
            <div className="mb-4 bg-[#c5a059]/10 border border-[#c5a059]/15 p-2.5 rounded-xl flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-300 font-medium font-sans">টেস্টিংয়ের জন্য ওয়ান-ক্লিক নথি লোড করুন:</span>
              <button
                type="button"
                onClick={handleAutoFillDemoFiles}
                className="bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 text-xs font-bold py-1 px-2.5 rounded-lg font-sans transition-colors cursor-pointer"
              >
                ডেমো ফাইল লোড করুন
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Box 1: NID Front */}
              <div
                onDragOver={(e) => handleDragOver(e, 'nidFront')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'nidFront')}
                className={`relative border-2 border-dashed rounded-2xl p-2.5 flex flex-col items-center justify-center text-center transition-all bg-[#111113] h-36 ${dragOverField === 'nidFront' ? 'border-[#c5a059] bg-[#c5a059]/5' : 'border-zinc-800'}`}
              >
                {uploadingFields.nidFront && (
                  <div className="absolute inset-0 bg-[#000000a0] flex flex-col items-center justify-center rounded-2xl z-25">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent border-[#c5a059] mb-1.5" />
                    <span className="text-[10px] text-zinc-300 font-sans">প্রসেসিং...</span>
                  </div>
                )}
                {/* Standard input for gallery/files selection */}
                <input
                  type="file"
                  accept="image/*"
                  ref={nidFrontRef}
                  onChange={(e) => handleFileChange('nidFront', e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                />
                {/* Captured input for Camera directly */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={nidFrontCameraRef}
                  onChange={(e) => handleFileChange('nidFront', e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                />

                {form.nidFrontUrl ? (
                  <div className="relative group w-full h-full flex flex-col items-center justify-center">
                    <img
                      src={form.nidFrontUrl}
                      alt="NID Front"
                      className="w-full h-16 rounded-lg object-cover border border-zinc-800"
                    />
                    <div className="flex gap-2 mt-2 z-10 w-full justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFileUrl(form.nidFrontUrl || '');
                          setPreviewFileTitle('NID সামনের ছবি');
                        }}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 bg-[#102a1b]/90 px-2 py-1 rounded border border-emerald-900/50 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> বড় করুন
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUploadClick('nidFront');
                        }}
                        className="text-[10px] text-zinc-300 hover:text-white font-bold flex items-center gap-1 bg-zinc-90 w-12 px-2 py-1 rounded border border-zinc-800 transition-colors cursor-pointer"
                      >
                        পরিবর্তন
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => handleUploadClick('nidFront')} className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                    <Upload className="w-5 h-5 text-zinc-400 mb-1.5" />
                    <span className="text-xs font-bold font-sans text-zinc-200 text-center">NID সামনের অংশ</span>
                    <span className="text-[10px] font-sans text-zinc-455 mt-1 text-center">ক্যামেরা অথবা গ্যালারি</span>
                  </div>
                )}
              </div>

              {/* Box 2: NID Back */}
              <div
                onDragOver={(e) => handleDragOver(e, 'nidBack')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'nidBack')}
                className={`relative border-2 border-dashed rounded-2xl p-2.5 flex flex-col items-center justify-center text-center transition-all bg-[#111113] h-36 ${dragOverField === 'nidBack' ? 'border-[#c5a059] bg-[#c5a059]/5' : 'border-zinc-800'}`}
              >
                {uploadingFields.nidBack && (
                  <div className="absolute inset-0 bg-[#000000a0] flex flex-col items-center justify-center rounded-2xl z-25">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent border-[#c5a059] mb-1.5" />
                    <span className="text-[10px] text-zinc-300 font-sans">প্রসেসিং...</span>
                  </div>
                )}
                {/* Standard input for gallery/files selection */}
                <input
                  type="file"
                  accept="image/*"
                  ref={nidBackRef}
                  onChange={(e) => handleFileChange('nidBack', e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                />
                {/* Captured input for Camera directly */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={nidBackCameraRef}
                  onChange={(e) => handleFileChange('nidBack', e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                />

                {form.nidBackUrl ? (
                  <div className="relative group w-full h-full flex flex-col items-center justify-center">
                    <img
                      src={form.nidBackUrl}
                      alt="NID Back"
                      className="w-full h-16 rounded-lg object-cover border border-zinc-805 bg-zinc-950"
                    />
                    <div className="flex gap-2 mt-2 z-10 w-full justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFileUrl(form.nidBackUrl || '');
                          setPreviewFileTitle('NID পিছনের ছবি');
                        }}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 bg-[#102a1b]/90 px-2 py-1 rounded border border-emerald-900/50 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> বড় করুন
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUploadClick('nidBack');
                        }}
                        className="text-[10px] text-zinc-300 hover:text-white font-bold flex items-center gap-1 bg-zinc-90 w-12 px-2 py-1 rounded border border-zinc-800 transition-colors cursor-pointer"
                      >
                        পরিবর্তন
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => handleUploadClick('nidBack')} className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                    <Upload className="w-5 h-5 text-zinc-400 mb-1.5" />
                    <span className="text-xs font-bold font-sans text-zinc-200 text-center">NID পিছনের অংশ</span>
                    <span className="text-[10px] font-sans text-zinc-455 mt-1 text-center">ক্যামেরা অথবা গ্যালারি</span>
                  </div>
                )}
              </div>

              {/* Box 3: Selfie */}
              <div
                onDragOver={(e) => handleDragOver(e, 'selfie')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'selfie')}
                className={`col-span-1 relative border-2 border-dashed rounded-2xl p-2.5 flex flex-col items-center justify-center text-center transition-all bg-[#111113] h-36 ${dragOverField === 'selfie' ? 'border-[#c5a059] bg-[#c5a059]/5' : 'border-zinc-800'}`}
              >
                {uploadingFields.selfie && (
                  <div className="absolute inset-0 bg-[#000000a0] flex flex-col items-center justify-center rounded-2xl z-25">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent border-[#c5a059] mb-1.5" />
                    <span className="text-[10px] text-zinc-300 font-sans">প্রসেসিং...</span>
                  </div>
                )}
                {/* Standard input for gallery/files selection */}
                <input
                  type="file"
                  accept="image/*"
                  ref={selfieRef}
                  onChange={(e) => handleFileChange('selfie', e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                />
                {/* Captured input for Camera directly */}
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  ref={selfieCameraRef}
                  onChange={(e) => handleFileChange('selfie', e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                />

                {form.selfieUrl ? (
                  <div className="relative group w-full h-full flex flex-col items-center justify-center">
                    <img
                      src={form.selfieUrl}
                      alt="Selfie"
                      className="w-12 h-12 rounded-full object-cover border border-zinc-805"
                    />
                    <div className="flex gap-2 mt-2 z-10 w-full justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFileUrl(form.selfieUrl || '');
                          setPreviewFileTitle('সেলফি ছবি');
                        }}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 bg-[#102a1b]/90 px-2 py-1 rounded border border-emerald-900/50 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> বড় করুন
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUploadClick('selfie');
                        }}
                        className="text-[10px] text-zinc-300 hover:text-white font-bold flex items-center gap-1 bg-zinc-90 w-12 px-2 py-1 rounded border border-zinc-800 transition-colors cursor-pointer"
                      >
                        পরিবর্তন
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => handleUploadClick('selfie')} className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                    <Upload className="w-5 h-5 text-zinc-400 mb-1.5" />
                    <span className="text-xs font-bold font-sans text-zinc-200 text-center">সরাসরি সেলফি</span>
                    <span className="text-[10px] font-sans text-zinc-455 mt-1 text-center">ক্যামেরা অথবা গ্যালারি</span>
                  </div>
                )}
              </div>

              {/* Box 4: Utility Bill/Tax Receipt */}
              <div
                onDragOver={(e) => handleDragOver(e, 'addressProof')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'addressProof')}
                className={`col-span-1 relative border-2 border-dashed rounded-2xl p-2.5 flex flex-col items-center justify-center text-center transition-all bg-[#111113] h-36 ${dragOverField === 'addressProof' ? 'border-[#c5a059] bg-[#c5a059]/5' : 'border-zinc-800'}`}
              >
                {uploadingFields.addressProof && (
                  <div className="absolute inset-0 bg-[#000000a0] flex flex-col items-center justify-center rounded-2xl z-25">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent border-[#c5a059] mb-1.5" />
                    <span className="text-[10px] text-zinc-300 font-sans">প্রসেসিং...</span>
                  </div>
                )}
                {/* Standard input for gallery/files selection */}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  ref={addressProofRef}
                  onChange={(e) => handleFileChange('addressProof', e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                />
                {/* Captured input for Camera directly */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={addressProofCameraRef}
                  onChange={(e) => handleFileChange('addressProof', e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                />

                {form.addressProofUrl ? (
                  <div className="relative group w-full h-full flex flex-col items-center justify-center">
                    <div className="w-full h-14 rounded-lg overflow-hidden border border-zinc-900 bg-zinc-950 flex items-center justify-center mb-1">
                      {form.addressProofUrl.startsWith('data:image/') || form.addressProofUrl.startsWith('blob:') || form.addressProofUrl.includes('unsplash.com') || form.addressProofUrl.includes('http') || form.addressProofUrl.startsWith('/') ? (
                        <img
                          src={form.addressProofUrl}
                          alt="Utility Bill/Tax"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-[#c5a059]" />
                      )}
                    </div>
                    
                    {/* Document Type Badge */}
                    <span className="absolute top-1 left-1 bg-black/85 px-1.5 py-0.5 rounded text-[8px] font-sans text-[#dfc187] border border-zinc-800">
                      {form.addressProofType === 'electricity' ? 'বিদ্যুৎ বিল' : form.addressProofType === 'gas' ? 'গ্যাস বিল' : form.addressProofType === 'tax_receipt' ? 'ট্যাক্স রশিদ' : 'ইউটিলিটি'}
                    </span>

                    <div className="flex gap-1 z-10 w-full justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFileUrl(form.addressProofUrl || '');
                          setPreviewFileTitle(
                            form.addressProofType === 'electricity' ? 'বিদ্যুৎ বিল' : form.addressProofType === 'gas' ? 'গ্যাস বিল' : form.addressProofType === 'tax_receipt' ? 'ট্যাক্স রশিদ' : 'ইউটিলিটি বিল'
                          );
                        }}
                        className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 bg-[#102a1b]/90 px-1.5 py-0.5 rounded border border-emerald-950/50 transition-colors cursor-pointer"
                      >
                        <Eye className="w-2.5 h-2.5" /> বড় করুন
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUploadClick('addressProof');
                        }}
                        className="text-[9px] text-zinc-300 hover:text-white font-bold flex items-center gap-0.5 bg-zinc-90 w-11 px-1.5 py-0.5 rounded border border-zinc-800 transition-colors cursor-pointer"
                      >
                        পরিবর্তন
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full h-full justify-between py-1">
                    {/* Compact custom dropdown option */}
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="w-full px-1 z-15"
                    >
                      <select
                        value={form.addressProofType}
                        onChange={(e) => setForm((prev) => ({ ...prev, addressProofType: e.target.value as any }))}
                        className="w-full bg-[#161619] border border-zinc-850 hover:border-[#c5a059]/40 text-zinc-300 text-[10px] font-sans font-bold rounded px-1 py-0.5 focus:outline-none cursor-pointer"
                      >
                        <option value="electricity">⚡ বিদ্যুৎ বিল</option>
                        <option value="gas">🔥 গ্যাস বিল</option>
                        <option value="tax_receipt">📝 ট্যাক্স রশিদ</option>
                      </select>
                    </div>

                    <div onClick={() => handleUploadClick('addressProof')} className="flex flex-col items-center cursor-pointer w-full flex-grow justify-center">
                      <Upload className="w-4 h-4 text-zinc-400 mb-1" />
                      <span className="text-[11px] font-bold font-sans text-zinc-200 text-center">বিল বা রশিদ দিন</span>
                      <span className="text-[8px] font-sans text-zinc-455 text-center">ক্যামেরা অথবা গ্যালারি</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-zinc-900/25 rounded-2xl p-4 border border-zinc-850 flex gap-3 text-zinc-300 mt-4">
              <FileCheck className="w-8 h-8 text-[#c5a059] flex-shrink-0" />
              <div>
                <h5 className="text-xs font-bold text-zinc-200 font-sans">১০০% স্বচ্ছ আবেদন প্রক্রিয়া</h5>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed mt-1">
                  আপনার আপলোডকৃত ছবি বা আইডি ফাইলসমূহ সম্পূর্ণ নিরাপদ রাখা হবে এবং অনুমোদনের ভিত্তিতে যাচাই করা হবে।
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleFormSubmit}
            id="btn-loan-submit-apply"
            className="w-full bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3.5 rounded-xl font-bold font-sans text-xs shadow-md transition-all text-center mt-6 cursor-pointer"
          >
            আবেদন জমা দিন
          </button>
        </div>
      )}

            {/* SCREEN 10: STEP 4 - Active status check lists */}
      {step === 4 && (
        <div className="p-4 flex-grow flex flex-col gap-4 animate-fade-in">
          {/* Status Tabs filters bar */}
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-900 flex gap-1 font-sans">
            {(['all', 'active', 'repaid'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-colors cursor-pointer ${statusTab === tab ? 'bg-[#c5a059] text-zinc-950' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'}`}
              >
                {tab === 'all' ? 'সবগুলো' : tab === 'active' ? 'চলতি ঋণ' : 'পরিশোধিত'}
              </button>
            ))}
          </div>

          {/* List of active loan items */}
          <div className="flex flex-col gap-3">
            {filteredLoans.length === 0 ? (
              <div className="bg-[#111113] p-7 rounded-2xl border border-zinc-850 text-center flex flex-col items-center">
                <FileText className="w-9 h-9 text-zinc-700 mb-2" />
                <p className="text-xs text-zinc-550 font-sans">কোনো ঋণের আবেদন খুঁজে পাওয়া যায়নি।</p>
              </div>
            ) : (
              filteredLoans.map((loan) => {
                const getStatusStyle = (st: string) => {
                  switch (st) {
                    case 'pending': return 'bg-amber-950/20 text-amber-400 border-amber-900/30';
                    case 'approved': return 'bg-emerald-950/20 text-emerald-400 border-[#c5a059]/30';
                    case 'paid': return 'bg-zinc-850 text-zinc-300 border-zinc-850';
                    case 'rejected': return 'bg-rose-950/20 text-rose-400 border-rose-900/25';
                    default: return 'bg-zinc-900 text-zinc-500 border-zinc-850';
                  }
                };

                const getStatusText = (st: string) => {
                  switch (st) {
                    case 'pending': return 'পেন্ডিং (Pending)';
                    case 'approved': return 'চলমান (Approved)';
                    case 'paid': return 'পরিশোধিত (Paid)';
                    case 'rejected': return 'বাতিল (Rejected)';
                    default: return st;
                  }
                };

                const isExpanded = expandedLoan === loan.id;

                return (
                  <div
                    key={loan.id}
                    className="bg-[#111113] rounded-2xl border border-zinc-850/85 overflow-hidden transition-all duration-300 shadow-sm"
                  >
                    {/* Header bar card */}
                    <div className="p-4 flex justify-between items-center bg-zinc-900/10">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold font-mono text-zinc-300">{loan.id}</span>
                          <span className={`text-xs font-bold border px-2.5 py-0.5 rounded-full ${getStatusStyle(loan.status)}`}>
                            {getStatusText(loan.status)}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white mt-1.5 font-sans justify-center">
                          {loan.categoryBangla}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-zinc-400 font-sans block">ঋণের পরিমাণ</span>
                        <p className="text-sm font-bold text-[#dfc187] font-sans mt-0.5">{formatBDT(loan.amount)}</p>
                      </div>
                    </div>

                    {/* Quick overview meta info block */}
                    <div className="px-4 pb-3.5 flex justify-between items-center text-xs text-zinc-400 font-sans">
                      <span className="text-xs">আবেদন তারিখ: {toBanglaDigits(loan.date)}</span>
                      <button
                        onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
                        className="text-xs text-[#c5a059] flex items-center gap-1 font-sans font-bold hover:underline"
                      >
                        {isExpanded ? 'সংক্ষিপ্ত করুন' : 'বিস্তারিত দেখুন'}
                        {isExpanded ? <ChevronUp className="w-4 h-4 cursor-pointer" /> : <ChevronDown className="w-4 h-4 cursor-pointer" />}
                      </button>
                    </div>

                    {/* Detailed Expanded Panel (Screen 10 details block) */}
                    {isExpanded && (
                      <div className="bg-zinc-950/65 border-t border-zinc-900/80 p-4 font-sans text-xs flex flex-col gap-3 animate-fade-in">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-zinc-400 block">ঋণের মেয়াদ:</span>
                            <span className="font-bold text-zinc-200 mt-0.5 block">{toBanglaDigits(loan.months)} মাস</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 block">বার্ষিক সুদের হার:</span>
                            <span className="font-bold text-zinc-200 mt-0.5 block">{toBanglaDigits(loan.interestRate)}%</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 block">মাসিক কিস্তি (EMI):</span>
                            <span className="font-bold text-[#dfc187] mt-0.5 block">{formatBDT(loan.emiAmount)}</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 block">পরিশোধিত কিস্তি:</span>
                            <span className="font-bold text-zinc-200 mt-0.5 block">
                              {toBanglaDigits(loan.repaidCount)}/{toBanglaDigits(loan.totalInstallments)}
                            </span>
                          </div>
                        </div>

                        {loan.status === 'approved' && (
                          <div className="flex gap-2 bg-emerald-950/10 p-2.5 rounded-xl border border-emerald-900/20 mt-1">
                            <CheckCircle className="w-4 h-4 text-emerald-450 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-zinc-300 leading-relaxed">
                              Your loan is active (চলমান আছে). You can repay upcoming installments under payments section (পরিশোধ মেনু).
                            </p>
                          </div>
                        )}

                        {loan.status === 'pending' && (
                          <div className="flex gap-2 bg-amber-950/10 p-2.5 rounded-xl border border-amber-900/20 mt-1">
                            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                              Under evaluation (যাচাই প্রক্রিয়াদ্বীন). Our verification team will review documents in 24 hours.
                            </p>
                          </div>
                        )}

                        {loan.status === 'rejected' && (
                          <div className="flex gap-2 bg-rose-950/10 p-2.5 rounded-xl border border-rose-900/20 mt-1 animate-fade-in">
                            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                              দুঃখিত! আপনার এই ঋণের আবেদনটি বাতিল হয়েছে। নতুনভাবে আবেদন করতে চাইলে উপরে ডানদিকের <span className="text-[#dfc187] font-bold">"নতুন আবেদন"</span> বাটনে ক্লিক করে পুনরায় আবেদন করুন।
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* PHOTO SOURCES DIALOG */}
      {activeSelectionField && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/85 backdrop-blur-xs"
          onClick={() => setActiveSelectionField(null)}
        >
          <div 
            className="bg-[#121214] border border-zinc-800/80 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setActiveSelectionField(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-900/50 transition-colors"
            >
              <X className="w-5 h-5 cursor-pointer" />
            </button>

            <h3 className="text-sm font-bold text-zinc-100 font-sans mb-1 text-center">
              আপলোড মাধ্যম নির্বাচন করুন
            </h3>
            <p className="text-[11px] text-zinc-400 text-center mb-6 font-sans">
              আবেদনের জন্য ডকুমেন্টটি কীভাবে প্রদান করতে চান তা নির্ধারণ করুন।
            </p>

            <div className="flex flex-col gap-3">
              {/* Camera Option */}
              <button
                type="button"
                onClick={() => {
                  const field = activeSelectionField;
                  setActiveSelectionField(null);
                  setTimeout(() => {
                    if (field === 'nidFront') nidFrontCameraRef.current?.click();
                    else if (field === 'nidBack') nidBackCameraRef.current?.click();
                    else if (field === 'selfie') selfieCameraRef.current?.click();
                    else if (field === 'addressProof') addressProofCameraRef.current?.click();
                  }, 150);
                }}
                className="flex items-center gap-4 w-full p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-[#c5a059]/10 border border-[#c5a059]/20 hover:border-[#dfc187]/50 active:scale-[0.98] transition-all text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-[#c5a059]/20 flex items-center justify-center text-[#c5a059] group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-150 font-sans">📸 ক্যামেরা দিয়ে ছবি তুলুন</h4>
                  <p className="text-[10px] text-zinc-400 font-sans mt-0.5">আপনার ফোনের ক্যামেরা দিয়ে সরাসরি ছবি তুলুন</p>
                </div>
              </button>

              {/* Gallery Option */}
              <button
                type="button"
                onClick={() => {
                  const field = activeSelectionField;
                  setActiveSelectionField(null);
                  setTimeout(() => {
                    if (field === 'nidFront') nidFrontRef.current?.click();
                    else if (field === 'nidBack') nidBackRef.current?.click();
                    else if (field === 'selfie') selfieRef.current?.click();
                    else if (field === 'addressProof') addressProofRef.current?.click();
                  }, 150);
                }}
                className="flex items-center gap-4 w-full p-4 rounded-xl bg-zinc-90 w-full hover:bg-zinc-80 px-4 py-4 rounded border border-zinc-800 hover:border-zinc-700 active:scale-[0.98] transition-all text-left group cursor-pointer animate-fade-in"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-150 font-sans">🖼️ গ্যালারি / ফাইল থেকে সিলেক্ট</h4>
                  <p className="text-[10px] text-zinc-400 font-sans mt-0.5">আপনার গ্যালারি বা ফাইল থেকে ছবি/ডকুমেন্ট নির্বাচন করুন</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILE PREVIEW LIGHTBOX */}
      {previewFileUrl && (
        <div 
          className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xs animate-fade-in"
          onClick={() => setPreviewFileUrl(null)}
        >
          <div 
            className="relative max-w-lg w-full bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-zinc-900 mb-4">
              <span className="text-xs font-bold text-zinc-100 font-sans">{previewFileTitle}</span>
              <button 
                onClick={() => setPreviewFileUrl(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex justify-center items-center bg-zinc-90 w-full h-full rounded-xl overflow-hidden min-h-[250px] max-h-[70vh]">
              {previewFileUrl.startsWith('data:application/pdf') || previewFileUrl.endsWith('.pdf') || (!previewFileUrl.startsWith('blob:') && !previewFileUrl.includes('unsplash.com') && !previewFileUrl.includes('http') && !previewFileUrl.startsWith('data:image')) ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-450">
                  <FileText className="w-16 h-16 text-[#c5a059] mb-4" />
                  <p className="text-xs font-bold font-sans">পিডিএফ ডকুমেন্ট প্রিভিউ</p>
                  <p className="text-[10px] font-sans text-zinc-500 mt-2">পিডিএফ দেখার জন্য ডাউনলোড করুন বা সরাসরি ফাইল ব্যবহার করুন।</p>
                </div>
              ) : (
                <img 
                  src={previewFileUrl} 
                  alt={previewFileTitle}
                  className="max-h-[50vh] object-contain rounded-lg"
                />
              )}
            </div>
            
            <div className="text-center mt-4">
              <a 
                href={previewFileUrl} 
                download={previewFileTitle + ".png"}
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 bg-zinc-90 w-24 px-4 py-2 hover:bg-zinc-80 hover:text-white text-[11px] font-bold rounded-lg border border-zinc-800 font-sans transition-colors cursor-pointer animate-fade-in"
              >
                অনলাইনে দেখুন
              </a>
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL COMPREHENSIVE VALIDATION ERROR DIALOG */}
      {validationError && (
        <div 
          className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in"
          onClick={() => setValidationError(null)}
        >
          <div 
            className="bg-[#121214] border border-red-500/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button icon */}
            <button 
              onClick={() => setValidationError(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-900/50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Warn Circle Icon Accent */}
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mb-4 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-sm font-bold text-zinc-100 font-sans mb-2">
              {validationError.title}
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans mb-6 px-1">
              {validationError.message}
            </p>

            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-500/25 to-red-600/15 hover:from-red-500/35 hover:to-red-600/25 border border-red-500/30 hover:border-red-400/50 hover:text-white active:scale-[0.98] text-xs font-bold text-red-200 transition-all cursor-pointer font-sans"
            >
              ঠিক আছে
            </button>
          </div>
        </div>
      )}

      {/* BEAUTIFUL MINIMUM SAVINGS WARNING DIALOG */}
      {showMinSavingsAlert && (
        <div 
          className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowMinSavingsAlert(false)}
        >
          <div 
            className="bg-[#121214] border border-[#c5a059]/25 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button icon */}
            <button 
              onClick={() => setShowMinSavingsAlert(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-900/50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Warn triangle Icon Accent */}
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-[#c5a059] mb-4 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-sm font-bold text-zinc-100 font-sans mb-1.5">
              ন্যূনতম সঞ্চয় ব্যালেন্স প্রয়োজন!
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans mb-5 px-1">
              দুঃখিত! ঋণ আবেদনের জন্য আপনার একাউন্টে ন্যূনতম সঞ্চয় ব্যালেন্স থাকতে হবে। অনুগ্রহ করে কমপক্ষে <span className="text-[#dfc187] font-bold">৳ {toBanglaDigits((settings?.minSavingsForLoanAmount ?? 500).toLocaleString('bn-BD'))}</span> সঞ্চয় ব্যালেন্স থাকা নিশ্চিত করুন।
            </p>

            {/* Live Progress comparison meter */}
            <div className="bg-[#18181b] rounded-xl p-3 mb-5 border border-zinc-850/65 text-left font-sans">
              <div className="flex justify-between items-center text-[10px] text-zinc-450 mb-1.5">
                <span>আপনার সঞ্চয় ব্যালেন্স</span>
                <span>প্রয়োজনীয় সঞ্চয়</span>
              </div>
              <div className="flex justify-between items-end mb-2.5">
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {formatBDT(userSavings)}
                </span>
                <span className="text-xs font-bold text-[#dfc187] font-mono">
                  {formatBDT(minSavingsRequired)}
                </span>
              </div>
              
              {/* Custom micro progress bar */}
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850/80">
                <div 
                  className="bg-gradient-to-r from-[#c5a059] to-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, Math.round((userSavings / minSavingsRequired) * 100))}%` 
                  }}
                />
              </div>
            </div>

            <button
               type="button"
               onClick={() => {
                 setShowMinSavingsAlert(false);
                 onGoToSavings?.();
               }}
               className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#c5a059] to-[#dfc187] hover:brightness-110 text-zinc-950 active:scale-[0.98] text-xs font-bold transition-all cursor-pointer font-sans"
             >
               ঠিক আছে
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
