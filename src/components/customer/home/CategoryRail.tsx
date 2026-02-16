import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LayoutGrid } from 'lucide-react';

const FALLBACK_IMAGE = '/images/logo.png';

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface CategoryRailProps {
  categories: Category[];
  selectedCategory?: string | null;
}

export function CategoryRail({
  categories = [],
  selectedCategory = null,
}: CategoryRailProps) {
  if (!categories || !Array.isArray(categories) || categories.length === 0) return null;

  const isAllSelected = selectedCategory === null;

  return (
    <section className="px-4 md:px-8 py-3">
      <p className="text-xs font-semibold text-zinc-500 mb-2">What&apos;s on your mind?</p>
      <div className="flex gap-8 md:gap-10 overflow-x-auto no-scrollbar py-2 pb-1 -mx-4 px-5">
        <Link
          href="/"
          className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-all duration-200"
          prefetch={false}
        >
          <div className={cn(
            "size-[64px] md:size-[80px] rounded-full overflow-hidden bg-zinc-100 relative transition-all duration-200 flex items-center justify-center",
            isAllSelected
              ? "ring-2 ring-zinc-900 ring-offset-4"
              : "border border-zinc-100/50"
          )}>
            <LayoutGrid className={cn(
              "size-6 transition-colors",
              isAllSelected ? "text-zinc-900" : "text-zinc-400"
            )} />
          </div>
          <span className={cn(
            "text-[10px] md:text-[11px] font-bold tracking-tight text-center leading-tight transition-colors",
            isAllSelected ? "text-zinc-900" : "text-zinc-600"
          )}>
            All
          </span>
        </Link>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.slug;

          return (
            <Link
              key={cat.id}
              href={`/?category=${cat.slug}`}
              className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-all duration-200"
              prefetch={false}
            >
              <div className={cn(
                "size-[64px] md:size-[80px] rounded-full overflow-hidden bg-zinc-50 relative transition-all duration-200",
                isSelected
                  ? "ring-2 ring-zinc-900 ring-offset-4"
                  : "border border-zinc-100/50"
              )}>
                <Image
                  src={cat.image_url || FALLBACK_IMAGE}
                  alt={cat.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                  sizes="(max-width: 768px) 64px, 80px"
                />
              </div>
              <span className={cn(
                "text-[10px] md:text-[11px] font-bold tracking-tight text-center leading-tight max-w-[64px] md:max-w-[80px] line-clamp-1 transition-colors",
                isSelected ? "text-zinc-900" : "text-zinc-600"
              )}>
                {cat.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

