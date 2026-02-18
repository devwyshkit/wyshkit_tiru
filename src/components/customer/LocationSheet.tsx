'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Check,
  Home,
  Briefcase,
  Plus,
  Loader2,
  Locate,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  X
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getAddresses, setDefaultAddress, deleteAddress } from '@/lib/actions/addresses';
import { setLocationFromCoords, setLocationCookies, searchPlaces, setLocationFromPlaceId } from '@/lib/actions/location';
import type { Address } from '@/lib/types/address';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LocationContent({ onSelect }: { onSelect?: () => void }) {
  const router = useRouter();
  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [usingGeolocation, setUsingGeolocation] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search State
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await searchPlaces(query);
      setSearchResults(results || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectPlace = async (placeId: string) => {
    setSearching(true);
    const result = await setLocationFromPlaceId(placeId);
    if (result.success) {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('locationUpdate'));
      toast.success(`Location set: ${result.name}`);
      if (onSelect) onSelect();
      else goBack();
    } else {
      toast.error(result.error || 'Failed to set location');
    }
    setSearching(false);
  };

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
          // Silent fail
        } finally {
          setLoadingAddresses(false);
        }
      };
      fetchAddresses();
    }
  }, [user]);

  const selectedAddress = addresses.find(a => a.id === selectedAddressId) || addresses.find(a => a.is_default) || addresses[0];

  const handleSelectAddress = async (id: string, addr?: Address) => {
    if (settingDefault) return;
    setSettingDefault(id);
    try {
      const result = await setDefaultAddress(id);
      if (result.success) {
        setSelectedAddressId(id);
        const selectedAddr = addr || addresses.find(a => a.id === id);
        if (selectedAddr?.latitude != null && selectedAddr?.longitude != null) {
          const name = selectedAddr.name || selectedAddr.city || 'Saved address';
          await setLocationCookies(selectedAddr.latitude, selectedAddr.longitude, name);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('locationUpdate'));
        }
        toast.success("Delivery location updated");
        if (onSelect) onSelect();
        else goBack();
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
    router.push('/profile?tab=addresses&action=add');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search Header */}
      <div className="px-5 py-4 border-b border-zinc-100 bg-white sticky top-0 z-10">
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            {searching ? (
              <Loader2 className="size-4 animate-spin text-orange-600" />
            ) : (
              <Search className="size-4 text-zinc-400 group-focus-within:text-orange-600 transition-colors" />
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for area, street name..."
            className="w-full bg-zinc-50 border-none rounded-2xl py-3.5 pl-11 pr-11 text-sm font-semibold placeholder:text-zinc-400 focus:ring-2 focus:ring-orange-600/10 transition-all outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 rounded-full transition-colors"
            >
              <X className="size-3 text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        {searchResults.length > 0 ? (
          <div className="p-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {searchResults.map((result) => (
              <button
                key={result.place_id}
                onClick={() => handleSelectPlace(result.place_id)}
                className="w-full flex items-start gap-4 p-4 rounded-2xl hover:bg-zinc-50 transition-all text-left group"
              >
                <div className="size-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 group-hover:bg-orange-50 transition-colors">
                  <MapPin className="size-4 text-zinc-400 group-hover:text-orange-600" />
                </div>
                <div className="flex flex-col min-w-0 flex-1 pt-0.5">
                  <span className="text-sm font-bold text-zinc-900 truncate">
                    {result.structured_formatting.main_text}
                  </span>
                  <span className="text-xs text-zinc-500 truncate mt-0.5">
                    {result.structured_formatting.secondary_text}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : loadingAddresses ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="px-5 py-6 space-y-8 animate-in fade-in duration-500">
            {/* GPS Row */}
            {!query && (
              <button
                onClick={handleUseCurrentLocation}
                disabled={usingGeolocation}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-100 hover:bg-zinc-50 hover:border-zinc-200 transition-all text-left group"
              >
                <div className="size-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 border border-orange-100/50 group-hover:bg-orange-100 transition-colors">
                  {usingGeolocation ? (
                    <Loader2 className="size-4 animate-spin text-orange-600" />
                  ) : (
                    <Locate className="size-4 text-orange-600" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-zinc-900">
                    {usingGeolocation ? 'Pinpointing location…' : 'Use current location'}
                  </span>
                  <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest mt-0.5 leading-none">Using GPS</span>
                </div>
              </button>
            )}

            {/* Saved Addresses Section */}
            {user && addresses.length > 0 && (
              <div className="space-y-4">
                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">Saved addresses</p>
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
                          "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300",
                          isSelected
                            ? "bg-zinc-900 border-zinc-900 shadow-xl shadow-zinc-200"
                            : "bg-white border-zinc-100 hover:border-zinc-200"
                        )}
                      >
                        <button
                          onClick={() => handleSelectAddress(addr.id, addr)}
                          disabled={isLoading || !!settingDefault}
                          className="flex flex-1 items-center gap-4 text-left min-w-0 active:scale-[0.98] transition-transform"
                        >
                          <div className={cn(
                            "size-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "bg-white/10" : "bg-zinc-50"
                          )}>
                            {isLoading ? (
                              <Loader2 className={cn("size-4 animate-spin", isSelected ? "text-white" : "text-zinc-400")} />
                            ) : (
                              <Icon className={cn("size-4", isSelected ? "text-white text-zinc-900" : "text-zinc-600")} />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-sm font-bold", isSelected ? "text-white" : "text-zinc-900")}>
                                {addr.name}
                              </span>
                              {addr.is_default && !isSelected && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 uppercase">Default</span>
                              )}
                            </div>
                            <span className={cn("text-xs truncate mt-0.5 font-medium", isSelected ? "text-white/60" : "text-zinc-500")}>
                              {addr.address_line1}{addr.city ? `, ${addr.city}` : ''}
                            </span>
                          </div>
                          {isSelected && <Check className="size-4 text-white shrink-0 animate-in zoom-in duration-300" />}
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              disabled={isDeleting}
                              className={cn(
                                "p-2 rounded-xl shrink-0 transition-colors",
                                isSelected ? "hover:bg-white/10 text-white/50 hover:text-white" : "hover:bg-zinc-50 text-zinc-400 hover:text-zinc-600"
                              )}
                            >
                              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1.5 border-zinc-100 shadow-xl">
                            <DropdownMenuItem
                              onClick={() => router.push(`/profile?tab=addresses&action=edit&id=${addr.id}`)}
                              className="rounded-xl flex items-center gap-2.5 px-3 py-2.5 font-bold text-xs text-zinc-600 focus:text-zinc-900"
                            >
                              <Pencil className="size-3.5" />
                              Edit Address
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="rounded-xl flex items-center gap-2.5 px-3 py-2.5 font-bold text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50"
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
                                if (selectedAddressId === addr.id) setSelectedAddressId(null);
                                toast.success('Address removed');
                              }}
                            >
                              <Trash2 className="size-3.5" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}

                  <button
                    onClick={handleAddNewAddress}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-zinc-100 hover:bg-zinc-50 hover:border-zinc-200 transition-all text-left group"
                  >
                    <div className="size-10 rounded-xl bg-zinc-50 flex items-center justify-center shrink-0 group-hover:bg-zinc-100 transition-colors">
                      <Plus className="size-4 text-zinc-400 group-hover:text-zinc-600" />
                    </div>
                    <span className="text-sm font-bold text-zinc-400 group-hover:text-zinc-600">Add new address</span>
                  </button>
                </div>
              </div>
            )}

            {/* Empty State / Auth Required */}
            {(!user || addresses.length === 0) && !query && (
              <div className="py-12 px-6 rounded-[2rem] bg-zinc-50/50 border border-zinc-100 text-center space-y-4">
                <div className="size-14 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto">
                  <MapPin className="size-6 text-zinc-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-zinc-900">
                    {user ? 'No saved addresses' : 'Sign in to save addresses'}
                  </p>
                  <p className="text-xs text-zinc-500 max-w-[200px] mx-auto leading-relaxed">
                    {user ? 'Add your delivery addresses for a faster checkout experience.' : 'Log in to access your saved home and work addresses.'}
                  </p>
                </div>
                {user && (
                  <button
                    onClick={handleAddNewAddress}
                    className="mt-2 px-6 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
                  >
                    Add Address
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface LocationSheetProps {
  isRouteContext?: boolean;
  onSelect?: () => void;
}

export function LocationSheet({ isRouteContext, onSelect }: LocationSheetProps = {}) {
  const pathname = usePathname();
  const useRouteContext = isRouteContext ?? (pathname === '/location');

  const content = (
    <div className="flex flex-col h-[100dvh] bg-white">
      {!useRouteContext && (
        <div className="flex items-center justify-center h-16 px-6 border-b border-zinc-100 shrink-0">
          <span className="text-[17px] font-black text-zinc-950 uppercase tracking-tight">Delivery Location</span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <LocationContent onSelect={onSelect} />
      </div>
    </div>
  );

  return content;
}
