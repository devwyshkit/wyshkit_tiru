import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPartnerFromSession } from '@/lib/auth/server';
import { PartnerLayoutShell } from '@/components/partner/layout/PartnerLayoutShell';

export const dynamic = 'force-dynamic'

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getPartnerFromSession();
  if (!partner) {
    redirect('/partner/login');
  }

  // HARD GATE: Non-ACTIVE partners can only access onboarding
  const isActive = partner.kyc_status === 'ACTIVE' || partner.onboarding_status === 'ACTIVE';
  if (!isActive) {
    redirect('/partner/onboarding');
  }

  const supabase = await createClient();

  return (
    <PartnerLayoutShell partner={partner}>
      {children}
    </PartnerLayoutShell>
  );
}
