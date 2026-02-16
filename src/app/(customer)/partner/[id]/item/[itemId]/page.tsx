import { getItemWithFullSpec } from '@/lib/actions/item-actions';
import { ItemDetailView } from '@/components/customer/item/ItemDetailView';
import { TopHeader } from '@/components/layout/TopHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { notFound } from 'next/navigation';

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { itemId } = await params;
  const { data: item, error } = await getItemWithFullSpec(itemId);

  if (error || !item) {
    notFound();
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0 pt-[116px] md:pt-16">
      <TopHeader />
      <ItemDetailView item={item} />
      <BottomNav />
    </div>
  );
}

