'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

/**
 * Home Empty State (Client Component)
 * Shows when no content is available - Wyshkit 2026: Clear messaging
 */
export function HomeEmptyState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="size-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
        <RefreshCw className="size-7 text-zinc-400" />
      </div>
      <p className="text-sm font-medium text-zinc-900 mb-2">No content available</p>
      <p className="text-xs text-zinc-500 mb-4 max-w-sm">
        Check back later or refresh the page to see the latest items
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.refresh()}
        className="h-9 text-xs border-zinc-200 text-zinc-600 hover:bg-zinc-50"
      >
        <RefreshCw className="size-3 mr-1.5" />
        Refresh page
      </Button>
    </div>
  );
}
