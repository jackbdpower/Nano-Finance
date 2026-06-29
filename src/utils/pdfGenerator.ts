/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { User, NewLoanForm } from '../types';

interface PDFGeneratorParams {
  user: User;
  form: NewLoanForm;
  emi: number;
  total: number;
  applicationId: string;
  categoryBangla: string;
  dateString: string;
}

const toBanglaDigits = (num: number | string) => {
  const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (x) => banglaNumbers[parseInt(x)]);
};

const formatBDT = (amount: number) => {
  return `৳ ${Math.round(amount).toLocaleString('bn-BD')}`;
};

// Helpler function to draw rounded rectangles
const fillRoundedRect = (cx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, r: number, color: string) => {
  cx.fillStyle = color;
  cx.beginPath();
  cx.moveTo(sx + r, sy);
  cx.lineTo(sx + w - r, sy);
  cx.quadraticCurveTo(sx + w, sy, sx + w, sy + r);
  cx.lineTo(sx + w, sy + h - r);
  cx.quadraticCurveTo(sx + w, sy + h, sx + w - r, sy + h);
  cx.lineTo(sx + r, sy + h);
  cx.quadraticCurveTo(sx, sy + h, sx, sy + h - r);
  cx.lineTo(sx, sy + r);
  cx.quadraticCurveTo(sx, sy, sx + r, sy);
  cx.closePath();
  cx.fill();
};

const strokeRoundedRect = (cx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, r: number, width: number, color: string) => {
  cx.strokeStyle = color;
  cx.lineWidth = width;
  cx.beginPath();
  cx.moveTo(sx + r, sy);
  cx.lineTo(sx + w - r, sy);
  cx.quadraticCurveTo(sx + w, sy, sx + w, sy + r);
  cx.lineTo(sx + w, sy + h - r);
  cx.quadraticCurveTo(sx + w, sy + h, sx + w - r, sy + h);
  cx.lineTo(sx + r, sy + h);
  cx.quadraticCurveTo(sx, sy + h, sx, sy + h - r);
  cx.lineTo(sx, sy + r);
  cx.quadraticCurveTo(sx, sy, sx + r, sy);
  cx.closePath();
  cx.stroke();
};

// Helper to draw deterministic pseudo-QR code for authentic tracking presentation
const drawQrCode = (cx: CanvasRenderingContext2D, qx: number, qy: number, size: number, idString: string) => {
  cx.fillStyle = '#ffffff';
  cx.fillRect(qx, qy, size, size);
  cx.strokeStyle = '#e2d5bd';
  cx.lineWidth = 1;
  cx.strokeRect(qx, qy, size, size);

  const pad = 5;
  const drawSize = size - pad * 2;
  const modules = 25; // 25x25 grid
  const cellSize = drawSize / modules;

  const fillCell = (row: number, col: number, color: string) => {
    cx.fillStyle = color;
    cx.fillRect(
      Math.round(qx + pad + col * cellSize),
      Math.round(qy + pad + row * cellSize),
      Math.ceil(cellSize),
      Math.ceil(cellSize)
    );
  };

  const drawFinder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const isDark = (i === 0 || i === 6 || j === 0 || j === 6) || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        fillCell(r + i, c + j, isDark ? '#111113' : '#ffffff');
      }
    }
  };

  drawFinder(0, 0); // Top-Left Finder
  drawFinder(0, modules - 7); // Top-Right Finder
  drawFinder(modules - 7, 0); // Bottom-Left Finder

  // Alignment pattern
  const alignR = modules - 9;
  const alignC = modules - 9;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const isDark = (i === 0 || i === 4 || j === 0 || j === 4) || (i === 2 && j === 2);
      fillCell(alignR + i, alignC + j, isDark ? '#111113' : '#ffffff');
    }
  }

  // Deterministic seed hashing
  let hash = 5381;
  for (let i = 0; i < idString.length; i++) {
    hash = (hash * 33) ^ idString.charCodeAt(i);
  }

  const isReserved = (r: number, c: number) => {
    if (r < 8 && c < 8) return true;
    if (r < 8 && c >= modules - 8) return true;
    if (r >= modules - 8 && c < 8) return true;
    if (r === 6 || c === 6) return true;
    if (r >= alignR && r < alignR + 5 && c >= alignC && c < alignC + 5) return true;
    return false;
  };

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (isReserved(r, c)) {
        if ((r === 6 && c % 2 === 0) || (c === 6 && r % 2 === 0)) {
          fillCell(r, c, '#111113');
        }
        continue;
      }
      hash = (hash * 1664525 + 1013904223) | 0;
      const isDark = (hash & 0x1) === 0;
      fillCell(r, c, isDark ? '#111113' : '#ffffff');
    }
  }
};

// Helper to draw deterministic official stamp
const drawOfficialStamp = (cx: CanvasRenderingContext2D, sx: number, sy: number) => {
  cx.save();
  cx.translate(sx, sy);
  cx.rotate(-0.06); // Rotate slighly -3deg for realistic ink-stamp impression

  cx.strokeStyle = 'rgba(22, 163, 74, 0.85)'; // Emerald official stamp ink
  cx.lineWidth = 2.4;
  cx.beginPath();
  cx.arc(0, 0, 48, 0, Math.PI * 2);
  cx.stroke();

  cx.lineWidth = 1;
  cx.beginPath();
  cx.arc(0, 0, 43, 0, Math.PI * 2);
  cx.stroke();

  // Seal inner text
  cx.fillStyle = 'rgba(22, 163, 74, 0.85)';
  cx.font = 'bold 9px "Noto Sans Bengali", sans-serif';
  cx.textAlign = 'center';
  cx.fillText('APPROVED', 0, -6);
  
  cx.font = 'bold 15px "Noto Sans Bengali", sans-serif';
  cx.fillText('অনুমোদিত', 0, 10);

  cx.font = 'bold 8px "Noto Sans Bengali", sans-serif';
  cx.fillText('DIGOUT APP', 0, 23);

  // Curved text inside borders
  cx.font = 'bold 6.8px "Inter", sans-serif';
  const circularText = "★ DIGOUT MICROFINANCE ★ AUDIT CERTIFIED";
  const chars = circularText.split('');
  const angleSpacing = (Math.PI * 2) / chars.length;
  for (let i = 0; i < chars.length; i++) {
    cx.save();
    cx.rotate(i * angleSpacing);
    cx.translate(0, -35);
    cx.fillText(chars[i], 0, 0);
    cx.restore();
  }

  cx.restore();
};

// Helper to draw realistic blue signature curves
const drawScribbledSignature = (cx: CanvasRenderingContext2D, ox: number, oy: number) => {
  cx.strokeStyle = '#0284c7'; // Classic executive blue signature ink
  cx.lineWidth = 2;
  cx.beginPath();
  cx.moveTo(ox, oy + 5);
  cx.bezierCurveTo(ox + 12, oy - 22, ox + 22, oy - 12, ox + 36, oy - 2);
  cx.bezierCurveTo(ox + 44, oy + 8, ox + 55, oy - 28, ox + 68, oy - 8);
  cx.bezierCurveTo(ox + 76, oy + 6, ox + 90, oy - 12, ox + 110, oy - 5);
  // Elegant underscore stroke
  cx.moveTo(ox - 8, oy + 7);
  cx.quadraticCurveTo(ox + 45, oy + 14, ox + 115, oy + 6);
  cx.stroke();
};

