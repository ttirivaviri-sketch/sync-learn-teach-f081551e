import { useState } from 'react';
import { MapPin, Target, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface LocationPickerProps {
  currentLat?: number;
  currentLng?: number;
  onLocationUpdate: (lat: number, lng: number, address: string) => void;
}

export const LocationPicker = ({ currentLat, currentLng, onLocationUpdate }: LocationPickerProps) => {
  const [loading, setLoading] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const { toast } = useToast();

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Please enter your address manually.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Update location in profile
        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              location_lat: latitude,
              location_lng: longitude
            })
            .eq('id', (await supabase.auth.getUser()).data.user?.id);

          if (error) throw error;
          
          onLocationUpdate(latitude, longitude, 'Current Location');
          toast({
            title: "Location updated",
            description: "Your location has been saved successfully.",
          });
        } catch (error) {
          console.error('Error updating location:', error);
          toast({
            title: "Error",
            description: "Failed to save location. Please try again.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        toast({
          title: "Location access denied",
          description: "Please enter your address manually or allow location access.",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  const handleManualLocationSave = async () => {
    if (!manualAddress.trim()) {
      toast({
        title: "Invalid address",
        description: "Please enter a valid address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // For demo purposes, use approximate coordinates for major South African cities
    const cityCoords: { [key: string]: { lat: number; lng: number } } = {
      'johannesburg': { lat: -26.2041, lng: 28.0473 },
      'cape town': { lat: -33.9249, lng: 18.4241 },
      'durban': { lat: -29.8587, lng: 31.0218 },
      'pretoria': { lat: -25.7479, lng: 28.2293 },
      'port elizabeth': { lat: -33.9608, lng: 25.6022 },
    };

    const cityKey = manualAddress.toLowerCase();
    const coords = Object.keys(cityCoords).find(city => 
      cityKey.includes(city)
    );
    
    if (coords) {
      const { lat, lng } = cityCoords[coords];
      
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            location_lat: lat,
            location_lng: lng
          })
          .eq('id', (await supabase.auth.getUser()).data.user?.id);

        if (error) throw error;
        
        onLocationUpdate(lat, lng, manualAddress);
        toast({
          title: "Location updated",
          description: "Your address has been saved successfully.",
        });
        setManualAddress('');
      } catch (error) {
        console.error('Error updating location:', error);
        toast({
          title: "Error",
          description: "Failed to save location. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Location not found",
        description: "Please enter a major South African city or use GPS location.",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Update your location</span>
        </div>
        
        {currentLat && currentLng && (
          <p className="text-xs text-muted-foreground">
            Current: {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
          </p>
        )}
        
        <div className="space-y-2">
          <Button
            onClick={getCurrentLocation}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Target className="h-4 w-4 mr-2" />
            )}
            Use Current Location
          </Button>
          
          <div className="flex gap-2">
            <Input
              placeholder="Or enter your city/address"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualLocationSave()}
            />
            <Button
              onClick={handleManualLocationSave}
              disabled={loading || !manualAddress.trim()}
              size="sm"
            >
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};