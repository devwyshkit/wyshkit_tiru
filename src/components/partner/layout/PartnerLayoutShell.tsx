import { PartnerSidebar } from './PartnerSidebar';
import { PartnerMobileNav } from './PartnerMobileNav';
import { PartnerTopBar } from './PartnerTopBar';
import type { Database } from '@/lib/supabase/database.types';

type Partner = Database['public']['Tables']['partners']['Row'];

interface PartnerLayoutShellProps {
  children: React.ReactNode;
  partner: Partner;
}

export function PartnerLayoutShell({ children, partner }: PartnerLayoutShellProps) {
  return (
    <div className="h-[100dvh] bg-zinc-50 flex flex-col lg:flex-row overflow-hidden">
      <PartnerSidebar />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <PartnerTopBar partner={partner} />

        <main className="flex-1 overflow-y-auto no-scrollbar pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto w-full p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <PartnerMobileNav />
    </div>
  );
}
