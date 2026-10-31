/**
 * Asty ERP — Strict Integer Paise Money Engine (SPEC Sections 2 & 6)
 * All money values are stored and computed in integer paise (₹1 = 100 paise).
 * Never store floating-point currency.
 */

export type Paise = number; // Safe integer up to ₹9,00,71,99,25,47,409.91 (Number.MAX_SAFE_INTEGER)

export function rupeesToPaise(rupeesInput: string | number): Paise {
  if (typeof rupeesInput === 'number') {
    if (!Number.isFinite(rupeesInput)) return 0;
    return Math.round(rupeesInput * 100);
  }
  const cleaned = rupeesInput.replace(/[₹,\s]/g, '').trim();
  if (!cleaned) return 0;
  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const [whole = '0', frac = ''] = unsigned.split('.');
  const wholeInt = parseInt(whole || '0', 10);
  const fracPadded = (frac + '00').slice(0, 2);
  const fracInt = parseInt(fracPadded, 10);
  if (Number.isNaN(wholeInt) || Number.isNaN(fracInt)) return 0;
  const total = wholeInt * 100 + fracInt;
  return negative ? -total : total;
}

export function paiseToRupeesNumber(paise: Paise): number {
  return Math.round(paise) / 100;
}

/**
 * Formats integer paise in Indian currency format: ₹1,00,000 or ₹1,00,000.50
 */
export function formatINR(paise: Paise, options?: { showDecimals?: boolean; hideSymbol?: boolean }): string {
  const safe = Math.round(paise || 0);
  const isNeg = safe < 0;
  const abs = Math.abs(safe);
  const rupees = Math.floor(abs / 100);
  const remPaise = abs % 100;

  const rStr = rupees.toString();
  let formattedWhole: string;
  if (rStr.length <= 3) {
    formattedWhole = rStr;
  } else {
    const last3 = rStr.slice(-3);
    const rest = rStr.slice(0, -3);
    formattedWhole = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }

  const showDec = options?.showDecimals ?? remPaise !== 0;
  const decPart = showDec ? `.${remPaise.toString().padStart(2, '0')}` : '';
  const sym = options?.hideSymbol ? '' : '₹';
  return `${isNeg ? '-' : ''}${sym}${formattedWhole}${decPart}`;
}

/**
 * Integer Basis-Point Percentage Calculation (e.g. 18% GST -> pct = 18 -> 1800 bps)
 */
export function applyPercentagePaise(basePaise: Paise, percentage: number): Paise {
  const bps = Math.round(percentage * 100); // 18.00% => 1800 bps
  return Math.round((Math.round(basePaise) * bps) / 10000);
}

export function splitGST(taxablePaise: Paise, gstRatePct: number, interState = false): {
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  totalTaxPaise: Paise;
  grossPaise: Paise;
} {
  const totalTaxPaise = applyPercentagePaise(taxablePaise, gstRatePct);
  if (interState) {
    return {
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: totalTaxPaise,
      totalTaxPaise,
      grossPaise: taxablePaise + totalTaxPaise,
    };
  }
  const cgstPaise = Math.floor(totalTaxPaise / 2);
  const sgstPaise = totalTaxPaise - cgstPaise;
  return {
    cgstPaise,
    sgstPaise,
    igstPaise: 0,
    totalTaxPaise,
    grossPaise: taxablePaise + totalTaxPaise,
  };
}

