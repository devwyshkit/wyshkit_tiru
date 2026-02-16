"use client";

import { Search, Package, AlertCircle, type LucideIcon } from "lucide-react";
import { Button } from"@/components/ui/button";
import { cn } from"@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = AlertCircle,
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700",
      className
    )}>
      <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6 relative">
        <Icon className="w-10 h-10 text-muted-foreground" />
        <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse" />
      </div>

      <div className="space-y-2 max-w-xs mx-auto">
        <h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
          {description}
        </p>
      </div>

      {children}

      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="mt-8 rounded-2xl px-8 font-black uppercase tracking-tight h-12 shadow-lg shadow-primary/20 active:scale-95 transition-all"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
