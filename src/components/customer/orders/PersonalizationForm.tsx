'use client';

import React, { useState } from 'react';
import { Sparkles, Camera, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { ActionSlider } from '@/components/ui/ActionSlider';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logging/logger';
import { submitOrderPersonalization } from '@/lib/actions/orders';
import imageCompression from 'browser-image-compression';

interface PersonalizationFormProps {
    order: any;
    onSubmitted: () => void;
}

export function PersonalizationForm({
    order,
    onSubmitted
}: PersonalizationFormProps) {
    const [formData, setFormData] = useState<Record<string, { text?: string; imageUrl?: string }>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // WYSHKIT 2026: Hybrid Personalization Support
    // Supports both Legacy (is_personalized flag) and New (Add-ons with requires_preview)
    const items = order.order_items || order.items || [];
    const personalizedItems = items.filter((item: any) => {
        const hasLegacyPersonalization = item.is_personalized || (item.personalization && item.personalization.enabled);
        const hasAddonPersonalization = item.selected_addons?.some((addon: any) => addon.requires_preview);
        const needsInput = (hasLegacyPersonalization || hasAddonPersonalization) && !item.personalization_details;
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
            toast.info("Compressing image...");

            const options = {
                maxSizeMB: 0.5, // WYSHKIT 2026: <500KB limit for reliability
                maxWidthOrHeight: 1200, // Reduced from 1920 for better performance
                useWebWorker: true,
                initialQuality: 0.8
            };

            const compressedFile = await imageCompression(file, options);
            const finalFile = new File([compressedFile], file.name, { type: file.type || 'image/jpeg' });

            toast.info("Uploading image...");
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
            toast.success("Image uploaded successfully");
        } catch (error: any) {
            logger.error('Image upload error in PersonalizationForm', error);
            toast.error(error.message || 'Failed to upload image. Please try again.');
        }
    };

    const handleSubmit = async () => {
        for (const item of personalizedItems) {
            // Determine config type
            const legacyConfig = item.personalization_config || {};
            const addons = item.selected_addons?.filter((a: any) => a.requires_preview) || [];

            // Construct effective config
            const isAddonFlow = addons.length > 0;
            const config = isAddonFlow ? {
                // Default to allowing both for add-ons unless we add specific schema later
                text_required: true,
                image_required: false,
                char_limit: 500,
                text_label: `Details for ${addons.map((a: any) => a.name).join(', ')}`,
                placeholder: "Please describe how you want this personalized...",
                allow_text: true,
                allow_image: true // Always allow image upload for flexibility
            } : legacyConfig;

            const input = formData[item.id] || {};

            if (config.text_required && !input.text?.trim()) {
                toast.error(`Please provide details for ${item.item_name}`);
                return;
            }
            if (config.char_limit && (input.text?.length || 0) > config.char_limit) {
                toast.error(`${item.item_name} text exceeds limit of ${config.char_limit} chars`);
                return;
            }
            if (config.image_required && !input.imageUrl) {
                toast.error(`Please upload an image for ${item.item_name}`);
                return;
            }
        }

        setIsSubmitting(true);
        const personalizationData = personalizedItems.reduce((acc: any, item: any) => {
            const itemFormData = formData[item.id] || {};
            acc[item.id] = {
                text: itemFormData.text || null,
                image_url: itemFormData.imageUrl || null,
                // Add metadata about which addons are covered
                addons: item.selected_addons?.filter((a: any) => a.requires_preview).map((a: any) => a.name)
            };
            return acc;
        }, {});

        logger.info('[PersonalizationForm] Submitting data', { orderId: order.id, personalizationData });
        const result = await submitOrderPersonalization(order.id, personalizationData);
        logger.info('[PersonalizationForm] Submission result', result);
        setIsSubmitting(false);

        if (result.success) {
            triggerHaptic(HapticPattern.SUCCESS);
            onSubmitted();
        } else {
            toast.error(result.error || "Failed to submit details");
        }
    };

    if (personalizedItems.length === 0) return null;

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-2">
                <div className="size-8 bg-amber-100 rounded-full flex items-center justify-center">
                    <Sparkles className="size-4 text-amber-600" />
                </div>
                <div>
                    <h4 className="text-xs font-black text-zinc-900 uppercase tracking-widest">Personalize your order</h4>
                    <p className="text-[10px] text-zinc-400 font-medium">Please share the details required for your items</p>
                </div>
            </div>

            {personalizedItems.map((item: any) => {
                const legacyConfig = item.personalization_config || (item.personalization?.enabled ? item.personalization : {});
                const addons = item.selected_addons?.filter((a: any) => a.requires_preview) || [];
                const isAddonFlow = addons.length > 0;
                const itemName = item.item_name || item.name;

                const config = isAddonFlow ? {
                    text_required: true,
                    image_required: false,
                    char_limit: 500,
                    text_label: addons.length === 1 ? `Details for ${addons[0].name}` : `Personalization Details`,
                    placeholder: "Please describe how you want this personalized (names, dates, preferences)...",
                    allow_text: true,
                    allow_image: true,
                    instructions: "Please be as specific as possible so our partner can create the perfect design for you."
                } : {
                    ...legacyConfig,
                    allow_text: legacyConfig.allow_text ?? (legacyConfig.type === 'text' || !!legacyConfig.prompt),
                    text_label: legacyConfig.text_label || legacyConfig.prompt || 'details',
                    text_required: legacyConfig.text_required ?? true
                };

                const input = formData[item.id] || {};

                return (
                    <div key={item.id} className="bg-zinc-50 rounded-2xl p-5 border border-zinc-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                                {itemName}
                            </h4>
                            {config.char_limit && (
                                <span className="text-[10px] font-medium text-zinc-400">
                                    {input.text?.length || 0}/{config.char_limit}
                                </span>
                            )}
                        </div>

                        {config.inputType === 'boolean' && (
                            <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-200">
                                <input
                                    type="checkbox"
                                    checked={!!input.text}
                                    onChange={(e) => handleInputChange(item.id, 'text', e.target.checked ? 'true' : '')}
                                    className="size-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                                />
                                <span className="text-sm font-medium text-zinc-700">{config.name || 'Additional Option'}</span>
                            </div>
                        )}

                        {config.allow_text && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                                    {config.text_required && <span className="text-rose-500 mr-1">*</span>}
                                    Text to {config.text_label || 'Print/Engrave'}
                                </label>
                                <Textarea
                                    value={input.text || ''}
                                    onChange={(e) => handleInputChange(item.id, 'text', e.target.value)}
                                    placeholder={config.placeholder || "Enter text here..."}
                                    className="w-full bg-white border border-zinc-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-zinc-900 transition-all outline-none min-h-[80px] resize-none"
                                    maxLength={config.char_limit}
                                />
                            </div>
                        )}

                        {config.allow_image && (
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                                    {config.image_required && <span className="text-rose-500 mr-1">*</span>}
                                    Reference Image
                                </label>
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.onchange = (e) => {
                                                    const file = (e.target as HTMLInputElement).files?.[0];
                                                    if (file) handleFileUpload(item.id, file);
                                                };
                                                input.click();
                                            }}
                                            className="flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors"
                                        >
                                            <div className="size-8 bg-zinc-50 rounded-full flex items-center justify-center">
                                                <ImageIcon className="size-4 text-zinc-400" />
                                            </div>
                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Choose from Gallery</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.capture = 'environment';
                                                input.onchange = (e) => {
                                                    const file = (e.target as HTMLInputElement).files?.[0];
                                                    if (file) handleFileUpload(item.id, file);
                                                };
                                                input.click();
                                            }}
                                            className="flex items-center gap-3 px-4 py-3 bg-white border border-rose-100 rounded-xl hover:bg-rose-50 transition-colors"
                                        >
                                            <div className="size-8 bg-rose-50 rounded-full flex items-center justify-center">
                                                <Camera className="size-4 text-rose-500" />
                                            </div>
                                            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Open Camera</span>
                                        </button>
                                    </div>

                                    {input.imageUrl && (
                                        <div className="relative size-24 rounded-2xl overflow-hidden border border-zinc-200 group">
                                            <img src={input.imageUrl} alt="Preview" className="size-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => handleInputChange(item.id, 'imageUrl', '')}
                                                className="absolute top-2 right-2 size-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-opacity shadow-lg"
                                            >
                                                <span className="text-xl font-light">×</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {config.instructions && (
                            <p className="text-[10px] text-zinc-400 italic">
                                Note: {config.instructions}
                            </p>
                        )}
                    </div>
                );
            })}

            <div className="pt-2">
                <ActionSlider
                    onConfirm={handleSubmit}
                    label="Slide to submit details"
                    successLabel="Sent to partner"
                    isLoading={isSubmitting}
                    variant="amber"
                />
                <p className="text-[10px] text-zinc-400 text-center mt-3 uppercase tracking-widest font-bold">
                    Partner will share a preview for your approval
                </p>
            </div>
        </div>
    );
}