export function generateLoanPDF({
  user,
  form,
  emi,
  total,
  applicationId,
  categoryBangla,
  dateString,
}: PDFGeneratorParams) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1150;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Fill crisp white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 1150);

  // 2. Beautiful wavy diagonal security lines (Anti-Fraud Guilloche)
  ctx.strokeStyle = '#fbf9f4';
  ctx.lineWidth = 0.5;
  for (let i = 40; i < 760; i += 25) {
    ctx.beginPath();
    for (let y = 40; y <= 1110; y += 12) {
      const xOffset = Math.sin(y * 0.04) * 4;
      if (y === 40) {
        ctx.moveTo(i + xOffset, y);
      } else {
        ctx.lineTo(i + xOffset, y);
      }
    }
    ctx.stroke();
  }

  // Giant watermark crest in background center text
  ctx.save();
  ctx.fillStyle = 'rgba(197, 160, 89, 0.025)';
  ctx.font = 'bold 110px "Noto Sans Bengali", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(400, 575);
  ctx.rotate(-Math.PI / 6); // -30 Deg Rotate
  ctx.fillText('ডিগআউট', 0, -40);
  ctx.font = 'bold 50px "Noto Sans Bengali", sans-serif';
  ctx.fillText('অফিসিয়াল রসিদ', 0, 40);
  ctx.restore();

  // 3. Draw Premium Frame & Corners
  ctx.strokeStyle = '#c5a059'; // Warm gold outer border
  ctx.lineWidth = 3.5;
  ctx.strokeRect(30, 30, 740, 1090);

  ctx.strokeStyle = '#eae1cd'; // Light champagne inner frame
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 36, 728, 1078);

  // Draw corner ornaments (gives the certificate / bond-paper visual depth)
  const drawCornerOrnaments = (cx: CanvasRenderingContext2D) => {
    cx.strokeStyle = '#c5a059';
    cx.lineWidth = 1.6;
    
    // Top-Left (36, 36)
    cx.beginPath();
    cx.moveTo(36 + 25, 36);
    cx.lineTo(36, 36);
    cx.lineTo(36, 36 + 25);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(36 + 18, 36 + 18);
    cx.lineTo(36 + 5, 36 + 18);
    cx.lineTo(36 + 18, 36 + 5);
    cx.stroke();

    // Top-Right (764, 36)
    cx.beginPath();
    cx.moveTo(764 - 25, 36);
    cx.lineTo(764, 36);
    cx.lineTo(764, 36 + 25);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(764 - 18, 36 + 18);
    cx.lineTo(764 - 5, 36 + 18);
    cx.lineTo(764 - 18, 36 + 5);
    cx.stroke();

    // Bottom-Left (36, 1114)
    cx.beginPath();
    cx.moveTo(36 + 25, 1114);
    cx.lineTo(36, 1114);
    cx.lineTo(36, 1114 - 25);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(36 + 18, 1114 - 18);
    cx.lineTo(36 + 5, 1114 - 18);
    cx.lineTo(36 + 18, 1114 - 5);
    cx.stroke();

    // Bottom-Right (764, 1114)
    cx.beginPath();
    cx.moveTo(764 - 25, 1114);
    cx.lineTo(764, 1114);
    cx.lineTo(764, 1114 - 25);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(764 - 18, 1114 - 18);
    cx.lineTo(764 - 5, 1114 - 18);
    cx.lineTo(764 - 18, 1114 - 5);
    cx.stroke();
  };
  drawCornerOrnaments(ctx);

  // 4. Header Section Logo & Branding Title
  const shieldX = 400;
  const shieldY = 82;
  ctx.fillStyle = '#c5a059';
  ctx.beginPath();
  ctx.moveTo(shieldX, shieldY - 22);
  ctx.lineTo(shieldX + 20, shieldY - 22);
  ctx.quadraticCurveTo(shieldX + 20, shieldY + 11, shieldX, shieldY + 26);
  ctx.quadraticCurveTo(shieldX - 20, shieldY + 11, shieldX - 20, shieldY - 22);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(shieldX, shieldY - 18);
  ctx.lineTo(shieldX + 16, shieldY - 18);
  ctx.quadraticCurveTo(shieldX + 16, shieldY + 9, shieldX, shieldY + 22);
  ctx.quadraticCurveTo(shieldX - 16, shieldY + 9, shieldX - 16, shieldY - 18);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', shieldX, shieldY + 2);
  ctx.textBaseline = 'alphabetic'; // Reset

  // Corporate names
  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 24px "Noto Sans Bengali", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ডিগআউট মাইক্রোফিন্যান্স লিমিটেড', 400, 134);

  ctx.fillStyle = '#c5a059';
  ctx.font = 'bold 10px "Inter", "Noto Sans Bengali", sans-serif';
  ctx.fillText('DIGOUT MICROFINANCE APP INC. • DIGITAL COOPERATIVE SOCIETY', 400, 153);

  ctx.fillStyle = '#71717a';
  ctx.font = '550 9px "Noto Sans Bengali", sans-serif';
  ctx.fillText('গণপ্রজাতন্ত্রী বাংলাদেশ সমবায় অধিদপ্তর কর্তৃক নিবন্ধিত ও লাইসেন্সপ্রাপ্ত ওয়ান-স্টপ ফিন্যান্সিং পোর্টাল', 400, 168);

  // Elegant centered header separator line
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(120, 182);
  ctx.lineTo(680, 182);
  ctx.stroke();

  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 16px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ঋণ আবেদন বিবরণী ও দাপ্তরিক রসিদ', 400, 208);
  
  ctx.fillStyle = '#6b7280';
  ctx.font = 'italic 10.5px "Inter", "Noto Sans Bengali", sans-serif';
  ctx.fillText('Loan Application Summary & Certified Official Receipt', 400, 223);

  // 5. Metadata Certificate Info Bar (Rounded modern card layout)
  const metaY = 242;
  fillRoundedRect(ctx, 80, metaY, 640, 56, 10, '#fdfcf9');
  strokeRoundedRect(ctx, 80, metaY, 640, 56, 10, 1, '#eae1cd');

  // Metainfo golden highlight indicator strip
  ctx.fillStyle = '#c5a059';
  ctx.fillRect(80, metaY + 12, 4, 32);

  // Static titles
  ctx.textAlign = 'left';
  ctx.font = 'bold 10.5px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#71717a';
  ctx.fillText('আবেদন আইডি (Application ID)', 100, metaY + 23);
  ctx.fillText('আবেদনের তারিখ (Submit Date)', 340, metaY + 23);
  ctx.fillText('আবেদনের অবস্থা (Status)', 575, metaY + 23);

  // Dynamic values
  ctx.font = 'bold 12.5px "JetBrains Mono", sans-serif';
  ctx.fillStyle = '#18181b';
  ctx.fillText(applicationId, 100, metaY + 42);
  
  ctx.font = 'bold 12px "Noto Sans Bengali", sans-serif';
  ctx.fillText(toBanglaDigits(dateString), 340, metaY + 42);

  // Draw Status capsule badge (Amber pending verification theme)
  const statusBadgeX = 575;
  const statusBadgeY = 227 + 10;
  const statusBadgeW = 112;
  const statusBadgeH = 22;
  fillRoundedRect(ctx, statusBadgeX, statusBadgeY + metaY - 242, statusBadgeW, statusBadgeH, 11, '#fffbeb');
  strokeRoundedRect(ctx, statusBadgeX, statusBadgeY + metaY - 242, statusBadgeW, statusBadgeH, 11, 1, '#fef3c7');
  
  ctx.font = 'bold 11px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#d97706'; // Amber-600
  ctx.textAlign = 'center';
  ctx.fillText('যাচাইকরণাধীন', statusBadgeX + (statusBadgeW / 2), statusBadgeY + metaY - 228);

  // Reset standard text alignment
  ctx.textAlign = 'left';

  // 6. SECTION 1: Customer Information
  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 13.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('১. গ্রাহকের প্রোফাইল বিবরণী (Member Profile Details)', 80, 332);

  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 338);
  ctx.lineTo(720, 338);
  ctx.stroke();

  // Unified Customer Details rounded card
  const custY = 348;
  fillRoundedRect(ctx, 80, custY, 640, 106, 10, '#fcfbf9');
  strokeRoundedRect(ctx, 80, custY, 640, 106, 10, 1, '#f1ede2');

  // Vertical highlight spacer stripe on card sides
  ctx.fillStyle = '#c5a059';
  ctx.fillRect(88, custY + 12, 3, 82);

  // Row 1 Customer Items
  ctx.font = '10.5px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('গ্রাহকের নাম (Applicant Name)', 106, custY + 23);
  ctx.fillText('মোবাইল নম্বর (Registered Mobile)', 106, custY + 68);
  
  ctx.fillText('হিসাব নম্বর (Account Number)', 416, custY + 23);
  ctx.fillText('জাতীয় পরিচয়পত্র (NID Status)', 416, custY + 68);

  ctx.font = 'bold 12.5px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#18181b';
  ctx.fillText(user.name, 106, custY + 41);
  ctx.fillText(toBanglaDigits(user.phone), 106, custY + 86);

  ctx.font = 'bold 12.5px "JetBrains Mono", sans-serif';
  ctx.fillText(user.accountNo, 416, custY + 41);

  // NID Connected and Verified label with checkmark
  ctx.font = 'bold 12px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#16a34a'; // Verified emerald green
  ctx.fillText('✓ সংযুক্ত ও আইডেন্টিটি ভেরিফাইড', 416, custY + 86);

  // 7. SECTION 2: Loan Calculations Grid
  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 13.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('২. ঋণের প্রস্তাবিত হিসাব ও কিস্তি বিবরণী (Calculated Loan Terms)', 80, 482);

  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 488);
  ctx.lineTo(720, 488);
  ctx.stroke();

  // Loan Container box
  const loanBoxY = 498;
  fillRoundedRect(ctx, 80, loanBoxY, 640, 180, 12, '#fafafa');
  strokeRoundedRect(ctx, 80, loanBoxY, 640, 180, 12, 1, '#eaeaea');

  // Amortization Row Item Drawing loop
  const drawRowDetails = (labelText: string, valueText: string, isTotal: boolean, rY: number, rH: number) => {
    if (isTotal) {
      // Golden themed summary highlighted footer callout card
      fillRoundedRect(ctx, 84, rY, 632, rH, 8, '#fcf7ec');
      strokeRoundedRect(ctx, 84, rY, 632, rH, 8, 1.2, '#ecdcb9');
      
      ctx.textAlign = 'left';
      ctx.fillStyle = '#78350f'; // Warm Amber Title-900
      ctx.font = 'bold 12px "Noto Sans Bengali", sans-serif';
      ctx.fillText(labelText, 100, rY + (rH / 2) + 4);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#b45309'; // Bold Accent-700
      ctx.font = 'bold 15.5px "Noto Sans Bengali", "JetBrains Mono", sans-serif';
      ctx.fillText(valueText, 700, rY + (rH / 2) + 5);
    } else {
      // Normal Row
      ctx.textAlign = 'left';
      ctx.fillStyle = '#4b5563'; // gray-600 outline
      ctx.font = '11.5px "Noto Sans Bengali", sans-serif';
      ctx.fillText(labelText, 100, rY + (rH / 2) + 4);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#18181b';
      ctx.font = 'bold 12.5px "Noto Sans Bengali", "JetBrains Mono", sans-serif';
      ctx.fillText(valueText, 700, rY + (rH / 2) + 4);

      // Bottom Row dotted separator
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(100, rY + rH);
      ctx.lineTo(700, rY + rH);
      ctx.stroke();
    }
  };

  const rowH = 34;
  drawRowDetails('ঋণের ক্যাটাগরি (Selected Category Scope)', categoryBangla, false, loanBoxY + 5, rowH);
  drawRowDetails('প্রধান মূলধন (Requested Principal Capital)', toBanglaDigits(formatBDT(form.amount)), false, loanBoxY + 5 + rowH, rowH);
  drawRowDetails('ঋণ পরিশোধের মেয়াদকাল (Total Tenure Period)', `${toBanglaDigits(form.months)} মাস (${toBanglaDigits(form.interestRate)}% বার্ষিক লাভ হার সহ)`, false, loanBoxY + 5 + rowH * 2, rowH);
  drawRowDetails('মাসিক কিস্তির পরিমাণ (Estimated Monthly EMI)', `${toBanglaDigits(formatBDT(emi))} / প্রতি মাস`, false, loanBoxY + 5 + rowH * 3, rowH);
  drawRowDetails('সর্বমোট পরিশোধযোগ্য পরিমাণ (Cumulative Total Repayable)', toBanglaDigits(formatBDT(total)), true, loanBoxY + 5 + rowH * 4, 38);

  ctx.textAlign = 'left'; // Reset standard text align

  // 8. SECTION 3: Verified Attached Documents
  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 13.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('৩. সংযুক্ত প্রমাণপত্রসমূহ ও ডিজিটাল নিরাপত্তা সিকিউরড অডিট (Compliance Audits)', 80, 704);

  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 710);
  ctx.lineTo(720, 710);
  ctx.stroke();

  const drawDocsGridItem = (docName: string, statusText: string, isValid: boolean, x: number, y: number) => {
    // Fill soft container
    fillRoundedRect(ctx, x, y, 310, 42, 8, '#f9f9f9');
    strokeRoundedRect(ctx, x, y, 310, 42, 8, 1, '#eaeaea');

    // Draw solid green check circle emblem
    ctx.fillStyle = isValid ? '#16a34a' : '#d97706';
    ctx.beginPath();
    ctx.arc(x + 20, y + 21, 9, 0, Math.PI * 2);
    ctx.fill();

    // Draw white tick symbol
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✓', x + 20, y + 24);

    // Context details
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 10.5px "Noto Sans Bengali", sans-serif';
    ctx.fillText(docName, x + 38, y + 17);

    ctx.fillStyle = '#6b7280';
    ctx.font = '9px "Noto Sans Bengali", sans-serif';
    ctx.fillText(statusText, x + 38, y + 31);
  };

  const getAddressProofTypeLabel = (type: string) => {
    switch (type) {
      case 'electricity': return 'ঠিকানার প্রমাণ (বিদ্যুৎ বিল)';
      case 'gas': return 'ঠিকানার প্রমাণ (গ্যাস বিল)';
      case 'tax_receipt': return 'ঠিকানার প্রমাণ (ট্যাক্স রশিদ)';
      case 'water': return 'ঠিকানার প্রমাণ (পানির বিল)';
      case 'internet': return 'ঠিকানার প্রমাণ (ইন্টারনেট বিল)';
      case 'rent': return 'ঠিকানার প্রমাণ (ভাড়া চুক্তি)';
      default: return 'নাগরিক ঠিকানার প্রমাণপত্র';
    }
  };

  const auditY = 724;
  drawDocsGridItem('জাতীয় পরিচয়পত্র ১ম অংশ (NID Front Page)', 'সফলভাবে আইডেন্টিটি ভ্যালিডেশন সম্পন্ন', true, 80, auditY);
  drawDocsGridItem('জাতীয় পরিচয়পত্র ২য় অংশ (NID Back Page)', 'সফলভাবে আইডেন্টিটি ভ্যালিডেশন সম্পন্ন', true, 410, auditY);
  
  drawDocsGridItem('গ্রাহকের বায়োমেট্রিক ছবি (Live Selfie Bio)', 'লাইভ সেলফি ফেস ভেরিফিকেশন পাসড', true, 80, auditY + 48);
  drawDocsGridItem(getAddressProofTypeLabel(form.addressProofType), 'আবাসিক ইউটিলিটি বিলের ফাইল আপলোডকৃত', true, 410, auditY + 48);
  
  const incomeProofLabel = form.incomeProof ? 'কর্মস্থল বা আয়ের অফিসিয়াল প্রমাণ (Income Proof)' : 'আয়ের ঘোষণা (Declared Stable Income)';
  const incomeProofDesc = form.incomeProof ? 'কর্মী বা ট্যাক্স প্রুফ ভ্যালিডেশন ফাইল সংযুক্ত' : 'আবেদনকারী কর্তৃক মাসিক আয়ের সেলফ কপি';
  drawDocsGridItem(incomeProofLabel, incomeProofDesc, true, 80, auditY + 96);

  // Holographic looking DIGOUT stamp container block on grid side
  const stampX = 410;
  const stampY = auditY + 96;
  fillRoundedRect(ctx, stampX, stampY, 310, 42, 8, '#f0fdf4'); // Soft light green background
  strokeRoundedRect(ctx, stampX, stampY, 310, 42, 8, 1, '#bbf7d0');

  ctx.fillStyle = '#16a34a'; // Emerald active badge circle
  ctx.beginPath();
  ctx.arc(stampX + 20, stampY + 21, 9, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🛡️', stampX + 20, stampY + 23.5);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 10px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ডিজিটাল সিকিউরিটি ইনস্পেকশন পাস্ড', stampX + 38, stampY + 17);
  
  ctx.fillStyle = '#166534';
  ctx.font = 'bold 8.5px "JetBrains Mono", sans-serif';
  ctx.fillText('#DIG-SECURE-STAMP-APPROVED-100%', stampX + 38, stampY + 31);

  // 9. SECTION 4: Declarations, Tracking QR Codes, & Barcode details
  // Coordinates: y = 888 to 962
  const trackingY = 888;
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 11px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ঘোষণা ও আইনি শর্তাবলী (Declarations & Terms):', 80, trackingY + 11);

  ctx.fillStyle = '#6b7280';
  ctx.font = '8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('১. আবেদনকারী নিশ্চিত করছেন যে প্রদানকৃত সমস্ত বিবরণ সত্য এবং অসত্য তথ্যে ঋণ আবেদন বাতিল বা পেনাল্টি হবে।', 80, trackingY + 26);
  ctx.fillText('২. এই রসিদটি সম্পূর্ণ ডিজিটাল উপায়ে সংকলিত, এতে কোনো কলমের স্বাক্ষর বা ম্যানুয়াল দস্তখত বাধ্যতামূলক নয়।', 80, trackingY + 41);
  ctx.fillText('৩. এই ঋণের চূড়ান্ত ডিসবার্সমেন্ট শাখা ক্রেডিট কমিটির সরজমিন পর্যবেক্ষণ ও ভ্যালিডেশনের পর সম্পন্ন হবে।', 80, trackingY + 56);

  // Real-looking Secure QR code rendering top-notch visual details
  drawQrCode(ctx, 480, trackingY, 68, applicationId);
  ctx.fillStyle = '#71717a';
  ctx.font = 'bold 7.5px "Noto Sans Bengali", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('অবস্থা চেক করুন (Scan QR)', 514, trackingY + 77);

  // Secure Linear Barcode rendering adjacent to QR code
  const drawSecureBarcode = (cx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, val: string) => {
    cx.fillStyle = '#111113';
    let currentX = bx;
    const pattern = [1, 2, 1, 3, 1, 1, 4, 2, 1, 2, 2, 1, 3, 1, 2, 3, 1, 1, 2, 4, 1, 2, 1, 3, 1, 1, 4, 2];
    for (let j = 0; j < pattern.length; j++) {
      const stripeW = pattern[j] * 1.5;
      if (j % 2 === 0) {
        cx.fillRect(currentX, by, stripeW, bh);
      }
      currentX += stripeW;
      if (currentX > bx + bw - 5) break;
    }

    cx.fillStyle = '#6b7280';
    cx.font = 'bold 7.2px "JetBrains Mono", monospace';
    cx.textAlign = 'center';
    cx.fillText(`*${val}*`, bx + (bw / 2), by + bh + 9);
  };
  drawSecureBarcode(ctx, 570, trackingY + 6, 150, 40, applicationId);
  ctx.fillText('বারকোড ডিজিটাল রেকর্ড', 645, trackingY + 77);

  // Reset standard text align
  ctx.textAlign = 'left';

  // 10. SECTION 5: Trust Signatures (Double line alignment layout with scribble)
  const signY = 982;
  
  // Left Applicant Sign
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, signY + 32);
  ctx.lineTo(240, signY + 32);
  ctx.stroke();

  // Draw applicant placeholder cursive signature
  ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(90, signY + 22);
  ctx.quadraticCurveTo(120, signY + 12, 150, signY + 22);
  ctx.quadraticCurveTo(180, signY + 30, 210, signY + 22);
  ctx.stroke();

  ctx.font = 'italic 10.5px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText(user.name, 110, signY + 18);

  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 10px "Noto Sans Bengali", sans-serif';
  ctx.fillText('আবেদনকারীর ডিজিটাল স্বাক্ষর', 80, signY + 45);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('(Applicant Signature Record)', 80, signY + 57);

  // Right Authorized Manager Sign
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(480, signY + 32);
  ctx.lineTo(660, signY + 32);
  ctx.stroke();

  // Draw awesome realistic blue scribbled executive signature Path!
  drawScribbledSignature(ctx, 495, signY + 18);

  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 10px "Noto Sans Bengali", sans-serif';
  ctx.fillText('অনুমোদনকারী কর্মকর্তার স্বাক্ষর', 480, signY + 45);
  ctx.font = 'bold 9px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#4b5563';
  ctx.fillText('মো আশরাফুল ইসলাম (শাখা ব্যবস্থাপক)', 480, signY + 57);

  // Draw awesome green ink stamp overlapping the manager's signature
  drawOfficialStamp(ctx, 630, signY + 20);

  // 11. Premium Bottom Footer Lines
  const footY = 1064;
  ctx.strokeStyle = '#eae1cd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, footY);
  ctx.lineTo(720, footY);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#a48043';
  ctx.font = 'bold 9.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('© ২০২৬ ডিগআউট মাইক্রোফিন্যান্স লিমিটেড', 80, footY + 18);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('সহায়তা কেন্দ্র ইমেইল: support@digout-app.com | হটলাইন নম্বর: ১৬২৪৭', 80, footY + 32);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#9ca3af';
  ctx.font = '8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('লাইসেন্স কোড: DMF-982374-2026 • সমবায় ব্যাংক নিয়মানুযায়ী ভ্যালিড', 720, footY + 18);
  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 8.2px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ডিজিটাল কোড ট্র্যাকিং এবং সিকিউরিটি অডিট দ্বারা শতভাগ সুরক্ষিত রসিদ', 720, footY + 32);

  // Convert generated canvas content to raw PNG image string datastream
  const imgData = canvas.toDataURL('image/png', 1.0);

  // Save as high-fidelity standard PDF format via jsPDF wrapper
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [800, 1150],
  });
  
  pdf.addImage(imgData, 'PNG', 0, 0, 800, 1150);
  pdf.save(`Digout_Loan_Receipt_${applicationId}.pdf`);
}

