import { getItemWithFullSpec } from '@/lib/actions/item-actions';
import { notFound } from 'next/navigation';
import { InterceptedItemSheet } from '@/components/customer/item/InterceptedItemSheet';

export default async function InterceptedItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { itemId } = await params;
  const { data: item, error } = await getItemWithFullSpec(itemId);


  if (error || !item) {
    notFound();
  }

  return <InterceptedItemSheet item={item} />;
}

