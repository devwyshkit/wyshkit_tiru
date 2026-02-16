'use client';

import React from 'react';
import { FileText, Download, ShieldCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComplianceBlockProps {
  gstin: string;
  setGstin: (val: string) => void;
  onDownloadEstimate: () => void;
}

export function ComplianceBlock({ gstin, setGstin, onDownloadEstimate }: ComplianceBlockProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Compliance & GST</h3>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg">
          <ShieldCheck className="size-3 text-emerald-600" />
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Secured</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative group md:max-w-md">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <FileText className="size-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
          </div>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="GSTIN (Optional for Business)"
            className="w-full h-12 pl-11 pr-4 bg-zinc-50 border border-zinc-100 rounded-xl text-sm font-semibold placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white transition-all"
          />
          {gstin.length === 15 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Check className="size-4 text-emerald-500" />
            </div>
          )}
        </div>

        <button
          onClick={onDownloadEstimate}
          className="w-full flex items-center justify-between p-4 bg-zinc-50 border border-zinc-100 rounded-xl hover:bg-zinc-100 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-white border border-zinc-100 flex items-center justify-center">
              <Download className="size-4 text-zinc-900" />
            </div>
            <div className="text-left">
              <p className="text-[12px] font-bold text-zinc-900 leading-tight">Download Proforma Estimate</p>
              <p className="text-[10px] font-medium text-zinc-500 leading-tight mt-0.5">Required for corporate approval</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 group-hover:text-zinc-900 transition-colors">PDF</span>
        </button>
      </div>

      <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
        <p className="text-[10px] font-semibold text-amber-800 leading-relaxed italic">
          * As per Wyshkit 2026 compliance: GSTIN is required for tax credit. Estimate download is provided for pre-payment documentation.
        </p>
      </div>
    </div>
  );
}
