import { getPartnerFromSession } from '@/lib/auth/server';
import { getPersonalizationQueue } from '@/lib/actions/partner-actions';
import { PersonalizationQueueClient } from '@/components/partner/personalization/PersonalizationQueueClient';
import { redirect } from 'next/navigation';

export default async function PartnerPersonalizationPage() {
  const partner = await getPartnerFromSession();
  if (!partner) redirect('/partner/login');

  const { data: queue } = await getPersonalizationQueue(partner.id);

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Preview queue</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Upload previews for personalized orders
        </p>
      </div>

      <PersonalizationQueueClient initialOrders={queue || []} />
    </div>
  );
}
