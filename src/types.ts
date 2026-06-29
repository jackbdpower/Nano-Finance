/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ScreenId =
  | 'splash'
  | 'login'
  | 'home'
  | 'savings'
  | 'deposit'
  | 'withdraw'
  | 'loan_apply'
  | 'loan_calc'
  | 'documents_upload'
  | 'loan_status'
  | 'emi_schedule'
  | 'installment_pay'
  | 'transaction_history'
  | 'notifications'
  | 'profile'
  | 'admin_dashboard';

export interface User {
  name: string;
  phone: string;
  accountNo: string;
  isLoggedIn: boolean;
  isVerified: boolean;
  avatarUrl?: string;
  role?: 'user' | 'main_admin' | 'sub_admin';
  securityLogs?: SecurityLog[];
  savingsBalance?: number;
  transactions?: Transaction[];
  activeLoans?: LoanItem[];
  emiInstallments?: EmiInstallment[];
  notifications?: NotificationItem[];
  bkashNo?: string;
  nagadNo?: string;
  gender?: string;
  dob?: string;
  email?: string;
  currentAddress?: string;
  permanentAddress?: string;
  createdAt?: number;
}

export interface SecurityLog {
  id: string;
  eventType: string;
  status: 'success' | 'failed' | 'locked' | 'info' | 'pin_change';
  details: string;
  ip: string;
  device: string;
  timeLabel: string;
  timestamp: number;
}

export type TransactionType = 'deposit' | 'withdraw' | 'loan_disburse' | 'loan_repay';
export type PaymentMethod = 'bkash' | 'nagad' | 'rocket' | 'bank';

export interface Transaction {
  id: string;
  type: TransactionType;
  method: PaymentMethod;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  titleBangla: string;
  descBangla: string;
}

export interface LoanItem {
  id: string;
  category: 'business' | 'agriculture' | 'home' | 'education' | 'women' | 'personal';
  categoryBangla: string;
  amount: number;
  months: number;
  interestRate: number;
  emiAmount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  date: string;
  createdAt?: number;
  repaidCount: number;
  totalInstallments: number;
  nidFrontUrl?: string;
  nidBackUrl?: string;
  selfieUrl?: string;
  incomeProofUrl?: string;
  addressProofUrl?: string;
  addressProofType?: string;
}

export interface EmiInstallment {
  installmentNo: number;
  dueDate: string;
  amount: number;
  status: 'paid' | 'pending' | 'due' | 'overdue';
  txNo?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timeLabel: string;
  createdAt?: number;
  isRead: boolean;
  type: 'success' | 'warn' | 'info' | 'loan';
}

export interface NewLoanForm {
  category: 'business' | 'agriculture' | 'home' | 'education' | 'women' | 'personal' | '';
  amount: number;
  months: number;
  interestRate: number;
  nidFront: File | null;
  nidFrontUrl: string;
  nidBack: File | null;
  nidBackUrl: string;
  selfie: File | null;
  selfieUrl: string;
  incomeProof: File | null;
  incomeProofUrl: string;
  addressProof: File | null;
  addressProofUrl: string;
  addressProofType: 'electricity' | 'gas' | 'tax_receipt' | 'water' | 'internet' | 'rent' | '';
}