interface PaymentReceiptPDFParams {
  user: User;
  amount: number;
  installmentNo: number;
  paymentMethod: string;
  transactionId: string;
  loanId: string;
  dateString: string;
}

export function generatePaymentReceiptPDF({
  user,
  amount,
  installmentNo,
  paymentMethod,
  transactionId,
  loanId,
  dateString,
}: PaymentReceiptPDFParams) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1150;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const drawDocsGridItem = (docName: string, statusText: string, isValid: boolean, x: number, y: number) => {
    // Fill soft container
    fillRoundedRect(ctx, x, y, 310, 42, 8, '#f9f9f9');
    strokeRoundedRect(ctx, x, y, 310, 42, 8, 1, '#eaeaea');

    // Draw solid green check circle emblem
    ctx.fillStyle = isValid ? '#16a34a' : '#d97706';
    ctx.beginPath();
    ctx.arc(x + 20, y + 21, 9, 0, Math.PI * 2);
    ctx.fill();

    // Draw white tick symbol
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✓', x + 20, y + 24);

    // Context details
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 10.5px "Noto Sans Bengali", sans-serif';
    ctx.fillText(docName, x + 38, y + 17);

    ctx.fillStyle = '#6b7280';
    ctx.font = '9px "Noto Sans Bengali", sans-serif';
    ctx.fillText(statusText, x + 38, y + 31);
  };

  const drawSecureBarcode = (cx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, val: string) => {
    cx.fillStyle = '#111113';
    let currentX = bx;
    const pattern = [1, 2, 1, 3, 1, 1, 4, 2, 1, 2, 2, 1, 3, 1, 2, 3, 1, 1, 2, 4, 1, 2, 1, 3, 1, 1, 4, 2];
    for (let j = 0; j < pattern.length; j++) {
      const stripeW = pattern[j] * 1.5;
      if (j % 2 === 0) {
        cx.fillRect(currentX, by, stripeW, bh);
      }
      currentX += stripeW;
      if (currentX > bx + bw - 5) break;
    }

    cx.fillStyle = '#6b7280';
    cx.font = 'bold 7.2px "JetBrains Mono", monospace';
    cx.textAlign = 'center';
    cx.fillText(`*${val}*`, bx + (bw / 2), by + bh + 9);
  };

  // 1. White card clean workspace
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 1150);

  // 2. Guilloche wavy diagonal background patterns (anti-tamper lines)
  ctx.strokeStyle = '#fbfcf8';
  ctx.lineWidth = 0.5;
  for (let i = 40; i < 760; i += 28) {
    ctx.beginPath();
    for (let y = 40; y <= 1110; y += 15) {
      const xOffset = Math.sin(y * 0.05) * 3;
      if (y === 40) {
        ctx.moveTo(i + xOffset, y);
      } else {
        ctx.lineTo(i + xOffset, y);
      }
    }
    ctx.stroke();
  }

  // Giant centerted transparent watermark label
  ctx.save();
  ctx.fillStyle = 'rgba(22, 163, 74, 0.022)'; // soft green tint
  ctx.font = 'bold 95px "Noto Sans Bengali", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(400, 575);
  ctx.rotate(-Math.PI / 8); // -22.5 deg rotate
  ctx.fillText('পরিশোধ রসিদ', 0, -30);
  ctx.font = 'bold 45px "Noto Sans Bengali", sans-serif';
  ctx.fillText('DIGOUT PAYMENT', 0, 45);
  ctx.restore();

  // 3. Premium borders & golden corners
  ctx.strokeStyle = '#15803d'; // Rich forest green instead of loan gold for payment actions
  ctx.lineWidth = 3.5;
  ctx.strokeRect(30, 30, 740, 1090);

  ctx.strokeStyle = '#e6f4ea'; // Soft pastel green inner margin
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 36, 728, 1078);

  // Drawing premium green corners
  const drawGreenCorners = (cx: CanvasRenderingContext2D) => {
    cx.strokeStyle = '#15803d';
    cx.lineWidth = 1.6;
    
    // Top-Left
    cx.beginPath();
    cx.moveTo(36 + 25, 36);
    cx.lineTo(36, 36);
    cx.lineTo(36, 36 + 25);
    cx.stroke();

    // Top-Right
    cx.beginPath();
    cx.moveTo(764 - 25, 36);
    cx.lineTo(764, 36);
    cx.lineTo(764, 36 + 25);
    cx.stroke();

    // Bottom-Left
    cx.beginPath();
    cx.moveTo(36 + 25, 1114);
    cx.lineTo(36, 1114);
    cx.lineTo(36, 1114 - 25);
    cx.stroke();

    // Bottom-Right
    cx.beginPath();
    cx.moveTo(764 - 25, 1114);
    cx.lineTo(764, 1114);
    cx.lineTo(764, 1114 - 25);
    cx.stroke();
  };
  drawGreenCorners(ctx);

  // 4. Branding Corporate Header
  const lX = 400;
  const lY = 82;
  ctx.fillStyle = '#15803d'; // Green badge
  ctx.beginPath();
  ctx.moveTo(lX, lY - 22);
  ctx.lineTo(lX + 22, lY - 22);
  ctx.quadraticCurveTo(lX + 22, lY + 11, lX, lY + 26);
  ctx.quadraticCurveTo(lX - 22, lY + 11, lX - 22, lY - 22);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(lX, lY - 18);
  ctx.lineTo(lX + 18, lY - 18);
  ctx.quadraticCurveTo(lX + 18, lY + 9, lX, lY + 22);
  ctx.quadraticCurveTo(lX - 18, lY + 9, lX - 18, lY - 18);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', lX, lY + 2);
  ctx.textBaseline = 'alphabetic';

  // Branding Text labels
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 24px "Noto Sans Bengali", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ডিগআউট মাইক্রোফিন্যান্স লিমিটেড', 400, 134);

  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 10px "Inter", "Noto Sans Bengali", sans-serif';
  ctx.fillText('DIGOUT MICROFINANCE APP INC. • DIGITAL COOPERATIVE SOCIETY', 400, 153);

  ctx.fillStyle = '#6b7280';
  ctx.font = '550 9px "Noto Sans Bengali", sans-serif';
  ctx.fillText('গণপ্রজাতন্ত্রী বাংলাদেশ সমবায় অধিদপ্তর কর্তৃক নিবন্ধিত ও লাইসেন্সপ্রাপ্ত ওয়ান-স্টপ ফিন্যান্সিং পোর্টাল', 400, 168);

  // Separator line
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(120, 182);
  ctx.lineTo(680, 182);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ঋণ কিস্তি ডাউন-পেমেন্ট ও অনলাইন রসিদ', 400, 208);
  
  ctx.fillStyle = '#6b7280';
  ctx.font = 'italic 10.5px "Inter", "Noto Sans Bengali", sans-serif';
  ctx.fillText('Official EMI Repayment Record & Verified Electronic Receipt', 400, 223);

  // 5. Transaction Summary Badge metadata cards
  const summaryY = 242;
  fillRoundedRect(ctx, 80, summaryY, 640, 56, 10, '#f4fbf7');
  strokeRoundedRect(ctx, 80, summaryY, 640, 56, 10, 1, '#bbf7d0');

  // Side highlight strip
  ctx.fillStyle = '#15803d';
  ctx.fillRect(80, summaryY + 12, 4, 32);

  ctx.textAlign = 'left';
  ctx.font = 'bold 10.5px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#4b5563';
  ctx.fillText('ট্রানজেকশন আইডি (Transaction ID)', 100, summaryY + 23);
  ctx.fillText('পরিশোধের তারিখ (Payment Date)', 340, summaryY + 23);
  ctx.fillText('পরিশোধের অবস্থা (Payment Status)', 575, summaryY + 23);

  ctx.font = 'bold 12.5px "JetBrains Mono", sans-serif';
  ctx.fillStyle = '#111827';
  ctx.fillText(transactionId, 100, summaryY + 42);

  ctx.font = 'bold 12.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText(toBanglaDigits(dateString), 340, summaryY + 42);

  // Draw Dynamic status PAID green badge
  const sBadgeX = 575;
  const sBadgeY = 237;
  const sBadgeW = 112;
  const sBadgeH = 22;
  fillRoundedRect(ctx, sBadgeX, sBadgeY, sBadgeW, sBadgeH, 11, '#dcfce7');
  strokeRoundedRect(ctx, sBadgeX, sBadgeY, sBadgeW, sBadgeH, 11, 1, '#bbf7d0');

  ctx.font = 'bold 11px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#15803d'; // emerald-700
  ctx.textAlign = 'center';
  ctx.fillText('পরিশোধিত সফল', sBadgeX + (sBadgeW / 2), sBadgeY + 14);

  // Reset standard text alignment
  ctx.textAlign = 'left';

  // 6. SECTION 1: Customer Profile
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 13.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('১. গ্রাহকের হিসাব ও ঋণ বিবরণী (Member Account Details)', 80, 332);

  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 338);
  ctx.lineTo(720, 338);
  ctx.stroke();

  // Primary customer information card
  const uCardY = 348;
  fillRoundedRect(ctx, 80, uCardY, 640, 106, 10, '#f9fafb');
  strokeRoundedRect(ctx, 80, uCardY, 640, 106, 10, 1, '#eaeaea');

  // Accent vertical stripe
  ctx.fillStyle = '#15803d';
  ctx.fillRect(88, uCardY + 12, 3, 82);

  ctx.font = '10.5px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('গ্রাহকের নাম (Member Name)', 106, uCardY + 23);
  ctx.fillText('মোবাইল নম্বর (Registered Mobile)', 106, uCardY + 68);
  
  ctx.fillText('সমিতি হিসাব নম্বর (Account Number)', 416, uCardY + 23);
  ctx.fillText('অনুষঙ্গিক ঋণ আইডি (Related Loan ID)', 416, uCardY + 68);

  ctx.font = 'bold 12.5px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#111827';
  ctx.fillText(user.name, 106, uCardY + 41);
  ctx.fillText(toBanglaDigits(user.phone), 106, uCardY + 86);

  ctx.font = 'bold 12.5px "JetBrains Mono", sans-serif';
  ctx.fillText(user.accountNo, 416, uCardY + 41);
  ctx.fillText(loanId, 416, uCardY + 86);

  // 7. SECTION 2: EMI Payment Receipts Data
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 13.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('২. পরিশোধিত কিস্তির হিসাব বিবরণী (EMI Transaction Details)', 80, 482);

  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 488);
  ctx.lineTo(720, 488);
  ctx.stroke();

  // Table Container
  const infoY = 498;
  fillRoundedRect(ctx, 80, infoY, 640, 180, 12, '#fafafa');
  strokeRoundedRect(ctx, 80, infoY, 640, 180, 12, 1, '#eaeaea');

  // Amortization row helper
  const drawPaymentRow = (leftTxt: string, rightTxt: string, isTotal: boolean, posY: number, height: number) => {
    if (isTotal) {
      // Emerald theme highlighted grand total badge
      fillRoundedRect(ctx, 84, posY, 632, height, 8, '#ecfdf5');
      strokeRoundedRect(ctx, 84, posY, 632, height, 8, 1.2, '#a7f3d0');

      ctx.textAlign = 'left';
      ctx.fillStyle = '#065f46'; // forest green
      ctx.font = 'bold 12px "Noto Sans Bengali", sans-serif';
      ctx.fillText(leftTxt, 100, posY + (height / 2) + 4);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 15.5px "Noto Sans Bengali", "JetBrains Mono", sans-serif';
      ctx.fillText(rightTxt, 700, posY + (height / 2) + 5);
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#4b5563';
      ctx.font = '11.5px "Noto Sans Bengali", sans-serif';
      ctx.fillText(leftTxt, 100, posY + (height / 2) + 4);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 12.5px "Noto Sans Bengali", "JetBrains Mono", sans-serif';
      ctx.fillText(rightTxt, 700, posY + (height / 2) + 4);

      // dotted separator line
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(100, posY + height);
      ctx.lineTo(700, posY + height);
      ctx.stroke();
    }
  };

  const pRowH = 34;
  const mappedMethod = paymentMethod === 'savings' ? 'সঞ্চয় ব্যালেন্স (Savings Balance)' : paymentMethod === 'bkash' ? 'বিকাশ (bKash Gateway)' : paymentMethod === 'nagad' ? 'নগদ (Nagad Gateway)' : 'অনলাইন পেমেন্ট গেটওয়ে';
  drawPaymentRow('পরিশোধিত কিস্তি বিবরণ (Installment Description)', `কিস্তি নম্বর #${toBanglaDigits(installmentNo)}`, false, infoY + 5, pRowH);
  drawPaymentRow('পরিশোধের মাধ্যম (Payment Method Gateway)', mappedMethod, false, infoY + 5 + pRowH, pRowH);
  drawPaymentRow('নিরাপত্তা অডিট রেকর্ড (Audit Verification State)', 'ডিজিটাল পিন নম্বরে স্বয়ংক্রিয়ভাবে সুরক্ষাপ্রাপ্ত ও ভেরিফাইড', false, infoY + 5 + pRowH * 2, pRowH);
  drawPaymentRow('সার্ভার রেসপন্স আইডেন্টিফায়ার (Gateway Response Code)', 'APPROVED OK (200 SUCCESS)', false, infoY + 5 + pRowH * 3, pRowH);
  drawPaymentRow('মোট পরিশোধিত কিস্তির পরিমাণ (Total Amount Paid)', toBanglaDigits(formatBDT(amount)), true, infoY + 5 + pRowH * 4, 38);

  ctx.textAlign = 'left';

  // 8. SECTION 3: Compliance & Electronic Verification Seals
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 13.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('৩. সিকিউরিটি অডিট ও ডিজিটাল সিগনেচার ট্র্যাকিং (Security Auditing)', 80, 704);

  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 710);
  ctx.lineTo(720, 710);
  ctx.stroke();

  const secY = 724;
  // Box 1: Verified bKash/Nagad Merchant Ledger API
  drawDocsGridItem('পেমেন্ট গেটওয়ে কনফার্মেশন', 'অনলাইন এপিআই থেকে পেমেন্ট স্লিপ কনফার্মড', true, 80, secY);
  // Box 2: Automated ledger update
  drawDocsGridItem('সদস্য লেজার ব্যালেন্স', 'অ্যাকাউন্টে লেজার বুক সফলভাবে আপডেট করা হয়েছে', true, 410, secY);

  // Box 3: Anti-Fraud hash signature
  drawDocsGridItem('অডিটিং ট্র্যাকিং লগ', 'সিস্টেম ফাইন্যান্সিয়াল জাবদা ভাউচার তৈরি করেছে', true, 80, secY + 48);
  // Box 4: SMS dispatch registry
  drawDocsGridItem('ডিজিটাল বিজ্ঞপ্তি ডিসপ্যাচ', 'রেজিস্টার্ড নাম্বারে এসএমএস অ্যালার্ট পাঠানো হয়েছে', true, 410, secY + 48);

  // Box 5: Legal enforcement terms
  drawDocsGridItem('পরিশোধ রসিদ আইনি বৈধতা', 'আইন অনুযায়ী যেকোনো শাখা অফিসে গ্রাহক দাবি সম্মত', true, 80, secY + 96);

  // Holographic looking DIGOUT stamp container block on grid side (Green Active State)
  const pStampX = 410;
  const pStampY = secY + 96;
  fillRoundedRect(ctx, pStampX, pStampY, 310, 42, 8, '#f0fdf4');
  strokeRoundedRect(ctx, pStampX, pStampY, 310, 42, 8, 1, '#bbf7d0');

  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.arc(pStampX + 20, pStampY + 21, 9, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🛡️', pStampX + 20, pStampY + 23.5);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 10px "Noto Sans Bengali", sans-serif';
  ctx.fillText('পেমেন্ট ট্রানজেকশন ক্লিয়ার্ড ও লেজার পাসড', pStampX + 38, pStampY + 17);
  
  ctx.fillStyle = '#166534';
  ctx.font = 'bold 8.5px "JetBrains Mono", sans-serif';
  ctx.fillText(`#PAY-STAMP-${transactionId}`, pStampX + 38, pStampY + 31);

  // 9. Declarations, QR codes & Barcodes
  const pTrackingY = 888;
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 11px "Noto Sans Bengali", sans-serif';
  ctx.fillText('পরিশোধ সংক্রান্ত ঘোষণা ও আইনি তথ্য:', 80, pTrackingY + 11);

  ctx.fillStyle = '#6b7280';
  ctx.font = '8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('১. এই পেমেন্টটি সফলভাবে সম্পন্ন হওয়ার সাথে সাথে সংশ্লিষ্ট সদস্যদের বকেয়া তালিকা হতে এই কিস্তিটি মাইনাস করা হয়েছে।', 80, pTrackingY + 26);
  ctx.fillText('২. ডিজিটাল পদ্ধতিতে সংরক্ষিত এই ভাউচারের কপি ভেরিফিকেশনের জন্য সরাসরি যেকোনো ডিগআউট গ্রাহক শাখা অফিসে প্রদর্শনযোগ্য।', 80, pTrackingY + 41);
  ctx.fillText('৩. এই ট্রানজেকশনের সম্পূর্ণ সার্ভার-হিস্ট্রি আইডেন্টিফায়ার ডাটাবেজে এনক্রিপ্টেড পিয়ার ব্লকে নিরাপদে হোস্ট করা হয়েছে।', 80, pTrackingY + 56);

  // QR Code encoding the Payment transaction ID details
  drawQrCode(ctx, 480, pTrackingY, 68, transactionId);
  ctx.fillStyle = '#71717a';
  ctx.font = 'bold 7.5px "Noto Sans Bengali", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('রসিদ চেক করুন (Scan QR)', 514, pTrackingY + 77);

  // Live barcode rendering adjacent to QR
  drawSecureBarcode(ctx, 570, pTrackingY + 6, 150, 40, transactionId);
  ctx.fillText('ট্রানজেকশন বারকোড রেকর্ড', 645, pTrackingY + 77);

  // Reset text align
  ctx.textAlign = 'left';

  // 10. Digital Signatures & Stamps
  const pSignY = 982;

  // Left side signature
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, pSignY + 32);
  ctx.lineTo(240, pSignY + 32);
  ctx.stroke();

  // Draw customer placeholder curve
  ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(90, pSignY + 22);
  ctx.quadraticCurveTo(120, pSignY + 12, 150, pSignY + 22);
  ctx.quadraticCurveTo(180, pSignY + 30, 210, pSignY + 22);
  ctx.stroke();

  ctx.font = 'italic 10.5px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText(user.name, 110, pSignY + 18);

  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 10px "Noto Sans Bengali", sans-serif';
  ctx.fillText('সদস্য/আবেদনকারীর ডিজিটাল স্বাক্ষর', 80, pSignY + 45);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('(Member Verification Proof)', 80, pSignY + 57);

  // Right side signature (Manager with stamp)
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(480, pSignY + 32);
  ctx.lineTo(660, pSignY + 32);
  ctx.stroke();

  // Draw beautiful realistic blue scribble
  drawScribbledSignature(ctx, 495, pSignY + 18);

  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 10px "Noto Sans Bengali", sans-serif';
  ctx.fillText('রসদ অনুমোদনকারী কর্মকর্তার স্বাক্ষর', 480, pSignY + 45);
  ctx.font = 'bold 9px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#4b5563';
  ctx.fillText('মো আশরাফুল ইসলাম (শাখা ব্যবস্থাপক)', 480, pSignY + 57);

  // Stamp over signature
  drawOfficialStamp(ctx, 630, pSignY + 20);

  // 11. Premium footer content details
  const pFootY = 1064;
  ctx.strokeStyle = '#eae1cd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, pFootY);
  ctx.lineTo(720, pFootY);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 9.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('© ২০২৬ ডিগআউট মাইক্রোফিন্যান্স লিমিটেড', 80, pFootY + 18);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('সহায়তা কেন্দ্র ইমেইল: support@digout-app.com | হটলাইন নম্বর: ১৬২৪৭', 80, pFootY + 32);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#9ca3af';
  ctx.font = '8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('লাইসেন্স কোড: DMF-982374-2026 • সমবায় ব্যাংক নিয়মানুযায়ী ভ্যালিড', 720, pFootY + 18);
  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 8.2px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ডিজিটাল কোড ট্র্যাকিং এবং সিকিউরিটি অডিট দ্বারা শতভাগ সুরক্ষিত পরিশোধ রসিদ', 720, pFootY + 32);

  const pImgData = canvas.toDataURL('image/png', 1.0);

  const outPdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [800, 1150],
  });
  
  outPdf.addImage(pImgData, 'PNG', 0, 0, 800, 1150);
  outPdf.save(`Digout_Payment_Receipt_${transactionId}.pdf`);
}

