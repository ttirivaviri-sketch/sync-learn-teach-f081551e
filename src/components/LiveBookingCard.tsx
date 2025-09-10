import { Clock, MapPin, Video, Check, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookingRequest } from "@/hooks/useRealtimeBookings";
import { formatDistanceToNow } from "date-fns";

interface LiveBookingCardProps {
  booking: BookingRequest;
  userType: 'learner' | 'tutor';
  onAccept?: (booking: BookingRequest) => void;
  onDecline?: (booking: BookingRequest) => void;
  onJoinSession?: (booking: BookingRequest) => void;
  onStartChat?: (booking: BookingRequest) => void;
}

export const LiveBookingCard = ({ 
  booking, 
  userType, 
  onAccept, 
  onDecline, 
  onJoinSession,
  onStartChat 
}: LiveBookingCardProps) => {
  const isIncoming = booking.status === 'requested' && userType === 'tutor';
  const isAccepted = booking.status === 'confirmed';
  const scheduledTime = new Date(booking.scheduled_at);
  const isNow = Math.abs(scheduledTime.getTime() - new Date().getTime()) < 15 * 60 * 1000; // Within 15 minutes

  const getStatusBadge = () => {
    const statusConfig = {
      requested: { label: 'Pending', variant: 'secondary' as const },
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      canceled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    return statusConfig[booking.status] || statusConfig.requested;
  };

  const statusBadge = getStatusBadge();

  return (
    <Card className={`shadow-sm transition-all duration-200 ${
      isIncoming ? 'ring-2 ring-primary ring-opacity-50 bg-primary/5' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-medium">
                {userType === 'tutor' 
                  ? booking.learner_profile?.full_name || 'Student'
                  : 'Tutor Session'
                }
              </h4>
              <p className="text-sm text-muted-foreground">
                {booking.tutor_subjects?.subject} • {booking.tutor_subjects?.level}
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            {isIncoming && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(booking.created_at), { addSuffix: true })}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{scheduledTime.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Video className="h-4 w-4" />
            <span>{booking.duration_minutes} min</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="font-semibold text-primary">R{booking.price}</p>
          {isNow && isAccepted && (
            <Badge variant="default" className="bg-green-500">
              <Video className="h-3 w-3 mr-1" />
              Ready to Join
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          {isIncoming && (
            <>
              <Button 
                size="sm" 
                onClick={() => onAccept?.(booking)}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onDecline?.(booking)}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}

          {isAccepted && isNow && (
            <Button 
              size="sm" 
              onClick={() => onJoinSession?.(booking)}
              className="flex-1"
            >
              <Video className="h-4 w-4 mr-1" />
              Join Session
            </Button>
          )}

          {(isAccepted || isIncoming) && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onStartChat?.(booking)}
            >
              Chat
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};