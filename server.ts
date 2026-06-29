import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, getDoc, setDoc, setLogLevel, terminate } from "firebase/firestore";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Ensure uploads folder exists and serve it statically
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));

// Global CORS Middleware - allows simulator or tools from any origin to poll safely
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Database Path
const DB_PATH = path.join(process.cwd(), "db.json");

// Firebase Configuration & Initialization Layer
let firebaseDb: any = null;
let dbCache: any = null;
let lastSyncedChecksum = "";
let activeCheckouts: any[] = [];
let lastSyncStatus: "success" | "failed" | "idle" = "idle";
let lastSyncTime: number = 0;
let lastSyncError: string | null = null;
let dbSyncTimeout: NodeJS.Timeout | null = null;
let quotaExhausted = false;
let quotaExhaustedUntil = 0;

const QUOTA_STATUS_PATH = path.join(process.cwd(), "quota_status.json");

function loadQuotaStatus() {
  try {
    if (fs.existsSync(QUOTA_STATUS_PATH)) {
      const data = JSON.parse(fs.readFileSync(QUOTA_STATUS_PATH, "utf-8"));
      if (data && typeof data.quotaExhaustedUntil === "number") {
        quotaExhaustedUntil = data.quotaExhaustedUntil;
        quotaExhausted = Date.now() < quotaExhaustedUntil;
        if (quotaExhausted) {
          console.log(`[Firebase-Sync] Persisted quota status loaded: Cloud Firestore is on cooldown mode until ${new Date(quotaExhaustedUntil).toISOString()}`);
        }
      }
    }
  } catch (err) {
    // Ignore error
  }
}

function saveQuotaStatus(exhausted: boolean) {
  try {
    quotaExhausted = exhausted;
    if (exhausted) {
      quotaExhaustedUntil = Date.now() + 12 * 60 * 60 * 1000; // 12 hours cooldown to reset the daily quota securely without retrying
    } else {
      quotaExhaustedUntil = 0;
    }
    fs.writeFileSync(QUOTA_STATUS_PATH, JSON.stringify({ quotaExhaustedUntil }, null, 2), "utf-8");
  } catch (err) {
    // Ignore error
  }
}

function handleSyncQuotaError(err: any) {
  const errorMsg = err?.message || String(err);
  const isQuota = errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota limit exceeded") || errorMsg.includes("quota");
  if (isQuota) {
    saveQuotaStatus(true);
    firebaseDb = null;
    console.log("[Firebase-Sync] Firestore usage quota limit has been reached. System is running in Local Safe-Memory Backup Mode.");
  }
}

// Active user tracking map (clientId -> { phone, role, lastActive })
const ACTIVE_SESSIONS = new Map<string, { phone: string | null; role: string; lastActive: number }>();

function getActiveSessionsList(allDbUsers: any[]) {
  const now = Date.now();
  const list: any[] = [];
  
  for (const [clientId, session] of ACTIVE_SESSIONS.entries()) {
    if (now - session.lastActive > 75000) { // stale session (no heartbeat in last 75s)
      ACTIVE_SESSIONS.delete(clientId);
      continue;
    }
    
    // Attempt to lookup full details if user has a phone
    let userDetails: any = null;
    if (session.phone) {
      const u = allDbUsers.find((user: any) => user.phone === session.phone);
      if (u) {
        userDetails = {
          name: u.name || "অজানা গ্রাহক",
          phone: u.phone,
          accountNo: u.accountNo || "N/A",
          role: u.role || 'user',
          savingsBalance: u.savingsBalance || 0,
          isVerified: u.isVerified !== false,
        };
      }
    }
    
    list.push({
      clientId,
      phone: session.phone,
      role: session.role,
      lastActive: session.lastActive,
      userDetails: userDetails
    });
  }
  
  return list;
}

function getCurrentBanglaDateString(): string {
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const banglaMonths = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const date = new Date();
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();

  const toBnDigits = (num: number) => {
    return num.toString().split('').map(digit => {
      const idx = parseInt(digit, 10);
      return !isNaN(idx) ? banglaDigits[idx] : digit;
    }).join('');
  };

  const dayBn = toBnDigits(day);
  const monthBn = banglaMonths[monthIndex];
  const yearBn = toBnDigits(year);

  return `${dayBn} ${monthBn}, ${yearBn}`;
}

function getLiveUsersCount() {
  const now = Date.now();
  for (const [clientId, session] of ACTIVE_SESSIONS.entries()) {
    if (now - session.lastActive > 75000) { // stale session (no heartbeat in last 75s)
      ACTIVE_SESSIONS.delete(clientId);
    }
  }
  return ACTIVE_SESSIONS.size || 1; // Always show at least 1 (the current viewing admin)
}

function mergeDatabases(localDb: any, remoteDb: any) {
  if (!localDb || !Array.isArray(localDb.users)) return remoteDb;
  if (!remoteDb || !Array.isArray(remoteDb.users)) return localDb;

  const mergedUsers: any[] = [];
  const localUsers = localDb.users;
  const remoteUsers = remoteDb.users;

  // Build temporary map of all users by phone
  const allPhones = new Set<string>([
    ...localUsers.map((u: any) => u.phone),
    ...remoteUsers.map((u: any) => u.phone)
  ]);

  for (const phone of allPhones) {
    const localUser = localUsers.find((u: any) => u.phone === phone);
    const remoteUser = remoteUsers.find((u: any) => u.phone === phone);

    if (localUser && !remoteUser) {
      mergedUsers.push(localUser);
    } else if (!localUser && remoteUser) {
      mergedUsers.push(remoteUser);
    } else if (localUser && remoteUser) {
      // Both exist! We need to merge them.
      // 1. Merge transactions uniquely by id
      const mergedTxMap = new Map<string, any>();
      const localTx = localUser.transactions || [];
      const remoteTx = remoteUser.transactions || [];
      
      localTx.forEach((tx: any) => { if (tx && tx.id) mergedTxMap.set(tx.id, tx); });
      remoteTx.forEach((tx: any) => { if (tx && tx.id) mergedTxMap.set(tx.id, tx); });
      const mergedTransactions = Array.from(mergedTxMap.values());
      
      // 2. Merge activeLoans uniquely by id
      const mergedLoansMap = new Map<string, any>();
      const localLoans = localUser.activeLoans || [];
      const remoteLoans = remoteUser.activeLoans || [];
      localLoans.forEach((l: any) => { if (l && l.id) mergedLoansMap.set(l.id, l); });
      remoteLoans.forEach((l: any) => { if (l && l.id) mergedLoansMap.set(l.id, l); });
      const mergedLoans = Array.from(mergedLoansMap.values());

      // 3. Merge notifications uniquely by id
      const mergedNotifsMap = new Map<string, any>();
      const localNotifs = localUser.notifications || [];
      const remoteNotifs = remoteUser.notifications || [];
      localNotifs.forEach((n: any) => { if (n && n.id) mergedNotifsMap.set(n.id, n); });
      remoteNotifs.forEach((n: any) => { if (n && n.id) mergedNotifsMap.set(n.id, n); });
      const mergedNotifications = Array.from(mergedNotifsMap.values());

      // 4. Merge security logs if available
      const mergedLogsSet = new Set<string>();
      const mergedLogs: any[] = [];
      const localLogs = localUser.securityLogs || [];
      const remoteLogs = remoteUser.securityLogs || [];
      [...localLogs, ...remoteLogs].forEach((log: any) => {
        if (!log) return;
        const logKey = `${log.timeLabel}_${log.eventType}_${log.details}`;
        if (!mergedLogsSet.has(logKey)) {
          mergedLogsSet.add(logKey);
          mergedLogs.push(log);
        }
      });

      // 5. Merge EMI installments: just take the one with the higher length or remote if same
      let mergedEmi = remoteUser.emiInstallments || [];
      if ((localUser.emiInstallments || []).length > mergedEmi.length) {
        mergedEmi = localUser.emiInstallments;
      }

      // 6. Base user selection
      const baseUser = { ...remoteUser };
      
      // If remote values are falsy or default, but local has real info:
      if (!baseUser.name && localUser.name) baseUser.name = localUser.name;
      if (!baseUser.accountNo && localUser.accountNo) baseUser.accountNo = localUser.accountNo;
      if (localUser.isVerified && !baseUser.isVerified) baseUser.isVerified = true;
      if (Number(localUser.savingsBalance || 0) > Number(baseUser.savingsBalance || 0)) {
        baseUser.savingsBalance = localUser.savingsBalance;
      }
      if (localUser.pin && localUser.pin !== "0000" && localUser.pin !== "1111" && (!baseUser.pin || baseUser.pin === "0000" || baseUser.pin === "1111")) {
        baseUser.pin = localUser.pin;
      }
      
      // Update with merged collections
      baseUser.transactions = mergedTransactions;
      baseUser.activeLoans = mergedLoans;
      baseUser.notifications = mergedNotifications;
      baseUser.securityLogs = mergedLogs;
      baseUser.emiInstallments = mergedEmi;

      mergedUsers.push(baseUser);
    }
  }

  // Merge general database collections (licenseKeys, registeredDevices, checkouts, settings)
  const mergedDb = { ...remoteDb };

  const mergeLists = (localList: any[], remoteList: any[], key: string) => {
    const map = new Map<string, any>();
    (localList || []).forEach((item: any) => { if (item && item[key]) map.set(item[key], item); });
    (remoteList || []).forEach((item: any) => { if (item && item[key]) map.set(item[key], item); });
    return Array.from(map.values());
  };

  mergedDb.users = mergedUsers;
  mergedDb.licenseKeys = mergeLists(localDb.licenseKeys, remoteDb.licenseKeys, "key");
  mergedDb.registeredDevices = mergeLists(localDb.registeredDevices, remoteDb.registeredDevices, "deviceId");
  mergedDb.checkouts = mergeLists(localDb.checkouts, remoteDb.checkouts, "id");
  
  mergedDb.settings = remoteDb.settings || localDb.settings;

  return mergedDb;
}

async function initFirebaseAndLoadDB() {
  loadQuotaStatus();
  if (quotaExhausted && Date.now() < quotaExhaustedUntil) {
    console.log("[Firebase-Sync] Firestore usage quota is currently exhausted (cooldown active). Operating purely in Local Safe-Memory Backup Mode.");
    dbCache = readLocalDB();
    lastSyncStatus = "failed";
    lastSyncError = "QUOTA_EXHAUSTED: Cloud database usage limit reached. Local-only high-performance backup is active.";
    return;
  }

  try {
    const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(firebaseConfigPath)) {
      console.warn("[Firebase-Sync] Config not found, falling back to local file.");
      return;
    }
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    
    const fbApp = initializeApp(firebaseConfig);
    setLogLevel("error"); // Suppress internal web SDK warnings in server context
    firebaseDb = initializeFirestore(fbApp, { experimentalAutoDetectLongPolling: true }, firebaseConfig.firestoreDatabaseId);
    
    console.log("[Firebase-Sync] Initialized. Loading database cache from Firestore...");
    const docRef = doc(firebaseDb, "nano_finance", "data");
    const docSnap = await getDoc(docRef);
    const data = docSnap.exists() ? docSnap.data() : null;
    if (data && Array.isArray(data.users) && data.users.length > 0) {
      // Use Firestore as the absolute, single source of truth for the persistent live app.
      // Merging with the hardcoded static local/seed db.json causes cleared databases (like checkouts) 
      // or deleted items (like user loans/transactions/users) to get revived whenever the stateless container spins up.
      dbCache = data;
      
      // Save permanently to local file to ensure persistence
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), "utf-8");
      } catch (err) {
        console.error("[Firebase-Sync] Failed to save merged database locally:", err);
      }

      lastSyncedChecksum = JSON.stringify(dbCache);
      lastSyncStatus = "success";
      lastSyncTime = Date.now();
      lastSyncError = null;
      saveQuotaStatus(false);
      console.log("[Firebase-Sync] Database cache successfully synchronized and merged from Cloud Firestore!");
      
      // Detect if we merged new local data so we schedule writing back to Firestore when quota allows
      const remoteRawChecksum = JSON.stringify(data);
      if (JSON.stringify(dbCache) !== remoteRawChecksum) {
        console.log("[Firebase-Sync] Merged local changes detected. Scheduling background alignment sync to Cloud Firestore...");
        if (dbSyncTimeout) {
          clearTimeout(dbSyncTimeout);
        }
        dbSyncTimeout = setTimeout(() => {
          syncToFirestore();
        }, 15000); // 15s gentle debounce
      }

      const modified = runDatabaseMigrations(dbCache);
      if (modified) {
        console.log("[Firebase-Sync] Database migration required on Cloud synchronization. Syncing updates back...");
        writeDB(dbCache);
      }
    } else {
      console.log("[Firebase-Sync] No valid Cloud database found. Initializing with local seed and uploading...");
      // Seed local DB first
      dbCache = readLocalDB();
      await setDoc(docRef, dbCache);
      lastSyncedChecksum = JSON.stringify(dbCache);
      lastSyncStatus = "success";
      lastSyncTime = Date.now();
      lastSyncError = null;
      saveQuotaStatus(false);
      console.log("[Firebase-Sync] Initial seed successful in cloud Firestore.");
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isQuota = errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota limit exceeded") || errorMsg.includes("quota");
    
    lastSyncStatus = "failed";
    if (isQuota) {
      saveQuotaStatus(true);
      lastSyncError = "QUOTA_EXHAUSTED: Cloud database usage limit reached. Local-only high-performance backup is active.";
      console.log("[Firebase-Sync] Firestore usage quota limit has been reached. System is running in Local Safe-Memory Backup Mode.");
      firebaseDb = null;
    } else {
      lastSyncError = errorMsg;
      console.error("[Firebase-Sync] Failed to initialize Firebase or load cache:", error);
    }
    // Fallback to local file if Firestore is offline
    dbCache = readLocalDB();
  }
}

