'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Minus, Star, Check, Loader2, ChevronDown, Sparkles, Info, Globe, PlayCircle, Clock, Factory, ShieldCheck, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { createClient } from '@/lib/supabase/client';
import { getUpsellItems } from '@/lib/actions/item-actions';
import { useCart } from '@/components/customer/CartProvider';
import { UpsellGrid } from '@/components/features/UpsellGrid';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';
import { Package, ChevronRight, AlertTriangle } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const FALLBACK_IMAGE = '/images/logo.png';

import { ItemWithFullSpec } from '@/lib/supabase/types';

interface ItemDetailViewProps {
    item: ItemWithFullSpec;
    onBack?: () => void;
    /** When in sheet from partner page, pass for optional View cart CTA. */
    partnerId?: string;
}

export function ItemDetailView({ item, onBack, partnerId }: ItemDetailViewProps) {
    const router = useRouter();

    const { addToDraftOrder, clearDraftOrder, isPending, draftOrder } = useCart();
    const [continuing, setContinuing] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
        item.variants?.length ? String(item.variants[0].id) : null
    );
    const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    // WYSHKIT 2026: Always show description for better product context
    const [showDescription, setShowDescription] = useState(true);
    const [upsellItems, setUpsellItems] = useState<any[]>([]);
    const [showReplaceCartDialog, setShowReplaceCartDialog] = useState(false);

    useEffect(() => {
        // WYSHKIT 2026: Analytics or side-effects can go here
    }, [item]);

    const handleBack = useCallback(() => {
        if (onBack) onBack();
        else router.back();
    }, [onBack, router]);

    // When item has variants and none selected yet, default to first (e.g. after sheet data loads)
    useEffect(() => {
        const variants = Array.isArray(item?.variants) ? item.variants : [];
        if (variants.length > 0 && selectedVariantId == null) {
            setSelectedVariantId(String(variants[0].id));
        }
    }, [item?.variants, selectedVariantId]);

    useEffect(() => {
        async function loadUpsell() {
            const { data } = await getUpsellItems(item.id, item.partner_id!, item.category || '');
            setUpsellItems(data || []);
        }
        loadUpsell();
    }, [item]);

    // WYSHKIT 2026: Normalize so sheet works even if API returns single object or null
    const variantsArray = Array.isArray(item?.variants) ? item.variants : [];
    const addonsArray = Array.isArray(item?.item_addons) ? item.item_addons : [];

    const selectedVariant = useMemo(() => {
        return variantsArray.find((v: any) => String(v.id) === selectedVariantId) || null;
    }, [variantsArray, selectedVariantId]);

    const selectedAddons = useMemo(() => {
        return addonsArray.filter((addon: any) => selectedAddonIds.has(addon.id));
    }, [addonsArray, selectedAddonIds]);

    const canAdd = variantsArray.length === 0 || selectedVariantId != null;

    const unitPrice = useMemo(() => {
        const basePrice = Number(item.base_price) || 0;
        const variantPrice = Number(selectedVariant?.price) || 0;
        const addonsSum = selectedAddons.reduce((sum: number, addon: any) => sum + (Number(addon.price) || 0), 0);

        // WYSHKIT 2026: Pricing Integrity - unitPrice is (base + variant + addons)
        return basePrice + variantPrice + addonsSum;
    }, [item.base_price, selectedVariant, selectedAddons]);

    const totalPrice = unitPrice * quantity;

    const handleAddToCart = async () => {
        if (continuing) return;

        // WYSHKIT 2026: Synchronous Partner Check (Prevent optimistic close on mismatch)
        const currentPartnerId = draftOrder?.partnerId;
        const itemPartnerId = item.partner_id || item.partners?.slug; // Using slug as fallback ID? No, should be ID.
        // Wait, item.partners does not have ID in ItemWithFullSpec, it's Pick<Partner, ...>
        // We need to use item.partner_id which is on ItemWithFullSpec (Item)

        if (currentPartnerId && item.partner_id && currentPartnerId !== item.partner_id && (draftOrder?.items?.length || 0) > 0) {
            setShowReplaceCartDialog(true);
            return;
        }

        setContinuing(true);

        const itemImage = (item.images && Array.isArray(item.images) && item.images[0]) || FALLBACK_IMAGE;

        try {
            const result = await addToDraftOrder(
                item.id,
                selectedVariantId,
                { enabled: false },
                selectedAddons.map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    price: a.price,
                    requires_preview: a.requires_preview
                })),
                quantity,
                {
                    itemName: item.name,
                    itemImage: item.images?.[0] || FALLBACK_IMAGE,
                    unitPrice: unitPrice,
                    partnerId: item.partner_id!, // We know it exists if we are here
                    partnerName: item.partners?.name || item.partners?.display_name || partnerId,
                }
            );

            if ('success' in result && result.success) {
                // WYSHKIT 2026: Tactile commitment
                triggerHaptic(HapticPattern.SUCCESS);
                handleBack();
            } else if ('code' in result && result.code === 'PARTNER_MISMATCH') {
                setShowReplaceCartDialog(true);
            } else if ('code' in result && result.code === 'VARIANT_REQUIRED') {
                toast.error(result.error || 'Please select an option');
            } else if ('error' in result) {
                toast.error(result.error || "Could not add to cart");
            }
        } catch (err) {
            toast.error("Something went wrong");
        } finally {
            setContinuing(false);
        }
    };

    const handleReplaceCart = async () => {
        setShowReplaceCartDialog(false);
        setContinuing(true);
        try {
            await clearDraftOrder();
            await clearDraftOrder();
            // WYSHKIT 2026: Type-safe optimistic data with null checks
            const partnerName = item.partners?.name || item.partners?.display_name || null;
            const itemImage = (item.images && Array.isArray(item.images) && item.images[0]) || FALLBACK_IMAGE;

            const result = await addToDraftOrder(
                item.id,
                selectedVariantId,
                { enabled: false },
                selectedAddons.map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    price: a.price,
                    requires_preview: a.requires_preview
                })),
                quantity,
                {
                    itemName: item.name || 'Item',
                    itemImage,
                    unitPrice: unitPrice || 0,
                    partnerId: item.partner_id || undefined,
                    partnerName: partnerName || undefined,
                }
            );
            if ('success' in result && result.success) {
                // fly({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, itemImage);
                // toast.success(`Added ${item.name || 'item'} to cart`);
                // WYSHKIT 2026: "Reveal Store" - Navigate to partner page and close sheet
                if (item.partner_id) {
                    router.replace(`/partner/${item.partner_id}`, { scroll: false });
                } else {
                    handleBack();
                }
            } else if ('error' in result) {
                toast.error(result.error ?? 'Could not add to cart');
            }
        } catch {
            toast.error('Something went wrong');
        } finally {
            setContinuing(false);
        }
    };

    const images = useMemo(() => {
        if (selectedVariant?.images?.length) return selectedVariant.images;
        if (item.images?.length) return item.images;
        return [FALLBACK_IMAGE];
    }, [selectedVariant, item.images]);

    return (
        <>
            <AlertDialog open={showReplaceCartDialog} onOpenChange={setShowReplaceCartDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Different store</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your cart has items from another store. To add from this store, start a new cart. Your current cart will be cleared.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep current cart</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReplaceCart}
                            className="bg-[#D91B24] hover:bg-[#c01820]"
                        >
                            Start new cart & add
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex flex-col flex-1 min-h-0 bg-white font-sans">
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
                    {/* Image Section - Compact aspect for No-Scroll Rule */}
                    <div className="relative bg-white w-full aspect-[16/9] md:aspect-square max-h-[35vh] md:max-h-none">
                        <div
                            className="w-full h-full flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                            onScroll={(e) => {
                                const width = e.currentTarget.offsetWidth;
                                const scrollLeft = e.currentTarget.scrollLeft;
                                const index = Math.round(scrollLeft / width);
                                if (index !== activeImageIndex) {
                                    setActiveImageIndex(index);
                                }
                            }}
                        >
                            {(images && images.length > 0 ? images : [FALLBACK_IMAGE]).map((img: string, idx: number) => (
                                <div key={idx} className="w-full h-full min-w-full flex-shrink-0 snap-center snap-always relative bg-zinc-100">
                                    <ImageWithFallback
                                        src={img || FALLBACK_IMAGE}
                                        alt={`${item.name} - Image ${idx + 1}`}
                                        fill
                                        className="object-cover"
                                        priority={idx === 0}
                                        sizes="100vw"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* WYSHKIT 2026: Video Showreel Trigger */}
                        {item.video_url && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.video_url!, '_blank');
                                }}
                                className="absolute top-4 right-4 z-10 size-10 rounded-full bg-white/90 backdrop-blur-sm shadow-xl flex items-center justify-center hover:bg-white active:scale-95 transition-all text-zinc-900"
                            >
                                <PlayCircle className="size-6" />
                            </button>
                        )}

                        {/* Navigation Dots */}
                        {images.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 p-1.5 rounded-full bg-black/20 backdrop-blur-sm">
                                {images.map((_img: string, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setActiveImageIndex(idx);
                                            // Note: Programmatic scroll would require a ref to the container
                                            // For now, dots just indicate state on swipe, or we can add ref implementation if needed.
                                            // Ideally, we should scroll the container.
                                            // Let's add a ref to the container to support click-to-nav.
                                        }}
                                        className={cn(
                                            "w-1.5 h-1.5 rounded-full transition-all",
                                            idx === activeImageIndex
                                                ? "bg-white w-3"
                                                : "bg-white/50 hover:bg-white/80"
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="px-4 py-5 space-y-5">
                        <div className="space-y-1">
                            {item.brand && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                                    {item.brand}
                                </div>
                            )}
                            <h1 className="text-xl font-semibold text-zinc-900 leading-tight tracking-tight">
                                {item.name}
                            </h1>
                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                                {item.partners?.name && (
                                    <>
                                        <span className="font-medium">{item.partners.name}</span>
                                        <span className="text-zinc-300">•</span>
                                    </>
                                )}
                                {((item.rating || item.partners?.rating) ?? 0) > 0 && (
                                    <div className="flex items-center gap-1 bg-emerald-600 px-1.5 py-0.5 rounded-md">
                                        <span className="text-[11px] font-bold text-white">
                                            {((item.rating || item.partners?.rating) ?? 0).toFixed(1)}
                                        </span>
                                        <Star className="size-2.5 fill-white text-white" />
                                    </div>
                                )}
                                {item.preview_time_minutes && (
                                    <>
                                        <span className="text-zinc-300">•</span>
                                        <div className="flex items-center gap-1 text-emerald-600 font-bold">
                                            <Loader2 className="size-3 animate-pulse" />
                                            <span>{item.preview_time_minutes} min preview</span>
                                        </div>
                                    </>
                                )}
                                {item.production_time_minutes && (
                                    <>
                                        <span className="text-zinc-300">•</span>
                                        <div className="flex items-center gap-1 text-zinc-600 font-bold">
                                            <Package className="size-3" />
                                            <span>{Math.round(item.production_time_minutes / 60)} hr prep</span>
                                        </div>
                                    </>
                                )}
                                {item.is_perishable && item.shelf_life_hours && (
                                    <>
                                        <span className="text-zinc-300">•</span>
                                        <div className="flex items-center gap-1 text-orange-600 font-bold">
                                            <Clock className="size-3" />
                                            <span>Best for {Math.round(item.shelf_life_hours / 24)}d</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-zinc-900 tracking-tight">₹{unitPrice}</span>
                                {item.mrp && item.mrp > unitPrice && (
                                    <span className="text-sm text-zinc-400 line-through">₹{item.mrp}</span>
                                )}
                            </div>
                            {item.mrp && item.mrp > unitPrice && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                                    {Math.round(((item.mrp - unitPrice) / item.mrp) * 100)}% SAVING
                                </span>
                            )}
                        </div>
                        {/* WYSHKIT 2026: Tax & Inventory Info */}
                        <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500">
                            <span>Inclusive of {item.gst_percentage || 18}% GST</span>
                            {/* WYSHKIT 2026: Use variant stock if available, fallback to item-level */}
                            {(() => {
                                const activeStock = selectedVariant?.stock_quantity ?? item.stock_quantity;
                                const threshold = item.low_stock_threshold || 5;
                                if (activeStock !== null && activeStock !== undefined && activeStock < threshold) {
                                    return (
                                        <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                            <AlertTriangle className="size-3" />
                                            Only {activeStock} left!
                                        </span>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        {variantsArray.length > 0 && (
                            <div className="space-y-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-zinc-900 tracking-tight">
                                        {/* WYSHKIT 2026: Dynamic Label */}
                                        {item.category === 'cake' ? 'Select weight' : 'Select option'}
                                    </p>
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-lg uppercase tracking-wider">Required</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {variantsArray.map((v: any) => (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVariantId(String(v.id))}
                                            className={cn(
                                                "px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                                                selectedVariantId === String(v.id)
                                                    ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200"
                                                    : "bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200/60"
                                            )}
                                        >
                                            {v.name}
                                            {(v.price ?? 0) > 0 && <span className="ml-1 text-xs opacity-70">+₹{v.price}</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* WYSHKIT 2026: Add-ons (Personalization & Extras) */}
                        {addonsArray.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-zinc-900 tracking-tight">
                                        Add-ons
                                    </p>
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Optional</span>
                                </div>
                                <div className="space-y-2">
                                    {addonsArray.map((addon: any) => {
                                        const isSelected = selectedAddonIds.has(addon.id);
                                        return (
                                            <button
                                                key={addon.id}
                                                onClick={() => {
                                                    const next = new Set(selectedAddonIds);
                                                    if (next.has(addon.id)) next.delete(addon.id);
                                                    else next.add(addon.id);
                                                    setSelectedAddonIds(next);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left",
                                                    isSelected
                                                        ? "bg-zinc-900 border-zinc-900 text-white"
                                                        : "bg-white border-zinc-100 text-zinc-700 hover:border-zinc-200"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "size-5 rounded-md border flex items-center justify-center transition-colors",
                                                        isSelected ? "bg-white border-white" : "border-zinc-300"
                                                    )}>
                                                        {isSelected && <Check className="size-3.5 text-zinc-900" />}
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-semibold block">{addon.name}</span>
                                                        {addon.requires_preview && (
                                                            <span className={cn("text-[10px] uppercase font-bold tracking-wide opacity-80", isSelected ? "text-purple-200" : "text-purple-600")}>
                                                                Personalization
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="font-bold text-sm">
                                                    +₹{addon.price}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* WYSHKIT 2026: Product Specifications & Return Policy */}
                        <div className="pt-4 border-t border-zinc-100 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Product Details</h3>
                                    <ChevronRight className="size-3.5 text-zinc-300" />
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-lg border",
                                    item.return_eligible
                                        ? "bg-blue-50 border-blue-100 text-blue-700"
                                        : "bg-orange-50 border-orange-100 text-orange-700"
                                )}>
                                    <Info className="size-3" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                        {item.return_eligible ? '7-day Return' : 'Non-returnable'}
                                    </span>
                                </div>
                                {item.fragile && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-rose-50 border-rose-100 text-rose-700">
                                        <Package className="size-3" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Fragile</span>
                                    </div>
                                )}
                            </div>
                            {item.packaging_type && (
                                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Packaging</p>
                                    <div className="flex items-center gap-1.5">
                                        <Package className="size-3.5 text-zinc-400" />
                                        <p className="text-sm font-medium text-zinc-900">{item.packaging_type}</p>
                                    </div>
                                </div>
                            )}

                            {/* WYSHKIT 2026: High-Trust Compliance Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {item.country_of_origin && (
                                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Origin</p>
                                        <div className="flex items-center gap-1.5 text-zinc-900">
                                            <Globe className="size-3.5 text-blue-500" />
                                            <p className="text-sm font-medium">{item.country_of_origin}</p>
                                        </div>
                                    </div>
                                )}
                                {(item.fssai_license || item.partners?.fssai_license) && (
                                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">FSSAI License</p>
                                        <div className="flex items-center gap-1.5 text-zinc-900">
                                            <ShieldCheck className="size-3.5 text-emerald-500" />
                                            <p className="text-sm font-medium">{item.fssai_license || item.partners?.fssai_license}</p>
                                        </div>
                                    </div>
                                )}
                                {item.partners?.gstin && (
                                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Partner GSTIN</p>
                                        <div className="flex items-center gap-1.5 text-zinc-900">
                                            <Check className="size-3.5 text-zinc-400" />
                                            <p className="text-sm font-medium uppercase">{(item.partners as any).gstin}</p>
                                        </div>
                                    </div>
                                )}
                                {item.manufacturer_info && (
                                    <div className="col-span-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Manufacturer/Packer</p>
                                        <div className="flex items-start gap-1.5 text-zinc-600">
                                            <Factory className="size-3.5 mt-0.5 flex-shrink-0" />
                                            <p className="text-[13px] leading-tight italic">{item.manufacturer_info}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {(item.weight_kg || item.weight_grams) && (
                                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Weight</p>
                                        <p className="text-sm font-medium text-zinc-900">
                                            {item.weight_kg ? `${item.weight_kg} kg` : `${item.weight_grams} g`}
                                        </p>
                                    </div>
                                )}
                                {(item.length_cm || item.width_cm || item.height_cm) && (
                                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Dimensions</p>
                                        <p className="text-sm font-medium text-zinc-900">
                                            {item.length_cm || 0} x {item.width_cm || 0} x {item.height_cm || 0} cm
                                        </p>
                                    </div>
                                )}
                                {item.material && (
                                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Material</p>
                                        <p className="text-sm font-medium text-zinc-900">{item.material}</p>
                                    </div>
                                )}
                                {item.capacity && (
                                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Size/Capacity</p>
                                        <p className="text-sm font-medium text-zinc-900">{item.capacity}</p>
                                    </div>
                                )}
                                {item.care_instructions && (
                                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Care</p>
                                        <p className="text-sm font-medium text-zinc-900">{item.care_instructions}</p>
                                    </div>
                                )}
                                {item.hsn_code && (
                                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Tax/HSN</p>
                                        <p className="text-sm font-medium text-zinc-900">HSN: {item.hsn_code}</p>
                                    </div>
                                )}
                                {item.specifications && Object.entries(item.specifications).map(([key, value]) => (
                                    <div key={key} className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{key}</p>
                                        <p className="text-sm font-medium text-zinc-900">{value as string}</p>
                                    </div>
                                ))}
                            </div>

                            {item.description && (
                                <div className="pt-2">
                                    <button
                                        onClick={() => setShowDescription(!showDescription)}
                                        className="w-full flex items-center justify-between py-2"
                                    >
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider uppercase">More info</span>
                                        <ChevronDown className={cn("size-3.5 text-zinc-400 transition-transform", showDescription && "rotate-180")} />
                                    </button>
                                    {showDescription && (
                                        <p className="text-[13px] text-zinc-600 leading-relaxed pt-1 pb-1">{item.description}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {upsellItems.length > 0 && (
                            <UpsellGrid
                                items={upsellItems.map(u => ({
                                    id: u.id,
                                    name: u.name,
                                    price: u.base_price || u.price,
                                    image_url: u.images?.[0] || FALLBACK_IMAGE
                                }))}
                                title="Pairs well with"
                                onAdd={async (u) => {
                                    const optimisticData = {
                                        itemName: u.name,
                                        itemImage: u.image_url,
                                        unitPrice: u.price,
                                        partnerId: item.partner_id || undefined,
                                        partnerName: item.partners?.name || item.partners?.display_name || undefined,
                                    };
                                    const res = await addToDraftOrder(u.id, null, { enabled: false }, [], 1, optimisticData);
                                    if ('success' in res && res.success) toast.success(`Added ${u.name}`);
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Static Footer */}
                <div className="bg-white px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(0_0_0/0.04)] border-t border-zinc-50 shrink-0">
                    {draftOrder && draftOrder.itemCount > 0 && (
                        <button
                            type="button"
                            onClick={() => { onBack?.(); router.push('/checkout'); }}
                            className="w-full mb-3 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-sm font-semibold text-zinc-900 flex items-center justify-between transition-colors"
                        >
                            <span>View cart · {draftOrder.itemCount} {draftOrder.itemCount === 1 ? 'item' : 'items'}</span>
                            <span className="tabular-nums">₹{draftOrder.total?.toFixed(0) ?? 0}</span>
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-zinc-100 rounded-xl">
                            <button
                                className="size-11 flex items-center justify-center rounded-l-xl hover:bg-zinc-200 active:bg-zinc-300 transition-colors disabled:opacity-40"
                                onClick={() => {
                                    setQuantity(Math.max(1, quantity - 1));
                                    triggerHaptic(HapticPattern.ACTION);
                                }}
                                disabled={quantity <= 1 || continuing}
                            >
                                <Minus className="size-4 text-zinc-700" />
                            </button>
                            <span className="w-10 text-center text-base font-semibold text-zinc-900 tabular-nums">
                                {quantity}
                            </span>
                            <button
                                className="size-11 flex items-center justify-center rounded-r-xl hover:bg-zinc-200 active:bg-zinc-300 transition-colors disabled:opacity-40"
                                onClick={() => {
                                    setQuantity(quantity + 1);
                                    triggerHaptic(HapticPattern.ACTION);
                                }}
                                disabled={continuing}
                            >
                                <Plus className="size-4 text-zinc-700" />
                            </button>
                        </div>

                        <button
                            className="flex-1 h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-[15px] rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleAddToCart}
                            disabled={continuing || !canAdd}
                        >
                            {continuing ? (
                                <Loader2 className="size-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Add</span>
                                    <span className="text-white/60">•</span>
                                    <span>₹{totalPrice}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
