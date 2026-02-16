'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logError, handleActionError } from '@/lib/utils/error-handler';

/**
 * Credit cashback to user when order is delivered
 * Cashback is calculated as a percentage of order total (e.g., 2-5%)
 */
export async function creditCashbackOnDelivery(orderId: string, userId: string, orderTotal: number) {
  try {
    const supabase = await createClient();

    // Calculate cashback (2% of order total, minimum ₹10, maximum ₹500)
    const cashbackPercentage = 0.02; // 2%
    const cashbackAmount = Math.max(10, Math.min(500, Math.round(orderTotal * cashbackPercentage)));

    // Check if cashback already credited
    const { data: order } = await supabase
      .from('orders')
      .select('cashback_credited, cashback_amount')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.cashback_credited) {
      return { success: true, message: 'Cashback already credited', amount: order.cashback_amount };
    }

    // Start transaction: Update order, credit cashback, create transaction record
    // 1. Update order with cashback info (IDEMPOTENT CHECK)
    // Only update if cashback_credited is false
    const { data: updatedOrder, error: orderError } = await supabase
      .from('orders')
      .update({
        cashback_amount: cashbackAmount,
        cashback_credited: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('cashback_credited', false)
      .select();

    if (orderError) throw orderError;

    // If no row was updated, it means cashback was already credited
    if (!updatedOrder || updatedOrder.length === 0) {
      return { success: true, message: 'Cashback already credited or transaction in progress' };
    }

    // 2. Upsert user's wyshkit_money balance
    const { data: existingBalance } = await supabase
      .from('wyshkit_money')
      .select('balance, total_earned')
      .eq('user_id', userId)
      .maybeSingle();

    const newBalance = (existingBalance?.balance || 0) + cashbackAmount;
    const newTotalEarned = (existingBalance?.total_earned || 0) + cashbackAmount;

    const { error: moneyError } = await supabase
      .from('wyshkit_money')
      .upsert({
        user_id: userId,
        balance: newBalance,
        total_earned: newTotalEarned,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (moneyError) throw moneyError;

    // 3. Create transaction record
    const { error: transactionError } = await supabase
      .from('wyshkit_money_transactions')
      .insert({
        user_id: userId,
        order_id: orderId,
        amount: cashbackAmount,
        type: 'credit',
        description: `Cashback for order ${orderId}`
      });

    if (transactionError) throw transactionError;

    revalidatePath('/checkout');
    revalidatePath('/profile');
    return { success: true, amount: cashbackAmount };
  } catch (error) {
    logError(error, 'CreditCashbackOnDelivery');
    return handleActionError(error);
  }
}

/**
 * Get user's cashback balance
 */
export async function getUserCashbackBalance(userId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('wyshkit_money')
      .select('balance, total_earned, total_withdrawn')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    return {
      balance: data?.balance || 0,
      totalEarned: data?.total_earned || 0,
      totalWithdrawn: data?.total_withdrawn || 0
    };
  } catch (error) {
    logError(error, 'GetUserCashbackBalance');
    return { balance: 0, totalEarned: 0, totalWithdrawn: 0 };
  }
}

/**
 * Get user's cashback transaction history
 */
export async function getCashbackTransactions(userId: string, limit: number = 20) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('wyshkit_money_transactions')
      .select('*, orders(order_number)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { transactions: data || [] };
  } catch (error) {
    logError(error, 'GetCashbackTransactions');
    return { transactions: [] };
  }
}