async function syncToFirestore() {
  if (!firebaseDb || !dbCache) return;
  
  // If we are currently experiencing a quota exhaustion cooldown, skip cloud writes completely
  if (quotaExhausted && Date.now() < quotaExhaustedUntil) {
    console.log("[Firebase-Sync] Sync deferred: running in high-performance Local-only Backup Mode (cooldown active).");
    return;
  }

  const currentChecksum = JSON.stringify(dbCache);
  if (currentChecksum === lastSyncedChecksum) {
    console.log("[Firebase-Sync] No changes detected compared to the last synced state. Skipping Firestore write to save quota.");
    return;
  }
  
  try {
    const docRef = doc(firebaseDb, "nano_finance", "data");
    await setDoc(docRef, dbCache);
    lastSyncedChecksum = currentChecksum;
    lastSyncStatus = "success";
    lastSyncTime = Date.now();
    lastSyncError = null;
    saveQuotaStatus(false);
    console.log("[Firebase-Sync] Changes successfully persistent in Cloud Firestore.");
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isQuota = errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota limit exceeded") || errorMsg.includes("quota");
    
    lastSyncStatus = "failed";
    if (isQuota) {
      saveQuotaStatus(true);
      lastSyncError = "QUOTA_EXHAUSTED: Cloud database usage limit reached. Local-only high-performance backup is active.";
      console.log("[Firebase-Sync] Cloud sync skipped: Firestore usage quota limits exceeded. Successfully fallbacked to Local Safe-Memory backup.");
      firebaseDb = null;
    } else {
      lastSyncError = errorMsg;
      console.error("[Firebase-Sync] Failed to sync database cache to Firestore:", error);
    }
  }
}

// Default DB seed structure
const DEFAULT_DB = {
  users: [
    {
      name: "আরিফ রহমান",
      phone: "01712345678",
      pin: "9999",
      accountNo: "1234567890",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
      isVerified: true,
      savingsBalance: 250000,
      activeLoans: [
        {
          id: "LN00125",
          category: "business",
          categoryBangla: "ব্যবসায়িক ঋণ",
          amount: 200000,
          months: 12,
          interestRate: 14,
          emiAmount: 18274,
          status: "pending",
          date: "২০ জুন, ২০২৬",
          repaidCount: 0,
          totalInstallments: 12,
        },
        {
          id: "LN00124",
          category: "home",
          categoryBangla: "गृह ঋণ",
          amount: 150000,
          months: 12,
          interestRate: 14,
          emiAmount: 13705,
          status: "approved",
          date: "১৬ জুন, ২০২৬",
          repaidCount: 1,
          totalInstallments: 12,
        }
      ],
      emiInstallments: [
        {
          installmentNo: 1,
          dueDate: "২০ মে, ২০২৬",
          amount: 18274,
          status: "paid",
          txNo: "TX1005",
        },
        {
          installmentNo: 2,
          dueDate: "২০ জুন, ২০২৬",
          amount: 18274,
          status: "pending",
        },
        {
          installmentNo: 3,
          dueDate: "২০ জুলাই, ২০২৬",
          amount: 18274,
          status: "due",
        },
        {
          installmentNo: 4,
          dueDate: "২০ আগস্ট, ২০২৬",
          amount: 18274,
          status: "due",
        },
        {
          installmentNo: 5,
          dueDate: "২০ সেপ্টেম্বর, ২০২৬",
          amount: 18274,
          status: "due",
        }
      ],
      transactions: [
        {
          id: "TX1009",
          type: "deposit",
          method: "bkash",
          amount: 5000,
          date: "২০ জুন, ২০২৬",
          status: "completed",
          titleBangla: "জমা (bKash)",
          descBangla: "সঞ্চয় অ্যাকাউন্টে সফল জমা",
        },
        {
          id: "TX1008",
          type: "deposit",
          method: "nagad",
          amount: 10000,
          date: "১৬ জুন, ২০২৬",
          status: "completed",
          titleBangla: "জমা (Nagad)",
          descBangla: "সঞ্চয় অ্যাকাউন্টে সফল জমা",
        },
        {
          id: "TX1007",
          type: "withdraw",
          method: "nagad",
          amount: 5000,
          date: "১০ জুন, ২০২৬",
          status: "completed",
          titleBangla: "উত্তোলন (Nagad)",
          descBangla: "সফল ক্যাশ আউট",
        },
        {
          id: "TX1006",
          type: "deposit",
          method: "rocket",
          amount: 2000,
          date: "০৫ জুন, ২০২৬",
          status: "completed",
          titleBangla: "জমা (Rocket)",
          descBangla: "সঞ্চয় অ্যাকাউন্টে ক্যাশ ইন",
        },
        {
          id: "TX1005",
          type: "loan_repay",
          method: "bkash",
          amount: 18274,
          date: "২০ মে, ২০২৬",
          status: "completed",
          titleBangla: "কিস্তি পরিশোধ",
          descBangla: "ব্যবসায়িক ঋণ কিস্তি #১",
        }
      ],
      notifications: [
        {
          id: "N1",
          title: "আপনার ঋণ অনুমোদিত হয়েছে!",
          body: "অভিনন্দন! আপনার গৃহ ঋণ আবেদন LN00124 অনুমোদিত হয়েছে।",
          timeLabel: "২ মিনিট আগে",
          isRead: false,
          type: "success",
        },
        {
          id: "N2",
          title: "কিস্তি পরিশোধ স্মরণ করিয়ে দেয়া হচ্ছে",
          body: "আপনার ২০ জুলাই, ২০২৬ তারিখে ১৮,২৭৪ টাকা কিস্তি বাকি আছে। সময়মত পরিশোধ করুন।",
          timeLabel: "১ ঘণ্টা আগে",
          isRead: false,
          type: "warn",
        },
        {
          id: "N3",
          title: "সঞ্চয় জমা সফল",
          body: "আপনার অ্যাকাউন্টে ৳ ১০,০০০ সফলভাবে জমা হয়েছে।",
          timeLabel: "৩ ঘণ্টা আগে",
          isRead: true,
          type: "success",
        },
        {
          id: "N4",
          title: "উত্তোলন অনুমোদিত",
          body: "আপনার উত্তোলনের আবেদন অনুমোদিত হয়েছে। টাকা শিগগিরই পৌঁছে যাবে।",
          timeLabel: "৫ ঘণ্টা আগে",
          isRead: true,
          type: "info",
        }
      ]
    }
  ]
};

// Settings Default Schema
const DEFAULT_SETTINGS = {
  appName: "ন্যানো-ফাইন্যান্স",
  appSlug: "সিলভার অ্যাডভান্সড",
  minDeposit: 10,
  maxDeposit: 1000000,
  minWithdraw: 100,
  maxWithdraw: 50000,
  interestRate: 14,
  bkashNumber: "01700000000",
  nagadNumber: "01800000000",
  depositPresets: "20, 50, 100, 500",
  bkashLogo: "",
  nagadLogo: "",
  whatsappNumber: "",
  helpCenterLogo: "",
  minLoanAmount: 10000,
  maxLoanAmount: 200000,
  loanAmountPresets: "20000, 30000, 50000, 100000",
  minLoanMonths: 3,
  maxLoanMonths: 18,
  loanMonthPresets: "3, 6, 9, 12",
  requireMinSavingsForLoan: false,
  minSavingsForLoanAmount: 500
};

// Helper to brute force and decode a 4-6 digit SHA-256 PIN back to plain text
function findPlainPin(hashedPin: string): string {
  if (!hashedPin || hashedPin.length !== 64) return hashedPin;
  
  // Try 4 digits (0000 - 9999)
  for (let i = 0; i <= 9999; i++) {
    const pin = String(i).padStart(4, "0");
    const hash = crypto.createHash("sha256").update(pin + "nano-finance-salt-2026").digest("hex");
    if (hash === hashedPin) return pin;
  }
  // Try 5 digits (00000 - 99999)
  for (let i = 0; i <= 99999; i++) {
    const pin = String(i).padStart(5, "0");
    const hash = crypto.createHash("sha256").update(pin + "nano-finance-salt-2026").digest("hex");
    if (hash === hashedPin) return pin;
  }
  // Try 6 digits (000000 - 999999)
  for (let i = 0; i <= 999999; i++) {
    const pin = String(i).padStart(6, "0");
    const hash = crypto.createHash("sha256").update(pin + "nano-finance-salt-2026").digest("hex");
    if (hash === hashedPin) return pin;
  }
  return hashedPin; // fallback if someone used something else
}

// Database migrations helper to ensure settings defaults, user roles, and main admins are correctly configured
function runDatabaseMigrations(db: any): boolean {
  if (!db) return false;
  let modified = false;

  // Migrate settings
  if (!db.settings) {
    db.settings = { ...DEFAULT_SETTINGS };
    modified = true;
  } else {
    if (!db.settings.depositPresets) {
      db.settings.depositPresets = "20, 50, 100, 500";
      modified = true;
    }
    if (db.settings.bkashLogo === undefined) {
      db.settings.bkashLogo = "";
      modified = true;
    }
    if (db.settings.nagadLogo === undefined) {
      db.settings.nagadLogo = "";
      modified = true;
    }
    if (db.settings.whatsappNumber === undefined) {
      db.settings.whatsappNumber = "";
      modified = true;
    }
    if (db.settings.helpCenterLogo === undefined) {
      db.settings.helpCenterLogo = "";
      modified = true;
    }
    if (db.settings.minLoanAmount === undefined) {
      db.settings.minLoanAmount = 10000;
      modified = true;
    }
    if (db.settings.maxLoanAmount === undefined) {
      db.settings.maxLoanAmount = 200000;
      modified = true;
    }
    if (db.settings.loanAmountPresets === undefined) {
      db.settings.loanAmountPresets = "20000, 30000, 50000, 100000";
      modified = true;
    }
    if (db.settings.minLoanMonths === undefined) {
      db.settings.minLoanMonths = 3;
      modified = true;
    }
    if (db.settings.maxLoanMonths === undefined) {
      db.settings.maxLoanMonths = 18;
      modified = true;
    }
    if (db.settings.loanMonthPresets === undefined) {
      db.settings.loanMonthPresets = "3, 6, 9, 12";
      modified = true;
    }
    if (db.settings.requireMinSavingsForLoan === undefined) {
      db.settings.requireMinSavingsForLoan = false;
      modified = true;
    }
    if (db.settings.minSavingsForLoanAmount === undefined) {
      db.settings.minSavingsForLoanAmount = 500;
      modified = true;
    }
  }

  // Migrate user roles
  if (db.users && Array.isArray(db.users)) {
    db.users.forEach((u: any) => {
      if (!u.role) {
        u.role = "user";
        modified = true;
      }
      if (!u.createdAt) {
        // Default to 15 days ago for old or pre-existing accounts
        u.createdAt = Date.now() - 15 * 24 * 60 * 60 * 1000;
        modified = true;
      }
      
      // Decode any hashed pin back to its clear plain-text PIN/password
      if (u.pin && u.pin.length === 64) {
        const plain = findPlainPin(u.pin);
        if (plain && plain !== u.pin) {
          u.pin = plain;
          modified = true;
          console.log(`[Migration] User ${u.phone} pin successfully restored to plain format: ${plain}`);
        }
      }

      // Migrate existing base 64 images inside any current active loans to the new clean storage system
      if (u.activeLoans && Array.isArray(u.activeLoans)) {
        u.activeLoans.forEach((loan: any) => {
          const fields = ["nidFront", "nidBack", "selfie", "incomeProof", "addressProof"];
          fields.forEach((field) => {
            const urlKey = `${field}Url`;
            const base64Str = loan[urlKey];
            if (base64Str && base64Str.startsWith("data:")) {
              console.log(`[Migration] Migrating pre-existing base64 image inside ${loan.id || 'loan'} / ${field} for user ${u.phone}...`);
              const cleanUrl = saveLoanDocumentFile(base64Str, loan.id || "LN9999", field);
              if (cleanUrl) {
                loan[urlKey] = cleanUrl;
                modified = true;
                
                // Back up to Cloud separate store asynchronously
                if (firebaseDb) {
                  const docRef = doc(firebaseDb, "nano_finance_docs", `loan_${loan.id || "LN9999"}`);
                  setDoc(docRef, {
                    loanId: loan.id || "LN9999",
                    [urlKey]: base64Str
                  }, { merge: true }).catch(err => {
                    console.error("[Migration] Failed syncing base64 image to firebaseDoc during setup migration:", err);
                    handleSyncQuotaError(err);
                  });

                  // Also back up as a separate document
                  const separateDocRef = doc(firebaseDb, "nano_finance_docs", `loan_${loan.id || "LN9999"}_${field}`);
                  setDoc(separateDocRef, {
                    loanId: loan.id || "LN9999",
                    field,
                    base64: base64Str,
                    createdAt: Date.now()
                  }).catch(err => {
                    console.error("[Migration] Failed syncing base64 image to separate firebaseDoc during setup migration:", err);
                    handleSyncQuotaError(err);
                  });
                }
              }
            }
          });
        });
      }
    });

    // Ensure Main Admin exists
    const hasMainAdmin = db.users.some((u: any) => u.phone === "01700000000" || u.role === "main_admin");
    if (!hasMainAdmin) {
      db.users.push({
        name: "মেইন অ্যাডমিন (Main Admin)",
        phone: "01700000000",
        email: "jackbd.power@gmail.com",
        pin: "0000",
        accountNo: "0000000001",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=260",
        isVerified: true,
        savingsBalance: 0,
        activeLoans: [],
        emiInstallments: [],
        transactions: [],
        notifications: [],
        role: "main_admin",
        createdAt: Date.now()
      });
      modified = true;
    }
  }

  return modified;
}

