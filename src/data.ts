/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, LoanItem, EmiInstallment, NotificationItem } from './types';

export const INITIAL_USER = {
  name: 'আরিফ রহমান',
  phone: '01712345678',
  accountNo: '1234567890',
  isLoggedIn: true,
  isVerified: true,
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260',
};

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TX1009',
    type: 'deposit',
    method: 'bkash',
    amount: 5000,
    date: '২০ জুন, ২০২৬',
    status: 'completed',
    titleBangla: 'জমা (bKash)',
    descBangla: 'সঞ্চয় অ্যাকাউন্টে সফল জমা',
  },
  {
    id: 'TX1008',
    type: 'deposit',
    method: 'nagad',
    amount: 10000,
    date: '১৬ জুন, ২০২৬',
    status: 'completed',
    titleBangla: 'জমা (Nagad)',
    descBangla: 'সঞ্চয় অ্যাকাউন্টে সফল জমা',
  },
  {
    id: 'TX1007',
    type: 'withdraw',
    method: 'nagad',
    amount: 5000,
    date: '১০ জুন, ২০২৬',
    status: 'completed',
    titleBangla: 'উত্তোলন (Nagad)',
    descBangla: 'সফল ক্যাশ আউট',
  },
  {
    id: 'TX1006',
    type: 'deposit',
    method: 'rocket',
    amount: 2000,
    date: '০৫ জুন, ২০২৬',
    status: 'completed',
    titleBangla: 'জমা (Rocket)',
    descBangla: 'সঞ্চয় অ্যাকাউন্টে ক্যাশ ইন',
  },
  {
    id: 'TX1005',
    type: 'loan_repay',
    method: 'bkash',
    amount: 18274,
    date: '২০ মে, ২০২৬',
    status: 'completed',
    titleBangla: 'কিস্তি পরিশোধ',
    descBangla: 'ব্যবসায়িক ঋণ কিস্তি #১',
  },
];

export const INITIAL_LOANS: LoanItem[] = [
  {
    id: 'LN00125',
    category: 'business',
    categoryBangla: 'ব্যবসায়িক ঋণ',
    amount: 200000,
    months: 12,
    interestRate: 14,
    emiAmount: 18274,
    status: 'pending',
    date: '২০ জুন, ২০২৬',
    repaidCount: 0,
    totalInstallments: 12,
  },
  {
    id: 'LN00124',
    category: 'home',
    categoryBangla: 'গৃহ ঋণ',
    amount: 150000,
    months: 12,
    interestRate: 14,
    emiAmount: 13705,
    status: 'approved',
    date: '১৬ জুন, ২০২৬',
    repaidCount: 1,
    totalInstallments: 12,
  },
];

export const INITIAL_EMI_SCHEDULE: EmiInstallment[] = [
  {
    installmentNo: 1,
    dueDate: '২০ মে, ২০২৬',
    amount: 18274,
    status: 'paid',
    txNo: 'TX1005',
  },
  {
    installmentNo: 2,
    dueDate: '২০ জুন, ২০২৬',
    amount: 18274,
    status: 'pending',
  },
  {
    installmentNo: 3,
    dueDate: '২০ জুলাই, ২০২৬',
    amount: 18274,
    status: 'due',
  },
  {
    installmentNo: 4,
    dueDate: '২০ আগস্ট, ২০২৬',
    amount: 18274,
    status: 'due',
  },
  {
    installmentNo: 5,
    dueDate: '২০ সেপ্টেম্বর, ২০২৬',
    amount: 18274,
    status: 'due',
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'N1',
    title: 'আপনার ঋণ অনুমোদিত হয়েছে!',
    body: 'অভিনন্দন! আপনার গৃহ ঋণ আবেদন LN00124 অনুমোদিত হয়েছে।',
    timeLabel: '২ মিনিট আগে',
    isRead: false,
    type: 'success',
  },
  {
    // screen 14 text: কিস্তি পরিশোধ স্মরণ করিয়ে দেয়া হচ্ছে। আপনার ২০ জুলাই, ২০২৪ তারিখে কিস্তি বাকি আছে।
    id: 'N2',
    title: 'কিস্তি পরিশোধ স্মরণ করিয়ে দেয়া হচ্ছে',
    body: 'আপনার ২০ জুলাই, ২০২৬ তারিখে ১৮,২৭৪ টাকা কিস্তি বাকি আছে। সময়মত পরিশোধ করুন।',
    timeLabel: '১ ঘণ্টা আগে',
    isRead: false,
    type: 'warn',
  },
  {
    id: 'N3',
    title: 'সঞ্চয় জমা সফল',
    body: 'আপনার অ্যাকাউন্টে ৳ ১০,০০০ সফলভাবে জমা হয়েছে।',
    timeLabel: '৩ ঘণ্টা আগে',
    isRead: true,
    type: 'success',
  },
  {
    id: 'N4',
    title: 'উত্তোলন অনুমোদিত',
    body: 'আপনার উত্তোলনের আবেদন অনুমোদিত হয়েছে। টাকা শিগগিরই পৌঁছে যাবে।',
    timeLabel: '৫ ঘণ্টা আগে',
    isRead: true,
    type: 'info',
  },
];

export const SCREEN_LABELS: Record<string, { en: string; bn: string }> = {
  splash: { en: 'Splash Screen', bn: '১. স্প্ল্যাশ স্ক্রিন' },
  login: { en: 'Login Screen', bn: '২. লগইন স্ক্রিন' },
  home: { en: 'Home Dashboard', bn: '৩. হোম ড্যাশবোর্ড' },
  savings: { en: 'Savings Dashboard', bn: '৪. সঞ্চয় ড্যাশবোর্ড' },
  deposit: { en: 'Deposit Cash', bn: '৫. টাকা জমা' },
  withdraw: { en: 'Withdraw Cash', bn: '৬. টাকা উত্তোলন' },
  loan_apply: { en: 'Loan Application', bn: '৭. ঋণের আবেদন' },
  loan_calc: { en: 'Loan Calculation', bn: '৮. ঋণের পরিমাণ ও মেয়াদ' },
  documents_upload: { en: 'Documents Upload', bn: '৯. নথি আপলোড' },
  loan_status: { en: 'Loan Status', bn: '১০. ঋণের স্ট্যাটাস' },
  emi_schedule: { en: 'EMI Schedule', bn: '১১. ইএমআই সূচি' },
  installment_pay: { en: 'Installment Pay', bn: '১২. পেমেন্ট করুন' },
  transaction_history: { en: 'Transaction History', bn: '১৩. লেনদেন ইতিহাস' },
  notifications: { en: 'Notification Center', bn: '১৪. নোটিফিকেশন' },
  profile: { en: 'Profile Screen', bn: '১৫. প্রোফাইল' },
};
