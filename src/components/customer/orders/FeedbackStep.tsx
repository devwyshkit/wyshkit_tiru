'use client';

import React, { useState } from 'react';
import { Star, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { submitItemReview } from '@/lib/actions/item-actions';
import { toast } from 'sonner';

interface FeedbackStepProps {
    orderId: string;
    items: Array<{ id: string; name: string }>;
    onComplete?: () => void;
}

export function FeedbackStep({ orderId, items, onComplete }: FeedbackStepProps) {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setIsSubmitting(true);
        try {
            // Logic: Rate each item in the order (Simplified for Swiggy 2026)
            // In a real app, we might rate the partner separately.
            // Here we rate the primary items.
            const promises = items.map(item => submitItemReview(item.id, rating, comment));
            await Promise.all(promises);

            setSubmitted(true);
            toast.success('Thank you for your feedback!');
            if (onComplete) setTimeout(onComplete, 2000);
        } catch (error) {
            toast.error('Failed to submit feedback');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="p-8 text-center bg-emerald-50 rounded-[32px] border border-emerald-100 animate-in fade-in zoom-in duration-500">
                <div className="size-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="size-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-black text-emerald-900 uppercase tracking-tight mb-2">Feedback Received</h3>
                <p className="text-sm text-emerald-600 font-medium">Your feedback helps us improve the experience.</p>
            </div>
        );
    }

    return (
        <section className="bg-white rounded-[32px] border border-zinc-100 p-6 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
                <div className="size-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Star className="size-5 text-amber-500 fill-amber-500" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Rate your experience</h3>
                    <p className="text-xs text-zinc-400 font-medium mt-0.5">How was your order #{orderId.slice(0, 8)}?</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Star Rating */}
                <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <button
                            key={s}
                            onClick={() => setRating(s)}
                            className="p-1 active:scale-90 transition-transform"
                        >
                            <Star
                                className={cn(
                                    "size-10 transition-colors",
                                    rating >= s ? "text-amber-400 fill-amber-400" : "text-zinc-200"
                                )}
                            />
                        </button>
                    ))}
                </div>

                {/* Comment Box */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <MessageSquare className="size-3 text-zinc-400" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Comments (Optional)</span>
                    </div>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Tell us what you liked or how we can improve..."
                        className="w-full h-24 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all resize-none"
                    />
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || rating === 0}
                    className={cn(
                        "w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2",
                        rating > 0
                            ? "bg-zinc-900 text-white shadow-lg active:scale-95"
                            : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    )}
                >
                    {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : 'Submit Feedback'}
                </button>
            </div>
        </section>
    );
}