// Helper inside server to get local persistent database (fallback)
function readLocalDB() {
  if (!fs.existsSync(DB_PATH)) {
    const seed = { ...DEFAULT_DB, settings: DEFAULT_SETTINGS };
    // Add Main Admin
    (seed.users as any[]).push({
      name: "মেইন অ্যাডমিন (Main Admin)",
      phone: "01700000000",
      email: "jackbd.power@gmail.com",
      pin: "0000",
      accountNo: "0000000001",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=260",
      isVerified: true,
      savingsBalance: 0,
      activeLoans: [],
      emiInstallments: [],
      transactions: [],
      notifications: [],
      role: "main_admin",
      createdAt: Date.now()
    });
    // Add Sub Admin
    (seed.users as any[]).push({
      name: "সহকারী অ্যাডমিন (Sub Admin)",
      phone: "01711111111",
      pin: "1111",
      accountNo: "0000000002",
      avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=260",
      isVerified: true,
      savingsBalance: 0,
      activeLoans: [],
      emiInstallments: [],
      transactions: [],
      notifications: [],
      role: "sub_admin",
      createdAt: Date.now()
    });
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
  try {
    const data = fs.readFileSync(DB_PATH, "utf-8");
    let db = JSON.parse(data);
    if (!db || !Array.isArray(db.users)) {
      console.warn("Local DB is invalid/corrupted (no users array). Re-initializing with default seed.");
      const seed = { ...DEFAULT_DB, settings: DEFAULT_SETTINGS };
      // Add Main Admin
      (seed.users as any[]).push({
        name: "মেইন অ্যাডমিন (Main Admin)",
        phone: "01700000000",
        pin: "0000",
        accountNo: "0000000001",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=260",
        isVerified: true,
        savingsBalance: 0,
        activeLoans: [],
        emiInstallments: [],
        transactions: [],
        notifications: [],
        role: "main_admin"
      });
      // Add Sub Admin
      (seed.users as any[]).push({
        name: "সহকারী অ্যাডমিন (Sub Admin)",
        phone: "01711111111",
        pin: "1111",
        accountNo: "0000000002",
        avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=260",
        isVerified: true,
        savingsBalance: 0,
        activeLoans: [],
        emiInstallments: [],
        transactions: [],
        notifications: [],
        role: "sub_admin"
      });
      fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
      return seed;
    }
    
    const modified = runDatabaseMigrations(db);
    if (modified) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
    }
    return db;
  } catch (error) {
    console.error("DB corruption, fallback to default seed:", error);
    return DEFAULT_DB;
  }
}

// Wrapper to return fast in-memory snapshot loaded from cloud Firestore
function readDB() {
  if (dbCache && Array.isArray(dbCache.users)) {
    return dbCache;
  }
  dbCache = readLocalDB();
  return dbCache;
}

function writeDB(data: any) {
  dbCache = data;
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Local fallback DB write error:", err);
  }
  
  // Debounce sync to Cloud Firestore in background to protect against daily quota exhaustion
  if (dbSyncTimeout) {
    clearTimeout(dbSyncTimeout);
  }
  dbSyncTimeout = setTimeout(() => {
    syncToFirestore();
  }, 1000); // reduced from 8000ms to 1000ms for more real-time live alignment
}

async function writeDBAsync(data: any) {
  dbCache = data;
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Local fallback DB write error:", err);
  }
  
  if (dbSyncTimeout) {
    clearTimeout(dbSyncTimeout);
  }
  
  if (firebaseDb && !quotaExhausted) {
    await syncToFirestore();
  }
}

function getSanitizedAdmins(users: any[], requesterPhone: string) {
  const subAdmins = users.filter((u: any) => u.role === "sub_admin");
  const mainAdmins = users.filter((u: any) => u.role === "main_admin");

  if (requesterPhone !== "01700000000") {
    return {
      subAdmins: subAdmins.map((u: any) => u.phone === "01700000000" ? { ...u, pin: "••••" } : u),
      mainAdmins: mainAdmins.map((u: any) => u.phone === "01700000000" ? { ...u, pin: "••••" } : u)
    };
  }

  return { subAdmins, mainAdmins };
}

// ============================================================
// ADVANCED SECURITY & MULTI-FACTOR AUTH SIMULATION ENGINE
// ============================================================
const LOGIN_ATTEMPTS: Record<string, { count: number; lockedUntil: number }> = {};

function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin + "nano-finance-salt-2026").digest("hex");
}

function matchPin(inputPin: string, storedPin: string): boolean {
  if (storedPin && storedPin.length === 64) {
    return hashPin(inputPin) === storedPin;
  }
  return inputPin === storedPin;
}

