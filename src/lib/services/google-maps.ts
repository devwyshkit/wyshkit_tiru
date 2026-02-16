import { logger } from '@/lib/logging/logger';

interface GeoResult {
    city?: string;
    state?: string;
    pincode?: string;
    formattedAddress?: string;
}

export const GoogleMapsService = {
    reverseGeocode: async (lat: number, lng: number): Promise<GeoResult | null> => {
        try {
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
            if (!apiKey) {
                logger.warn('Google Maps API key missing');
                // Fallback or mock for dev if needed
                return null;
            }

            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.status !== 'OK' || !data.results?.[0]) {
                logger.error('Google Maps reverse geocode failed', data);
                return null;
            }

            const result = data.results[0];
            const components = result.address_components;

            let city = '';
            let state = '';
            let pincode = '';

            for (const comp of components) {
                if (comp.types.includes('locality')) city = comp.long_name;
                if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
                if (comp.types.includes('postal_code')) pincode = comp.long_name;
            }

            return {
                city,
                state,
                pincode,
                formattedAddress: result.formatted_address
            };
        } catch (error) {
            logger.error('GoogleMapsService error', error);
            return null;
        }
    }
};