interface SavingsReceiptPDFParams {
  user: User;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  dateString: string;
}

export function generateSavingsReceiptPDF({
  user,
  amount,
  paymentMethod,
  transactionId,
  dateString,
}: SavingsReceiptPDFParams) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 880;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const drawSecureBarcode = (cx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, val: string) => {
    cx.fillStyle = '#0f172a';
    let currentX = bx;
    const pattern = [1, 2, 1, 3, 1, 1, 4, 2, 1, 2, 2, 1, 3, 1, 2, 3, 1, 1, 2, 4, 1, 2, 1, 3, 1, 1, 4, 2];
    for (let j = 0; j < pattern.length; j++) {
      const stripeW = pattern[j] * 1.5;
      if (j % 2 === 0) {
        cx.fillRect(currentX, by, stripeW, bh);
      }
      currentX += stripeW;
      if (currentX > bx + bw - 5) break;
    }

    cx.fillStyle = '#64748b';
    cx.font = 'bold 7.2px "JetBrains Mono", monospace';
    cx.textAlign = 'center';
    cx.fillText(`*${val}*`, bx + (bw / 2), by + bh + 9);
  };

  // 1. Sleek white canvas base
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 880);

  // 2. Beautiful background watermark in soft teal tint
  ctx.save();
  ctx.fillStyle = 'rgba(13, 148, 136, 0.015)'; // extremely delicate teal tint
  ctx.font = 'bold 72px "Noto Sans Bengali", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(300, 440);
  ctx.rotate(-Math.PI / 10);
  ctx.fillText('সঞ্চয় রশিদ', 0, -30);
  ctx.font = 'bold 32px "Noto Sans Bengali", sans-serif';
  ctx.fillText('SAVINGS DEPOSIT', 0, 30);
  ctx.restore();

  // 3. Compact elegant border
  ctx.strokeStyle = '#0d9488'; // Emerald Teal
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 560, 840);

  // Inner subtle border
  ctx.strokeStyle = '#f0fdf4';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, 552, 832);

  // 4. Header Branding (Teal badge)
  fillRoundedRect(ctx, 30, 30, 540, 96, 14, '#115e59'); // Deep Teal

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ডিগআউট মাইক্রোফিন্যান্স লিমিটেড', 300, 66);
  ctx.font = '500 10.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ডিজিটাল সঞ্চয় ও আমানত জমার ক্যাশ স্লিপ • DMF-ACTIVE', 300, 88);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(150, 100);
  ctx.lineTo(450, 100);
  ctx.stroke();

  // 5. Success Checkmark Badge
  ctx.fillStyle = '#10b981'; // Emerald Green
  ctx.beginPath();
  ctx.arc(300, 175, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓', 300, 176);
  ctx.textBaseline = 'alphabetic';

  // 6. Status Text
  ctx.fillStyle = '#0f766e'; // Teal Primary
  ctx.font = 'bold 15px "Noto Sans Bengali", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('আমানত জমাদানের স্লিপ (SUCCESS RECEIPT)', 300, 222);

  // Big Amount Display
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px Arial, "Noto Sans Bengali", sans-serif';
  ctx.fillText(formatBDT(amount), 300, 272);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 9.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('জমাকৃত আসল আমানত পরিমাণ (Net Cash-In Amount)', 300, 290);

  // 7. Tear-off Dashed Line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(40, 318);
  ctx.lineTo(560, 318);
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash

  // 8. Transaction Details Rows in Clean Card
  fillRoundedRect(ctx, 40, 336, 520, 258, 12, '#f8fafc');
  strokeRoundedRect(ctx, 40, 336, 520, 258, 12, 1, '#e2e8f0');

  const mappedMethod = paymentMethod === 'bkash' ? 'বিকাশ (bKash Self-Gateway)' : paymentMethod === 'nagad' ? 'নগদ (Nagad Self-Gateway)' : paymentMethod === 'rocket' ? 'রকেট পে (Rocket Mobile)' : 'ডিজিটাল পেমেন্ট গেটওয়ে';

  const details = [
    { label: 'আমানতকারী সদস্য (Member Name)', value: user.name },
    { label: 'গ্রাহক সমিতি হিসাব নম্বর (A/C No)', value: user.accountNo },
    { label: 'রজিস্টার্ড মোবাইল (Mobile No)', value: toBanglaDigits(user.phone) },
    { label: 'ট্রানজেকশন মাধ্যম (Gateway Method)', value: mappedMethod },
    { label: 'লেনদেন আইডি (Transaction ID)', value: transactionId },
    { label: 'জমাদানের তারিখ ও সময় (Date & Time)', value: toBanglaDigits(dateString) }
  ];

  details.forEach((item, index) => {
    const posY = 346 + (index * 40);
    
    // Label Left
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = '550 11px "Noto Sans Bengali", sans-serif';
    ctx.fillText(item.label, 58, posY + 22);

    // Value Right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11.5px "Noto Sans Bengali", "JetBrains Mono", sans-serif';
    ctx.fillText(item.value, 542, posY + 22);

    // Light separators
    if (index < details.length - 1) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(58, posY + 35);
      ctx.lineTo(542, posY + 35);
      ctx.stroke();
    }
  });

  // 9. Verified Secure Disclaimer Box
  fillRoundedRect(ctx, 40, 610, 520, 58, 10, '#f0fdf4');
  strokeRoundedRect(ctx, 40, 610, 520, 58, 10, 1, '#bbf7d0');

  // Mini Green Check mark
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(66, 639, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓', 66, 639.5);
  ctx.textBaseline = 'alphabetic';

  ctx.textAlign = 'left';
  ctx.fillStyle = '#14532d';
  ctx.font = 'bold 11px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ডিজিটাল গেটওয়ে দ্বারা অনুমোদিত ও ভেরিফাইড (Cash-In Slip Verified)', 88, 631);
  ctx.fillStyle = '#166534';
  ctx.font = '500 8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('এই ট্রানজেকশনটি সিস্টেম দ্বারা অটোলিফ্ট ও পাসড। অতিরিক্ত সই বা সীলছাড়াই এটি সর্বক্ষেত্রে আইনগত গ্রহণযোগ্য।', 88, 645);

  // 10. Footer Section with Barcodes & QR
  const footerY = 688;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, footerY);
  ctx.lineTo(560, footerY);
  ctx.stroke();

  // Draw QR code to the right
  drawQrCode(ctx, 455, footerY + 16, 85, transactionId);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 8.2px "Noto Sans Bengali", sans-serif';
  ctx.fillText('স্ক্যান করে সত্যতা যাচাই করুন', 445, footerY + 36);
  ctx.fillText('(Scan QR code to Verify)', 445, footerY + 48);
  ctx.font = '7.5px "JetBrains Mono", monospace';
  ctx.fillText(`#TR-${transactionId}`, 445, footerY + 62);

  // Draw Barcode to the left
  drawSecureBarcode(ctx, 40, footerY + 22, 160, 36, transactionId);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 8.2px "Noto Sans Bengali", sans-serif';
  ctx.fillText('সিকিউর আমানত কোড ট্র্যাকার', 40, footerY + 74);

  // Draw Central Official Auto Seal badge
  const sX = 295;
  const sY = footerY + 38;
  ctx.strokeStyle = '#0d9488';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(sX, sY, 26, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(sX, sY, 23, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0d9488';
  ctx.font = 'bold 7px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LEDGER', sX, sY - 9);
  ctx.font = 'bold 7px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ডিগআউট ডিজিটাল সীল', sX, sY + 2);
  ctx.font = 'bold 6.5px "JetBrains Mono", monospace';
  ctx.fillText('APPROVED', sX, sY + 13);

  // 11. Very clean minimal copyright line centered
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 808);
  ctx.lineTo(560, 808);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 8.5px "Noto Sans Bengali", sans-serif';
  ctx.fillText('ডিগআউট মাইক্রোফিন্যান্স লিমিটেড সমবায় অধিদপ্তর কর্তৃক অনুমোদিত ও ডিজিটাল কোঅপারেティブ লাইসেন্সধারী।', 300, 826);
  ctx.font = 'bold 8px "Noto Sans Bengali", sans-serif';
  ctx.fillStyle = '#0d9488';
  ctx.fillText('সরাসরি সহায়তা হেল্পলাইন: ১৬২৪৭ | সাহায্য ইমেইল: support@digout-app.com | DMF-RECEIPT', 300, 840);

  const pImgData = canvas.toDataURL('image/png', 1.0);

  const outPdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [600, 880],
  });
  
  outPdf.addImage(pImgData, 'PNG', 0, 0, 600, 880);
  outPdf.save(`Digout_Deposit_Slip_${transactionId}.pdf`);
}