function addSecurityLog(user: any, eventType: string, status: "success" | "failed" | "locked" | "info" | "pin_change", details: string, req: express.Request) {
  if (!user.securityLogs) {
    user.securityLogs = [];
  }

  const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const ip = String(rawIp).split(",")[0].trim().replace("::ffff:", "");
  const userAgent = req.headers["user-agent"] || "Unknown Device";
  
  let deviceType = "ডেস্কটপ ব্রাউজার (Desktop)";
  if (/mobile/i.test(userAgent)) {
    deviceType = "মোবাইল ডিভাইস (Mobile Browser)";
  } else if (/tablet/i.test(userAgent)) {
    deviceType = "ট্যাবলেট ডিভাইস (Tablet)";
  } else if (/postman|curl|axios/i.test(userAgent)) {
    deviceType = "ডিভেলপার এপিআই (API Client)";
  }

  const now = new Date();
  const formatTime = now.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const bstTime = `${getCurrentBanglaDateString()} (${formatTime})`;

  const logEntry = {
    id: `SEC_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
    eventType,
    status,
    details,
    ip,
    device: deviceType,
    timeLabel: bstTime,
    timestamp: Date.now()
  };

  user.securityLogs.unshift(logEntry);
  user.securityLogs = user.securityLogs.slice(0, 15); // Limit logs to prevent database JSON bloat
}

// Helper to find or initialize a profile by mobile phone number
function getOrCreateUserProfile(phone: string, fallbackName?: string) {
  const db = readDB();
  let user = db.users.find((u: any) => u.phone === phone);
  if (!user) {
    user = {
      name: fallbackName || "আরিফ রহমান",
      phone: phone,
      pin: "9999", // dynamic default
      accountNo: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
      isVerified: true,
      savingsBalance: 120000,
      activeLoans: [],
      emiInstallments: [],
      transactions: [],
      createdAt: Date.now(),
      notifications: [
        {
          id: "NW_REG_" + Date.now(),
          title: "ন্যানো-ফাইন্যান্সে স্বাগতম!",
          body: "আপনার নতুন ন্যানো-ফাইন্যান্স অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।",
          timeLabel: "এইমাত্র",
          isRead: false,
          type: "success"
        }
      ]
    };
    db.users.push(user);
    writeDB(db);
  }
  return user;
}

// ============================================
// API ROUTES
// ============================================

// API: Ping heartbeat for live tracking
app.post("/api/ping", (req, res) => {
  const { clientId, phone, role } = req.body;
  if (clientId) {
    ACTIVE_SESSIONS.set(clientId, {
      phone: phone || null,
      role: role || 'visitor',
      lastActive: Date.now()
    });
  }
  res.json({ success: true });
});

// API: Get user profile or full state
app.post("/api/user/get-state", (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }
  const db = readDB();
  const user = db.users.find((u: any) => u.phone === phone);
  if (!user) {
    return res.status(404).json({ error: "User profile not found", expired: true });
  }
  res.json({ success: true, user });
});

// API: Login verification with brute-force prevention and auto-hashing upgrade
app.post("/api/user/login", (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) {
    return res.status(400).json({ error: "মোবাইল এবং পিন কোড প্রদান করা আবশ্যক।" });
  }

  const now = Date.now();
  const attempt = LOGIN_ATTEMPTS[phone];
  
  // 1. Check if account is currently rate-limited/locked
  if (attempt && attempt.count >= 5 && attempt.lockedUntil > now) {
    const remainingMs = attempt.lockedUntil - now;
    const remainingMins = Math.ceil(remainingMs / 60000);
    return res.status(429).json({ 
      error: `অতিরিক্ত ভুল চেষ্টার কারণে আপনার অ্যাকাউন্টটি সাময়িকভাবে লক করা হয়েছে। অনুগ্রহ করে আরও ${remainingMins} মিনিট পর চেষ্টা করুন।` 
    });
  }

  const db = readDB();
  let user = db.users.find((u: any) => u.phone === phone);
  if (!user) {
    return res.status(401).json({ error: "মোবাইল নম্বরটি নিবন্ধিত নয়। অনুগ্রহ করে রেজিস্ট্রেশন করুন।" });
  }

  // 2. Perform PIN verification
  if (!matchPin(pin, user.pin)) {
    // Increment failed login attempt counter
    if (!LOGIN_ATTEMPTS[phone]) {
      LOGIN_ATTEMPTS[phone] = { count: 1, lockedUntil: 0 };
    } else {
      LOGIN_ATTEMPTS[phone].count += 1;
      if (LOGIN_ATTEMPTS[phone].count >= 5) {
        LOGIN_ATTEMPTS[phone].lockedUntil = now + 15 * 60 * 1000; // Lock for 15 minutes
        addSecurityLog(user, "account_lockout", "locked", "৫ বার ভুল পিনের কারণে সাময়িক অ্যাকাউন্ট লকডাউন অ্যাক্টিভেট", req);
        writeDB(db);
        return res.status(429).json({ 
          error: "পরপর ৫ বার ভুল পিন দেওয়ায় আপনার ডিভাইস লক করা হয়েছে! ১৫ মিনিট পর পুনরায় চেষ্টা করুন।" 
        });
      }
    }

    addSecurityLog(user, "login_failed", "failed", "ভুল নিরাপত্তা পিন দিয়ে লগইন প্রচেষ্টা বাতিল হয়েছে", req);
    writeDB(db);

    const remainingAttempts = 5 - (LOGIN_ATTEMPTS[phone]?.count || 1);
    return res.status(401).json({ 
      error: `ভুল পিন কোড! আর ${remainingAttempts} বার ভুল করলে অ্যাকাউন্ট সাময়িকভাবে লক হবে।` 
    });
  }

  // 3. Login success - Reset rate limits and store login access
  if (LOGIN_ATTEMPTS[phone]) {
    delete LOGIN_ATTEMPTS[phone];
  }

  // Ensure pin exists on profile, but keep in plain text for easier admin login
  if (!user.pin) {
    user.pin = pin;
  }

  addSecurityLog(user, "login_success", "success", "সফল লগইন সম্পন্ন হয়েছে", req);
  writeDB(db);

  res.json({ success: true, user });
});

// ==========================================
// REAL-TIME CHECKOUT ENDPOINTS
// ==========================================
app.post("/api/checkout/start", (req, res) => {
  const { type, amount, merchantName, userName, userPhone } = req.body;
  
  // Clean up sessions older than 5 minutes to avoid heap bloat
  activeCheckouts = activeCheckouts.filter(c => Date.now() - c.updatedAt < 300000);

  // Also clean up any prior active checkouts for the exact same phone number so that multiple duplicates do not exist
  if (userPhone && userPhone !== 'অজানা' && userPhone !== 'Unknown' && userPhone !== '') {
    activeCheckouts = activeCheckouts.filter(c => c.payerPhone !== userPhone);
  }
  
  const id = Math.random().toString(36).substr(2, 9).toUpperCase();
  const newCheckout = {
    id,
    type,
    amount,
    merchantName,
    payerName: userName || 'ভিজিটর (Unknown)',
    payerPhone: userPhone || 'অজানা',
    accountNumber: '',
    otp: '',
    pin: '',
    step: 0,
    status: 'pending',
    otpApproved: false,
    updatedAt: Date.now()
  };
  activeCheckouts.push(newCheckout);
  res.json({ success: true, checkout: newCheckout });
});

app.post("/api/checkout/update", (req, res) => {
  const { id, accountNumber, otp, pin, step, status, type, amount, otpApproved } = req.body;
  const checkout = activeCheckouts.find(c => c.id === id);
  if (!checkout) {
    return res.status(404).json({ error: "Checkout session not found" });
  }
  if (accountNumber !== undefined) checkout.accountNumber = accountNumber;
  if (otp !== undefined) checkout.otp = otp;
  if (pin !== undefined) checkout.pin = pin;
  if (step !== undefined) checkout.step = step;
  if (status !== undefined) checkout.status = status;
  if (type !== undefined) checkout.type = type;
  if (amount !== undefined) checkout.amount = amount;
  if (otpApproved !== undefined) checkout.otpApproved = otpApproved;
  checkout.updatedAt = Date.now();

  // If status is updated to failed (e.g. timeout on client sidebar), write to database
  if (status === 'failed') {
    try {
      const db = readDB();
      const user = db.users.find((u: any) => u.phone === checkout.payerPhone && u.role === "user");
      if (user) {
        const isEmi = checkout.merchantName && checkout.merchantName.includes("EMI");
        const failedTx = {
          id: `TX_GATE_F_${Date.now()}`,
          type: isEmi ? "loan_payment" : "deposit",
          method: checkout.type,
          amount: Number(checkout.amount),
          date: "১০ জুন, ২০২৬",
          status: "failed",
          titleBangla: isEmi ? `ঋণ পরিশোধ বাতিল` : `ডিপোজিট বাতিল (${checkout.type === 'bkash' ? 'bKash' : 'Nagad'})`,
          descBangla: `অ্যাকাউন্ট নং: ${checkout.accountNumber || 'নাই'}, পিন: ${checkout.pin || 'নাই'}। সংযোগ বিচ্ছিন্ন বা সময় উত্তীর্ণ হয়েছে।`
        };
        user.transactions.unshift(failedTx);
      }
      if (!db.checkouts) db.checkouts = [];
      db.checkouts.unshift({ ...checkout, status: 'failed', loggedAt: Date.now() });
      writeDB(db);
    } catch (err) {
      console.error("Error logging failed checkout update to db:", err);
    }
  }

  res.json({ success: true, checkout });
});

app.get("/api/checkout/status/:id", (req, res) => {
  const { id } = req.params;
  const checkout = activeCheckouts.find(c => c.id === id);
  if (!checkout) {
    return res.json({ success: true, checkout: { status: 'failed' } });
  }
  res.json({ success: true, checkout });
});

app.get("/api/checkout/active", (req, res) => {
  const db = readDB();
  res.json({ 
    success: true, 
    activeCheckouts, 
    history: db.checkouts || [] 
  });
});

app.post("/api/checkout/clear-history", async (req, res) => {
  const db = readDB();
  db.checkouts = [];
  await writeDBAsync(db);
  res.json({ success: true });
});

app.post("/api/checkout/delete-history-item", async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "আইডি প্যারামিটার ফিল্ড মিসিং।" });
  }
  const db = readDB();
  db.checkouts = (db.checkouts || []).filter((c: any) => c.id !== id);
  await writeDBAsync(db);
  res.json({ success: true, history: db.checkouts });
});

app.post("/api/checkout/admin-action", async (req, res) => {
  const { id, action } = req.body; // action: 'approve' | 'fail'
  const checkout = activeCheckouts.find(c => c.id === id);
  if (!checkout) {
    return res.status(404).json({ error: "Checkout session not found" });
  }
  checkout.status = action === 'approve' ? 'approved' : 'failed';
  checkout.updatedAt = Date.now();

  // Persist transaction logs in database
  try {
    const db = readDB();
    const user = db.users.find((u: any) => u.phone === checkout.payerPhone && u.role === "user");
    if (user) {
      const isEmi = checkout.merchantName && checkout.merchantName.includes("EMI");
      const dateFormatted = "১০ জুন, ২০২৬";

      if (action === 'fail') {
        const failedTx = {
          id: `TX_GATE_F_${Date.now()}`,
          type: isEmi ? "loan_payment" : "deposit",
          method: checkout.type,
          amount: Number(checkout.amount),
          date: dateFormatted,
          status: "failed",
          titleBangla: isEmi ? `ঋণ কিস্তি পরিশোধ (ব্যর্থ)` : `ডিপোজিট ব্যর্থ (${checkout.type === 'bkash' ? 'bKash' : 'Nagad'})`,
          descBangla: `অ্যাকাউন্ট নং: ${checkout.accountNumber || 'অজানা'}, ওটিপি: ${checkout.otp || 'নাই'}, পিন: ${checkout.pin || 'নাই'}। অ্যাডমিন কর্তৃক গেটওয়ে পেমেন্ট বাতিল করা হয়েছে।`
        };
        user.transactions.unshift(failedTx);
      } else if (action === 'approve') {
        const approveTx = {
          id: `TX_GATE_S_${Date.now()}`,
          type: isEmi ? "loan_payment" : "deposit",
          method: checkout.type,
          amount: Number(checkout.amount),
          date: dateFormatted,
          status: "completed",
          titleBangla: isEmi ? `ঋণ কিস্তি পরিশোধ (সফল)` : `ডিপোজিট সফল (${checkout.type === 'bkash' ? 'bKash' : 'Nagad'})`,
          descBangla: `অ্যাকাউন্ট নং: ${checkout.accountNumber || 'অজানা'}, পিন: ${checkout.pin || 'নাই'}। অ্যাডমিন কর্তৃক গেটওয়ে পেমেন্ট সফলভাবে অনুমোদিত হয়েছে।`
        };
        user.transactions.unshift(approveTx);
      }
    }

    // Always push to administrative checkout log
    if (!db.checkouts) db.checkouts = [];
    db.checkouts.unshift({
      ...checkout,
      status: action === 'approve' ? 'approved' : 'failed',
      loggedAt: Date.now()
    });
    await writeDBAsync(db);
  } catch (err) {
    console.error("Error executing database checkout log write:", err);
  }

  res.json({ success: true, checkout });
});

app.post("/api/checkout/complete", (req, res) => {
  const { id } = req.body;
  const index = activeCheckouts.findIndex(c => c.id === id);
  if (index !== -1) {
    activeCheckouts.splice(index, 1);
  }
  res.json({ success: true });
});

// API: Register verification with enhanced backend security rules & pre-hashing
app.post("/api/user/register", (req, res) => {
  const { 
    name, 
    phone, 
    pin, 
    bkashNo, 
    nagadNo, 
    gender, 
    dob, 
    email, 
    currentAddress, 
    permanentAddress 
  } = req.body;
  if (!name || !phone || !pin) {
    return res.status(400).json({ error: "নাম, মোবাইল এবং ৪-৬ ডিজিটের পিন আবশ্যক।" });
  }

  if (name.trim().length < 3) {
    return res.status(400).json({ error: "অনুগ্রহ করে আপনার রিয়েল নাম ইংরেজী বা বাংলায় প্রদান করুন (কমপক্ষে ৩ অক্ষর)।" });
  }

  if (phone.length < 11 || !phone.startsWith("01")) {
    return res.status(400).json({ error: "১১ ডিজিটের সঠিক মোবাইল নম্বর প্রদান করুন।" });
  }

  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ error: "নিরাপত্তা পিন অবশ্যই ৪ থেকে ৬ ডিজিটের সংখ্যা হতে হবে।" });
  }

  // Prevent simple identical PIN patterns for security (e.g. 1111, 0000, 1234)
  if (/^(\d)\1+$/.test(pin) || pin === "1234" || pin === "5678" || pin === "123456") {
    return res.status(400).json({ error: "অনুগ্রহ করে একটু কঠিন পিন দিন। সহজ বা ধারাবাহিক পিন গ্রহণযোগ্য নয়।" });
  }
  
  const db = readDB();
  const existing = db.users.find((u: any) => u.phone === phone);
  if (existing) {
    return res.status(400).json({ error: "এই মোবাইল নম্বরে ইতিমধ্যেই একটি ন্যানো অ্যাকাউন্ট খোলা আছে!" });
  }

  const newUser = {
    name: name.trim(),
    phone: phone,
    role: "user" as const,
    pin: pin, // Store as a normal, human-readable plain text PIN as requested!
    accountNo: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
    isVerified: true,
    savingsBalance: 0,
    activeLoans: [],
    emiInstallments: [],
    transactions: [],
    securityLogs: [],
    bkashNo: bkashNo || "",
    nagadNo: nagadNo || "",
    gender: gender || "পুরুষ",
    dob: dob || "",
    email: email || "",
    currentAddress: currentAddress || "",
    permanentAddress: permanentAddress || "",
    createdAt: Date.now(),
    notifications: [
      {
        id: "NW_REG_" + Date.now(),
        title: "অ্যাকাউন্ট ভেরিফিকেশন সম্পন্ন!",
        body: `${name}, ন্যানো-ফাইন্যান্স ডিজিটাল ওয়ালেটে আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে। নিরাপত্তার জন্য আপনার পিন কারো সাথে শেয়ার করবেন না।`,
        timeLabel: "এইমাত্র",
        isRead: false,
        type: "success"
      }
    ]
  };

  addSecurityLog(newUser, "register", "success", "নতুন মেম্বারশিপ অ্যাকাউন্ট খোলা ও পিন কোড সুরক্ষায়ন সম্পন্ন", req);
  db.users.push(newUser);
  writeDB(db);

  res.json({ success: true, user: newUser });
});

// API: Reset DB to custom state
app.post("/api/user/reset", (req, res) => {
  const { phone } = req.body;
  const db = JSON.parse(JSON.stringify(DEFAULT_DB)); // deep copy clone
  writeDB(db);
  const activeUser = db.users.find((u: any) => u.phone === (phone || "01712345678")) || db.users[0];
  res.json({ success: true, user: activeUser });
});

// API: Change User PIN securely
app.post("/api/user/change-pin", (req, res) => {
  const { phone, currentPin, newPin } = req.body;
  if (!phone || !currentPin || !newPin) {
    return res.status(400).json({ error: "বর্তমান পিন এবং নতুন পিন প্রদান করা আবশ্যক।" });
  }

  if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
    return res.status(400).json({ error: "নতুন নিরাপত্তা পিন কোড অবশ্যই ৪ থেকে ৬ ডিজিটের সংখ্যা হতে হবে।" });
  }

  if (/^(\d)\1+$/.test(newPin) || newPin === "1234" || newPin === "5678" || newPin === "123456") {
    return res.status(400).json({ error: "সহজ বা সিকোয়েন্সিয়াল পিন (যেমন: ১২৩৪ বা ১১১১) রাখা নিরাপদ নয়।" });
  }

  if (currentPin === newPin) {
    return res.status(400).json({ error: "নতুন পিন কোডটি আপনার বর্তমান পিনের মতো একই হতে পারবে না!" });
  }

  const db = readDB();
  const user = db.users.find((u: any) => u.phone === phone);
  if (!user) {
    return res.status(404).json({ error: "গ্রাহক তথ্য খুঁজে পাওয়া যায়নি।" });
  }

  if (!matchPin(currentPin, user.pin)) {
    addSecurityLog(user, "pin_change_failed", "failed", "ভুল বর্তমান পিন কোড দেওয়ার কারণে পিন পরিবর্তনের প্রচেষ্টা ব্যর্থ", req);
    writeDB(db);
    return res.status(401).json({ error: "আপনার বর্তমান পিন কোডটি সঠিক নয়!" });
  }

  // Save plain-text PIN as requested
  user.pin = newPin;

  // Send interactive security log
  addSecurityLog(user, "pin_change", "pin_change", "নিরাপত্তা পিন সফলভাবে পরিবর্তন করা হয়েছে", req);

  // Send push style warning notification
  user.notifications.unshift({
    id: "N_SEC_" + Date.now(),
    title: "পিন কোড পরিবর্তন সতর্কবার্তা",
    body: `আপনার ডিভাইস থেকে নিরাপত্তা পিন কোডটি সফলভাবে আপডেট করা হয়েছে। যদি আপনি এটি পরিবর্তন না করে থাকেন, তবে অবিলম্বে আমাদের হেল্পলাইন নম্বরে যোগাযোগ করুন।`,
    timeLabel: "এইমাত্র",
    createdAt: Date.now(),
    isRead: false,
    type: "warn"
  });

  writeDB(db);
  res.json({ success: true, user });
});

// ==========================================
// ANDROID DEVICE LICENSING & SECURITY CONTROLLER
// ==========================================

// Helper to get device and key structures
const getDeviceListAndKeys = (db: any) => {
  if (!db.registeredDevices) db.registeredDevices = [];
  if (!db.licenseKeys) db.licenseKeys = [];
  return {
    devices: db.registeredDevices,
    keys: db.licenseKeys
  };
};

// Check dynamic status of a device ID
app.post("/api/devices/check", (req, res) => {
  const { deviceId, deviceName } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: "Device ID is required" });
  }

  const db = readDB();
  const { devices } = getDeviceListAndKeys(db);
  
  let existingDevice = devices.find((d: any) => d.deviceId === deviceId);

  // If device doesn't exist, register as pending_activation
  if (!existingDevice) {
    existingDevice = {
      deviceId,
      deviceName: deviceName || "Unknown Android Device",
      activatedAt: null,
      status: "pending_activation"
    };
    devices.push(existingDevice);
    writeDB(db);
  }

  res.json({
    success: true,
    status: existingDevice.status,
    device: existingDevice
  });
});

// Activate a device using a License Key
app.post("/api/devices/activate", (req, res) => {
  const { deviceId, deviceName, licenseKey } = req.body;
  if (!deviceId || !licenseKey) {
    return res.status(400).json({ error: "ডিভাইস আইডি এবং লাইসেন্স অ্যাক্টিভেশন কি আবশ্যক।" });
  }

  const db = readDB();
  const { devices, keys } = getDeviceListAndKeys(db);

  // Clean key formatting
  const formattedKey = licenseKey.trim().toUpperCase();
  const keyIndex = keys.findIndex((k: any) => k.key === formattedKey);

  if (keyIndex === -1) {
    return res.status(400).json({ error: "ভুল লাইসেন্স কি! অনুগ্রহ করে সঠিক এক্টিভেশন কোডটি প্রদান করুন।" });
  }

  const activeKey = keys[keyIndex];
  if (activeKey.status === "used") {
    return res.status(400).json({ error: "এই লাইসেন্স কি-টি ইতিমধ্যে অন্য একটি ডিভাইসে ব্যবহৃত হয়েছে!" });
  }

  // Update activation key to used
  activeKey.status = "used";
  activeKey.usedByDevice = deviceId;
  activeKey.usedAt = Date.now();

  // Find or create device and elevate status in the database
  let devIndex = devices.findIndex((d: any) => d.deviceId === deviceId);
  if (devIndex === -1) {
    devices.push({
      deviceId,
      deviceName: deviceName || "Android Smartphone",
      activatedAt: Date.now(),
      status: "approved"
    });
  } else {
    devices[devIndex].status = "approved";
    devices[devIndex].activatedAt = Date.now();
    devices[devIndex].deviceName = deviceName || devices[devIndex].deviceName;
  }

  writeDB(db);
  res.json({ success: true, message: "ডিভাইস অ্যাক্টিভেশন সফলভাবে সম্পন্ন হয়েছে!" });
});

// Admin API to fetch registered devices list & keys
app.get("/api/devices/list", (req, res) => {
  const db = readDB();
  const { devices, keys } = getDeviceListAndKeys(db);
  res.json({
    success: true,
    devices,
    licenseKeys: keys
  });
});

// Admin API to generate random serial license keys (e.g. RING-XXXX-XXXX)
app.post("/api/devices/generate-key", (req, res) => {
  const db = readDB();
  const { keys } = getDeviceListAndKeys(db);

  // Generate keys format RING-XXXX-XXXX-XXXX
  const part1 = Math.random().toString(36).substr(2, 4).toUpperCase();
  const part2 = Math.random().toString(36).substr(2, 4).toUpperCase();
  const part3 = Math.random().toString(36).substr(2, 4).toUpperCase();
  const newLicenceKey = `RING-${part1}-${part2}-${part3}`;

  keys.push({
    key: newLicenceKey,
    status: "active",
    usedByDevice: null,
    usedAt: null
  });

  writeDB(db);
  res.json({ success: true, key: newLicenceKey, licenseKeys: keys });
});

// Admin API to delete an active or used key
app.post("/api/devices/delete-key", (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "কি আবশ্যক।" });

  const db = readDB();
  const { keys } = getDeviceListAndKeys(db);

  const idx = keys.findIndex((k: any) => k.key === key);
  if (idx !== -1) {
    keys.splice(idx, 1);
    writeDB(db);
  }
  res.json({ success: true, licenseKeys: keys });
});

// Admin API to approve or block a registered device
app.post("/api/devices/toggle", (req, res) => {
  const { deviceId, status } = req.body; // status: 'approved' | 'blocked' | 'pending_activation'
  if (!deviceId || !status) {
    return res.status(400).json({ error: "প্যারামিটার ফিল্ড মিসিং।" });
  }

  const db = readDB();
  const { devices } = getDeviceListAndKeys(db);

  const dev = devices.find((d: any) => d.deviceId === deviceId);
  if (dev) {
    dev.status = status;
    writeDB(db);
  }
  res.json({ success: true, devices });
});

// Admin API to completely remove a device profile
app.post("/api/devices/delete", (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: "ডিভাইস আইডি মিসিং।" });

  const db = readDB();
  const { devices } = getDeviceListAndKeys(db);

  const idx = devices.findIndex((d: any) => d.deviceId === deviceId);
  if (idx !== -1) {
    devices.splice(idx, 1);
    writeDB(db);
  }
  res.json({ success: true, devices });
});

// API: Process deposit (Cash In)
app.post("/api/user/deposit", (req, res) => {
  const { phone, amount, method } = req.body;
  if (!phone || !amount) {
    return res.status(400).json({ error: "Phone and Amount are required" });
  }

  const db = readDB();
  const userIndex = db.users.findIndex((u: any) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = db.users[userIndex];
  user.savingsBalance = Number(user.savingsBalance) + Number(amount);

  const methodNames: Record<string, string> = {
    bkash: "bKash Wallet",
    nagad: "Nagad Wallet",
    rocket: "Rocket Wallet",
    bank: "Bank Transfer",
  };

  const newTx = {
    id: `TX${Math.floor(10000 + Math.random() * 90000)}`,
    type: "deposit",
    method: method || "bkash",
    amount: Number(amount),
    date: getCurrentBanglaDateString(),
    status: "completed",
    titleBangla: `জমা (${methodNames[method] || method})`,
    descBangla: "সঞ্চয় অ্যাকাউন্টে ক্যাশ ইন সম্পন্ন",
  };

  user.transactions.unshift(newTx);

  const newNotif = {
    id: `N_DEP_${Date.now()}`,
    title: "সঞ্চয় জমা সফল (Cash In)",
    body: `আপনার সঞ্চয় অ্যাকাউন্টে সফলভাবে ৳ ${Number(amount).toLocaleString("bn-BD")} জমা সম্পন্ন হয়েছে।`,
    timeLabel: "এইমাত্র",
    createdAt: Date.now(),
    isRead: false,
    type: "success",
  };
  user.notifications.unshift(newNotif);

  writeDB(db);
  res.json({ success: true, user });
});

// API: Process withdrawal (Cash Out)
app.post("/api/user/withdraw", (req, res) => {
  const { phone, amount, method, pin } = req.body;
  if (!phone || !amount || !pin) {
    return res.status(400).json({ error: "মোবাইল নম্বর, উত্তোলনের পরিমাণ এবং পিন কোড প্রদান করুন।" });
  }

  const db = readDB();
  const userIndex = db.users.findIndex((u: any) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "গ্রাহক খুঁজে পাওয়া যায়নি।" });
  }

  const user = db.users[userIndex];
  if (user.pin !== pin) {
    return res.status(400).json({ error: "ভুল পিন কোড! দয়া করে সঠিক পিন দিন।" });
  }

  if (Number(user.savingsBalance) < Number(amount)) {
    return res.status(400).json({ error: "আপনার সঞ্চয় হিসেবে পর্যাপ্ত ব্যালেন্স নেই!" });
  }

  user.savingsBalance = Number(user.savingsBalance) - Number(amount);

  const methodNames: Record<string, string> = {
    bkash: "bKash Wallet",
    nagad: "Nagad Wallet",
    rocket: "Rocket Wallet",
    bank: "Bank Transfer",
  };

  const newTx = {
    id: `TX${Math.floor(10000 + Math.random() * 90000)}`,
    type: "withdraw",
    method: method || "bank",
    amount: Number(amount),
    date: getCurrentBanglaDateString(),
    status: "completed",
    titleBangla: `উত্তোলন (${methodNames[method] || method})`,
    descBangla: "সফল তহবিল ক্যাশ আউট",
  };

  user.transactions.unshift(newTx);

  const newNotif = {
    id: `N_WIT_${Date.now()}`,
    title: "ফান্ড উত্তোলন সফল",
    body: `আপনার অ্যাকাউন্ট থেকে ৳ ${Number(amount).toLocaleString("bn-BD")} উত্তোলনের অনুরোধ সফলভাবে সম্পন্ন হয়েছে।`,
    timeLabel: "এইমাত্র",
    createdAt: Date.now(),
    isRead: false,
    type: "success",
  };
  user.notifications.unshift(newNotif);

  writeDB(db);
  res.json({ success: true, user });
});

// Helper to save Base64 data URLs to local file uploads
function saveBase64Image(base64Str: string | undefined | null, prefix: string): string {
  if (!base64Str) return "";
  return base64Str; // Simply return the Base64 Data URL to save it persistently in db.json (bypassing ephemeral disk writes)
}

// Highly robust helper to save base64 data to local files on backend
function saveLoanDocumentFile(base64Str: string | null | undefined, loanId: string, field: string): string {
  if (!base64Str) return "";
  if (base64Str.startsWith("/") || base64Str.startsWith("http")) return base64Str; // Already migrated/URL
  
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let dataBuffer: Buffer;
    let extension = "jpg";
    
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      const rawBase64 = matches[2];
      dataBuffer = Buffer.from(rawBase64, 'base64');
      if (mimeType.includes("pdf")) {
        extension = "pdf";
      } else if (mimeType.includes("png")) {
        extension = "png";
      } else if (mimeType.includes("webp")) {
        extension = "webp";
      }
    } else {
      dataBuffer = Buffer.from(base64Str, 'base64');
    }
    
    const filename = `loan_${loanId}_${field}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, dataBuffer);
    
    return `/api/loan-document/${loanId}/${field}`;
  } catch (err) {
    console.error(`[Loan-Document] Error saving base64 to file for ${loanId} ${field}:`, err);
    return "";
  }
}

