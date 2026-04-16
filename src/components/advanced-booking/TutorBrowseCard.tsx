import { DollarSign, MapPin, CalendarCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { OnlineStatus } from "@/components/OnlineStatus";
import { TutorProfile } from "@/hooks/useTutorData";

interface TutorBrowseCardProps {
  tutor: TutorProfile;
  isSelected: boolean;
  onSelect: () => void;
}

export function TutorBrowseCard({ tutor, isSelected, onSelect }: TutorBrowseCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary border-primary" : "hover:shadow-card"
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={tutor.avatar_url || undefined} alt={tutor.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {tutor.full_name?.charAt(0) || "T"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground">{tutor.full_name}</h3>
              <OnlineStatus isOnline={tutor.online_status} lastSeen={tutor.last_seen} />
              <Badge variant="secondary">{tutor.rating || 4.8} ⭐</Badge>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {tutor.subjects.map((subject) => (
                <Badge key={subject.id} variant="outline" className="text-xs">
                  {subject.subject} • {subject.level}
                </Badge>
              ))}
            </div>
            {tutor.bio && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{tutor.bio}</p>}
            <div className="flex items-center gap-4 text-sm mb-3">
              <span className="flex items-center gap-1 text-primary font-medium">
                <DollarSign className="w-4 h-4" />
                R{tutor.subjects[0]?.hourly_rate || 0}/hour
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {tutor.distance || "Location unknown"}
              </span>
            </div>
            <Button size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
              <CalendarCheck className="w-4 h-4 mr-1" />
              Book Now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
