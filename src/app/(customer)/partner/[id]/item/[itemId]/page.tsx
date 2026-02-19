import { getItemWithFullSpec } from '@/lib/actions/item-actions';
import { getPartnerStoreData } from '@/lib/actions/discovery';
import { PartnerStorePage } from '@/components/customer/PartnerStorePage';
import { InterceptedItemSheet } from '@/components/customer/item/InterceptedItemSheet';
import { WyshkitItem } from '@/lib/types/item';
import { notFound } from 'next/navigation';

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const includeInactive = process.env.NODE_ENV === 'development';

  // WYSHKIT 2026: Immersive Store Context
  // Tapping a shared link to an item should show the store in the background, not a standalone page.
  const [partnerRes, itemRes] = await Promise.all([
    getPartnerStoreData(id, includeInactive),
    getItemWithFullSpec(itemId)
  ]);

  if (!partnerRes.partner || !itemRes.data) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <PartnerStorePage
        partnerId={id}
        initialData={partnerRes.partner}
        initialItems={partnerRes.items}
      />
      <InterceptedItemSheet
        item={itemRes.data as WyshkitItem}
        onCloseOverride={`/partner/${id}`}
      />
    </div>
  );
}