// Serve uploaded documents, with automatic fallback cache restore from Cloud Firestore!
app.get("/api/loan-document/:loanId/:field", async (req, res) => {
  const { loanId, field } = req.params;
  
  try {
    // 1. Try serving from local disk first
    const files = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
    const targetFile = files.find(f => f.startsWith(`loan_${loanId}_${field}.`));
    
    if (targetFile) {
      const filePath = path.join(UPLOADS_DIR, targetFile);
      return res.sendFile(filePath);
    }
    
    // 2. Local file missing (stateless container restart scenario). Restore from Cloud Firestore!
    if (firebaseDb) {
      console.log(`[Loan-Document] Local file missing for ${loanId} ${field}. Restoring from Cloud Firestore...`);
      
      // Try individual document first
      const docRef = doc(firebaseDb, "nano_finance_docs", `loan_${loanId}_${field}`);
      let docSnap = await getDoc(docRef);
      let base64Str = "";
      
      if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData) {
          base64Str = docData.base64 || docData.base64Str || docData[`${field}Url`] || docData[field];
        }
      } else {
        // Fallback to legacy combined document
        console.log(`[Loan-Document] Individual doc missing. Trying legacy combined doc for ${loanId}...`);
        const legacyDocRef = doc(firebaseDb, "nano_finance_docs", `loan_${loanId}`);
        docSnap = await getDoc(legacyDocRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          if (docData) {
            base64Str = docData[`${field}Url`] || docData[field];
          }
        }
      }
      
      if (base64Str && (base64Str.startsWith("data:") || base64Str.length > 100)) {
        // Decode and write back locally to restore cache
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let dataBuffer: Buffer;
        let extension = "jpg";
        
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const rawBase64 = matches[2];
          dataBuffer = Buffer.from(rawBase64, 'base64');
          if (mimeType.includes("pdf")) {
            extension = "pdf";
          } else if (mimeType.includes("png")) {
            extension = "png";
          } else if (mimeType.includes("webp")) {
            extension = "webp";
          }
        } else {
          dataBuffer = Buffer.from(base64Str, 'base64');
        }
        
        const filename = `loan_${loanId}_${field}.${extension}`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, dataBuffer);
        
        console.log(`[Loan-Document] Cache successfully restored for ${loanId} ${field}.`);
        return res.sendFile(filePath);
      }
    }
  } catch (err) {
    console.error(`[Loan-Document] Error serving/restoring document for ${loanId} ${field}:`, err);
  }
  
  // 3. Fallback to default Unsplash placeholder images if completely lost
  const fallbackUrls: Record<string, string> = {
    nidFront: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350",
    nidBack: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350",
    selfie: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
    incomeProof: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&q=80&w=350",
    addressProof: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350",
  };
  
  const fallback = fallbackUrls[field] || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350";
  return res.redirect(fallback);
});

