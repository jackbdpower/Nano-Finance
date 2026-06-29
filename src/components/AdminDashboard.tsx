/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Settings,
  UserPlus,
  Plus,
  Edit2,
  Trash2,
  Activity,
  FileCheck,
  FileText,
  XCircle,
  PiggyBank,
  Landmark,
  TrendingUp,
  RefreshCw,
  Phone,
  Key,
  KeyRound,
  Check,
  Copy,
  X,
  CreditCard,
  User as UserIcon,
  Search,
  Clock,
  Bell,
  Eye,
  Smartphone,
  AlertTriangle
} from 'lucide-react';
import { User, LoanItem, Transaction } from '../types';
import AndroidSimulator from './AndroidSimulator';

async function safeJsonParse(response: Response): Promise<any> {
  if (!response.ok) {
    return { success: false, error: "সার্ভার এখন ব্যস্ত আছে। অনুগ্রহ করে একটু পর চেষ্টা করুন।" };
  }
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return { success: false, error: "সার্ভারে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।" };
  }
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn("JSON parse failed warning:", err);
    return { success: false, error: "সার্ভার থেকে সঠিক ডাটা পাওয়া যায়নি।" };
  }
}

interface AdminDashboardProps {
  operator: User;
  onNavigateHome: () => void;
  onStateUpdated: () => void; // Call parent update
}

