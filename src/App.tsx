/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Info,
  Layers,
  Sparkles,
  Layout,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Award,
  BookOpen,
  Home,
  PiggyBank,
  Landmark,
  CreditCard,
  User as UserIcon,
  Wifi,
  Battery,
  Signal,
  Download,
  FileCode,
  ShieldCheck,
  Users
} from 'lucide-react';

import { ScreenId, User, Transaction, LoanItem, EmiInstallment, NotificationItem, PaymentMethod } from './types';
import {
  INITIAL_USER,
  INITIAL_TRANSACTIONS,
  INITIAL_LOANS,
  INITIAL_EMI_SCHEDULE,
  INITIAL_NOTIFICATIONS,
  SCREEN_LABELS
} from './data';

// Component Imports
import { safeFetchJson } from './utils/safeFetch';

import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import HomeSection from './components/HomeSection';
import SavingsSection from './components/SavingsSection';
import DepositSection from './components/DepositSection';
import WithdrawSection from './components/WithdrawSection';
import LoanSection from './components/LoanSection';
import PaymentSection from './components/PaymentSection';
import TransactionSection from './components/TransactionSection';
import NotificationSection from './components/NotificationSection';
import ProfileSection from './components/ProfileSection';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  // Sync core databases with LocalStorage for flawless persistence across sessions
  const [user, setUser] = useState<User>(() => {
    const saved = localStorage.getItem('jf_user');
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && parsed.isLoggedIn ? parsed : { name: '', phone: '', isLoggedIn: false, role: 'user' };
  });

  const [activeScreen, setActiveScreen] = useState<ScreenId>(() => {
    const hash = window.location.hash.replace('#/', '');
    const validScreens: ScreenId[] = [
      'splash', 'login', 'home', 'savings', 'deposit', 'withdraw',
      'loan_apply', 'loan_calc', 'documents_upload', 'loan_status',
      'emi_schedule', 'transaction_history', 'notifications', 'profile', 'admin_dashboard'
    ];
    if (hash && validScreens.includes(hash as ScreenId)) {
      return hash as ScreenId;
    }
    const saved = localStorage.getItem('jf_screen');
    return (saved as ScreenId) || 'splash';
  });

  const [savingsBalance, setSavingsBalance] = useState<number>(() => {
    const savedUser = localStorage.getItem('jf_user');
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    if (!parsedUser || !parsedUser.isLoggedIn) return 0;

    const saved = localStorage.getItem('jf_savings_balance');
    return saved ? Number(saved) : 0;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const savedUser = localStorage.getItem('jf_user');
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    if (!parsedUser || !parsedUser.isLoggedIn) return [];

    const saved = localStorage.getItem('jf_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeLoans, setActiveLoans] = useState<LoanItem[]>(() => {
    const savedUser = localStorage.getItem('jf_user');
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    if (!parsedUser || !parsedUser.isLoggedIn) return [];

    const saved = localStorage.getItem('jf_loans');
    return saved ? JSON.parse(saved) : [];
  });

  const [emiInstallments, setEmiInstallments] = useState<EmiInstallment[]>(() => {
    const savedUser = localStorage.getItem('jf_user');
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    if (!parsedUser || !parsedUser.isLoggedIn) return [];

    const saved = localStorage.getItem('jf_emi_schedule');
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const savedUser = localStorage.getItem('jf_user');
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    if (!parsedUser || !parsedUser.isLoggedIn) return [];

    const saved = localStorage.getItem('jf_notifs');
    return saved ? JSON.parse(saved) : [];
  });

  const [clockTime, setClockTime] = useState('09:41');

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('jf_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Global window.alert override and app code copying/inspection protection
  useEffect(() => {
    window.alert = (message: any) => {
      const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
      setAlertMessage(msgStr);
    };

    // 1. Disable Right Click (Context Menu) to prevent Inspect Element
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // 2. Disable DevTools keys (F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+Shift+J, Ctrl+U)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's'))
      ) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 3. Prevent text selection and drag start programmatically to make it feel like a secure native app
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  // Sync theme to HTML/body element class lists dynamically
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
    }
    localStorage.setItem('jf_theme', theme);
  }, [theme]);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('jf_settings');
    return saved ? JSON.parse(saved) : {
      appName: 'ন্যানো-ফাইন্যান্স',
      appSlug: 'সিলভার অ্যাডভান্সড',
      minDeposit: 10,
      maxDeposit: 1000000,
      minWithdraw: 100,
      maxWithdraw: 50000,
      interestRate: 14,
      bkashNumber: '01700000000',
      nagadNumber: '01800000000'
    };
  });

  // Sync settings to LocalStorage
  useEffect(() => {
    localStorage.setItem('jf_settings', JSON.stringify(settings));
  }, [settings]);

  // Load settings from backend API
  const loadSettingsFromBackend = async () => {
    try {
      const data = await safeFetchJson<any>('/api/settings');
      if (data && data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.warn("Could not fetch system settings from backend:", e);
    }
  };

  useEffect(() => {
    loadSettingsFromBackend();
  }, []);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('jf_user', JSON.stringify(user));
  }, [user]);



  useEffect(() => {
    localStorage.setItem('jf_screen', activeScreen);
    const cleanHash = window.location.hash.replace('#/', '');
    if (cleanHash !== activeScreen) {
      window.location.hash = `/${activeScreen}`;
    }
  }, [activeScreen]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      const validScreens: ScreenId[] = [
        'splash', 'login', 'home', 'savings', 'deposit', 'withdraw',
        'loan_apply', 'loan_calc', 'documents_upload', 'loan_status',
        'emi_schedule', 'transaction_history', 'notifications', 'profile', 'admin_dashboard'
      ];
      if (hash && validScreens.includes(hash as ScreenId)) {
        setActiveScreen(hash as ScreenId);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('jf_savings_balance', savingsBalance.toString());
  }, [savingsBalance]);

  useEffect(() => {
    localStorage.setItem('jf_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('jf_loans', JSON.stringify(activeLoans));
  }, [activeLoans]);

  useEffect(() => {
    localStorage.setItem('jf_emi_schedule', JSON.stringify(emiInstallments));
  }, [emiInstallments]);

  useEffect(() => {
    localStorage.setItem('jf_notifs', JSON.stringify(notifications));
  }, [notifications]);

  // Live status bar updates representing real-time local updates
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      let mins = now.getMinutes().toString().padStart(2, '0');
      setClockTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Sync with real Express Backend Database APIs
  const syncStateFromBackend = async (phone: string) => {
    try {
      const response = await fetch('/api/user/get-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
      });
      
      if (response.status === 404 || response.status === 401 || response.status === 403) {
        console.warn("User session is inactive, deleted, or blocked on backend. Logging out.");
        if (response.status === 403) {
          setAlertMessage("আপনার অ্যাকাউন্টটি অ্যাডমিন কর্তৃক ব্লক করা হয়েছে। অনুগ্রহ করে কর্তৃপক্ষের সাথে যোগাযোগ করুন।");
        }
        handleLogout();
        return;
      }

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data && data.success && data.user) {
            setUser({
              ...data.user,
              isLoggedIn: true
            });
            setSavingsBalance(Number(data.user.savingsBalance));
            setTransactions(data.user.transactions);
            setActiveLoans(data.user.activeLoans);
            setEmiInstallments(data.user.emiInstallments);
            setNotifications(data.user.notifications);
          }
        }
      }
    } catch (e) {
      console.warn("Backend sync offline, using local storage cache:", e);
    }
  };

  useEffect(() => {
    if (user.isLoggedIn && user.phone) {
      syncStateFromBackend(user.phone);

      const interval = setInterval(() => {
        syncStateFromBackend(user.phone);
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [user.isLoggedIn, user.phone]);

  // Live Active User Heartbeat / Ping (30s interval for rate limit protection)
  useEffect(() => {
    let clientId = sessionStorage.getItem('nano_client_id');
    if (!clientId) {
      clientId = 'client_' + Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem('nano_client_id', clientId);
    }

    const sendPing = () => {
      fetch('/api/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          phone: user.isLoggedIn ? user.phone : null,
          role: user.isLoggedIn ? (user.role || 'user') : 'visitor'
        }),
      }).catch(() => {});
    };

    sendPing();
    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, [user.isLoggedIn, user.phone, user.role]);

  // Strict Role-Based Security Guard Loop
  useEffect(() => {
    if (user.isLoggedIn) {
      const isAdmin = user.role === 'main_admin' || user.role === 'sub_admin';
      if (isAdmin) {
        // Safe list for admins
        const allowedAdminScreens: ScreenId[] = ['admin_dashboard', 'profile'];
        if (!allowedAdminScreens.includes(activeScreen)) {
          setActiveScreen('admin_dashboard');
        }
      } else {
        // Restrict normal user from accessing admin components
        if (activeScreen === 'admin_dashboard') {
          setActiveScreen('home');
        }
      }
    } else {
      // If not logged in, only permit splash or login
      if (activeScreen !== 'splash' && activeScreen !== 'login') {
        setActiveScreen('login');
      }
    }
  }, [user.isLoggedIn, user.role, activeScreen]);

  // Utility resets
  const handleReset = async () => {
    if (window.confirm('আপনি কি সব ডাটা ডিফল্ট মোডে রিসেট করতে চান?')) {
      try {
        const data = await safeFetchJson<any>('/api/user/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phone: user.phone }),
        });
        if (data && data.success && data.user) {
          setUser({ ...data.user, isLoggedIn: true });
          setSavingsBalance(Number(data.user.savingsBalance));
          setTransactions(data.user.transactions);
          setActiveLoans(data.user.activeLoans);
          setEmiInstallments(data.user.emiInstallments);
          setNotifications(data.user.notifications);
          alert('ডাটা রিসেট সম্পন্ন হয়েছে!');
        }
      } catch (err) {
        console.error(err);
        alert('ডাটা রিসেট করতে ব্যর্থ হয়েছে।');
      }
    }
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/assets/nano-finance-template.html';
    link.download = 'nano_finance_template.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick simulated approvals for presentation
  const handleSimulateApproval = async () => {
    try {
      const data = await safeFetchJson<any>('/api/user/loan/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: user.phone }),
      });
      if (data && data.success) {
        setUser({ ...data.user, isLoggedIn: true });
        setSavingsBalance(Number(data.user.savingsBalance));
        setTransactions(data.user.transactions);
        setActiveLoans(data.user.activeLoans);
        setEmiInstallments(data.user.emiInstallments);
        setNotifications(data.user.notifications);
        alert('সফল সিমুলেশন! পেন্ডিং ঋণটি অনুমোদিত করা হয়েছে এবং ব্যালেন্স যুক্ত হয়েছে!');
      } else {
        alert((data && data.error) || 'সিমুলেশন ব্যর্থ! কোনো পেন্ডিং ঋণ পাওয়া যায়নি।');
      }
    } catch (err) {
      console.error(err);
      alert('সার্ভার ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  const handleSimulateCashIn = async () => {
    const cashInAmount = 10000;
    try {
      const data = await safeFetchJson<any>('/api/user/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: user.phone, amount: cashInAmount, method: 'bkash' }),
      });
      if (data && data.success) {
        setUser({ ...data.user, isLoggedIn: true });
        setSavingsBalance(Number(data.user.savingsBalance));
        setTransactions(data.user.transactions);
        setActiveLoans(data.user.activeLoans);
        setEmiInstallments(data.user.emiInstallments);
        setNotifications(data.user.notifications);
        alert(`সফলভাবে ${cashInAmount.toLocaleString()} টাকা ক্যাশ-ইন করা হয়েছে।`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminFastLogin = async (role: 'main_admin' | 'sub_admin') => {
    if (user.isLoggedIn && user.role === 'user') {
      alert('নিراقত্তা সতর্কতা! আপনি একজন সাধারণ নিবন্ধিত গ্রাহক হিসেবে লগইন আছেন। আপনার সিকিউরিটি রোল থেকে সরাসরি অ্যাডমিনে স্যুইচ বা হ্যাক করার কোনো অনুমোদন নেই। অনুগ্রহ করে প্রথমে লগআউট করুন।');
      return;
    }
    const phone = role === 'main_admin' ? '01700000000' : '01711111111';
    const pin = role === 'main_admin' ? '0000' : '1111';
    try {
      const data = await safeFetchJson<any>('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      if (data && data.success) {
        setUser({
          ...data.user,
          isLoggedIn: true
        });
        setSavingsBalance(Number(data.user.savingsBalance));
        setTransactions(data.user.transactions);
        setActiveLoans(data.user.activeLoans);
        setEmiInstallments(data.user.emiInstallments);
        setNotifications(data.user.notifications);
        setActiveScreen('admin_dashboard');
        alert(`${role === 'main_admin' ? 'মেইন অ্যাডমিন' : 'অ্যাডমিন'} হিসেবে দ্রুত সিমুলেশন লগইন সফল হয়েছে!`);
      } else {
        alert((data && data.error) || 'অ্যাডমিন লগইন ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
      alert('সার্ভার ত্রুটি হয়েছে।');
    }
  };

  // State Updates from Components
  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser({
      ...authenticatedUser,
      isLoggedIn: true,
    });
    setSavingsBalance(Number(authenticatedUser.savingsBalance) || 0);
    setTransactions(authenticatedUser.transactions || []);
    setActiveLoans(authenticatedUser.activeLoans || []);
    setEmiInstallments(authenticatedUser.emiInstallments || []);
    setNotifications(authenticatedUser.notifications || []);

    const isAdmin = authenticatedUser.role === 'main_admin' || authenticatedUser.role === 'sub_admin';
    if (isAdmin) {
      setActiveScreen('admin_dashboard');
    } else {
      setActiveScreen('home');
    }
  };

  const handleLogout = () => {
    setUser({ ...INITIAL_USER, phone: '', name: '', isLoggedIn: false });
    setSavingsBalance(0);
    setTransactions([]);
    setActiveLoans([]);
    setEmiInstallments([]);
    setNotifications([]);
    localStorage.removeItem('jf_user');
    localStorage.removeItem('jf_screen');
    localStorage.removeItem('jf_savings_balance');
    localStorage.removeItem('jf_transactions');
    localStorage.removeItem('jf_loans');
    localStorage.removeItem('jf_emi_schedule');
    localStorage.removeItem('jf_notifs');
    localStorage.removeItem('jf_last_activity');
    setActiveScreen('login');
  };

  // User auto-logout after 1 hour of inactivity
  useEffect(() => {
    if (!user.isLoggedIn) return;

    // Set initial last activity time when logged in
    if (!localStorage.getItem('jf_last_activity')) {
      localStorage.setItem('jf_last_activity', Date.now().toString());
    }

    const resetTimer = () => {
      localStorage.setItem('jf_last_activity', Date.now().toString());
    };

    // Events that denote activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Check every 10 seconds if idle time exceeds 1 hour (3600000 milliseconds)
    const checkInterval = setInterval(() => {
      const lastActivity = localStorage.getItem('jf_last_activity');
      if (lastActivity) {
        const diffMs = Date.now() - parseInt(lastActivity, 10);
        if (diffMs >= 3600000) {
          handleLogout();
          alert('কোনো সক্রিয়তা না পাওয়ায় আপনার অ্যাকাউন্টটি স্বয়ংক্রিয়ভাবে লগআউট করা হয়েছে।');
        }
      }
    }, 10000);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      clearInterval(checkInterval);
    };
  }, [user.isLoggedIn]);

  const handleDepositComplete = async (amount: number, method: PaymentMethod) => {
    try {
      const data = await safeFetchJson<any>('/api/user/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: user.phone, amount, method }),
      });
      if (data && data.success) {
        setUser({ ...data.user, isLoggedIn: true });
        setSavingsBalance(Number(data.user.savingsBalance));
        setTransactions(data.user.transactions);
        setActiveLoans(data.user.activeLoans);
        setEmiInstallments(data.user.emiInstallments);
        setNotifications(data.user.notifications);
        setActiveScreen('savings');
      } else {
        alert((data && data.error) || 'জমা ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
      alert('সার্ভার ত্রুটি হয়েছে।');
    }
  };

  const handleWithdrawComplete = async (amount: number, method: PaymentMethod, pin: string): Promise<boolean> => {
    try {
      const data = await safeFetchJson<any>('/api/user/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: user.phone, amount, method, pin }),
      });
      if (data && data.success) {
        setUser({ ...data.user, isLoggedIn: true });
        setSavingsBalance(Number(data.user.savingsBalance));
        setTransactions(data.user.transactions);
        setActiveLoans(data.user.activeLoans);
        setEmiInstallments(data.user.emiInstallments);
        setNotifications(data.user.notifications);
        return true;
      } else {
        alert((data && data.error) || 'উত্তোলন ব্যর্থ হয়েছে।');
        return false;
      }
    } catch (err) {
      console.error(err);
      alert('সার্ভার ত্রুটি হয়েছে।');
      return false;
    }
  };

  const handleApplyLoan = async (newLoan: Omit<LoanItem, 'id' | 'status' | 'date' | 'repaidCount' | 'totalInstallments'> & { id?: string }) => {
    try {
      const data = await safeFetchJson<any>('/api/user/loan/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: user.phone,
          category: newLoan.category,
          categoryBangla: newLoan.categoryBangla,
          amount: newLoan.amount,
          months: newLoan.months,
          interestRate: newLoan.interestRate,
          emiAmount: newLoan.emiAmount,
          nidFrontUrl: newLoan.nidFrontUrl,
          nidBackUrl: newLoan.nidBackUrl,
          selfieUrl: newLoan.selfieUrl,
          incomeProofUrl: newLoan.incomeProofUrl,
          addressProofUrl: newLoan.addressProofUrl,
          addressProofType: newLoan.addressProofType,
        }),
      });
      if (data && data.success) {
        setUser({ ...data.user, isLoggedIn: true });
        setSavingsBalance(Number(data.user.savingsBalance));
        setTransactions(data.user.transactions);
        setActiveLoans(data.user.activeLoans);
        setEmiInstallments(data.user.emiInstallments);
        setNotifications(data.user.notifications);
      } else {
        alert((data && data.error) || 'ঋণ আবেদন ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
      alert('সার্ভার ত্রুটি হয়েছে।');
    }
  };

  const handlePayInstallmentSuccess = async (installmentNo: number, amount: number, method: PaymentMethod) => {
    try {
      const data = await safeFetchJson<any>('/api/user/loan/pay-emi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: user.phone,
          installmentNo,
          amount,
          method,
        }),
      });
      if (data && data.success) {
        setUser({ ...data.user, isLoggedIn: true });
        setSavingsBalance(Number(data.user.savingsBalance));
        setTransactions(data.user.transactions);
        setActiveLoans(data.user.activeLoans);
        setEmiInstallments(data.user.emiInstallments);
        setNotifications(data.user.notifications);
        alert(`৳ ${amount.toLocaleString('bn-BD')} কিস্তি পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।`);
      } else {
        alert((data && data.error) || 'কিস্তি পরিশোধ ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error(err);
      alert('সার্ভার ত্রুটি হয়েছে।');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navigateTo = (screen: ScreenId) => {
    if (!user.isLoggedIn && screen !== 'splash' && screen !== 'login') {
      alert('দয়া করে অ্যাপ অ্যাক্সেস করতে প্রথমে লগইন সম্পন্ন করুন।');
      setActiveScreen('login');
      return;
    }
    setActiveScreen(screen);
  };

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Render correct simulated section inside phone mockup
  const renderMockupScreen = () => {
    switch (activeScreen) {
      case 'splash':
        return <SplashScreen onStart={() => navigateTo('login')} settings={settings} />;
      case 'login':
        return <LoginScreen onLoginSuccess={handleLoginSuccess} initialPhone={user.phone} settings={settings} />;
      case 'home':
        return (
          <HomeSection
            user={user}
            onNavigate={(s) => navigateTo(s)}
            savingsBalance={savingsBalance}
            unreadCount={unreadCount}
            settings={settings}
          />
        );
      case 'savings':
        return (
          <SavingsSection
            savingsBalance={savingsBalance}
            transactions={transactions}
            onNavigate={(s) => navigateTo(s)}
          />
        );
      case 'deposit':
        return (
          <DepositSection
            user={user}
            onBack={() => navigateTo('home')}
            onDepositComplete={handleDepositComplete}
            settings={settings}
          />
        );
      case 'withdraw':
        return (
          <WithdrawSection
            savingsBalance={savingsBalance}
            onBack={() => navigateTo('savings')}
            onWithdrawComplete={handleWithdrawComplete}
            settings={settings}
          />
        );
      case 'loan_apply':
        return (
          <LoanSection
            onBack={() => navigateTo('home')}
            activeLoans={activeLoans}
            onSubmitLoan={handleApplyLoan}
            initialStep={1}
            user={user}
            settings={settings}
            savingsBalance={savingsBalance}
            onGoToSavings={() => navigateTo('savings')}
          />
        );
      case 'loan_calc':
        return (
          <LoanSection
            onBack={() => navigateTo('home')}
            activeLoans={activeLoans}
            onSubmitLoan={handleApplyLoan}
            initialStep={2}
            user={user}
            settings={settings}
            savingsBalance={savingsBalance}
            onGoToSavings={() => navigateTo('savings')}
          />
        );
      case 'documents_upload':
        return (
          <LoanSection
            onBack={() => navigateTo('home')}
            activeLoans={activeLoans}
            onSubmitLoan={handleApplyLoan}
            initialStep={3}
            user={user}
            settings={settings}
            savingsBalance={savingsBalance}
            onGoToSavings={() => navigateTo('savings')}
          />
        );
      case 'loan_status':
        return (
          <LoanSection
            onBack={() => navigateTo('home')}
            activeLoans={activeLoans}
            onSubmitLoan={handleApplyLoan}
            initialStep={4}
            user={user}
            settings={settings}
            savingsBalance={savingsBalance}
            onGoToSavings={() => navigateTo('savings')}
          />
        );
      case 'emi_schedule':
        return (
          <PaymentSection
            user={user}
            savingsBalance={savingsBalance}
            emiInstallments={emiInstallments}
            activeLoans={activeLoans}
            onBack={() => navigateTo('home')}
            onPaySuccess={handlePayInstallmentSuccess}
            onDepositComplete={handleDepositComplete}
            settings={settings}
          />
        );
      case 'transaction_history':
        return (
          <TransactionSection
            transactions={transactions}
            onBack={() => navigateTo('savings')}
          />
        );
      case 'notifications':
        return (
          <NotificationSection
            notifications={notifications}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onClearAll={handleClearAllNotifications}
          />
        );
      case 'profile':
        return (
          <ProfileSection
            user={user}
            onLogout={handleLogout}
            onNavigate={(s) => navigateTo(s)}
            onUpdateUser={(updated) => setUser(updated)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        );
      case 'admin_dashboard':
        return (
          <AdminDashboard
            operator={user}
            onNavigateHome={() => handleLogout()}
            onStateUpdated={() => {
              if (user.phone) {
                syncStateFromBackend(user.phone);
              }
            }}
          />
        );
      default:
        return <SplashScreen onStart={() => navigateTo('login')} settings={settings} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 font-sans flex flex-col md:flex-row antialiased overflow-x-hidden selection:bg-[#c5a059] selection:text-black leading-relaxed">
      {/* LEFT PANE BOARD: Desktop Controller, Workspace Tools & Style Guidelines - Hidden for clean production look */}
      <div className="hidden">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-1 px-1.5 text-[10px] bg-[#c5a059] rounded text-black font-black uppercase tracking-wider">
              NF
            </div>
            <h1 className="text-xl font-serif italic tracking-tight text-white flex items-center gap-1.5">
              {settings.appName} <span className="not-italic font-sans text-xs uppercase tracking-[0.2em] text-[#c5a059] ml-1">সিমুলেটর</span>
            </h1>
          </div>
          <p className="text-xs text-zinc-500 font-serif italic">
            {settings.appSlug} | Core Dashboard.
          </p>
        </div>

        {/* Dynamic Simulation Controls Block */}
        <div className="bg-[#121212] rounded-2xl p-4 border border-zinc-800/70 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-[#c5a059] tracking-widest uppercase flex items-center gap-1.5 font-sans mb-1">
            <Sparkles className="w-4 h-4 text-[#c5a059]" />
            দ্রুত অ্যাকশন সিমুলেটর (Quick Actions)
          </h3>

          {user.isLoggedIn && (user.role === 'main_admin' || user.role === 'sub_admin') ? (
            <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-900 text-[11px] text-zinc-400 font-sans leading-relaxed">
              <span className="text-[#dfc187] font-bold block mb-1">সুরক্ষিত: মেইন অ্যাডমিন সেশন 🛡️</span>
              অ্যাডমিনদের নিজস্ব কোনো সাধারণ ঋণ ও সঞ্চয় হিসাব থাকে না। গ্রাহক পেমেন্ট ও তথ্য নিরীক্ষণ করতে সরাসরি ডানদিকের প্যানেলটি ব্যবহার করুন।
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleSimulateCashIn}
                className="flex items-center gap-2 p-2.5 bg-[#c5a059]/10 text-[#dfc187] border border-[#c5a059]/20 rounded-xl hover:bg-[#c5a059]/20 text-xs font-semibold font-sans text-left transition-all"
              >
                <TrendingUp className="w-4.5 h-4.5 text-[#c5a059]" />
                <span>+১০,০০০ টাকা জমা</span>
              </button>

              <button
                onClick={handleSimulateApproval}
                className="flex items-center gap-2 p-2.5 bg-[#c5a059]/10 text-amber-200 border border-[#c5a059]/20 rounded-xl hover:bg-[#c5a059]/20 text-xs font-semibold font-sans text-left transition-all"
              >
                <Award className="w-4.5 h-4.5 text-[#c5a059]" />
                <span>ঋণ অনুমোদন করুন</span>
              </button>
            </div>
          )}

          {(!user.isLoggedIn || user.role === 'main_admin' || user.role === 'sub_admin') && (
            <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-zinc-900">
              <span className="text-[10px] text-zinc-500 font-sans font-bold">অ্যাডমিন কন্ট্রোল সিমুলেশন:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAdminFastLogin('main_admin')}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-[#c5a059]/10 hover:bg-[#c5a059]/20 text-[#dfc187] border border-[#c5a059]/20 rounded-xl text-xs font-semibold font-sans transition-all active:scale-95 cursor-pointer text-center"
                >
                  <ShieldCheck className="w-4.5 h-4.5 text-[#c5a059] shrink-0" />
                  <span>মেইন অ্যাডমিন</span>
                </button>
                <button
                  onClick={() => handleAdminFastLogin('sub_admin')}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-zinc-900 border border-zinc-850 text-[#dfc187] rounded-lg text-[10px] font-bold font-sans hover:bg-zinc-850 transition-all active:scale-95 cursor-pointer text-center"
                >
                  <Users className="w-4.5 h-4.5 text-zinc-400 shrink-0" />
                  <span>উপ-অ্যাডমিন</span>
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-semibold font-sans transition-colors mt-1 border border-zinc-800/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            ফ্যাক্টরি ডাটা রিসেট
          </button>
        </div>

        {/* Complete screen lists checklist targeting Screen 2 */}
        <div className="bg-[#121212] rounded-2xl p-4 border border-zinc-800/70">
          <h3 className="text-xs font-bold text-zinc-400 tracking-wider uppercase mb-3 flex items-center gap-1.5 font-sans">
            <Layers className="w-4 h-4 text-[#c5a059]" />
            দৃশ্যমান স্ক্রিন নির্বাচন (Warp Navigation)
          </h3>

          <div className="flex flex-col gap-1 md:max-h-[220px] md:overflow-y-auto no-scrollbar pb-1">
            {[
              { id: 'splash', label: SCREEN_LABELS.splash.bn, tag: 'Welcome' },
              { id: 'login', label: SCREEN_LABELS.login.bn, tag: 'Auth' },
              { id: 'home', label: SCREEN_LABELS.home.bn, tag: 'Main' },
              { id: 'savings', label: SCREEN_LABELS.savings.bn, tag: 'Report' },
              { id: 'deposit', label: SCREEN_LABELS.deposit.bn, tag: 'Cash-in' },
              { id: 'withdraw', label: SCREEN_LABELS.withdraw.bn, tag: 'Cash-out' },
              { id: 'loan_apply', label: SCREEN_LABELS.loan_apply.bn, tag: 'Wizard 1' },
              { id: 'loan_calc', label: SCREEN_LABELS.loan_calc.bn, tag: 'Wizard 2' },
              { id: 'documents_upload', label: SCREEN_LABELS.documents_upload.bn, tag: 'Wizard 3' },
              { id: 'loan_status', label: SCREEN_LABELS.loan_status.bn, tag: 'Status' },
              { id: 'emi_schedule', label: SCREEN_LABELS.emi_schedule.bn, tag: 'List' },
              { id: 'installment_pay', label: SCREEN_LABELS.installment_pay.bn, tag: 'Checkout' },
              { id: 'transaction_history', label: SCREEN_LABELS.transaction_history.bn, tag: 'Logs' },
              { id: 'notifications', label: SCREEN_LABELS.notifications.bn, tag: 'Alerts' },
              { id: 'profile', label: SCREEN_LABELS.profile.bn, tag: 'User' },
              { id: 'admin_dashboard', label: 'অ্যাডমিন ড্যাশবোর্ড', tag: 'Admin' },
            ].filter((sc) => {
              if (user.isLoggedIn) {
                const isAdmin = user.role === 'main_admin' || user.role === 'sub_admin';
                if (isAdmin) {
                  return ['admin_dashboard', 'profile'].includes(sc.id);
                } else {
                  return sc.id !== 'admin_dashboard';
                }
              }
              return ['splash', 'login'].includes(sc.id);
            }).map((sc) => {
              const checked = activeScreen === sc.id || (sc.id === 'installment_pay' && activeScreen === 'emi_schedule');

              return (
                <button
                  key={sc.id}
                  onClick={() => {
                    if (sc.id === 'installment_pay') {
                      navigateTo('emi_schedule');
                    } else {
                      navigateTo(sc.id as any);
                    }
                  }}
                  className={`flex items-center justify-between p-1.5 px-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${checked ? 'bg-[#c5a059]/15 border border-[#c5a059]/30 text-white font-extrabold shadow-sm' : 'bg-transparent border border-transparent hover:bg-zinc-900/50 hover:text-zinc-200 text-zinc-500'}`}
                >
                  <span className="truncate pr-1 font-sans">{sc.label}</span>
                  <span className="text-[9px] bg-zinc-900 text-zinc-500 px-1.5 py-0.2 rounded font-mono scale-90">
                    {sc.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* HTML / Laravel Export Section */}
        <div className="bg-[#121212] rounded-2xl p-4 border border-[#c5a059]/20 flex flex-col gap-3 font-sans">
          <h3 className="text-xs font-bold text-[#c5a059] tracking-wider uppercase flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-[#c5a059]" />
            এইচটিএমএল টেমপ্লেট এক্সপোর্ট
          </h3>
          <p className="text-[10.5px] text-zinc-400 leading-relaxed font-normal">
            আপনার লারাভেল (Laravel) ওয়েবসাইটে যুক্ত করার জন্য এই সিস্টেমে একটি রেসপন্সিভ সিঙ্গেল-ফাইল এইচটিএমএল টেমপ্লেট রেডি করা হয়েছে।
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="w-full flex items-center justify-center gap-2 p-2.5 bg-[#c5a059] hover:bg-gold-600 active:scale-98 text-black rounded-xl text-xs font-bold transition-all shadow-md shadow-gold-500/5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            টেমপ্লেট ডাউনলোড করুন
          </button>
        </div>

        {/* Style Guidelines metadata visualization as specified in screenshot header */}
        <div className="bg-[#121212] rounded-2xl p-4 border border-zinc-800/70 flex flex-col gap-3 font-sans mt-auto">
          <h3 className="text-xs font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
            <Layout className="w-4 h-4 text-[#c5a059]" />
            ডিজাইন সিস্টেম (Style Guide)
          </h3>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-5 gap-1 text-[8px] font-mono text-center text-white font-medium">
              <div className="p-0.5 rounded bg-[#c5a059] text-black">#c5a</div>
              <div className="p-0.5 rounded bg-zinc-950 border border-zinc-850">#0909</div>
              <div className="p-0.5 rounded bg-zinc-900 border border-zinc-850">#1818</div>
              <div className="p-0.5 rounded bg-zinc-800">#272</div>
              <div className="p-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">#10b</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT/CENTER PANE: Expanded full design client portal container */}
      <div className="flex-grow md:h-screen flex flex-col overflow-hidden relative bg-[#0a0a09]">
        {/* Dynamic simulator viewport body occupies the whole screen width & height with bottom layout spacing */}
        <div className="flex-grow overflow-y-auto no-scrollbar relative pb-20 md:pb-0">
            {renderMockupScreen()}
        </div>

        {/* BOTTOM NAVIGATION: HOME, SAVINGS, LOAN, REPAYMENTS/PAY, PROFILE (Screens 3, 15 navigation system) */}
        {user.isLoggedIn && activeScreen !== 'splash' && activeScreen !== 'login' && (
          <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto shrink-0 bg-[#0c0c0e]/95 backdrop-blur-md border-t border-zinc-900 px-4 py-2.5 z-40 flex justify-center items-center text-zinc-500 select-none">
            <div className="w-full max-w-xl flex justify-between items-center gap-2">
              {user.role === 'main_admin' || user.role === 'sub_admin' ? (
                <>
                  {/* Admin Contextual Navigation */}
                  <button
                    onClick={() => navigateTo('admin_dashboard')}
                    id="tab-admin"
                    className={`flex flex-col items-center gap-1 flex-1 py-1.5 transition-all ${activeScreen === 'admin_dashboard' ? 'text-[#c5a059]' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    <ShieldCheck className="w-5 h-5 cursor-pointer text-[#c5a059]" />
                    <span className="text-[10px] font-bold font-sans">অ্যাডমিন ড্যাশবোর্ড</span>
                  </button>

                  <button
                    onClick={() => navigateTo('profile')}
                    id="tab-profile"
                    className={`flex flex-col items-center gap-1 flex-1 py-1.5 transition-all ${activeScreen === 'profile' ? 'text-[#c5a059]' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    <UserIcon className="w-5 h-5 cursor-pointer" />
                    <span className="text-[10px] font-bold font-sans">প্রোফাইল</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Normal Customer Contextual Navigation */}
                  <button
                    onClick={() => navigateTo('home')}
                    id="tab-home"
                    className={`flex flex-col items-center gap-1 flex-1 py-1.5 transition-all ${activeScreen === 'home' ? 'text-[#c5a059]' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    <Home className="w-5 h-5 cursor-pointer" />
                    <span className="text-[10px] font-bold font-sans">হোম</span>
                  </button>

                  <button
                    onClick={() => navigateTo('savings')}
                    id="tab-savings"
                    className={`flex flex-col items-center gap-1 flex-1 py-1.5 transition-all ${activeScreen === 'savings' || activeScreen === 'deposit' || activeScreen === 'withdraw' ? 'text-[#c5a059]' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    <PiggyBank className="w-5 h-5 cursor-pointer" />
                    <span className="text-[10px] font-bold font-sans">সঞ্চয়</span>
                  </button>

                  <button
                    onClick={() => navigateTo('loan_status')}
                    id="tab-loan"
                    className={`flex flex-col items-center gap-1 flex-1 py-1.5 transition-all cursor-pointer ${activeScreen === 'loan_status' || activeScreen === 'loan_apply' || activeScreen === 'loan_calc' || activeScreen === 'documents_upload' ? 'text-[#c5a059]' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    <Landmark className="w-5 h-5" />
                    <span className="text-[10px] font-bold font-sans">ঋণ</span>
                  </button>

                  <button
                    onClick={() => navigateTo('emi_schedule')}
                    id="tab-payment"
                    className={`flex flex-col items-center gap-1 flex-1 py-1.5 transition-all cursor-pointer ${activeScreen === 'emi_schedule' ? 'text-[#c5a059]' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="text-[10px] font-bold font-sans">পেমেন্ট</span>
                  </button>

                  <button
                    onClick={() => navigateTo('profile')}
                    id="tab-profile"
                    className={`flex flex-col items-center gap-1 flex-1 py-1.5 transition-all cursor-pointer ${activeScreen === 'profile' ? 'text-[#c5a059]' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    <UserIcon className="w-5 h-5" />
                    <span className="text-[10px] font-bold font-sans">প্রোফাইল</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ALERT MESSAGE MODAL PORTAL */}
      {alertMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs select-none">
          <div className="bg-[#111113] border border-zinc-850/80 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#c5a059]/15 text-[#dfc187] flex items-center justify-center mb-4">
              <Info className="w-6 h-6 animate-pulse text-[#c5a059]" />
            </div>
            <h4 className="text-sm font-bold text-zinc-100 font-sans text-center mb-5 leading-normal">
              {alertMessage}
            </h4>
            <button
              onClick={() => setAlertMessage(null)}
              className="w-full bg-[#c5a059] hover:bg-[#dfc187] active:scale-[0.98] text-zinc-950 py-3 rounded-xl font-bold font-sans text-xs tracking-wide transition-all duration-200 cursor-pointer text-center"
            >
              ঠিক আছে (OK)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
