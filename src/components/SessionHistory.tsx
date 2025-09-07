import { useState } from "react";
import { Calendar, Clock, Star, DollarSign, Video, MapPin, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StarRating from "@/components/StarRating";
import ReviewModal from "@/components/ReviewModal";

interface Session {
  id: string;
  student: string;
  subject: string;
  topic: string;
  date: string;
  time: string;
  duration: string;
  earnings: string;
  type: "online" | "in-person";
  status: "completed" | "cancelled" | "no-show";
  rating?: number;
  review?: string;
}

interface SessionHistoryProps {
  userType: "tutor" | "learner";
  userId: string;
}

const SessionHistory = ({ userType, userId }: SessionHistoryProps) => {
  const [selectedTab, setSelectedTab] = useState("all");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const sessions: Session[] = [
    {
      id: "1",
      student: "John Doe",
      subject: "Mathematics",
      topic: "Quadratic Equations",
      date: "2024-01-15",
      time: "14:00",
      duration: "1h",
      earnings: "R150",
      type: "online",
      status: "completed",
      rating: 5,
      review: "Excellent explanation of complex topics!"
    },
    {
      id: "2",
      student: "Sarah Wilson",
      subject: "Physics",
      topic: "Thermodynamics",
      date: "2024-01-14",
      time: "16:00",
      duration: "2h",
      earnings: "R300",
      type: "in-person",
      status: "completed",
      rating: 4,
      review: "Very helpful session, patient teacher."
    },
    {
      id: "3",
      student: "Mike Brown",
      subject: "Chemistry",
      topic: "Organic Chemistry",
      date: "2024-01-13",
      time: "15:00",
      duration: "1.5h",
      earnings: "R225",
      type: "online",
      status: "cancelled"
    },
    {
      id: "4",
      student: "Emma Davis",
      subject: "Mathematics",
      topic: "Calculus",
      date: "2024-01-12",
      time: "13:00",
      duration: "1h",
      earnings: "R150",
      type: "online",
      status: "no-show"
    }
  ];

  const filteredSessions = sessions.filter(session => {
    if (selectedTab === "all") return true;
    return session.status === selectedTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "cancelled": return "destructive";
      case "no-show": return "secondary";
      default: return "outline";
    }
  };

  const handleLeaveReview = (session: Session) => {
    setSelectedSession(session);
    setShowReviewModal(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              <TabsTrigger value="no-show">No Show</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              <div className="space-y-4">
                {filteredSessions.map((session) => (
                  <Card key={session.id} className="shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{session.student}</h4>
                          <p className="text-sm text-muted-foreground">
                            {session.subject} • {session.topic}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={getStatusColor(session.status)}>
                            {session.status.replace("-", " ").toUpperCase()}
                          </Badge>
                          {session.status === "completed" && (
                            <div className="mt-1">
                              <StarRating rating={session.rating || 0} readonly size="sm" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(session.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{session.time} ({session.duration})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {session.type === "online" ? (
                            <Video className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{session.type === "online" ? "Online" : "In-Person"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>{session.earnings}</span>
                        </div>
                      </div>

                      {session.review && (
                        <div className="bg-muted p-3 rounded-lg mb-3">
                          <p className="text-sm italic">"{session.review}"</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {session.status === "completed" && userType === "learner" && !session.rating && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLeaveReview(session)}
                          >
                            <Star className="h-4 w-4 mr-1" />
                            Leave Review
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Contact
                        </Button>
                        {session.status === "completed" && (
                          <Button size="sm" variant="outline">
                            Book Again
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredSessions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No sessions found for this filter.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedSession(null);
        }}
        bookingId={selectedSession?.id || ""}
        reviewedId={userId}
        reviewedName={selectedSession?.student || ""}
        userType={userType}
        onReviewSubmitted={() => {
          setShowReviewModal(false);
          setSelectedSession(null);
        }}
      />
    </div>
  );
};

export default SessionHistory;