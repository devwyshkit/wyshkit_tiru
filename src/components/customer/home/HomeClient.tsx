"use client";

import { ReactNode, useEffect } from "react";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface HomeClientProps {
  children: ReactNode;
  initialLat?: number;
  initialLng?: number;
}

export function HomeClient({ children, initialLat, initialLng }: HomeClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleRefresh = async () => {
    router.refresh();
  };

  useEffect(() => {
    // WYSHKIT 2026: Intent-Based Navigation - URL represents intent
    // Check for auth_required trigger and redirect to auth route
    const authRequired = searchParams.get('auth_required');
    if (authRequired === 'true') {
      const returnUrl = searchParams.get('returnUrl') || pathname;
      const intent = searchParams.get('intent') || 'signin';

      // Redirect to auth route with intent
      router.push(`/auth?intent=${intent}&returnUrl=${encodeURIComponent(returnUrl)}`);

      // Clean up the URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('auth_required');
      params.delete('returnUrl');
      params.delete('intent');
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl);
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    // If location is already in searchParams, don't ask again immediately
    if (initialLat && initialLng) return;

    // Check if we can get the location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Update URL with location without refreshing
          const params = new URLSearchParams(searchParams.toString());
          params.set("lat", latitude.toString());
          params.set("lng", longitude.toString());

          router.replace(`${pathname}?${params.toString()}`);
        },
        () => {
          // Geolocation denied or unavailable - silent fail
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, [initialLat, initialLng, pathname, router, searchParams]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="relative">
        {children}
      </div>
    </PullToRefresh>
  );
}
