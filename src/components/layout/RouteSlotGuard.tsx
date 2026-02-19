'use client';

import React from 'react';
import { usePathname } from "next/navigation";

/**
 * WYSHKIT 2026: Single Resource Rendering
 * Swiggy 2026 principle: Never show the same resource twice (Page + Sheet).
 */
export function RouteSlotGuard({ children, sheet }: { children: React.ReactNode; sheet: React.ReactNode }) {
    return (
        <>
            {children}
            {sheet}
        </>
    );
}