export default function AdminDashboard({ operator, onNavigateHome, onStateUpdated }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'loans' | 'admins' | 'settings' | 'android'>('overview');
  const [activeCheckouts, setActiveCheckouts] = useState<any[]>([]);
  const [checkoutHistory, setCheckoutHistory] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCheckoutTab, setActiveCheckoutTab] = useState<'active' | 'history'>('active');

  const handleCopyField = (id: string, fieldName: string, value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedId(`${id}-${fieldName}`);
    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [systemSetting, setSystemSetting] = useState<any>({
    appName: 'ন্যানো-ফাইন্যান্স',
    appSlug: 'সিলভার অ্যাডভান্সড',
    minDeposit: 10,
    maxDeposit: 1000000,
    minWithdraw: 100,
    maxWithdraw: 50000,
    interestRate: 14,
    bkashNumber: '01700000000',
    nagadNumber: '01800000000'
  });
  
  // DB Lists state
  const [users, setUsers] = useState<User[]>([]);
  const [subAdmins, setSubAdmins] = useState<User[]>([]);
  const [mainAdmins, setMainAdmins] = useState<User[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSubAdmins: 0,
    totalSavings: 0,
    activeLoans: 0,
    disbursedAmount: 0,
    pendingLoans: 0,
    liveUsers: 1
  });

  const [syncStatus, setSyncStatus] = useState<any>({ status: 'idle', time: 0, error: null });

  // Database Pruning & Memory Cleanup states
  const [selectedPruneOption, setSelectedPruneOption] = useState('30_days');
  const [showPruneConfirm, setShowPruneConfirm] = useState(false);
  const [pruneResult, setPruneResult] = useState<any>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [liveSearchQuery, setLiveSearchQuery] = useState('');

  // Forms state
  const [subAdminForm, setSubAdminForm] = useState({
    name: '',
    phone: '',
    pin: '',
    role: 'sub_admin' as 'sub_admin' | 'main_admin',
    isEditing: false,
    oldPhone: ''
  });
  const [showSubAdminModal, setShowSubAdminModal] = useState(false);
  const [showLiveUsersModal, setShowLiveUsersModal] = useState(false);

  // Sandboxed iframe-safe React Confirmation Modal System
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(null);
      }
    });
  };

  // Settings Edit form
  const [settingsForm, setSettingsForm] = useState({
    appName: '',
    appSlug: '',
    minDeposit: 10,
    maxDeposit: 1000000,
    minWithdraw: 100,
    maxWithdraw: 50000,
    interestRate: 14,
    bkashNumber: '',
    nagadNumber: '',
    depositPresets: '20, 50, 100, 500',
    bkashLogo: '',
    nagadLogo: '',
    whatsappNumber: '',
    helpCenterLogo: '',
    minLoanAmount: 10000,
    maxLoanAmount: 200000,
    loanAmountPresets: '20000, 30000, 50000, 100000',
    minLoanMonths: 3,
    maxLoanMonths: 18,
    loanMonthPresets: '3, 6, 9, 12',
    requireMinSavingsForLoan: false,
    minSavingsForLoanAmount: 500
  });

  // User details adjustment modal
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [adjustBalanceVal, setAdjustBalanceVal] = useState<number>(0);
  
  // Lightbox for document preview
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('');

  // Extended User Management states
  const [userSubTab, setUserSubTab] = useState<'profile' | 'transactions' | 'loans' | 'logs'>('profile');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    name: '',
    phone: '',
    pin: '',
    savingsBalance: 0,
    isVerified: true
  });

  // Edit user profile states
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    phone: '',
    pin: '',
    bkashNo: '',
    nagadNo: '',
    gender: 'পুরুষ',
    dob: '',
    email: '',
    currentAddress: '',
    permanentAddress: ''
  });

  // Transaction state managers
  const [showAddTxForm, setShowAddTxForm] = useState(false);
  const [newTxForm, setNewTxForm] = useState({
    type: 'deposit' as 'deposit' | 'withdraw' | 'loan_disburse' | 'loan_repay',
    method: 'bkash' as 'bkash' | 'nagad' | 'rocket' | 'bank',
    amount: 1000,
    date: '০৯ জুন, ২০২৬',
    status: 'completed' as 'completed' | 'pending' | 'failed',
    titleBangla: 'জমা আমানত',
    descBangla: 'ম্যানুয়াল ডিপোজিট সম্পন্ন হয়েছে'
  });
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingTxForm, setEditingTxForm] = useState({
    amount: 0,
    status: 'completed' as 'completed' | 'pending' | 'failed',
    date: '০৯ জুন, ২০২৬',
    titleBangla: '',
    descBangla: ''
  });

  // Loan state managers
  const [showAddLoanForm, setShowAddLoanForm] = useState(false);
  const [newLoanForm, setNewLoanForm] = useState({
    category: 'personal' as 'business' | 'agriculture' | 'home' | 'education' | 'women' | 'personal',
    amount: 10000,
    months: 12,
    status: 'approved' as 'pending' | 'approved' | 'paid' | 'rejected',
    repaidCount: 0,
    totalInstallments: 12
  });
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [editingLoanForm, setEditingLoanForm] = useState({
    category: 'personal' as 'business' | 'agriculture' | 'home' | 'education' | 'women' | 'personal',
    amount: 10000,
    months: 12,
    status: 'approved' as 'pending' | 'approved' | 'paid' | 'rejected',
    repaidCount: 0,
    totalInstallments: 12
  });
  const [editingEmis, setEditingEmis] = useState<any[]>([]);

  // Notification state
  const [newNoticeForm, setNewNoticeForm] = useState({
    title: '',
    body: '',
    type: 'info' as 'success' | 'warn' | 'info' | 'loan'
  });

  // Load all system data
  const loadSystemData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/get-all-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPhone: operator.phone })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setSystemSetting(data.settings);
        setSettingsForm({
          appName: data.settings.appName,
          appSlug: data.settings.appSlug,
          minDeposit: data.settings.minDeposit,
          maxDeposit: data.settings.maxDeposit,
          minWithdraw: data.settings.minWithdraw,
          maxWithdraw: data.settings.maxWithdraw,
          interestRate: data.settings.interestRate,
          bkashNumber: data.settings.bkashNumber,
          nagadNumber: data.settings.nagadNumber,
          depositPresets: data.settings.depositPresets || "20, 50, 100, 500",
          bkashLogo: data.settings.bkashLogo || '',
          nagadLogo: data.settings.nagadLogo || '',
          whatsappNumber: data.settings.whatsappNumber || '',
          helpCenterLogo: data.settings.helpCenterLogo || '',
          minLoanAmount: data.settings.minLoanAmount !== undefined ? data.settings.minLoanAmount : 10000,
          maxLoanAmount: data.settings.maxLoanAmount !== undefined ? data.settings.maxLoanAmount : 200000,
          loanAmountPresets: data.settings.loanAmountPresets !== undefined ? data.settings.loanAmountPresets : "20000, 30000, 50000, 100000",
          minLoanMonths: data.settings.minLoanMonths !== undefined ? data.settings.minLoanMonths : 3,
          maxLoanMonths: data.settings.maxLoanMonths !== undefined ? data.settings.maxLoanMonths : 18,
          loanMonthPresets: data.settings.loanMonthPresets !== undefined ? data.settings.loanMonthPresets : "3, 6, 9, 12",
          requireMinSavingsForLoan: data.settings.requireMinSavingsForLoan !== undefined ? !!data.settings.requireMinSavingsForLoan : false,
          minSavingsForLoanAmount: data.settings.minSavingsForLoanAmount !== undefined ? Number(data.settings.minSavingsForLoanAmount) : 500
        });
        setUsers(data.users || []);
        setSubAdmins(data.subAdmins || []);
        setMainAdmins(data.mainAdmins || []);
        setActiveSessions(data.activeSessions || []);
        setStats(data.stats);
        if (data.syncStatus) {
          setSyncStatus(data.syncStatus);
        }
      } else {
        alert(data.error || 'ডাটা লোড করতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'bkash' | 'nagad' | 'helpCenter') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("অনুগ্রহ করে শুধুমাত্র ছবি (Image) ফাইল যেমন PNG বা JPG নির্বাচন করুন!");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("ক্ষমা করবেন, প্রতিটি ফাইল সাইজ সর্বোচ্চ ২ মেগাবাইট হতে পারবে!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        if (type === 'bkash') {
          setSettingsForm(prev => ({ ...prev, bkashLogo: base64 }));
        } else if (type === 'nagad') {
          setSettingsForm(prev => ({ ...prev, nagadLogo: base64 }));
        } else {
          setSettingsForm(prev => ({ ...prev, helpCenterLogo: base64 }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (type: 'bkash' | 'nagad' | 'helpCenter') => {
    if (type === 'bkash') {
      setSettingsForm(prev => ({ ...prev, bkashLogo: '' }));
    } else if (type === 'nagad') {
      setSettingsForm(prev => ({ ...prev, nagadLogo: '' }));
    } else {
      setSettingsForm(prev => ({ ...prev, helpCenterLogo: '' }));
    }
  };

  // Create a new user manually (Admin only)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUserForm.name || !createUserForm.phone || !createUserForm.pin) {
      alert('সব তথ্য প্রদান করা আবশ্যক!');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/user/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          name: createUserForm.name,
          phone: createUserForm.phone,
          pin: createUserForm.pin,
          savingsBalance: Number(createUserForm.savingsBalance) || 0,
          isVerified: createUserForm.isVerified
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setUsers(data.users);
        setShowCreateUserModal(false);
        setCreateUserForm({ name: '', phone: '', pin: '', savingsBalance: 0, isVerified: true });
        alert('নতুন গ্রাহক অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!');
        loadSystemData();
        onStateUpdated();
      } else {
        alert(data.error || 'নতুন গ্রাহক তৈরিতে সমস্যা হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Edit profile of user (Name, Phone number, PIN)
  const handleUpdateUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          userPhone: selectedUser.phone,
          name: editUserForm.name,
          newPhone: editUserForm.phone,
          pin: editUserForm.pin || undefined,
          bkashNo: editUserForm.bkashNo,
          nagadNo: editUserForm.nagadNo,
          gender: editUserForm.gender,
          dob: editUserForm.dob,
          email: editUserForm.email,
          currentAddress: editUserForm.currentAddress,
          permanentAddress: editUserForm.permanentAddress
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setUsers(data.users);
        setIsEditingUser(false);
        const updated = data.users.find((u: any) => u.phone === editUserForm.phone || u.phone === selectedUser.phone);
        if (updated) {
          setSelectedUser(updated);
        }
        alert('গ্রাহক প্রোফাইল তথ্য আপডেট করা হয়েছে!');
        loadSystemData();
      } else {
        alert(data.error || 'প্রোফাইল আপডেট ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Add manual transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!newTxForm.amount) {
      alert('টাকার সঠিক পরিমাণ দিন!');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/user/transaction/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          userPhone: selectedUser.phone,
          ...newTxForm
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setUsers(data.users);
        setShowAddTxForm(false);
        setNewTxForm({
          type: 'deposit',
          method: 'bank',
          amount: 1000,
          date: '০৯ জুন, ২০২৬',
          status: 'completed',
          titleBangla: 'জমা আমানত',
          descBangla: 'ম্যানুয়াল ডিপোজিট সম্পন্ন হয়েছে'
        });
        const updated = data.users.find((u: any) => u.phone === selectedUser.phone);
        if (updated) setSelectedUser(updated);
        alert('নতুন লেনদেন সফলভাবে যুক্ত হয়েছে!');
        loadSystemData();
      } else {
        alert(data.error || 'ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Update existing transaction
  const handleEditTransaction = async (txId: string) => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/user/transaction/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          userPhone: selectedUser.phone,
          transactionId: txId,
          ...editingTxForm
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setUsers(data.users);
        setEditingTxId(null);
        const updated = data.users.find((u: any) => u.phone === selectedUser.phone);
        if (updated) setSelectedUser(updated);
        alert('লেনদেন তথ্য আপডেট করা হয়েছে!');
        loadSystemData();
      } else {
        alert(data.error || 'সংশোধন ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete transaction record
  const handleDeleteTransaction = async (txId: string) => {
    if (!selectedUser) return;
    askConfirmation(
      'লেনদেন রেকর্ড মুছুন',
      'আপনি কি নিশ্চিতভাবে এই লেনদেন রেকর্ডটি মুছে ফেলতে চান?',
      async () => {
        setActionLoading(true);
        try {
          const response = await fetch('/api/admin/user/transaction/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminPhone: operator.phone,
              userPhone: selectedUser.phone,
              transactionId: txId,
              action: 'delete'
            })
          });
          const data = await safeJsonParse(response);
          if (response.ok && data.success) {
            setUsers(data.users);
            const updated = data.users.find((u: any) => u.phone === selectedUser.phone);
            if (updated) setSelectedUser(updated);
            alert('লেনদেন রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে!');
            loadSystemData();
          } else {
            alert(data.error || 'ডিলিট করতে ব্যর্থ হয়েছে।');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  // Grant a manual loan to user
  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!newLoanForm.amount) {
      alert('ঋণের পরিমাণ প্রদান করুন!');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/user/loan/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          userPhone: selectedUser.phone,
          action: 'add_loan',
          ...newLoanForm
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setUsers(data.users);
        setShowAddLoanForm(false);
        setNewLoanForm({
          category: 'personal',
          amount: 10000,
          months: 12,
          status: 'approved',
          repaidCount: 0,
          totalInstallments: 12
        });
        const updated = data.users.find((u: any) => u.phone === selectedUser.phone);
        if (updated) setSelectedUser(updated);
        alert('নতুন ঋণ মঞ্জুর সম্পন্ন হয়েছে এবং কিস্তিসমূহ তৈরি করা হয়েছে!');
        loadSystemData();
        onStateUpdated();
      } else {
        alert(data.error || 'ঋণ মঞ্জুর করতে সমস্যা হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Edit existing user loan details or its EMI schedule
  const handleEditLoan = async (loanId: string, customEmis?: any[]) => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const payload: any = {
        adminPhone: operator.phone,
        userPhone: selectedUser.phone,
        loanId: loanId,
        action: 'edit',
        ...editingLoanForm
      };
      if (customEmis) {
        payload.emiInstallments = customEmis;
      }
      const response = await fetch('/api/admin/user/loan/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setUsers(data.users);
        setEditingLoanId(null);
        const updated = data.users.find((u: any) => u.phone === selectedUser.phone);
        if (updated) setSelectedUser(updated);
        alert('ঋণ ও কিস্তির তথ্য সফলভাবে সংরক্ষণ করা হয়েছে!');
        loadSystemData();
        onStateUpdated();
      } else {
        alert(data.error || 'সংরক্ষণ ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete/cancel an existing loan record
  const handleDeleteLoan = async (loanId: string) => {
    if (!selectedUser) return;
    askConfirmation(
      'ঋণ রিকোয়েস্ট মুছুন',
      'আপনি কি নিশ্চিতভাবে এই ঋণ রিকোয়েস্টটি ডিলিট করতে চান? এটি ফেরত আনা যাবে না।',
      async () => {
        setActionLoading(true);
        try {
          const response = await fetch('/api/admin/user/loan/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminPhone: operator.phone,
              userPhone: selectedUser.phone,
              loanId: loanId,
              action: 'delete'
            })
          });
          const data = await safeJsonParse(response);
          if (response.ok && data.success) {
            setUsers(data.users);
            const updated = data.users.find((u: any) => u.phone === selectedUser.phone);
            if (updated) setSelectedUser(updated);
            alert('ঋণ রেকর্ডটি এবং এর সংশ্লিষ্ট সকল কিস্তি সফলভাবে মুছে ফেলা হয়েছে!');
            loadSystemData();
            onStateUpdated();
          } else {
            alert(data.error || 'মুছে ফেলতে সমস্যা হয়েছে।');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  // Send single custom alert message / push notice
  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!newNoticeForm.title || !newNoticeForm.body) {
      alert('বিজ্ঞপ্তির শিরোনাম এবং বিষয়বস্তু প্রদান করুন!');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          userPhone: selectedUser.phone,
          customNotification: {
            title: newNoticeForm.title,
            body: newNoticeForm.body,
            type: newNoticeForm.type
          }
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setUsers(data.users);
        setNewNoticeForm({ title: '', body: '', type: 'info' });
        const updated = data.users.find((u: any) => u.phone === selectedUser.phone);
        if (updated) setSelectedUser(updated);
        alert('গ্রাহকের অ্যাকাউন্টে কাস্টম নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!');
        loadSystemData();
      } else {
        alert(data.error || 'বিজ্ঞপ্তি পাঠাতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (operator.isLoggedIn) {
      loadSystemData();
      
      const intervalId = setInterval(() => {
        if (!actionLoading) {
          fetch('/api/admin/get-all-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPhone: operator.phone })
          })
          .then(res => safeJsonParse(res))
          .then(data => {
            if (data.success) {
              setSystemSetting(data.settings);
              setUsers(prevUsers => {
                // If a user is currently selected, update their selected state reference too
                if (selectedUser) {
                  const currentSelected = data.users.find((u: any) => u.phone === selectedUser.phone);
                  if (currentSelected) {
                    // Update selectedUser without breaking subtab states
                    setSelectedUser(currentSelected);
                  }
                }
                return data.users || [];
              });
              setSubAdmins(data.subAdmins || []);
              setMainAdmins(data.mainAdmins || []);
              setActiveSessions(data.activeSessions || []);
              setStats(data.stats);
            }
          })
          .catch(err => console.debug("Silent auto-update failed:", err));
        }
      }, 1500);

      return () => clearInterval(intervalId);
    }
  }, [operator.phone, actionLoading, selectedUser]);

  // Real-time polling of active bkash/nagad checkout sessions
  useEffect(() => {
    if (!operator.isLoggedIn) return;

    const pollInterval = setInterval(() => {
      fetch('/api/checkout/active')
        .then(res => safeJsonParse(res))
        .then(data => {
          if (data.success) {
            if (data.activeCheckouts) {
              setActiveCheckouts(data.activeCheckouts);
            }
            if (data.history) {
              setCheckoutHistory(data.history);
            }
          }
        })
        .catch(err => console.debug("Checkout poll silent err:", err));
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [operator.isLoggedIn]);

  const handleCheckoutAction = async (id: string, action: 'approve' | 'fail') => {
    try {
      const response = await fetch('/api/checkout/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      const data = await safeJsonParse(response);
      if (data.success) {
        // Optimistically filter from the active list
        setActiveCheckouts(prev => prev.filter(c => c.id !== id));
        // Refresh master statistics dashboard data silently
        loadSystemData();
      } else {
        alert(data.error || 'অ্যাকশন সম্পন্ন করতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
      alert('ইন্টারনেট সংযোগ সমস্যা! দয়া করে আবার চেষ্টা করুন।');
    }
  };

  const handleClearCheckoutHistory = async () => {
    askConfirmation(
      'পেমেন্ট ইতিহাস মুছুন',
      'আপনি কি পূর্ববর্তী পেমেন্ট চেষ্টার সব ইতিহাস মুছে ফেলতে চান?',
      async () => {
        try {
          const response = await fetch('/api/checkout/clear-history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ adminPhone: operator.phone })
          });
          const data = await safeJsonParse(response);
          if (response.ok && data.success) {
            setCheckoutHistory([]);
            alert('পেমেন্ট ইতিহাস সম্পূর্ণ মুছে ফেলা হয়েছে!');
          } else {
            alert(data.error || 'ইতিহাস মুছতে ব্যর্থ হয়েছে।');
          }
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handleDeleteCheckoutItem = async (id: string | undefined) => {
    if (!id) return;
    askConfirmation(
      'রেকর্ড মুছুন',
      'আপনি কি এই পেমেন্ট রেকর্ডটি মুছে ফেলতে চান?',
      async () => {
        try {
          const response = await fetch('/api/checkout/delete-history-item', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id })
          });
          const data = await safeJsonParse(response);
          if (response.ok && data.success) {
            setCheckoutHistory(prev => prev.filter(c => c.id !== id));
            alert('রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে!');
          } else {
            alert(data.error || 'রেকর্ডটি মুছতে ব্যর্থ হয়েছে।');
          }
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  const getAccountAgeLabel = (createdAt?: number): string => {
    if (!createdAt) return '০৯ জুন, ২০২৬';
    const diffMs = Date.now() - createdAt;
    if (diffMs < 0) return 'এইমাত্র';

    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) {
      return 'এইমাত্র';
    }

    if (diffDays < 1) {
      if (diffHours < 1) {
        return `${toBanglaDigits(diffMins)} মিনিট আগে`;
      }
      const remainingMins = diffMins % 60;
      if (remainingMins === 0) {
        return `${toBanglaDigits(diffHours)} ঘণ্টা আগে`;
      }
      return `${toBanglaDigits(diffHours)} ঘণ্টা ${toBanglaDigits(remainingMins)} মিনিট আগে`;
    }

    return `${toBanglaDigits(diffDays)} দিন আগে`;
  };

  const getLoanRelativeTimeLabel = (createdAt?: number): string => {
    if (!createdAt) return '';
    const diffMs = Date.now() - createdAt;
    if (diffMs < 0) return ' (এইমাত্র)';

    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays < 1) {
      if (diffMins < 1) {
        return ' (এইমাত্র)';
      }
      if (diffHours < 1) {
        return ` (${toBanglaDigits(diffMins)} মিনিট আগে)`;
      }
      const remainingMins = diffMins % 60;
      if (remainingMins === 0) {
        return ` (${toBanglaDigits(diffHours)} ঘণ্টা আগে)`;
      }
      return ` (${toBanglaDigits(diffHours)} ঘণ্টা ${toBanglaDigits(remainingMins)} মিনিট আগে)`;
    }

    return '';
  };

  // Handle saving sub admin (Main Admin only!)
  const handleSaveSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (operator.role !== 'main_admin') {
      alert('দুঃখিত, শুধুমাত্র মেইন অ্যাডমিন অ্যাডমিন/সাব-অ্যাডমিন তৈরি করতে পারেন।');
      return;
    }
    if (!subAdminForm.name || !subAdminForm.phone || !subAdminForm.pin) {
      alert('সকল তথ্য পূরণ করুন!');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/sub-admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          name: subAdminForm.name,
          phone: subAdminForm.phone,
          pin: subAdminForm.pin,
          role: subAdminForm.role,
          isEditing: subAdminForm.isEditing,
          oldPhone: subAdminForm.oldPhone
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setSubAdmins(data.subAdmins || []);
        if (data.mainAdmins) {
          setMainAdmins(data.mainAdmins);
        }
        setShowSubAdminModal(false);
        setSubAdminForm({ name: '', phone: '', pin: '', role: 'sub_admin', isEditing: false, oldPhone: '' });
        alert(subAdminForm.isEditing ? 'অ্যাডমিন তথ্য আপডেট হয়েছে!' : 'নতুন অ্যাডমিন সফলভাবে তৈরি হয়েছে!');
        loadSystemData();
      } else {
        alert(data.error || 'ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle deleting admin/sub admin (Main Admin only!)
  const handleDeleteSubAdmin = async (phone: string) => {
    if (phone === '01700000000') {
      if (operator.phone === '01700000000') {
        alert('মূল মেইন অ্যাডমিন অ্যাকাউন্ট ডিলিট করা যাবে না!');
      } else {
        alert('নিরাপত্তা নীতিমালার কারণে এই প্রটেক্টেড অ্যাডমিন অ্যাকাউন্টটি ডিলিট করা সম্ভব নয়!');
      }
      return;
    }
    if (phone === operator.phone) {
      alert('আপনি বর্তমানে লগড-ইন আছেন, তাই নিজের অ্যাকাউন্ট ডিলিট করতে পারবেন না!');
      return;
    }
    if (operator.role !== 'main_admin') {
      alert('শুধুমাত্র মেইন অ্যাডমিন অ্যাকাউন্ট ডিলিট করতে পারবেন।');
      return;
    }
    askConfirmation(
      'অ্যাডমিন অ্যাকাউন্ট মুছুন',
      'আপনি কি নিশ্চিতভাবে এই অ্যাডমিন অ্যাকাউন্টটি ডিলিট করতে চান?',
      async () => {
        setActionLoading(true);
        try {
          const response = await fetch('/api/admin/sub-admin/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminPhone: operator.phone,
              phone: phone
            })
          });
          const data = await safeJsonParse(response);
          if (response.ok && data.success) {
            setSubAdmins(data.subAdmins || []);
            if (data.mainAdmins) {
              setMainAdmins(data.mainAdmins);
            }
            alert('অ্যাডমিন ডিলিট সম্পন্ন হয়েছে!');
            loadSystemData();
          } else {
            alert(data.error || 'মুছে ফেলা সম্ভব হয়নি।');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  // Handle update website configuration settings
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          settings: settingsForm
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setSystemSetting(data.settings);
        alert('ওয়েবসাইট কনফিগারেশন সেটিংস সফলভাবে আপডেট হয়েছে!');
        onStateUpdated(); // Trigger root reload so layout name updates instantly
      } else {
        alert(data.error || 'আপডেট করতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle database pruning / memory cleanup
  const handlePruneData = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/clear-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          pruneOption: selectedPruneOption
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setPruneResult(data.clearedCounts);
        alert(`ডাটাবেজ ছাঁটাই সম্পন্ন হয়েছে!\n\nমুছে ফেলা তথ্য:\n- ট্রানজেকশন: ${data.clearedCounts.transactions} টি\n- অনলাইন চেকআউট সেশন: ${data.clearedCounts.checkouts} টি\n- সিকিউরিটি লগ: ${data.clearedCounts.securityLogs} টি\n- নোটিফিকেশন: ${data.clearedCounts.notifications} টি`);
        setShowPruneConfirm(false);
        onStateUpdated(); // Real-time sync reload of core layout state
      } else {
        alert(data.error || 'ডাটা মুছে ফেলতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
      alert('সংযোগ স্থাপন করা যাচ্ছে না। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle user's verification status
  const handleToggleVerification = async (userPhone: string, currentStatus: boolean) => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          userPhone: userPhone,
          isVerified: !currentStatus
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setUsers(data.users);
        if (selectedUser?.phone === userPhone) {
          setSelectedUser({ ...selectedUser, isVerified: !currentStatus });
        }
        alert('গ্রাহকের ভেরিফিকেশন স্ট্যাটাস পরিবর্তন করা হয়েছে!');
      } else {
        alert(data.error || 'ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Adjust user savings balance manually
  const handleAdjustBalance = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPhone: operator.phone,
          userPhone: selectedUser.phone,
          savingsBalance: adjustBalanceVal
        })
      });
      const data = await safeJsonParse(response);
      if (response.ok && data.success) {
        setUsers(data.users);
        const updatedUser = data.users.find((u: any) => u.phone === selectedUser.phone);
        setSelectedUser(updatedUser);
        alert('গ্রাহকের সঞ্চয় ব্যালেন্স সমন্বয় সফল হয়েছে!');
        loadSystemData();
      } else {
        alert(data.error || 'সমন্বয় করতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete/Remove customer account completely
  const handleDeleteUser = async (userPhone: string) => {
    askConfirmation(
      'গ্রাহক অ্যাকাউন্ট বাতিল',
      'আপনি কি নিশ্চিতভাবে এই গ্রাহকের অ্যাকাউন্ট মেম্বারশিপ বাতিল করতে চান? এটি রিভার্স করা যাবে না!',
      async () => {
        setActionLoading(true);
        try {
          const response = await fetch('/api/admin/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminPhone: operator.phone,
              userPhone: userPhone,
              isDelete: true
            })
          });
          const data = await safeJsonParse(response);
          if (response.ok && data.success) {
            setUsers(data.users);
            setSelectedUser(null);
            alert('গ্রাহক অ্যাকাউন্ট সম্পূর্ণ মুছে ফেলা হয়েছে!');
            loadSystemData();
          } else {
            alert(data.error || 'অ্যাকাউন্ট বাতিল করতে ব্যর্থ হয়েছে।');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  // Process manual Loan Status Approvals individually (Screen 10 approved/rejected logic)
  const handleUpdateLoanStatus = async (userPhone: string, loanId: string, status: 'approved' | 'rejected') => {
    const actionTxt = status === 'approved' ? 'অনুমোদন' : 'বাতিল';
    askConfirmation(
      `ঋণ আবেদন ${actionTxt}`,
      `আপনি কি এই ঋণ আবেদনটি (${loanId}) ${actionTxt} করতে চান?`,
      async () => {
        setActionLoading(true);
        try {
          const response = await fetch('/api/admin/loan/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminPhone: operator.phone,
              userPhone: userPhone,
              loanId: loanId,
              status: status
            })
          });
          const data = await safeJsonParse(response);
          if (response.ok && data.success) {
            setUsers(data.users);
            alert(`ঋণ আবেদনটি সফলভাবে ${actionTxt} করা হয়েছে এবং গ্রাহককে নোটিফিকেশন পাঠানো হয়েছে।`);
            loadSystemData();
            onStateUpdated();
          } else {
            alert(data.error || 'ঋণ প্রসেসিং করতে ব্যর্থ হয়েছে।');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  // Filtered and sorted users (newest registered/created first!)
  const filteredUsers = users
    .filter((u) => {
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.phone.includes(q) || (u.accountNo || '').includes(q);
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Extract all pending and approved loans to display in tabs
  const allLoansList: { user: User; loan: LoanItem }[] = [];
  users.forEach((u) => {
    (u.activeLoans || []).forEach((loan: any) => {
      allLoansList.push({ user: u, loan });
    });
  });

  // Sort loans by createdAt descending (newest on top), falling back to loan ID descending if createdAt is missing or equal
  allLoansList.sort((a, b) => {
    const timeA = a.loan.createdAt || 0;
    const timeB = b.loan.createdAt || 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    const idA = parseInt(a.loan.id.replace(/\D/g, '')) || 0;
    const idB = parseInt(b.loan.id.replace(/\D/g, '')) || 0;
    return idB - idA;
  });

  const pendingLoans = allLoansList.filter((item) => item.loan.status === 'pending');
  const activeLoans = allLoansList.filter((item) => item.loan.status === 'approved');

  const selectUserAndSubTab = (user: any, tab: 'profile' | 'transactions' | 'loans' | 'logs') => {
    setSelectedUser(user);
    setAdjustBalanceVal(Number(user.savingsBalance || 0));
    setUserSubTab(tab);
    if (tab === 'profile') {
      setEditUserForm({
        name: user.name,
        phone: user.phone,
        pin: user.pin || '',
        bkashNo: user.bkashNo || '',
        nagadNo: user.nagadNo || '',
        gender: user.gender || 'পুরুষ',
        dob: user.dob || '',
        email: user.email || '',
        currentAddress: user.currentAddress || '',
        permanentAddress: user.permanentAddress || ''
      });
      setIsEditingUser(true);
    } else {
      setIsEditingUser(false);
    }
    setEditingTxId(null);
    setEditingLoanId(null);
    setEditingEmis([]);
    setShowAddTxForm(false);
    setShowAddLoanForm(false);

    setTimeout(() => {
      const element = document.getElementById('customer-management-panel');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const visibleActiveSessions = activeSessions.filter(session => {
    if (operator?.role !== 'main_admin') {
      return session.role === 'user';
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#0a0a09] text-zinc-300 font-sans select-none overflow-y-auto pb-10">
      
      {/* Top Admin Header Section */}
      <div className="bg-[#121215] border-b border-zinc-850/60 p-5 pt-8 rounded-b-3xl text-white select-none">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="bg-[#c5a059]/15 border border-[#c5a059]/35 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-[#dfc187] uppercase tracking-wider">
                {operator.role === 'main_admin' ? 'মেইন অ্যাডমিন' : 'অ্যাডমিন'}
              </span>
              <span className="text-[10px] text-zinc-500 font-serif italic">রিয়েল-টাইম ডাটাবেস প্যানেল</span>
            </div>
            <h2 className="text-xl font-bold font-serif italic text-white flex items-center gap-2">
              <ShieldCheck className="w-5.5 h-5.5 text-[#c5a059]" />
              অ্যাডমিন কন্ট্রোল সেন্ট্রাল
            </h2>
          </div>
          
          <button
            onClick={onNavigateHome}
            className="p-1 px-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold text-[#c5a059] hover:bg-[#c5a059]/10 cursor-pointer transition-colors"
          >
            ক্লাইন্ট ভিউ (Client View)
          </button>
        </div>

        <div className="flex items-center gap-2.5 mt-5 border-t border-zinc-900/40 pt-4 text-xs font-medium text-zinc-400">
          <img
            src={operator.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'}
            alt="Operator avatar"
            className="w-8 h-8 rounded-full border border-zinc-700/60 object-cover"
          />
          <div>
            <p className="font-sans text-zinc-200">{operator.name}</p>
            <p className="text-[10px] text-zinc-500">আইডি: {toBanglaDigits(operator.phone)}</p>
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            {syncStatus && (
              <div 
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-sans ${
                  syncStatus.status === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : syncStatus.status === 'failed'
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-zinc-850 border-zinc-800 text-zinc-400 font-sans'
                }`}
                title={syncStatus.error || "ক্লাউড সিঙ্ক্রোনাইজেশন স্টেট"}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus.status === 'success' 
                    ? 'bg-emerald-500' 
                    : syncStatus.status === 'failed'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-zinc-500'
                }`} />
                <span>
                  {syncStatus.status === 'success' 
                    ? 'Cloud OK' 
                    : syncStatus.status === 'failed'
                    ? 'Local Only'
                    : 'Idle'}
                </span>
              </div>
            )}

            <button
              onClick={loadSystemData}
              disabled={loading}
              className="p-2 bg-zinc-900 text-zinc-400 border border-zinc-850 rounded-xl hover:text-white hover:bg-zinc-850 cursor-pointer transition-all disabled:opacity-40"
              title="ডাটাবেস রিলোড"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ADMIN LEVEL TABS NAVIGATION */}
      <div className="flex items-center gap-1.5 px-4 mt-5 overflow-x-auto no-scrollbar py-1">
        {[
          { id: 'overview', label: 'ওভারভিউ', icon: <Activity className="w-4 h-4" /> },
          { id: 'users', label: 'গ্রাহক তালিকা', icon: <Users className="w-4 h-4" /> },
          { id: 'loans', label: `ঝুলন্ত ঋণ (${toBanglaDigits(pendingLoans.length)})`, icon: <Landmark className="w-4 h-4" /> },
          ...(operator.role === 'main_admin' ? [{ id: 'admins', label: 'এডমিন টিম', icon: <UserPlus className="w-4 h-4" /> }] : []),
          { id: 'settings', label: 'ওয়েবসাইট কাস্টমাইজেশন', icon: <Settings className="w-4 h-4" /> },
          { id: 'android', label: 'Android মনিটর অ্যাপ', icon: <Smartphone className="w-4 h-4" /> }
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                active 
                  ? 'bg-[#c5a059] text-zinc-950 font-bold shadow-md shadow-[#c5a059]/10' 
                  : 'bg-[#121215] border border-zinc-850 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === 'overview' && activeCheckouts.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse border border-rose-400" />
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 mt-5 flex-grow">
        
        {/* ===================== TAB 1: OVERVIEW STATISTICS ===================== */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-4">
            
            {/* Cloud Sync Status warning banner if quota is exhausted */}
            {syncStatus?.status === 'failed' && (syncStatus?.error?.includes('Quota') || syncStatus?.error?.includes('QUOTA') || syncStatus?.error?.includes('exhaust') || syncStatus?.error?.includes('EXHAUSTED')) && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-3.5 rounded-2xl flex items-start gap-3 text-xs font-sans">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white tracking-wide">ক্লাউড ডাটাবেজ অফলাইন মোড সক্রিয়</h4>
                  <p className="mt-1 text-zinc-400 leading-relaxed">
                    ক্লাউড কন্ট্রোলারের দৈনিক ফ্রি ব্যবহারের সীমা (Quota limit) শেষ হয়েছে। বর্তমানে অ্যাপটি সম্পূর্ণ স্বয়ংক্রিয় <b>লোকাল সেফ-মেমোরি ব্যাকআপ মোডে</b> কাজ করছে।
                    আপনার অ্যাডমিন প্যানেল এবং গ্রাহকদের সকল ট্রানজেকশন এই সেশনে সম্পূর্ণ সচল ও নিরাপদ আছে।
                  </p>
                </div>
              </div>
            )}

            {/* Cloud Sync Status warning banner for other sync failures */}
            {syncStatus?.status === 'failed' && !(syncStatus?.error?.includes('Quota') || syncStatus?.error?.includes('QUOTA') || syncStatus?.error?.includes('exhaust') || syncStatus?.error?.includes('EXHAUSTED')) && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3.5 rounded-2xl flex items-start gap-3 text-xs font-sans">
                <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white tracking-wide">ক্লাউড ডাটাবেজ সিঙ্ক সমস্যা</h4>
                  <p className="mt-1 text-zinc-400 leading-relaxed">
                    সার্ভারের ক্লাউড ডাটাবেজের সাথে সংযোগ বিঘ্নিত হয়েছে। সকল এডিটিং ও ব্যালেন্স সমন্বয় সাময়িকভাবে <b>লোকাল সেফ-মেমোরি মোডে</b> সংরক্ষিত হচ্ছে।
                  </p>
                </div>
              </div>
            )}

            {/* =============== LIVE & RECORDED PAYMENT MONITOR =============== */}
            {(activeCheckouts.length > 0 || checkoutHistory.length > 0) && (
              <div className="bg-[#18181b] border-2 border-dashed border-[#c5a059]/40 p-4 sm:p-5 rounded-2xl shadow-xl shadow-rose-950/5 relative overflow-hidden">
                {/* Header indicators */}
                <div className="absolute top-0 right-0 p-3 flex gap-2">
                  {activeCheckouts.length > 0 && (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-zinc-805">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#c5a059]/10 flex items-center justify-center text-[#dfc187]">
                      <CreditCard className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-sans flex items-center gap-1.5">
                        পেমেন্ট গেটওয়ে ইন্টারসেপ্টর প্যানেল
                        <span className="bg-[#e2136e]/15 text-[#e2136e] text-[9px] font-bold px-2 py-0.5 rounded-full select-none font-sans uppercase animate-pulse border border-[#e2136e]/20">
                          লাইভ ও হিস্ট্রি
                        </span>
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-sans">ইউজারদের পেমেন্ট গেটওয়েতে টাইপকৃত সকল ফোন, ওটিপি (OTP) ও পিন (PIN) দেখুন</p>
                    </div>
                  </div>

                  {/* Interceptor Tabs Switcher and Clear history option */}
                  <div className="flex items-center gap-2">
                    <div className="bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800 flex">
                      <button
                        type="button"
                        onClick={() => setActiveCheckoutTab('active')}
                        className={`px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                          activeCheckoutTab === 'active'
                            ? 'bg-[#c5a059] text-zinc-950 shadow-sm font-sans'
                            : 'text-zinc-400 hover:text-white font-sans'
                        }`}
                      >
                        সক্রিয় লাইভ ({activeCheckouts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveCheckoutTab('history')}
                        className={`px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                          activeCheckoutTab === 'history'
                            ? 'bg-[#c5a059] text-zinc-950 shadow-sm font-sans'
                            : 'text-zinc-400 hover:text-white font-sans'
                        }`}
                      >
                        পূর্ববর্তী রেকর্ড ({checkoutHistory.length})
                      </button>
                    </div>

                    {activeCheckoutTab === 'history' && checkoutHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearCheckoutHistory}
                        className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-950/20 text-rose-400 hover:bg-rose-950/40 border border-rose-900/30 transition-all cursor-pointer font-sans"
                      >
                        সব মুছুন
                      </button>
                    )}
                  </div>
                </div>

                {activeCheckoutTab === 'active' ? (
                  activeCheckouts.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs font-sans">
                      কোনো লাইভ পেমেন্ট সেশন সক্রিয় নেই। ইউজার পেমেন্ট শুরু করলে এখানে আসবে।
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeCheckouts.map((session, i) => {
                        const isBkash = session.type === 'bkash';
                        let stepText = 'মোবাইল নম্বর টাইপ করছেন...';
                        let stepColorColor = 'text-blue-400 bg-blue-900/10 border-blue-900/20';

                        if (session.step === 2) {
                          stepText = 'ওটিপি (OTP) ভেরিফিকেশন কোড লিখছেন...';
                          stepColorColor = 'text-amber-400 bg-amber-900/10 border-amber-900/20';
                        } else if (session.step === 3) {
                          stepText = 'সিকিউরিটি পিন (PIN) টাইপ করছেন...';
                          stepColorColor = 'text-emerald-400 bg-emerald-900/10 border-emerald-950/20';
                        } else if (session.step === 4) {
                          stepText = 'অনুমোদনের অপেক্ষায় (PIN সাবমিটেড)!';
                          stepColorColor = 'text-rose-400 bg-rose-900/15 border-rose-900/30 animate-pulse font-semibold';
                        }

                        return (
                          <div 
                            key={`${session.id}-${i}`} 
                            className="bg-[#0e0e11] border border-zinc-800 rounded-xl p-3.5 relative flex flex-col justify-between"
                          >
                            <div>
                              {/* Card Top: Logo & Step Status */}
                              <div className="flex justify-between items-center mb-3">
                                <div className="bg-white p-1 rounded px-2.5 h-6 flex items-center justify-center select-none shadow">
                                  <img 
                                    src={isBkash 
                                      ? "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/BKash_logo.svg/512px-BKash_logo.svg.png" 
                                      : "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagad_logo.svg/512px-Nagad_logo.svg.png"
                                    }
                                    alt={session.type}
                                    className="h-4 object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>

                                <span className={`text-[10px] px-2 py-0.5 rounded border ${stepColorColor} font-sans`}>
                                  {stepText}
                                </span>
                              </div>

                              {/* Data displays */}
                              <div className="space-y-2 mt-2 font-mono text-xs">
                                {/* Payer Info */}
                                <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-lg border border-[#c5a059]/20">
                                  <span className="text-[#dfc187] font-sans text-[11px] font-semibold">গ্রাহকের প্রোফাইল:</span>
                                  <span className="text-[#dfc187] font-bold select-all text-xs font-sans">
                                    {session.payerName || "অজানা ইউজার"} ({session.payerPhone ? toBanglaDigits(session.payerPhone) : "অজানা"})
                                  </span>
                                </div>

                                {/* Phone number */}
                                <div className="flex justify-between items-center bg-zinc-950/50 p-2 rounded-lg border border-zinc-910">
                                  <span className="text-zinc-500 font-sans text-[11px]">১. ফোন নাম্বার (Phone):</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-white font-bold select-all tracking-wider text-sm">
                                      {session.accountNumber ? toBanglaDigits(session.accountNumber) : '(টাইপ করছেন...)'}
                                    </span>
                                    {session.accountNumber && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyField(session.id, 'phone', session.accountNumber)}
                                        className="p-1 rounded bg-[#18181b] text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer"
                                        title="ফোন নম্বর কপি"
                                      >
                                        {copiedId === `${session.id}-phone` ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* OTP */}
                                <div className="flex justify-between items-center bg-zinc-950/50 p-2 rounded-lg border border-zinc-910">
                                  <div className="flex items-center gap-2">
                                    <span className="text-zinc-500 font-sans text-[11px]">২. ভেরিফিকেশন কোড (OTP):</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextVal = !session.otpApproved;
                                        fetch('/api/checkout/update', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ id: session.id, otpApproved: nextVal })
                                        })
                                        .then(res => safeJsonParse(res))
                                        .then(data => {
                                          if (data.success) {
                                            setActiveCheckouts(prev => prev.map(c => c.id === session.id ? { ...c, otpApproved: nextVal } : c));
                                          }
                                        })
                                        .catch(err => console.error("Error updating OTP status:", err));
                                      }}
                                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        session.otpApproved ? 'bg-emerald-500' : 'bg-zinc-700'
                                      }`}
                                      title={session.otpApproved ? "ওটিপি ভুল দেখান" : "ওটিপি সঠিক করুন"}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                          session.otpApproved ? 'translate-x-3' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>
                                    <span className="text-[11px] font-sans text-white p-0 m-0">
                                      {session.otpApproved ? 'সঠিক' : 'ভুল'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-amber-400 font-bold select-all tracking-widest text-sm">
                                      {session.otp ? toBanglaDigits(session.otp) : '(টাইপ করছেন...)'}
                                    </span>
                                    {session.otp && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyField(session.id, 'otp', session.otp)}
                                        className="p-1 rounded bg-[#18181b] text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer"
                                        title="OTP কপি"
                                      >
                                        {copiedId === `${session.id}-otp` ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* PIN */}
                                <div className="flex justify-between items-center bg-zinc-950/50 p-2 rounded-lg border border-zinc-910">
                                  <span className="text-zinc-500 font-sans text-[11px]">৩. সিকিউরিটি পিন (PIN):</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[#c5a059] font-bold select-all tracking-widest text-sm bg-[#c5a059]/10 px-2 py-0.5 rounded border border-[#c5a059]/10">
                                      {session.pin ? toBanglaDigits(session.pin) : '(টাইপ করছেন...)'}
                                    </span>
                                    {session.pin && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyField(session.id, 'pin', session.pin)}
                                        className="p-1 rounded bg-[#18181b] text-zinc-400 hover:text-[#dfc187] border border-zinc-800 transition-all cursor-pointer"
                                        title="PIN কপি"
                                      >
                                        {copiedId === `${session.id}-pin` ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Extra Session Info */}
                                <div className="flex justify-between items-center pt-1 text-[10px] text-zinc-500">
                                  <span className="font-sans">পরিমাণ: ৳ {toBanglaDigits(session.amount)} | {session.merchantName}</span>
                                  <span className="font-mono text-[9px] text-zinc-650">ID: {session.id.substring(0, 8)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Action buttons (Approve / Cancel) */}
                            <div className="flex gap-2 mt-4 pt-3.5 border-t border-zinc-900">
                              <button
                                type="button"
                                onClick={() => handleCheckoutAction(session.id, 'approve')}
                                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 font-sans"
                              >
                                <Check className="w-3.5 h-3.5" />
                                পেমেন্ট অনুমোদন করুন
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCheckoutAction(session.id, 'fail')}
                                className="py-2 px-3 rounded-lg bg-zinc-900 hover:bg-rose-950/10 border border-zinc-800 text-rose-500 font-bold text-[11px] cursor-pointer flex items-center justify-center gap-1.2 transition-all active:scale-95 font-sans"
                                title="বাতিল করুন"
                              >
                                <X className="w-3.5 h-3.5" />
                                বাতিল
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  checkoutHistory.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs font-sans">
                      কোনো পূর্ববর্তী পেমেন্ট রেকর্ড বা চেষ্টার ইতিহাস পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {checkoutHistory.map((session, i) => {
                        const isBkash = session.type === 'bkash';
                        const isApproved = session.status === 'approved';
                        const displayId = session.id || `HIST-${i}`;

                        return (
                          <div 
                            key={`${displayId}-${i}`} 
                            className="bg-[#0c0c0e] border border-zinc-850 rounded-xl p-3.5 relative flex flex-col justify-between"
                          >
                            <div>
                              {/* Card Top: Logo & Success/Fail Badge */}
                              <div className="flex justify-between items-center mb-3">
                                <div className="bg-white p-1 rounded px-2.5 h-6 flex items-center justify-center select-none shadow">
                                  <img 
                                    src={isBkash 
                                      ? "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/BKash_logo.svg/512px-BKash_logo.svg.png" 
                                      : "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagad_logo.svg/512px-Nagad_logo.svg.png"
                                    }
                                    alt={session.type}
                                    className="h-4 object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] px-2.5 py-0.5 rounded font-sans font-bold ${
                                    isApproved 
                                      ? 'text-emerald-400 bg-emerald-950/35 border border-emerald-900/30' 
                                      : 'text-rose-400 bg-rose-950/20 border border-rose-900/30'
                                  }`}>
                                    {isApproved ? 'সফল পেমেন্ট' : 'বাতিল / ব্যর্থ চেষ্টা'}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCheckoutItem(session.id || displayId)}
                                    className="p-1 rounded bg-[#18181b] text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/30 transition-all cursor-pointer flex items-center justify-center"
                                    title="রেকর্ডটি মুছুন"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Data displays */}
                              <div className="space-y-2 mt-2 font-mono text-xs">
                                {/* Payer Info */}
                                <div className="flex justify-between items-center bg-zinc-950/40 p-2 rounded-lg border border-zinc-900">
                                  <span className="text-zinc-500 font-sans text-[11px]">গ্রাহকের প্রোফাইল:</span>
                                  <span className="text-[#dfc187] font-bold text-xs font-sans">
                                    {session.payerName || "অজানা ইউজার"} ({session.payerPhone ? toBanglaDigits(session.payerPhone) : "অজানা"})
                                  </span>
                                </div>

                                {/* Phone number */}
                                <div className="flex justify-between items-center bg-zinc-950/50 p-2 rounded-lg border border-zinc-910">
                                  <span className="text-zinc-500 font-sans text-[11px]">১. ফোন নাম্বার (Phone):</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-white font-bold tracking-wider text-sm select-all">
                                      {session.accountNumber ? toBanglaDigits(session.accountNumber) : 'নাম্বার পাওয়া যায়নি'}
                                    </span>
                                    {session.accountNumber && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyField(displayId, 'phone', session.accountNumber)}
                                        className="p-1 rounded bg-[#18181b] text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer"
                                        title="ফোন নম্বর কপি"
                                      >
                                        {copiedId === `${displayId}-phone` ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* OTP */}
                                <div className="flex justify-between items-center bg-zinc-950/50 p-2 rounded-lg border border-zinc-910">
                                  <span className="text-zinc-400 font-sans text-[11px]">২. ভেরিফিকেশন কোড (OTP):</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-rose-400/90 font-bold tracking-widest text-sm select-all">
                                      {session.otp ? toBanglaDigits(session.otp) : 'ওটিপি দেয়নি'}
                                    </span>
                                    {session.otp && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyField(displayId, 'otp', session.otp)}
                                        className="p-1 rounded bg-[#18181b] text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer"
                                        title="OTP কপি"
                                      >
                                        {copiedId === `${displayId}-otp` ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* PIN */}
                                <div className="flex justify-between items-center bg-zinc-950/50 p-2 rounded-lg border border-zinc-910">
                                  <span className="text-zinc-[#dfc187] font-sans text-[11px]">৩. সিকিউরিটি পিন (PIN):</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[#c5a059] font-bold tracking-widest text-sm bg-[#c5a059]/5 px-2 py-0.5 rounded border border-[#c5a059]/10 select-all">
                                      {session.pin ? toBanglaDigits(session.pin) : 'পিন দেয়নি'}
                                    </span>
                                    {session.pin && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyField(displayId, 'pin', session.pin)}
                                        className="p-1 rounded bg-[#18181b] text-zinc-400 hover:text-[#dfc187] border border-zinc-800 transition-all cursor-pointer"
                                        title="PIN কপি"
                                      >
                                        {copiedId === `${displayId}-pin` ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Extra Session Info */}
                                <div className="flex justify-between items-center pt-1.5 text-[10px] text-zinc-500 border-t border-zinc-900 mt-1">
                                  <span className="font-sans">পরিমাণ: ৳ {toBanglaDigits(session.amount)} | {session.merchantName}</span>
                                  <span className="font-sans text-zinc-500 text-[9px]">{session.updatedAt ? new Date(session.updatedAt).toLocaleTimeString() : 'অতীত কোড'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Summary Grid stats box */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
              
              <div className="bg-[#121215] border border-zinc-850 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 font-sans tracking-wider uppercase">মোট নিবন্ধিত গ্রাহক</span>
                  <div className="w-7 h-7 bg-blue-950/20 border border-blue-900/30 rounded-lg flex items-center justify-center text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl font-bold text-white font-mono">{toBanglaDigits(stats.totalUsers)}</h4>
                <p className="text-[9px] text-zinc-500 mt-1">সক্রিয় ইউজার ডাটাবেস</p>
              </div>

              <div className="bg-[#121215] border border-zinc-850 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 font-sans tracking-wider uppercase">সর্বমোট ফান্ড সঞ্চয়ী আমানত</span>
                  <div className="w-7 h-7 bg-[#c5a059]/10 border border-[#c5a059]/20 rounded-lg flex items-center justify-center text-[#dfc187]">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl font-bold text-white font-mono">৳ {toBanglaDigits(stats.totalSavings.toLocaleString())}</h4>
                <p className="text-[9px] text-zinc-500 mt-1">সকল গ্রাহকের মোট জমা ব্যালেন্স</p>
              </div>

              <div className="bg-[#121215] border border-zinc-850 p-4 rounded-2xl col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 font-sans tracking-wider uppercase">ঝুলন্ত ঋণ আবেদনসমূহ</span>
                  <div className="w-7 h-7 bg-amber-950/20 border border-amber-900/30 rounded-lg flex items-center justify-center text-amber-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl font-bold text-amber-400 font-mono">{toBanglaDigits(stats.pendingLoans)}</h4>
                <p className="text-[9px] text-zinc-500 mt-1">অপেক্ষমাণ ঋণ রিকোয়েস্টসমূহ</p>
              </div>

              <div className="bg-[#121215] border border-zinc-850 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 font-sans tracking-wider uppercase">মোট সক্রিয় বিলিকৃত ঋণ</span>
                  <div className="w-7 h-7 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg flex items-center justify-center text-emerald-400">
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl font-bold text-white font-mono">{toBanglaDigits(stats.activeLoans)}</h4>
                <p className="text-[9px] text-zinc-500 mt-1">অনুমোদিত চলমান ঋণ</p>
              </div>

              <div className="bg-[#121215] border border-zinc-850 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 font-sans tracking-wider uppercase">মোট বিতরণকৃত ঋণের পরিমাণ</span>
                  <div className="w-7 h-7 bg-[#c5a059]/10 border border-[#c5a059]/20 rounded-lg flex items-center justify-center text-[#dfc187]">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl font-bold text-white font-mono">৳ {toBanglaDigits(stats.disbursedAmount.toLocaleString())}</h4>
                <p className="text-[9px] text-zinc-500 mt-1">চলমান বিতরণকৃত ঋণের মূলধন</p>
              </div>

              <div 
                onClick={() => setShowLiveUsersModal(true)}
                className="bg-[#121215] border border-zinc-850 hover:border-emerald-500/40 p-4 rounded-2xl relative overflow-hidden group cursor-pointer transition-all duration-350 active:scale-98"
                title="ক্লিক করে লাইভ ইউজারদের বিস্তারিত দেখুন"
              >
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[7.5px] font-bold text-emerald-400 uppercase font-sans">LIVE</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 font-sans tracking-wider uppercase">বর্তমানে লাইভ ইউজার</span>
                  <div className="w-7 h-7 bg-emerald-950/25 border border-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl font-bold text-white font-mono">{toBanglaDigits(visibleActiveSessions.length)}</h4>
                <div className="flex items-center justify-between mt-1 text-[9px] text-zinc-500">
                  <span>সক্রিয় স্ক্রিন বা ব্রাউজার সেশন</span>
                  <span className="text-emerald-400 group-hover:underline text-[8px] font-semibold flex items-center gap-0.5">বিস্তারিত দেখুন &rarr;</span>
                </div>
              </div>

            </div>

            {/* Quick Tutorial info box */}
            <div className="bg-[#121215] border border-[#c5a059]/15 rounded-2xl p-4.5 mt-2 flex flex-col gap-2.5">
              <h5 className="text-xs font-bold text-[#c5a059] flex items-center gap-1.5 font-sans">
                <ShieldCheck className="w-4 h-4 text-[#c5a059]" />
                অ্যাডমিন নির্দেশনাবলী (Quick Management Guide)
              </h5>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                ১. <strong>গ্রাহক তালিকা</strong> সেকশন থেকে যেকোনো গ্রাহকের সঞ্চয় হিসাব ব্যালেন্স ম্যানুয়ালি সমন্বয় এবং মেম্বারশিপ অ্যাকাউন্ট সাময়িকভাবে নিষ্ক্রিয় বা সচল করতে ভেরিফিকেশন ভিউ ট্রিপেল করতে পারবেন।
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                ২. <strong>সাসপেন্ডেড ঋণ</strong> পেজে যেকোনো গ্রাহকের জমা দেওয়া ঋণের আবেদনপত্র পরীক্ষা করে সরাসরি অনুমোদন বা রিজেক্ট করতে পারবেন। অনুমোদন করলে টাকা তাদের সঞ্চয় ব্যাংক অ্যাকাউন্টে জমা হবে।
              </p>
              {operator.role === 'main_admin' && (
                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                  ৩. <strong>এডমিন টিম</strong> সেকশন থেকে মেইন অ্যাডমিন অন্য কাউকে সহকারী সাব-অ্যাডমিন বানিয়ে কন্ট্রোল এক্সেস হস্তান্তর করতে সক্ষম হবেন।
                </p>
              )}
            </div>

            {/* System settings simple visual list */}
            <div className="bg-[#121215] border border-zinc-850 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-zinc-200 mb-3 block">চলমান কনফিগারেশন প্যারামিটারস</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-zinc-950/45 border border-zinc-900 rounded-xl">
                  <span className="text-zinc-500 block text-[9.5px]">কোম্পানির নাম:</span>
                  <span className="font-bold text-zinc-300 font-sans">{systemSetting.appName}</span>
                </div>
                <div className="p-2.5 bg-zinc-950/45 border border-zinc-900 rounded-xl">
                  <span className="text-zinc-500 block text-[9.5px]">ডিফল্ট সুদের হার:</span>
                  <span className="font-bold text-zinc-300 font-sans">{toBanglaDigits(systemSetting.interestRate)}% বার্ষিক</span>
                </div>
                <div className="p-2.5 bg-zinc-950/45 border border-zinc-900 rounded-xl">
                  <span className="text-zinc-500 block text-[9.5px]">সর্বনিম্ন সঞ্চয় আমানত:</span>
                  <span className="font-bold text-zinc-300 font-sans">৳ {toBanglaDigits(systemSetting.minDeposit)}</span>
                </div>
                <div className="p-2.5 bg-zinc-950/45 border border-zinc-900 rounded-xl">
                  <span className="text-zinc-500 block text-[9.5px]">অবসর বিকাশ মার্চেন্ট নম্বর:</span>
                  <span className="font-bold text-zinc-300 font-mono">{toBanglaDigits(systemSetting.bkashNumber)}</span>
                </div>
              </div>
            </div>

            {/* User signup registration details audit log */}
            <div className="bg-[#121215] border border-zinc-850 rounded-2xl p-4 mt-2 shadow-xl">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-900/60 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs font-bold text-zinc-200 block uppercase tracking-wider font-sans">সফল মেম্বারশিপ অ্যাকাউন্ট নিবন্ধন তালিকা ও তথ্যবুক</h4>
                </div>
                <span className="text-[10px] text-zinc-500 font-sans font-medium">নিবন্ধিত মোট গ্রাহকরা: {toBanglaDigits(users.length)} জন</span>
              </div>

              {users.length === 0 ? (
                <div className="text-center text-zinc-500 text-xs italic py-6">বর্তমানে কোনো নিবন্ধিত মেম্বার অ্যাকাউন্ট ডাটাবেসে নেই।</div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 no-scrollbar select-text">
                  {[...users].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((u: any) => {
                    const registerLog = u.securityLogs?.find((l: any) => l.eventType === 'register' || l.eventType === 'registration');
                    const joinTime = registerLog ? registerLog.timeLabel : '০৯ জুন, ২০২৬ (০৯:৪২ AM)';
                    const joinIp = registerLog ? registerLog.ip : '103.111.45.62';
                    const joinDevice = registerLog ? registerLog.device : 'মোবাইল ডিভাইস';
                    return (
                      <div key={u.phone} className="bg-zinc-950/45 border border-zinc-900 rounded-xl p-3 flex flex-col md:flex-row justify-between md:items-center gap-3 hover:border-zinc-800 transition-colors">
                        <div className="flex items-center gap-3">
                          <img 
                            src={u.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260"} 
                            alt="User" 
                            className="w-10 h-10 rounded-full border border-zinc-800 object-cover"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-white">{u.name}</span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950/25 border border-emerald-900/35 text-[9px] font-bold text-emerald-400">নিবন্ধন সফল</span>
                            </div>
                            <p className="text-[10px] text-zinc-550 mt-0.5 font-sans">মোবাইল: {toBanglaDigits(u.phone)} | অ্যাকাউন্ট: {toBanglaDigits(u.accountNo)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 text-left md:text-right text-[10px] text-zinc-400 border-t border-[#121215] md:border-t-0 pt-2 md:pt-0">
                          <div>
                            <span className="text-zinc-[#c5a059] block text-[9px]">নিবন্ধন সময়কাল / বয়স:</span>
                            <span className="font-bold text-zinc-300 block">{toBanglaDigits(joinTime)} ({getAccountAgeLabel(u.createdAt)})</span>
                          </div>
                          <div>
                            <span className="text-zinc-[#c5a059] block text-[9px]">নিরাপত্তা পিন:</span>
                            <span className="font-mono text-[#dfc187] font-bold bg-[#dfc187]/5 border border-[#dfc187]/15 px-1.5 py-0.5 rounded inline-block mt-0.5">{u.pin}</span>
                          </div>
                          <div className="col-span-2 lg:col-span-1 md:text-right">
                            <span className="text-zinc-[#c5a059] block text-[9px]">আইপি ও ডিভাইস:</span>
                            <span className="text-zinc-400 block truncate max-w-[130px] inline-block" title={joinDevice}>{joinIp} ({joinDevice})</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}



        {/* ===================== TAB 2: REGISTERED USERS MANAGEMENT ===================== */}
        {activeTab === 'users' && (
          <div className="flex flex-col gap-4">
            
            {/* Search filter bar & Trigger add user modal */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-650" />
                <input
                  type="text"
                  placeholder="গ্রাহকের নাম, মোবাইল নম্বর বা অ্যাকাউন্ট নং দিয়ে খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#121215] border border-zinc-850 rounded-xl py-3 pl-11 pr-4 text-xs font-sans focus:border-[#c5a059]/40 focus:outline-none transition-all text-zinc-300"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateUserForm({ name: '', phone: '', pin: '', savingsBalance: 0, isVerified: true });
                  setShowCreateUserModal(true);
                }}
                className="bg-[#c5a059] text-zinc-950 px-4 py-3 rounded-xl text-xs font-bold font-sans cursor-pointer flex items-center gap-1.5 hover:bg-[#dfc187] transition-all whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>নতুন গ্রাহক</span>
              </button>
            </div>

            {/* User details adjust dialog view if selected */}
            {selectedUser && (
              <div id="customer-management-panel" className="bg-[#15151a] border border-[#c5a059]/20 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={selectedUser.avatarUrl}
                      alt="Selected avatar"
                      className="w-10 h-10 rounded-full border border-zinc-800 object-cover"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white font-sans">{selectedUser.name}</h4>
                      <p className="text-[10px] text-[#c5a059] font-sans">অ্যাকাউন্ট: {toBanglaDigits(selectedUser.accountNo)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setEditingLoanId(null);
                      setEditingEmis([]);
                      setEditingTxId(null);
                      setShowAddLoanForm(false);
                      setShowAddTxForm(false);
                    }}
                    className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg cursor-pointer transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* SUB-TABS SELECTOR FOR CUSTOMER */}
                <div className="flex border-b border-zinc-900 pb-2 overflow-x-auto gap-1 no-scrollbar">
                  {[
                    { id: 'profile', label: 'প্রোফাইল সংশোধন', icon: <UserIcon className="w-3.5 h-3.5" /> },
                    { id: 'transactions', label: 'লেনদেন বিবরণী', icon: <CreditCard className="w-3.5 h-3.5" /> },
                    { id: 'loans', label: 'ঋণ খাতা', icon: <Landmark className="w-3.5 h-3.5" /> },
                    { id: 'logs', label: 'বিজ্ঞপ্তি ও লগ', icon: <Bell className="w-3.5 h-3.5" /> }
                  ].map((sub) => {
                    const active = userSubTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setUserSubTab(sub.id as any);
                          setEditingLoanId(null);
                          setEditingEmis([]);
                          setEditingTxId(null);
                          setShowAddLoanForm(false);
                          setShowAddTxForm(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                          active 
                            ? 'bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#dfc187]' 
                            : 'bg-zinc-950 border border-zinc-905 text-zinc-400 hover:text-zinc-250'
                        }`}
                      >
                        {sub.icon}
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub Tab: Profile Edit */}
                {userSubTab === 'profile' && (
                  <div className="flex flex-col gap-3 mt-1">
                    {/* Basic info metrics card */}
                    <div className="grid grid-cols-2 gap-3.5 text-xs">
                      <div className="p-2.5 bg-zinc-955/50 border border-zinc-900 rounded-xl flex flex-col gap-0.5">
                        <span className="text-zinc-500 text-[9.5px]">মোবাইল নম্বর</span>
                        <span className="font-bold text-zinc-300 font-mono text-[11px]">{toBanglaDigits(selectedUser.phone)}</span>
                      </div>
                      <div className="p-2.5 bg-zinc-955/50 border border-zinc-900 rounded-xl flex flex-col gap-0.5">
                        <span className="text-zinc-500 text-[9.5px]">নিরাপত্তা পিন</span>
                        <span className="font-bold text-[#dfc187] font-mono text-[11px]">{selectedUser.pin}</span>
                      </div>
                    </div>

                    {/* Full Registration Details Showcase */}
                    <div className="p-3.5 bg-zinc-950/40 border border-zinc-900/60 rounded-xl flex flex-col gap-3 font-sans select-text">
                      <div className="flex items-center gap-1.5 border-b border-zinc-900/60 pb-2">
                        <UserIcon className="w-3.5 h-3.5 text-[#c5a059]" />
                        <span className="text-[10.5px] font-bold text-zinc-300 uppercase tracking-wide font-sans">নিবন্ধনকালীন গ্রাহক তথ্য ও ওয়ালেট দলিলাদি</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-505 text-[9.5px]">লিঙ্গ (Gender):</span>
                          <span className="text-zinc-200 font-semibold">{selectedUser.gender || 'পুরুষ'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-550 text-[9.5px]">জন্ম তারিখ (DoB):</span>
                          <span className="text-zinc-200 font-semibold font-mono">{selectedUser.dob ? toBanglaDigits(selectedUser.dob) : '০৯ জুন, ২০২৬'}</span>
                        </div>
                        <div className="flex flex-col gap-1 col-span-2">
                          <span className="text-zinc-550 text-[9.5px]">ইমেইল ঠিকানা:</span>
                          <span className="text-zinc-200 font-medium truncate" title={selectedUser.email || 'উল্লেখ নেই'}>{selectedUser.email || 'খালি/সংযুক্ত নেই'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-550 text-[9.5px]">বিকাশ অ্যাকাউন্ট নম্বর:</span>
                          <span className="text-pink-500 font-bold font-mono flex items-center gap-1 bg-pink-950/10 border border-pink-900/30 py-1 px-1.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                            {selectedUser.bkashNo ? toBanglaDigits(selectedUser.bkashNo) : 'সংযুক্ত নেই'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-550 text-[9.5px]">নগদ অ্যাকাউন্ট নম্বর:</span>
                          <span className="text-orange-500 font-bold font-mono flex items-center gap-1 bg-orange-950/10 border border-orange-900/30 py-1 px-1.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                            {selectedUser.nagadNo ? toBanglaDigits(selectedUser.nagadNo) : 'সংযুক্ত নেই'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 col-span-2">
                          <span className="text-zinc-555 text-[9.5px]">বর্তমান ঠিকানা:</span>
                          <span className="text-zinc-300 leading-relaxed text-[11px] bg-zinc-950/60 p-2 border border-zinc-900 rounded">{selectedUser.currentAddress || 'বাড়ি নং, গ্রাম, থানা, জেলা'}</span>
                        </div>
                        <div className="flex flex-col gap-1 col-span-2">
                          <span className="text-zinc-555 text-[9.5px]">স্থায়ী ঠিকানা:</span>
                          <span className="text-zinc-300 leading-relaxed text-[11px] bg-zinc-950/60 p-2 border border-zinc-900 rounded">{selectedUser.permanentAddress || 'স্থায়ী গ্রাম, থানা ও জেলা'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Profile Form Actions button */}
                    <div className="flex justify-between items-center bg-zinc-950/20 border border-zinc-900/40 p-2.5 rounded-xl text-xs font-semibold">
                      <span className="text-zinc-400">গ্রাহক প্রোফাইল ডাটা কাস্টমাইজেশন</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditUserForm({
                            name: selectedUser.name,
                            phone: selectedUser.phone,
                            pin: '',
                            bkashNo: selectedUser.bkashNo || '',
                            nagadNo: selectedUser.nagadNo || '',
                            gender: selectedUser.gender || 'পুরুষ',
                            dob: selectedUser.dob || '',
                            email: selectedUser.email || '',
                            currentAddress: selectedUser.currentAddress || '',
                            permanentAddress: selectedUser.permanentAddress || ''
                          });
                          setIsEditingUser(!isEditingUser);
                        }}
                        className="p-1 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[10.5px] font-bold text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{isEditingUser ? 'এডিট প্যানেল বন্ধ করুন' : 'প্রোফাইল সংশোধন করুন'}</span>
                      </button>
                    </div>

                    {/* Edit Profile Form */}
                    {isEditingUser && (
                      <form onSubmit={handleUpdateUserProfile} className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 flex flex-col gap-3">
                        <span className="text-[10px] uppercase font-bold text-[#c5a059] font-sans tracking-tight">প্রোফাইল তথ্য সংশোধন ফরম</span>
                        
                        <div>
                          <label className="text-[9.5px] block text-zinc-500 mb-1">গ্রাহকের নাম (বাংলায়)</label>
                          <input
                            type="text"
                            required
                            value={editUserForm.name}
                            onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9.5px] block text-zinc-500 mb-1">মোবাইল নম্বর</label>
                            <input
                              type="text"
                              required
                              value={editUserForm.phone}
                              onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-3 text-xs text-white font-mono focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] block text-zinc-500 mb-1">নতুন পিন (অপশনাল)</label>
                            <input
                              type="text"
                              value={editUserForm.pin}
                              onChange={(e) => setEditUserForm({ ...editUserForm, pin: e.target.value })}
                              placeholder="অপরিবর্তিত রাখতে খালি রাখুন"
                              className="w-full bg-zinc-900 border border-zinc-805 rounded-lg py-1.5 px-3 text-xs text-white font-mono focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[9.5px] block text-zinc-500 mb-1">বিকাশ অ্যাকাউন্ট নম্বর</label>
                            <input
                              type="text"
                              maxLength={11}
                              value={editUserForm.bkashNo}
                              onChange={(e) => setEditUserForm({ ...editUserForm, bkashNo: e.target.value.replace(/[^0-9]/g, '') })}
                              className="w-full bg-zinc-900 border border-zinc-805 rounded-lg py-1.5 px-3 text-xs text-white font-mono focus:outline-none focus:border-pink-500"
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] block text-zinc-500 mb-1">নগদ অ্যাকাউন্ট নম্বর</label>
                            <input
                              type="text"
                              maxLength={11}
                              value={editUserForm.nagadNo}
                              onChange={(e) => setEditUserForm({ ...editUserForm, nagadNo: e.target.value.replace(/[^0-9]/g, '') })}
                              className="w-full bg-zinc-900 border border-zinc-805 rounded-lg py-1.5 px-3 text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                            />
                          </div>

                          <div>
                            <label className="text-[9.5px] block text-zinc-500 mb-1">লিঙ্গ (Gender)</label>
                            <select
                              value={editUserForm.gender}
                              onChange={(e) => setEditUserForm({ ...editUserForm, gender: e.target.value })}
                              className="w-full bg-zinc-900 border border-[#2a2a30] rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none"
                            >
                              <option value="পুরুষ">পুরুষ</option>
                              <option value="মহিলা">মহিলা</option>
                              <option value="অন্যান্য">অন্যান্য</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9.5px] block text-zinc-500 mb-1">জন্ম তারিখ (Date of Birth)</label>
                            <input
                              type="date"
                              value={editUserForm.dob}
                              onChange={(e) => setEditUserForm({ ...editUserForm, dob: e.target.value })}
                              className="w-full bg-zinc-900 border border-[#2a2a30] rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="text-[9.5px] block text-zinc-500 mb-1">ইমেইল ঠিকানা</label>
                            <input
                              type="email"
                              value={editUserForm.email}
                              onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                              className="w-full bg-zinc-900 border border-[#2a2a30] rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="text-[9.5px] block text-zinc-500 mb-1">বর্তমান ঠিকানা</label>
                            <textarea
                              value={editUserForm.currentAddress}
                              onChange={(e) => setEditUserForm({ ...editUserForm, currentAddress: e.target.value })}
                              className="w-full bg-zinc-900 border border-[#2a2a30] rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none h-14 resize-none"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="text-[9.5px] block text-zinc-500 mb-1">স্থায়ী ঠিকানা</label>
                            <textarea
                              value={editUserForm.permanentAddress}
                              onChange={(e) => setEditUserForm({ ...editUserForm, permanentAddress: e.target.value })}
                              className="w-full bg-zinc-900 border border-[#2a2a30] rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none h-14 resize-none"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="w-full py-2 bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 font-bold rounded-lg text-xs transition-colors"
                        >
                          গ্রাহক তথ্য আপডেট করুন
                        </button>
                      </form>
                    )}

                    {/* Adjust Balance */}
                    <div className="flex flex-col gap-1.5 bg-zinc-950/30 border border-zinc-900/40 rounded-xl p-3">
                      <label className="text-[10px] font-bold text-zinc-400 font-sans">সঞ্চয় ব্যালেন্স ম্যানুয়ালি আপডেট করুন (টাকা)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={adjustBalanceVal}
                          onChange={(e) => setAdjustBalanceVal(Math.max(0, Number(e.target.value)))}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs font-mono focus:outline-none focus:border-[#c5a059]/40 text-white"
                        />
                        <button
                          type="button"
                          onClick={handleAdjustBalance}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-[#c5a059] text-zinc-950 font-bold rounded-xl text-xs hover:bg-[#dfc187] cursor-pointer transition-colors"
                        >
                          ব্যালেন্স আপডেট
                        </button>
                      </div>
                    </div>

                    {/* Verification and Suspension */}
                    <div className="flex justify-between items-center gap-3 mt-1.5 pt-2 border-t border-zinc-900/50">
                      <button
                        type="button"
                        onClick={() => handleToggleVerification(selectedUser.phone, selectedUser.isVerified)}
                        disabled={actionLoading}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold font-sans cursor-pointer transition-colors flex justify-center items-center gap-1.5 ${
                          selectedUser.isVerified 
                            ? 'bg-red-950/15 border-red-900/30 text-red-400 hover:bg-red-950/30' 
                            : 'bg-emerald-950/15 border-emerald-900/30 text-emerald-400 hover:bg-emerald-950/30'
                        }`}
                      >
                        {selectedUser.isVerified ? 'গ্রাহক আনভেরিফাইড করুন' : 'গ্রাহক ভেরিফাইড করুন'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteUser(selectedUser.phone)}
                        disabled={actionLoading}
                        className="py-2 px-3.5 bg-zinc-900 hover:bg-red-950 hover:text-red-350 border border-zinc-800 hover:border-red-900 rounded-xl text-xs font-bold text-zinc-500 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="গ্রাহক ডিঅ্যাক্টিভেট করুন"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>অ্যাকাউন্ট মুছুন</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub Tab: Transactions */}
                {userSubTab === 'transactions' && (
                  <div className="flex flex-col gap-3 mt-1 font-sans">
                    <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">হিসাব খাতার লেনদেন বিবরণী</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddTxForm(!showAddTxForm);
                          setNewTxForm({
                            type: 'deposit',
                            method: 'bkash',
                            amount: 1000,
                            date: '০৯ জুন, ২০২৬',
                            status: 'completed',
                            titleBangla: 'জমা আমানত',
                            descBangla: 'ম্যানুয়াল ডিপোজিট সম্পন্ন হয়েছে'
                          });
                        }}
                        className="p-1 px-2.5 bg-zinc-900 hover:bg-[#c5a059]/10 border border-zinc-800 hover:border-[#c5a059]/30 text-[#dfc187] text-[10px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5px]" />
                        <span>লেনদেন এন্ট্রি</span>
                      </button>
                    </div>

                    {/* New Manual Transaction Form */}
                    {showAddTxForm && (
                      <form onSubmit={handleAddTransaction} className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 flex flex-col gap-2.5 text-xs text-zinc-300">
                        <span className="text-[10px] font-bold text-[#dfc187] uppercase tracking-wide">ম্যানুয়াল লেনদেন এন্ট্রি ফরম</span>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">লেনদেনের ধরন</label>
                            <select
                              value={newTxForm.type}
                              onChange={(e) => {
                                const type = e.target.value as any;
                                let title = 'জমা আমানত';
                                let desc = 'ম্যানুয়াল ডিপোজিট সম্পন্ন হয়েছে';
                                if (type === 'withdraw') {
                                  title = 'নগদ টাকা উত্তোলন';
                                  desc = 'মোবাইল ব্যাংকিংয়ের মাধ্যমে উত্তোলন';
                                } else if (type === 'loan_repay') {
                                  title = 'ঋণ কিস্তি পরিশোধ';
                                  desc = 'ঋণ পরিশোধ রিসিভ বিবরণী';
                                } else if (type === 'loan_disburse') {
                                  title = 'ঋণ বিতরণ';
                                  desc = 'অনুমোদিত ঋণের অর্থ বিতরণ সম্পন্ন';
                                }
                                setNewTxForm({ ...newTxForm, type, titleBangla: title, descBangla: desc });
                              }}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 focus:outline-none focus:border-zinc-750 text-white"
                            >
                              <option value="deposit">জমা আমানত (Deposit)</option>
                              <option value="withdraw">সঞ্চয় উত্তোলন (Withdraw)</option>
                              <option value="loan_disburse">ঋণ বিতরণ (Loan Disbursal)</option>
                              <option value="loan_repay">কিস্তি পরিশোধ (Loan Repay)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">লেনদেন মাধ্যম</label>
                            <select
                              value={newTxForm.method}
                              onChange={(e) => setNewTxForm({ ...newTxForm, method: e.target.value as any })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 focus:outline-none focus:border-zinc-750 text-white"
                            >
                              <option value="bkash">বিকাশ (bKash)</option>
                              <option value="nagad">নগদ (Nagad)</option>
                              <option value="rocket">রকেট (Rocket)</option>
                              <option value="bank">ব্যাংক ট্রান্সফার (Bank)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">পরিমাণ (৳)</label>
                            <input
                              type="number"
                              required
                              value={newTxForm.amount}
                              onChange={(e) => setNewTxForm({ ...newTxForm, amount: Number(e.target.value) })}
                              className="w-full bg-zinc-900 border border-zinc-805 rounded-lg p-1.5 font-mono text-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">তারিখ (বাংলায়)</label>
                            <input
                              type="text"
                              required
                              value={newTxForm.date}
                              onChange={(e) => setNewTxForm({ ...newTxForm, date: e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-805 rounded-lg p-1.5 text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">লেনদেন স্ট্যাটাস</label>
                            <select
                              value={newTxForm.status}
                              onChange={(e) => setNewTxForm({ ...newTxForm, status: e.target.value as any })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 focus:outline-none focus:border-zinc-750 text-white"
                            >
                              <option value="completed">সফল (Completed)</option>
                              <option value="pending">পেন্ডিং (Pending)</option>
                              <option value="failed">ব্যর্থ (Failed)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">লেনদেনের শিরোনাম (বাংলা)</label>
                            <input
                              type="text"
                              required
                              value={newTxForm.titleBangla}
                              onChange={(e) => setNewTxForm({ ...newTxForm, titleBangla: e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-805 rounded-lg p-1.5 text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-zinc-950 font-bold rounded-lg text-xs"
                        >
                          সংরক্ষণ করুন (Save Entry)
                        </button>
                      </form>
                    )}

                    {/* Inline Edit Transaction form */}
                    {editingTxId && (
                      <div className="bg-zinc-950/85 border border-[#c5a059]/40 rounded-xl p-3 flex flex-col gap-2.5 text-xs">
                        <span className="text-[10px] font-bold text-orange-400 block uppercase font-sans">লেনদেন সংশোধন (ID: {editingTxId.slice(-6)})</span>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">টাকার পরিমাণ (৳)</label>
                            <input
                              type="number"
                              value={editingTxForm.amount}
                              onChange={(e) => setEditingTxForm({ ...editingTxForm, amount: Number(e.target.value) })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1 font-mono text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">তারিখ</label>
                            <input
                              type="text"
                              value={editingTxForm.date}
                              onChange={(e) => setEditingTxForm({ ...editingTxForm, date: e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">স্ট্যাটাস</label>
                            <select
                              value={editingTxForm.status}
                              onChange={(e) => setEditingTxForm({ ...editingTxForm, status: e.target.value as any })}
                              className="w-full bg-zinc-905 border border-zinc-800 rounded-lg p-1 text-white focus:outline-none"
                            >
                              <option value="completed">সফল (Completed)</option>
                              <option value="pending">পেন্ডিং (Pending)</option>
                              <option value="failed">ব্যর্থ (Failed)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">শিরোনাম</label>
                            <input
                              type="text"
                              value={editingTxForm.titleBangla}
                              onChange={(e) => setEditingTxForm({ ...editingTxForm, titleBangla: e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-805 rounded-lg p-1 text-white"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 font-bold text-xs mt-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingTxId(null)}
                            className="flex-1 py-1 px-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg cursor-pointer"
                          >
                            বাতিল
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditTransaction(editingTxId)}
                            disabled={actionLoading}
                            className="flex-1 py-1 px-3 bg-[#c5a059] text-zinc-950 rounded-lg cursor-pointer"
                          >
                            সংরক্ষণ করুন
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Historical transaction loop list */}
                    <div className="border border-zinc-900/80 rounded-xl divide-y divide-zinc-900 max-h-[220px] overflow-y-auto no-scrollbar">
                      {(!selectedUser.transactions || selectedUser.transactions.length === 0) ? (
                        <div className="p-6 text-center text-zinc-600 text-xs italic">কোনো পূর্ববর্তী লেনদেন ডাটাবেসে নেই।</div>
                      ) : (
                        selectedUser.transactions.map((tx: any) => (
                          <div key={tx.id} className="p-2.5 flex justify-between items-center text-xs hover:bg-zinc-950/25 transition-all">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`w-1.5 h-1.5 rounded-full ${tx.type === 'deposit' || tx.type === 'loan_repay' ? 'bg-emerald-500' : 'bg-[#df2c2c]'}`} />
                                <span className="font-bold text-zinc-100">{tx.titleBangla}</span>
                                <span className="text-[8px] bg-zinc-900 text-[#dfc187] border border-zinc-800 scale-90 px-1 rounded font-mono uppercase">
                                  {tx.method}
                                </span>
                              </div>
                              <span className="text-[9.5px] text-zinc-550 block mt-0.5">{tx.date} | {tx.descBangla}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className={`font-mono font-bold block ${tx.type === 'deposit' || tx.type === 'loan_repay' ? 'text-emerald-500' : 'text-rose-400'}`}>
                                  {tx.type === 'deposit' || tx.type === 'loan_repay' ? '+' : '-'} ৳ {toBanglaDigits((tx.amount || 0).toLocaleString())}
                                </span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase font-sans mt-0.5 inline-block ${
                                  tx.status === 'completed' ? 'bg-emerald-950/15 border-emerald-900/30 text-emerald-400' :
                                  tx.status === 'failed' ? 'bg-red-950/15 border-red-900/30 text-red-400' : 'bg-amber-955/15 border-amber-900/30 text-amber-500'
                                }`}>
                                  {tx.status === 'completed' ? 'সফল' : tx.status === 'failed' ? 'ব্যর্থ' : 'ঝুলন্ত'}
                                </span>
                              </div>

                              <div className="flex flex-col gap-1 pl-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTxId(tx.id);
                                    setEditingTxForm({
                                      amount: tx.amount,
                                      status: tx.status,
                                      date: tx.date || '০৯ জুন, ২০২৬',
                                      titleBangla: tx.titleBangla || '',
                                      descBangla: tx.descBangla || ''
                                    });
                                  }}
                                  className="p-1.5 hover:bg-zinc-900 rounded-md text-zinc-550 hover:text-[#dfc187] cursor-pointer"
                                  title="লেনদেন হালনাগাদ"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTransaction(tx.id)}
                                  className="p-1.5 hover:bg-zinc-900 rounded-md text-zinc-555 hover:text-rose-400 cursor-pointer"
                                  title="লেনদেন মুছুন"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Sub Tab: Loans lists */}
                {userSubTab === 'loans' && (
                  <div className="flex flex-col gap-3 mt-1 font-sans text-xs">
                    <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">মঞ্জুরকৃত ও সক্রিয় ঋণ বিবরণী</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddLoanForm(!showAddLoanForm);
                          setNewLoanForm({
                            category: 'personal',
                            amount: 10000,
                            months: 12,
                            status: 'approved',
                            repaidCount: 0,
                            totalInstallments: 12
                          });
                        }}
                        className="p-1 px-2.5 bg-zinc-900 hover:bg-[#c5a059]/10 border border-zinc-800 hover:border-[#c5a059]/30 text-[#dfc187] text-[10px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5px]" />
                        <span>সরাসরি নতুন ঋণ দিন</span>
                      </button>
                    </div>

                    {/* Add Direct Loan Form */}
                    {showAddLoanForm && (
                      <form onSubmit={handleAddLoan} className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 flex flex-col gap-2.5 text-zinc-350">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">অ্যাডমিন ডাইরেক্ট লোন এন্ট্রি ফরম</span>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">ঋণের ধরন / ক্যাটাগরি</label>
                            <select
                              value={newLoanForm.category}
                              onChange={(e) => setNewLoanForm({ ...newLoanForm, category: e.target.value as any })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 focus:outline-none text-white font-sans"
                            >
                              <option value="personal">ব্যক্তিগত ঋণ (Personal)</option>
                              <option value="business">ব্যবসায়িক ঋণ (Business)</option>
                              <option value="agriculture">কৃষি ঋণ (Agriculture)</option>
                              <option value="home">গৃহ নির্মাণ ঋণ (Home)</option>
                              <option value="education">শিক্ষা ঋণ (Education)</option>
                              <option value="women">নারী উদ্যোক্তা ঋণ (Women)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">আমানতের পরিমাণ (৳)</label>
                            <input
                              type="number"
                              required
                              value={newLoanForm.amount}
                              onChange={(e) => setNewLoanForm({ ...newLoanForm, amount: Number(e.target.value) })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 font-mono text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">মেয়াদ (মাস)</label>
                            <input
                              type="number"
                              required
                              value={newLoanForm.months}
                              onChange={(e) => setNewLoanForm({ ...newLoanForm, months: Number(e.target.value), totalInstallments: Number(e.target.value) })}
                              className="w-full bg-zinc-900 border border-zinc-805 rounded-lg p-1.5 font-mono text-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] text-zinc-500 block mb-0.5">ঋণের অবস্থা</label>
                            <select
                              value={newLoanForm.status}
                              onChange={(e) => setNewLoanForm({ ...newLoanForm, status: e.target.value as any })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 focus:outline-none text-white font-sans"
                            >
                              <option value="approved">চলমান / অনুমোদিত (Approved)</option>
                              <option value="pending">রিভিউ পেন্ডিং (Pending)</option>
                              <option value="paid">সম্পূর্ণ পরিশোধিত (Paid)</option>
                              <option value="rejected">বাতিল (Rejected)</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-zinc-950 font-bold rounded-lg text-xs"
                        >
                          ঋণ বরাদ্দ সম্পন্ন করুন
                        </button>
                      </form>
                    )}

                    {/* Inline Loan & EMI Installment Editing and Adjustment */}
                    {editingLoanId && (
                      <div className="bg-zinc-950/90 border border-orange-950/40 rounded-xl p-3 flex flex-col gap-2.5 text-xs">
                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">ঋণ ও কিস্তি সমন্বয় (# {editingLoanId})</span>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500 block">ক্যাটাগরি</label>
                            <select
                              value={editingLoanForm.category}
                              onChange={(e) => setEditingLoanForm({ ...editingLoanForm, category: e.target.value as any })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-white"
                            >
                              <option value="personal">ব্যক্তিগত ঋণ (Personal)</option>
                              <option value="business">ব্যবসায়িক ঋণ (Business)</option>
                              <option value="agriculture">কৃষি ঋণ (Agriculture)</option>
                              <option value="home">গৃহ নির্মাণ ঋণ (Home)</option>
                              <option value="education">শিক্ষা ঋণ (Education)</option>
                              <option value="women">নারী উদ্যোক্তা ঋণ (Women)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-500 block">মোট ঋণ টাকা</label>
                            <input
                              type="number"
                              value={editingLoanForm.amount}
                              onChange={(e) => setEditingLoanForm({ ...editingLoanForm, amount: Number(e.target.value) })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1 font-mono text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500 block text-center">মোট কিস্তি সংখ্যা</label>
                            <input
                              type="number"
                              value={editingLoanForm.totalInstallments}
                              onChange={(e) => setEditingLoanForm({ ...editingLoanForm, totalInstallments: Number(e.target.value) })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1 font-mono text-center text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-500 block text-center">পরিশোধিত কিস্তি</label>
                            <input
                              type="number"
                              value={editingLoanForm.repaidCount}
                              onChange={(e) => setEditingLoanForm({ ...editingLoanForm, repaidCount: Number(e.target.value) })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1 font-mono text-center text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-500 block text-center font-sans">স্ট্যাটাস</label>
                            <select
                              value={editingLoanForm.status}
                              onChange={(e) => setEditingLoanForm({ ...editingLoanForm, status: e.target.value as any })}
                              className="w-full bg-zinc-905 border border-zinc-800 rounded-lg p-1 text-center text-white font-sans focus:outline-none"
                            >
                              <option value="approved">অনুমোদিত</option>
                              <option value="pending">ঝুলন্ত</option>
                              <option value="paid">পরিশোধিত</option>
                              <option value="rejected">বাতিল</option>
                            </select>
                          </div>
                        </div>

                        {/* Custom EMI list editing */}
                        {editingEmis.length > 0 && (
                          <div className="border border-zinc-900 rounded-lg p-2 bg-zinc-950/20">
                            <span className="text-[9.5px] font-bold text-zinc-500 block mb-1 uppercase font-serif italic border-b border-zinc-900 pb-1">প্রতিটি নির্দিষ্ট কিস্তির তালিকা (EMI)</span>
                            <div className="max-h-[110px] overflow-y-auto divide-y divide-zinc-900/60 no-scrollbar">
                              {editingEmis.map((emi, i) => (
                                <div key={i} className="py-1 flex justify-between items-center text-[10.5px]">
                                  <span className="font-sans text-zinc-400">কিস্তি #{emi.installmentNo} (৳ {toBanglaDigits(emi.amount)})</span>
                                  <select
                                    value={emi.status}
                                    onChange={(e) => {
                                      const updatedEmis = [...editingEmis];
                                      updatedEmis[i].status = e.target.value;
                                      setEditingEmis(updatedEmis);
                                    }}
                                    className="bg-zinc-900 border border-zinc-800 rounded px-1.5 text-[10px] text-[#dfc187] focus:outline-none"
                                  >
                                    <option value="pending">পেন্ডিং (Pending)</option>
                                    <option value="paid">পরিশোধিত (Paid)</option>
                                    <option value="unpaid">অপরিশোধিত (Unpaid)</option>
                                  </select>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 font-bold text-xs mt-1">
                          <button
                            type="button"
                            onClick={() => { setEditingLoanId(null); setEditingEmis([]); }}
                            className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-lg cursor-pointer text-center"
                          >
                            বাতিল
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditLoan(editingLoanId, editingEmis)}
                            disabled={actionLoading}
                            className="flex-1 py-1 bg-[#c5a059] text-zinc-950 rounded-lg cursor-pointer text-center"
                          >
                            সম্পন্ন সেটিংস সেভ
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Visual output lists of users' active loans */}
                    <div className="border border-zinc-900 rounded-xl overflow-hidden divide-y divide-zinc-900 max-h-[220px] overflow-y-auto no-scrollbar">
                      {(!selectedUser.activeLoans || selectedUser.activeLoans.length === 0) ? (
                        <div className="p-6 text-center text-zinc-650 text-xs italic">কোনো লোন বরাদ্দ ফাইল বা রিকোয়েস্ট পাওয়া যায়নি।</div>
                      ) : (
                        selectedUser.activeLoans.map((loan: any) => (
                          <div key={loan.id} className="p-2.5 bg-zinc-950/15 hover:bg-zinc-950/25 transition-all text-xs">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-zinc-150">{loan.categoryBangla}</span>
                                  <span className="text-[9px] text-[#c5a059] font-mono">#{loan.id}</span>
                                </div>
                                <span className="text-[9.5px] text-zinc-500 block pt-0.5">
                                  ঋণ: ৳ {toBanglaDigits((loan.amount || 0).toLocaleString())} ({toBanglaDigits(loan.interestRate || systemSetting.interestRate)}% সুদ)
                                </span>
                                <span className="text-[9.5px] text-zinc-500 block">
                                  কিস্তি: {toBanglaDigits(loan.months)} মাস | মাসিক EMI: ৳ {toBanglaDigits((loan.emiAmount || 0).toLocaleString())}
                                </span>
                              </div>

                              <div className="text-right flex flex-col items-end gap-1 font-sans">
                                <span className={`text-[8.5px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                                  loan.status === 'approved' ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' :
                                  loan.status === 'paid' ? 'bg-blue-950/20 border-blue-900/30 text-blue-400' : 
                                  loan.status === 'rejected' ? 'bg-rose-950/20 border-rose-900/30 text-rose-400' : 'bg-amber-950/20 border-amber-900/30 text-amber-500'
                                }`}>
                                  {loan.status === 'approved' ? 'চলমান' : loan.status === 'paid' ? 'পরিশোধিত' : loan.status === 'rejected' ? 'বাতিল' : 'পেন্ডিং'}
                                </span>
                                <span className="text-[9.5px] text-zinc-400 font-mono mt-0.5 block">
                                  পরিশোধিত: {toBanglaDigits(loan.repaidCount || 0)}/{toBanglaDigits(loan.totalInstallments || 12)}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2.5 border-t border-zinc-900/40 mt-2.5 pt-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLoanId(loan.id);
                                  setEditingLoanForm({
                                    category: loan.category,
                                    amount: loan.amount,
                                    months: loan.months,
                                    status: loan.status,
                                    repaidCount: loan.repaidCount || 0,
                                    totalInstallments: loan.totalInstallments || 12
                                  });
                                  setEditingEmis(selectedUser.emiInstallments?.filter((emi: any) => emi.loanId === loan.id) || []);
                                }}
                                className="px-2.5 py-1 text-zinc-400 hover:text-[#dfc187] hover:border-zinc-800 bg-zinc-900 border border-zinc-850 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                                <span>কিস্তি ও লোন সম্পাদনা</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleDeleteLoan(loan.id)}
                                className="p-1 px-1.5 bg-zinc-900 border border-zinc-850 hover:bg-red-950 hover:text-red-300 rounded-lg text-zinc-550 transition-colors cursor-pointer"
                                title="ঋণ সম্পূর্ণরূপে মুছুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Sub Tab: Custom alert notify notifications list */}
                {userSubTab === 'logs' && (
                  <div className="flex flex-col gap-3.5 mt-1 font-sans text-xs text-zinc-300">
                    
                    {/* Notification Alerts creator form */}
                    <form onSubmit={handleSendNotice} className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 flex flex-col gap-2.5 text-xs text-zinc-350">
                      <span className="text-[10px] font-bold text-[#dfc187] uppercase tracking-wide flex items-center gap-1.5 font-sans">
                        <Bell className="w-3.5 h-3.5 text-[#dfc187]" />
                        গ্রাহককে পুশ নোটিফিকেশন / সতর্কতা বার্তা প্রেরণ করুন
                      </span>

                      <div className="flex flex-col gap-2">
                        <div>
                          <label className="text-[9px] text-zinc-500 block mb-0.5">টাইপ / সতর্কতা বার্তা লেভেল</label>
                          <select
                            value={newNoticeForm.type}
                            onChange={(e) => setNewNoticeForm({ ...newNoticeForm, type: e.target.value as any })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 focus:outline-none text-white font-sans"
                          >
                            <option value="info">তথ্যমূলক (Info - Blue)</option>
                            <option value="success">সুখবর সফলতা (Success - Green)</option>
                            <option value="warn">জরুরি নোটিশ সতর্কতা (Warning - Yellow/Red)</option>
                            <option value="loan">ঋণ সংক্রান্ত (Loan Action)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] text-zinc-500 block mb-0.5">নোটিফিকেশন টাইটেল (Title)</label>
                          <input
                            type="text"
                            required
                            value={newNoticeForm.title}
                            onChange={(e) => setNewNoticeForm({ ...newNoticeForm, title: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-805 rounded-lg p-1.5 text-white focus:outline-none placeholder-zinc-600"
                            placeholder="যেমন: সঞ্চয় আমানত রিসিভড"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] text-zinc-500 block mb-0.5">মেসেজ বডি সতর্কবার্তা (Body)</label>
                          <textarea
                            rows={2}
                            required
                            value={newNoticeForm.body}
                            onChange={(e) => setNewNoticeForm({ ...newNoticeForm, body: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-805 rounded-lg p-1.5 text-white focus:outline-none placeholder-zinc-600"
                            placeholder="যেমন: আপনার ঋণ পরিশোধের কিস্তি সফলভাবে গ্রহণ করা হয়েছে।"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2 bg-[#c5a059] text-zinc-950 font-bold rounded-lg text-xs"
                      >
                        নোটিফিকেশন নোটিশ সতর্কবার্তা পাঠান
                      </button>
                    </form>

                    {/* Historical alerts notifications */}
                    <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-zinc-400 block mb-2 uppercase">পূর্বে পাঠানো বিজ্ঞপ্তিসমূহ ({toBanglaDigits(selectedUser.notifications?.length || 0)})</span>
                      <div className="max-h-[140px] overflow-y-auto divide-y divide-zinc-900/60 no-scrollbar text-[11px] leading-relaxed">
                        {(!selectedUser.notifications || selectedUser.notifications.length === 0) ? (
                          <div className="py-2.5 text-center text-zinc-650 italic">কোনো নোটিফিকেশন পাঠানো হয়নি।</div>
                        ) : (
                          selectedUser.notifications.map((notif: any, i: number) => (
                            <div key={i} className="py-2.5 flex flex-col gap-0.5">
                              <div className="flex justify-between items-center font-bold">
                                <span className={`text-[10px] ${notif.type === 'warn' ? 'text-rose-400' : notif.type === 'success' ? 'text-emerald-400' : 'text-[#dfc187]'}`}>{notif.title}</span>
                                <span className="text-[8px] text-zinc-600 font-sans">{notif.timeLabel || 'এইমাত্র'}</span>
                              </div>
                              <p className="text-zinc-400 text-[10px] mt-0.5">{notif.body}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* MFA and security logs of the user */}
                    <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-zinc-400 block mb-2 uppercase">নিরাপত্তা লগ ফোল্ডার (MFA Security Logs)</span>
                      <div className="max-h-[140px] overflow-y-auto divide-y divide-zinc-900/60 no-scrollbar text-[9.5px] font-mono leading-relaxed text-zinc-500">
                        {(!selectedUser.securityLogs || selectedUser.securityLogs.length === 0) ? (
                          <div className="py-2 text-center italic text-zinc-650">কোনো নিরাপত্তা ইভেন্ট রেকর্ড নেই।</div>
                        ) : (
                          selectedUser.securityLogs.map((log: any, i: number) => (
                            <div key={i} className="py-1.5 flex flex-col gap-0.5">
                              <div className="flex justify-between items-center text-zinc-450 font-bold">
                                <span className={`text-[10px] ${log.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>{log.eventType} ({log.status.toUpperCase()})</span>
                                <span className="text-[8.5px] text-zinc-600">{log.timestamp}</span>
                              </div>
                              <p className="text-zinc-400">{log.details}</p>
                              <span className="text-[8px] text-zinc-600">আইপি: {toBanglaDigits(log.ip)} | ডিভাইস: {log.userAgent}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* List Table of users */}
            <div className="bg-[#121215] border border-zinc-850 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-zinc-850 bg-zinc-900/30 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-sans">নিবন্ধিত গ্রাহক তালিকা ({toBanglaDigits(filteredUsers.length)})</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-900/30 text-[9px] font-semibold text-emerald-400 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>রিয়েল-টাইম ডাটা সিঙ্ক সক্রিয়</span>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-550 font-sans">তালিকা থেকে সরাসরি গ্রাহকের তথ্য বা লেনদেন সম্পাদন করুন</span>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 text-xs font-serif italic">
                  উক্ত নাম বা মোবাইল নম্বরে কোনো ভ্যালিড গ্রাহক ডাটা পাওয়া যায়নি।
                </div>
              ) : (
                <div className="overflow-x-auto select-text">
                  <table className="w-full text-left border-collapse text-xs font-sans min-w-[750px]">
                    <thead>
                      <tr className="border-b border-zinc-850 text-zinc-500 font-bold bg-zinc-950/25">
                        <th className="py-3 px-4">গ্রাহকের পরিচিতি</th>
                        <th className="py-3 px-4">যোগাযোগ ও অ্যাকাউন্ট</th>
                        <th className="py-3 px-4">নিরাপত্তা পিন</th>
                        <th className="py-3 px-4 text-right">সঞ্চয় ব্যালেন্স</th>
                        <th className="py-3 px-4 text-center">বিলিং অবস্থা</th>
                        <th className="py-3 px-4 text-right">নিয়ন্ত্রণ প্যানেল সংশোধনসমূহ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {filteredUsers.map((u) => {
                        const isCurrentlySelected = selectedUser?.phone === u.phone;
                        return (
                          <tr
                            key={u.phone}
                            onClick={() => {
                              setSelectedUser(u);
                              setAdjustBalanceVal(Number(u.savingsBalance || 0));
                            }}
                            className={`hover:bg-zinc-900/25 transition-all cursor-pointer group ${
                              isCurrentlySelected ? 'bg-[#c5a059]/5 border-l-2 border-l-[#c5a059]' : ''
                            }`}
                          >
                            {/* Avatar & Name */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={u.avatarUrl}
                                  alt="Avatar"
                                  className="w-8 h-8 rounded-full border border-zinc-800 object-cover"
                                />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white group-hover:text-[#dfc187] transition-colors">{u.name}</span>
                                    {u.isVerified ? (
                                      <span className="w-3.5 h-3.5 bg-emerald-950/60 border border-emerald-900/50 rounded-full flex items-center justify-center text-emerald-400" title="ভেরিফাইড">
                                        <Check className="w-2 h-2 stroke-[3px]" />
                                      </span>
                                    ) : (
                                      <span className="w-3.5 h-3.5 bg-amber-950/60 border border-amber-900/50 rounded-full flex items-center justify-center text-amber-500" title="আনভেরিফাইড">
                                        <X className="w-2 h-2 stroke-[3px]" />
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-amber-400/85 font-sans mt-0.5">
                                    বয়স: {getAccountAgeLabel(u.createdAt)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Mobile & Account Code */}
                            <td className="py-3 px-4 font-mono text-zinc-450">
                              <p className="font-semibold text-zinc-300">{toBanglaDigits(u.phone)}</p>
                              <p className="text-[10px] text-zinc-550">অ্যাকাউন্ট: {toBanglaDigits(u.accountNo)}</p>
                            </td>

                            {/* Security PIN */}
                            <td className="py-3 px-4 font-mono">
                              <span className="bg-zinc-950/60 border border-zinc-900 px-2 py-0.5 rounded text-[#dfc187] font-semibold text-[11px]">
                                {u.pin}
                              </span>
                            </td>

                            {/* Savings Balance */}
                            <td className="py-3 px-4 text-right">
                              <span className="font-mono font-bold text-emerald-400 block text-xs">
                                ৳ {toBanglaDigits((u.savingsBalance || 0).toLocaleString())}
                              </span>
                              <span className="text-[9px] text-[#c5a059] font-sans">সঞ্চয় হিসেব</span>
                            </td>

                            {/* Verification State */}
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9.5px] font-semibold border ${
                                u.isVerified 
                                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' 
                                  : 'bg-amber-950/20 border-amber-900/40 text-amber-500'
                              }`}>
                                {u.isVerified ? 'সক্রিয় গ্রাহক' : 'অসম্পূর্ণ ভেরিফিকেশন'}
                              </span>
                            </td>

                            {/* Direct Actions control cabinet */}
                            <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => selectUserAndSubTab(u, 'profile')}
                                  className="p-1 px-2.5 bg-zinc-900 hover:bg-[#c5a059]/15 border border-zinc-800 hover:border-[#c5a059]/30 text-[#dfc187] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                  title="প্রোফাইল সম্পাদন"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span className="text-[9.5px] font-bold">এডিট</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => selectUserAndSubTab(u, 'transactions')}
                                  className="p-1 px-2.5 bg-zinc-900 hover:bg-emerald-950/20 border border-zinc-800 hover:border-emerald-900/30 text-emerald-400 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                  title="লেনদেন খাতা"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span className="text-[9.5px] font-bold">লেনদেন</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => selectUserAndSubTab(u, 'loans')}
                                  className="p-1 px-2 bg-zinc-900 hover:bg-blue-950/20 border border-zinc-800 hover:border-blue-900/30 text-blue-400 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                  title="ঋণ ক্যাবিনেট"
                                >
                                  <Landmark className="w-3 h-3" />
                                  <span className="text-[9.5px] font-bold font-sans">ঋণ</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => selectUserAndSubTab(u, 'logs')}
                                  className="p-1 bg-zinc-900 hover:bg-amber-950/20 border border-zinc-800 hover:border-amber-900/30 text-amber-500 rounded-lg transition-all cursor-pointer"
                                  title="বিজ্ঞপ্তি ও সতর্কবার্তা প্রেরণ"
                                >
                                  <Bell className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.phone)}
                                  className="p-1 bg-zinc-900 hover:bg-red-950 hover:text-red-300 border border-zinc-800 hover:border-red-900 text-zinc-550 rounded-lg transition-all cursor-pointer"
                                  title="অ্যাকাউন্ট মুছুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ===================== TAB 3: PENDING LOAN APPROVALS ===================== */}
        {activeTab === 'loans' && (
          <div className="flex flex-col gap-4">
            
            <div className="bg-[#121215] border border-zinc-850 rounded-2xl overflow-hidden">
              <div className="p-3 border-b border-zinc-850 bg-zinc-900/30 flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans">ঝুলন্ত আবেদনসমূহ ({toBanglaDigits(pendingLoans.length)})</span>
                <span className="text-[9px] text-[#c5a059] font-semibold italic">অ্যাডমিন রিভিউ আবশ্যক</span>
              </div>

              {pendingLoans.length === 0 ? (
                <div className="p-10 text-center text-zinc-500 text-xs font-serif italic flex flex-col items-center gap-2">
                  <FileCheck className="w-8 h-8 text-zinc-700" />
                  <span>বর্তমানে কোনো ঋণ আবেদন রিভিউয়ের জন্য পেন্ডিং নেই!</span>
                </div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {pendingLoans.map(({ user: u, loan }) => (
                    <div key={loan.id} className="p-4 flex flex-col gap-3 hover:bg-zinc-900/10">
                      
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.avatarUrl}
                            alt="Applicant"
                            className="w-8 h-8 rounded-full border border-zinc-850 object-cover"
                          />
                          <div>
                            <h5 className="text-xs font-bold text-white font-sans">{u.name}</h5>
                            <p className="text-[9px] text-zinc-500">মোবাইল: {toBanglaDigits(u.phone)} | এনআইডি ভেরিফাইড</p>
                          </div>
                        </div>

                        <span className="bg-amber-950/30 border border-amber-900/40 text-amber-400 text-[9px] px-2 py-0.5 rounded-full font-bold">
                          Pending Approval
                        </span>
                      </div>

                      {/* Loan request particulars */}
                      <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-sans">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">ঋণের ধরণ</span>
                          <span className="font-bold text-[#dfc187] text-[11px]">{loan.categoryBangla}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">আবেদনের পরিমাণ</span>
                          <span className="font-bold text-zinc-200 font-mono">৳ {toBanglaDigits(loan.amount.toLocaleString())}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">মেয়াদ ও সুদের হার</span>
                          <span className="font-bold text-zinc-300 font-sans">{toBanglaDigits(loan.months)} মাস ({toBanglaDigits(loan.interestRate)}%)</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">মাসিক কিস্তি (EMI)</span>
                          <span className="font-bold text-zinc-200 font-mono">৳ {toBanglaDigits(loan.emiAmount.toLocaleString())}</span>
                        </div>
                      </div>

                      {/* Dynamic Uploaded Verification Dossier */}
                      <div className="border border-zinc-900/60 bg-zinc-950/40 rounded-xl p-3.5 flex flex-col gap-3 font-sans">
                        <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
                          <FileText className="w-4 h-4 text-[#c5a059]" />
                          <span className="text-[10.5px] font-bold text-zinc-300 uppercase tracking-tight">আবেদনকারীর আপলোডকৃত নথিসমূহ ও প্রমাণপত্র</span>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                          {/* 1. Applicant Selfie */}
                          <div className="bg-zinc-900/40 p-2 border border-zinc-900 rounded-lg flex flex-col gap-1.5 items-center">
                            <span className="text-[9.5px] font-bold text-zinc-400">১. আবেদনকারীর সেলফি</span>
                            <div 
                              onClick={() => {
                                const url = loan.selfieUrl || u.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260";
                                setPreviewDocUrl(url);
                                setPreviewDocTitle(`${u.name} - সেলফি`);
                              }}
                              className="w-full aspect-[4/3] rounded overflow-hidden border border-zinc-850 hover:border-[#c5a059]/50 bg-zinc-950/80 flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-[#c5a059]/5 transition-all duration-200 group"
                              title="ক্লিক করে বড় করে দেখুন"
                            >
                              <img 
                                src={loan.selfieUrl || u.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260"} 
                                alt="Selfie" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <span className="text-[8px] text-emerald-400 font-semibold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> সাকসেস আপলোড
                            </span>
                          </div>

                          {/* 2. NID Front */}
                          <div className="bg-zinc-900/40 p-2 border border-zinc-900 rounded-lg flex flex-col gap-1.5 items-center">
                            <span className="text-[9.5px] font-bold text-zinc-400">২. এনআইডি কার্ড (১ম ভাগ)</span>
                            <div 
                              onClick={() => {
                                const url = loan.nidFrontUrl || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350";
                                setPreviewDocUrl(url);
                                setPreviewDocTitle(`${u.name} - এনআইডি কার্ড (১ম ভাগ)`);
                              }}
                              className="w-full aspect-[4/3] rounded overflow-hidden border border-zinc-850 hover:border-[#c5a059]/50 bg-zinc-950/80 flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-[#c5a059]/5 transition-all duration-200 group"
                              title="ক্লিক করে বড় করে দেখুন"
                            >
                              <img 
                                src={loan.nidFrontUrl || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350"} 
                                alt="NID Front" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <span className="text-[8px] text-emerald-400 font-semibold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> সাকসেস আপলোড
                            </span>
                          </div>

                          {/* 3. NID Back */}
                          <div className="bg-zinc-900/40 p-2 border border-zinc-900 rounded-lg flex flex-col gap-1.5 items-center">
                            <span className="text-[9.5px] font-bold text-zinc-400">৩. এনআইডি কার্ড (২য় ভাগ)</span>
                            <div 
                              onClick={() => {
                                const url = loan.nidBackUrl || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350";
                                setPreviewDocUrl(url);
                                setPreviewDocTitle(`${u.name} - এনআইডি কার্ড (২য় ভাগ)`);
                              }}
                              className="w-full aspect-[4/3] rounded overflow-hidden border border-zinc-850 hover:border-[#c5a059]/50 bg-zinc-950/80 flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-[#c5a059]/5 transition-all duration-200 group"
                              title="ক্লিক করে বড় করে দেখুন"
                            >
                              <img 
                                src={loan.nidBackUrl || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350"} 
                                alt="NID Back" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <span className="text-[8px] text-emerald-400 font-semibold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> সাকসেস আপলোড
                            </span>
                          </div>

                          {/* 4. Income Proof info */}
                          <div className="bg-zinc-900/40 p-2 border border-zinc-900 rounded-lg flex flex-col gap-1.5 items-center">
                            <span className="text-[9.5px] font-bold text-zinc-400">৪. আয়ের উৎস প্রমাণ</span>
                            <div 
                              onClick={() => {
                                const url = loan.incomeProofUrl || "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&q=80&w=350";
                                setPreviewDocUrl(url);
                                setPreviewDocTitle(`${u.name} - আয়ের উৎস প্রমাণ`);
                              }}
                              className="w-full aspect-[4/3] rounded overflow-hidden border border-zinc-850 hover:border-[#c5a059]/50 bg-zinc-950/80 flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-[#c5a059]/5 transition-all duration-200 group"
                              title="ক্লিক করে বড় করে দেখুন"
                            >
                              <img 
                                src={loan.incomeProofUrl || "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&q=80&w=350"} 
                                alt="Income Proof" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <span className="text-[8.5px] text-[#dfc187] font-semibold text-center mt-0.5 block">
                              কর্মসংস্থান ও বেতন স্টেটমেন্ট
                            </span>
                          </div>

                          {/* 5. Address proof info */}
                          <div className="bg-zinc-900/40 p-2 border border-zinc-900 rounded-lg flex flex-col gap-1.5 items-center">
                            <span className="text-[9.5px] font-bold text-zinc-400">৫. ঠিকানার প্রমাণ কপি</span>
                            <div 
                              onClick={() => {
                                const url = loan.addressProofUrl || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350";
                                setPreviewDocUrl(url);
                                setPreviewDocTitle(`${u.name} - ঠিকানার প্রমাণ কপি`);
                              }}
                              className="w-full aspect-[4/3] rounded overflow-hidden border border-zinc-850 hover:border-[#c5a059]/50 bg-zinc-950/80 flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-[#c5a059]/5 transition-all duration-200 group"
                              title="ক্লিক করে বড় করে দেখুন"
                            >
                              <img 
                                src={loan.addressProofUrl || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350"} 
                                alt="Address Utility Proof" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <span className="text-[8.5px] text-[#c5a059] font-bold uppercase mt-0.5" title="ডকুমেন্টের ধরণ">
                              {
                                loan.addressProofType === 'electricity' ? 'বিদ্যুৎ বিল' :
                                loan.addressProofType === 'gas' ? 'গ্যাস বিল' :
                                loan.addressProofType === 'tax_receipt' ? 'ট্যাক্স রশিদ' :
                                loan.addressProofType === 'water' ? 'পানির বিল' :
                                loan.addressProofType === 'internet' ? 'ইন্টারনেট বিল' :
                                loan.addressProofType === 'rent' ? 'ভাড়া চুক্তিপত্র' : 'বিদ্যুৎ বিল'
                              } ভেরিফিকেশন
                            </span>
                          </div>
                        </div>

                        {/* Extra metadata audit credentials */}
                        <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-900 text-[10px] grid grid-cols-1 md:grid-cols-3 gap-2 text-zinc-400">
                          <div>
                            <span className="text-zinc-500">অনন্য রিকোয়েস্ট আইডি:</span> <span className="font-mono font-bold text-zinc-300 ml-1">{loan.id}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">গ্রাহকের সঞ্চয় ব্যালেন্স:</span> <span className="font-mono font-medium text-emerald-400 ml-1">৳ {toBanglaDigits((u.savingsBalance || 0).toLocaleString())}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">আবেদনের তারিখ সময়:</span> <span className="text-zinc-300 ml-1 font-mono">{toBanglaDigits(loan.date || '০৯ জুন, ২০২৬')}{getLoanRelativeTimeLabel(loan.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Approve / Reject Controls */}
                      <div className="flex items-center gap-2.5 mt-1 self-end">
                        <button
                          onClick={() => handleUpdateLoanStatus(u.phone, loan.id, 'rejected')}
                          disabled={actionLoading}
                          className="px-3.5 py-1.5 border border-red-900/40 hover:bg-red-950/30 text-red-400 rounded-xl text-[10.5px] font-bold cursor-pointer transition-colors"
                        >
                          আবেদন বাতিল করুন
                        </button>
                        <button
                          onClick={() => handleUpdateLoanStatus(u.phone, loan.id, 'approved')}
                          disabled={actionLoading}
                          className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-xl text-[10.5px] font-bold cursor-pointer transition-colors flex items-center gap-1 focus:outline-none"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3px]" />
                          <span>ঋণ অনুমোদন করুন</span>
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approved Loans reference display table */}
            <div className="bg-[#121215] border border-zinc-850 rounded-2xl overflow-hidden mt-2">
              <div className="p-3 border-b border-zinc-850 bg-zinc-900/30">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans">চলমান অনুমোদিত ঋণসমূহ ({toBanglaDigits(activeLoans.length)})</span>
              </div>

              {activeLoans.length === 0 ? (
                <div className="p-6 text-center text-zinc-600 text-xs italic">
                  কোনো বিতরণকৃত ঋণ বর্তমানে সক্রিয় নেই।
                </div>
              ) : (
                <div className="divide-y divide-zinc-900 max-h-[250px] overflow-y-auto no-scrollbar">
                  {activeLoans.map(({ user: u, loan }) => (
                    <div key={loan.id} className="p-3 flex items-center justify-between text-xs hover:bg-zinc-900/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-200 font-sans">{u.name}</span>
                          <span className="text-[9px] bg-emerald-950/10 text-emerald-400 font-mono scale-90 border border-emerald-900/10 px-1 py-0.2 rounded">APPROVED</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-sans mt-0.5">{loan.categoryBangla} | আইডি: {loan.id} | পরিশোধিত কিস্তি: {toBanglaDigits(loan.repaidCount)}/{toBanglaDigits(loan.totalInstallments)}</p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-white font-mono">৳ {toBanglaDigits(loan.amount.toLocaleString())}</span>
                        <p className="text-[9px] text-zinc-500 font-sans mt-0.5">বিতরণকৃত ফান্ড</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ===================== TAB 4: SUB ADMIN MANAGEMENT (Main Admin Only!) ===================== */}
        {activeTab === 'admins' && (
          <div className="flex flex-col gap-4">
            
            {/* Operator authorization validation banner */}
            {operator.role !== 'main_admin' ? (
              <div className="bg-[#1a1412] border border-red-950 p-4.5 rounded-2xl flex flex-col gap-2 text-zinc-300">
                <ShieldAlert className="w-8 h-8 text-red-400 mb-1" />
                <h5 className="text-xs font-bold text-red-400 uppercase tracking-wider font-sans">সীমাবদ্ধ অ্যাক্সেস (Main Admin Required)</h5>
                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                  দুঃখিত, আপনি এই মুহূর্তে একজন <strong>সহকারী সাব-অ্যাডমিন</strong> হিসেবে লগইন আছেন। সিকিউরিটি প্রোটোকল অনুযায়ী শুধুমাত্র মেইন অ্যাডমিন (Main Admin) সাব-অ্যাডমিন তৈরি, মুছতে বা তাদের অ্যাকাউন্টের পিন কোড এডজাস্ট করার সুবিধা পাবেন।
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                
                {/* Save sub admin actions button */}
                <button
                  onClick={() => {
                    setSubAdminForm({ name: '', phone: '', pin: '', isEditing: false, oldPhone: '' });
                    setShowSubAdminModal(true);
                  }}
                  className="w-full bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4 stroke-[2.5px]" />
                  <span>নতুন সহকারী সাব-অ্যাডমিন যুক্ত করুন</span>
                </button>

                {/* Create/Edit Sub-Admin Overlay Inner Form */}
                {showSubAdminModal && (
                  <form onSubmit={handleSaveSubAdmin} className="bg-[#121215] border border-[#c5a059]/20 rounded-2xl p-4 flex flex-col gap-3.5 font-sans">
                    <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                      <h4 className="text-xs font-bold text-[#c5a059] uppercase tracking-wider font-sans flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4" />
                        {subAdminForm.isEditing ? 'অ্যাডমিন তথ্য এডিট করুন' : 'নতুন অ্যাডমিন ফরম'}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowSubAdminModal(false)}
                        className="text-zinc-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">পুরো নাম (বাংলায়)</label>
                        <input
                          type="text"
                          required
                          value={subAdminForm.name}
                          onChange={(e) => setSubAdminForm({ ...subAdminForm, name: e.target.value })}
                          placeholder="যেমন: মোঃ জসীম উদ্দিন"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-sans focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">অ্যাডমিন রোল (Role Selection)</label>
                        <select
                          value={subAdminForm.role}
                          onChange={(e) => setSubAdminForm({ ...subAdminForm, role: e.target.value as any })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-sans focus:outline-none"
                        >
                          <option value="sub_admin">সহকারী সাব-অ্যাডমিন (Sub Admin)</option>
                          <option value="main_admin">মেইন অ্যাডমিন (Main Admin)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">মোবাইল নম্বর (১১ ডিজিট)</label>
                        <input
                          type="tel"
                          required
                          maxLength={11}
                          disabled={subAdminForm.isEditing}
                          value={subAdminForm.phone}
                          onChange={(e) => setSubAdminForm({ ...subAdminForm, phone: e.target.value.replace(/[^0-9]/g, '') })}
                          placeholder="01XXXXXXXXX"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none disabled:opacity-40"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">লগইন পিন / সিকিউরিটি PIN</label>
                        <input
                          type="password"
                          required
                          maxLength={6}
                          value={subAdminForm.pin}
                          onChange={(e) => setSubAdminForm({ ...subAdminForm, pin: e.target.value.replace(/[^0-9]/g, '') })}
                          placeholder="যেমন: ১২৩৪"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono tracking-widest focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full bg-zinc-850 hover:bg-[#c5a059] hover:text-zinc-950 py-2.5 rounded-xl text-xs font-bold transition-all transition-colors cursor-pointer"
                    >
                      {actionLoading ? 'সেভ করা হচ্ছে...' : 'অ্যাডমিন তথ্য সংরক্ষণ করুন'}
                    </button>
                  </form>
                )}

              </div>
            )}

            {/* List Table of directors */}
            <div className="bg-[#121215] border border-zinc-850 rounded-2xl overflow-hidden">
              <div className="p-3 border-b border-zinc-850 bg-zinc-900/30">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans block">সিস্টেমের মোট অ্যাডমিন প্যানেল তালিকা</span>
              </div>

              <div className="divide-y divide-zinc-900 font-sans">
                {/* Main Admin list */}
                {mainAdmins.map((ma) => (
                  <div key={ma.phone} className="p-3.5 flex items-center justify-between hover:bg-zinc-900/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-[#c5a059] flex items-center justify-center text-zinc-950 font-black text-xs">
                        M
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white flex items-center gap-1">
                          <span>{ma.name}</span>
                          <span className="bg-[#c5a059]/10 text-[#dfc187] text-[8px] font-bold px-1.5 rounded-full uppercase">Super</span>
                        </h5>
                        <p className="text-[9.5px] text-zinc-500">
                          {ma.phone === '01700000000' && operator.phone === '01700000000'
                            ? "মূল মেইন অ্যাডমিন (অপরিবর্তনযোগ্য)" 
                            : `মেইন অ্যাডমিন | পিন: ${ma.pin || '...'}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-medium text-zinc-450 pr-2">{toBanglaDigits(ma.phone)}</span>
                      {operator.role === 'main_admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSubAdminForm({
                                name: ma.name,
                                phone: ma.phone,
                                pin: ma.pin || '',
                                role: 'main_admin',
                                isEditing: true,
                                oldPhone: ma.phone
                              });
                              setShowSubAdminModal(true);
                            }}
                            className="p-1 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:text-[#c5a059] text-xs cursor-pointer"
                            title="সম্পাদনা"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {ma.phone !== operator.phone && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSubAdmin(ma.phone)}
                              className="p-1 px-2.5 bg-zinc-900 border border-zinc-850 hover:bg-red-950/20 hover:text-red-400 rounded-lg text-xs cursor-pointer"
                              title="অ্যাডমিন অ্যাকাউন্ট মুছুন"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Sub Admins list dynamic displays */}
                {subAdmins.length === 0 ? (
                  <div className="p-6 text-center text-zinc-650 text-xs italic">
                    কোনো সহকারী সাব-অ্যাডমিন অ্যাকাউন্ট এখনো রেজিস্টার্ড করা হয়নি।
                  </div>
                ) : (
                  subAdmins.map((sa) => (
                    <div key={sa.phone} className="p-3.5 flex items-center justify-between hover:bg-[#15151a]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xs">
                          S
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-zinc-200">{sa.name}</h5>
                          <p className="text-[9.5px] text-zinc-500">মোবাইল: {toBanglaDigits(sa.phone)} | পিন: {sa.pin}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {operator.role === 'main_admin' && (
                          <>
                            <button
                              onClick={() => {
                                setSubAdminForm({
                                  name: sa.name,
                                  phone: sa.phone,
                                  pin: sa.pin || '',
                                  role: 'sub_admin',
                                  isEditing: true,
                                  oldPhone: sa.phone
                                });
                                setShowSubAdminModal(true);
                              }}
                              className="p-1 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:text-[#c5a059] text-xs cursor-pointer"
                              title="সম্পাদনা"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {sa.phone !== operator.phone && (
                              <button
                                onClick={() => handleDeleteSubAdmin(sa.phone)}
                                className="p-1 px-2.5 bg-zinc-900 border border-zinc-850 hover:bg-red-950/20 hover:text-red-400 rounded-lg text-xs cursor-pointer"
                                title="সাব-অ্যাডমিন অ্যাকাউন্ট মুছুন"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* ===================== TAB 5: WEBSITE SETTINGS AND SYSTEM CONSTANTS ===================== */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6 w-full">
            <form onSubmit={handleUpdateSettings} className="bg-[#121215] border border-zinc-850 rounded-2xl p-4.5 flex flex-col gap-4 font-sans select-none">
            <h4 className="text-xs font-bold text-[#c5a059] uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-zinc-900 pb-2">
              <Settings className="w-4.5 h-4.5" />
              সিস্টেম-ব্যাপী ওয়েবসাইট কাস্টমাইজেশন
            </h4>

            <div className="flex flex-col gap-3.5">
              
              <div>
                <label className="text-[10px] text-zinc-450 block mb-1">কোম্পানির নাম (বাংলায় হডার টাইটেল)</label>
                <input
                  type="text"
                  required
                  value={settingsForm.appName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, appName: e.target.value })}
                  placeholder="যেমন: ন্যানো-ফাইন্যান্স লিমিটেড"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#c5a059] font-bold block mb-1">স্লোগান / ক্যাচলাইন (উপ-শিরোনাম)</label>
                <input
                  type="text"
                  required
                  value={settingsForm.appSlug}
                  onChange={(e) => setSettingsForm({ ...settingsForm, appSlug: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-zinc-200 focus:outline-none focus:border-[#c5a059]/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1 border-t border-zinc-900/40">
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1">সর্বনিম্ন সঞ্চয় আমানত (টাকা)</label>
                  <input
                    type="number"
                    required
                    value={settingsForm.minDeposit}
                    onChange={(e) => setSettingsForm({ ...settingsForm, minDeposit: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1">সর্বোচ্চ সঞ্চয় আমানত (টাকা)</label>
                  <input
                    type="number"
                    required
                    value={settingsForm.maxDeposit}
                    onChange={(e) => setSettingsForm({ ...settingsForm, maxDeposit: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1">সর্বনিম্ন উত্তোলন সীমা (৳)</label>
                  <input
                    type="number"
                    required
                    value={settingsForm.minWithdraw}
                    onChange={(e) => setSettingsForm({ ...settingsForm, minWithdraw: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1">সর্বোচ্চ উত্তোলন সীমা (৳)</label>
                  <input
                    type="number"
                    required
                    value={settingsForm.maxWithdraw}
                    onChange={(e) => setSettingsForm({ ...settingsForm, maxWithdraw: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1 border-t border-zinc-900/40">
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1">ডিফল্ট বার্ষিক সুদের হার (%)</label>
                  <input
                    type="number"
                    required
                    value={settingsForm.interestRate}
                    onChange={(e) => setSettingsForm({ ...settingsForm, interestRate: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-[#dfc187] font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1">ডিপোজিট প্রিসেটস (কমা দিয়ে আলাদা করুন)</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.depositPresets || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, depositPresets: e.target.value })}
                    placeholder="যেমন: 20, 50, 100, 500"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Loan Calculator Configuration */}
              <div className="pt-2.5 mt-1 border-t border-dashed border-zinc-800/80">
                <h5 className="text-[10px] font-bold text-[#c5a059] uppercase tracking-wider mb-2.5">
                  ঋণ ক্যালকুলেটর কাস্টমাইজেশন (Dynamic Loan Simulator Settings)
                </h5>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[10px] text-zinc-455 block mb-1">ক্যালকুলেটর সর্বনিম্ন ঋণ (৳)</label>
                    <input
                      type="number"
                      required
                      value={settingsForm.minLoanAmount}
                      onChange={(e) => setSettingsForm({ ...settingsForm, minLoanAmount: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#c5a059]/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-455 block mb-1">ক্যালকুলেটর সর্বোচ্চ ঋণ (৳)</label>
                    <input
                      type="number"
                      required
                      value={settingsForm.maxLoanAmount}
                      onChange={(e) => setSettingsForm({ ...settingsForm, maxLoanAmount: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#c5a059]/40"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-[10px] text-zinc-455 block mb-1">ঋণের পরিমাণ সাজেশন প্রিসেটস (কমা দিয়ে আলাদা করুন)</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.loanAmountPresets}
                    onChange={(e) => setSettingsForm({ ...settingsForm, loanAmountPresets: e.target.value })}
                    placeholder="যেমন: 20000, 30000, 50000, 100000"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#c5a059]/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5 mt-3">
                  <div>
                    <label className="text-[10px] text-zinc-455 block mb-1">ক্যালকুলেটর সর্বনিম্ন মেয়াদ (মাস)</label>
                    <input
                      type="number"
                      required
                      value={settingsForm.minLoanMonths}
                      onChange={(e) => setSettingsForm({ ...settingsForm, minLoanMonths: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#c5a059]/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-455 block mb-1">ক্যালকুলেটর সর্বোচ্চ মেয়াদ (মাস)</label>
                    <input
                      type="number"
                      required
                      value={settingsForm.maxLoanMonths}
                      onChange={(e) => setSettingsForm({ ...settingsForm, maxLoanMonths: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#c5a059]/40"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-[10px] text-zinc-455 block mb-1">মেয়াদ সাজেশন প্রিসেটস (কমা দিয়ে আলাদা করুন)</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.loanMonthPresets}
                    onChange={(e) => setSettingsForm({ ...settingsForm, loanMonthPresets: e.target.value })}
                    placeholder="যেমন: 3, 6, 9, 12"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#c5a059]/40"
                  />
                </div>

                <div className="mt-3.5 pt-3.5 border-t border-dashed border-zinc-800/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-zinc-300 block">মিনিমাম সঞ্চয় থাকলে ঋণ আবেদন</span>
                      <span className="text-[9px] text-zinc-500 block">সদস্যের সঞ্চয় ব্যালেন্স থাকলে তবেই ঋণ আবেদন করতে পারবে কিনা</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.requireMinSavingsForLoan}
                        onChange={(e) => setSettingsForm({ ...settingsForm, requireMinSavingsForLoan: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#c5a059] peer-checked:after:bg-zinc-950"></div>
                    </label>
                  </div>

                  {settingsForm.requireMinSavingsForLoan && (
                    <div className="mt-2.5">
                      <label className="text-[10px] text-zinc-455 block mb-1">প্রয়োজনীয় সর্বনিম্ন সঞ্চয় ব্যালেন্স (৳)</label>
                      <input
                        type="number"
                        placeholder="যেমন: 500"
                        value={settingsForm.minSavingsForLoanAmount}
                        onChange={(e) => setSettingsForm({ ...settingsForm, minSavingsForLoanAmount: Number(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#c5a059]/40"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1 border-t border-zinc-900/40">
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1">বিকাশ পার্সোনাল নম্বর (Repayment)</label>
                  <input
                    type="tel"
                    required
                    maxLength={11}
                    value={settingsForm.bkashNumber}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bkashNumber: e.target.value.replace(/[^0-9]/g, '') })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1">নগদ অ্যাকাউন্ট নম্বর (Repayment)</label>
                  <input
                    type="tel"
                    required
                    maxLength={11}
                    value={settingsForm.nagadNumber}
                    onChange={(e) => setSettingsForm({ ...settingsForm, nagadNumber: e.target.value.replace(/[^0-9]/g, '') })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 pt-1 border-t border-zinc-900/40">
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1 font-sans">সহায়তা কেন্দ্র হোয়াটসঅ্যাপ নম্বর (WhatsApp Number)</label>
                  <input
                    type="tel"
                    maxLength={15}
                    value={settingsForm.whatsappNumber}
                    onChange={(e) => setSettingsForm({ ...settingsForm, whatsappNumber: e.target.value.replace(/[^0-9+]/g, '') })}
                    placeholder="e.g. 017XXXXXXXX or +88017XXXXXXXX"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1 border-t border-zinc-900/40">
                {/* bKash Custom Logo */}
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1 font-sans">বিকাশ ডায়নামিক লোগো (PNG/JPG)</label>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 flex flex-col items-center gap-2">
                    {settingsForm.bkashLogo ? (
                      <div className="relative group w-12 h-12 rounded-lg bg-pink-900/20 border border-pink-900/40 flex items-center justify-center p-1.5 overflow-hidden">
                        <img 
                          src={settingsForm.bkashLogo} 
                          alt="Custom bKash Logo" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-550 font-sans">
                        Default (ডিফল্ট)
                      </div>
                    )}
                    <div className="flex gap-1.5 w-full">
                      <label className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 py-1.5 rounded-lg text-[9px] font-bold text-center cursor-pointer border border-zinc-800 transition-colors font-sans">
                        আপলোড
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp, image/gif, .png, .jpg, .jpeg, .webp, .gif"
                          onChange={(e) => handleLogoUpload(e, 'bkash')}
                          className="hidden"
                        />
                      </label>
                      {settingsForm.bkashLogo && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLogo('bkash')}
                          className="px-2 bg-rose-950/40 text-rose-400 hover:bg-rose-900 hover:text-white rounded-lg text-[9px] font-bold border border-rose-900/30 transition-colors cursor-pointer font-sans"
                        >
                          রিসেট
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nagad Custom Logo */}
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1 font-sans">নগদ ডায়নামিক লোগো (PNG/JPG)</label>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 flex flex-col items-center gap-2">
                    {settingsForm.nagadLogo ? (
                      <div className="relative group w-12 h-12 rounded-lg bg-orange-900/20 border border-orange-900/40 flex items-center justify-center p-1.5 overflow-hidden">
                        <img 
                          src={settingsForm.nagadLogo} 
                          alt="Custom Nagad Logo" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-550 font-sans">
                        Default (ডিফল্ট)
                      </div>
                    )}
                    <div className="flex gap-1.5 w-full">
                      <label className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 py-1.5 rounded-lg text-[9px] font-bold text-center cursor-pointer border border-zinc-800 transition-colors font-sans">
                        আপলোড
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp, image/gif, .png, .jpg, .jpeg, .webp, .gif"
                          onChange={(e) => handleLogoUpload(e, 'nagad')}
                          className="hidden"
                        />
                      </label>
                      {settingsForm.nagadLogo && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLogo('nagad')}
                          className="px-2 bg-rose-950/40 text-rose-400 hover:bg-rose-900 hover:text-white rounded-lg text-[9px] font-bold border border-rose-900/30 transition-colors cursor-pointer font-sans"
                        >
                          রিসেট
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 pt-1 border-t border-zinc-900/40">
                {/* Help Center Custom Logo */}
                <div>
                  <label className="text-[10px] text-zinc-455 block mb-1 font-sans">সহায়তা কেন্দ্র কাস্টম লোগো/আইকন (PNG/JPG)</label>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 flex flex-col items-center gap-2">
                    {settingsForm.helpCenterLogo ? (
                      <div className="relative group w-12 h-12 rounded-lg bg-emerald-950/20 border border-emerald-900/40 flex items-center justify-center p-1.5 overflow-hidden font-sans">
                        <img 
                          src={settingsForm.helpCenterLogo} 
                          alt="Custom Help Center Logo" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-550 font-sans">
                        Default (ডিফল্ট - Help Icon)
                      </div>
                    )}
                    <div className="flex gap-1.5 w-full">
                      <label className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 py-1.5 rounded-lg text-[9px] font-bold text-center cursor-pointer border border-zinc-800 transition-colors font-sans">
                        আপলোড
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp, image/gif, .png, .jpg, .jpeg, .webp, .gif"
                          onChange={(e) => handleLogoUpload(e, 'helpCenter')}
                          className="hidden"
                        />
                      </label>
                      {settingsForm.helpCenterLogo && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLogo('helpCenter')}
                          className="px-2 bg-rose-950/40 text-rose-400 hover:bg-rose-900 hover:text-white rounded-lg text-[9px] font-bold border border-rose-900/30 transition-colors cursor-pointer font-sans"
                        >
                          রিসেট
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full mt-3 bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer"
            >
              {actionLoading ? 'সেটিংস সেভ করা হচ্ছে...' : 'সেটিংস স্থায়ীভাবে সংরক্ষণ করুন'}
            </button>
          </form>

          {/* ডাটাবেজ ক্লিনআপ / ডাটা ছাঁটাই (Database Cleanup / Data Pruning) */}
          <div className="bg-[#121215] border border-zinc-850 rounded-2xl p-4.5 flex flex-col gap-4 font-sans select-none">
            <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-zinc-900 pb-2">
              <Trash2 className="w-4.5 h-4.5 text-rose-500" />
              অ্যাডভান্সড ডাটাবেজ ছাঁটাই ও মেমোরি রিলিজ (Database Pruning)
            </h4>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              আপনার হোস্টিং অ্যাকাউন্টের ডাটা ব্যাকআপ সাইজ অনেক বেশি হয়ে গেলে এখান থেকে পুরাতন ট্রানজেকশন, সেশন ও ডিটেইলস ছাঁটাই করতে পারেন। এটি গ্রাহকদের মূল সঞ্চয় ব্যালেন্স বা ঋণ হিসাবের চলমান ব্যালেন্সে কোনো ক্ষতি করবে না, শুধুমাত্র পূর্বের ট্রানজেকশন, নোটিফিকেশন ও লগসমূহের ইতিহাস ক্লিয়ার করে ডেটাবেজের সাইজ খালি করবে।
            </p>

            <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 flex flex-col gap-3">
              <label className="text-[10px] text-zinc-400 block font-semibold">ছাঁটাই করার ফিল্টার অপশন সিলেক্ট করুন:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {[
                  { id: '30_days', label: '৩০ দিনের অধিক পুরাতন সকল ডাটা', desc: '৩০ দিন আগের সব লগ, ট্রানজেকশন ও সেশন ছাঁটাই হবে।' },
                  { id: '21_days', label: '২১ দিনের অধিক পুরাতন সকল ডাটা', desc: '২১ দিন আগের সব লগ, ট্রানজেকশন ও সেশন ছাঁটাই হবে।' },
                  { id: '15_days', label: '১৫ দিনের অধিক পুরাতন সকল ডাটা', desc: '১৫ দিন আগের সব লগ, ট্রানজেকশন ও সেশন ছাঁটাই হবে।' },
                  { id: '7_days', label: '৭ দিনের অধিক পুরাতন সকল ডাটা', desc: '৭ দিন আগের সব লগ, ট্রানজেকশন ও সেশন ছাঁটাই হবে।' },
                  { id: 'all', label: 'সকল হিস্টোরিকাল ডাটা ক্লিয়ার করুন', desc: 'সকল ইউজারদের পূর্বের ট্রানজেকশন, নোটিফিকেশন এবং সিকিউরিটি লগ সম্পূর্ণ ক্লিয়ার হবে।' }
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedPruneOption(option.id)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedPruneOption === option.id
                        ? 'bg-rose-950/20 border-rose-500/50 text-rose-200'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${selectedPruneOption === option.id ? 'bg-rose-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                      {option.label}
                    </span>
                    <span className="text-[9.5px] text-zinc-500 mt-1">{option.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowPruneConfirm(true)}
                className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-900/50 hover:border-rose-700 py-3 px-5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                ডাটা ছাঁটাই প্রসেস শুরু করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION POPUP FOR PRUNING */}
      {showPruneConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-rose-900/40 w-full max-w-md rounded-2xl p-5 flex flex-col gap-4 text-xs font-sans text-zinc-300 select-none">
            <div className="flex items-center gap-2.5 border-b border-rose-950/20 pb-3">
              <AlertTriangle className="w-6 h-6 text-rose-500 animate-bounce" />
              <div>
                <h4 className="text-sm font-bold text-rose-200">আপনি কি নিশ্চিত? চূড়ান্ত ডাটা রিমুভাল সতর্কতা!</h4>
                <p className="text-[10px] text-zinc-500">This action is irreversible and permanent.</p>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed bg-rose-950/10 p-3 rounded-lg border border-rose-950/30">
              আপনি <strong className="text-rose-400">
                {selectedPruneOption === '30_days' && '৩০ দিনের অধিক পুরাতন'}
                {selectedPruneOption === '21_days' && '২১ দিনের অধিক পুরাতন'}
                {selectedPruneOption === '15_days' && '১৫ দিনের অধিক পুরাতন'}
                {selectedPruneOption === '7_days' && '৭ দিনের অধিক পুরাতন'}
                {selectedPruneOption === 'all' && 'সকল হিস্টোরিকাল'}
              </strong> ডাটা ডিলিট করতে যাচ্ছেন। অনুগ্রহ করে মনে রাখবেন গ্রাহকের মূল সঞ্চয় একাউন্ট ব্যালেন্স এবং ঋণ একাউন্টের প্রধান তথ্য ঠিক থাকবে কিন্তু ডিলিট হওয়া সময়ের আগের কোনো ট্রানজেকশন তালিকা আর দেখা যাবে না।
            </p>

            <div className="flex justify-end gap-2.5 border-t border-zinc-900/50 pt-3.5">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowPruneConfirm(false)}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl transition-colors font-semibold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handlePruneData}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? 'ডাটা প্রুনিং করা হচ্ছে...' : 'হ্যাঁ, ডিলিট নিশ্চিত করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* ===================== TAB 6: ANDROID MONITOR SIMULATOR ===================== */}
        {activeTab === 'android' && (
          <AndroidSimulator />
        )}

        {/* Create New User Modal Backdrop & Card */}
        {showCreateUserModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleCreateUser} className="bg-[#121215] border border-zinc-800 w-full max-w-md rounded-2xl p-5 flex flex-col gap-4 text-xs font-sans text-zinc-300">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                <h4 className="text-sm font-bold text-[#c5a059] flex items-center gap-1.5 font-serif italic">
                  <UserPlus className="w-5 h-5 text-[#c5a059]" />
                  নতুন গ্রাহক একাউন্ট ফরম
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">গ্রাহকের পুরো নাম (বাংলায়)</label>
                  <input
                    type="text"
                    required
                    value={createUserForm.name}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, name: e.target.value })}
                    placeholder="যেমন: মোঃ কামরুল হাসান"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-[#c5a059]/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">মোবাইল নম্বর (১১ ডিজিট)</label>
                    <input
                      type="tel"
                      required
                      maxLength={11}
                      value={createUserForm.phone}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, phone: e.target.value.replace(/[^0-9]/g, '') })}
                      placeholder="যেমন: 01712345678"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:outline-none focus:border-[#c5a059]/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#c5a059] font-bold block mb-1">নিরাপত্তা পিন (৪ বা ৬ ডিজিট)</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={createUserForm.pin}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, pin: e.target.value.replace(/[^0-9]/g, '') })}
                      placeholder="যেমন: ১২৩৪"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">প্রাথমিক সঞ্চয় আমানত (৳)</label>
                    <input
                      type="number"
                      value={createUserForm.savingsBalance}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, savingsBalance: Math.max(0, Number(e.target.value)) })}
                      placeholder="যেমন: ৫০০"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:outline-none focus:border-[#c5a059]/40"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-4 pl-1.5">
                    <input
                      type="checkbox"
                      id="isVerified"
                      checked={createUserForm.isVerified}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, isVerified: e.target.checked })}
                      className="w-4.5 h-4.5 accent-[#c5a059] rounded cursor-pointer"
                    />
                    <label htmlFor="isVerified" className="text-[10.5px] font-semibold text-zinc-350 cursor-pointer">ভেরিফাইড অ্যাকাউন্ট</label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full mt-2 bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 py-3 rounded-xl font-bold text-xs"
              >
                গ্রাহক ক্রিয়েট করুন
              </button>
            </form>
          </div>
        )}

        {/* Custom Confirmation Dialog Modal (Iframe bypass & super premium UI) */}
        {confirmDialog && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in font-sans">
            <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2.5 text-amber-500">
                <span className="p-1 px-2.5 rounded-lg bg-amber-500/10 text-[9.5px] font-bold font-mono">CONFIRM</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-100">{confirmDialog.title}</h4>
              </div>
              
              <p className="text-xs text-zinc-350 leading-relaxed font-sans">
                {confirmDialog.message}
              </p>

              <div className="flex items-center gap-2.5 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 rounded-xl text-[11px] font-semibold cursor-pointer transition-all"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 bg-[#c5a059] hover:bg-[#dfc187] text-zinc-950 font-bold rounded-xl text-[11px] cursor-pointer shadow-md transition-all animate-none"
                >
                  হ্যাঁ, নিশ্চিত করুন
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Active Users Details Directory Modal (Requested by Admin) */}
        {showLiveUsersModal && (() => {
          const filteredActiveSessions = visibleActiveSessions.filter(session => {
            if (!liveSearchQuery) return true;
            const query = liveSearchQuery.toLowerCase();
            
            const clientMatch = session.clientId?.toLowerCase().includes(query);
            const phoneMatch = session.phone?.includes(query);
            const roleMatch = session.role?.toLowerCase().includes(query);
            
            let dbMatch = false;
            if (session.userDetails) {
              dbMatch = 
                session.userDetails.name?.toLowerCase().includes(query) ||
                session.userDetails.phone?.includes(query) ||
                session.userDetails.accountNo?.includes(query);
            }
            
            return clientMatch || phoneMatch || roleMatch || dbMatch;
          });

          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in font-sans">
              <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </div>
                    <h3 className="text-xs font-bold text-[#c5a059] uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-4 h-4" />
                      অনলাইন সক্রিয় গ্রাহক তালিকা ({toBanglaDigits(visibleActiveSessions.length)})
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowLiveUsersModal(false);
                      setLiveSearchQuery('');
                    }}
                    className="p-1 px-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Live Search box inside modal */}
                <div className="relative">
                  <Search className="absolute left-3 w-3.5 h-3.5 text-zinc-550" style={{ transform: 'translateY(11px)', left: '12px' }} />
                  <input
                    type="text"
                    placeholder="নাম, মোবাইল বা অ্যাকাউন্ট নাম্বার দিয়ে খুঁজুন..."
                    value={liveSearchQuery}
                    onChange={(e) => setLiveSearchQuery(e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-zinc-850 focus:border-zinc-700 rounded-xl py-2 px-3 pl-9 text-[11.5px] text-zinc-300 placeholder-zinc-650 focus:outline-none focus:ring-0 transition-all font-sans"
                  />
                </div>

                {/* List of active sessions */}
                <div className="overflow-y-auto pr-1 flex flex-col gap-2.5 max-h-[50vh] min-h-[150px] scrollbar-thin scrollbar-thumb-zinc-800">
                  {filteredActiveSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-1">
                      <Users className="w-8 h-8 text-zinc-850" />
                      <p className="text-xs text-zinc-500 font-sans mt-2">কোনো সক্রিয় সেশন বা ম্যাচিং রেকর্ড পাওয়া যায়নি!</p>
                    </div>
                  ) : (
                    filteredActiveSessions.map((session, index) => {
                      const elapsedSec = Math.max(0, Math.floor((Date.now() - session.lastActive) / 1000));
                      const u = session.userDetails;
                      
                      return (
                        <div 
                          key={session.clientId || index}
                          className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all duration-205"
                        >
                          <div className="flex items-start gap-2.5">
                            {/* Profile Circle status */}
                            <div className="relative mt-0.5 select-none">
                              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-400 font-bold text-xs uppercase font-sans">
                                {u?.name ? u.name.substring(0, 1) : (session.role === 'visitor' ? 'V' : 'A')}
                              </div>
                              <span className="absolute bottom-0 right-0 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                            </div>

                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs font-bold text-zinc-100 font-sans">
                                  {u?.name || (session.role === 'visitor' ? 'গেস্ট ভিজিটর' : 'অফিসিয়াল অ্যাডমিন')}
                                </h4>
                                
                                {/* Role Badges */}
                                {session.role === 'main_admin' && (
                                  <span className="bg-amber-500/10 text-[#c5a059] border border-[#c5a059]/15 px-1.5 py-0.2 rounded text-[7.5px] font-bold font-sans uppercase">
                                    মেইন অ্যাডমিন
                                  </span>
                                )}
                                {session.role === 'sub_admin' && (
                                  <span className="bg-[#c5a059]/10 text-[#dfc187] border border-[#c5a059]/10 px-1.5 py-0.2 rounded text-[7.5px] font-bold font-sans uppercase">
                                    অ্যাডমিন
                                  </span>
                                )}
                                {session.role === 'user' && (
                                  <span className="bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 px-1.5 py-0.2 rounded text-[7.5px] font-bold font-sans uppercase">
                                    গ্রাহক
                                  </span>
                                )}
                                {session.role === 'visitor' && (
                                  <span className="bg-zinc-900 text-zinc-550 border border-zinc-850 px-1.5 py-0.2 rounded text-[7.5px] font-bold font-sans uppercase">
                                    ভিজিটর
                                  </span>
                                )}
                              </div>

                              {/* Details of standard user */}
                              {u ? (
                                <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                                  মোবাইল: <span className="font-mono text-zinc-300 font-medium">{toBanglaDigits(u.phone)}</span> | অ্যাকাউন্ট: <span className="font-mono text-[#c5a059] font-medium">{toBanglaDigits(u.accountNo)}</span>
                                </p>
                              ) : session.phone ? (
                                <p className="text-[10px] text-zinc-400 font-sans">
                                  মোবাইল: <span className="font-mono text-zinc-300 font-medium">{toBanglaDigits(session.phone)}</span>
                                </p>
                              ) : (
                                <p className="text-[9px] text-zinc-600 font-mono">
                                  সেশন আইডি: {session.clientId?.substring(0, 12)}...
                                </p>
                              )}

                              {u && (
                                <p className="text-[9.5px] text-emerald-400/90 font-sans mt-0.5">
                                  ব্যালেন্স: ৳ {toBanglaDigits((u.savingsBalance || 0).toLocaleString())} ({u.isVerified ? 'ভেরিফাইড' : 'অযাচাইকৃত'})
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Recency metric & actions */}
                          <div className="flex sm:flex-col items-end gap-1.5 w-full sm:w-auto justify-between sm:justify-start pt-2 sm:pt-0 border-t border-zinc-900/60 sm:border-0 ml-auto">
                            <span className="text-[8px] text-zinc-500 font-mono bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-850">
                              {elapsedSec < 3 ? 'active' : `${toBanglaDigits(elapsedSec)}s ago`}
                            </span>

                            {session.role === 'user' && u && (
                              <button
                                onClick={() => {
                                  const matched = users.find(usr => usr.phone === u.phone);
                                  if (matched) {
                                    setSelectedUser(matched);
                                    setActiveTab('users');
                                    setShowLiveUsersModal(false);
                                    setLiveSearchQuery('');
                                  } else {
                                    alert("গ্রাহকের প্রোফাইল ডাটা পাওয়া যায়নি!");
                                  }
                                }}
                                className="px-2 py-1 bg-[#c5a059]/10 hover:bg-[#c5a059]/20 border border-[#c5a059]/20 hover:border-[#c5a059]/40 text-[#dfc187] hover:text-white rounded-lg text-[9px] font-bold font-sans flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                <span>প্রোফাইল দেখুন</span>
                              </button>
                            )}

                            {operator?.role === 'main_admin' && (session.role === 'main_admin' || session.role === 'sub_admin') && (
                              <button
                                onClick={() => {
                                  setActiveTab('admins');
                                  setShowLiveUsersModal(false);
                                  setLiveSearchQuery('');
                                }}
                                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg text-[9px] font-bold font-sans flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Users className="w-3 h-3" />
                                <span>অ্যাডমিন ম্যানেজমেন্ট</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Modal footer information */}
                <div className="bg-[#0e0e11] p-2.5 rounded-xl border border-zinc-900/60 text-[9px] text-zinc-500 font-sans leading-relaxed">
                  * সচল ইউজার বা ভিজিটররা প্রতি ৩০ সেকেন্ড পর পর তাদের লাইভ সংকেত সার্ভারে আপডেট করে। ৭৫ সেকেন্ডের বেশি অনিয়মিত থাকলে সেই সেশনটি স্বয়ংক্রিয়ভাবে তালিকা থেকে সরে যায়।
                </div>

              </div>
            </div>
          );
        })()}

        {/* Document Lightbox Preview Modal */}
        {previewDocUrl && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[99999] animate-fade-in font-sans">
            {/* Modal header details */}
            <div className="w-full max-w-3xl flex justify-between items-center mb-3 text-white select-none">
              <div className="flex items-center gap-2">
                <span className="bg-[#c5a059]/15 border border-[#c5a059]/35 px-2 py-0.5 rounded-full text-[9px] font-bold text-[#dfc187] uppercase tracking-wider">
                  নথি প্রিভিউ
                </span>
                <span className="text-xs font-bold text-zinc-200">{previewDocTitle}</span>
              </div>
              
              <button
                onClick={() => {
                  setPreviewDocUrl(null);
                  setPreviewDocTitle('');
                }}
                className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-850 cursor-pointer transition-colors"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Image viewer area */}
            <div className="relative w-full max-w-3xl aspect-[4/3] sm:aspect-video rounded-3xl overflow-hidden border border-zinc-805 bg-zinc-950 flex items-center justify-center p-2 group shadow-2xl">
              <img 
                src={previewDocUrl} 
                alt={previewDocTitle} 
                className="max-w-full max-h-full object-contain rounded-2xl select-text transition-transform duration-200"
                style={{ imageRendering: 'auto' }}
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Action guides footer */}
            <p className="text-[10px] text-zinc-500 mt-4 text-center select-none leading-relaxed">
              * ভেরিফিকেশনের জন্য নথিটি জুম বা স্পষ্ট না হলে, ইমেজটি নতুন ট্যাবে ওপেন করতে রাইট-ক্লিক করতে পারেন। <br />
              কন্ট্রোল সেন্টার বন্ধ করতে বাইরের ক্রস (X) বাটনে ক্লিক করুন।
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
