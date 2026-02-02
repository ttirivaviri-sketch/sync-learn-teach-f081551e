import { useState } from "react";
import { Camera, Star, MapPin, Clock, DollarSign, BookOpen, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import StarRating from "@/components/StarRating";
import { LocationPicker } from "@/components/LocationPicker";
import { security } from "@/utils/security";
import { useTutorStats } from "@/hooks/useTutorStats";
import { Skeleton } from "@/components/ui/skeleton";

interface TutorProfileProps {
  user: any;
}

const TutorProfile = ({ user }: TutorProfileProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [profileData, setProfileData] = useState({
    bio: "Experienced mathematics and physics tutor with over 5 years of teaching experience. Passionate about helping students achieve their academic goals.",
    subjects: ["Mathematics", "Physics", "Chemistry"],
    hourlyRate: "R150",
    location: "Johannesburg, South Africa",
    locationLat: null as number | null,
    locationLng: null as number | null,
    availability: "Mon-Fri: 2:00 PM - 8:00 PM",
    qualifications: ["BSc Mathematics", "Teaching Certificate", "5+ Years Experience"]
  });
  const { toast } = useToast();
  
  // Use real stats from database
  const { formattedStats, stats: rawStats, loading: statsLoading } = useTutorStats(user?.id);

  const handleSaveProfile = () => {
    // Validate and sanitize input data
    const sanitizedBio = security.sanitizeInput(profileData.bio);
    const sanitizedLocation = security.sanitizeInput(profileData.location);
    
    setProfileData(prev => ({
      ...prev,
      bio: sanitizedBio,
      location: sanitizedLocation
    }));
    
    setIsEditing(false);
    setShowLocationPicker(false);
    toast({
      title: "Profile Updated",
      description: "Your profile has been successfully updated.",
    });
  };

  const handleLocationUpdate = (lat: number, lng: number, address: string) => {
    setProfileData(prev => ({
      ...prev,
      location: address,
      locationLat: lat,
      locationLng: lng
    }));
    setShowLocationPicker(false);
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src="/placeholder.svg" />
                <AvatarFallback className="text-lg">
                  {user?.user_metadata?.full_name?.[0] || 'T'}
                </AvatarFallback>
              </Avatar>
              <Button
                size="sm"
                variant="outline"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{user?.user_metadata?.full_name || 'Professional Tutor'}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                {statsLoading ? (
                  <Skeleton className="h-5 w-32" />
                ) : (
                  <>
                    <StarRating rating={rawStats.averageRating} readonly size="sm" showValue />
                    <span className="text-sm text-muted-foreground">
                      ({rawStats.totalReviews} reviews)
                    </span>
                  </>
                )}
              </div>
            </div>
            <Button
              variant={isEditing ? "default" : "outline"}
              onClick={isEditing ? handleSaveProfile : () => setIsEditing(true)}
            >
              {isEditing ? "Save Changes" : "Edit Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-8 w-8 mx-auto text-primary mb-2" />
            {statsLoading ? (
              <Skeleton className="h-8 w-16 mx-auto mb-2" />
            ) : (
              <p className="text-2xl font-bold">{formattedStats.todaySessions + rawStats.totalReviews}</p>
            )}
            <p className="text-sm text-muted-foreground">Total Sessions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
            {statsLoading ? (
              <Skeleton className="h-8 w-16 mx-auto mb-2" />
            ) : (
              <p className="text-2xl font-bold">{formattedStats.averageRating || "N/A"}</p>
            )}
            <p className="text-sm text-muted-foreground">Average Rating</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-8 w-8 mx-auto text-green-500 mb-2" />
            {statsLoading ? (
              <Skeleton className="h-8 w-20 mx-auto mb-2" />
            ) : (
              <p className="text-2xl font-bold">{formattedStats.totalEarnings}</p>
            )}
            <p className="text-sm text-muted-foreground">Total Earned</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            {statsLoading ? (
              <Skeleton className="h-8 w-16 mx-auto mb-2" />
            ) : (
              <p className="text-2xl font-bold">{formattedStats.totalHours}h</p>
            )}
            <p className="text-sm text-muted-foreground">Hours Taught</p>
          </CardContent>
        </Card>
      </div>

      {/* Profile Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Bio & Info */}
        <Card>
          <CardHeader>
            <CardTitle>About Me</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <Textarea
                value={profileData.bio}
                onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                className="min-h-[100px]"
                placeholder="Tell students about yourself..."
              />
            ) : (
              <p className="text-muted-foreground">{profileData.bio}</p>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <div className="flex-1 space-y-2">
                    <Input
                      value={profileData.location}
                      onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                      placeholder="Your location"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLocationPicker(!showLocationPicker)}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      {showLocationPicker ? 'Hide' : 'Set GPS Location'}
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm">{profileData.location}</span>
                )}
              </div>
              
              {isEditing && showLocationPicker && (
                <LocationPicker
                  currentLat={profileData.locationLat || undefined}
                  currentLng={profileData.locationLng || undefined}
                  onLocationUpdate={handleLocationUpdate}
                />
              )}
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <Input
                    value={profileData.availability}
                    onChange={(e) => setProfileData({...profileData, availability: e.target.value})}
                    placeholder="Your availability"
                  />
                ) : (
                  <span className="text-sm">{profileData.availability}</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <Input
                    value={profileData.hourlyRate}
                    onChange={(e) => setProfileData({...profileData, hourlyRate: e.target.value})}
                    placeholder="Hourly rate"
                  />
                ) : (
                  <span className="text-sm">{profileData.hourlyRate}/hour</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subjects & Qualifications */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subjects I Teach</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profileData.subjects.map((subject, index) => (
                  <Badge key={index} variant="secondary">
                    {subject}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Qualifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {profileData.qualifications.map((qual, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    <span className="text-sm">{qual}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TutorProfile;