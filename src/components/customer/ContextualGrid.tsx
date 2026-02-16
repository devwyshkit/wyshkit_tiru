
import React from 'react';
import { cn } from '@/lib/utils';

interface ContextualGridProps {
  children: React.ReactNode;
  variant?: 'partners' | 'essentials' | 'items' | 'auto';
  className?: string;
}

/**
 * ContextualGrid implements the Wyshkit 2026 "Dynamic Density" system.
 * - Partners: 2 cols mobile, 4-5 cols desktop (Wyshkit 2026 Discovery)
 * - Essentials: 2 cols mobile, 6 cols desktop (High density utility)
 * - Items: 2 cols mobile, 4-5 cols desktop (Premium detail)
 */
export function ContextualGrid({
  children,
  variant = 'auto',
  className
}: ContextualGridProps) {
  const gridClasses = {
    partners: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6",
    essentials: "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3",
    items: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6",
    auto: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6"
  };

  return (
    <div className={cn(gridClasses[variant], className)}>
      {children}
    </div>
  );
}
