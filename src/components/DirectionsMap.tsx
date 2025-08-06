import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { ArrowLeft, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface DirectionsMapProps {
  learnerAddress: string;
  learnerName: string;
  subject: string;
  onBack: () => void;
}

const DirectionsMap: React.FC<DirectionsMapProps> = ({
  learnerAddress,
  learnerName,
  subject,
  onBack
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          setError('Unable to get your location. Please enable location services.');
          setIsLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !currentLocation || !mapboxToken) return;

    try {
      mapboxgl.accessToken = mapboxToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: currentLocation,
        zoom: 13
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add current location marker
      new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat(currentLocation)
        .setPopup(new mapboxgl.Popup().setHTML('<p>Your Location</p>'))
        .addTo(map.current);

      // Geocode the learner's address (simplified - in real app would use Mapbox Geocoding API)
      // For demo purposes, we'll place it near the current location
      const learnerLocation: [number, number] = [
        currentLocation[0] + 0.01,
        currentLocation[1] + 0.01
      ];

      // Add learner location marker
      new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat(learnerLocation)
        .setPopup(new mapboxgl.Popup().setHTML(`<p>${learnerName}<br/>${learnerAddress}</p>`))
        .addTo(map.current);

      // Fit map to show both markers
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(currentLocation);
      bounds.extend(learnerLocation);
      map.current.fitBounds(bounds, { padding: 50 });

      setIsLoading(false);
    } catch (err) {
      setError('Failed to load map. Please check your internet connection.');
      setIsLoading(false);
    }

    return () => {
      map.current?.remove();
    };
  }, [currentLocation, mapboxToken, learnerAddress, learnerName]);

  const openInMaps = () => {
    if (currentLocation) {
      const url = `https://www.google.com/maps/dir/${currentLocation[1]},${currentLocation[0]}/${encodeURIComponent(learnerAddress)}`;
      window.open(url, '_blank');
    }
  };

  if (!mapboxToken) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">Directions to {learnerName}</h2>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Mapbox Token Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please enter your Mapbox public token to display the map with directions.
            </p>
            <input
              type="text"
              placeholder="Enter Mapbox public token..."
              className="w-full p-2 border rounded"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Get your token from <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">mapbox.com</a>
            </p>
            <Button onClick={openInMaps} className="w-full">
              <Navigation className="h-4 w-4 mr-2" />
              Open in Google Maps
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Session Details</h3>
            <p className="text-sm text-muted-foreground">Student: {learnerName}</p>
            <p className="text-sm text-muted-foreground">Subject: {subject}</p>
            <p className="text-sm text-muted-foreground">Address: {learnerAddress}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">Directions to {learnerName}</h2>
        </div>
        
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={openInMaps} className="w-full">
              <Navigation className="h-4 w-4 mr-2" />
              Open in Google Maps
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Session Details</h3>
            <p className="text-sm text-muted-foreground">Student: {learnerName}</p>
            <p className="text-sm text-muted-foreground">Subject: {subject}</p>
            <p className="text-sm text-muted-foreground">Address: {learnerAddress}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">Loading directions...</h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-2 p-4 bg-background border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Directions to {learnerName}</h2>
          <p className="text-sm text-muted-foreground">{subject} • {learnerAddress}</p>
        </div>
        <Button onClick={openInMaps} size="sm">
          <Navigation className="h-4 w-4 mr-2" />
          Open in Maps
        </Button>
      </div>
      
      <div ref={mapContainer} className="flex-1" />
    </div>
  );
};

export default DirectionsMap;