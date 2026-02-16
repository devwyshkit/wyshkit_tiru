'use client';

import React from 'react';
import Link, { LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';

interface MorphLinkProps extends LinkProps {
    children: React.ReactNode;
    className?: string;
    morphId?: string;
    morphName?: string;
}

/**
 * WYSHKIT 2026: MorphLink - Native View Transitions
 * 
 * Swiggy 2026 Pattern: Low-Jitter Navigation
 * - Intercepts navigation to trigger native CSS View Transitions.
 * - Bridges Next.js router with browser's startViewTransition API.
 * - Zero dependency (Native API).
 */
export function MorphLink({
    children,
    className,
    morphId,
    morphName = 'morph',
    ...props
}: MorphLinkProps) {
    const router = useRouter();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Check for browser support and handle cmd/ctrl/shift clicks normally
        if (
            typeof document !== 'undefined' &&
            'startViewTransition' in document &&
            !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0
        ) {
            e.preventDefault();

            // WYSHKIT 2026: Native View Transition Bridge
            (document as any).startViewTransition(async () => {
                await router.push(props.href as string);
            });
        }
    };

    return (
        <Link {...props} className={className} onClick={handleClick}>
            {children}
        </Link>
    );
}
