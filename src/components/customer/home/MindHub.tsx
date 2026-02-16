import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

const FALLBACK_IMAGE = '/images/logo.png';

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface MindHubProps {
  categories: Category[];
}

export function MindHub({ categories }: MindHubProps) {
  const isEmpty = categories.length === 0;

  return (
    <section className="px-4 md:px-8 font-sans">
      <div className="mb-4 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <h2 className="text-[20px] md:text-[28px] font-bold text-zinc-900 leading-tight flex items-center gap-2">
            What&apos;s on your mind?
            <Sparkles className="size-5 text-zinc-900 fill-zinc-900" />
          </h2>
          <p className="text-[11px] font-medium text-zinc-500 mt-1">
            Discover by category
          </p>
        </div>

        {isEmpty && (
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 bg-zinc-50 px-3 py-1 rounded-full animate-pulse">
            Curating your experience...
          </div>
        )}
      </div>


      {isEmpty ? (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3 md:gap-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="size-16 md:size-28 rounded-full bg-[#F1F1F6] animate-pulse" />
              <div className="h-2 w-10 bg-[#F1F1F6] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex md:hidden gap-5 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
            {categories.map((cat, index) => (
              <CategoryCircle key={cat.id} cat={cat} index={index} size="mobile" />
            ))}
          </div>

          <div className="hidden md:grid grid-cols-8 gap-y-8 gap-x-6">
            {categories.slice(0, 16).map((cat, index) => (
              <CategoryCircle key={cat.id} cat={cat} index={index} size="desktop" />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CategoryCircle({ cat, index, size }: { cat: Category, index: number, size: 'mobile' | 'desktop' }) {
  return (
    <Link
      href={`/search?category=${cat.slug}`}
      className={cn(
        "flex flex-col items-center gap-2 shrink-0 group transition-all",
        "animate-in",
        size === 'mobile' ? "w-[68px]" : "w-full"
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className={cn(
        "relative rounded-full overflow-hidden bg-white shadow-sm border border-[#F1F1F6]",
        "transition-all duration-300 group-hover:border-zinc-900 group-active:scale-95",
        size === 'mobile' ? "size-[68px]" : "size-full aspect-square"
      )}>
        <Image
          src={cat.image_url || FALLBACK_IMAGE}
          alt={cat.name}
          fill
          sizes={size === 'mobile' ? "68px" : "140px"}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <span className={cn(
        "font-bold text-[#3D4152] group-hover:text-zinc-900 text-center leading-[1.1] transition-colors",
        size === 'mobile' ? "text-[10px]" : "text-[13px]"
      )}>
        {cat.name}
      </span>
    </Link>
  );
}
