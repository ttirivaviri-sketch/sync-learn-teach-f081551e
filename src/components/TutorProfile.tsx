import { useState, useEffect } from "react";
import { Star, MapPin, Clock, DollarSign, BookOpen, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import StarRating from "@/components/StarRating";
import { LocationPicker } from "@/components/LocationPicker";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import { security } from "@/utils/security";
import { useTutorStats } from "@/hooks/useTutorStats";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface TutorProfileProps {
  user: any;
}

const TutorProfile = ({ user }: TutorProfileProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const { toast } = useToast();
  const { formattedStats, stats: rawStats, loading: statsLoading } = useTutorStats(user?.id);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const [profileRes, subjectsRes, qualsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('tutor_subjects').select('*').eq('user_id', user.id),
        supabase.from('qualifications').select('*').eq('user_id', user.id),
      ]);
      if (profileRes.data) {
        setProfile(profileRes.data);
        setBio(profileRes.data.bio || "");
        setLocation(profileRes.data.location_lat ? "Set via GPS" : "Not set");
        setLocationLat(profileRes.data.location_lat);
        setLocationLng(profileRes.data.location_lng);
      }
      setSubjects(subjectsRes.data || []);
      setQualifications(qualsRes.data || []);
    };
    load();
  }, [user?.id]);

  const handleSaveProfile = async () => {
    const sanitizedBio = security.sanitizeInput(bio);
    setBio(sanitizedBio);

    await supabase.from('profiles').update({
      bio: sanitizedBio,
      location_lat: locationLat,
      location_lng: locationLng,
    }).eq('id', user.id);

    setIsEditing(false);
    setShowLocationPicker(false);
    toast({ title: "Profile Updated", description: "Your profile has been saved." });
  };

  const handleLocationUpdate = (lat: number, lng: number, address: string) => {
    setLocation(address);
    setLocationLat(lat);
    setLocationLng(lng);
    setShowLocationPicker(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <ProfilePhotoUpload
              userId={user?.id}
              currentAvatarUrl={profile?.avatar_url}
              fullName={profile?.full_name || user?.user_metadata?.full_name}
              size="lg"
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{profile?.full_name || user?.user_metadata?.full_name || 'Tutor'}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                {statsLoading ? <Skeleton className="h-5 w-32" /> : (
                  <>
                    <StarRating rating={rawStats.averageRating} readonly size="sm" showValue />
                    <span className="text-sm text-muted-foreground">({rawStats.totalReviews} reviews)</span>
                  </>
                )}
              </div>
            </div>
            <Button variant={isEditing ? "default" : "outline"} onClick={isEditing ? handleSaveProfile : () => setIsEditing(true)}>
              {isEditing ? "Save Changes" : "Edit Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: BookOpen, label: "Total Sessions", value: formattedStats.todaySessions + rawStats.totalReviews, color: "text-primary" },
          { icon: Star, label: "Average Rating", value: formattedStats.averageRating || "N/A", color: "text-yellow-500" },
          { icon: DollarSign, label: "Total Earned", value: formattedStats.totalEarnings, color: "text-green-500" },
          { icon: Clock, label: "Hours Taught", value: `${formattedStats.totalHours}h`, color: "text-blue-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <Icon className={`h-8 w-8 mx-auto ${color} mb-2`} />
              {statsLoading ? <Skeleton className="h-8 w-16 mx-auto mb-2" /> : <p className="text-2xl font-bold">{value}</p>}
              <p className="text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>About Me</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[100px]" placeholder="Tell students about yourself..." />
            ) : (
              <p className="text-muted-foreground">{bio || "No bio set yet."}</p>
            )}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <div className="flex-1 space-y-2">
                    <span className="text-sm">{location}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowLocationPicker(!showLocationPicker)}>
                      <MapPin className="h-4 w-4 mr-2" />{showLocationPicker ? 'Hide' : 'Set GPS Location'}
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm">{location}</span>
                )}
              </div>
              {isEditing && showLocationPicker && (
                <LocationPicker currentLat={locationLat || undefined} currentLng={locationLng || undefined} onLocationUpdate={handleLocationUpdate} />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Subjects I Teach</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subjects added yet</p>
                ) : subjects.map((s) => (
                  <Badge key={s.id} variant="secondary">{s.subject} • {s.level} {s.hourly_rate ? `• R${s.hourly_rate}/hr` : ''}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Qualifications</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {qualifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No qualifications added yet</p>
                ) : qualifications.map((qual) => (
                  <div key={qual.id} className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    <span className="text-sm">{qual.qualification_type} — {qual.institution}{qual.year_obtained ? ` (${qual.year_obtained})` : ''}</span>
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
