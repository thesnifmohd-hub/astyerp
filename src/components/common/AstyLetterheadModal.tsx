import React from 'react';
import { Download, Printer, X } from 'lucide-react';
import * as XLSX from 'xlsx';

export function exportRowsToExcel(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

interface AstyLetterheadModalProps {
  open: boolean;
  onClose: () => void;
  documentType: string;
  documentNo: string;
  dateFormatted: string;
  siteName?: string;
  children: React.ReactNode;
  excelRows?: Record<string, unknown>[];
}

export function AstyLetterheadModal({
  open,
  onClose,
  documentType,
  documentNo,
  dateFormatted,
  siteName,
  children,
  excelRows,
}: AstyLetterheadModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden my-8 print-sheet">
        <div className="no-print flex items-center justify-between border-b border-asty-border bg-asty-surface px-6 py-3">
          <span className="text-sm font-semibold text-asty-charcoal">
            Asty Official Letterhead Preview — {documentType}
          </span>
          <div className="flex items-center gap-2">
            {excelRows && excelRows.length > 0 && (
              <button
                type="button"
                onClick={() => exportRowsToExcel(`${documentNo.replace(/\//g, '_')}.xlsx`, documentType, excelRows)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-asty-border bg-white px-3 py-1.5 text-xs font-semibold text-asty-charcoal hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel (.xlsx)
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-asty-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:bg-asty-black"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Official Asty Constructions Letterhead */}
        <div className="p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-asty-charcoal p-6 text-white">
            <div>
              <div className="text-xl font-bold tracking-tight">ASTY CONSTRUCTIONS</div>
              <div className="mt-1 text-xs text-asty-slate">
                2nd Floor, Asty Chambers, Thrissur, Kerala - 680001 • Residential | Commercial | Resorts | PMC
              </div>
              <div className="mt-0.5 text-xs text-asty-slate">
                GSTIN: 32AABCA8821K1Z4 • PAN: AABCA8821K • State Code: 32 (Kerala)
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block rounded bg-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider">
                {documentType}
              </div>
              <div className="mt-2 text-sm font-semibold">{documentNo}</div>
              <div className="text-xs text-asty-slate">Date: {dateFormatted}</div>
              {siteName && <div className="text-xs text-asty-slate">Project: {siteName}</div>}
            </div>
          </div>

          <div className="mt-6 text-sm text-asty-black">{children}</div>

          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-asty-border pt-6 text-xs text-slate-500">
            <div>Prepared By (ERP Audit Verified)</div>
            <div className="text-center">Checked By (Operations / Coordinator)</div>
            <div className="text-right">For Asty Constructions (Authorised Signatory)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

