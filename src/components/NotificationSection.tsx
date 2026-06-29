/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, MailOpen, Trash2, CheckCircle2, AlertTriangle, Info, BellRing, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationItem } from '../types';

interface NotificationSectionProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

export default function NotificationSection({ notifications, onMarkAllRead, onClearAll }: NotificationSectionProps) {
  const [expandedNotifIds, setExpandedNotifIds] = useState<Record<string, boolean>>({});

  const toBanglaDigits = (num: number | string) => {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
  };

  const getNotificationTimeLabel = (notif: NotificationItem): string => {
    if (!notif.createdAt) {
      return notif.timeLabel;
    }

    const diffMs = Date.now() - notif.createdAt;
    if (diffMs < 0) {
      return 'এইমাত্র';
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffSeconds < 30) {
      return 'এইমাত্র';
    }
    if (diffMins < 60) {
      return `${toBanglaDigits(diffMins)} মিনিট আগে`;
    }
    if (diffHours < 24) {
      const remainingMins = diffMins % 60;
      if (remainingMins === 0) {
        return `${toBanglaDigits(diffHours)} ঘণ্টা আগে`;
      }
      return `${toBanglaDigits(diffHours)} ঘণ্টা ${toBanglaDigits(remainingMins)} মিনিট আগে`;
    }
    if (diffDays < 7) {
      return `${toBanglaDigits(diffDays)} দিন আগে`;
    }

    const dateObj = new Date(notif.createdAt);
    const monthsBn = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const day = toBanglaDigits(dateObj.getDate());
    const month = monthsBn[dateObj.getMonth()];
    const year = toBanglaDigits(dateObj.getFullYear());
    const hours = dateObj.getHours();
    const mins = toBanglaDigits(dateObj.getMinutes().toString().padStart(2, '0'));
    const amPm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = toBanglaDigits(hours % 12 || 12);

    return `${day} ${month}, ${year} (${displayHours}:${mins} ${amPm})`;
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNotifIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a09] text-zinc-300 select-none overflow-y-auto no-scrollbar pb-6 px-5 relative">
      {/* Upper header with count stats */}
      <div className="pt-5 pb-3.5 flex justify-between items-center bg-[#0a0a09]">
        <div>
          <h3 className="text-lg font-bold font-serif italic text-white tracking-tight">নোটিফিকেশন</h3>
          <p className="text-[10px] text-zinc-550 font-sans mt-0.5">আপনার আবেদনের বর্তমান অগ্রগতি ও পেমেন্ট অ্যালার্ট</p>
        </div>

        {notifications.length > 0 && (
          <button
            onClick={onClearAll}
            className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-rose-450 transition-colors cursor-pointer"
            title="সব মুছে ফেলুন"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="flex justify-between items-center mb-4 text-xs font-sans">
          <span className="text-zinc-500 font-medium">
            মোট {notifications.length} টি বার্তা
          </span>
          <button
            onClick={onMarkAllRead}
            className="text-[#c5a059] hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <MailOpen className="w-4 h-4" />
            সব পঠিত করুন
          </button>
        </div>
      )}

      {/* Render notifications list */}
      <div className="flex flex-col gap-3">
        {notifications.length === 0 ? (
          <div className="bg-[#111113] p-8 rounded-2xl border border-zinc-850/80 text-center flex flex-col items-center py-10">
            <BellRing className="w-9 h-9 text-zinc-700 mb-2.5 animate-pulse" />
            <p className="text-xs text-zinc-550 font-sans">কোনো নতুন নোটিফিকেশন বা বার্তা নেই।</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {notifications.map((notif) => {
                const getIcon = (type: string) => {
                  switch (type) {
                    case 'success':
                      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
                    case 'warn':
                      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
                    case 'info':
                    default:
                      return <Info className="w-5 h-5 text-[#dfc187]" />;
                  }
                };

                const getBg = (type: string) => {
                  switch (type) {
                    case 'success': return 'bg-emerald-950/5 border-emerald-900/15';
                    case 'warn': return 'bg-amber-950/5 border-amber-900/15';
                    case 'info':
                    default:
                      return 'bg-zinc-900/20 border-zinc-850/60';
                  }
                };

                const isLongText = notif.body.length > 80;
                const isExpanded = expandedNotifIds[notif.id];
                const displayText = (isLongText && !isExpanded) 
                  ? notif.body.slice(0, 80) + '...' 
                  : notif.body;

                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: -15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.98 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    layout
                    className={`p-4 rounded-2xl border transition-all flex gap-3 relative ${getBg(notif.type)} ${!notif.isRead ? 'bg-[#111113] border-zinc-850 ring-1 ring-[#c5a059]/5' : 'opacity-75 border-zinc-900 bg-[#111113]/35'}`}
                  >
                    {!notif.isRead && (
                      <div className="absolute top-4 right-4 w-1.5 h-1.5 bg-[#c5a059] rounded-full" />
                    )}

                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-grow font-sans pr-4">
                      <h5 className={`text-[11.5px] font-bold text-zinc-200 ${!notif.isRead ? 'font-extrabold text-[#dfc187]' : ''}`}>
                        {notif.title}
                      </h5>
                      <div className="text-[10px] text-zinc-400 leading-relaxed mt-1 flex flex-col">
                        <span>{displayText}</span>
                        {isLongText && (
                          <button
                            onClick={(e) => toggleExpand(notif.id, e)}
                            className="text-[#c5a059] font-semibold text-[10px] mt-1.5 hover:underline cursor-pointer inline-flex items-center gap-0.5 self-start"
                          >
                            {isExpanded ? (
                              <>কম দেখান <ChevronUp className="w-3 h-3" /></>
                            ) : (
                              <>আরও পড়ুন <ChevronDown className="w-3 h-3" /></>
                            )}
                          </button>
                        )}
                      </div>
                      <span className="text-[9px] text-[#c5a059]/70 font-medium block mt-2.5 font-sans">
                        {getNotificationTimeLabel(notif)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
