var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_vite = require("vite");
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
var import_supabase_js = require("@supabase/supabase-js");
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 3e3;
app.use(import_express.default.json({ limit: "20mb" }));
app.use(import_express.default.urlencoded({ limit: "20mb", extended: true }));
var UPLOADS_DIR = import_path.default.join(process.cwd(), "uploads");
if (!import_fs.default.existsSync(UPLOADS_DIR)) {
  import_fs.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", import_express.default.static(UPLOADS_DIR));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var DB_PATH = import_path.default.join(process.cwd(), "db.json");
var supabaseClient = null;
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_KEY;
if (supabaseUrl && supabaseKey) {
  supabaseClient = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}
var firebaseDb = null;
var dbCache = null;
var lastSyncedChecksum = "";
var activeCheckouts = [];
var lastSyncStatus = "idle";
var lastSyncTime = 0;
var lastSyncError = null;
var dbSyncTimeout = null;
var quotaExhausted = false;
var quotaExhaustedUntil = 0;
var QUOTA_STATUS_PATH = import_path.default.join(process.cwd(), "quota_status.json");
function loadQuotaStatus() {
  try {
    if (import_fs.default.existsSync(QUOTA_STATUS_PATH)) {
      const data = JSON.parse(import_fs.default.readFileSync(QUOTA_STATUS_PATH, "utf-8"));
      if (data && typeof data.quotaExhaustedUntil === "number") {
        quotaExhaustedUntil = data.quotaExhaustedUntil;
        quotaExhausted = Date.now() < quotaExhaustedUntil;
        if (quotaExhausted) {
          console.log(`[Firebase-Sync] Persisted quota status loaded: Cloud Firestore is on cooldown mode until ${new Date(quotaExhaustedUntil).toISOString()}`);
        }
      }
    }
  } catch (err) {
  }
}
function saveQuotaStatus(exhausted) {
  try {
    quotaExhausted = exhausted;
    if (exhausted) {
      quotaExhaustedUntil = Date.now() + 12 * 60 * 60 * 1e3;
    } else {
      quotaExhaustedUntil = 0;
    }
    import_fs.default.writeFileSync(QUOTA_STATUS_PATH, JSON.stringify({ quotaExhaustedUntil }, null, 2), "utf-8");
  } catch (err) {
  }
}
function handleSyncQuotaError(err) {
  const errorMsg = err?.message || String(err);
  const isQuota = errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota limit exceeded") || errorMsg.includes("quota");
  if (isQuota) {
    saveQuotaStatus(true);
    firebaseDb = null;
    console.log("[Firebase-Sync] Firestore usage quota limit has been reached. System is running in Local Safe-Memory Backup Mode.");
  }
}
var ACTIVE_SESSIONS = /* @__PURE__ */ new Map();
function getActiveSessionsList(allDbUsers) {
  const now = Date.now();
  const list = [];
  for (const [clientId, session] of ACTIVE_SESSIONS.entries()) {
    if (now - session.lastActive > 75e3) {
      ACTIVE_SESSIONS.delete(clientId);
      continue;
    }
    let userDetails = null;
    if (session.phone) {
      const u = allDbUsers.find((user) => user.phone === session.phone);
      if (u) {
        userDetails = {
          name: u.name || "\u0985\u099C\u09BE\u09A8\u09BE \u0997\u09CD\u09B0\u09BE\u09B9\u0995",
          phone: u.phone,
          accountNo: u.accountNo || "N/A",
          role: u.role || "user",
          savingsBalance: u.savingsBalance || 0,
          isVerified: u.isVerified !== false
        };
      }
    }
    list.push({
      clientId,
      phone: session.phone,
      role: session.role,
      lastActive: session.lastActive,
      userDetails
    });
  }
  return list;
}
function getCurrentBanglaDateString() {
  const banglaDigits = ["\u09E6", "\u09E7", "\u09E8", "\u09E9", "\u09EA", "\u09EB", "\u09EC", "\u09ED", "\u09EE", "\u09EF"];
  const banglaMonths = [
    "\u099C\u09BE\u09A8\u09C1\u09DF\u09BE\u09B0\u09BF",
    "\u09AB\u09C7\u09AC\u09CD\u09B0\u09C1\u09DF\u09BE\u09B0\u09BF",
    "\u09AE\u09BE\u09B0\u09CD\u099A",
    "\u098F\u09AA\u09CD\u09B0\u09BF\u09B2",
    "\u09AE\u09C7",
    "\u099C\u09C1\u09A8",
    "\u099C\u09C1\u09B2\u09BE\u0987",
    "\u0986\u0997\u09B8\u09CD\u099F",
    "\u09B8\u09C7\u09AA\u09CD\u099F\u09C7\u09AE\u09CD\u09AC\u09B0",
    "\u0985\u0995\u09CD\u099F\u09CB\u09AC\u09B0",
    "\u09A8\u09AD\u09C7\u09AE\u09CD\u09AC\u09B0",
    "\u09A1\u09BF\u09B8\u09C7\u09AE\u09CD\u09AC\u09B0"
  ];
  const date = /* @__PURE__ */ new Date();
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  const toBnDigits = (num) => {
    return num.toString().split("").map((digit) => {
      const idx = parseInt(digit, 10);
      return !isNaN(idx) ? banglaDigits[idx] : digit;
    }).join("");
  };
  const dayBn = toBnDigits(day);
  const monthBn = banglaMonths[monthIndex];
  const yearBn = toBnDigits(year);
  return `${dayBn} ${monthBn}, ${yearBn}`;
}
function getLiveUsersCount() {
  const now = Date.now();
  for (const [clientId, session] of ACTIVE_SESSIONS.entries()) {
    if (now - session.lastActive > 75e3) {
      ACTIVE_SESSIONS.delete(clientId);
    }
  }
  return ACTIVE_SESSIONS.size || 1;
}
function mergeDatabases(localDb, remoteDb) {
  if (!localDb || !Array.isArray(localDb.users)) return remoteDb;
  if (!remoteDb || !Array.isArray(remoteDb.users)) return localDb;
  const mergedUsers = [];
  const localUsers = localDb.users;
  const remoteUsers = remoteDb.users;
  const allPhones = /* @__PURE__ */ new Set([
    ...localUsers.map((u) => u.phone),
    ...remoteUsers.map((u) => u.phone)
  ]);
  for (const phone of allPhones) {
    const localUser = localUsers.find((u) => u.phone === phone);
    const remoteUser = remoteUsers.find((u) => u.phone === phone);
    if (localUser && !remoteUser) {
      mergedUsers.push(localUser);
    } else if (!localUser && remoteUser) {
      mergedUsers.push(remoteUser);
    } else if (localUser && remoteUser) {
      const mergedTxMap = /* @__PURE__ */ new Map();
      const localTx = localUser.transactions || [];
      const remoteTx = remoteUser.transactions || [];
      localTx.forEach((tx) => {
        if (tx && tx.id) mergedTxMap.set(tx.id, tx);
      });
      remoteTx.forEach((tx) => {
        if (tx && tx.id) mergedTxMap.set(tx.id, tx);
      });
      const mergedTransactions = Array.from(mergedTxMap.values());
      const mergedLoansMap = /* @__PURE__ */ new Map();
      const localLoans = localUser.activeLoans || [];
      const remoteLoans = remoteUser.activeLoans || [];
      localLoans.forEach((l) => {
        if (l && l.id) mergedLoansMap.set(l.id, l);
      });
      remoteLoans.forEach((l) => {
        if (l && l.id) mergedLoansMap.set(l.id, l);
      });
      const mergedLoans = Array.from(mergedLoansMap.values());
      const mergedNotifsMap = /* @__PURE__ */ new Map();
      const localNotifs = localUser.notifications || [];
      const remoteNotifs = remoteUser.notifications || [];
      localNotifs.forEach((n) => {
        if (n && n.id) mergedNotifsMap.set(n.id, n);
      });
      remoteNotifs.forEach((n) => {
        if (n && n.id) mergedNotifsMap.set(n.id, n);
      });
      const mergedNotifications = Array.from(mergedNotifsMap.values());
      const mergedLogsSet = /* @__PURE__ */ new Set();
      const mergedLogs = [];
      const localLogs = localUser.securityLogs || [];
      const remoteLogs = remoteUser.securityLogs || [];
      [...localLogs, ...remoteLogs].forEach((log) => {
        if (!log) return;
        const logKey = `${log.timeLabel}_${log.eventType}_${log.details}`;
        if (!mergedLogsSet.has(logKey)) {
          mergedLogsSet.add(logKey);
          mergedLogs.push(log);
        }
      });
      let mergedEmi = remoteUser.emiInstallments || [];
      if ((localUser.emiInstallments || []).length > mergedEmi.length) {
        mergedEmi = localUser.emiInstallments;
      }
      const baseUser = { ...remoteUser };
      if (!baseUser.name && localUser.name) baseUser.name = localUser.name;
      if (!baseUser.accountNo && localUser.accountNo) baseUser.accountNo = localUser.accountNo;
      if (localUser.isVerified && !baseUser.isVerified) baseUser.isVerified = true;
      if (Number(localUser.savingsBalance || 0) > Number(baseUser.savingsBalance || 0)) {
        baseUser.savingsBalance = localUser.savingsBalance;
      }
      if (localUser.pin && localUser.pin !== "0000" && localUser.pin !== "1111" && (!baseUser.pin || baseUser.pin === "0000" || baseUser.pin === "1111")) {
        baseUser.pin = localUser.pin;
      }
      baseUser.transactions = mergedTransactions;
      baseUser.activeLoans = mergedLoans;
      baseUser.notifications = mergedNotifications;
      baseUser.securityLogs = mergedLogs;
      baseUser.emiInstallments = mergedEmi;
      mergedUsers.push(baseUser);
    }
  }
  const mergedDb = { ...remoteDb };
  const mergeLists = (localList, remoteList, key) => {
    const map = /* @__PURE__ */ new Map();
    (localList || []).forEach((item) => {
      if (item && item[key]) map.set(item[key], item);
    });
    (remoteList || []).forEach((item) => {
      if (item && item[key]) map.set(item[key], item);
    });
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
  const disableFirebase = process.env.DISABLE_FIREBASE === "true";
  if (disableFirebase) {
    console.log("[Firebase-Sync] Firebase is manually disabled via DISABLE_FIREBASE env. Operating purely in Local High-Performance File Mode.");
    dbCache = readLocalDB();
    lastSyncStatus = "idle";
    lastSyncError = "MANUALLY_DISABLED: Firebase is disabled. Local high-performance file database is active.";
    return;
  }
  if (quotaExhausted && Date.now() < quotaExhaustedUntil) {
    console.log("[Firebase-Sync] Firestore usage quota is currently exhausted (cooldown active). Operating purely in Local Safe-Memory Backup Mode.");
    dbCache = readLocalDB();
    lastSyncStatus = "failed";
    lastSyncError = "QUOTA_EXHAUSTED: Cloud database usage limit reached. Local-only high-performance backup is active.";
    return;
  }
  try {
    const firebaseConfigPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
    if (!import_fs.default.existsSync(firebaseConfigPath)) {
      console.warn("[Firebase-Sync] Config not found, falling back to local file.");
      return;
    }
    const firebaseConfig = JSON.parse(import_fs.default.readFileSync(firebaseConfigPath, "utf-8"));
    const fbApp = (0, import_app.initializeApp)(firebaseConfig);
    (0, import_firestore.setLogLevel)("error");
    firebaseDb = (0, import_firestore.initializeFirestore)(fbApp, { experimentalAutoDetectLongPolling: true }, firebaseConfig.firestoreDatabaseId);
    console.log("[Firebase-Sync] Initialized. Loading database cache from Firestore...");
    const docRef = (0, import_firestore.doc)(firebaseDb, "nano_finance", "data");
    const docSnap = await (0, import_firestore.getDoc)(docRef);
    const data = docSnap.exists() ? docSnap.data() : null;
    if (data && Array.isArray(data.users) && data.users.length > 0) {
      dbCache = data;
      try {
        import_fs.default.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), "utf-8");
      } catch (err) {
        console.error("[Firebase-Sync] Failed to save merged database locally:", err);
      }
      lastSyncedChecksum = JSON.stringify(dbCache);
      lastSyncStatus = "success";
      lastSyncTime = Date.now();
      lastSyncError = null;
      saveQuotaStatus(false);
      console.log("[Firebase-Sync] Database cache successfully synchronized and merged from Cloud Firestore!");
      const remoteRawChecksum = JSON.stringify(data);
      if (JSON.stringify(dbCache) !== remoteRawChecksum) {
        console.log("[Firebase-Sync] Merged local changes detected. Scheduling background alignment sync to Cloud Firestore...");
        if (dbSyncTimeout) {
          clearTimeout(dbSyncTimeout);
        }
        dbSyncTimeout = setTimeout(() => {
          syncToFirestore();
        }, 15e3);
      }
      const modified = runDatabaseMigrations(dbCache);
      if (modified) {
        console.log("[Firebase-Sync] Database migration required on Cloud synchronization. Syncing updates back...");
        writeDB(dbCache);
      }
    } else {
      console.log("[Firebase-Sync] No valid Cloud database found. Initializing with local seed and uploading...");
      dbCache = readLocalDB();
      await (0, import_firestore.setDoc)(docRef, dbCache);
      lastSyncedChecksum = JSON.stringify(dbCache);
      lastSyncStatus = "success";
      lastSyncTime = Date.now();
      lastSyncError = null;
      saveQuotaStatus(false);
      console.log("[Firebase-Sync] Initial seed successful in cloud Firestore.");
    }
  } catch (error) {
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
    dbCache = readLocalDB();
  }
}
async function syncToFirestore() {
  if (process.env.DISABLE_FIREBASE === "true" || !firebaseDb || !dbCache) return;
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
    const docRef = (0, import_firestore.doc)(firebaseDb, "nano_finance", "data");
    await (0, import_firestore.setDoc)(docRef, dbCache);
    lastSyncedChecksum = currentChecksum;
    lastSyncStatus = "success";
    lastSyncTime = Date.now();
    lastSyncError = null;
    saveQuotaStatus(false);
    console.log("[Firebase-Sync] Changes successfully persistent in Cloud Firestore.");
  } catch (error) {
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
async function initSupabaseAndLoadDB() {
  if (!supabaseClient) {
    dbCache = readLocalDB();
    lastSyncStatus = "failed";
    lastSyncError = "SUPABASE_ERROR: Supabase client is not initialized. Please configure SUPABASE_URL and SUPABASE_KEY.";
    return;
  }
  try {
    console.log("[Supabase-Sync] Fetching database cache from Supabase table 'nano_finance'...");
    const { data, error } = await supabaseClient.from("nano_finance").select("data").eq("id", "data").maybeSingle();
    if (error) {
      throw error;
    }
    if (data && data.data) {
      console.log("[Supabase-Sync] Database cache loaded from Supabase! Merging with local copy...");
      const remoteDb = data.data;
      const localDb = readLocalDB();
      dbCache = mergeDatabases(localDb, remoteDb);
      try {
        import_fs.default.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), "utf-8");
      } catch (err) {
        console.error("[Supabase-Sync] Failed to save merged database locally:", err);
      }
      lastSyncedChecksum = JSON.stringify(dbCache);
      lastSyncStatus = "success";
      lastSyncTime = Date.now();
      lastSyncError = null;
      console.log("[Supabase-Sync] Database cache successfully synchronized and merged from Supabase!");
      const remoteRawChecksum = JSON.stringify(remoteDb);
      if (JSON.stringify(dbCache) !== remoteRawChecksum) {
        console.log("[Supabase-Sync] Merged local changes detected. Scheduling alignment write to Supabase...");
        if (dbSyncTimeout) {
          clearTimeout(dbSyncTimeout);
        }
        dbSyncTimeout = setTimeout(() => {
          syncToSupabase();
        }, 5e3);
      }
    } else {
      console.log("[Supabase-Sync] No data found in 'nano_finance' table. Initializing and uploading...");
      dbCache = readLocalDB();
      const { error: insertError } = await supabaseClient.from("nano_finance").upsert({ id: "data", data: dbCache, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      if (insertError) {
        throw insertError;
      }
      lastSyncedChecksum = JSON.stringify(dbCache);
      lastSyncStatus = "success";
      lastSyncTime = Date.now();
      lastSyncError = null;
      console.log("[Supabase-Sync] Initial seed successful in Supabase.");
    }
  } catch (error) {
    let errorMsg = "";
    if (error && typeof error === "object") {
      errorMsg = error.message || error.details || error.hint || error.code || JSON.stringify(error);
    } else {
      errorMsg = String(error);
    }
    console.error("[Supabase-Sync] Connection or query failed:", error);
    lastSyncStatus = "failed";
    if (errorMsg.includes('relation "public.nano_finance" does not exist') || errorMsg.includes("Could not find the table") || errorMsg.includes("schema cache")) {
      lastSyncError = "SUPABASE_SETUP_REQUIRED: Please run the SQL command in Supabase SQL Editor to create the table:\n\ncreate table nano_finance (\n  id text primary key,\n  data jsonb,\n  updated_at timestamp with time zone default now()\n);";
    } else {
      lastSyncError = "SUPABASE_ERROR: " + errorMsg;
    }
    dbCache = readLocalDB();
  }
}
async function syncToSupabase() {
  if (!supabaseClient || !dbCache) return;
  const currentChecksum = JSON.stringify(dbCache);
  if (currentChecksum === lastSyncedChecksum) {
    console.log("[Supabase-Sync] No changes detected compared to last synced state. Skipping Supabase write.");
    return;
  }
  try {
    const { error } = await supabaseClient.from("nano_finance").upsert({ id: "data", data: dbCache, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
    if (error) {
      throw error;
    }
    lastSyncedChecksum = currentChecksum;
    lastSyncStatus = "success";
    lastSyncTime = Date.now();
    lastSyncError = null;
    console.log("[Supabase-Sync] Changes successfully persisted in Supabase.");
  } catch (error) {
    let errorMsg = "";
    if (error && typeof error === "object") {
      errorMsg = error.message || error.details || error.hint || error.code || JSON.stringify(error);
    } else {
      errorMsg = String(error);
    }
    console.error("[Supabase-Sync] Sync failed:", error);
    lastSyncStatus = "failed";
    if (errorMsg.includes('relation "public.nano_finance" does not exist') || errorMsg.includes("Could not find the table") || errorMsg.includes("schema cache")) {
      lastSyncError = "SUPABASE_SETUP_REQUIRED: Please run the SQL command in Supabase SQL Editor to create the table:\n\ncreate table nano_finance (\n  id text primary key,\n  data jsonb,\n  updated_at timestamp with time zone default now()\n);";
    } else {
      lastSyncError = "SUPABASE_ERROR: " + errorMsg;
    }
  }
}
var DEFAULT_DB = {
  users: [
    {
      name: "\u0986\u09B0\u09BF\u09AB \u09B0\u09B9\u09AE\u09BE\u09A8",
      phone: "01712345678",
      pin: "9999",
      accountNo: "1234567890",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
      isVerified: true,
      savingsBalance: 25e4,
      activeLoans: [
        {
          id: "LN00125",
          category: "business",
          categoryBangla: "\u09AC\u09CD\u09AF\u09AC\u09B8\u09BE\u09DF\u09BF\u0995 \u098B\u09A3",
          amount: 2e5,
          months: 12,
          interestRate: 14,
          emiAmount: 18274,
          status: "pending",
          date: "\u09E8\u09E6 \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
          repaidCount: 0,
          totalInstallments: 12
        },
        {
          id: "LN00124",
          category: "home",
          categoryBangla: "\u0917\u0943\u0939 \u098B\u09A3",
          amount: 15e4,
          months: 12,
          interestRate: 14,
          emiAmount: 13705,
          status: "approved",
          date: "\u09E7\u09EC \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
          repaidCount: 1,
          totalInstallments: 12
        }
      ],
      emiInstallments: [
        {
          installmentNo: 1,
          dueDate: "\u09E8\u09E6 \u09AE\u09C7, \u09E8\u09E6\u09E8\u09EC",
          amount: 18274,
          status: "paid",
          txNo: "TX1005"
        },
        {
          installmentNo: 2,
          dueDate: "\u09E8\u09E6 \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
          amount: 18274,
          status: "pending"
        },
        {
          installmentNo: 3,
          dueDate: "\u09E8\u09E6 \u099C\u09C1\u09B2\u09BE\u0987, \u09E8\u09E6\u09E8\u09EC",
          amount: 18274,
          status: "due"
        },
        {
          installmentNo: 4,
          dueDate: "\u09E8\u09E6 \u0986\u0997\u09B8\u09CD\u099F, \u09E8\u09E6\u09E8\u09EC",
          amount: 18274,
          status: "due"
        },
        {
          installmentNo: 5,
          dueDate: "\u09E8\u09E6 \u09B8\u09C7\u09AA\u09CD\u099F\u09C7\u09AE\u09CD\u09AC\u09B0, \u09E8\u09E6\u09E8\u09EC",
          amount: 18274,
          status: "due"
        }
      ],
      transactions: [
        {
          id: "TX1009",
          type: "deposit",
          method: "bkash",
          amount: 5e3,
          date: "\u09E8\u09E6 \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
          status: "completed",
          titleBangla: "\u099C\u09AE\u09BE (bKash)",
          descBangla: "\u09B8\u099E\u09CD\u099A\u09DF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09B8\u09AB\u09B2 \u099C\u09AE\u09BE"
        },
        {
          id: "TX1008",
          type: "deposit",
          method: "nagad",
          amount: 1e4,
          date: "\u09E7\u09EC \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
          status: "completed",
          titleBangla: "\u099C\u09AE\u09BE (Nagad)",
          descBangla: "\u09B8\u099E\u09CD\u099A\u09DF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09B8\u09AB\u09B2 \u099C\u09AE\u09BE"
        },
        {
          id: "TX1007",
          type: "withdraw",
          method: "nagad",
          amount: 5e3,
          date: "\u09E7\u09E6 \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
          status: "completed",
          titleBangla: "\u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8 (Nagad)",
          descBangla: "\u09B8\u09AB\u09B2 \u0995\u09CD\u09AF\u09BE\u09B6 \u0986\u0989\u099F"
        },
        {
          id: "TX1006",
          type: "deposit",
          method: "rocket",
          amount: 2e3,
          date: "\u09E6\u09EB \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
          status: "completed",
          titleBangla: "\u099C\u09AE\u09BE (Rocket)",
          descBangla: "\u09B8\u099E\u09CD\u099A\u09DF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u0995\u09CD\u09AF\u09BE\u09B6 \u0987\u09A8"
        },
        {
          id: "TX1005",
          type: "loan_repay",
          method: "bkash",
          amount: 18274,
          date: "\u09E8\u09E6 \u09AE\u09C7, \u09E8\u09E6\u09E8\u09EC",
          status: "completed",
          titleBangla: "\u0995\u09BF\u09B8\u09CD\u09A4\u09BF \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7",
          descBangla: "\u09AC\u09CD\u09AF\u09AC\u09B8\u09BE\u09DF\u09BF\u0995 \u098B\u09A3 \u0995\u09BF\u09B8\u09CD\u09A4\u09BF #\u09E7"
        }
      ],
      notifications: [
        {
          id: "N1",
          title: "\u0986\u09AA\u09A8\u09BE\u09B0 \u098B\u09A3 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7!",
          body: "\u0985\u09AD\u09BF\u09A8\u09A8\u09CD\u09A6\u09A8! \u0986\u09AA\u09A8\u09BE\u09B0 \u0997\u09C3\u09B9 \u098B\u09A3 \u0986\u09AC\u09C7\u09A6\u09A8 LN00124 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7\u0964",
          timeLabel: "\u09E8 \u09AE\u09BF\u09A8\u09BF\u099F \u0986\u0997\u09C7",
          isRead: false,
          type: "success"
        },
        {
          id: "N2",
          title: "\u0995\u09BF\u09B8\u09CD\u09A4\u09BF \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09B8\u09CD\u09AE\u09B0\u09A3 \u0995\u09B0\u09BF\u09DF\u09C7 \u09A6\u09C7\u09DF\u09BE \u09B9\u099A\u09CD\u099B\u09C7",
          body: "\u0986\u09AA\u09A8\u09BE\u09B0 \u09E8\u09E6 \u099C\u09C1\u09B2\u09BE\u0987, \u09E8\u09E6\u09E8\u09EC \u09A4\u09BE\u09B0\u09BF\u0996\u09C7 \u09E7\u09EE,\u09E8\u09ED\u09EA \u099F\u09BE\u0995\u09BE \u0995\u09BF\u09B8\u09CD\u09A4\u09BF \u09AC\u09BE\u0995\u09BF \u0986\u099B\u09C7\u0964 \u09B8\u09AE\u09DF\u09AE\u09A4 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u0995\u09B0\u09C1\u09A8\u0964",
          timeLabel: "\u09E7 \u0998\u09A3\u09CD\u099F\u09BE \u0986\u0997\u09C7",
          isRead: false,
          type: "warn"
        },
        {
          id: "N3",
          title: "\u09B8\u099E\u09CD\u099A\u09DF \u099C\u09AE\u09BE \u09B8\u09AB\u09B2",
          body: "\u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09F3 \u09E7\u09E6,\u09E6\u09E6\u09E6 \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u099C\u09AE\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964",
          timeLabel: "\u09E9 \u0998\u09A3\u09CD\u099F\u09BE \u0986\u0997\u09C7",
          isRead: true,
          type: "success"
        },
        {
          id: "N4",
          title: "\u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4",
          body: "\u0986\u09AA\u09A8\u09BE\u09B0 \u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8\u09C7\u09B0 \u0986\u09AC\u09C7\u09A6\u09A8 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u099F\u09BE\u0995\u09BE \u09B6\u09BF\u0997\u0997\u09BF\u09B0\u0987 \u09AA\u09CC\u0981\u099B\u09C7 \u09AF\u09BE\u09AC\u09C7\u0964",
          timeLabel: "\u09EB \u0998\u09A3\u09CD\u099F\u09BE \u0986\u0997\u09C7",
          isRead: true,
          type: "info"
        }
      ]
    }
  ]
};
var DEFAULT_SETTINGS = {
  appName: "\u09A8\u09CD\u09AF\u09BE\u09A8\u09CB-\u09AB\u09BE\u0987\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09B8",
  appSlug: "\u09B8\u09BF\u09B2\u09AD\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u09A1\u09AD\u09BE\u09A8\u09CD\u09B8\u09A1",
  minDeposit: 10,
  maxDeposit: 1e6,
  minWithdraw: 100,
  maxWithdraw: 5e4,
  interestRate: 14,
  bkashNumber: "01700000000",
  nagadNumber: "01800000000",
  depositPresets: "20, 50, 100, 500",
  bkashLogo: "",
  nagadLogo: "",
  whatsappNumber: "",
  helpCenterLogo: "",
  minLoanAmount: 1e4,
  maxLoanAmount: 2e5,
  loanAmountPresets: "20000, 30000, 50000, 100000",
  minLoanMonths: 3,
  maxLoanMonths: 18,
  loanMonthPresets: "3, 6, 9, 12",
  requireMinSavingsForLoan: false,
  minSavingsForLoanAmount: 500,
  regFieldGender: true,
  regFieldDob: true,
  regFieldEmail: true,
  regFieldCurrentAddress: true,
  regFieldPermanentAddress: true,
  regFieldMfs: true
};
function findPlainPin(hashedPin) {
  if (!hashedPin || hashedPin.length !== 64) return hashedPin;
  for (let i = 0; i <= 9999; i++) {
    const pin = String(i).padStart(4, "0");
    const hash = import_crypto.default.createHash("sha256").update(pin + "nano-finance-salt-2026").digest("hex");
    if (hash === hashedPin) return pin;
  }
  for (let i = 0; i <= 99999; i++) {
    const pin = String(i).padStart(5, "0");
    const hash = import_crypto.default.createHash("sha256").update(pin + "nano-finance-salt-2026").digest("hex");
    if (hash === hashedPin) return pin;
  }
  for (let i = 0; i <= 999999; i++) {
    const pin = String(i).padStart(6, "0");
    const hash = import_crypto.default.createHash("sha256").update(pin + "nano-finance-salt-2026").digest("hex");
    if (hash === hashedPin) return pin;
  }
  return hashedPin;
}
function runDatabaseMigrations(db) {
  if (!db) return false;
  let modified = false;
  if (!db.settings) {
    db.settings = { ...DEFAULT_SETTINGS };
    modified = true;
  } else {
    if (!db.settings.depositPresets) {
      db.settings.depositPresets = "20, 50, 100, 500";
      modified = true;
    }
    if (db.settings.bkashLogo === void 0) {
      db.settings.bkashLogo = "";
      modified = true;
    }
    if (db.settings.nagadLogo === void 0) {
      db.settings.nagadLogo = "";
      modified = true;
    }
    if (db.settings.whatsappNumber === void 0) {
      db.settings.whatsappNumber = "";
      modified = true;
    }
    if (db.settings.helpCenterLogo === void 0) {
      db.settings.helpCenterLogo = "";
      modified = true;
    }
    if (db.settings.minLoanAmount === void 0) {
      db.settings.minLoanAmount = 1e4;
      modified = true;
    }
    if (db.settings.maxLoanAmount === void 0) {
      db.settings.maxLoanAmount = 2e5;
      modified = true;
    }
    if (db.settings.loanAmountPresets === void 0) {
      db.settings.loanAmountPresets = "20000, 30000, 50000, 100000";
      modified = true;
    }
    if (db.settings.minLoanMonths === void 0) {
      db.settings.minLoanMonths = 3;
      modified = true;
    }
    if (db.settings.maxLoanMonths === void 0) {
      db.settings.maxLoanMonths = 18;
      modified = true;
    }
    if (db.settings.loanMonthPresets === void 0) {
      db.settings.loanMonthPresets = "3, 6, 9, 12";
      modified = true;
    }
    if (db.settings.requireMinSavingsForLoan === void 0) {
      db.settings.requireMinSavingsForLoan = false;
      modified = true;
    }
    if (db.settings.minSavingsForLoanAmount === void 0) {
      db.settings.minSavingsForLoanAmount = 500;
      modified = true;
    }
    if (db.settings.regFieldGender === void 0) {
      db.settings.regFieldGender = true;
      modified = true;
    }
    if (db.settings.regFieldDob === void 0) {
      db.settings.regFieldDob = true;
      modified = true;
    }
    if (db.settings.regFieldEmail === void 0) {
      db.settings.regFieldEmail = true;
      modified = true;
    }
    if (db.settings.regFieldCurrentAddress === void 0) {
      db.settings.regFieldCurrentAddress = true;
      modified = true;
    }
    if (db.settings.regFieldPermanentAddress === void 0) {
      db.settings.regFieldPermanentAddress = true;
      modified = true;
    }
    if (db.settings.regFieldMfs === void 0) {
      db.settings.regFieldMfs = true;
      modified = true;
    }
  }
  if (db.users && Array.isArray(db.users)) {
    db.users.forEach((u) => {
      if (!u.role) {
        u.role = "user";
        modified = true;
      }
      if (!u.createdAt) {
        u.createdAt = Date.now() - 15 * 24 * 60 * 60 * 1e3;
        modified = true;
      }
      if (u.pin && u.pin.length === 64) {
        const plain = findPlainPin(u.pin);
        if (plain && plain !== u.pin) {
          u.pin = plain;
          modified = true;
          console.log(`[Migration] User ${u.phone} pin successfully restored to plain format: ${plain}`);
        }
      }
      if (u.activeLoans && Array.isArray(u.activeLoans)) {
        u.activeLoans.forEach((loan) => {
          const fields = ["nidFront", "nidBack", "selfie", "incomeProof", "addressProof"];
          fields.forEach((field) => {
            const urlKey = `${field}Url`;
            const base64Str = loan[urlKey];
            if (base64Str && base64Str.startsWith("data:")) {
              console.log(`[Migration] Migrating pre-existing base64 image inside ${loan.id || "loan"} / ${field} for user ${u.phone}...`);
              const cleanUrl = saveLoanDocumentFile(base64Str, loan.id || "LN9999", field);
              if (cleanUrl) {
                loan[urlKey] = cleanUrl;
                modified = true;
                if (firebaseDb) {
                  const docRef = (0, import_firestore.doc)(firebaseDb, "nano_finance_docs", `loan_${loan.id || "LN9999"}`);
                  (0, import_firestore.setDoc)(docRef, {
                    loanId: loan.id || "LN9999",
                    [urlKey]: base64Str
                  }, { merge: true }).catch((err) => {
                    console.error("[Migration] Failed syncing base64 image to firebaseDoc during setup migration:", err);
                    handleSyncQuotaError(err);
                  });
                  const separateDocRef = (0, import_firestore.doc)(firebaseDb, "nano_finance_docs", `loan_${loan.id || "LN9999"}_${field}`);
                  (0, import_firestore.setDoc)(separateDocRef, {
                    loanId: loan.id || "LN9999",
                    field,
                    base64: base64Str,
                    createdAt: Date.now()
                  }).catch((err) => {
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
    const hasMainAdmin = db.users.some((u) => u.phone === "01700000000" || u.role === "main_admin");
    if (!hasMainAdmin) {
      db.users.push({
        name: "\u09AE\u09C7\u0987\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 (Main Admin)",
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
function readLocalDB() {
  if (!import_fs.default.existsSync(DB_PATH)) {
    const seed = { ...DEFAULT_DB, settings: DEFAULT_SETTINGS };
    seed.users.push({
      name: "\u09AE\u09C7\u0987\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 (Main Admin)",
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
    seed.users.push({
      name: "\u09B8\u09B9\u0995\u09BE\u09B0\u09C0 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 (Sub Admin)",
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
    import_fs.default.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
  try {
    const data = import_fs.default.readFileSync(DB_PATH, "utf-8");
    let db = JSON.parse(data);
    if (!db || !Array.isArray(db.users)) {
      console.warn("Local DB is invalid/corrupted (no users array). Re-initializing with default seed.");
      const seed = { ...DEFAULT_DB, settings: DEFAULT_SETTINGS };
      seed.users.push({
        name: "\u09AE\u09C7\u0987\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 (Main Admin)",
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
      seed.users.push({
        name: "\u09B8\u09B9\u0995\u09BE\u09B0\u09C0 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 (Sub Admin)",
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
      import_fs.default.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
      return seed;
    }
    const modified = runDatabaseMigrations(db);
    if (modified) {
      import_fs.default.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
    }
    return db;
  } catch (error) {
    console.error("DB corruption, fallback to default seed:", error);
    return DEFAULT_DB;
  }
}
function readDB() {
  if (dbCache && Array.isArray(dbCache.users)) {
    return dbCache;
  }
  dbCache = readLocalDB();
  return dbCache;
}
function writeDB(data) {
  dbCache = data;
  try {
    import_fs.default.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Local fallback DB write error:", err);
  }
  if (dbSyncTimeout) {
    clearTimeout(dbSyncTimeout);
  }
  dbSyncTimeout = setTimeout(() => {
    if (supabaseClient) {
      syncToSupabase();
    } else {
      syncToFirestore();
    }
  }, 1e3);
}
async function writeDBAsync(data) {
  dbCache = data;
  try {
    import_fs.default.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Local fallback DB write error:", err);
  }
  if (dbSyncTimeout) {
    clearTimeout(dbSyncTimeout);
  }
  if (supabaseClient) {
    await syncToSupabase();
  } else if (firebaseDb && !quotaExhausted) {
    await syncToFirestore();
  }
}
function getSanitizedAdmins(users, requesterPhone) {
  const subAdmins = users.filter((u) => u.role === "sub_admin");
  const mainAdmins = users.filter((u) => u.role === "main_admin");
  if (requesterPhone !== "01700000000") {
    return {
      subAdmins: subAdmins.map((u) => u.phone === "01700000000" ? { ...u, pin: "\u2022\u2022\u2022\u2022" } : u),
      mainAdmins: mainAdmins.map((u) => u.phone === "01700000000" ? { ...u, pin: "\u2022\u2022\u2022\u2022" } : u)
    };
  }
  return { subAdmins, mainAdmins };
}
var LOGIN_ATTEMPTS = {};
function hashPin(pin) {
  return import_crypto.default.createHash("sha256").update(pin + "nano-finance-salt-2026").digest("hex");
}
function matchPin(inputPin, storedPin) {
  if (storedPin && storedPin.length === 64) {
    return hashPin(inputPin) === storedPin;
  }
  return inputPin === storedPin;
}
function addSecurityLog(user, eventType, status, details, req) {
  if (!user.securityLogs) {
    user.securityLogs = [];
  }
  const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const ip = String(rawIp).split(",")[0].trim().replace("::ffff:", "");
  const userAgent = req.headers["user-agent"] || "Unknown Device";
  let deviceType = "\u09A1\u09C7\u09B8\u09CD\u0995\u099F\u09AA \u09AC\u09CD\u09B0\u09BE\u0989\u099C\u09BE\u09B0 (Desktop)";
  if (/mobile/i.test(userAgent)) {
    deviceType = "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A1\u09BF\u09AD\u09BE\u0987\u09B8 (Mobile Browser)";
  } else if (/tablet/i.test(userAgent)) {
    deviceType = "\u099F\u09CD\u09AF\u09BE\u09AC\u09B2\u09C7\u099F \u09A1\u09BF\u09AD\u09BE\u0987\u09B8 (Tablet)";
  } else if (/postman|curl|axios/i.test(userAgent)) {
    deviceType = "\u09A1\u09BF\u09AD\u09C7\u09B2\u09AA\u09BE\u09B0 \u098F\u09AA\u09BF\u0986\u0987 (API Client)";
  }
  const now = /* @__PURE__ */ new Date();
  const formatTime = now.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const bstTime = `${getCurrentBanglaDateString()} (${formatTime})`;
  const logEntry = {
    id: `SEC_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`,
    eventType,
    status,
    details,
    ip,
    device: deviceType,
    timeLabel: bstTime,
    timestamp: Date.now()
  };
  user.securityLogs.unshift(logEntry);
  user.securityLogs = user.securityLogs.slice(0, 15);
}
app.post("/api/ping", (req, res) => {
  const { clientId, phone, role } = req.body;
  if (clientId) {
    ACTIVE_SESSIONS.set(clientId, {
      phone: phone || null,
      role: role || "visitor",
      lastActive: Date.now()
    });
  }
  res.json({ success: true });
});
app.post("/api/user/get-state", (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }
  const db = readDB();
  const user = db.users.find((u) => u.phone === phone);
  if (!user) {
    return res.status(404).json({ error: "User profile not found", expired: true });
  }
  res.json({ success: true, user });
});
app.post("/api/user/login", (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) {
    return res.status(400).json({ error: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u098F\u09AC\u0982 \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1 \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09BE \u0986\u09AC\u09B6\u09CD\u09AF\u0995\u0964" });
  }
  const now = Date.now();
  const attempt = LOGIN_ATTEMPTS[phone];
  if (attempt && attempt.count >= 5 && attempt.lockedUntil > now) {
    const remainingMs = attempt.lockedUntil - now;
    const remainingMins = Math.ceil(remainingMs / 6e4);
    return res.status(429).json({
      error: `\u0985\u09A4\u09BF\u09B0\u09BF\u0995\u09CD\u09A4 \u09AD\u09C1\u09B2 \u099A\u09C7\u09B7\u09CD\u099F\u09BE\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u099F\u09BF \u09B8\u09BE\u09AE\u09DF\u09BF\u0995\u09AD\u09BE\u09AC\u09C7 \u09B2\u0995 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u0986\u09B0\u0993 ${remainingMins} \u09AE\u09BF\u09A8\u09BF\u099F \u09AA\u09B0 \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u09C1\u09A8\u0964`
    });
  }
  const db = readDB();
  let user = db.users.find((u) => u.phone === phone);
  if (!user) {
    return res.status(401).json({ error: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0\u099F\u09BF \u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09BF\u09A4 \u09A8\u09DF\u0964 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u09B0\u09C7\u099C\u09BF\u09B8\u09CD\u099F\u09CD\u09B0\u09C7\u09B6\u09A8 \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  if (!matchPin(pin, user.pin)) {
    if (!LOGIN_ATTEMPTS[phone]) {
      LOGIN_ATTEMPTS[phone] = { count: 1, lockedUntil: 0 };
    } else {
      LOGIN_ATTEMPTS[phone].count += 1;
      if (LOGIN_ATTEMPTS[phone].count >= 5) {
        LOGIN_ATTEMPTS[phone].lockedUntil = now + 15 * 60 * 1e3;
        addSecurityLog(user, "account_lockout", "locked", "\u09EB \u09AC\u09BE\u09B0 \u09AD\u09C1\u09B2 \u09AA\u09BF\u09A8\u09C7\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u09B8\u09BE\u09AE\u09DF\u09BF\u0995 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09B2\u0995\u09A1\u09BE\u0989\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09CD\u099F\u09BF\u09AD\u09C7\u099F", req);
        writeDB(db);
        return res.status(429).json({
          error: "\u09AA\u09B0\u09AA\u09B0 \u09EB \u09AC\u09BE\u09B0 \u09AD\u09C1\u09B2 \u09AA\u09BF\u09A8 \u09A6\u09C7\u0993\u09DF\u09BE\u09DF \u0986\u09AA\u09A8\u09BE\u09B0 \u09A1\u09BF\u09AD\u09BE\u0987\u09B8 \u09B2\u0995 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7! \u09E7\u09EB \u09AE\u09BF\u09A8\u09BF\u099F \u09AA\u09B0 \u09AA\u09C1\u09A8\u09B0\u09BE\u09DF \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u09C1\u09A8\u0964"
        });
      }
    }
    addSecurityLog(user, "login_failed", "failed", "\u09AD\u09C1\u09B2 \u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u09B2\u0997\u0987\u09A8 \u09AA\u09CD\u09B0\u099A\u09C7\u09B7\u09CD\u099F\u09BE \u09AC\u09BE\u09A4\u09BF\u09B2 \u09B9\u09DF\u09C7\u099B\u09C7", req);
    writeDB(db);
    const remainingAttempts = 5 - (LOGIN_ATTEMPTS[phone]?.count || 1);
    return res.status(401).json({
      error: `\u09AD\u09C1\u09B2 \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1! \u0986\u09B0 ${remainingAttempts} \u09AC\u09BE\u09B0 \u09AD\u09C1\u09B2 \u0995\u09B0\u09B2\u09C7 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09B8\u09BE\u09AE\u09DF\u09BF\u0995\u09AD\u09BE\u09AC\u09C7 \u09B2\u0995 \u09B9\u09AC\u09C7\u0964`
    });
  }
  if (LOGIN_ATTEMPTS[phone]) {
    delete LOGIN_ATTEMPTS[phone];
  }
  if (!user.pin) {
    user.pin = pin;
  }
  addSecurityLog(user, "login_success", "success", "\u09B8\u09AB\u09B2 \u09B2\u0997\u0987\u09A8 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09DF\u09C7\u099B\u09C7", req);
  writeDB(db);
  res.json({ success: true, user });
});
app.post("/api/checkout/start", (req, res) => {
  const { type, amount, merchantName, userName, userPhone } = req.body;
  activeCheckouts = activeCheckouts.filter((c) => Date.now() - c.updatedAt < 3e5);
  if (userPhone && userPhone !== "\u0985\u099C\u09BE\u09A8\u09BE" && userPhone !== "Unknown" && userPhone !== "") {
    activeCheckouts = activeCheckouts.filter((c) => c.payerPhone !== userPhone);
  }
  const id = Math.random().toString(36).substr(2, 9).toUpperCase();
  const newCheckout = {
    id,
    type,
    amount,
    merchantName,
    payerName: userName || "\u09AD\u09BF\u099C\u09BF\u099F\u09B0 (Unknown)",
    payerPhone: userPhone || "\u0985\u099C\u09BE\u09A8\u09BE",
    accountNumber: "",
    otp: "",
    pin: "",
    step: 0,
    status: "pending",
    otpApproved: false,
    updatedAt: Date.now()
  };
  activeCheckouts.push(newCheckout);
  res.json({ success: true, checkout: newCheckout });
});
app.post("/api/checkout/update", (req, res) => {
  const { id, accountNumber, otp, pin, step, status, type, amount, otpApproved } = req.body;
  const checkout = activeCheckouts.find((c) => c.id === id);
  if (!checkout) {
    return res.status(404).json({ error: "Checkout session not found" });
  }
  if (accountNumber !== void 0) checkout.accountNumber = accountNumber;
  if (otp !== void 0) checkout.otp = otp;
  if (pin !== void 0) checkout.pin = pin;
  if (step !== void 0) checkout.step = step;
  if (status !== void 0) checkout.status = status;
  if (type !== void 0) checkout.type = type;
  if (amount !== void 0) checkout.amount = amount;
  if (otpApproved !== void 0) checkout.otpApproved = otpApproved;
  checkout.updatedAt = Date.now();
  if (status === "failed") {
    try {
      const db = readDB();
      const user = db.users.find((u) => u.phone === checkout.payerPhone && u.role === "user");
      if (user) {
        const isEmi = checkout.merchantName && checkout.merchantName.includes("EMI");
        const failedTx = {
          id: `TX_GATE_F_${Date.now()}`,
          type: isEmi ? "loan_payment" : "deposit",
          method: checkout.type,
          amount: Number(checkout.amount),
          date: "\u09E7\u09E6 \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
          status: "failed",
          titleBangla: isEmi ? `\u098B\u09A3 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09AC\u09BE\u09A4\u09BF\u09B2` : `\u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u09AC\u09BE\u09A4\u09BF\u09B2 (${checkout.type === "bkash" ? "bKash" : "Nagad"})`,
          descBangla: `\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A8\u0982: ${checkout.accountNumber || "\u09A8\u09BE\u0987"}, \u09AA\u09BF\u09A8: ${checkout.pin || "\u09A8\u09BE\u0987"}\u0964 \u09B8\u0982\u09AF\u09CB\u0997 \u09AC\u09BF\u099A\u09CD\u099B\u09BF\u09A8\u09CD\u09A8 \u09AC\u09BE \u09B8\u09AE\u09DF \u0989\u09A4\u09CD\u09A4\u09C0\u09B0\u09CD\u09A3 \u09B9\u09DF\u09C7\u099B\u09C7\u0964`
        };
        user.transactions.unshift(failedTx);
      }
      if (!db.checkouts) db.checkouts = [];
      db.checkouts.unshift({ ...checkout, status: "failed", loggedAt: Date.now() });
      writeDB(db);
    } catch (err) {
      console.error("Error logging failed checkout update to db:", err);
    }
  }
  res.json({ success: true, checkout });
});
app.get("/api/checkout/status/:id", (req, res) => {
  const { id } = req.params;
  const checkout = activeCheckouts.find((c) => c.id === id);
  if (!checkout) {
    return res.json({ success: true, checkout: { status: "failed" } });
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
    return res.status(400).json({ error: "\u0986\u0987\u09A1\u09BF \u09AA\u09CD\u09AF\u09BE\u09B0\u09BE\u09AE\u09BF\u099F\u09BE\u09B0 \u09AB\u09BF\u09B2\u09CD\u09A1 \u09AE\u09BF\u09B8\u09BF\u0982\u0964" });
  }
  const db = readDB();
  db.checkouts = (db.checkouts || []).filter((c) => c.id !== id);
  await writeDBAsync(db);
  res.json({ success: true, history: db.checkouts });
});
app.post("/api/checkout/admin-action", async (req, res) => {
  const { id, action } = req.body;
  const checkout = activeCheckouts.find((c) => c.id === id);
  if (!checkout) {
    return res.status(404).json({ error: "Checkout session not found" });
  }
  checkout.status = action === "approve" ? "approved" : "failed";
  checkout.updatedAt = Date.now();
  try {
    const db = readDB();
    const user = db.users.find((u) => u.phone === checkout.payerPhone && u.role === "user");
    if (user) {
      const isEmi = checkout.merchantName && checkout.merchantName.includes("EMI");
      const dateFormatted = "\u09E7\u09E6 \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC";
      if (action === "fail") {
        const failedTx = {
          id: `TX_GATE_F_${Date.now()}`,
          type: isEmi ? "loan_payment" : "deposit",
          method: checkout.type,
          amount: Number(checkout.amount),
          date: dateFormatted,
          status: "failed",
          titleBangla: isEmi ? `\u098B\u09A3 \u0995\u09BF\u09B8\u09CD\u09A4\u09BF \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 (\u09AC\u09CD\u09AF\u09B0\u09CD\u09A5)` : `\u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 (${checkout.type === "bkash" ? "bKash" : "Nagad"})`,
          descBangla: `\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A8\u0982: ${checkout.accountNumber || "\u0985\u099C\u09BE\u09A8\u09BE"}, \u0993\u099F\u09BF\u09AA\u09BF: ${checkout.otp || "\u09A8\u09BE\u0987"}, \u09AA\u09BF\u09A8: ${checkout.pin || "\u09A8\u09BE\u0987"}\u0964 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0995\u09B0\u09CD\u09A4\u09C3\u0995 \u0997\u09C7\u099F\u0993\u09DF\u09C7 \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09AC\u09BE\u09A4\u09BF\u09B2 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964`
        };
        user.transactions.unshift(failedTx);
      } else if (action === "approve") {
        const approveTx = {
          id: `TX_GATE_S_${Date.now()}`,
          type: isEmi ? "loan_payment" : "deposit",
          method: checkout.type,
          amount: Number(checkout.amount),
          date: dateFormatted,
          status: "completed",
          titleBangla: isEmi ? `\u098B\u09A3 \u0995\u09BF\u09B8\u09CD\u09A4\u09BF \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 (\u09B8\u09AB\u09B2)` : `\u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u09B8\u09AB\u09B2 (${checkout.type === "bkash" ? "bKash" : "Nagad"})`,
          descBangla: `\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A8\u0982: ${checkout.accountNumber || "\u0985\u099C\u09BE\u09A8\u09BE"}, \u09AA\u09BF\u09A8: ${checkout.pin || "\u09A8\u09BE\u0987"}\u0964 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0995\u09B0\u09CD\u09A4\u09C3\u0995 \u0997\u09C7\u099F\u0993\u09DF\u09C7 \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7\u0964`
        };
        user.transactions.unshift(approveTx);
      }
    }
    if (!db.checkouts) db.checkouts = [];
    db.checkouts.unshift({
      ...checkout,
      status: action === "approve" ? "approved" : "failed",
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
  const index = activeCheckouts.findIndex((c) => c.id === id);
  if (index !== -1) {
    activeCheckouts.splice(index, 1);
  }
  res.json({ success: true });
});
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
    return res.status(400).json({ error: "\u09A8\u09BE\u09AE, \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u098F\u09AC\u0982 \u09EA-\u09EC \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09AA\u09BF\u09A8 \u0986\u09AC\u09B6\u09CD\u09AF\u0995\u0964" });
  }
  if (name.trim().length < 3) {
    return res.status(400).json({ error: "\u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u09B0\u09BF\u09DF\u09C7\u09B2 \u09A8\u09BE\u09AE \u0987\u0982\u09B0\u09C7\u099C\u09C0 \u09AC\u09BE \u09AC\u09BE\u0982\u09B2\u09BE\u09DF \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09C1\u09A8 (\u0995\u09AE\u09AA\u0995\u09CD\u09B7\u09C7 \u09E9 \u0985\u0995\u09CD\u09B7\u09B0)\u0964" });
  }
  if (phone.length < 11 || !phone.startsWith("01")) {
    return res.status(400).json({ error: "\u09E7\u09E7 \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09B8\u09A0\u09BF\u0995 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ error: "\u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09AA\u09BF\u09A8 \u0985\u09AC\u09B6\u09CD\u09AF\u0987 \u09EA \u09A5\u09C7\u0995\u09C7 \u09EC \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09B8\u0982\u0996\u09CD\u09AF\u09BE \u09B9\u09A4\u09C7 \u09B9\u09AC\u09C7\u0964" });
  }
  if (/^(\d)\1+$/.test(pin) || pin === "1234" || pin === "5678" || pin === "123456") {
    return res.status(400).json({ error: "\u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u098F\u0995\u099F\u09C1 \u0995\u09A0\u09BF\u09A8 \u09AA\u09BF\u09A8 \u09A6\u09BF\u09A8\u0964 \u09B8\u09B9\u099C \u09AC\u09BE \u09A7\u09BE\u09B0\u09BE\u09AC\u09BE\u09B9\u09BF\u0995 \u09AA\u09BF\u09A8 \u0997\u09CD\u09B0\u09B9\u09A3\u09AF\u09CB\u0997\u09CD\u09AF \u09A8\u09DF\u0964" });
  }
  const db = readDB();
  const existing = db.users.find((u) => u.phone === phone);
  if (existing) {
    return res.status(400).json({ error: "\u098F\u0987 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7\u0987 \u098F\u0995\u099F\u09BF \u09A8\u09CD\u09AF\u09BE\u09A8\u09CB \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u0996\u09CB\u09B2\u09BE \u0986\u099B\u09C7!" });
  }
  const newUser = {
    name: name.trim(),
    phone,
    role: "user",
    pin,
    // Store as a normal, human-readable plain text PIN as requested!
    accountNo: Math.floor(1e9 + Math.random() * 9e9).toString(),
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
    isVerified: true,
    savingsBalance: 0,
    activeLoans: [],
    emiInstallments: [],
    transactions: [],
    securityLogs: [],
    bkashNo: bkashNo || "",
    nagadNo: nagadNo || "",
    gender: gender || "\u09AA\u09C1\u09B0\u09C1\u09B7",
    dob: dob || "",
    email: email || "",
    currentAddress: currentAddress || "",
    permanentAddress: permanentAddress || "",
    createdAt: Date.now(),
    notifications: [
      {
        id: "NW_REG_" + Date.now(),
        title: "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09AD\u09C7\u09B0\u09BF\u09AB\u09BF\u0995\u09C7\u09B6\u09A8 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8!",
        body: `${name}, \u09A8\u09CD\u09AF\u09BE\u09A8\u09CB-\u09AB\u09BE\u0987\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09B8 \u09A1\u09BF\u099C\u09BF\u099F\u09BE\u09B2 \u0993\u09DF\u09BE\u09B2\u09C7\u099F\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09A4\u09C8\u09B0\u09BF \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u0986\u09AA\u09A8\u09BE\u09B0 \u09AA\u09BF\u09A8 \u0995\u09BE\u09B0\u09CB \u09B8\u09BE\u09A5\u09C7 \u09B6\u09C7\u09DF\u09BE\u09B0 \u0995\u09B0\u09AC\u09C7\u09A8 \u09A8\u09BE\u0964`,
        timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
        isRead: false,
        type: "success"
      }
    ]
  };
  addSecurityLog(newUser, "register", "success", "\u09A8\u09A4\u09C1\u09A8 \u09AE\u09C7\u09AE\u09CD\u09AC\u09BE\u09B0\u09B6\u09BF\u09AA \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u0996\u09CB\u09B2\u09BE \u0993 \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1 \u09B8\u09C1\u09B0\u0995\u09CD\u09B7\u09BE\u09DF\u09A8 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8", req);
  db.users.push(newUser);
  writeDB(db);
  res.json({ success: true, user: newUser });
});
app.post("/api/user/reset", (req, res) => {
  const { phone } = req.body;
  const db = JSON.parse(JSON.stringify(DEFAULT_DB));
  writeDB(db);
  const activeUser = db.users.find((u) => u.phone === (phone || "01712345678")) || db.users[0];
  res.json({ success: true, user: activeUser });
});
app.post("/api/user/change-pin", (req, res) => {
  const { phone, currentPin, newPin } = req.body;
  if (!phone || !currentPin || !newPin) {
    return res.status(400).json({ error: "\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AA\u09BF\u09A8 \u098F\u09AC\u0982 \u09A8\u09A4\u09C1\u09A8 \u09AA\u09BF\u09A8 \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09BE \u0986\u09AC\u09B6\u09CD\u09AF\u0995\u0964" });
  }
  if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
    return res.status(400).json({ error: "\u09A8\u09A4\u09C1\u09A8 \u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1 \u0985\u09AC\u09B6\u09CD\u09AF\u0987 \u09EA \u09A5\u09C7\u0995\u09C7 \u09EC \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09B8\u0982\u0996\u09CD\u09AF\u09BE \u09B9\u09A4\u09C7 \u09B9\u09AC\u09C7\u0964" });
  }
  if (/^(\d)\1+$/.test(newPin) || newPin === "1234" || newPin === "5678" || newPin === "123456") {
    return res.status(400).json({ error: "\u09B8\u09B9\u099C \u09AC\u09BE \u09B8\u09BF\u0995\u09CB\u09DF\u09C7\u09A8\u09CD\u09B8\u09BF\u09AF\u09BC\u09BE\u09B2 \u09AA\u09BF\u09A8 (\u09AF\u09C7\u09AE\u09A8: \u09E7\u09E8\u09E9\u09EA \u09AC\u09BE \u09E7\u09E7\u09E7\u09E7) \u09B0\u09BE\u0996\u09BE \u09A8\u09BF\u09B0\u09BE\u09AA\u09A6 \u09A8\u09DF\u0964" });
  }
  if (currentPin === newPin) {
    return res.status(400).json({ error: "\u09A8\u09A4\u09C1\u09A8 \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1\u099F\u09BF \u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AA\u09BF\u09A8\u09C7\u09B0 \u09AE\u09A4\u09CB \u098F\u0995\u0987 \u09B9\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7 \u09A8\u09BE!" });
  }
  const db = readDB();
  const user = db.users.find((u) => u.phone === phone);
  if (!user) {
    return res.status(404).json({ error: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u09A4\u09A5\u09CD\u09AF \u0996\u09C1\u0981\u099C\u09C7 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964" });
  }
  if (!matchPin(currentPin, user.pin)) {
    addSecurityLog(user, "pin_change_failed", "failed", "\u09AD\u09C1\u09B2 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1 \u09A6\u09C7\u0993\u09DF\u09BE\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u09AA\u09BF\u09A8 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8\u09C7\u09B0 \u09AA\u09CD\u09B0\u099A\u09C7\u09B7\u09CD\u099F\u09BE \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5", req);
    writeDB(db);
    return res.status(401).json({ error: "\u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1\u099F\u09BF \u09B8\u09A0\u09BF\u0995 \u09A8\u09DF!" });
  }
  user.pin = newPin;
  addSecurityLog(user, "pin_change", "pin_change", "\u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09AA\u09BF\u09A8 \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7", req);
  user.notifications.unshift({
    id: "N_SEC_" + Date.now(),
    title: "\u09AA\u09BF\u09A8 \u0995\u09CB\u09A1 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u09B8\u09A4\u09B0\u09CD\u0995\u09AC\u09BE\u09B0\u09CD\u09A4\u09BE",
    body: `\u0986\u09AA\u09A8\u09BE\u09B0 \u09A1\u09BF\u09AD\u09BE\u0987\u09B8 \u09A5\u09C7\u0995\u09C7 \u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1\u099F\u09BF \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u0986\u09AA\u09A1\u09C7\u099F \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u09AF\u09A6\u09BF \u0986\u09AA\u09A8\u09BF \u098F\u099F\u09BF \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u09A8\u09BE \u0995\u09B0\u09C7 \u09A5\u09BE\u0995\u09C7\u09A8, \u09A4\u09AC\u09C7 \u0985\u09AC\u09BF\u09B2\u09AE\u09CD\u09AC\u09C7 \u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u09B9\u09C7\u09B2\u09CD\u09AA\u09B2\u09BE\u0987\u09A8 \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964`,
    timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
    createdAt: Date.now(),
    isRead: false,
    type: "warn"
  });
  writeDB(db);
  res.json({ success: true, user });
});
var getDeviceListAndKeys = (db) => {
  if (!db.registeredDevices) db.registeredDevices = [];
  if (!db.licenseKeys) db.licenseKeys = [];
  return {
    devices: db.registeredDevices,
    keys: db.licenseKeys
  };
};
app.post("/api/devices/check", (req, res) => {
  const { deviceId, deviceName } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: "Device ID is required" });
  }
  const db = readDB();
  const { devices } = getDeviceListAndKeys(db);
  let existingDevice = devices.find((d) => d.deviceId === deviceId);
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
app.post("/api/devices/activate", (req, res) => {
  const { deviceId, deviceName, licenseKey } = req.body;
  if (!deviceId || !licenseKey) {
    return res.status(400).json({ error: "\u09A1\u09BF\u09AD\u09BE\u0987\u09B8 \u0986\u0987\u09A1\u09BF \u098F\u09AC\u0982 \u09B2\u09BE\u0987\u09B8\u09C7\u09A8\u09CD\u09B8 \u0985\u09CD\u09AF\u09BE\u0995\u09CD\u099F\u09BF\u09AD\u09C7\u09B6\u09A8 \u0995\u09BF \u0986\u09AC\u09B6\u09CD\u09AF\u0995\u0964" });
  }
  const db = readDB();
  const { devices, keys } = getDeviceListAndKeys(db);
  const formattedKey = licenseKey.trim().toUpperCase();
  const keyIndex = keys.findIndex((k) => k.key === formattedKey);
  if (keyIndex === -1) {
    return res.status(400).json({ error: "\u09AD\u09C1\u09B2 \u09B2\u09BE\u0987\u09B8\u09C7\u09A8\u09CD\u09B8 \u0995\u09BF! \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u09B8\u09A0\u09BF\u0995 \u098F\u0995\u09CD\u099F\u09BF\u09AD\u09C7\u09B6\u09A8 \u0995\u09CB\u09A1\u099F\u09BF \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  const activeKey = keys[keyIndex];
  if (activeKey.status === "used") {
    return res.status(400).json({ error: "\u098F\u0987 \u09B2\u09BE\u0987\u09B8\u09C7\u09A8\u09CD\u09B8 \u0995\u09BF-\u099F\u09BF \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7 \u0985\u09A8\u09CD\u09AF \u098F\u0995\u099F\u09BF \u09A1\u09BF\u09AD\u09BE\u0987\u09B8\u09C7 \u09AC\u09CD\u09AF\u09AC\u09B9\u09C3\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7!" });
  }
  activeKey.status = "used";
  activeKey.usedByDevice = deviceId;
  activeKey.usedAt = Date.now();
  let devIndex = devices.findIndex((d) => d.deviceId === deviceId);
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
  res.json({ success: true, message: "\u09A1\u09BF\u09AD\u09BE\u0987\u09B8 \u0985\u09CD\u09AF\u09BE\u0995\u09CD\u099F\u09BF\u09AD\u09C7\u09B6\u09A8 \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09DF\u09C7\u099B\u09C7!" });
});
app.get("/api/devices/list", (req, res) => {
  const db = readDB();
  const { devices, keys } = getDeviceListAndKeys(db);
  res.json({
    success: true,
    devices,
    licenseKeys: keys
  });
});
app.post("/api/devices/generate-key", (req, res) => {
  const db = readDB();
  const { keys } = getDeviceListAndKeys(db);
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
app.post("/api/devices/delete-key", (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "\u0995\u09BF \u0986\u09AC\u09B6\u09CD\u09AF\u0995\u0964" });
  const db = readDB();
  const { keys } = getDeviceListAndKeys(db);
  const idx = keys.findIndex((k) => k.key === key);
  if (idx !== -1) {
    keys.splice(idx, 1);
    writeDB(db);
  }
  res.json({ success: true, licenseKeys: keys });
});
app.post("/api/devices/toggle", (req, res) => {
  const { deviceId, status } = req.body;
  if (!deviceId || !status) {
    return res.status(400).json({ error: "\u09AA\u09CD\u09AF\u09BE\u09B0\u09BE\u09AE\u09BF\u099F\u09BE\u09B0 \u09AB\u09BF\u09B2\u09CD\u09A1 \u09AE\u09BF\u09B8\u09BF\u0982\u0964" });
  }
  const db = readDB();
  const { devices } = getDeviceListAndKeys(db);
  const dev = devices.find((d) => d.deviceId === deviceId);
  if (dev) {
    dev.status = status;
    writeDB(db);
  }
  res.json({ success: true, devices });
});
app.post("/api/devices/delete", (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: "\u09A1\u09BF\u09AD\u09BE\u0987\u09B8 \u0986\u0987\u09A1\u09BF \u09AE\u09BF\u09B8\u09BF\u0982\u0964" });
  const db = readDB();
  const { devices } = getDeviceListAndKeys(db);
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx !== -1) {
    devices.splice(idx, 1);
    writeDB(db);
  }
  res.json({ success: true, devices });
});
app.post("/api/user/deposit", (req, res) => {
  const { phone, amount, method } = req.body;
  if (!phone || !amount) {
    return res.status(400).json({ error: "Phone and Amount are required" });
  }
  const db = readDB();
  const userIndex = db.users.findIndex((u) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }
  const user = db.users[userIndex];
  user.savingsBalance = Number(user.savingsBalance) + Number(amount);
  const methodNames = {
    bkash: "bKash Wallet",
    nagad: "Nagad Wallet",
    rocket: "Rocket Wallet",
    bank: "Bank Transfer"
  };
  const newTx = {
    id: `TX${Math.floor(1e4 + Math.random() * 9e4)}`,
    type: "deposit",
    method: method || "bkash",
    amount: Number(amount),
    date: getCurrentBanglaDateString(),
    status: "completed",
    titleBangla: `\u099C\u09AE\u09BE (${methodNames[method] || method})`,
    descBangla: "\u09B8\u099E\u09CD\u099A\u09DF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u0995\u09CD\u09AF\u09BE\u09B6 \u0987\u09A8 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8"
  };
  user.transactions.unshift(newTx);
  const newNotif = {
    id: `N_DEP_${Date.now()}`,
    title: "\u09B8\u099E\u09CD\u099A\u09AF\u09BC \u099C\u09AE\u09BE \u09B8\u09AB\u09B2 (Cash In)",
    body: `\u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u099E\u09CD\u099A\u09DF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09F3 ${Number(amount).toLocaleString("bn-BD")} \u099C\u09AE\u09BE \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
    timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
    createdAt: Date.now(),
    isRead: false,
    type: "success"
  };
  user.notifications.unshift(newNotif);
  writeDB(db);
  res.json({ success: true, user });
});
app.post("/api/user/withdraw", (req, res) => {
  const { phone, amount, method, pin } = req.body;
  if (!phone || !amount || !pin) {
    return res.status(400).json({ error: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0, \u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8\u09C7\u09B0 \u09AA\u09B0\u09BF\u09AE\u09BE\u09A3 \u098F\u09AC\u0982 \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1 \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  const db = readDB();
  const userIndex = db.users.findIndex((u) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u0996\u09C1\u0981\u099C\u09C7 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964" });
  }
  const user = db.users[userIndex];
  if (user.pin !== pin) {
    return res.status(400).json({ error: "\u09AD\u09C1\u09B2 \u09AA\u09BF\u09A8 \u0995\u09CB\u09A1! \u09A6\u09DF\u09BE \u0995\u09B0\u09C7 \u09B8\u09A0\u09BF\u0995 \u09AA\u09BF\u09A8 \u09A6\u09BF\u09A8\u0964" });
  }
  if (Number(user.savingsBalance) < Number(amount)) {
    return res.status(400).json({ error: "\u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u099E\u09CD\u099A\u09DF \u09B9\u09BF\u09B8\u09C7\u09AC\u09C7 \u09AA\u09B0\u09CD\u09AF\u09BE\u09AA\u09CD\u09A4 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09A8\u09C7\u0987!" });
  }
  user.savingsBalance = Number(user.savingsBalance) - Number(amount);
  const methodNames = {
    bkash: "bKash Wallet",
    nagad: "Nagad Wallet",
    rocket: "Rocket Wallet",
    bank: "Bank Transfer"
  };
  const newTx = {
    id: `TX${Math.floor(1e4 + Math.random() * 9e4)}`,
    type: "withdraw",
    method: method || "bank",
    amount: Number(amount),
    date: getCurrentBanglaDateString(),
    status: "completed",
    titleBangla: `\u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8 (${methodNames[method] || method})`,
    descBangla: "\u09B8\u09AB\u09B2 \u09A4\u09B9\u09AC\u09BF\u09B2 \u0995\u09CD\u09AF\u09BE\u09B6 \u0986\u0989\u099F"
  };
  user.transactions.unshift(newTx);
  const newNotif = {
    id: `N_WIT_${Date.now()}`,
    title: "\u09AB\u09BE\u09A8\u09CD\u09A1 \u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8 \u09B8\u09AB\u09B2",
    body: `\u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A5\u09C7\u0995\u09C7 \u09F3 ${Number(amount).toLocaleString("bn-BD")} \u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8\u09C7\u09B0 \u0985\u09A8\u09C1\u09B0\u09CB\u09A7 \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
    timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
    createdAt: Date.now(),
    isRead: false,
    type: "success"
  };
  user.notifications.unshift(newNotif);
  writeDB(db);
  res.json({ success: true, user });
});
function saveLoanDocumentFile(base64Str, loanId, field) {
  if (!base64Str) return "";
  if (base64Str.startsWith("/") || base64Str.startsWith("http")) return base64Str;
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let dataBuffer;
    let extension = "jpg";
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      const rawBase64 = matches[2];
      dataBuffer = Buffer.from(rawBase64, "base64");
      if (mimeType.includes("pdf")) {
        extension = "pdf";
      } else if (mimeType.includes("png")) {
        extension = "png";
      } else if (mimeType.includes("webp")) {
        extension = "webp";
      }
    } else {
      dataBuffer = Buffer.from(base64Str, "base64");
    }
    const filename = `loan_${loanId}_${field}.${extension}`;
    const filePath = import_path.default.join(UPLOADS_DIR, filename);
    import_fs.default.writeFileSync(filePath, dataBuffer);
    return `/api/loan-document/${loanId}/${field}`;
  } catch (err) {
    console.error(`[Loan-Document] Error saving base64 to file for ${loanId} ${field}:`, err);
    return "";
  }
}
app.get("/api/loan-document/:loanId/:field", async (req, res) => {
  const { loanId, field } = req.params;
  try {
    const files = import_fs.default.existsSync(UPLOADS_DIR) ? import_fs.default.readdirSync(UPLOADS_DIR) : [];
    const targetFile = files.find((f) => f.startsWith(`loan_${loanId}_${field}.`));
    if (targetFile) {
      const filePath = import_path.default.join(UPLOADS_DIR, targetFile);
      return res.sendFile(filePath);
    }
    if (firebaseDb) {
      console.log(`[Loan-Document] Local file missing for ${loanId} ${field}. Restoring from Cloud Firestore...`);
      const docRef = (0, import_firestore.doc)(firebaseDb, "nano_finance_docs", `loan_${loanId}_${field}`);
      let docSnap = await (0, import_firestore.getDoc)(docRef);
      let base64Str = "";
      if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData) {
          base64Str = docData.base64 || docData.base64Str || docData[`${field}Url`] || docData[field];
        }
      } else {
        console.log(`[Loan-Document] Individual doc missing. Trying legacy combined doc for ${loanId}...`);
        const legacyDocRef = (0, import_firestore.doc)(firebaseDb, "nano_finance_docs", `loan_${loanId}`);
        docSnap = await (0, import_firestore.getDoc)(legacyDocRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          if (docData) {
            base64Str = docData[`${field}Url`] || docData[field];
          }
        }
      }
      if (base64Str && (base64Str.startsWith("data:") || base64Str.length > 100)) {
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let dataBuffer;
        let extension = "jpg";
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const rawBase64 = matches[2];
          dataBuffer = Buffer.from(rawBase64, "base64");
          if (mimeType.includes("pdf")) {
            extension = "pdf";
          } else if (mimeType.includes("png")) {
            extension = "png";
          } else if (mimeType.includes("webp")) {
            extension = "webp";
          }
        } else {
          dataBuffer = Buffer.from(base64Str, "base64");
        }
        const filename = `loan_${loanId}_${field}.${extension}`;
        const filePath = import_path.default.join(UPLOADS_DIR, filename);
        import_fs.default.writeFileSync(filePath, dataBuffer);
        console.log(`[Loan-Document] Cache successfully restored for ${loanId} ${field}.`);
        return res.sendFile(filePath);
      }
    }
  } catch (err) {
    console.error(`[Loan-Document] Error serving/restoring document for ${loanId} ${field}:`, err);
  }
  const fallbackUrls = {
    nidFront: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350",
    nidBack: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350",
    selfie: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
    incomeProof: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&q=80&w=350",
    addressProof: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350"
  };
  const fallback = fallbackUrls[field] || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=350";
  return res.redirect(fallback);
});
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
  const userIndex = db.users.findIndex((u) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }
  const user = db.users[userIndex];
  const loanId = `LN${Math.floor(10125 + Math.random() * 9e3)}`;
  const savedNidFront = saveLoanDocumentFile(nidFrontUrl, loanId, "nidFront");
  const savedNidBack = saveLoanDocumentFile(nidBackUrl, loanId, "nidBack");
  const savedSelfie = saveLoanDocumentFile(selfieUrl, loanId, "selfie");
  const savedIncomeProof = saveLoanDocumentFile(incomeProofUrl, loanId, "incomeProof");
  const savedAddressProof = saveLoanDocumentFile(addressProofUrl, loanId, "addressProof");
  if (firebaseDb && !quotaExhausted) {
    const backupDocument = async (field, base64Str) => {
      if (!base64Str || !base64Str.startsWith("data:")) return;
      try {
        const docRef = (0, import_firestore.doc)(firebaseDb, "nano_finance_docs", `loan_${loanId}_${field}`);
        await (0, import_firestore.setDoc)(docRef, {
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
    await Promise.all([
      backupDocument("nidFront", nidFrontUrl),
      backupDocument("nidBack", nidBackUrl),
      backupDocument("selfie", selfieUrl),
      backupDocument("incomeProof", incomeProofUrl),
      backupDocument("addressProof", addressProofUrl)
    ]).catch((err) => {
      console.error("[Firebase-Sync] Propagating error in backup parallel tasks:", err);
    });
    const combinedLength = (nidFrontUrl?.length || 0) + (nidBackUrl?.length || 0) + (selfieUrl?.length || 0);
    if (combinedLength < 5e5) {
      try {
        const docRef = (0, import_firestore.doc)(firebaseDb, "nano_finance_docs", `loan_${loanId}`);
        await (0, import_firestore.setDoc)(docRef, {
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
    addressProofType: addressProofType || "electricity"
  };
  user.activeLoans.unshift(loanItem);
  const newNotif = {
    id: `N_LOAN_${Date.now()}`,
    title: "\u098B\u09A3 \u0986\u09AC\u09C7\u09A6\u09A8 \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u0997\u09C3\u09B9\u09C0\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7",
    body: `\u0986\u09AA\u09A8\u09BE\u09B0 ${categoryBangla} \u0986\u09AC\u09C7\u09A6\u09A8 ${loanId} \u09B0\u09BF\u09AD\u09BF\u0989\u09B0 \u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE\u09DF \u09B0\u09DF\u09C7\u099B\u09C7\u0964 \u0996\u09C1\u09AC \u09A6\u09CD\u09B0\u09C1\u09A4 \u09AF\u09BE\u099A\u09BE\u0987 \u0995\u09B0\u09BE \u09B9\u09AC\u09C7\u0964`,
    timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
    createdAt: Date.now(),
    isRead: false,
    type: "info"
  };
  user.notifications.unshift(newNotif);
  await writeDBAsync(db);
  res.json({ success: true, user });
});
app.post("/api/user/loan/approve", (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Phone is required" });
  }
  const db = readDB();
  const userIndex = db.users.findIndex((u) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }
  const user = db.users[userIndex];
  let hasPending = false;
  let approvedAmount = 0;
  let approvedTitle = "";
  user.activeLoans = user.activeLoans.map((loan) => {
    if (loan.status === "pending") {
      hasPending = true;
      approvedAmount = loan.amount;
      approvedTitle = loan.categoryBangla;
      return { ...loan, status: "approved" };
    }
    return loan;
  });
  if (!hasPending) {
    return res.status(400).json({ error: "\u0995\u09CB\u09A8\u09CB \u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982 \u098B\u09A3 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964 \u09A6\u09DF\u09BE \u0995\u09B0\u09C7 \u09A1\u09CD\u09AF\u09BE\u09B6\u09AC\u09CB\u09B0\u09CD\u09A1 \u09A5\u09C7\u0995\u09C7 \u098F\u0995\u099F\u09BF \u0986\u09AC\u09C7\u09A6\u09A8 \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  const disburseTx = {
    id: `TX${Math.floor(1e3 + Math.random() * 9e3)}`,
    type: "loan_disburse",
    method: "bank",
    amount: approvedAmount,
    date: "\u09E6\u09EF \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
    status: "completed",
    titleBangla: "\u098B\u09A3 \u09AC\u09BF\u09A4\u09B0\u09A3 (Bank)",
    descBangla: `${approvedTitle} \u09AB\u09BE\u09A8\u09CD\u09A1 \u09AC\u09BF\u09A4\u09B0\u09A3 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8`
  };
  user.transactions.unshift(disburseTx);
  user.savingsBalance = Number(user.savingsBalance) + approvedAmount;
  const baseEmi = Math.round(approvedAmount / 12);
  const additionalEmis = Array.from({ length: 3 }).map((_, i) => ({
    installmentNo: user.emiInstallments.length + i + 1,
    dueDate: `${20 + i} \u099C\u09C1\u09B2\u09BE\u0987, \u09E8\u09E6\u09E8\u09EC`,
    amount: baseEmi,
    status: "pending"
  }));
  user.emiInstallments = [...user.emiInstallments, ...additionalEmis];
  const newNotif = {
    id: `N_SIM_${Date.now()}`,
    title: "\u098B\u09A3 \u09AC\u09BF\u09A4\u09B0\u09A3 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8!",
    body: `\u0986\u09AA\u09A8\u09BE\u09B0 ${approvedTitle} \u099A\u09C2\u09DC\u09BE\u09A8\u09CD\u09A4\u09AD\u09BE\u09AC\u09C7 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7 \u098F\u09AC\u0982 \u09F3 ${approvedAmount.toLocaleString("bn-BD")} \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u099E\u09CD\u099A\u09AF\u09BC \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09AA\u09CD\u09B0\u09C7\u09B0\u09A3 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
    timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
    createdAt: Date.now(),
    isRead: false,
    type: "success"
  };
  user.notifications.unshift(newNotif);
  writeDB(db);
  res.json({ success: true, user });
});
app.post("/api/user/loan/pay-emi", (req, res) => {
  const { phone, installmentNo, amount, method } = req.body;
  if (!phone || !installmentNo || !amount) {
    return res.status(400).json({ error: "Phone, installment number and amount are required" });
  }
  const db = readDB();
  const userIndex = db.users.findIndex((u) => u.phone === phone);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }
  const user = db.users[userIndex];
  if (Number(user.savingsBalance) < Number(amount)) {
    return res.status(400).json({ error: "\u09AA\u09B0\u09CD\u09AF\u09BE\u09AA\u09CD\u09A4 \u09B8\u099E\u09CD\u099A\u09DF \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09A8\u09C7\u0987! \u09A6\u09DF\u09BE \u0995\u09B0\u09C7 \u0993\u09DF\u09BE\u09B2\u09C7\u099F\u09C7 \u099F\u09BE\u0995\u09BE \u099C\u09AE\u09BE \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  user.savingsBalance = Number(user.savingsBalance) - Number(amount);
  user.emiInstallments = user.emiInstallments.map((inst) => {
    if (inst.installmentNo === Number(installmentNo)) {
      return { ...inst, status: "paid" };
    }
    return inst;
  });
  const newTx = {
    id: `TX${Math.floor(1e4 + Math.random() * 9e4)}`,
    type: "loan_repay",
    method: method || "bkash",
    amount: Number(amount),
    date: "\u09E6\u09EF \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
    status: "completed",
    titleBangla: "\u0995\u09BF\u09B8\u09CD\u09A4\u09BF \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8",
    descBangla: `\u0995\u09BF\u09B8\u09CD\u09A4\u09BF #${installmentNo} \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8`
  };
  user.transactions.unshift(newTx);
  let matchedLoanApprove = false;
  user.activeLoans = user.activeLoans.map((loan) => {
    if (loan.status === "approved" && !matchedLoanApprove) {
      matchedLoanApprove = true;
      const count = Number(loan.repaidCount) + 1;
      const status = count >= Number(loan.totalInstallments) ? "paid" : loan.status;
      return { ...loan, repaidCount: count, status };
    }
    return loan;
  });
  const newNotif = {
    id: `N_REP_${Date.now()}`,
    title: `\u0995\u09BF\u09B8\u09CD\u09A4\u09BF #${installmentNo} \u09B8\u09AB\u09B2 \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F`,
    body: `\u0986\u09AA\u09A8\u09BE\u09B0 \u098B\u09A3 \u0995\u09BF\u09B8\u09CD\u09A4\u09BF #${installmentNo} \u098F\u09B0 \u099C\u09A8\u09CD\u09AF \u09F3 ${Number(amount).toLocaleString("bn-BD")} \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
    timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
    createdAt: Date.now(),
    isRead: false,
    type: "success"
  };
  user.notifications.unshift(newNotif);
  writeDB(db);
  res.json({ success: true, user });
});
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
app.post("/api/admin/get-all-data", (req, res) => {
  const { adminPhone } = req.body;
  if (!adminPhone) {
    return res.status(400).json({ error: "Admin credentials required" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin" && operator.role !== "sub_admin") {
    return res.status(403).json({ error: "\u0985\u09CD\u09AF\u09BE\u0995\u09CD\u09B8\u09C7\u09B8 \u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0! \u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4\u0964" });
  }
  const allUsers = db.users.filter((u) => u.role === "user");
  const { subAdmins: sanitizedSubAdmins, mainAdmins: sanitizedMainAdmins } = getSanitizedAdmins(db.users, adminPhone);
  const totalUsersCount = allUsers.length;
  const totalSavingsSum = allUsers.reduce((sum, u) => sum + Number(u.savingsBalance || 0), 0);
  let activeLoansCount = 0;
  let totalDisbursedLoansAmt = 0;
  let pendingLoansCount = 0;
  allUsers.forEach((u) => {
    (u.activeLoans || []).forEach((loan) => {
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
app.post("/api/admin/clear-data", (req, res) => {
  const { adminPhone, pruneOption } = req.body;
  if (!adminPhone) {
    return res.status(400).json({ error: "Admin credentials required" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin" && operator.role !== "sub_admin") {
    return res.status(403).json({ error: "\u0985\u09CD\u09AF\u09BE\u0995\u09CD\u09B8\u09C7\u09B8 \u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0! \u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4\u0964" });
  }
  if (!pruneOption) {
    return res.status(400).json({ error: "Pruning option is required." });
  }
  function getItemTimestamp(item) {
    if (item.timestamp && typeof item.timestamp === "number") return item.timestamp;
    if (item.loggedAt && typeof item.loggedAt === "number") return item.loggedAt;
    if (item.updatedAt && typeof item.updatedAt === "number") return item.updatedAt;
    if (item.id && typeof item.id === "string") {
      const match = item.id.match(/\d{13}/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }
    return 0;
  }
  const now = Date.now();
  let threshold = 0;
  let hasThreshold = false;
  if (pruneOption === "7_days") {
    threshold = now - 7 * 24 * 60 * 60 * 1e3;
    hasThreshold = true;
  } else if (pruneOption === "15_days") {
    threshold = now - 15 * 24 * 60 * 60 * 1e3;
    hasThreshold = true;
  } else if (pruneOption === "21_days") {
    threshold = now - 21 * 24 * 60 * 60 * 1e3;
    hasThreshold = true;
  } else if (pruneOption === "30_days") {
    threshold = now - 30 * 24 * 60 * 60 * 1e3;
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
  db.users.forEach((user) => {
    if (user.transactions && Array.isArray(user.transactions)) {
      const initialCount = user.transactions.length;
      if (!hasThreshold) {
        user.transactions = [];
      } else {
        user.transactions = user.transactions.filter((tx) => {
          const t = getItemTimestamp(tx);
          return t >= threshold;
        });
      }
      clearedCounts.transactions += initialCount - user.transactions.length;
    }
    if (user.securityLogs && Array.isArray(user.securityLogs)) {
      const initialCount = user.securityLogs.length;
      if (!hasThreshold) {
        user.securityLogs = [];
      } else {
        user.securityLogs = user.securityLogs.filter((log) => {
          const t = getItemTimestamp(log);
          return t >= threshold;
        });
      }
      clearedCounts.securityLogs += initialCount - user.securityLogs.length;
    }
    if (user.notifications && Array.isArray(user.notifications)) {
      const initialCount = user.notifications.length;
      if (!hasThreshold) {
        user.notifications = [];
      } else {
        user.notifications = user.notifications.filter((ntf) => {
          const t = getItemTimestamp(ntf);
          return t >= threshold;
        });
      }
      clearedCounts.notifications += initialCount - user.notifications.length;
    }
  });
  if (db.checkouts && Array.isArray(db.checkouts)) {
    const initialCount = db.checkouts.length;
    if (!hasThreshold) {
      db.checkouts = [];
    } else {
      db.checkouts = db.checkouts.filter((c) => {
        const t = getItemTimestamp(c);
        return t >= threshold;
      });
    }
    clearedCounts.checkouts += initialCount - db.checkouts.length;
  }
  writeDB(db);
  res.json({
    success: true,
    clearedCounts,
    message: "\u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u0985\u09AA\u09CD\u09B0\u09DF\u09CB\u099C\u09A8\u09C0\u09DF \u09A1\u09BE\u099F\u09BE \u099B\u09BE\u0981\u099F\u09BE\u0987 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09DF\u09C7\u099B\u09C7!"
  });
});
app.post("/api/admin/settings/update", (req, res) => {
  const { adminPhone, settings } = req.body;
  if (!adminPhone || !settings) {
    return res.status(400).json({ error: "Required fields missing" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin" && operator.role !== "sub_admin") {
    return res.status(403).json({ error: "\u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u09B8\u09C7\u099F\u09BF\u0982\u09B8 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7\u0964" });
  }
  db.settings = {
    appName: settings.appName || "\u09A8\u09CD\u09AF\u09BE\u09A8\u09CB-\u09AB\u09BE\u0987\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09B8",
    appSlug: settings.appSlug || "\u09B8\u09BF\u09B2\u09AD\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u09A1\u09AD\u09BE\u09A8\u09CD\u09B8\u09A1",
    minDeposit: Number(settings.minDeposit) || 10,
    maxDeposit: Number(settings.maxDeposit) || 1e6,
    minWithdraw: Number(settings.minWithdraw) || 100,
    maxWithdraw: Number(settings.maxWithdraw) || 5e4,
    interestRate: Number(settings.interestRate) || 14,
    bkashNumber: settings.bkashNumber || "01700000000",
    nagadNumber: settings.nagadNumber || "01800000000",
    depositPresets: settings.depositPresets || "20, 50, 100, 500",
    bkashLogo: settings.bkashLogo !== void 0 ? settings.bkashLogo : "",
    nagadLogo: settings.nagadLogo !== void 0 ? settings.nagadLogo : "",
    whatsappNumber: settings.whatsappNumber !== void 0 ? settings.whatsappNumber : "",
    helpCenterLogo: settings.helpCenterLogo !== void 0 ? settings.helpCenterLogo : "",
    minLoanAmount: Number(settings.minLoanAmount) !== void 0 ? Number(settings.minLoanAmount) : 1e4,
    maxLoanAmount: Number(settings.maxLoanAmount) !== void 0 ? Number(settings.maxLoanAmount) : 2e5,
    loanAmountPresets: settings.loanAmountPresets !== void 0 ? settings.loanAmountPresets : "20000, 30000, 50000, 100000",
    minLoanMonths: Number(settings.minLoanMonths) !== void 0 ? Number(settings.minLoanMonths) : 3,
    maxLoanMonths: Number(settings.maxLoanMonths) !== void 0 ? Number(settings.maxLoanMonths) : 18,
    loanMonthPresets: settings.loanMonthPresets !== void 0 ? settings.loanMonthPresets : "3, 6, 9, 12",
    requireMinSavingsForLoan: settings.requireMinSavingsForLoan !== void 0 ? !!settings.requireMinSavingsForLoan : false,
    minSavingsForLoanAmount: Number(settings.minSavingsForLoanAmount) !== void 0 ? Number(settings.minSavingsForLoanAmount) : 500,
    regFieldGender: settings.regFieldGender !== void 0 ? !!settings.regFieldGender : true,
    regFieldDob: settings.regFieldDob !== void 0 ? !!settings.regFieldDob : true,
    regFieldEmail: settings.regFieldEmail !== void 0 ? !!settings.regFieldEmail : true,
    regFieldCurrentAddress: settings.regFieldCurrentAddress !== void 0 ? !!settings.regFieldCurrentAddress : true,
    regFieldPermanentAddress: settings.regFieldPermanentAddress !== void 0 ? !!settings.regFieldPermanentAddress : true,
    regFieldMfs: settings.regFieldMfs !== void 0 ? !!settings.regFieldMfs : true
  };
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});
app.post("/api/admin/sub-admin/save", (req, res) => {
  const { adminPhone, name, phone, pin, isEditing, oldPhone, role } = req.body;
  if (!adminPhone || !name || !phone || !pin) {
    return res.status(400).json({ error: "\u09B8\u0995\u09B2 \u09A4\u09A5\u09CD\u09AF \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09BE \u0986\u09AC\u09B6\u09CD\u09AF\u0995!" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin") {
    return res.status(403).json({ error: "\u0985\u09CD\u09AF\u09BE\u0995\u09CD\u09B8\u09C7\u09B8 \u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0! \u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u09AE\u09C7\u0987\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8/\u09B8\u09BE\u09AC-\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u09A4\u09C8\u09B0\u09BF \u09AC\u09BE \u098F\u09A1\u09BF\u099F \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7\u09A8\u0964" });
  }
  const targetRole = role === "main_admin" ? "main_admin" : "sub_admin";
  if (isEditing) {
    const adminIdx = db.users.findIndex((u) => u.phone === oldPhone && (u.role === "sub_admin" || u.role === "main_admin"));
    if (adminIdx === -1) {
      return res.status(404).json({ error: "\u0989\u0995\u09CD\u09A4 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u0996\u09C1\u0981\u099C\u09C7 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964" });
    }
    if (oldPhone === "01700000000") {
      if (adminPhone !== "01700000000") {
        return res.status(403).json({ error: "\u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09A8\u09C0\u09A4\u09BF\u09AE\u09BE\u09B2\u09BE\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u098F\u0987 \u09AA\u09CD\u09B0\u099F\u09C7\u0995\u09CD\u099F\u09C7\u09A1 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u099F\u09BF\u09B0 \u09A4\u09A5\u09CD\u09AF \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09BE \u09B8\u09AE\u09CD\u09AD\u09AC \u09A8\u09DF!" });
      }
      if (phone !== "01700000000" || targetRole !== "main_admin") {
        return res.status(400).json({ error: "\u09AE\u09C2\u09B2 \u09AE\u09C7\u0987\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8\u09C7\u09B0 \u09AB\u09CB\u09A8 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09AC\u09BE \u09B0\u09CB\u09B2 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09BE \u09AF\u09BE\u09AC\u09C7 \u09A8\u09BE!" });
      }
    }
    if (phone !== oldPhone) {
      const conflict = db.users.find((u) => u.phone === phone);
      if (conflict) {
        return res.status(400).json({ error: "\u098F\u0987 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7 \u0986\u09B0\u09C7\u0995\u099F\u09BF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09B0\u09C7\u099C\u09BF\u09B8\u09CD\u099F\u09BE\u09B0\u09CD\u09A1 \u0986\u099B\u09C7!" });
      }
    }
    db.users[adminIdx].name = name;
    db.users[adminIdx].phone = phone;
    db.users[adminIdx].pin = pin;
    db.users[adminIdx].role = targetRole;
  } else {
    const conflict = db.users.find((u) => u.phone === phone);
    if (conflict) {
      return res.status(400).json({ error: "\u098F\u0987 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7 \u0986\u09B0\u09C7\u0995\u099F\u09BF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09B0\u09C7\u099C\u09BF\u09B8\u09CD\u099F\u09BE\u09B0\u09CD\u09A1 \u0986\u099B\u09C7!" });
    }
    db.users.push({
      name,
      phone,
      pin,
      accountNo: Math.floor(1e9 + Math.random() * 9e9).toString(),
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
app.post("/api/admin/sub-admin/delete", (req, res) => {
  const { adminPhone, phone } = req.body;
  if (!adminPhone || !phone) {
    return res.status(400).json({ error: "\u09AB\u09CB\u09A8\u09C7\u09B0 \u09A4\u09A5\u09CD\u09AF \u09AE\u09BF\u09B8\u09BF\u0982\u0964" });
  }
  if (phone === "01700000000") {
    return res.status(400).json({ error: "\u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09A8\u09C0\u09A4\u09BF\u09AE\u09BE\u09B2\u09BE\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u098F\u0987 \u09AA\u09CD\u09B0\u099F\u09C7\u0995\u09CD\u099F\u09C7\u09A1 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u099F\u09BF \u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09BE \u09B8\u09AE\u09CD\u09AD\u09AC \u09A8\u09DF!" });
  }
  if (adminPhone === phone) {
    return res.status(400).json({ error: "\u0986\u09AA\u09A8\u09BF \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8\u09C7 \u09B2\u0997\u09A1-\u0987\u09A8 \u0986\u099B\u09C7\u09A8, \u09A4\u09BE\u0987 \u09A8\u09BF\u099C\u09C7\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7\u09A8 \u09A8\u09BE!" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin") {
    return res.status(403).json({ error: "\u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u09AE\u09C7\u0987\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7\u09A8\u0964" });
  }
  db.users = db.users.filter((u) => !(u.phone === phone && (u.role === "sub_admin" || u.role === "main_admin")));
  writeDB(db);
  const { subAdmins: sanitizedSubAdmins, mainAdmins: sanitizedMainAdmins } = getSanitizedAdmins(db.users, adminPhone);
  res.json({
    success: true,
    subAdmins: sanitizedSubAdmins,
    mainAdmins: sanitizedMainAdmins
  });
});
app.post("/api/admin/user/create", (req, res) => {
  const { adminPhone, name, phone, pin, savingsBalance, isVerified } = req.body;
  if (!adminPhone || !name || !phone || !pin) {
    return res.status(400).json({ error: "\u09AA\u09CD\u09B0\u09DF\u09CB\u099C\u09A8\u09C0\u09DF \u09B8\u0995\u09B2 \u09A4\u09A5\u09CD\u09AF (\u09A8\u09BE\u09AE, \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0, \u09EA-\u09EC \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09AA\u09BF\u09A8) \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  if (phone.length < 11 || !phone.startsWith("01")) {
    return res.status(400).json({ error: "\u09E7\u09E7 \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09B8\u09A0\u09BF\u0995 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ error: "\u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09AA\u09BF\u09A8 \u0985\u09AC\u09B6\u09CD\u09AF\u0987 \u09EA \u09A5\u09C7\u0995\u09C7 \u09EC \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09B8\u0982\u0996\u09CD\u09AF\u09BE \u09B9\u09A4\u09C7 \u09B9\u09AC\u09C7\u0964" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin" && operator.role !== "sub_admin") {
    return res.status(403).json({ error: "\u0985\u09CD\u09AF\u09BE\u0995\u09CD\u09B8\u09C7\u09B8 \u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0!" });
  }
  const conflict = db.users.find((u) => u.phone === phone);
  if (conflict) {
    return res.status(400).json({ error: "\u098F\u0987 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7 \u098F\u0995\u099F\u09BF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09B0\u09C7\u099C\u09BF\u09B8\u09CD\u099F\u09BE\u09B0\u09CD\u09A1 \u0986\u099B\u09C7!" });
  }
  const initialBal = Number(savingsBalance) || 0;
  const newUser = {
    name: name.trim(),
    phone,
    pin,
    // Store as a normal, human-readable plain PIN as requested!
    accountNo: Math.floor(1e9 + Math.random() * 9e9).toString(),
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260",
    isVerified: isVerified !== void 0 ? Boolean(isVerified) : true,
    savingsBalance: initialBal,
    activeLoans: [],
    emiInstallments: [],
    role: "user",
    transactions: initialBal > 0 ? [
      {
        id: `TX_INIT_${Date.now()}`,
        type: "deposit",
        method: "bank",
        amount: initialBal,
        date: "\u09E6\u09EF \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
        status: "completed",
        titleBangla: "\u09AA\u09CD\u09B0\u09BE\u09B0\u09AE\u09CD\u09AD\u09BF\u0995 \u099C\u09AE\u09BE \u0986\u09AE\u09BE\u09A8\u09A4",
        descBangla: "\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0995\u09B0\u09CD\u09A4\u09C3\u0995 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u0996\u09CB\u09B2\u09BE\u09B0 \u09B8\u09AE\u09DF \u099C\u09AE\u09BE \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8"
      }
    ] : [],
    securityLogs: [
      {
        id: `LOG_INIT_${Date.now()}`,
        eventType: "register_admin",
        status: "success",
        details: `\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 (${operator.name}) \u0995\u09B0\u09CD\u09A4\u09C3\u0995 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A4\u09C8\u09B0\u09BF \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09DF\u09C7\u099B\u09C7`,
        ip: "127.0.0.1",
        device: "Server Admin Portal",
        timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
        timestamp: Date.now()
      }
    ],
    createdAt: Date.now(),
    notifications: [
      {
        id: `N_REG_${Date.now()}`,
        title: "\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0995\u09B0\u09CD\u09A4\u09C3\u0995 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A4\u09C8\u09B0\u09BF\u0995\u09B0\u09A3",
        body: `\u09B8\u09CD\u09AC\u09BE\u0997\u09A4\u09AE! \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u09AA\u09CD\u09AF\u09BE\u09A8\u09C7\u09B2 \u09A5\u09C7\u0995\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u09AE\u09C7\u09AE\u09CD\u09AC\u09BE\u09B0\u09B6\u09BF\u09AA \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u0996\u09CB\u09B2\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u09AA\u09CD\u09B0\u09BE\u09A5\u09AE\u09BF\u0995 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8: \u09F3 ${initialBal.toLocaleString()}`,
        timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
        createdAt: Date.now(),
        isRead: false,
        type: "success"
      }
    ]
  };
  db.users.push(newUser);
  writeDB(db);
  res.json({ success: true, users: db.users.filter((u) => u.role === "user") });
});
app.post("/api/admin/user/update", async (req, res) => {
  const {
    adminPhone,
    userPhone,
    isVerified,
    savingsBalance,
    isDelete,
    name,
    newPhone,
    pin,
    adminSim,
    adminDisburseNumber,
    adminDisburseMethod,
    adminNotesText,
    adminWhatsapp
  } = req.body;
  if (!adminPhone || !userPhone) {
    return res.status(400).json({ error: "\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0993 \u0997\u09CD\u09B0\u09BE\u09B9\u0995\u09C7\u09B0 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09AA\u09CD\u09B0\u09DF\u09CB\u099C\u09A8\u0964" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin" && operator.role !== "sub_admin") {
    return res.status(403).json({ error: "\u0985\u09CD\u09AF\u09BE\u0995\u09CD\u09B8\u09C7\u09B8 \u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0!" });
  }
  const userIdx = db.users.findIndex((u) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u0996\u09C1\u0981\u099C\u09C7 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964" });
  }
  if (isDelete) {
    db.users.splice(userIdx, 1);
  } else {
    const user = db.users[userIdx];
    if (req.body.customNotification) {
      if (!user.notifications) user.notifications = [];
      user.notifications.unshift({
        id: `N_CUST_${Date.now()}`,
        title: req.body.customNotification.title || "\u09AC\u09BF\u09B6\u09C7\u09B7 \u09AC\u09BF\u099C\u09CD\u099E\u09AA\u09CD\u09A4\u09BF",
        body: req.body.customNotification.body || "",
        timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
        createdAt: Date.now(),
        isRead: false,
        type: req.body.customNotification.type || "info"
      });
    }
    if (name) {
      db.users[userIdx].name = name.trim();
    }
    if (adminSim !== void 0) {
      db.users[userIdx].adminSim = adminSim;
    }
    if (adminDisburseNumber !== void 0) {
      db.users[userIdx].adminDisburseNumber = adminDisburseNumber;
    }
    if (adminDisburseMethod !== void 0) {
      db.users[userIdx].adminDisburseMethod = adminDisburseMethod;
    }
    if (adminNotesText !== void 0) {
      db.users[userIdx].adminNotesText = adminNotesText;
    }
    if (adminWhatsapp !== void 0) {
      db.users[userIdx].adminWhatsapp = adminWhatsapp;
    }
    if (req.body.bkashNo !== void 0) {
      db.users[userIdx].bkashNo = req.body.bkashNo;
    }
    if (req.body.nagadNo !== void 0) {
      db.users[userIdx].nagadNo = req.body.nagadNo;
    }
    if (req.body.gender !== void 0) {
      db.users[userIdx].gender = req.body.gender;
    }
    if (req.body.dob !== void 0) {
      db.users[userIdx].dob = req.body.dob;
    }
    if (req.body.email !== void 0) {
      db.users[userIdx].email = req.body.email;
    }
    if (req.body.currentAddress !== void 0) {
      db.users[userIdx].currentAddress = req.body.currentAddress;
    }
    if (req.body.permanentAddress !== void 0) {
      db.users[userIdx].permanentAddress = req.body.permanentAddress;
    }
    if (newPhone && newPhone !== userPhone) {
      if (newPhone.length < 11 || !newPhone.startsWith("01")) {
        return res.status(400).json({ error: "\u09E7\u09E7 \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09B8\u09A0\u09BF\u0995 \u09A8\u09A4\u09C1\u09A8 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09C1\u09A8\u0964" });
      }
      const conflict = db.users.find((u) => u.phone === newPhone);
      if (conflict) {
        return res.status(400).json({ error: "\u09A8\u09A4\u09C1\u09A8 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0\u099F\u09BF \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7 \u0986\u09B0\u09C7\u0995\u099F\u09BF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964" });
      }
      db.users[userIdx].phone = newPhone;
    }
    if (pin) {
      if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        return res.status(400).json({ error: "\u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09AA\u09BF\u09A8 \u0985\u09AC\u09B6\u09CD\u09AF\u0987 \u09EA \u09A5\u09C7\u0995\u09C7 \u09EC \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09B8\u0982\u0996\u09CD\u09AF\u09BE \u09B9\u09A4\u09C7 \u09B9\u09AC\u09C7\u0964" });
      }
      db.users[userIdx].pin = pin;
    }
    if (isVerified !== void 0) {
      db.users[userIdx].isVerified = Boolean(isVerified);
    }
    if (savingsBalance !== void 0) {
      const oldBal = Number(db.users[userIdx].savingsBalance || 0);
      const newBal = Number(savingsBalance);
      db.users[userIdx].savingsBalance = newBal;
      if (newBal !== oldBal) {
        const delta = newBal - oldBal;
        const adjTx = {
          id: `TX_ADJ_${Math.floor(1e3 + Math.random() * 9e3)}`,
          type: delta > 0 ? "deposit" : "withdraw",
          method: "bank",
          amount: Math.abs(delta),
          date: "\u09E6\u09EF \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
          status: "completed",
          titleBangla: "\u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09B8\u09AE\u09A8\u09CD\u09AC\u09DF (\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8)",
          descBangla: delta > 0 ? "\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0995\u09B0\u09CD\u09A4\u09C3\u0995 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F" : "\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0995\u09B0\u09CD\u09A4\u09C3\u0995 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A1\u09C7\u09AC\u09BF\u099F"
        };
        db.users[userIdx].transactions.unshift(adjTx);
        db.users[userIdx].notifications.unshift({
          id: `N_ADJ_${Date.now()}`,
          title: "\u09B9\u09BF\u09B8\u09BE\u09AC \u09B8\u09AE\u09A8\u09CD\u09AC\u09DF \u09AC\u09BF\u099C\u09CD\u099E\u09AA\u09CD\u09A4\u09BF",
          body: `\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0995\u09B0\u09CD\u09A4\u09C3\u0995 \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u099E\u09CD\u099A\u09AF\u09BC \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09B8\u09AE\u09A8\u09CD\u09AC\u09DF \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u09A8\u09A4\u09C1\u09A8 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8: \u09F3 ${newBal.toLocaleString()}`,
          timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
          createdAt: Date.now(),
          isRead: false,
          type: "info"
        });
      }
    }
  }
  await writeDBAsync(db);
  res.json({ success: true, users: db.users.filter((u) => u.role === "user") });
});
app.post("/api/admin/user/transaction/add", (req, res) => {
  const { adminPhone, userPhone, type, method, amount, date, status, titleBangla, descBangla } = req.body;
  if (!adminPhone || !userPhone || !type || !method || !amount) {
    return res.status(400).json({ error: "\u09AA\u09CD\u09B0\u09DF\u09CB\u099C\u09A8\u09C0\u09DF \u09B8\u0995\u09B2 \u09A4\u09A5\u09CD\u09AF \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin" && operator.role !== "sub_admin") {
    return res.status(403).json({ error: "\u0985\u09CD\u09AF\u09BE\u0995\u09CD\u09B8\u09C7\u09B8 \u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0!" });
  }
  const userIdx = db.users.findIndex((u) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u0996\u09C1\u0981\u099C\u09C7 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964" });
  }
  const newTx = {
    id: `TX_MAN_${Date.now()}`,
    type,
    method,
    amount: Number(amount),
    date: date || "\u09E6\u09EF \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
    status: status || "completed",
    titleBangla: titleBangla || "\u09AE\u09CD\u09AF\u09BE\u09A8\u09C1\u09AF\u09BC\u09BE\u09B2 \u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09C7\u0995\u09B6\u09A8",
    descBangla: descBangla || "\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u0995\u09B0\u09CD\u09A4\u09C3\u0995 \u09AF\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7"
  };
  db.users[userIdx].transactions.unshift(newTx);
  writeDB(db);
  res.json({ success: true, users: db.users.filter((u) => u.role === "user") });
});
app.post("/api/admin/user/transaction/update", (req, res) => {
  const { adminPhone, userPhone, transactionId, action, amount, status, date, titleBangla, descBangla } = req.body;
  if (!adminPhone || !userPhone || !transactionId) {
    return res.status(400).json({ error: "\u09A1\u09BE\u099F\u09BE \u09AB\u09BF\u09B2\u09CD\u09A1 \u09AE\u09BF\u09B8\u09BF\u0982\u0964" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin" && operator.role !== "sub_admin") {
    return res.status(403).json({ error: "\u0985\u09CD\u09AF\u09BE\u0995\u09CD\u09B8\u09C7\u09B8 \u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0!" });
  }
  const userIdx = db.users.findIndex((u) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u0996\u09C1\u0981\u099C\u09C7 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964" });
  }
  const user = db.users[userIdx];
  if (action === "delete") {
    user.transactions = (user.transactions || []).filter((tx) => tx.id !== transactionId);
  } else {
    user.transactions = (user.transactions || []).map((tx) => {
      if (tx.id === transactionId) {
        return {
          ...tx,
          amount: amount !== void 0 ? Number(amount) : tx.amount,
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
  res.json({ success: true, users: db.users.filter((u) => u.role === "user") });
});
app.post("/api/admin/user/loan/update", async (req, res) => {
  const {
    adminPhone,
    userPhone,
    loanId,
    action,
    category,
    amount,
    months,
    status,
    repaidCount,
    totalInstallments,
    emiInstallments,
    adminSim,
    adminDisburseNumber,
    adminDisburseMethod,
    adminNotesText,
    adminWhatsapp
  } = req.body;
  if (!adminPhone || !userPhone) {
    return res.status(400).json({ error: "\u09AA\u09CD\u09AF\u09BE\u09B0\u09BE\u09AE\u09BF\u099F\u09BE\u09B0 \u09AB\u09BF\u09B2\u09CD\u09A1 \u09AE\u09BF\u09B8\u09BF\u0982\u0964" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin" && operator.role !== "sub_admin") {
    return res.status(403).json({ error: "\u0985\u09CD\u09AF\u09BE\u0995\u09CD\u09B8\u09C7\u09B8 \u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0!" });
  }
  const userIdx = db.users.findIndex((u) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u0996\u09C1\u0981\u099C\u09C7 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964" });
  }
  const user = db.users[userIdx];
  if (action === "delete") {
    user.activeLoans = (user.activeLoans || []).filter((l) => l.id !== loanId);
  } else if (action === "add_loan") {
    const loanAmt = Number(amount) || 1e4;
    const loanMths = Number(months) || 12;
    const emiAmt = Math.ceil(loanAmt / loanMths);
    const newL = {
      id: loanId || `L_MAN_${Date.now()}`,
      category: category || "personal",
      categoryBangla: category === "business" ? "\u09AC\u09CD\u09AF\u09AC\u09B8\u09BE\u09DF\u09BF\u0995 \u098B\u09A3" : category === "agriculture" ? "\u0995\u09C3\u09B7\u09BF \u098B\u09A3" : "\u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u0997\u09A4 \u098B\u09A3",
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
    const generatedEmis = [];
    const count = Number(totalInstallments) || loanMths;
    for (let i = 1; i <= count; i++) {
      generatedEmis.push({
        installmentNo: i,
        dueDate: `\u09E7\u09E6 ${["\u099C\u09C1\u09B2\u09BE\u0987", "\u0986\u0997\u09B8\u09CD\u099F", "\u09B8\u09C7\u09AA\u09CD\u099F\u09C7\u09AE\u09CD\u09AC\u09B0", "\u0985\u0995\u09CD\u099F\u09CB\u09AC\u09B0", "\u09A8\u09AD\u09C7\u09AE\u09CD\u09AC\u09B0", "\u09A1\u09BF\u09B8\u09C7\u09AE\u09CD\u09AC\u09B0", "\u099C\u09BE\u09A8\u09C1\u09DF\u09BE\u09B0\u09BF", "\u09AB\u09C7\u09AC\u09CD\u09B0\u09C1\u09DF\u09BE\u09B0\u09BF", "\u09AE\u09BE\u09B0\u09CD\u099A", "\u098F\u09AA\u09CD\u09B0\u09BF\u09B2", "\u09AE\u09C7", "\u099C\u09C1\u09A8"][i % 12]}, \u09E8\u09E6\u09E8\u09EC`,
        amount: emiAmt,
        status: i <= (Number(repaidCount) || 0) ? "paid" : "pending"
      });
    }
    user.emiInstallments = generatedEmis;
  } else {
    user.activeLoans = (user.activeLoans || []).map((l) => {
      if (l.id === loanId) {
        return {
          ...l,
          category: category || l.category,
          amount: amount !== void 0 ? Number(amount) : l.amount,
          months: months !== void 0 ? Number(months) : l.months,
          status: status || l.status,
          repaidCount: repaidCount !== void 0 ? Number(repaidCount) : l.repaidCount,
          totalInstallments: totalInstallments !== void 0 ? Number(totalInstallments) : l.totalInstallments,
          adminSim: adminSim !== void 0 ? adminSim : l.adminSim,
          adminDisburseNumber: adminDisburseNumber !== void 0 ? adminDisburseNumber : l.adminDisburseNumber,
          adminDisburseMethod: adminDisburseMethod !== void 0 ? adminDisburseMethod : l.adminDisburseMethod,
          adminNotesText: adminNotesText !== void 0 ? adminNotesText : l.adminNotesText,
          adminWhatsapp: adminWhatsapp !== void 0 ? adminWhatsapp : l.adminWhatsapp
        };
      }
      return l;
    });
    if (emiInstallments) {
      user.emiInstallments = emiInstallments;
    }
  }
  await writeDBAsync(db);
  res.json({ success: true, users: db.users.filter((u) => u.role === "user") });
});
app.post("/api/admin/loan/update-status", async (req, res) => {
  const { adminPhone, userPhone, loanId, status } = req.body;
  if (!adminPhone || !userPhone || !loanId || !status) {
    return res.status(400).json({ error: "\u09AA\u09CD\u09AF\u09BE\u09B0\u09BE\u09AE\u09BF\u099F\u09BE\u09B0 \u09AB\u09BF\u09B2\u09CD\u09A1 \u09AE\u09BF\u09B8\u09BF\u0982\u0964" });
  }
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ error: "\u09B8\u09A0\u09BF\u0995 \u098B\u09A3 \u09B8\u09CD\u099F\u09CD\u09AF\u09BE\u099F\u09BE\u09B8 \u09B8\u09BF\u09B2\u09C7\u0995\u09CD\u099F \u0995\u09B0\u09C1\u09A8\u0964" });
  }
  const db = readDB();
  const operator = db.users.find((u) => u.phone === adminPhone);
  if (!operator || operator.role !== "main_admin" && operator.role !== "sub_admin") {
    return res.status(403).json({ error: "\u0985\u09CD\u09AF\u09BE\u0995\u09CD\u09B8\u09C7\u09B8 \u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0!" });
  }
  const userIdx = db.users.findIndex((u) => u.phone === userPhone && u.role === "user");
  if (userIdx === -1) {
    return res.status(404).json({ error: "\u0989\u0995\u09CD\u09A4 \u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u0996\u09C1\u0981\u099C\u09C7 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964" });
  }
  const user = db.users[userIdx];
  let matchedLoan = false;
  let loanDetails = null;
  user.activeLoans = user.activeLoans.map((loan) => {
    if (loan.id === loanId && loan.status === "pending") {
      matchedLoan = true;
      loanDetails = loan;
      return { ...loan, status };
    }
    return loan;
  });
  if (!matchedLoan) {
    return res.status(400).json({ error: "\u0995\u09CB\u09A8\u09CB \u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982 \u098B\u09A3 \u0986\u0987\u09A1\u09BF \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964" });
  }
  if (status === "approved") {
    user.savingsBalance = Number(user.savingsBalance) + Number(loanDetails.amount);
    const disburseTx = {
      id: `TX${Math.floor(1e3 + Math.random() * 9e3)}`,
      type: "loan_disburse",
      method: "bank",
      amount: loanDetails.amount,
      date: "\u09E6\u09EF \u099C\u09C1\u09A8, \u09E8\u09E6\u09E8\u09EC",
      status: "completed",
      titleBangla: "\u098B\u09A3 \u09AC\u09BF\u09A4\u09B0\u09A3 (Bank)",
      descBangla: `${loanDetails.categoryBangla} \u09AB\u09BE\u09A8\u09CD\u09A1 \u09AC\u09BF\u09A4\u09B0\u09A3 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8`
    };
    user.transactions.unshift(disburseTx);
    const installmentsCount = Number(loanDetails.months);
    const emiAmount = Number(loanDetails.emiAmount);
    const currentEmis = user.emiInstallments || [];
    const additionalEmis = Array.from({ length: installmentsCount }).map((_, i) => ({
      installmentNo: currentEmis.length + i + 1,
      dueDate: `${20} ${i === 0 ? "\u099C\u09C1\u09B2\u09BE\u0987" : i === 1 ? "\u0986\u0997\u09B8\u09CD\u099F" : i === 2 ? "\u09B8\u09C7\u09AA\u09CD\u099F\u09C7\u09AE\u09CD\u09AC\u09B0" : i === 3 ? "\u0985\u0995\u09CD\u099F\u09CB\u09AC\u09B0" : i === 4 ? "\u09A8\u09AD\u09C7\u09AE\u09CD\u09AC\u09B0" : "\u09A1\u09BF\u09B8\u09C7\u09AE\u09CD\u09AC\u09B0"}, \u09E8\u09E6\u09E8\u09EC`,
      amount: emiAmount,
      status: "pending"
    }));
    user.emiInstallments = [...currentEmis, ...additionalEmis];
    user.notifications.unshift({
      id: `N_DISB_${Date.now()}`,
      title: "\u098B\u09A3 \u09AC\u09BF\u09A4\u09B0\u09A3 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8!",
      body: `\u0986\u09AA\u09A8\u09BE\u09B0 ${loanDetails.categoryBangla} (ID: ${loanId}) \u099A\u09C2\u09DC\u09BE\u09A8\u09CD\u09A4\u09AD\u09BE\u09AC\u09C7 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7 \u098F\u09AC\u0982 \u09F3 ${loanDetails.amount.toLocaleString()} \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u099E\u09CD\u099A\u09DF \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
      timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
      createdAt: Date.now(),
      isRead: false,
      type: "success"
    });
  } else {
    user.notifications.unshift({
      id: `N_REJ_${Date.now()}`,
      title: "\u098B\u09A3 \u0986\u09AC\u09C7\u09A6\u09A8 \u09AC\u09BE\u09A4\u09BF\u09B2",
      body: `\u09A6\u09C1\u0983\u0996\u09BF\u09A4, \u0986\u09AA\u09A8\u09BE\u09B0 ${loanDetails.categoryBangla} (ID: ${loanId}) \u0986\u09AC\u09C7\u09A6\u09A8\u099F\u09BF \u09AC\u09BE\u09A4\u09BF\u09B2 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u09AC\u09BF\u09B8\u09CD\u09A4\u09BE\u09B0\u09BF\u09A4 \u099C\u09BE\u09A8\u09A4\u09C7 \u09B6\u09BE\u0996\u09BE \u0985\u09AB\u09BF\u09B8\u09C7 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964`,
      timeLabel: "\u098F\u0987\u09AE\u09BE\u09A4\u09CD\u09B0",
      createdAt: Date.now(),
      isRead: false,
      type: "warn"
    });
  }
  await writeDBAsync(db);
  res.json({ success: true, users: db.users.filter((u) => u.role === "user") });
});
var isProduction = process.env.NODE_ENV === "production";
async function startServer() {
  if (supabaseClient) {
    await initSupabaseAndLoadDB();
  } else {
    await initFirebaseAndLoadDB();
  }
  if (!isProduction) {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nano-Finance] Server running at http://localhost:${PORT}`);
    console.log(`[Nano-Finance] Database configured with Cloud Firestore Sync and local fallback: ${DB_PATH}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
