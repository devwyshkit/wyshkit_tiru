import { createClient } from "@/lib/supabase/server";
import { getAddresses } from "@/lib/actions/addresses";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { User, Package, Settings, LogOut, ShieldCheck, Store, MapPin, CreditCard } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // WYSHKIT 2026: Intent-Based Navigation - Redirect to auth with returnUrl
    redirect("/auth?intent=signin&returnUrl=/profile");
  }

  // Check roles from public users table for multi-role support
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single() as { data: { is_admin?: boolean; full_name?: string } | null };

  const { data: partnerUser } = await supabase
    .from('partner_users')
    .select('partner_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const isAdmin = userData?.is_admin || (user.app_metadata as any)?.role === 'admin';
  const isPartner = !!partnerUser || (user.app_metadata as any)?.role === 'partner';

  const { addresses = [] } = await getAddresses() || {};

  return (
    <div className="bg-zinc-50 py-4">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        {/* Profile Header */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-100 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Logo variant="minimal" className="size-32" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
            <div className="size-20 md:size-24 rounded-full bg-zinc-100 flex items-center justify-center border-4 border-zinc-50 shadow-inner">
              <User className="size-10 md:size-12 text-zinc-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">
                {userData?.full_name || user.user_metadata?.full_name || 'Wyshkit User'}
              </h1>
              <p className="text-zinc-500 font-medium">{user.email}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2.5 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                  Customer
                </span>
                {isPartner && (
                  <span className="px-2.5 py-1 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                    Partner
                  </span>
                )}
                {isAdmin && (
                  <span className="px-2.5 py-1 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                    Admin
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" className="rounded-2xl border-zinc-200 font-bold px-6">
              Edit Profile
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Menu */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Account</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/orders" className="block group">
                <Card className="p-5 rounded-3xl border-zinc-100 hover:border-zinc-900 hover:shadow-xl hover:shadow-zinc-200/50 transition-all duration-300">
                  <div className="size-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                    <Package className="size-6" />
                  </div>
                  <h3 className="font-black text-lg text-zinc-900">My Orders</h3>
                  <p className="text-zinc-500 text-sm mt-1">Track and manage your orders</p>
                </Card>
              </Link>

              <Link href="/profile/addresses" className="block group">
                <Card className="p-5 rounded-3xl border-zinc-100 hover:border-zinc-900 hover:shadow-xl hover:shadow-zinc-200/50 transition-all duration-300">
                  <div className="size-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                    <MapPin className="size-6" />
                  </div>
                  <h3 className="font-black text-lg text-zinc-900">Saved Addresses</h3>
                  <p className="text-zinc-500 text-sm mt-1">Manage your delivery locations</p>
                </Card>
              </Link>

              <Link href="/profile/payments" className="block group opacity-50 pointer-events-none">
                <Card className="p-5 rounded-3xl border-zinc-100 transition-all duration-300">
                  <div className="size-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                    <CreditCard className="size-6" />
                  </div>
                  <h3 className="font-black text-lg text-zinc-900">Payment Methods</h3>
                  <p className="text-zinc-500 text-sm mt-1">Cards, UPI & Wallets</p>
                </Card>
              </Link>

              <Link href="/profile/settings" className="block group">
                <Card className="p-5 rounded-3xl border-zinc-100 hover:border-zinc-900 hover:shadow-xl hover:shadow-zinc-200/50 transition-all duration-300">
                  <div className="size-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                    <Settings className="size-6" />
                  </div>
                  <h3 className="font-black text-lg text-zinc-900">Settings</h3>
                  <p className="text-zinc-500 text-sm mt-1">App preferences & notifications</p>
                </Card>
              </Link>
            </div>
          </div>

          {/* Portals & Actions */}
          <div className="space-y-4">
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em] px-2">Workspaces</h2>

            <div className="space-y-4">
              <Link href="/partner" className="block group">
                <div className={cn(
                  "p-5 rounded-3xl border transition-all duration-300 flex items-center gap-4",
                  isPartner ? "bg-indigo-50 border-indigo-100 hover:border-indigo-500 hover:shadow-lg" : "bg-white border-zinc-100 hover:border-zinc-900"
                )}>
                  <div className={cn(
                    "size-12 rounded-2xl flex items-center justify-center shrink-0",
                    isPartner ? "bg-indigo-500 text-white" : "bg-zinc-100 text-zinc-400"
                  )}>
                    <Store className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-900">{isPartner ? 'Partner Dashboard' : 'Become a Partner'}</h3>
                    <p className="text-zinc-500 text-xs mt-0.5">{isPartner ? 'Manage your catalog & orders' : 'Start selling on Wyshkit'}</p>
                  </div>
                </div>
              </Link>

              {isAdmin && (
                <Link href="/admin" className="block group">
                  <div className="p-5 rounded-3xl border bg-rose-50 border-rose-100 hover:border-rose-500 transition-all duration-300 flex items-center gap-4 hover:shadow-lg">
                    <div className="size-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-zinc-900">Admin Control</h3>
                      <p className="text-zinc-500 text-xs mt-0.5">Platform operations & stats</p>
                    </div>
                  </div>
                </Link>
              )}

              <div className="pt-4">
                <SignOutButton className="w-full justify-start gap-3 h-14 rounded-2xl text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-all font-black px-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div className="mt-12 mb-8 p-8 bg-zinc-900 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-black mb-1">Need help with something?</h3>
            <p className="text-zinc-400 text-sm">Our support team is available 24/7 for you.</p>
          </div>
          <Button className="bg-white text-zinc-900 hover:bg-zinc-100 rounded-2xl font-black px-8 h-12">
            Contact Support
          </Button>
        </div>
      </div>

    </div>
  );
}
