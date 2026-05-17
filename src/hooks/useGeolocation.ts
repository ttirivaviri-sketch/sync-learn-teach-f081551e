import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface GeolocationCoords {
  latitude: number;
  longitude: number;
}

export interface LocationError {
  code: number;
  message: string;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<GeolocationCoords | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getCurrentLocation = useCallback((opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!navigator.geolocation) {
      const err = { code: 0, message: 'Geolocation is not supported' };
      setError(err);
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(coords);
        setLoading(false);
        if (!silent) {
          toast({
            title: "Location updated",
            description: "Found tutors near your location!",
          });
        }
      },
      (error) => {
        const locationError = {
          code: error.code,
          message: getErrorMessage(error.code),
        };
        setError(locationError);
        setLoading(false);
        if (!silent) {
          toast({
            title: "Location access denied",
            description: "Using default location for tutor search.",
            variant: "destructive",
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, [toast]);

  const getErrorMessage = (code: number): string => {
    switch (code) {
      case 1:
        return 'Location access denied by user';
      case 2:
        return 'Location information unavailable';
      case 3:
        return 'Location request timeout';
      default:
        return 'An unknown error occurred';
    }
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = useCallback((
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Get distance to a specific location
  const getDistanceTo = useCallback((targetLat: number, targetLon: number): string => {
    if (!location) return "Unknown";
    
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      targetLat,
      targetLon
    );
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }, [location, calculateDistance]);

  // Auto-request location on hook initialization (silent — no toast)
  useEffect(() => {
    getCurrentLocation({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    location,
    error,
    loading,
    getCurrentLocation,
    calculateDistance,
    getDistanceTo,
  };
};