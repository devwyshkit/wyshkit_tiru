'use client';

import { useState, useEffect, useRef, useMemo, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from 'next/image';
import { Search, X, Loader2, ArrowLeft, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchFiltered } from "@/lib/actions/search";
import type { Tables } from "@/lib/supabase/database.types";
import { logger } from '@/lib/logging/logger';
import { PartnerCard } from "@/components/customer/PartnerCard";

interface SearchPageClientProps {
  searchParams: Promise<{ q?: string; category?: string }>;
  initialResults?: {
    items: Tables<'v_item_listings'>[];
    partners: Tables<'v_partners_detailed'>[];
    total: number;
  };
}

/**
 * WYSHKIT 2026: Intent-Based Search Page Client Component
 * Swiggy 2026 Pattern: "Data Should Come to User, Not User Go to Data"
 * - Receives initialResults from Server Component (data comes to user)
 * - Only fetches new data when query changes (debounced) - progressive enhancement
 * - No client-side waterfall on initial load
 */
export function SearchPageClient({ searchParams, initialResults }: SearchPageClientProps) {
  const router = useRouter();
  const urlSearchParams = useSearchParams(); // For real-time URL reading

  // WYSHKIT 2026: React 19 use() hook for Promise (requires Suspense boundary)
  const params = use(searchParams);
  const initialQuery = params.q || '';
  const initialCategory = params.category || '';

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // WYSHKIT 2026: Use server-provided initial results (data comes to user)
  const [results, setResults] = useState<{
    items: Tables<'v_item_listings'>[];
    partners: Tables<'v_partners_detailed'>[];
  }>(() => ({
    items: initialResults?.items || [],
    partners: initialResults?.partners || [],
  }));

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // WYSHKIT 2026: Sync with URL params (for browser back/forward)
  useEffect(() => {
    const urlQ = urlSearchParams.get('q') || '';
    const urlCategory = urlSearchParams.get('category') || '';

    if (urlQ !== query) {
      setQuery(urlQ);
      setDebouncedQuery(urlQ);
    }
    if (urlCategory !== category) {
      setCategory(urlCategory);
    }
  }, [urlSearchParams, query, category]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // WYSHKIT 2026: Update URL when query/category changes (intent-based navigation)
  useEffect(() => {
    const urlQ = urlSearchParams.get('q') || '';
    const urlCategory = urlSearchParams.get('category') || '';

    if (debouncedQuery !== urlQ || category !== urlCategory) {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (category) params.set('category', category);

      const url = params.toString() ? `/search?${params.toString()}` : '/search';
      router.replace(url, { scroll: false });
    }
  }, [debouncedQuery, category, router, urlSearchParams]);

  // WYSHKIT 2026: Only fetch new data when query changes (progressive enhancement)
  // Initial data comes from Server Component - no waterfall on first load
  useEffect(() => {
    const searchQuery = debouncedQuery.trim();
    const shouldSearch = (searchQuery.length >= 2 || category) &&
      (searchQuery !== initialQuery || category !== initialCategory);

    if (!shouldSearch) {
      // Use initial results if no new search
      if (initialResults) {
        setResults({
          items: initialResults.items,
          partners: initialResults.partners,
        });
      }
      return;
    }

    let cancelled = false;

    async function fetchNewResults() {
      setIsLoading(true);
      setError(null);

      try {
        const newResults = await searchFiltered({
          q: searchQuery.length >= 2 ? searchQuery : undefined,
          category: category || undefined,
          limit: 20,
        });

        if (!cancelled) {
          setResults({
            items: newResults.items,
            partners: newResults.partners,
          });
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('Search failed');
          logger.error('Search failed', error, { query: debouncedQuery, category });
          setError(error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchNewResults();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, category, initialQuery, initialCategory, initialResults]);

  const hasResults = results.items.length > 0 || results.partners.length > 0;
  const hasActiveFilters = debouncedQuery || category;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-zinc-100 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="size-9 rounded-lg shrink-0"
        >
          <ArrowLeft className="size-5 text-zinc-600" />
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search items, stores..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 bg-zinc-50 border-zinc-100 text-sm rounded-lg"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="size-4 text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      {/* WYSHKIT 2026: Show active category filter */}
      {category && (
        <div className="px-4 py-2 border-b border-zinc-100 bg-zinc-50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600">Category:</span>
            <span className="text-xs text-zinc-900 capitalize">{category}</span>
            <button
              onClick={() => {
                setCategory('');
                const params = new URLSearchParams();
                if (debouncedQuery) params.set('q', debouncedQuery);
                const url = params.toString() ? `/search?${params.toString()}` : '/search';
                router.replace(url, { scroll: false });
              }}
              className="ml-auto text-xs text-zinc-500 hover:text-zinc-900"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-zinc-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-zinc-500">Search failed. Please try again.</p>
          </div>
        ) : !hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="size-10 text-zinc-200 mb-4" />
            <p className="text-sm font-semibold text-zinc-400">Search for items or stores</p>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="size-8 text-zinc-200 mb-3" />
            <p className="text-sm font-medium text-zinc-500">
              No results {debouncedQuery ? `for "${debouncedQuery}"` : ''}
              {category && ` in ${category}`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {results.partners.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-400 mb-3">Stores</p>
                <div className="space-y-2">
                  {results.partners.map((partner) => (
                    <PartnerCard
                      key={partner.id as any}
                      id={partner.id as any}
                      name={(partner.name as any) || 'Store'}
                      city={(partner.city as any) || 'City'}
                      imageUrl={partner.image_url ?? '/images/logo.png'}
                      rating={partner.rating as any}
                      variant="row"
                    />
                  ))}
                </div>
              </div>
            )}

            {results.items.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-400 mb-3">Items</p>
                <div className="space-y-2">
                  {results.items.map((item) => {
                    // WYSHKIT 2026: Use route-based navigation
                    const partnerId = (item as any).partnerId || (item as any).partner_id;
                    const handleClick = () => {
                      if (partnerId) {
                        router.push(`/partner/${partnerId}?item=${item.id}`);
                      } else {
                        router.push(`/search?q=${encodeURIComponent((item.name as string) || '')}`);
                      }
                    };

                    return (
                      <button
                        key={item.id as any}
                        onClick={handleClick}
                        className="w-full flex items-center gap-3 p-3 bg-zinc-50 rounded-xl hover:bg-zinc-100 transition-colors text-left"
                      >
                        <div className="size-12 rounded-lg overflow-hidden shrink-0 bg-zinc-50 relative border border-zinc-100">
                          <Image src={(item.images as any)?.[0] ?? '/images/logo.png'} alt={(item.name as any) || 'Item'} fill className="object-cover" sizes="48px" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{item.name as any}</p>
                          <p className="text-xs text-zinc-500">{(item.partner_name || 'Store')} · ₹{item.base_price}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
