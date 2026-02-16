'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies, headers } from 'next/headers'
import { GoogleMapsService } from '@/lib/services/google-maps'

export interface LocationData {
    name: string;
    address: string;
    pincode: string;
    /** Lat/lng when available (from headers or cookies) - enables location-driven discovery */
    lat?: number;
    lng?: number;
}

/**
 * WYSHKIT 2026: Server-side Location Resolver
 * 
 * Swiggy 2026 Pattern: One-Trip Location
 * - Resolves location once on the server to prevent hydration flickers.
 * - Authenticated users: Fetches default address from Supabase.
 * - Guest users: Checks cookies for ephemeral location.
 */
export async function getServerLocation(): Promise<LocationData> {
    try {
        // 1. Check Edge-Injected Headers (Fastest Path - Swiggy 2026)
        const headerList = await headers()
        const edgeLat = headerList.get('x-wyshkit-location-lat')
        const edgeLng = headerList.get('x-wyshkit-location-lng')
        const edgeName = headerList.get('x-wyshkit-location-name')

        if (edgeLat && edgeLng) {
            return {
                name: edgeName ? decodeURIComponent(edgeName) : 'Current location',
                address: `${edgeLat}, ${edgeLng}`,
                pincode: '',
                lat: parseFloat(edgeLat),
                lng: parseFloat(edgeLng)
            }
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // 2. Fetch from Supabase for authenticated users (Fallback 1)
        if (user) {
            const { data: addresses } = await supabase
                .from('addresses')
                .select('name, type, city, address_line1, pincode, is_default, latitude, longitude')
                .eq('user_id', user.id)
                .order('is_default', { ascending: false })
                .limit(1) as any

            if (addresses?.length) {
                const addr = addresses[0]
                const lat = addr.latitude != null ? parseFloat(addr.latitude) : undefined
                const lng = addr.longitude != null ? parseFloat(addr.longitude) : undefined
                return {
                    name: addr.name || addr.type || 'Saved address',
                    address: addr.city || addr.address_line1 || '',
                    pincode: addr.pincode || '',
                    ...(lat != null && lng != null && { lat, lng })
                }
            }
        }

        // 3. Fetch from Cookies for guest users (Fallback 2)
        const cookieStore = await cookies()
        const lat = cookieStore.get('wyshkit_lat')?.value
        const lng = cookieStore.get('wyshkit_lng')?.value
        const name = cookieStore.get('wyshkit_location_name')?.value

        if (lat && lng) {
            return {
                name: name || 'Current location',
                address: `${lat}, ${lng}`,
                pincode: '',
                lat: parseFloat(lat),
                lng: parseFloat(lng)
            }
        }

        // 4. Fallback default
        return { name: 'Select location', address: '', pincode: '' }
    } catch (error) {
        return { name: 'Select location', address: '', pincode: '' }
    }
}

/** Set location cookies for guest/session (used by getServerLocation) */
export async function setLocationCookies(lat: number, lng: number, name: string) {
    const cookieStore = await cookies();
    cookieStore.set('wyshkit_lat', lat.toString(), { path: '/', maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set('wyshkit_lng', lng.toString(), { path: '/', maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set('wyshkit_location_name', name, { path: '/', maxAge: 60 * 60 * 24 * 30 });
}

/** Get address components from coordinates (for pre-filling address form) */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ city?: string; state?: string; pincode?: string; formattedAddress?: string; error?: string }> {
  try {
    const result = await GoogleMapsService.reverseGeocode(lat, lng);
    if (!result) return { error: 'Could not resolve location' };
    return {
      city: result.city,
      state: result.state,
      pincode: result.pincode,
      formattedAddress: result.formattedAddress,
    };
  } catch (e) {
    return { error: 'Failed to resolve location' };
  }
}

/** Set location from coordinates: geocode lat/lng to city/pincode, set cookies, return location name */
export async function setLocationFromCoords(lat: number, lng: number): Promise<{ success: boolean; name?: string; error?: string }> {
    try {
        const result = await GoogleMapsService.reverseGeocode(lat, lng);
        if (!result) return { success: false, error: 'Could not resolve location' };
        const name = result.city ? `${result.city}${result.pincode ? ` ${result.pincode}` : ''}` : result.formattedAddress || 'Current location';
        await setLocationCookies(lat, lng, name);
        return { success: true, name };
    } catch (e) {
        return { success: false, error: 'Failed to set location' };
    }
}
