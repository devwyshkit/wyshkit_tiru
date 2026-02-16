'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';

interface ActionSliderProps {
    onConfirm: () => void;
    label?: string;
    successLabel?: string;
    className?: string;
    disabled?: boolean;
    isLoading?: boolean;
    variant?: 'default' | 'success' | 'amber';
}

export function ActionSlider({
    onConfirm,
    label = "Slide to confirm",
    successLabel = "Confirmed",
    className,
    disabled = false,
    isLoading = false,
    variant = 'default'
}: ActionSliderProps) {
    const [isSuccess, setIsSuccess] = useState(false);
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const [maxDrag, setMaxDrag] = useState(240); // default fallback

    // Update max drag based on container width
    useEffect(() => {
        if (containerRef.current) {
            const updateMaxDrag = () => {
                const containerWidth = containerRef.current?.offsetWidth || 0;
                const handleWidth = 48; // aspect-square sizing
                setMaxDrag(containerWidth - handleWidth - 8); // 8px for padding/gap
            };
            updateMaxDrag();
            window.addEventListener('resize', updateMaxDrag);
            return () => window.removeEventListener('resize', updateMaxDrag);
        }
    }, []);

    const [isTouch, setIsTouch] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        setIsTouch(window.matchMedia('(pointer: coarse)').matches);
    }, []);

    const textOpacity = Math.max(0, 1 - dragX / (maxDrag * 0.7));

    useEffect(() => {
        if (isSuccess) {
            triggerHaptic(HapticPattern.SUCCESS);
            const timer = setTimeout(() => {
                setIsSuccess(false);
                setDragX(0);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isSuccess]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (disabled || isLoading || isSuccess) return;
        setIsDragging(true);
        setStartX(e.clientX - dragX);
        if (handleRef.current) {
            handleRef.current.setPointerCapture(e.pointerId);
        }
    }, [disabled, isLoading, isSuccess, dragX]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging || disabled || isLoading || isSuccess) return;
        const newX = e.clientX - startX;
        const clampedX = Math.max(0, Math.min(maxDrag, newX));
        setDragX(clampedX);
    }, [isDragging, disabled, isLoading, isSuccess, startX, maxDrag]);

    const handlePointerUp = useCallback(async () => {
        if (!isDragging || disabled || isLoading || isSuccess) {
            setIsDragging(false);
            return;
        }

        // 70% threshold for confirmation
        if (dragX > maxDrag * 0.7) {
            setDragX(maxDrag);
            setIsSuccess(true);
            onConfirm();
        } else {
            setDragX(0);
        }
        setIsDragging(false);
    }, [isDragging, disabled, isLoading, isSuccess, dragX, maxDrag, onConfirm]);

    // SWIGGY 2026: Desktop fallback for better accessibility
    if (isMounted && !isTouch) {
        return (
            <button
                disabled={disabled || isLoading || isSuccess}
                onClick={onConfirm}
                className={cn(
                    "relative h-14 w-full rounded-2xl font-black uppercase tracking-widest transition-all duration-300",
                    isSuccess ? "bg-emerald-500 text-white" : variant === 'amber' ? "bg-amber-500 text-white" : "bg-zinc-900 text-white",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    (disabled || isLoading) && "opacity-60 cursor-not-allowed",
                    className
                )}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                        <Loader2 className="size-5 animate-spin" />
                        <span>Processing...</span>
                    </div>
                ) : isSuccess ? (
                    <div className="flex items-center justify-center gap-2">
                        <Check className="size-5" />
                        <span>{successLabel}</span>
                    </div>
                ) : (
                    label
                )}
            </button>
        );
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative h-14 w-full bg-zinc-100 rounded-2xl overflow-hidden p-1 select-none transition-colors duration-300",
                disabled || isLoading ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                isSuccess ? "bg-emerald-500" : "",
                variant === 'amber' && !isSuccess ? "bg-amber-50" : "",
                className
            )}
            onClick={() => {
                // High intent click fallback for touch devices too (just in case)
                if (!disabled && !isLoading && !isSuccess && !isDragging && dragX === 0) {
                    onConfirm();
                }
            }}
        >
            {/* Static Text - Clickable on Desktop */}
            <div
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                onClick={(e) => {
                    // WYSHKIT 2026: Desktop "Click to Swipe" pattern
                    if (!isSuccess && !isLoading && !disabled) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const threshold = maxDrag * 0.7; // Use the same threshold as drag
                        if (clickX > 52) { // handleSize
                            setDragX(threshold);
                            setIsSuccess(true);
                            triggerHaptic(HapticPattern.SUCCESS);
                            onConfirm?.();
                        }
                    }
                }}
            >
                <div
                    className="flex items-center gap-3 transition-opacity duration-150"
                    style={{ opacity: textOpacity }}
                >
                    <ChevronRight className="size-4 text-zinc-300 animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 select-none">
                        {label}
                    </span>
                </div>
            </div>

            {/* Progress Track */}
            <div
                className={cn(
                    "absolute left-0 top-0 bottom-0 pointer-events-none transition-all duration-75",
                    isSuccess ? "bg-emerald-600" : variant === 'amber' ? "bg-amber-200" : "bg-zinc-200"
                )}
                style={{ width: `${dragX + 24}px` }}
            />

            {/* Handle */}
            {!isSuccess && !isLoading && (
                <div
                    ref={handleRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className={cn(
                        "absolute left-1 top-1 bottom-1 aspect-square rounded-xl flex items-center justify-center shadow-lg z-10 transition-transform duration-150",
                        isDragging ? "scale-95 cursor-grabbing" : "cursor-grab",
                        variant === 'amber' ? "bg-amber-500" : "bg-zinc-900"
                    )}
                    style={{
                        transform: `translateX(${dragX}px)`,
                        touchAction: 'none',
                    }}
                >
                    <ChevronRight className="size-5 text-white" />
                </div>
            )}

            {/* Loading/Success Icon */}
            {(isLoading || isSuccess) && (
                <div
                    className="absolute left-1 top-1 bottom-1 aspect-square bg-white rounded-xl flex items-center justify-center shadow-lg z-10 transition-all duration-300"
                    style={{ transform: isSuccess ? `translateX(${maxDrag}px)` : 'none' }}
                >
                    {isLoading ? (
                        <Loader2 className="size-5 text-zinc-900 animate-spin" />
                    ) : (
                        <Check className="size-5 text-emerald-600" />
                    )}
                </div>
            )}
        </div>
    );
}
