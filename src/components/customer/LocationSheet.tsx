'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Check, Home, Briefcase, Plus, Loader2, Locate, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getAddresses, setDefaultAddress, deleteAddress } from '@/lib/actions/addresses';
import { setLocationFromCoords, setLocationCookies } from '@/lib/actions/location';
import type { Address } from '@/lib/types/address';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LocationContent({ onSelect }: { onSelect?: () => void }) {
  const router = useRouter();
  // WYSHKIT 2026: Use router.back() for route-based navigation (replaces Zustand goBack)
  const goBack = () => router.back();

  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [usingGeolocation, setUsingGeolocation] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const fetchAddresses = async () => {
        setLoadingAddresses(true);
        try {
          const result = await getAddresses();
          if (result && result.addresses) {
            setAddresses(result.addresses);
            const defaultAddr = result.addresses.find((a: Address) => a.is_default);
            if (defaultAddr) setSelectedAddressId(defaultAddr.id);
          }
        } catch {
          // Silent fail - UI shows empty state
        } finally {
          setLoadingAddresses(false);
        }
      };
      fetchAddresses();
    }
  }, [user]);

  // WYSHKIT 2026: React 19 Compiler handles memoization automatically
  // No manual useMemo needed - React Compiler optimizes this calculation
  const selectedAddress = addresses.find(a => a.id === selectedAddressId) || addresses.find(a => a.is_default) || addresses[0];

  const handleSelectAddress = async (id: string, addr?: Address) => {
    if (settingDefault) return;
    setSettingDefault(id);

    try {
      const result = await setDefaultAddress(id);
      if (result.success) {
        setSelectedAddressId(id);
        setAddresses(prev => prev.map(a => ({
          ...a,
          is_default: a.id === id
        })));
        const selectedAddr = addr || addresses.find(a => a.id === id);
        if (selectedAddr?.latitude != null && selectedAddr?.longitude != null) {
          const name = selectedAddr.name || selectedAddr.city || 'Saved address';
          await setLocationCookies(selectedAddr.latitude, selectedAddr.longitude, name);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('locationUpdate'));
        }
        toast.success("Delivery location updated");
        if (onSelect) onSelect();
        else goBack();
      } else {
        toast.error("Failed to update location");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSettingDefault(null);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported');
      return;
    }
    setUsingGeolocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const result = await setLocationFromCoords(latitude, longitude);
          if (result.success) {
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('locationUpdate'));
            toast.success(`Location set: ${result.name}`);
            if (onSelect) onSelect();
            else goBack();
          } else {
            toast.error(result.error || 'Could not set location');
          }
        } catch {
          toast.error('Something went wrong');
        } finally {
          setUsingGeolocation(false);
        }
      },
      () => {
        toast.error('Location access denied');
        setUsingGeolocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleAddNewAddress = () => {
    // WYSHKIT 2026: Intent-Based Navigation - Use route instead of Zustand
    router.push('/profile?tab=addresses&action=add');
  };

  return (
    <div className="flex flex-col h-full">
      {loadingAddresses ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="px-5 py-6 space-y-6">
          <div className="space-y-4">
            <button
              onClick={handleUseCurrentLocation}
              disabled={usingGeolocation}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-100 hover:bg-zinc-50 hover:border-zinc-200 transition-all text-left"
            >
              <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                {usingGeolocation ? (
                  <Loader2 className="size-4 animate-spin text-emerald-600" />
                ) : (
                  <Locate className="size-4 text-emerald-600" />
                )}
              </div>
              <span className="text-sm font-semibold text-zinc-900">
                {usingGeolocation ? 'Getting location…' : 'Use current location'}
              </span>
            </button>
          </div>

          {user && addresses.length > 0 && (
            <div className="space-y-4">
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Saved addresses</p>
              <div className="space-y-2">
                {addresses.map((addr) => {
                  const isSelected = selectedAddress?.id === addr.id;
                  const isLoading = settingDefault === addr.id;
                  const isDeleting = deletingId === addr.id;
                  const Icon = addr.type === 'home' ? Home : addr.type === 'work' ? Briefcase : MapPin;

                  return (
                    <div
                      key={addr.id}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all",
                        isSelected
                          ? "bg-zinc-900 border-zinc-900"
                          : "bg-white border-zinc-100 hover:border-zinc-200"
                      )}
                    >
                      <button
                        onClick={() => handleSelectAddress(addr.id, addr)}
                        disabled={isLoading || !!settingDefault}
                        className="flex flex-1 items-center gap-4 text-left min-w-0 active:scale-[0.98]"
                      >
                        <div className={cn(
                          "size-10 rounded-xl flex items-center justify-center shrink-0",
                          isSelected ? "bg-white/10" : "bg-zinc-50"
                        )}>
                          {isLoading ? (
                            <Loader2 className={cn("size-4 animate-spin", isSelected ? "text-white" : "text-zinc-400")} />
                          ) : (
                            <Icon className={cn("size-4", isSelected ? "text-white" : "text-zinc-600")} />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-semibold", isSelected ? "text-white" : "text-zinc-900")}>
                              {addr.name}
                            </span>
                            {addr.is_default && !isSelected && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">Default</span>
                            )}
                          </div>
                          <span className={cn("text-xs truncate mt-0.5", isSelected ? "text-white/60" : "text-zinc-500")}>
                            {addr.address_line1}{addr.city ? `, ${addr.city}` : ''}
                          </span>
                        </div>
                        {isSelected && <Check className="size-4 text-white shrink-0" />}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            disabled={isDeleting}
                            className={cn(
                              "p-2 rounded-xl shrink-0 transition-colors",
                              isSelected ? "hover:bg-white/10 text-white/70" : "hover:bg-zinc-50 text-zinc-400"
                            )}
                            aria-label="Address options"
                          >
                            {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => router.push('/profile?tab=addresses')}>
                            <Pencil className="size-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={async (e) => {
                              e.preventDefault();
                              setDeletingId(addr.id);
                              const err = await deleteAddress(addr.id);
                              setDeletingId(null);
                              if (err?.error) {
                                toast.error('Failed to delete address');
                                return;
                              }
                              setAddresses((prev) => prev.filter((a) => a.id !== addr.id));
                              if (selectedAddressId === addr.id && addresses.length > 1) {
                                const next = addresses.find((a) => a.id !== addr.id);
                                if (next) setSelectedAddressId(next.id);
                                else setSelectedAddressId(null);
                              } else if (addresses.length <= 1) {
                                setSelectedAddressId(null);
                              }
                              toast.success('Address deleted');
                            }}
                          >
                            <Trash2 className="size-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}

                <button
                  onClick={handleAddNewAddress}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-zinc-100 hover:bg-zinc-50 hover:border-zinc-200 transition-all text-left"
                >
                  <div className="size-10 rounded-xl bg-zinc-50 flex items-center justify-center shrink-0">
                    <Plus className="size-4 text-zinc-400" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-400">Add new address</span>
                </button>
              </div>
            </div>
          )}

          {(!user || addresses.length === 0) && (
            <div className="space-y-4">
              <div className="p-8 rounded-2xl bg-zinc-50 text-center space-y-3">
                <div className="size-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto">
                  <MapPin className="size-5 text-zinc-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900">
                    {user ? 'No saved addresses' : 'Sign in to save addresses'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {user ? 'Add your first delivery address' : 'Your addresses will appear here'}
                  </p>
                </div>
                {user && (
                  <button
                    onClick={handleAddNewAddress}
                    className="mt-2 text-sm font-semibold text-zinc-900 underline underline-offset-4"
                  >
                    Add address
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface LocationSheetProps {
  // WYSHKIT 2026: Optional - if not provided, detects route context
  isRouteContext?: boolean;
}

export function LocationSheet({ isRouteContext }: LocationSheetProps = {}) {
  const pathname = usePathname();
  const useRouteContext = isRouteContext ?? (pathname === '/location');

  if (useRouteContext) {
    // WYSHKIT 2026: Render as full page (route-based navigation)
    return (
      <div className="flex flex-col h-full bg-white">
        <LocationContent />
      </div>
    );
  }

  // WYSHKIT 2026: Render as sheet content (for drawer/GlobalDrawers context)
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-center min-h-[64px] px-6 border-b border-zinc-100">
        <span className="text-[17px] font-bold text-zinc-950">Delivery Location</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <LocationContent />
      </div>
    </div>
  );
}
