'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { XCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ActionSlider } from '@/components/ui/ActionSlider';
import type { PreviewSubmission } from '@/hooks/useOrderRealtime';

interface PreviewApprovalProps {
    preview: PreviewSubmission;
    changeCount?: number;
    maxChanges?: number;
    onApprove: () => void;
    onRequestChange: (feedback: string) => void;
    isApproving: boolean;
}

export function PreviewApproval({
    preview,
    changeCount = 0,
    maxChanges = 2,
    onApprove,
    onRequestChange,
    isApproving
}: PreviewApprovalProps) {
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedback, setFeedback] = useState('');
    const changesRemaining = Math.max(0, maxChanges - changeCount);

    return (
        <section className="bg-white space-y-4">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-lg font-bold text-zinc-900 leading-tight">Review Design</h3>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                    <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Action Needed</span>
                </div>
            </div>

            <div className="relative aspect-[4/5] bg-zinc-100 rounded-3xl overflow-hidden shadow-sm border border-zinc-200/50">
                <Image src={preview.preview_url} alt="Preview" fill className="object-cover" />
                {preview.partner_notes && (
                    <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur-md p-4 border-t border-white/20">
                        <p className="text-xs font-medium text-zinc-900">
                            <span className="text-zinc-500 block text-[10px] font-bold uppercase tracking-wider mb-0.5">Partner Note</span>
                            {preview.partner_notes}
                        </p>
                    </div>
                )}
            </div>

            <div className="space-y-3 pt-2">
                {showFeedback ? (
                    <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-zinc-200/50">
                            <span className="text-xs font-bold text-zinc-900">Request Changes</span>
                            <button onClick={() => setShowFeedback(false)} className="p-1 -mr-1 text-zinc-400 hover:text-zinc-600">
                                <XCircle className="size-5" />
                            </button>
                        </div>
                        <Textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="e.g. Please make the font bigger..."
                            className="w-full min-h-[100px] bg-white border border-zinc-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-zinc-900 transition-all outline-none resize-none"
                            autoFocus
                        />
                        <button
                            onClick={() => onRequestChange(feedback)}
                            disabled={isApproving || !feedback.trim()}
                            className="w-full h-12 bg-zinc-900 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest disabled:opacity-50"
                        >
                            {isApproving ? 'Sending Request...' : 'Send Feedback'}
                        </button>
                        <p className="text-[10px] text-zinc-400 text-center">
                            {changesRemaining} free revision{changesRemaining !== 1 ? 's' : ''} remaining
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-[10px] text-zinc-400 text-center px-6 leading-relaxed">
                            By approving, you agree to the design. <br /> Personalized items cannot be returned.
                        </p>
                        <ActionSlider
                            onConfirm={onApprove}
                            isLoading={isApproving}
                            label="Slide to approve preview"
                            successLabel="Approved"
                        />
                        <button
                            onClick={() => setShowFeedback(true)}
                            disabled={isApproving || changesRemaining <= 0}
                            className="w-full py-3 text-[10px] font-black text-zinc-500 hover:text-zinc-800 underline decoration-zinc-200 uppercase tracking-widest transition-colors disabled:no-underline disabled:opacity-30"
                        >
                            Request a change ({changesRemaining} left)
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
