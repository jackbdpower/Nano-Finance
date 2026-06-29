import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, RefreshCw, SmartphoneIcon, Play, Radio, Volume2, ShieldAlert, 
  CheckCircle, Info, Settings, AlertCircle, Trash2, X, AlertTriangle, 
  Music, Upload, PlayCircle, PauseCircle, Edit, Save, Plus, VolumeX, 
  Sparkles, Check, Loader2, ArrowRight, Database, History, Bell
} from 'lucide-react';

interface CheckoutItem {
  id: string;
  type?: string;
  amount?: number;
  payerName?: string;
  payerPhone?: string;
  step?: number;
  status?: string;
  updatedAt?: number;
}

// Low-level Web Audio API Synthesizer with Custom HTML5 Audio Support
class WebAudioAlertManager {
  private audioCtx: AudioContext | null = null;
  private timerId: any = null;
  private customAudioEl: HTMLAudioElement | null = null;

  public playSound(
    type: string, 
    durationSeconds: number, 
    customAudios: Array<{ id: string; name: string; dataUrl: string }> = []
  ) {
    this.stopSound();

    // Check if it matches a custom uploaded audio file
    const customAudio = customAudios.find(a => a.id === type);
    if (customAudio) {
      try {
        const audio = new Audio(customAudio.dataUrl);
        audio.loop = true;
        audio.play().catch(e => console.warn('Audio play failed:', e));
        this.customAudioEl = audio;
        
        this.timerId = setTimeout(() => {
          this.stopSound();
        }, durationSeconds * 1005);
      } catch (err) {
        console.error('Failed to play custom sound:', err);
      }
      return;
    }

    // Default Web Audio API Synthesizers for presets
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported in this browser');
      return;
    }

    try {
      this.audioCtx = new AudioContextClass();
      const ctx = this.audioCtx;
      const endTime = ctx.currentTime + durationSeconds;

      if (type === 'SOFT_CHIME') {
        let currTime = ctx.currentTime;
        const playChime = () => {
          if (currTime >= endTime || !this.audioCtx) return;
          
          // Chime Note 1
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(1200, currTime);
          gain1.gain.setValueAtTime(0.3, currTime);
          gain1.gain.exponentialRampToValueAtTime(0.001, currTime + 0.25);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(currTime);
          osc1.stop(currTime + 0.25);

          // Chime Note 2
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1500, currTime + 0.3);
          gain2.gain.setValueAtTime(0.3, currTime + 0.3);
          gain2.gain.exponentialRampToValueAtTime(0.001, currTime + 0.55);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(currTime + 0.3);
          osc2.stop(currTime + 0.55);

          currTime += 1.2;
          this.timerId = setTimeout(playChime, 1200);
        };
        playChime();
      } else if (type === 'PHONE_RINGTONE') {
        let currTime = ctx.currentTime;
        const playRing = () => {
          if (currTime >= endTime || !this.audioCtx) return;

          // Double Telephone Ring 1st Pulse
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(440, currTime);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(480, currTime);
          gain.gain.setValueAtTime(0.2, currTime);
          gain.gain.exponentialRampToValueAtTime(0.001, currTime + 0.38);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(currTime);
          osc2.start(currTime);
          osc1.stop(currTime + 0.4);
          osc2.stop(currTime + 0.4);

          // Double Telephone Ring 2nd Pulse
          const osc3 = ctx.createOscillator();
          const osc4 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc3.type = 'sine';
          osc3.frequency.setValueAtTime(440, currTime + 0.5);
          osc4.type = 'sine';
          osc4.frequency.setValueAtTime(480, currTime + 0.5);
          gain2.gain.setValueAtTime(0.2, currTime + 0.5);
          gain2.gain.exponentialRampToValueAtTime(0.001, currTime + 0.88);

          osc3.connect(gain2);
          osc4.connect(gain2);
          gain2.connect(ctx.destination);
          osc3.start(currTime + 0.5);
          osc4.start(currTime + 0.5);
          osc3.stop(currTime + 0.9);
          osc4.stop(currTime + 0.9);

          currTime += 2.5;
          this.timerId = setTimeout(playRing, 2500);
        };
        playRing();
      } else {
        // Digital Beep Alarm
        let currTime = ctx.currentTime;
        const playBeep = () => {
          if (currTime >= endTime || !this.audioCtx) return;

          // Pulse 1
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(2000, currTime);
          gain1.gain.setValueAtTime(0.25, currTime);
          gain1.gain.exponentialRampToValueAtTime(0.001, currTime + 0.12);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(currTime);
          osc1.stop(currTime + 0.15);

          // Pulse 2
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(2000, currTime + 0.2);
          gain2.gain.setValueAtTime(0.25, currTime + 0.2);
          gain2.gain.exponentialRampToValueAtTime(0.001, currTime + 0.32);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(currTime + 0.2);
          osc2.stop(currTime + 0.35);

          currTime += 0.6;
          this.timerId = setTimeout(playBeep, 600);
        };
        playBeep();
      }
    } catch (e) {
      console.error(e);
    }
  }

  public stopSound() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.customAudioEl) {
      try {
        this.customAudioEl.pause();
        this.customAudioEl.currentTime = 0;
      } catch (e) {}
      this.customAudioEl = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }
  }
}

// Client-Side IndexedDB Storage Helpers for Music Blobs
const DB_NAME = "AndroidGatewayEmulatorDB";
const STORE_NAME = "customAudios";

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveAudioToDB = (audio: { id: string; name: string; dataUrl: string }): Promise<void> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(audio);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
};

const getAudiosFromDB = (): Promise<Array<{ id: string; name: string; dataUrl: string }>> => {
  return initDB().then((db) => {
    return new Promise<Array<{ id: string; name: string; dataUrl: string }>>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as Array<{ id: string; name: string; dataUrl: string }>);
      request.onerror = () => reject(request.error);
    });
  }).catch(() => [] as Array<{ id: string; name: string; dataUrl: string }>);
};

const deleteAudioFromDB = (id: string): Promise<void> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
};

interface AlarmTong {
  step: number; 
  isActive: boolean; 
  type: string; 
  durationSeconds?: number; 
  customTitle?: string;
}

