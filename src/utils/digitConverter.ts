/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts Bengali digits (০-৯) in a string to English digits (0-9).
 */
export function convertBanglaToEnglishDigits(str: string): string {
  if (!str) return '';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[০-৯]/g, (match) => banglaDigits.indexOf(match).toString());
}

/**
 * Normalizes any numeric input by converting Bangla digits to English digits
 * and stripping any non-numeric characters.
 */
export function cleanNumericInput(str: string): string {
  return convertBanglaToEnglishDigits(str).replace(/[^0-9]/g, '');
}
