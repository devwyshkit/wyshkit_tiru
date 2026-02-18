'use client';

import React, { useState } from 'react';
import { Sparkles, Camera, Image as ImageIcon, Info, ShieldCheck, Check, Clock, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { ActionSlider } from '@/components/ui/ActionSlider';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logging/logger';
import { submitOrderPersonalization } from '@/lib/actions/orders';
import { cn } from '@/lib/utils';
import imageCompression from 'browser-image-compression';
import { hasItemPersonalization } from '@/lib/utils/personalization';
import { HyperlocalTimer } from '@/components/ui/HyperlocalTimer';

interface IdentityFormProps {
    order: any;
    orderItem?: any; // WYSHKIT 2026: Item-level support
    onSubmitted: () => void;
}

export function IdentityForm({
    order,
    orderItem,
    onSubmitted
}: IdentityFormProps) {
    const [formData, setFormData] = useState<Record<string, { text?: string; imageUrl?: string }>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingItems, setUploadingItems] = useState<Record<string, boolean>>({});

    const [timeLeft, setTimeLeft] = useState<string>('');

    React.useEffect(() => {
        if (!order?.design_deadline_at) return;

        const interval = setInterval(() => {
            const now = new Date();
            const deadline = new Date(order.design_deadline_at);
            const diff = deadline.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft('Expired');
                clearInterval(interval);
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [order?.design_deadline_at]);

    // WYSHKIT 2026: Hybrid Personalization Support
    const items = order.orderItems || order.order_items || order.items || [];

    // WYSHKIT 2026: Filter for items needing input - restricted to orderItem if provided
    const personalizedItems = orderItem
        ? [orderItem]
        : items.filter((item: any) => {
            const needsInput = hasItemPersonalization(item) && !item.personalization_details;
            return needsInput;
        });

    const handleInputChange = (itemId: string, field: 'text' | 'imageUrl', value: string) => {
        setFormData(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));
    };

    const handleFileUpload = async (itemId: string, file: File) => {
        if (!file) return;

        try {
            setUploadingItems(prev => ({ ...prev, [itemId]: true }));

            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1200,
                useWebWorker: true,
                initialQuality: 0.8
            };

            const compressedFile = await imageCompression(file, options);
            const finalFile = new File([compressedFile], file.name, { type: file.type || 'image/jpeg' });

            const supabase = createClient();
            const fileName = `customer-uploads/${order.id}/${itemId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

            const { data, error } = await supabase.storage
                .from('order-assets')
                .upload(fileName, finalFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('order-assets')
                .getPublicUrl(data.path);

            handleInputChange(itemId, 'imageUrl', publicUrl);
            triggerHaptic(HapticPattern.SUCCESS);
            toast.success("Image added to design");
        } catch (error: any) {
            logger.error('Image upload error in IdentityForm', error);
            toast.error(error.message || 'Failed to upload image');
        } finally {
            setUploadingItems(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const handleSubmit = async () => {
        for (const item of personalizedItems) {
            const legacyConfig = (item as any).personalization_config || {};
            const addons = (item.selected_addons as any[])?.filter((a: any) => a.requires_preview) || [];

            const isAddonFlow = addons.length > 0;
            const config = isAddonFlow ? {
                text_required: true,
                image_required: false,
                char_limit: 500,
                text_label: `Details for ${addons.map((a: any) => a.name).join(', ')}`,
                placeholder: "Please describe how you want this personalized...",
                allow_text: true,
                allow_image: true
            } : legacyConfig;

            const input = formData[item.id] || {};

            if (config.text_required && !input.text?.trim()) {
                toast.error(`Please provide details for ${item.item_name}`);
                return { success: false };
            }
            if (config.char_limit && (input.text?.length || 0) > config.char_limit) {
                toast.error(`${item.item_name} text exceeds limit of ${config.char_limit} chars`);
                return { success: false };
            }
            if (config.image_required && !input.imageUrl) {
                toast.error(`Please upload an image for ${item.item_name}`);
                return { success: false };
            }
        }

        setIsSubmitting(true);
        try {
            const personalizationData = personalizedItems.reduce((acc: any, item: any) => {
                const itemFormData = formData[item.id] || {};
                const addons = item.selected_addons || item.selectedAddons || [];

                acc[item.id] = {
                    text: itemFormData.text || null,
                    image_url: itemFormData.imageUrl || null,
                    addons: addons.filter((a: any) => a.requires_preview).map((a: any) => a.name)
                };
                return acc;
            }, {});

            const result = await submitOrderPersonalization(order.id, personalizationData);
            if (result.success) {
                triggerHaptic(HapticPattern.SUCCESS);
                onSubmitted();
            } else {
                toast.error(result.error || "Failed to submit details");
            }
            return result;
        } catch (error) {
            toast.error("An unexpected error occurred");
            return { success: false };
        } finally {
            setIsSubmitting(false);
        }
    };

    if (personalizedItems.length === 0) return null;

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* WYSHKIT 2026: Status Guard & SLA Timer - Only show for bulk view, not item loop */}
            {!orderItem && order?.design_deadline_at && (
                <div className="bg-zinc-900 rounded-[32px] p-6 text-white shadow-2xl shadow-zinc-200 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.05] pointer-events-none">
                        <Sparkles className="size-24 rotate-12" />
                    </div>

                    <div className="relative z-10 flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                            <div className="size-12 bg-amber-500/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-amber-500/30">
                                <Sparkles className="size-6 text-amber-500" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-widest text-amber-100">Add Identity</h4>
                                <p className="text-[11px] text-amber-200/60 font-medium tracking-tight">Crafting starts as soon as you submit</p>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                            <HyperlocalTimer deadline={order.design_deadline_at} className="border-none bg-transparent shadow-none py-4" />
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {personalizedItems.map((item: any) => {
                    const legacyConfig = item.personalization_config || (item.personalization?.enabled ? item.personalization : {});
                    const addons = item.selected_addons?.filter((a: any) => a.requires_preview) || [];
                    const isAddonFlow = addons.length > 0;
                    const itemName = item.item_name || item.name;

                    const config = isAddonFlow ? {
                        text_required: true,
                        image_required: false,
                        char_limit: 500,
                        text_label: addons.length === 1 ? `Details for ${addons[0].name}` : `Identity Details`,
                        placeholder: "e.g. Name: 'Prateek', Date: '20th Oct'...",
                        allow_text: true,
                        allow_image: true,
                        instructions: "Our partner will use these details for your preview."
                    } : {
                        ...legacyConfig,
                        allow_text: legacyConfig.allow_text ?? (legacyConfig.type === 'text' || !!legacyConfig.prompt),
                        text_label: legacyConfig.text_label || legacyConfig.prompt || 'details',
                        text_required: legacyConfig.text_required ?? true
                    };

                    const input = formData[item.id] || {};

                    return (
                        <section key={item.id} className="group transition-all">
                            {!orderItem && (
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <h4 className="text-[12px] font-bold text-zinc-500 uppercase tracking-widest">
                                        {itemName}
                                    </h4>
                                </div>
                            )}

                            <div className="bg-white rounded-[28px] p-5 border border-zinc-100 shadow-sm transition-all group-hover:border-zinc-200 space-y-4">
                                {config.allow_text && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
                                                {config.text_label || 'Input Details'}
                                            </label>
                                            {config.char_limit && (
                                                <span className={cn(
                                                    "text-[10px] font-bold tracking-tight tabular-nums opacity-40",
                                                    (input.text?.length || 0) > config.char_limit ? "text-rose-500 opacity-100" : "text-zinc-900"
                                                )}>
                                                    {input.text?.length || 0}/{config.char_limit}
                                                </span>
                                            )}
                                        </div>
                                        <Textarea
                                            value={input.text || ''}
                                            onChange={(e) => handleInputChange(item.id, 'text', e.target.value)}
                                            placeholder={config.placeholder || "Describe your requirements..."}
                                            className="w-full bg-zinc-50/50 border-zinc-100 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5 transition-all outline-none min-h-[100px] resize-none placeholder:text-zinc-300 border shadow-none"
                                            maxLength={config.char_limit}
                                        />
                                    </div>
                                )}

                                {config.allow_image && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="h-px flex-1 bg-zinc-50" />
                                            <span className="text-[9px] font-black text-zinc-300 uppercase tracking-[0.2em]">or upload image</span>
                                            <div className="h-px flex-1 bg-zinc-50" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 relative">
                                            <button
                                                type="button"
                                                disabled={uploadingItems[item.id]}
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.accept = 'image/*';
                                                    input.onchange = (e) => {
                                                        const file = (e.target as HTMLInputElement).files?.[0];
                                                        if (file) handleFileUpload(item.id, file);
                                                    };
                                                    triggerHaptic(HapticPattern.ACTION);
                                                    input.click();
                                                }}
                                                className="flex flex-col items-center justify-center gap-2 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl hover:bg-zinc-100 transition-all active:scale-[0.98] disabled:opacity-50 group/btn"
                                            >
                                                <ImageIcon className="size-5 text-zinc-400 group-hover/btn:text-zinc-600 transition-colors" />
                                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Gallery</span>
                                            </button>

                                            <button
                                                type="button"
                                                disabled={uploadingItems[item.id]}
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.accept = 'image/*';
                                                    input.capture = 'environment';
                                                    input.onchange = (e) => {
                                                        const file = (e.target as HTMLInputElement).files?.[0];
                                                        if (file) handleFileUpload(item.id, file);
                                                    };
                                                    triggerHaptic(HapticPattern.ACTION);
                                                    input.click();
                                                }}
                                                className="flex flex-col items-center justify-center gap-2 py-4 bg-zinc-900 rounded-2xl hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 group/btn shadow-lg shadow-zinc-200"
                                            >
                                                <Camera className="size-5 text-zinc-400 group-hover/btn:text-white transition-colors" />
                                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest group-hover/btn:text-white transition-colors">Camera</span>
                                            </button>

                                            {uploadingItems[item.id] && (
                                                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-2 z-20 animate-in fade-in duration-300">
                                                    <Loader2 className="size-5 text-zinc-900 animate-spin" />
                                                </div>
                                            )}
                                        </div>

                                        {input.imageUrl && (
                                            <div className="relative aspect-video rounded-2xl overflow-hidden border border-zinc-100 mt-2 group shadow-sm bg-zinc-50">
                                                <img src={input.imageUrl} alt="Preview" className="size-full object-cover" />
                                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-all" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleInputChange(item.id, 'imageUrl', '')}
                                                    className="absolute top-2 right-2 size-8 bg-white/90 backdrop-blur-md shadow-lg rounded-full flex items-center justify-center text-zinc-900 hover:scale-110 active:scale-95 transition-all z-10"
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {config.instructions && (
                                    <div className="flex gap-2 p-3 bg-zinc-50/50 rounded-xl border border-zinc-100/50">
                                        <Info className="size-3 text-zinc-400 shrink-0 mt-0.5" />
                                        <p className="text-[9px] text-zinc-500 font-medium leading-snug">
                                            {config.instructions}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>

            <div className="pt-6 flex flex-col gap-5">
                <div className="text-center space-y-1">
                    <p className="text-sm font-black text-zinc-950 uppercase tracking-tighter">Share Design Brief</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Move to production immediately</p>
                </div>

                <ActionSlider
                    onConfirm={handleSubmit}
                    label="Slide to Share Brief"
                    successLabel="Brief Shared"
                    isLoading={isSubmitting}
                    variant="amber"
                />

                <div className="flex items-center justify-center gap-4 text-[9px] font-black text-zinc-300 uppercase tracking-[0.2em] opacity-50">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="size-3" /> Encrypted</span>
                    <span className="flex items-center gap-1.5"><Sparkles className="size-3" /> Creative</span>
                    <span className="flex items-center gap-1.5"><Check className="size-3" /> Verified</span>
                </div>
            </div>
        </div>
    );
}