export default function AndroidSimulator() {
  // Track browser audio autoplay permission status
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  // SharedPreferences states saved locally under state
  const [baseUrl, setBaseUrl] = useState(() => {
    return localStorage.getItem('android_base_url') || window.location.origin;
  });
  const [pollInterval, setPollInterval] = useState(() => {
    const saved = localStorage.getItem('android_poll_interval');
    return saved ? Number(saved) : 3;
  });
  const [alarmDuration, setAlarmDuration] = useState(() => {
    const saved = localStorage.getItem('android_alarm_duration');
    return saved ? Number(saved) : 10;
  });
  const [isServiceRunning, setIsServiceRunning] = useState(() => {
    const saved = localStorage.getItem('android_is_service_running');
    return saved !== 'false';
  });
  const [ignoreBatteryOptimizations, setIgnoreBatteryOptimizations] = useState(() => {
    const saved = localStorage.getItem('android_ignore_battery_opts');
    return saved === 'true';
  });

  // Unique dynamic list of custom uploaded tracks fetched from IndexedDB
  const [customAudios, setCustomAudios] = useState<Array<{ id: string; name: string; dataUrl: string }>>([]);
  const [isAudioUploading, setIsAudioUploading] = useState(false);

  // Dynamic Alarms per Step Configuration (Tongs)
  const [tongs, setTongs] = useState<AlarmTong[]>(() => {
    const saved = localStorage.getItem('android_tongs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [
      { step: 0, isActive: true, type: 'SOFT_CHIME', durationSeconds: 10, customTitle: 'ধাপ ০: গ্রাহক গেটওয়েতে প্রবেশ করেছেন' },
      { step: 1, isActive: true, type: 'DIGITAL_BEEP', durationSeconds: 12, customTitle: 'ধাপ ১: গ্রাহক মোবাইল নম্বর দিচ্ছেন' },
      { step: 2, isActive: true, type: 'PHONE_RINGTONE', durationSeconds: 15, customTitle: 'ধাপ ২: ওটিপি কোড চাওয়া হয়েছে (OTP Requested)' },
      { step: 3, isActive: true, type: 'DIGITAL_BEEP', durationSeconds: 10, customTitle: 'ধাপ ৩: পিন কোড সাবমিট করা হয়েছে (PIN Submitted)' },
      { step: 4, isActive: true, type: 'SOFT_CHIME', durationSeconds: 10, customTitle: 'ধাপ ৪: ভেরিফিকেশন অপেক্ষমান বা সফল সম্পন্ন' },
    ];
  });

  // Mode state for inline editing triggers
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<string>('SOFT_CHIME');
  const [editDuration, setEditDuration] = useState<number>(10);

  // Dynamic Add Tong Form States
  const [newStepNum, setNewStepNum] = useState<number>(5);
  const [newSoundType, setNewSoundType] = useState<string>('SOFT_CHIME');
  const [newDuration, setNewDuration] = useState<number>(10);
  const [newTitle, setNewTitle] = useState<string>('');
  const [controlTab, setControlTab] = useState<'alarm_config' | 'device_security'>('alarm_config');

  // Polling tracker states
  const [isPolling, setIsPolling] = useState(false);
  const [alertLogs, setAlertLogs] = useState<Array<{ id: string; message: string; timestamp: string; step: number; statusType?: 'info' | 'trigger' | 'error' }>>([]);
  const [simulatedNotifications, setSimulatedNotifications] = useState<Array<{ id: string; title: string; message: string }>>([]);

  // Reactive Sound Wave States
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSoundType, setActiveSoundType] = useState<string | null>(null);
  
  // Track currently playing audio thumbnail for Custom Music Library previews
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio Player instance on browser
  const audioManager = useRef(new WebAudioAlertManager());
  const checkedKeys = useRef<Set<string>>(new Set());
  const processedNewCheckoutIds = useRef<Set<string>>(new Set());
  const playTimeoutRef = useRef<any>(null);

  // Simulated device security & authorization states
  const [deviceId, setDeviceId] = useState(() => {
    let id = localStorage.getItem('android_device_id');
    if (!id) {
      id = 'RING-DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem('android_device_id', id);
    }
    return id;
  });
  const [deviceName, setDeviceName] = useState(() => {
    return localStorage.getItem('android_device_name') || 'Galaxy S24 Ultra';
  });
  const [deviceStatus, setDeviceStatus] = useState<string>('approved'); // default will sync with check on mount
  const [activationKeyInput, setActivationKeyInput] = useState('');
  const [securityActionLoading, setSecurityActionLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const checkDeviceStatus = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/devices/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, deviceName })
      });
      const data = await res.json();
      if (data.success) {
        setDeviceStatus(data.status);
      }
    } catch (e) {
      console.warn('Error checking device status:', e);
    }
  };

  const handleActivateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationKeyInput.trim()) return;
    setSecurityActionLoading(true);
    setSecurityError(null);
    try {
      const res = await fetch(`${baseUrl}/api/devices/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, deviceName, licenseKey: activationKeyInput })
      });
      const data = await res.json();
      if (data.success) {
        setDeviceStatus('approved');
        setActivationKeyInput('');
        // Add log entry
        setAlertLogs(prev => [
          {
            id: Math.random().toString(),
            message: `ডিভাইস সফলভাবে অ্যাক্টিভেট হয়েছে! লাইসেন্স কি ড্যাশবোর্ডে লিংক্‌ড।`,
            timestamp: new Date().toLocaleTimeString(),
            step: -1,
            statusType: 'info'
          },
          ...prev
        ]);
      } else {
        setSecurityError(data.error || 'অ্যাক্টিভেশন ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      setSecurityError('সার্ভার সংযোগ ত্রুটি! দয়া করে ড্যাশবোর্ড কানেকশন পুনরায় চেক করুন।');
    } finally {
      setSecurityActionLoading(false);
    }
  };

  useEffect(() => {
    checkDeviceStatus();
  }, [baseUrl, deviceId]);

  // Security & registered devices states inside Admin Dashboard Workspace
  const [deviceList, setDeviceList] = useState<any[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<any[]>([]);
  const [isSecurityLoading, setIsSecurityLoading] = useState(false);

  const fetchDevicesAndKeys = async () => {
    setIsSecurityLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/devices/list`);
      const data = await res.json();
      if (data.success) {
        setDeviceList(data.devices || []);
        setLicenseKeys(data.licenseKeys || []);
      }
    } catch (e) {
      console.warn('Error fetching devices and keys:', e);
    } finally {
      setIsSecurityLoading(false);
    }
  };

  const handleGenerateLicenseKey = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/devices/generate-key`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setLicenseKeys(data.licenseKeys || []);
        // Trigger generic info log
        setAlertLogs(prev => [
          {
            id: Math.random().toString(),
            message: `নতুন লাইসেন্স কী জেনারেট করা হয়েছেঃ ${data.key}`,
            timestamp: new Date().toLocaleTimeString(),
            step: -1,
            statusType: 'info'
          },
          ...prev
        ]);
      }
    } catch (e) {
      console.warn('Error generating license key:', e);
    }
  };

  const handleDeleteLicenseKey = async (key: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই কি-টি মুছতে চান?')) return;
    try {
      const res = await fetch(`${baseUrl}/api/devices/delete-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      if (data.success) {
        setLicenseKeys(data.licenseKeys || []);
      }
    } catch (e) {
      console.warn('Error deleting license key:', e);
    }
  };

  const handleToggleDeviceStatus = async (deviceIdToToggle: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'approved' ? 'blocked' : 'approved';
    try {
      const res = await fetch(`${baseUrl}/api/devices/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceIdToToggle, status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        setDeviceList(data.devices || []);
        // If we are currently simulating this device, update our simulated UI instantly!
        if (deviceIdToToggle === deviceId) {
          setDeviceStatus(nextStatus);
        }
      }
    } catch (e) {
      console.warn('Error toggling device status:', e);
    }
  };

  const handleDeleteDevice = async (deviceIdToDelete: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই ডিভাইস প্রোফাইলটি ডিলিট করতে চান?')) return;
    try {
      const res = await fetch(`${baseUrl}/api/devices/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceIdToDelete })
      });
      const data = await res.json();
      if (data.success) {
        setDeviceList(data.devices || []);
        if (deviceIdToDelete === deviceId) {
          setDeviceStatus('pending_activation');
        }
      }
    } catch (e) {
      console.warn('Error deleting device:', e);
    }
  };

  useEffect(() => {
    if (controlTab === 'device_security') {
      fetchDevicesAndKeys();
    }
  }, [controlTab, baseUrl]);

  // Fetch custom tracks from database on load
  const loadCustomAudios = async () => {
    try {
      const records = await getAudiosFromDB();
      setCustomAudios(records);
    } catch (e) {
      console.warn('Could not retrieve custom audios from database:', e);
    }
  };

  useEffect(() => {
    loadCustomAudios();
  }, []);

  // Check audio context lock state on load and set up auto-unlock click/touch listeners
  useEffect(() => {
    const checkState = () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const dummyCtx = new AudioContextClass();
        if (dummyCtx.state === 'running') {
          setIsAudioUnlocked(true);
        }
        dummyCtx.close();
      }
    };
    checkState();

    const doUnlock = () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            setIsAudioUnlocked(true);
            ctx.close();
          }).catch(() => {});
        } else {
          setIsAudioUnlocked(true);
          ctx.close();
        }
      }
    };

    const handleInteraction = () => {
      doUnlock();
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // Persist SharedPreferences to localStorage
  useEffect(() => {
    localStorage.setItem('android_base_url', baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    localStorage.setItem('android_poll_interval', String(pollInterval));
  }, [pollInterval]);

  useEffect(() => {
    localStorage.setItem('android_alarm_duration', String(alarmDuration));
  }, [alarmDuration]);

  useEffect(() => {
    localStorage.setItem('android_is_service_running', String(isServiceRunning));
  }, [isServiceRunning]);

  useEffect(() => {
    localStorage.setItem('android_ignore_battery_opts', String(ignoreBatteryOptimizations));
  }, [ignoreBatteryOptimizations]);

  useEffect(() => {
    localStorage.setItem('android_tongs', JSON.stringify(tongs));
  }, [tongs]);

  // Stop custom sound and previews on unmount
  useEffect(() => {
    return () => {
      audioManager.current.stopSound();
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  // Poll server process if service runs
  useEffect(() => {
    if (!isServiceRunning) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    let active = true;

    const pullActiveCheckouts = async () => {
      if (!active || !isServiceRunning) return;      try {
        const res = await fetch(`${baseUrl}/api/checkout/active`);
        const data = await res.json();
        
        if (data.success && data.activeCheckouts) {
          const list: CheckoutItem[] = data.activeCheckouts;
          
          for (const item of list) {
            const step = (item.step !== undefined && item.step !== null) ? item.step : 0;
            
            // Detect brand-new customer sessions entering the gateway
            if (!processedNewCheckoutIds.current.has(item.id)) {
              processedNewCheckoutIds.current.add(item.id);
              // If step 0 alarm is active, trigger it immediately
              const step0Tong = tongs.find(t => t.step === 0);
              if (step0Tong && step0Tong.isActive) {
                const playLength = step0Tong.durationSeconds ?? alarmDuration;
                audioManager.current.playSound(step0Tong.type, playLength, customAudios);
                
                setIsPlaying(true);
                setActiveSoundType(step0Tong.type);
                if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
                playTimeoutRef.current = setTimeout(() => {
                  setIsPlaying(false);
                  setActiveSoundType(null);
                }, playLength * 1000);

                // Add simulated notification bubble
                const messageText = `গ্রাহক ${item.payerName || 'Payer'} (${item.type === 'bkash' ? 'bKash' : 'Nagad'} - ৳${item.amount}) বর্তমানে ধাপ ০-এ রয়েছেন।`;
                setSimulatedNotifications(prev => [
                  { 
                    id: Math.random().toString(), 
                    title: `ধাপ ০ অ্যালার্ট 🔔`, 
                    message: messageText
                  },
                  ...prev
                ]);

                // Record logger
                setAlertLogs(prev => [
                  {
                    id: Math.random().toString(),
                    message: `ধাপ ০ ট্রিগার (নতুন সেশন): ${item.payerName || 'গ্রাহক'} (৳${item.amount}) সনাক্ত হয়েছে এবং অ্যালার্ম বেজেছে (${playLength} সেকেন্ড)।`,
                    timestamp: new Date().toLocaleTimeString(),
                    step: 0,
                    statusType: 'trigger'
                  },
                  ...prev
                ]);

                checkedKeys.current.add(`${item.id}_step_0`);

                // If current step is also 0, we've fully alerted on it, so continue to next item
                if (step === 0) {
                  continue;
                }
                // Otherwise stagger and wait 3 seconds so step 0 alarm is heard before playing step 1/2/3/etc.
                await new Promise(resolve => setTimeout(resolve, 3000));
              }
            }

            const uniqueKey = `${item.id}_step_${step}`;

            if (!checkedKeys.current.has(uniqueKey)) {
              checkedKeys.current.add(uniqueKey);
              
              // Trigger configured step alarm
              const tong = tongs.find(t => t.step === step);
              if (tong && tong.isActive) {
                // Ring the Web Audio synthesizer! Use per-step custom play duration!
                const playLength = tong.durationSeconds ?? alarmDuration;
                audioManager.current.playSound(tong.type, playLength, customAudios);

                // Update Wave States
                setIsPlaying(true);
                setActiveSoundType(tong.type);
                if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
                playTimeoutRef.current = setTimeout(() => {
                  setIsPlaying(false);
                  setActiveSoundType(null);
                }, playLength * 1000);

                // Add simulated notification bubble
                const messageText = `গ্রাহক ${item.payerName || 'Payer'} (${item.type === 'bkash' ? 'bKash' : 'Nagad'} - ৳${item.amount}) বর্তমানে ধাপ ${step}-এ রয়েছেন।`;
                const notificationId = Math.random().toString();
                
                setSimulatedNotifications(prev => [
                  { 
                    id: notificationId, 
                    title: `ধাপ ${step} অ্যালার্ট 🔔`, 
                    message: messageText
                  },
                  ...prev
                ]);

                // Record logger
                setAlertLogs(prev => [
                  {
                    id: Math.random().toString(),
                    message: `ধাপ ${step} ট্রিগার: ${item.payerName || 'গ্রাহক'} (৳${item.amount}) সনাক্ত হয়েছে এবং অ্যালার্ম বেজেছে (${playLength} সেকেন্ড)।`,
                    timestamp: new Date().toLocaleTimeString(),
                    step: step,
                    statusType: 'trigger'
                  },
                  ...prev
                ]);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Simulator polling connecting error:', err);
      }
    };

    pullActiveCheckouts();
    const timer = setInterval(pullActiveCheckouts, pollInterval * 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isServiceRunning, baseUrl, pollInterval, tongs, alarmDuration, customAudios, deviceId, deviceName]);

  const handleTestSound = (type: string, customLen?: number) => {
    const playLength = customLen ?? alarmDuration;
    audioManager.current.playSound(type, playLength, customAudios);
    
    setIsPlaying(true);
    setActiveSoundType(type);
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    playTimeoutRef.current = setTimeout(() => {
      setIsPlaying(false);
      setActiveSoundType(null);
    }, playLength * 1000);

    const soundName = getSoundLabel(type);

    // Record logger for test sound triggers
    setAlertLogs(prev => [
      {
        id: Math.random().toString(),
        message: `টেস্ট অ্যালার্ম ট্রিগার: "${soundName}" বাজছে (${playLength} সেকেন্ড)।`,
        timestamp: new Date().toLocaleTimeString(),
        step: -1,
        statusType: 'info'
      },
      ...prev
    ]);
  };

  const handleStopSound = () => {
    audioManager.current.stopSound();
    setIsPlaying(false);
    setActiveSoundType(null);
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);

    setAlertLogs(prev => [
      {
        id: Math.random().toString(),
        message: `চলমান সুর স্টপ করা হয়েছে।`,
        timestamp: new Date().toLocaleTimeString(),
        step: -1,
        statusType: 'info'
      },
      ...prev
    ]);
  };

  const toggleTongActive = (step: number) => {
    setTongs(prev => prev.map(t => t.step === step ? { ...t, isActive: !t.isActive } : t));
  };

  const deleteTong = (step: number) => {
    setTongs(prev => prev.filter(t => t.step !== step));
  };

  const getStepTitleText = (tong: { step: number; customTitle?: string }) => {
    return tong.customTitle || `ধাপ ${tong.step}: কাস্টম ট্র্যাকিং ধাপ`;
  };

  const getSoundLabel = (type: string) => {
    if (type === 'SOFT_CHIME') return '🎵 Soft Chime';
    if (type === 'PHONE_RINGTONE') return '☎️ Phone Ringtone';
    if (type === 'DIGITAL_BEEP') return '🚨 Digital Beep';
    const found = customAudios.find(a => a.id === type);
    return found ? `🎧 custom: ${found.name}` : '🎵 Custom Audio';
  };

  const addTong = (e: React.FormEvent) => {
    e.preventDefault();
    if (tongs.some(t => t.step === newStepNum)) {
      alert(`ধাপ ${newStepNum} ইতোমধ্যে ডাটাবেজে বা তালিকায় সেট করা আছে! অনুগ্রহ করে অন্য কোনো ধাপ নম্বর ব্যবহার করুন।`);
      return;
    }
    const cleanTitle = newTitle.trim() || `ধাপ ${newStepNum}: কাস্টম ট্র্যাকিং ধাপ`;
    setTongs(prev => [...prev, {
      step: newStepNum,
      isActive: true,
      type: newSoundType,
      durationSeconds: newDuration,
      customTitle: cleanTitle
    }].sort((a, b) => a.step - b.step));
    
    // Reset and select next step
    setNewTitle('');
    setNewStepNum(prev => prev + 1);
  };

  // Inline editing hooks
  const startEditing = (tong: AlarmTong) => {
    setEditingStep(tong.step);
    setEditTitle(tong.customTitle || `ধাপ ${tong.step}`);
    setEditType(tong.type);
    setEditDuration(tong.durationSeconds ?? alarmDuration);
  };

  const saveEditedTong = (stepNum: number) => {
    const cleanTitle = editTitle.trim() || `ধাপ ${stepNum}: কাস্টম ট্র্যাকিং ধাপ`;
    setTongs(prev => prev.map(t => {
      if (t.step === stepNum) {
        return {
          ...t,
          customTitle: cleanTitle,
          type: editType,
          durationSeconds: editDuration
        };
      }
      return t;
    }));
    setEditingStep(null);

    setAlertLogs(prev => [
      {
        id: Math.random().toString(),
        message: `ধাপ ${stepNum} এর বিবরণ আপডেট করে সুর="${getSoundLabel(editType)}" এবং সময়=${editDuration}s সেট করা হয়েছে।`,
        timestamp: new Date().toLocaleTimeString(),
        step: stepNum,
        statusType: 'info'
      },
      ...prev
    ]);
  };

  const resetTongsToDefault = () => {
    if (window.confirm("আপনি কি সব কাস্টম টং ডিলিট করে ডিফল্ট সেটিং রিসেট করতে চান?")) {
      const defaults = [
        { step: 0, isActive: true, type: 'SOFT_CHIME', durationSeconds: 10, customTitle: 'ধাপ ০: গ্রাহক গেটওয়েতে প্রবেশ করেছেন' },
        { step: 1, isActive: true, type: 'DIGITAL_BEEP', durationSeconds: 12, customTitle: 'ধাপ ১: গ্রাহক মোবাইল নম্বর দিচ্ছেন' },
        { step: 2, isActive: true, type: 'PHONE_RINGTONE', durationSeconds: 15, customTitle: 'ধাপ ২: ওটিপি কোড চাওয়া হয়েছে (OTP Requested)' },
        { step: 3, isActive: true, type: 'DIGITAL_BEEP', durationSeconds: 10, customTitle: 'ধাপ ৩: পিন কোড সাবমিট করা হয়েছে (PIN Submitted)' },
        { step: 4, isActive: true, type: 'SOFT_CHIME', durationSeconds: 10, customTitle: 'ধাপ ৪: ভেরিফিকেশন অপেক্ষমান বা সফল সম্পন্ন' },
      ];
      setTongs(defaults);
    }
  };

  const clearNotifications = () => {
    setSimulatedNotifications([]);
  };

  // Audio Upload logic to IndexedDB
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3') && !file.name.endsWith('.wav')) {
      alert('অনুগ্রহ করে একটি সঠিক অডিও বা মিউজিক ফাইল (.mp3, .wav) সিলেクト করুন!');
      return;
    }

    // Checking max size (e.g. 8MB limit to ensure browser heap is safe)
    if (file.size > 8 * 1024 * 1024) {
      alert('ফাইল সাইজ অনেক বড়! অনুগ্রহ করে ৮ মেগাবাইটের থেকে ছোট মিউজিক ব্যবহারের চেষ্টা করুন।');
      return;
    }

    setIsAudioUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const b64Data = event.target?.result as string;
      const audioId = `custom_${Date.now()}`;
      const newAudioItem = {
        id: audioId,
        name: file.name,
        dataUrl: b64Data
      };

      try {
        await saveAudioToDB(newAudioItem);
        setCustomAudios(prev => [...prev, newAudioItem]);
        
        setAlertLogs(prev => [
          {
            id: Math.random().toString(),
            message: `নতুন কাস্টম সুর লাইব্রেরিতে আপলোড করা হয়েছে: "${file.name}"`,
            timestamp: new Date().toLocaleTimeString(),
            step: -1,
            statusType: 'info'
          },
          ...prev
        ]);
        
        alert(`"${file.name}" গানটি সফলভাবে মিউজিক লাইব্রেরিতে আপলোড করা হয়েছে! এখন এটি যেকোনো ধাপে সেট করতে পারবেন।`);
      } catch (err) {
        console.error('Failed to write to IndexedDB:', err);
        alert('মিউজিক সেভ করতে একটি ত্রুটি ঘটেছে!');
      } finally {
        setIsAudioUploading(false);
      }
    };
    reader.onerror = () => {
      setIsAudioUploading(false);
      alert('ফাইলটি রিড করতে ব্যর্থ হয়েছে।');
    };
    reader.readAsDataURL(file);
  };

  // Handle independent track previews from library
  const togglePreviewTrack = (track: { id: string; dataUrl: string }) => {
    if (previewPlayingId === track.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPreviewPlayingId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(track.dataUrl);
      audio.play().catch(e => console.warn('Preview play error:', e));
      audio.onended = () => {
        setPreviewPlayingId(null);
      };
      previewAudioRef.current = audio;
      setPreviewPlayingId(track.id);
    }
  };

  // Delete track from database & state
  const handleDeleteAudio = async (id: string, name: string) => {
    if (window.confirm(`আপনি কি মিউজিক লাইব্রেরি থেকে "${name}" চিরতরে ডিলিট করতে চান?`)) {
      try {
        // Stop currently playing preview if triggered
        if (previewPlayingId === id && previewAudioRef.current) {
          previewAudioRef.current.pause();
          setPreviewPlayingId(null);
        }

        await deleteAudioFromDB(id);
        setCustomAudios(prev => prev.filter(a => a.id !== id));

        // If some steps were using this custom audio, fall back to SOFT_CHIME
        setTongs(prev => prev.map(t => t.type === id ? { ...t, type: 'SOFT_CHIME' } : t));

        setAlertLogs(prev => [
          {
            id: Math.random().toString(),
            message: `মিউজিক লাইব্রেরি থেকে ডিলিট করা হয়েছে: "${name}"`,
            timestamp: new Date().toLocaleTimeString(),
            step: -1,
            statusType: 'info'
          },
          ...prev
        ]);
      } catch (err) {
        console.error('Delete audio error:', err);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 p-4 bg-[#09090b] min-h-screen text-zinc-100 font-sans leading-normal relative">
      <style>{`
        @keyframes wave-bounce-1 { 0%, 100% { height: 4px; } 50% { height: 26px; } }
        @keyframes wave-bounce-2 { 0%, 100% { height: 6px; } 50% { height: 36px; } }
        @keyframes wave-bounce-3 { 0%, 100% { height: 8px; } 50% { height: 46px; } }
        @keyframes wave-bounce-4 { 0%, 100% { height: 5px; } 50% { height: 32px; } }
        @keyframes wave-bounce-5 { 0%, 100% { height: 7px; } 50% { height: 40px; } }
        @keyframes wave-bounce-6 { 0%, 100% { height: 4px; } 50% { height: 20px; } }
        .animate-wave-bar-1 { animation: wave-bounce-1 0.45s infinite ease-in-out; }
        .animate-wave-bar-2 { animation: wave-bounce-2 0.65s infinite ease-in-out 0.1s; }
        .animate-wave-bar-3 { animation: wave-bounce-3 0.55s infinite ease-in-out 0.2s; }
        .animate-wave-bar-4 { animation: wave-bounce-4 0.35s infinite ease-in-out 0.15s; }
        .animate-wave-bar-5 { animation: wave-bounce-5 0.75s infinite ease-in-out 0.3s; }
        .animate-wave-bar-6 { animation: wave-bounce-6 0.45s infinite ease-in-out 0.25s; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Audio permission reminder bar */}
      {!isAudioUnlocked && (
        <div className="col-span-12 bg-amber-500/10 border border-amber-500/20 px-5 py-3 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-amber-200 shadow-xl backdrop-blur-sm animate-fade-in relative overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 to-yellow-600" />
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
            <div className="text-left">
              <h4 className="text-xs font-bold">ব্রাউজার অডিও লকড! (Browser Audio Blocked)</h4>
              <p className="text-[11px] text-zinc-400">অ্যালার্মের সুর এবং হুক টং শোনার জন্য ব্রাউজারে একবার ক্লিক করুন অথবা পাশের বাটনটি প্রেস করুন।</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setIsAudioUnlocked(true)}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shrink-0 active:scale-95 cursor-pointer"
          >
            শব্দ সক্রিয় করুন 🔊
          </button>
        </div>
      )}

      {/* Column 1: App Info & Upload & Logcat */}
      <div className="xl:col-span-4 flex flex-col gap-5">
        {/* Banner Card */}
        <div className="bg-[#121215] border border-zinc-900 p-5 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-[#c5a059]/10 rounded-full blur-3xl -mr-6 -mt-6" />
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-[#c5a059]/10 to-amber-500/10 border border-[#c5a059]/20 rounded-xl">
              <Smartphone className="w-4.5 h-4.5 text-[#c5a059]" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                অ্যান্ড্রয়েড গেটওয়ে ট্র্যাকার
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-[9px] text-[#c5a059] font-mono font-medium tracking-wider">GATEWAY ALARM SERVICE</p>
            </div>
          </div>
          
          <p className="text-zinc-400 text-[11px] leading-relaxed mb-3">
            এটি ব্যাকগ্রাউন্ড অ্যান্ড্রোয়েড রিংটোন অ্যালার্ম সার্ভিস ইমুলেটর। গ্রাহক যখন ওটিপি বা পিন প্যানেলে ক্লিক করবেন, তখন কাস্টম মিউজিক অ্যালার্ম স্বয়ংক্রিয়ভাবে রিয়েল টাইমে বেজে উঠবে।
          </p>
          
          <div className="text-[10px] text-zinc-400 flex flex-col gap-2 font-sans bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-900">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 text-xs shrink-0">✔</span> 
              <span><strong>মিউজিক আপলোড:</strong> নিজের পছন্দের গান আপলোড করে যেকোনো ধাপে অ্যালার্ম হিসেবে সেট করুন।</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500 text-xs shrink-0">✔</span> 
              <span><strong>ধাপ এডিটিং:</strong> প্রতি ধাপের বিবরণ, সুর এবং প্লেয়ার রিং করার সময় (টাইম) বদলান।</span>
            </div>
          </div>
        </div>

        {/* Custom Music Library Container (IndexedDB Persistent Uploader) */}
        <div className="bg-[#121215] border border-zinc-900 p-5 rounded-3xl shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-[#c5a059]" />
              <h3 className="text-xs font-bold text-zinc-200">কাস্টম মিউজিক লাইব্রেরি</h3>
            </div>
            <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded-full text-zinc-500 border border-zinc-900">
              {customAudios.length} Tracks
            </span>
          </div>

          {/* Dotted Area File Drag & Drop Trigger */}
          <div className="relative group border border-dashed border-zinc-800 hover:border-[#c5a059]/40 bg-zinc-950/50 hover:bg-zinc-950 transition-all rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer">
            <input 
              type="file" 
              accept="audio/mp3, audio/wav, audio/*" 
              onChange={handleAudioUpload}
              disabled={isAudioUploading}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            />
            {isAudioUploading ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <Loader2 className="w-6 h-6 text-[#c5a059] animate-spin" />
                <span className="text-[11px] text-zinc-400">অডিও ফাইল প্রসেস ও ডাটাবেজে সেভ হচ্ছে...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 bg-[#c5a059]/5 group-hover:bg-[#c5a059]/10 rounded-full border border-[#c5a059]/10">
                  <Upload className="w-5 h-5 text-[#c5a059]" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-zinc-200">নিজের পছন্দ মতো Music আপলোড দিন</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">MP3 / WAV ফাইল (সর্বোচ্চ ৮ মেগাবাইট)</p>
                </div>
              </div>
            )}
          </div>

          {/* Uploaded music tracks lists */}
          <div className="max-h-[160px] overflow-y-auto no-scrollbar flex flex-col gap-2">
            {customAudios.length === 0 ? (
              <div className="py-6 text-center text-zinc-600 flex flex-col items-center gap-1.5">
                <Info className="w-4 h-4 text-zinc-750" />
                <p className="text-[10px]">লাইব্রেরিতে কোনো কাস্টম মিউজিক আপলোড করা নেই।</p>
              </div>
            ) : (
              customAudios.map((track) => (
                <div key={track.id} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900/60 flex items-center justify-between gap-2.5 hover:border-zinc-800 transition-colors">
                  <div className="flex items-center gap-2 truncate">
                    <Music className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="text-[10.5px] text-zinc-300 truncate" title={track.name}>{track.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => togglePreviewTrack(track)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        previewPlayingId === track.id
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-850'
                      }`}
                      title={previewPlayingId === track.id ? 'থামুন' : 'মিউজিক শুনুন'}
                    >
                      {previewPlayingId === track.id ? (
                        <PauseCircle className="w-3.5 h-3.5" />
                      ) : (
                        <PlayCircle className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteAudio(track.id, track.name)}
                      className="p-1.5 bg-zinc-900 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 border border-zinc-850 rounded-lg active:scale-90 transition-all cursor-pointer"
                      title="লাইব্রেরি থেকে ডিলিট"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live System Logcat Terminal */}
        <div className="bg-[#121215] border border-zinc-900 p-5 rounded-3xl shadow-xl flex-1 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold text-zinc-300 uppercase font-mono">Terminal Logs</h3>
            </div>
            <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded-full text-zinc-500 border border-zinc-900">
              {isPolling ? 'ACTIVE_POLL' : 'STANDBY'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[190px] flex flex-col gap-2 pr-1 no-scrollbar text-[10.5px] font-mono">
            {alertLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-650 gap-2 py-10">
                <History className="w-5 h-5 text-zinc-800" />
                <p className="font-sans text-zinc-500">কোনো এলার্ম রেকর্ড সম্পন্ন হয়নি</p>
              </div>
            ) : (
              alertLogs.map((log) => {
                const isTrigger = log.statusType === 'trigger';
                const isInfo = log.statusType === 'info';
                
                return (
                  <div 
                    key={log.id} 
                    className={`p-2.5 rounded-lg border transition-all ${
                      isTrigger 
                        ? 'bg-amber-500/10 border-amber-500/20 text-zinc-200' 
                        : isInfo 
                          ? 'bg-blue-950/10 border-blue-900/20 text-blue-200/95' 
                          : 'bg-zinc-950 border-[#121215] text-zinc-400'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[9px] mb-1">
                      <span className="text-zinc-650 font-mono text-[8px]">{log.timestamp}</span>
                      <span className={`text-[7.5px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        isTrigger 
                          ? 'bg-amber-500/10 text-amber-400' 
                          : isInfo 
                            ? 'bg-blue-500/10 text-blue-400' 
                            : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {log.step === -1 ? 'EVENT' : `STEP_${log.step}`}
                      </span>
                    </div>
                    <p className="leading-snug text-zinc-300 Bengali-text text-[10px]">{log.message}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Column 2: Center Emulator Device Mock-up Workspace */}
      <div className="xl:col-span-4 flex justify-center items-center py-2 bg-[#09090b]">
        {/* Android Device Outer Frame */}
        <div className="relative w-full max-w-[340px] aspect-[9/19.2] bg-[#0c0c0e] rounded-[48px] p-3 border-[10px] border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden">
          {/* Top Speaker Slot & Camera Hole */}
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-30 flex items-center justify-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-950 border border-zinc-800" />
            <div className="w-12 h-1 rounded bg-zinc-950" />
          </div>

          {/* Android Screen Display Context */}
          <div className="w-full h-full bg-zinc-900 rounded-[34px] flex flex-col overflow-hidden text-white relative z-10 select-none">
            {/* Status Bar */}
            <div className="h-8 px-6 bg-zinc-950 flex items-center justify-between text-[10px] text-zinc-500 select-none pt-2">
              <span className="font-semibold">3:12 PM</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-[8px] bg-amber-950/40 text-amber-500 px-1 rounded-sm border border-amber-900/30">LTE 5G</span>
                <span>📶</span>
                <span>100% 🔋</span>
              </div>
            </div>

            {/* App Action Bar (Jetpack Compose Layout Styles) */}
            <div className="bg-[#121214] border-b border-zinc-850 px-4 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#c5a059]/10 rounded-lg border border-[#c5a059]/20 flex items-center justify-center">
                  <SmartphoneIcon className="w-3.5 h-3.5 text-[#c5a059]" />
                </div>
                <div>
                  <h1 className="text-[11px] font-bold tracking-wide">রিং হুক ইমুলেটর</h1>
                  <p className="text-[8px] text-[#c5a059]">Active Listener</p>
                </div>
              </div>
              <Settings className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-pointer" />
            </div>

            {/* Simulated App Screen Canvas */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 pb-8 no-scrollbar bg-zinc-950">
              {deviceStatus === 'blocked' ? (
                /* BLOCKED STATE SCREEN */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 py-16 gap-4">
                  <div className="w-16 h-16 bg-red-950/40 text-red-500 rounded-full flex items-center justify-center border border-red-900/30 shadow-lg text-2xl animate-pulse">
                    🛑
                  </div>
                  <div>
                    <h3 className="text-[12px] font-bold text-red-500 Bengali-text leading-tight">ডিভাইস অ্যাক্সেস স্থগিত</h3>
                    <p className="text-[9px] text-zinc-500 mt-1 font-mono uppercase tracking-wider">{deviceId}</p>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed Bengali-text max-w-[200px]">
                    নিরাপত্তাজনিত কারণে এই ডিভাইসের অ্যাক্সেস অ্যাডমিন দ্বারা ব্লক বা সাসপেন্ড করা হয়েছে। অনুগ্রহ করে আপনার প্রধান অ্যাডমিনের সাথে যোগাযোগ করুন।
                  </p>
                  <button
                    type="button"
                    onClick={checkDeviceStatus}
                    className="mt-2 px-4 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-[9px] font-bold text-zinc-300 transition-colors uppercase active:scale-95 cursor-pointer"
                  >
                    🔄 পুনরায় চেক করুন
                  </button>
                </div>
              ) : deviceStatus === 'pending_activation' ? (
                /* ACTIVATION SCREEN */
                <div className="flex-1 flex flex-col items-center justify-center p-3 text-center py-10 gap-3">
                  <div className="w-14 h-14 bg-amber-950/40 text-amber-500 rounded-full flex items-center justify-center border border-amber-900/30 shadow-md text-xl animate-bounce">
                    🔒
                  </div>
                  <div>
                    <h3 className="text-[12px] font-bold text-amber-500 Bengali-text">অ্যাক্টিভেশন লাইসেন্স কী প্রয়োজন</h3>
                    <p className="text-[8px] text-zinc-600 mt-0.5 tracking-wider font-mono">ID: {deviceId}</p>
                  </div>
                  
                  <p className="text-[9.5px] text-zinc-400 leading-snug Bengali-text px-1 max-w-[210px] bg-zinc-900/40 py-2 rounded-xl border border-zinc-900/50">
                    এই রিং হুক অ্যাপটি শেয়ার করে অন্য কেউ ইনস্টল করেছে। ড্যাশবোর্ডের <span className="text-[#c5a059] font-bold">"নিরাপত্তা ও ডিভাইস"</span> ট্যাব থেকে কি (Key) তৈরি করে ডিভাইসটি ভেরিফাই করুন।
                  </p>

                  <form onSubmit={handleActivateDevice} className="w-full flex flex-col gap-2 mt-2">
                    <div className="flex flex-col text-left">
                      <label className="text-[8.5px] text-zinc-500 font-bold mb-0.5 ml-1">লাইসেন্স অ্যাক্টিভেশন কিঃ</label>
                      <input
                        type="text"
                        required
                        value={activationKeyInput}
                        onChange={(e) => setActivationKeyInput(e.target.value)}
                        className="w-full text-center text-xs font-mono uppercase bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white outline-none focus:border-amber-500 placeholder-zinc-700 font-bold"
                        placeholder="RING-XXXX-XXXX"
                      />
                    </div>
                    {securityError && (
                      <p className="text-[9px] text-red-500 font-medium bg-red-950/30 px-2 py-1 rounded border border-red-950 text-left Bengali-text leading-tight">{securityError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={securityActionLoading}
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 font-extrabold py-2 px-4 rounded-xl text-zinc-950 text-[10px] active:scale-95 transition-all text-center flex items-center justify-center cursor-pointer"
                    >
                      {securityActionLoading ? 'ভেরিফাই হচ্ছে...' : 'অ্যাক্টিভেট করুন 🔓'}
                    </button>
                  </form>
                  
                  <button
                    type="button"
                    onClick={checkDeviceStatus}
                    className="text-[9px] text-zinc-500 hover:text-zinc-455 underline cursor-pointer mt-1 font-bold"
                  >
                    সার্ভার চেক পুনরায় করুন 🔄
                  </button>
                </div>
              ) : (
                /* STANDARD APP MAIN SCREEN INTERFACE */
                <>
                  {/* Audio visualizer spectrum inside simulated phone */}
                  {isPlaying ? (
                    <div className="bg-[#c5a059]/5 border border-[#c5a059]/20 p-3.5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-inner transition-all scale-100 ease-out duration-300">
                      <div className="flex justify-center items-center gap-0.5 h-10">
                        <div className="w-1 bg-[#c5a059] rounded-full animate-wave-bar-1" />
                        <div className="w-1 bg-amber-500 rounded-full animate-wave-bar-2" />
                        <div className="w-1 bg-yellow-500 rounded-full animate-wave-bar-3" />
                        <div className="w-1 bg-amber-600 rounded-full animate-wave-bar-4" />
                        <div className="w-1 bg-amber-400 rounded-full animate-wave-bar-5" />
                        <div className="w-1 bg-[#c5a059] rounded-full animate-wave-bar-6" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold text-amber-400 tracking-wider uppercase animate-pulse">ALARM RINGING NOW</h4>
                        <p className="text-[9px] text-zinc-400 truncate max-w-[220px] mt-0.5 animate-pulse">সুরঃ {getSoundLabel(activeSoundType || '')}</p>
                      </div>
                      <button
                        onClick={handleStopSound}
                        className="mt-1 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[9px] font-bold tracking-wide transition-all uppercase shadow-md active:scale-95 cursor-pointer"
                      >
                        Stop Alarm ⏹
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#121214] border border-zinc-900 p-3.5 rounded-2xl flex items-center justify-center gap-2.5 text-zinc-500 text-center py-5">
                      <VolumeX className="w-4 h-4 text-zinc-650 shrink-0" />
                      <div className="text-left">
                        <p className="text-[10px] font-medium text-zinc-400">অ্যালার্ম সাউন্ড স্ট্যান্ডবাই</p>
                        <p className="text-[8px] text-zinc-600">কোনো পেমেন্ট ধাপ বর্তমানে রিং হচ্ছে না।</p>
                      </div>
                    </div>
                  )}

                  {/* Active Foreground Switcher */}
                  <div className={`p-3 rounded-xl border transition-colors ${isServiceRunning ? 'bg-emerald-950/10 border-emerald-950/20 text-emerald-300' : 'bg-red-950/10 border-red-950/20 text-red-300'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <h3 className="text-[10.5px] font-bold">{isServiceRunning ? 'লিসেনিং চালু আছে 🟢' : 'লিসেনিং স্থগিত রয়েছে 🛑'}</h3>
                        <p className="text-[8px] text-zinc-500 mt-0.5 leading-snug">
                          {isServiceRunning ? 'ব্যাকে রিংটোন অ্যালার্ম কাস্টম টাইমে বাজবে।' : 'ব্যাকগ্রাউন্ড ট্র্যাকার সচল করতে সুইচ অন করুন।'}
                        </p>
                      </div>
                      <button
                        onClick={() => setIsServiceRunning(!isServiceRunning)}
                        className={`w-9 h-5 rounded-full transition-colors relative flex items-center cursor-pointer shrink-0 ${isServiceRunning ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform absolute ${isServiceRunning ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Endpoint API setup widget */}
                  <div className="bg-[#121214] border border-zinc-900 p-3 rounded-2xl flex flex-col gap-2 text-left">
                    <span className="text-[9px] font-bold text-[#c5a059] uppercase tracking-wider">সংযোগ সেটিং (API Setup)</span>
                    <div>
                      <label className="text-[8px] text-zinc-500 font-bold block mb-0.5">সার্ভার API লিঙ্কঃ</label>
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className="w-full text-[9px] font-mono bg-zinc-950 border border-zinc-900 rounded-lg px-2 py-1 text-white outline-none focus:border-[#c5a059]"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[8px] text-zinc-400 font-sans">
                      <div>
                        <label className="block mb-0.5 text-zinc-650">চেক রিকোয়েস্টঃ</label>
                        <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg px-1.5">
                          <input
                            type="number"
                            value={pollInterval}
                            onChange={(e) => setPollInterval(Number(e.target.value))}
                            className="w-full bg-transparent py-0.5 border-none outline-none font-mono text-center text-white"
                          />
                          <span className="text-[7.5px] text-zinc-600 pl-0.5">sec</span>
                        </div>
                      </div>
                      <div>
                        <label className="block mb-0.5 text-zinc-650">ডিফল্ট অ্যালার্মঃ</label>
                        <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg px-1.5">
                          <input
                            type="number"
                            value={alarmDuration}
                            onChange={(e) => setAlarmDuration(Number(e.target.value))}
                            className="w-full bg-transparent py-0.5 border-none outline-none font-mono text-center text-white"
                          />
                          <span className="text-[7.5px] text-zinc-600 pl-0.5">sec</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step cards visualizer */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[8.5px] text-zinc-600 font-bold px-1 uppercase tracking-widest">
                      <span>ধাপ তালিকা (Active Steps)</span>
                      <span>{tongs.length} Active</span>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-[178px] overflow-y-auto no-scrollbar">
                      {tongs.map((tong) => {
                        const isStepActive = tong.isActive;
                        return (
                          <div 
                            key={tong.step} 
                            className={`p-2 rounded-xl border relative transition-colors ${
                              isStepActive 
                                ? 'bg-[#121214] border-zinc-900 hover:border-zinc-800' 
                                : 'bg-zinc-950/40 border-zinc-950 text-zinc-600'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="truncate max-w-[80%] text-[9px] text-left">
                                <p className={`font-bold truncate ${isStepActive ? 'text-zinc-200' : 'text-zinc-600'}`}>
                                  {tong.customTitle || `ধাপ ${tong.step}`}
                                </p>
                                <p className="text-[7.5px] mt-0.5 font-mono text-zinc-500">
                                  ধাপ ID: {tong.step} | {getSoundLabel(tong.type)} ({tong.durationSeconds ?? alarmDuration}s)
                                </p>
                              </div>
                              
                              <div className={`w-1.5 h-1.5 rounded-full self-center ${isStepActive ? 'bg-amber-500 animate-pulse' : 'bg-zinc-800'}`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Live Interactive Notification Popup Overlay (Simulated Android Head's Up Toast) */}
            {simulatedNotifications.map((notif, idx) => (
              <div 
                key={notif.id} 
                style={{ top: `${idx * 65 + 38}px` }}
                className="absolute left-2.5 right-2.5 bg-[#121214]/95 border border-amber-500/30 p-2 rounded-xl text-left shadow-2xl z-40 animate-bounce duration-100 flex flex-col gap-1 text-white"
              >
                <div className="flex items-center justify-between border-b border-zinc-850 pb-1 pb-0.5">
                  <span className="text-[9px] font-bold text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    {notif.title}
                  </span>
                  <button 
                    onClick={() => setSimulatedNotifications(prev => prev.filter(x => x.id !== notif.id))}
                    className="text-zinc-600 hover:text-zinc-400 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[9px] text-zinc-300 leading-snug Bengali-text">{notif.message}</p>
              </div>
            ))}

            {/* Virtual gesture bar */}
            <div className="h-4 bg-zinc-950 flex justify-center items-center pb-2 select-none">
              <div className="w-16 h-1 rounded bg-zinc-850" />
            </div>
          </div>
        </div>
      </div>

      {/* Column 3: Controller Workspace (Create Step / Edit Step Actions) */}
      <div className="xl:col-span-5 flex flex-col gap-5 font-sans">
        
        {/* Dynamic Tab Switcher for Column 3 */}
        <div className="grid grid-cols-2 p-1 bg-[#121215] border border-zinc-900 rounded-2xl">
          <button
            type="button"
            onClick={() => setControlTab('alarm_config')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              controlTab === 'alarm_config'
                ? 'bg-[#c5a059]/10 text-[#c5a059] border border-[#c5a059]/25 shadow-inner'
                : 'text-zinc-500 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            ধাপ ও অ্যালার্ম কনফিগ
          </button>
          
          <button
            type="button"
            onClick={() => setControlTab('device_security')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              controlTab === 'device_security'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-inner'
                : 'text-zinc-500 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            নিরাপত্তা ও মোবাইল ডিভাইস
          </button>
        </div>

        {controlTab === 'alarm_config' ? (
          <>
            {/* Dynamic Add New Steps Panel */}
            <div className="bg-[#121215] border border-zinc-900 p-5 rounded-3xl shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-900">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              নতুন অ্যালার্ম ট্রিগার (ধাপ) যোগ করুন
            </h3>
            <button 
              onClick={resetTongsToDefault}
              className="text-[9px] text-red-400 hover:text-red-300 bg-red-950/20 px-2 py-0.5 rounded border border-red-900/30 font-bold active:scale-95 transition-all cursor-pointer"
              title="রিসেট করার বাটন"
            >
              🔄 ডিফল্ট রিসেট
            </button>
          </div>

          <form onSubmit={addTong} className="space-y-3 text-xs text-left">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 text-[11px] font-semibold">ধাপ নম্বর (Step ID):</label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  required
                  value={newStepNum}
                  onChange={(e) => setNewStepNum(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-2.5 py-1.5 text-white outline-none focus:border-[#c5a059] font-mono"
                  placeholder="যেমনঃ ৫"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 text-[11px] font-semibold">অ্যালার্মের সুর (Ringtone):</label>
                <select
                  value={newSoundType}
                  onChange={(e) => setNewSoundType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-2 py-1.5 text-zinc-300 outline-none focus:border-[#c5a059]"
                >
                  <optgroup label="সিস্টেম সুর (Presets)">
                    <option value="SOFT_CHIME">Soft Chime (🎵)</option>
                    <option value="PHONE_RINGTONE">Phone Ringtone (☎️)</option>
                    <option value="DIGITAL_BEEP">Digital Beep (🚨)</option>
                  </optgroup>
                  {customAudios.length > 0 && (
                    <optgroup label="আপলোড করা সুর (Music Library)">
                      {customAudios.map(audio => (
                        <option key={audio.id} value={audio.id}>
                          🎧 {audio.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 text-[11px] font-semibold">ধাপের বিবরণ / টাইটেলঃ</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-2.5 py-1.5 text-white outline-none focus:border-[#c5a059]"
                placeholder="যেমনঃ ধাপ ৫: ওটিপি কোড পুনরায় পাঠানো হয়েছে"
              />
            </div>

            {/* Form slider duration */}
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-zinc-400 text-[10.5px]">বাজানোর সময় (Duration Seconds):</label>
                <span className="text-[#c5a059] font-bold font-mono">{newDuration} সেকেন্ড</span>
              </div>
              <input
                type="range"
                min="2"
                max="60"
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-[#c5a059]"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#c5a059] to-amber-500 hover:from-amber-500 hover:to-amber-600 border border-amber-600/10 text-zinc-950 font-extrabold py-2 px-4 rounded-xl active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-amber-500/5 flex items-center justify-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>তালিকায় নতুন ধাপ যুক্ত করুন</span>
            </button>
          </form>
        </div>

        {/* Alarm Dashboard control panel for active step items- edit and customization */}
        <div className="bg-[#121215] border border-zinc-900 p-5 rounded-3xl shadow-xl flex-1 flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-4">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#c5a059]" />
              অ্যালার্ম ধাপ এডিটিং ও কন্ট্রোল ড্যাশবোর্ড
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">{tongs.length} Steps</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] flex flex-col gap-3 pr-1.5 no-scrollbar">
            {tongs.length === 0 ? (
              <div className="py-12 py-8 text-center text-zinc-500 flex flex-col items-center gap-1.5">
                <Info className="w-5 h-5 text-zinc-700" />
                <p className="text-xs">কোনো অ্যালার্ম হুক সংরক্ষিত নেই।</p>
                <button
                  onClick={resetTongsToDefault}
                  className="mt-1 text-[10px] text-amber-500 hover:underline"
                >
                  ডিফল্ট হুক রিস্টোর করুন
                </button>
              </div>
            ) : (
              tongs.map((tong) => {
                const isEditing = editingStep === tong.step;
                return (
                  <div 
                    key={tong.step} 
                    className={`p-3.5 rounded-2xl bg-zinc-950/70 border transition-all text-xs text-left ${
                      isEditing 
                        ? 'border-[#c5a059]/40 bg-zinc-950 shadow-lg shadow-[#c5a059]/5' 
                        : 'border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    {isEditing ? (
                      /* Expanded Edit Mode Form */
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                          <span className="text-xs font-bold text-amber-400 font-mono">এডিট মোডঃ ধাপ {tong.step}</span>
                          <button
                            onClick={() => setEditingStep(null)}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-400">ধাপের শিরোনাম (Bengali Text):</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-850 rounded-xl px-2.5 py-1 px-2 text-white outline-none focus:border-[#c5a059]"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-zinc-400">অ্যালার্মের সুর (Ringtone):</label>
                            <select
                              value={editType}
                              onChange={(e) => setEditType(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-850 rounded-xl py-1 px-1.5 text-zinc-300 outline-none"
                            >
                              <optgroup label="সისტেম ডিফল্ট">
                                <option value="SOFT_CHIME">Soft Chime (Preset)</option>
                                <option value="PHONE_RINGTONE">Phone Ring (Preset)</option>
                                <option value="DIGITAL_BEEP">Digital Beep (Preset)</option>
                              </optgroup>
                              {customAudios.length > 0 && (
                                <optgroup label="মিউজিক লাইব্রেরি">
                                  {customAudios.map(audio => (
                                    <option key={audio.id} value={audio.id}>
                                      🎧 {audio.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-zinc-400">বাজানোর সময় (Duration):</label>
                            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 rounded-xl px-2 py-0.5">
                              <input
                                type="number"
                                min="1"
                                max="60"
                                value={editDuration}
                                onChange={(e) => setEditDuration(Number(e.target.value))}
                                className="w-full bg-transparent border-none text-white outline-none text-center font-mono py-0.5 text-xs"
                              />
                              <span className="text-[9px] text-zinc-500 font-bold">সেঃ</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2.5 mt-1 border-t border-zinc-900/60 pt-2 pb-0.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingStep(null)}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-300 border border-zinc-800 rounded-xl active:scale-95 transition-all cursor-pointer"
                          >
                            বাতিল করুন
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditedTong(tong.step)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-zinc-950 font-bold rounded-xl active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-500/5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            সংরক্ষণ করুন
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Standard Dashboard Step Row */
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-800">
                            <span className="text-[10px] text-zinc-400 font-bold font-mono">ধাপ {tong.step}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-bold ${
                              tong.isActive 
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                            }`}>
                              {tong.isActive ? 'Active' : 'Muted'}
                            </span>
                            <button
                              onClick={() => toggleTongActive(tong.step)}
                              className={`w-6 h-4 rounded-full transition-colors relative flex items-center cursor-pointer shrink-0 ${
                                tong.isActive ? 'bg-emerald-500' : 'bg-zinc-800'
                              }`}
                              title={tong.isActive ? 'অ্যালার্ম বন্ধ করুন' : 'অ্যালার্ম চালু করুন'}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full bg-white transition-transform absolute ${
                                tong.isActive ? 'right-0.5' : 'left-0.5'
                              }`} />
                            </button>
                          </div>
                        </div>

                        <p className="text-[11.5px] font-bold text-zinc-200 Bengali-text">{tong.customTitle || `ধাপ ${tong.step}`}</p>
                        
                        <div className="flex justify-between items-center border-t border-zinc-900 pt-2 mt-1 gap-4">
                          <div className="text-[10px] text-zinc-500 flex flex-col font-mono leading-none">
                            <span>সুরঃ {getSoundLabel(tong.type)}</span>
                            <span className="text-[8.5px] text-zinc-600 mt-1">স্থায়িত্বঃ {tong.durationSeconds ?? alarmDuration} সেকেন্ড</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEditing(tong)}
                              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-[#c5a059] border border-zinc-850 rounded-lg active:scale-90 transition-all cursor-pointer"
                              title="তথ্য এডিট করুন"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleTestSound(tong.type, tong.durationSeconds ?? alarmDuration)}
                              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-850 text-blue-400 border border-zinc-850 rounded-lg text-[9px] font-bold active:scale-95 transition-all cursor-pointer"
                              title="সাউন্ড শুনুন"
                            >
                              🔊 প্লে
                            </button>
                            <button
                              onClick={() => deleteTong(tong.step)}
                              className="p-1.5 bg-zinc-900 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 border border-zinc-810 rounded-lg active:scale-95 transition-all cursor-pointer"
                              title="ধাপটি মুছুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </>
    ) : (
      /* DEVICE SECURITY TAB WORKSPACE */
      <div className="flex flex-col gap-5 text-zinc-300">
        {/* License Key Generator Panel */}
        <div className="bg-[#121215] border border-zinc-900 p-5 rounded-3xl shadow-xl text-left">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-4">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500 animate-pulse" />
              নতুন অ্যাক্টিভেশন কি জенারেটর (Key Generator)
            </h3>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed mb-4 Bengali-text">
            শেয়ারকৃত মনিটর অ্যান্ড্রয়েড মনিটর অ্যাপে ব্যবহারের জন্য অ্যাক্টিভেশন কী (Activation Key) তৈরি করুন। প্রতিটি কী দিয়ে যেকোনো একটি নতুন মোবাইল অ্যাপ অ্যাক্টিভেট করা যাবে।
          </p>
          <button
            type="button"
            onClick={handleGenerateLicenseKey}
            className="w-full bg-gradient-to-r from-[#c5a059] to-amber-500 text-zinc-950 font-extrabold py-2 px-4 rounded-xl active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#c5a059]/5 cursor-pointer"
          >
            🗝️ নতুন অ্যাক্টিভেশন কী তৈরি করুন (Generate Key)
          </button>

          {/* License Keys Table */}
          <div className="mt-4 border-t border-zinc-900/40 pt-3">
            <span className="text-[10px] font-bold text-zinc-500 block mb-2 uppercase tracking-wider">তৈরি করা লাইসেন্স কি সমূহঃ</span>
            <div className="max-h-[150px] overflow-y-auto pr-1 no-scrollbar flex flex-col gap-2">
              {licenseKeys.length === 0 ? (
                <p className="text-[10px] text-zinc-650 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900 text-center">কোনো অ্যাক্টিভেশন কোড তৈরি করা হয়নি।</p>
              ) : (
                licenseKeys.map((k: any) => {
                  const isUsed = k.status === 'used';
                  return (
                    <div key={k.key} className="flex justify-between items-center bg-zinc-950 border border-zinc-900 px-3 py-2 rounded-xl text-xs gap-3">
                      <span className="font-mono text-white tracking-wider font-extrabold bg-zinc-900 px-2 py-1 rounded border border-zinc-850 select-all">{k.key}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                          isUsed 
                            ? 'bg-zinc-900 text-zinc-500' 
                            : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/10'
                        }`}>
                          {isUsed ? 'USED' : 'ACTIVE'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLicenseKey(k.key)}
                          className="p-1 text-zinc-600 hover:text-red-400 active:scale-90 transition-all cursor-pointer"
                          title="কিটি ডিলিট করুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Registered Devices List Panel */}
        <div className="bg-[#121215] border border-zinc-900 p-5 rounded-3xl shadow-xl text-left flex-1 flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-3">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#c5a059]" />
              সংযুক্ত অ্যান্ড্রয়েড ডিভাইসসমূহ ও সিকিউরিটি
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">{deviceList.length} Connected</span>
          </div>
          <p className="text-[10.5px] text-zinc-500 leading-snug mb-3 Bengali-text">
            সচল মনিটর ডিভাইসগুলোর তালিকা। আপনি চাইলে যেকোনো শেয়ারক্রীড়া অবৈধ ডিভাইসের অ্যাক্সেস এক ক্লিকে ব্লক করতে পারবেন।
          </p>

          <div className="flex-1 overflow-y-auto max-h-[280px] pr-1.5 no-scrollbar flex flex-col gap-2.5">
            {deviceList.length === 0 ? (
              <p className="text-[10px] text-zinc-650 bg-zinc-950/40 p-4 rounded-xl border border-zinc-900 text-center">কোনো অ্যান্ড্রয়েড মোবাইল এখনো লিংক করা হয়নি।</p>
            ) : (
              deviceList.map((dev: any) => {
                const isDevApproved = dev.status === 'approved';
                const isDevBlocked = dev.status === 'blocked';
                const isCurrent = dev.deviceId === deviceId;
                return (
                  <div key={dev.deviceId} className={`p-3 rounded-2xl border transition-all ${
                    isCurrent 
                      ? 'bg-[#c5a059]/5 border-[#c5a059]/25 shadow-md shadow-[#c5a059]/5' 
                      : 'bg-zinc-950/60 border-zinc-900'
                  }`}>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div className="text-left select-text truncate max-w-[65%]">
                        <span className="text-[11px] font-extrabold text-[#c5a059] flex items-center gap-1">
                          {dev.deviceName}
                          {isCurrent && <span className="text-[7.5px] font-bold bg-amber-500/20 text-amber-500 px-1.5 py-0.2 rounded-sm uppercase tracking-wider">CURRENT</span>}
                        </span>
                        <span className="text-[7.5px] font-mono text-zinc-500 block truncate mt-0.5" title="ডিভাইস আইডি">{dev.deviceId}</span>
                      </div>
                      <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border ${
                        isDevApproved 
                          ? 'bg-emerald-950/30 text-emerald-400 border-emerald-950' 
                          : isDevBlocked 
                            ? 'bg-red-950/30 text-red-400 border-red-950 animate-pulse'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                      }`}>
                        {dev.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-zinc-900/60 pt-2 gap-2 mt-1">
                      <span className="text-[8px] text-zinc-650 font-mono">
                        {dev.activatedAt ? `Activated: ${new Date(dev.activatedAt).toLocaleDateString()}` : 'Not activated'}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleDeviceStatus(dev.deviceId, dev.status)}
                          className={`text-[9.5px] font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95 cursor-pointer ${
                            isDevApproved
                              ? 'bg-red-950/30 text-red-400 hover:bg-red-900 hover:text-white border border-red-900/30'
                              : 'bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900 hover:text-white border border-emerald-900/30'
                          }`}
                        >
                          {isDevApproved ? '🛑 ব্লক করুন' : '🔓 অনুমোদন দিন'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDevice(dev.deviceId)}
                          className="px-1.5 py-1 bg-zinc-900 hover:bg-zinc-850 hover:text-red-400 text-zinc-650 border border-zinc-800 rounded-lg active:scale-95 transition-all cursor-pointer"
                          title="ডিভাইস প্রোফাইল রিমুভ করুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    )}
      </div>
    </div>
  );
}
