import { getItemDetails } from '@/lib/actions/item-actions';
import { notFound } from 'next/navigation';
import { InterceptedItemSheet } from '@/components/customer/item/InterceptedItemSheet';

export default async function InterceptedItemFromRootPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { itemId } = await params;
  const { data: item, error } = await getItemDetails(itemId);

  if (error || !item) {
    notFound();
  }

  return <InterceptedItemSheet item={item} />;
}