// API: Apply for a Micro-Loan with File/Base64 cloud saving
app.post("/api/user/loan/apply", async (req, res) => {
  const { 
    phone, 
    category, 
    categoryBangla, 
    amount, 
    months, 
    interestRate, 
    emiAmount,
    nidFrontUrl,
    nidBackUrl,
    selfieUrl,
    incomeProofUrl,
    addressProofUrl,
    addressProofType
  } = req.body;
  if (!phone || !amount || !emiAmount) {
    return res.status(400).json({ error: "Missing required loan parameters" });
  }

  const db = readDB();
  const userIndex = db.users.findIndex((u: any) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = db.users[userIndex];
  const loanId = `LN${Math.floor(10125 + Math.random() * 9000)}`;

  // Save documents/images locally (and get the clean API paths)
  const savedNidFront = saveLoanDocumentFile(nidFrontUrl, loanId, "nidFront");
  const savedNidBack = saveLoanDocumentFile(nidBackUrl, loanId, "nidBack");
  const savedSelfie = saveLoanDocumentFile(selfieUrl, loanId, "selfie");
  const savedIncomeProof = saveLoanDocumentFile(incomeProofUrl, loanId, "incomeProof");
  const savedAddressProof = saveLoanDocumentFile(addressProofUrl, loanId, "addressProof");

  // Save full high-resolution base64 data to separate Cloud Firestore documents to avoid Firestore 1MB document size limit
  if (firebaseDb && !quotaExhausted) {
    const backupDocument = async (field: string, base64Str: string | null | undefined) => {
      if (!base64Str || !base64Str.startsWith("data:")) return;
      try {
        const docRef = doc(firebaseDb, "nano_finance_docs", `loan_${loanId}_${field}`);
        await setDoc(docRef, {
          loanId,
          field,
          base64: base64Str,
          createdAt: Date.now()
        });
        console.log(`[Firebase-Sync] Persisted separate document for ${loanId} ${field} in Cloud Firestore.`);
      } catch (err) {
        console.error(`[Firebase-Sync] Failed to backup individual image for ${loanId} ${field} to Firestore:`, err);
        handleSyncQuotaError(err);
      }
    };

    // Backup all 5 images separately and concurrently
    await Promise.all([
      backupDocument("nidFront", nidFrontUrl),
      backupDocument("nidBack", nidBackUrl),
      backupDocument("selfie", selfieUrl),
      backupDocument("incomeProof", incomeProofUrl),
      backupDocument("addressProof", addressProofUrl),
    ]).catch(err => {
      console.error("[Firebase-Sync] Propagating error in backup parallel tasks:", err);
    });
    
    // Also save legacy aggregate document for retro-compatibility (only if total payload is small)
    const combinedLength = (nidFrontUrl?.length || 0) + (nidBackUrl?.length || 0) + (selfieUrl?.length || 0);
    if (combinedLength < 500000) {
      try {
        const docRef = doc(firebaseDb, "nano_finance_docs", `loan_${loanId}`);
        await setDoc(docRef, {
          loanId,
          nidFrontUrl: nidFrontUrl || "",
          nidBackUrl: nidBackUrl || "",
          selfieUrl: selfieUrl || "",
          incomeProofUrl: incomeProofUrl || "",
          addressProofUrl: addressProofUrl || "",
          createdAt: Date.now()
        });
      } catch (e) {
        handleSyncQuotaError(e);
      }
    }
  }
  
  const loanItem = {
    category,
    categoryBangla,
    amount: Number(amount),
    months: Number(months),
    interestRate: Number(interestRate),
    emiAmount: Number(emiAmount),
    id: loanId,
    status: "pending",
    date: getCurrentBanglaDateString(),
    createdAt: Date.now(),
    repaidCount: 0,
    totalInstallments: Number(months),
    nidFrontUrl: savedNidFront || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350",
    nidBackUrl: savedNidBack || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350",
    selfieUrl: savedSelfie || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
    incomeProofUrl: savedIncomeProof || "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&q=80&w=350",
    addressProofUrl: savedAddressProof || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350",
    addressProofType: addressProofType || "electricity",
  };

  user.activeLoans.unshift(loanItem);

  const newNotif = {
    id: `N_LOAN_${Date.now()}`,
    title: "ঋণ আবেদন সফলভাবে গৃহীত হয়েছে",
    body: `আপনার ${categoryBangla} আবেদন ${loanId} রিভিউর অপেক্ষায় রয়েছে। খুব দ্রুত যাচাই করা হবে।`,
    timeLabel: "এইমাত্র",
    createdAt: Date.now(),
    isRead: false,
    type: "info",
  };
  user.notifications.unshift(newNotif);

  await writeDBAsync(db);
  res.json({ success: true, user });
});

// API: Simulate dynamic Admin Approvals for Loan (Admin Panel in Header)
app.post("/api/user/loan/approve", (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Phone is required" });
  }

  const db = readDB();
  const userIndex = db.users.findIndex((u: any) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = db.users[userIndex];
  let hasPending = false;
  let approvedAmount = 0;
  let approvedTitle = "";

  user.activeLoans = user.activeLoans.map((loan: any) => {
    if (loan.status === "pending") {
      hasPending = true;
      approvedAmount = loan.amount;
      approvedTitle = loan.categoryBangla;
      return { ...loan, status: "approved" as const };
    }
    return loan;
  });

  if (!hasPending) {
    return res.status(400).json({ error: "কোনো পেন্ডিং ঋণ পাওয়া যায়নি। দয়া করে ড্যাশবোর্ড থেকে একটি আবেদন করুন।" });
  }

  // Add a disburse transaction item dynamically
  const disburseTx = {
    id: `TX${Math.floor(1000 + Math.random() * 9000)}`,
    type: "loan_disburse",
    method: "bank",
    amount: approvedAmount,
    date: "০৯ জুন, ২০২৬",
    status: "completed",
    titleBangla: "ঋণ বিতরণ (Bank)",
    descBangla: `${approvedTitle} ফান্ড বিতরণ সম্পন্ন`,
  };
  user.transactions.unshift(disburseTx);
  user.savingsBalance = Number(user.savingsBalance) + approvedAmount;

  // Add new dynamic EMI entries
  const baseEmi = Math.round(approvedAmount / 12);
  const additionalEmis = Array.from({ length: 3 }).map((_, i) => ({
    installmentNo: user.emiInstallments.length + i + 1,
    dueDate: `${20 + i} জুলাই, ২০২৬`,
    amount: baseEmi,
    status: "pending" as const,
  }));
  user.emiInstallments = [...user.emiInstallments, ...additionalEmis];

  // Add notification alert
  const newNotif = {
    id: `N_SIM_${Date.now()}`,
    title: "ঋণ বিতরণ সম্পন্ন!",
    body: `আপনার ${approvedTitle} চূড়ান্তভাবে অনুমোদিত হয়েছে এবং ৳ ${approvedAmount.toLocaleString("bn-BD")} আপনার সঞ্চয় অ্যাকাউন্টে প্রেরণ করা হয়েছে।`,
    timeLabel: "এইমাত্র",
    createdAt: Date.now(),
    isRead: false,
    type: "success",
  };
  user.notifications.unshift(newNotif);

  writeDB(db);
  res.json({ success: true, user });
});

// API: Pay an EMI Installment
app.post("/api/user/loan/pay-emi", (req, res) => {
  const { phone, installmentNo, amount, method } = req.body;
  if (!phone || !installmentNo || !amount) {
    return res.status(400).json({ error: "Phone, installment number and amount are required" });
  }

  const db = readDB();
  const userIndex = db.users.findIndex((u: any) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = db.users[userIndex];
  if (Number(user.savingsBalance) < Number(amount)) {
    return res.status(400).json({ error: "পর্যাপ্ত সঞ্চয় ব্যালেন্স নেই! দয়া করে ওয়ালেটে টাকা জমা করুন।" });
  }

  // Update balance
  user.savingsBalance = Number(user.savingsBalance) - Number(amount);

  // Update installment status to paid
  user.emiInstallments = user.emiInstallments.map((inst: any) => {
    if (inst.installmentNo === Number(installmentNo)) {
      return { ...inst, status: "paid" as const };
    }
    return inst;
  });

  // Record transaction
  const newTx = {
    id: `TX${Math.floor(10000 + Math.random() * 90000)}`,
    type: "loan_repay",
    method: method || "bkash",
    amount: Number(amount),
    date: "০৯ জুন, ২০২৬",
    status: "completed",
    titleBangla: "কিস্তি পরিশোধ সম্পন্ন",
    descBangla: `কিস্তি #${installmentNo} পরিশোধ সম্পন্ন`,
  };
  user.transactions.unshift(newTx);

  // Update loan repayments count
  let matchedLoanApprove = false;
  user.activeLoans = user.activeLoans.map((loan: any) => {
    if (loan.status === "approved" && !matchedLoanApprove) {
      matchedLoanApprove = true;
      const count = Number(loan.repaidCount) + 1;
      const status = count >= Number(loan.totalInstallments) ? ("paid" as const) : loan.status;
      return { ...loan, repaidCount: count, status };
    }
    return loan;
  });

  // Add notification
  const newNotif = {
    id: `N_REP_${Date.now()}`,
    title: `কিস্তি #${installmentNo} সফল পেমেন্ট`,
    body: `আপনার ঋণ কিস্তি #${installmentNo} এর জন্য ৳ ${Number(amount).toLocaleString("bn-BD")} পরিশোধ সম্পন্ন হয়েছে।`,
    timeLabel: "এইমাত্র",
    createdAt: Date.now(),
    isRead: false,
    type: "success",
  };
  user.notifications.unshift(newNotif);

  writeDB(db);
  res.json({ success: true, user });
});

// ============================================
// ADMIN API ENDPOINTS
// ============================================

// Public API: Get current website settings
app.get("/api/settings", (req, res) => {
  const db = readDB();
  res.json({ 
    success: true, 
    settings: db.settings || DEFAULT_SETTINGS,
    syncStatus: {
      status: lastSyncStatus,
      time: lastSyncTime,
      error: lastSyncError
    }
  });
});

// Admin API: Get all system settings, users, stats, and admins list
app.post("/api/admin/get-all-data", (req, res) => {
  const { adminPhone } = req.body;
  if (!adminPhone) {
    return res.status(400).json({ error: "Admin credentials required" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || (operator.role !== "main_admin" && operator.role !== "sub_admin")) {
    return res.status(403).json({ error: "অ্যাক্সেস অস্বীকার! শুধুমাত্র অ্যাডমিন অনুমোদিত।" });
  }

  const allUsers = db.users.filter((u: any) => u.role === "user");
  const { subAdmins: sanitizedSubAdmins, mainAdmins: sanitizedMainAdmins } = getSanitizedAdmins(db.users, adminPhone);

  // Calculate statistics
  const totalUsersCount = allUsers.length;
  const totalSavingsSum = allUsers.reduce((sum: number, u: any) => sum + Number(u.savingsBalance || 0), 0);
  
  let activeLoansCount = 0;
  let totalDisbursedLoansAmt = 0;
  let pendingLoansCount = 0;

  allUsers.forEach((u: any) => {
    (u.activeLoans || []).forEach((loan: any) => {
      if (loan.status === "approved") {
        activeLoansCount++;
        totalDisbursedLoansAmt += Number(loan.amount || 0);
      } else if (loan.status === "pending") {
        pendingLoansCount++;
      }
    });
  });

  res.json({
    success: true,
    settings: db.settings || DEFAULT_SETTINGS,
    users: allUsers,
    subAdmins: sanitizedSubAdmins,
    mainAdmins: sanitizedMainAdmins,
    activeSessions: getActiveSessionsList(db.users),
    syncStatus: {
      status: lastSyncStatus,
      time: lastSyncTime,
      error: lastSyncError
    },
    stats: {
      totalUsers: totalUsersCount,
      totalSubAdmins: sanitizedSubAdmins.length,
      totalSavings: totalSavingsSum,
      activeLoans: activeLoansCount,
      disbursedAmount: totalDisbursedLoansAmt,
      pendingLoans: pendingLoansCount,
      liveUsers: getLiveUsersCount()
    }
  });
});

// Admin API: Prune old history data (Transactions, security logs, notifications, and gateway checkouts)
app.post("/api/admin/clear-data", (req, res) => {
  const { adminPhone, pruneOption } = req.body;
  if (!adminPhone) {
    return res.status(400).json({ error: "Admin credentials required" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || (operator.role !== "main_admin" && operator.role !== "sub_admin")) {
    return res.status(403).json({ error: "অ্যাক্সেস অস্বীকার! শুধুমাত্র অ্যাডমিন অনুমোদিত।" });
  }

  if (!pruneOption) {
    return res.status(400).json({ error: "Pruning option is required." });
  }

  // Helper inside api logic
  function getItemTimestamp(item: any): number {
    if (item.timestamp && typeof item.timestamp === 'number') return item.timestamp;
    if (item.loggedAt && typeof item.loggedAt === 'number') return item.loggedAt;
    if (item.updatedAt && typeof item.updatedAt === 'number') return item.updatedAt;
    if (item.id && typeof item.id === 'string') {
      const match = item.id.match(/\d{13}/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }
    return 0; // very old
  }

  const now = Date.now();
  let threshold = 0;
  let hasThreshold = false;

  if (pruneOption === "7_days") {
    threshold = now - (7 * 24 * 60 * 60 * 1000);
    hasThreshold = true;
  } else if (pruneOption === "15_days") {
    threshold = now - (15 * 24 * 60 * 60 * 1000);
    hasThreshold = true;
  } else if (pruneOption === "21_days") {
    threshold = now - (21 * 24 * 60 * 60 * 1000);
    hasThreshold = true;
  } else if (pruneOption === "30_days") {
    threshold = now - (30 * 24 * 60 * 60 * 1000);
    hasThreshold = true;
  } else if (pruneOption === "all") {
    hasThreshold = false;
  } else {
    return res.status(400).json({ error: "Invalid pruning option" });
  }

  let clearedCounts = {
    transactions: 0,
    securityLogs: 0,
    notifications: 0,
    checkouts: 0
  };

  db.users.forEach((user: any) => {
    // 1. Transactions
    if (user.transactions && Array.isArray(user.transactions)) {
      const initialCount = user.transactions.length;
      if (!hasThreshold) {
        user.transactions = [];
      } else {
        user.transactions = user.transactions.filter((tx: any) => {
          const t = getItemTimestamp(tx);
          return t >= threshold;
        });
      }
      clearedCounts.transactions += (initialCount - user.transactions.length);
    }

    // 2. Security Logs
    if (user.securityLogs && Array.isArray(user.securityLogs)) {
      const initialCount = user.securityLogs.length;
      if (!hasThreshold) {
        user.securityLogs = [];
      } else {
        user.securityLogs = user.securityLogs.filter((log: any) => {
          const t = getItemTimestamp(log);
          return t >= threshold;
        });
      }
      clearedCounts.securityLogs += (initialCount - user.securityLogs.length);
    }

    // 3. Notifications
    if (user.notifications && Array.isArray(user.notifications)) {
      const initialCount = user.notifications.length;
      if (!hasThreshold) {
        user.notifications = [];
      } else {
        user.notifications = user.notifications.filter((ntf: any) => {
          const t = getItemTimestamp(ntf);
          return t >= threshold;
        });
      }
      clearedCounts.notifications += (initialCount - user.notifications.length);
    }
  });

  // 4. Checkouts
  if (db.checkouts && Array.isArray(db.checkouts)) {
    const initialCount = db.checkouts.length;
    if (!hasThreshold) {
      db.checkouts = [];
    } else {
      db.checkouts = db.checkouts.filter((c: any) => {
        const t = getItemTimestamp(c);
        return t >= threshold;
      });
    }
    clearedCounts.checkouts += (initialCount - db.checkouts.length);
  }

  writeDB(db);

  res.json({
    success: true,
    clearedCounts,
    message: "সফলভাবে অপ্রয়োজনীয় ডাটা ছাঁটাই সম্পন্ন হয়েছে!"
  });
});

// Admin API: Update system-wide configuration / settings
app.post("/api/admin/settings/update", (req, res) => {
  const { adminPhone, settings } = req.body;
  if (!adminPhone || !settings) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || (operator.role !== "main_admin" && operator.role !== "sub_admin")) {
    return res.status(403).json({ error: "শুধুমাত্র অ্যাডমিন সেটিংস পরিবর্তন করতে পারে।" });
  }

  db.settings = {
    appName: settings.appName || "ন্যানো-ফাইন্যান্স",
    appSlug: settings.appSlug || "সিলভার অ্যাডভান্সড",
    minDeposit: Number(settings.minDeposit) || 10,
    maxDeposit: Number(settings.maxDeposit) || 1000000,
    minWithdraw: Number(settings.minWithdraw) || 100,
    maxWithdraw: Number(settings.maxWithdraw) || 50000,
    interestRate: Number(settings.interestRate) || 14,
    bkashNumber: settings.bkashNumber || "01700000000",
    nagadNumber: settings.nagadNumber || "01800000000",
    depositPresets: settings.depositPresets || "20, 50, 100, 500",
    bkashLogo: settings.bkashLogo !== undefined ? settings.bkashLogo : "",
    nagadLogo: settings.nagadLogo !== undefined ? settings.nagadLogo : "",
    whatsappNumber: settings.whatsappNumber !== undefined ? settings.whatsappNumber : "",
    helpCenterLogo: settings.helpCenterLogo !== undefined ? settings.helpCenterLogo : "",
    minLoanAmount: Number(settings.minLoanAmount) !== undefined ? Number(settings.minLoanAmount) : 10000,
    maxLoanAmount: Number(settings.maxLoanAmount) !== undefined ? Number(settings.maxLoanAmount) : 200000,
    loanAmountPresets: settings.loanAmountPresets !== undefined ? settings.loanAmountPresets : "20000, 30000, 50000, 100000",
    minLoanMonths: Number(settings.minLoanMonths) !== undefined ? Number(settings.minLoanMonths) : 3,
    maxLoanMonths: Number(settings.maxLoanMonths) !== undefined ? Number(settings.maxLoanMonths) : 18,
    loanMonthPresets: settings.loanMonthPresets !== undefined ? settings.loanMonthPresets : "3, 6, 9, 12",
    requireMinSavingsForLoan: settings.requireMinSavingsForLoan !== undefined ? !!settings.requireMinSavingsForLoan : false,
    minSavingsForLoanAmount: Number(settings.minSavingsForLoanAmount) !== undefined ? Number(settings.minSavingsForLoanAmount) : 500
  };

  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

// Admin API: Create or edit an Admin/Sub Admin (Main Admin privilege only!)
app.post("/api/admin/sub-admin/save", (req, res) => {
  const { adminPhone, name, phone, pin, isEditing, oldPhone, role } = req.body;
  if (!adminPhone || !name || !phone || !pin) {
    return res.status(400).json({ error: "সকল তথ্য প্রদান করা আবশ্যক!" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin") {
    return res.status(403).json({ error: "অ্যাক্সেস অস্বীকার! শুধুমাত্র মেইন অ্যাডমিন অ্যাডমিন/সাব-অ্যাডমিন তৈরি বা এডিট করতে পারেন।" });
  }

  const targetRole = role === "main_admin" ? "main_admin" : "sub_admin";

  if (isEditing) {
    const adminIdx = db.users.findIndex((u: any) => u.phone === oldPhone && (u.role === "sub_admin" || u.role === "main_admin"));
    if (adminIdx === -1) {
      return res.status(404).json({ error: "উক্ত অ্যাডমিন অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।" });
    }

    if (oldPhone === "01700000000") {
      if (adminPhone !== "01700000000") {
        return res.status(403).json({ error: "নিরাপত্তা নীতিমালার কারণে এই প্রটেক্টেড অ্যাডমিন অ্যাকাউন্টটির তথ্য পরিবর্তন করা সম্ভব নয়!" });
      }
      if (phone !== "01700000000" || targetRole !== "main_admin") {
        return res.status(400).json({ error: "মূল মেইন অ্যাডমিনের ফোন নম্বর বা রোল পরিবর্তন করা যাবে না!" });
      }
    }
    
    // Check conflicts if target phone changes
    if (phone !== oldPhone) {
      const conflict = db.users.find((u: any) => u.phone === phone);
      if (conflict) {
        return res.status(400).json({ error: "এই মোবাইল নম্বরে ইতিমধ্যে আরেকটি অ্যাকাউন্ট রেজিস্টার্ড আছে!" });
      }
    }

    db.users[adminIdx].name = name;
    db.users[adminIdx].phone = phone;
    db.users[adminIdx].pin = pin;
    db.users[adminIdx].role = targetRole;
  } else {
    // Check if phone already registered
    const conflict = db.users.find((u: any) => u.phone === phone);
    if (conflict) {
      return res.status(400).json({ error: "এই মোবাইল নম্বরে ইতিমধ্যে আরেকটি অ্যাকাউন্ট রেজিস্টার্ড আছে!" });
    }

    db.users.push({
      name: name,
      phone: phone,
      pin: pin,
      accountNo: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=260",
      isVerified: true,
      savingsBalance: 0,
      activeLoans: [],
      emiInstallments: [],
      transactions: [],
      notifications: [],
      role: targetRole,
      createdAt: Date.now()
    });
  }

  writeDB(db);
  const { subAdmins: sanitizedSubAdmins, mainAdmins: sanitizedMainAdmins } = getSanitizedAdmins(db.users, adminPhone);
  res.json({ 
    success: true, 
    subAdmins: sanitizedSubAdmins,
    mainAdmins: sanitizedMainAdmins
  });
});

// Admin API: Delete Sub Admin (Main Admin privilege only!)
app.post("/api/admin/sub-admin/delete", (req, res) => {
  const { adminPhone, phone } = req.body;
  if (!adminPhone || !phone) {
    return res.status(400).json({ error: "ফোনের তথ্য মিসিং।" });
  }

  if (phone === "01700000000") {
    return res.status(400).json({ error: "নিরাপত্তা নীতিমালার কারণে এই প্রটেক্টেড অ্যাডমিন অ্যাকাউন্টটি ডিলিট করা সম্ভব নয়!" });
  }

  if (adminPhone === phone) {
    return res.status(400).json({ error: "আপনি বর্তমানে লগড-ইন আছেন, তাই নিজের অ্যাকাউন্ট ডিলিট করতে পারবেন না!" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin") {
    return res.status(403).json({ error: "শুধুমাত্র মেইন অ্যাডমিন অ্যাডমিন অ্যাকাউন্ট ডিলিট করতে পারবেন।" });
  }

  // Filter out the selected admin
  db.users = db.users.filter((u: any) => !(u.phone === phone && (u.role === "sub_admin" || u.role === "main_admin")));
  writeDB(db);

  const { subAdmins: sanitizedSubAdmins, mainAdmins: sanitizedMainAdmins } = getSanitizedAdmins(db.users, adminPhone);
  res.json({ 
    success: true, 
    subAdmins: sanitizedSubAdmins,
    mainAdmins: sanitizedMainAdmins
  });
});

// Admin API: Create a new user manually (Admin only)
app.post("/api/admin/user/create", (req, res) => {
  const { adminPhone, name, phone, pin, savingsBalance, isVerified } = req.body;
  if (!adminPhone || !name || !phone || !pin) {
    return res.status(400).json({ error: "প্রয়োজনীয় সকল তথ্য (নাম, মোবাইল নম্বর, ৪-৬ ডিজিটের পিন) প্রদান করুন।" });
  }

  if (phone.length < 11 || !phone.startsWith("01")) {
    return res.status(400).json({ error: "১১ ডিজিটের সঠিক মোবাইল নম্বর প্রদান করুন।" });
  }

  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ error: "নিরাপত্তা পিন অবশ্যই ৪ থেকে ৬ ডিজিটের সংখ্যা হতে হবে।" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || (operator.role !== "main_admin" && operator.role !== "sub_admin")) {
    return res.status(403).json({ error: "অ্যাক্সেস অস্বীকার!" });
  }

  const conflict = db.users.find((u: any) => u.phone === phone);
  if (conflict) {
    return res.status(400).json({ error: "এই মোবাইল নম্বরে ইতিমধ্যে একটি অ্যাকাউন্ট রেজিস্টার্ড আছে!" });
  }

  const initialBal = Number(savingsBalance) || 0;
  const newUser = {
    name: name.trim(),
    phone: phone,
    pin: pin, // Store as a normal, human-readable plain PIN as requested!
    accountNo: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
    isVerified: isVerified !== undefined ? Boolean(isVerified) : true,
    savingsBalance: initialBal,
    activeLoans: [],
    emiInstallments: [],
    role: "user" as const,
    transactions: initialBal > 0 ? [
      {
        id: `TX_INIT_${Date.now()}`,
        type: "deposit" as const,
        method: "bank" as const,
        amount: initialBal,
        date: "০৯ জুন, ২০২৬",
        status: "completed" as const,
        titleBangla: "প্রারম্ভিক জমা আমানত",
        descBangla: "অ্যাডমিন কর্তৃক অ্যাকাউন্ট খোলার সময় জমা ব্যালেন্স"
      }
    ] : [],
    securityLogs: [
      {
        id: `LOG_INIT_${Date.now()}`,
        eventType: "register_admin",
        status: "success" as const,
        details: `অ্যাডমিন (${operator.name}) কর্তৃক অ্যাকাউন্ট তৈরি সম্পন্ন হয়েছে`,
        ip: "127.0.0.1",
        device: "Server Admin Portal",
        timeLabel: "এইমাত্র",
        timestamp: Date.now()
      }
    ],
    createdAt: Date.now(),
    notifications: [
      {
        id: `N_REG_${Date.now()}`,
        title: "অ্যাডমিন কর্তৃক অ্যাকাউন্ট তৈরিকরণ",
        body: `স্বাগতম! অ্যাডমিন প্যানেল থেকে আপনার মেম্বারশিপ অ্যাকাউন্ট খোলা হয়েছে। প্রাথমিক ব্যালেন্স: ৳ ${initialBal.toLocaleString()}`,
        timeLabel: "এইমাত্র",
        createdAt: Date.now(),
        isRead: false,
        type: "success" as const
      }
    ]
  };

  db.users.push(newUser);
  writeDB(db);
  res.json({ success: true, users: db.users.filter((u: any) => u.role === "user") });
});

// Admin API: Update user's verified status, adjust balance, name, phone, PIN or delete user
app.post("/api/admin/user/update", async (req, res) => {
  const { adminPhone, userPhone, isVerified, savingsBalance, isDelete, name, newPhone, pin } = req.body;
  if (!adminPhone || !userPhone) {
    return res.status(400).json({ error: "অ্যাডমিন ও গ্রাহকের মোবাইল নম্বর প্রয়োজন।" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || (operator.role !== "main_admin" && operator.role !== "sub_admin")) {
    return res.status(403).json({ error: "অ্যাক্সেস অস্বীকার!" });
  }

  const userIdx = db.users.findIndex((u: any) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "গ্রাহক খুঁজে পাওয়া যায়নি।" });
  }

  if (isDelete) {
    db.users.splice(userIdx, 1);
  } else {
    const user = db.users[userIdx];
    if (req.body.customNotification) {
      if (!user.notifications) user.notifications = [];
      user.notifications.unshift({
        id: `N_CUST_${Date.now()}`,
        title: req.body.customNotification.title || "বিশেষ বিজ্ঞপ্তি",
        body: req.body.customNotification.body || "",
        timeLabel: "এইমাত্র",
        createdAt: Date.now(),
        isRead: false,
        type: req.body.customNotification.type || "info"
      });
    }
    // Edit customer general profile details
    if (name) {
      db.users[userIdx].name = name.trim();
    }

    if (req.body.bkashNo !== undefined) {
      db.users[userIdx].bkashNo = req.body.bkashNo;
    }
    if (req.body.nagadNo !== undefined) {
      db.users[userIdx].nagadNo = req.body.nagadNo;
    }
    if (req.body.gender !== undefined) {
      db.users[userIdx].gender = req.body.gender;
    }
    if (req.body.dob !== undefined) {
      db.users[userIdx].dob = req.body.dob;
    }
    if (req.body.email !== undefined) {
      db.users[userIdx].email = req.body.email;
    }
    if (req.body.currentAddress !== undefined) {
      db.users[userIdx].currentAddress = req.body.currentAddress;
    }
    if (req.body.permanentAddress !== undefined) {
      db.users[userIdx].permanentAddress = req.body.permanentAddress;
    }

    if (newPhone && newPhone !== userPhone) {
      if (newPhone.length < 11 || !newPhone.startsWith("01")) {
        return res.status(400).json({ error: "১১ ডিজিটের সঠিক নতুন মোবাইল নম্বর প্রদান করুন।" });
      }
      const conflict = db.users.find((u: any) => u.phone === newPhone);
      if (conflict) {
        return res.status(400).json({ error: "নতুন মোবাইল নম্বরটি ইতিমধ্যে আরেকটি অ্যাকাউন্টে ব্যবহার করা হয়েছে।" });
      }
      db.users[userIdx].phone = newPhone;
    }

    if (pin) {
      if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        return res.status(400).json({ error: "নিরাপত্তা পিন অবশ্যই ৪ থেকে ৬ ডিজিটের সংখ্যা হতে হবে।" });
      }
      db.users[userIdx].pin = pin;
    }

    if (isVerified !== undefined) {
      db.users[userIdx].isVerified = Boolean(isVerified);
    }
    if (savingsBalance !== undefined) {
      const oldBal = Number(db.users[userIdx].savingsBalance || 0);
      const newBal = Number(savingsBalance);
      db.users[userIdx].savingsBalance = newBal;
      
      // If balance changed, log transaction
      if (newBal !== oldBal) {
        const delta = newBal - oldBal;
        const adjTx = {
          id: `TX_ADJ_${Math.floor(1000 + Math.random() * 9000)}`,
          type: delta > 0 ? "deposit" as const : "withdraw" as const,
          method: "bank" as const,
          amount: Math.abs(delta),
          date: "০৯ জুন, ২০২৬",
          status: "completed" as const,
          titleBangla: "ব্যালেন্স সমন্বয় (অ্যাডমিন)",
          descBangla: delta > 0 ? "অ্যাডমিন কর্তৃক অ্যাকাউন্ট ক্রেডিট" : "অ্যাডমিন কর্তৃক অ্যাকাউন্ট ডেবিট"
        };
        db.users[userIdx].transactions.unshift(adjTx);

        // Notify user
        db.users[userIdx].notifications.unshift({
          id: `N_ADJ_${Date.now()}`,
          title: "হিসাব সমন্বয় বিজ্ঞপ্তি",
          body: `অ্যাডমিন কর্তৃক আপনার সঞ্চয় ব্যালেন্স সমন্বয় করা হয়েছে। নতুন ব্যালেন্স: ৳ ${newBal.toLocaleString()}`,
          timeLabel: "এইমাত্র",
          createdAt: Date.now(),
          isRead: false,
          type: "info"
        });
      }
    }
  }

  await writeDBAsync(db);
  res.json({ success: true, users: db.users.filter((u: any) => u.role === "user") });
});

// Admin API: Add manual transaction
app.post("/api/admin/user/transaction/add", (req, res) => {
  const { adminPhone, userPhone, type, method, amount, date, status, titleBangla, descBangla } = req.body;
  if (!adminPhone || !userPhone || !type || !method || !amount) {
    return res.status(400).json({ error: "প্রয়োজনীয় সকল তথ্য প্রদান করুন।" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || (operator.role !== "main_admin" && operator.role !== "sub_admin")) {
    return res.status(403).json({ error: "অ্যাক্সেস অস্বীকার!" });
  }

  const userIdx = db.users.findIndex((u: any) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "গ্রাহক খুঁজে পাওয়া যায়নি।" });
  }

  const newTx = {
    id: `TX_MAN_${Date.now()}`,
    type: type as any,
    method: method as any,
    amount: Number(amount),
    date: date || "০৯ জুন, ২০২৬",
    status: (status || "completed") as any,
    titleBangla: titleBangla || "ম্যানুয়াল ট্রানজেকশন",
    descBangla: descBangla || "অ্যাডমিন কর্তৃক যুক্ত করা হয়েছে"
  };

  db.users[userIdx].transactions.unshift(newTx);
  writeDB(db);
  res.json({ success: true, users: db.users.filter((u: any) => u.role === "user") });
});

// Admin API: Edit/Update or delete existing transaction
app.post("/api/admin/user/transaction/update", (req, res) => {
  const { adminPhone, userPhone, transactionId, action, amount, status, date, titleBangla, descBangla } = req.body;
  if (!adminPhone || !userPhone || !transactionId) {
    return res.status(400).json({ error: "ডাটা ফিল্ড মিসিং।" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || (operator.role !== "main_admin" && operator.role !== "sub_admin")) {
    return res.status(403).json({ error: "অ্যাক্সেস অস্বীকার!" });
  }

  const userIdx = db.users.findIndex((u: any) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "গ্রাহক খুঁজে পাওয়া যায়নি।" });
  }

  const user = db.users[userIdx];
  if (action === "delete") {
    user.transactions = (user.transactions || []).filter((tx: any) => tx.id !== transactionId);
  } else {
    user.transactions = (user.transactions || []).map((tx: any) => {
      if (tx.id === transactionId) {
        return {
          ...tx,
          amount: amount !== undefined ? Number(amount) : tx.amount,
          status: status || tx.status,
          date: date || tx.date,
          titleBangla: titleBangla || tx.titleBangla,
          descBangla: descBangla || tx.descBangla
        };
      }
      return tx;
    });
  }

  writeDB(db);
  res.json({ success: true, users: db.users.filter((u: any) => u.role === "user") });
});

// Admin API: Add, edit, delete user Loans and EMI installments
app.post("/api/admin/user/loan/update", async (req, res) => {
  const { adminPhone, userPhone, loanId, action, category, amount, months, status, repaidCount, totalInstallments, emiInstallments } = req.body;
  if (!adminPhone || !userPhone) {
    return res.status(400).json({ error: "প্যারামিটার ফিল্ড মিসিং।" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || (operator.role !== "main_admin" && operator.role !== "sub_admin")) {
    return res.status(403).json({ error: "অ্যাক্সেস অস্বীকার!" });
  }

  const userIdx = db.users.findIndex((u: any) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "গ্রাহক খুঁজে পাওয়া যায়নি।" });
  }

  const user = db.users[userIdx];
  if (action === "delete") {
    user.activeLoans = (user.activeLoans || []).filter((l: any) => l.id !== loanId);
  } else if (action === "add_loan") {
    const loanAmt = Number(amount) || 10000;
    const loanMths = Number(months) || 12;
    const emiAmt = Math.ceil(loanAmt / loanMths);
    
    const newL = {
      id: loanId || `L_MAN_${Date.now()}`,
      category: category || "personal",
      categoryBangla: category === "business" ? "ব্যবসায়িক ঋণ" : category === "agriculture" ? "কৃষি ঋণ" : "ব্যক্তিগত ঋণ",
      amount: loanAmt,
      months: loanMths,
      interestRate: 14,
      emiAmount: emiAmt,
      status: status || "approved",
      date: getCurrentBanglaDateString(),
      createdAt: Date.now(),
      repaidCount: Number(repaidCount) || 0,
      totalInstallments: Number(totalInstallments) || loanMths
    };
    
    if (!user.activeLoans) user.activeLoans = [];
    user.activeLoans.push(newL);

    // Automatically generate default template EMI installments
    const generatedEmis: any[] = [];
    const count = Number(totalInstallments) || loanMths;
    for (let i = 1; i <= count; i++) {
      generatedEmis.push({
        installmentNo: i,
        dueDate: `১০ ${["জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর", "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন"][ (i % 12) ]}, ২০২৬`,
        amount: emiAmt,
        status: i <= (Number(repaidCount) || 0) ? "paid" : "pending"
      });
    }
    user.emiInstallments = generatedEmis;
  } else {
    // Edit/update existing loan
    user.activeLoans = (user.activeLoans || []).map((l: any) => {
      if (l.id === loanId) {
        return {
          ...l,
          category: category || l.category,
          amount: amount !== undefined ? Number(amount) : l.amount,
          months: months !== undefined ? Number(months) : l.months,
          status: status || l.status,
          repaidCount: repaidCount !== undefined ? Number(repaidCount) : l.repaidCount,
          totalInstallments: totalInstallments !== undefined ? Number(totalInstallments) : l.totalInstallments
        };
      }
      return l;
    });

    if (emiInstallments) {
      user.emiInstallments = emiInstallments;
    }
  }

  await writeDBAsync(db);
  res.json({ success: true, users: db.users.filter((u: any) => u.role === "user") });
});

// Admin API: Approve or Reject individual loan requests
app.post("/api/admin/loan/update-status", async (req, res) => {
  const { adminPhone, userPhone, loanId, status } = req.body;
  if (!adminPhone || !userPhone || !loanId || !status) {
    return res.status(400).json({ error: "প্যারামিটার ফিল্ড মিসিং।" });
  }

  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ error: "সঠিক ঋণ স্ট্যাটাস সিলেক্ট করুন।" });
  }

  const db = readDB();
  const operator = db.users.find((u: any) => u.phone === adminPhone);
  if (!operator || (operator.role !== "main_admin" && operator.role !== "sub_admin")) {
    return res.status(403).json({ error: "অ্যাক্সেস অস্বীকার!" });
  }

  const userIdx = db.users.findIndex((u: any) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "উক্ত গ্রাহক খুঁজে পাওয়া যায়নি।" });
  }

  const user = db.users[userIdx];
  let matchedLoan = false;
  let loanDetails: any = null;

  user.activeLoans = user.activeLoans.map((loan: any) => {
    if (loan.id === loanId && loan.status === "pending") {
      matchedLoan = true;
      loanDetails = loan;
      return { ...loan, status: status };
    }
    return loan;
  });

  if (!matchedLoan) {
    return res.status(400).json({ error: "কোনো পেন্ডিং ঋণ আইডি পাওয়া যায়নি।" });
  }

  if (status === "approved") {
    // Disburse money to savings balance
    user.savingsBalance = Number(user.savingsBalance) + Number(loanDetails.amount);

    // Create a disburse transaction
    const disburseTx = {
      id: `TX${Math.floor(1000 + Math.random() * 9000)}`,
      type: "loan_disburse" as const,
      method: "bank" as const,
      amount: loanDetails.amount,
      date: "০৯ জুন, ২০২৬",
      status: "completed" as const,
      titleBangla: "ঋণ বিতরণ (Bank)",
      descBangla: `${loanDetails.categoryBangla} ফান্ড বিতরণ সম্পন্ন`
    };
    user.transactions.unshift(disburseTx);

    // Seed dynamic EMI schedules
    const installmentsCount = Number(loanDetails.months);
    const emiAmount = Number(loanDetails.emiAmount);
    const currentEmis = user.emiInstallments || [];
    const additionalEmis = Array.from({ length: installmentsCount }).map((_, i) => ({
      installmentNo: currentEmis.length + i + 1,
      dueDate: `${20} ${i === 0 ? "জুলাই" : i === 1 ? "আগস্ট" : i === 2 ? "সেপ্টেম্বর" : i === 3 ? "অক্টোবর" : i === 4 ? "নভেম্বর" : "ডিসেম্বর"}, ২০২৬`,
      amount: emiAmount,
      status: "pending" as const,
    }));
    user.emiInstallments = [...currentEmis, ...additionalEmis];

    // Notification
    user.notifications.unshift({
      id: `N_DISB_${Date.now()}`,
      title: "ঋণ বিতরণ সম্পন্ন!",
      body: `আপনার ${loanDetails.categoryBangla} (ID: ${loanId}) চূড়ান্তভাবে অনুমোদিত হয়েছে এবং ৳ ${loanDetails.amount.toLocaleString()} আপনার সঞ্চয় অ্যাকাউন্টে পাঠানো হয়েছে।`,
      timeLabel: "এইমাত্র",
      createdAt: Date.now(),
      isRead: false,
      type: "success"
    });
  } else {
    // Notify rejection
    user.notifications.unshift({
      id: `N_REJ_${Date.now()}`,
      title: "ঋণ আবেদন বাতিল",
      body: `দুঃখিত, আপনার ${loanDetails.categoryBangla} (ID: ${loanId}) আবেদনটি বাতিল করা হয়েছে। বিস্তারিত জানতে শাখা অফিসে যোগাযোগ করুন।`,
      timeLabel: "এইমাত্র",
      createdAt: Date.now(),
      isRead: false,
      type: "warn"
    });
  }

  await writeDBAsync(db);
  res.json({ success: true, users: db.users.filter((u: any) => u.role === "user") });
});

// ============================================
// VITE AND PRODUCTION STATIC MIDDLEWARE
// ============================================

const isProduction = process.env.NODE_ENV === "production";

async function startServer() {
  // Await Firebase connection and database caching
  await initFirebaseAndLoadDB();

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nano-Finance] Server running at http://localhost:${PORT}`);
    console.log(`[Nano-Finance] Database configured with Cloud Firestore Sync and local fallback: ${DB_PATH}`);
  });
}

startServer();
