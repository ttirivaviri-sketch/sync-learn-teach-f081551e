import { useState } from "react";
import { Calendar, Clock, MapPin, Video, DollarSign, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const mockTutors = [
  {
    id: "1",
    name: "Dr. Sarah Johnson",
    subject: "Mathematics",
    rating: 4.9,
    price: 50,
    experience: "10+ years",
    specialty: "Calculus, Statistics",
    availability: ["Mon 2-6pm", "Wed 1-5pm", "Fri 3-7pm"],
    location: "Online & In-person",
    image: "/placeholder.svg"
  },
  {
    id: "2", 
    name: "Prof. Michael Chen",
    subject: "Physics",
    rating: 4.8,
    price: 60,
    experience: "15+ years",
    specialty: "Quantum Physics, Mechanics",
    availability: ["Tue 10am-2pm", "Thu 2-6pm", "Sat 9am-1pm"],
    location: "Online only",
    image: "/placeholder.svg"
  }
];

export const AdvancedBooking = () => {
  const [selectedTutor, setSelectedTutor] = useState<string>("");
  const [sessionType, setSessionType] = useState<"online" | "in-person">("online");
  const [duration, setDuration] = useState<string>("60");
  const [notes, setNotes] = useState<string>("");
  const { toast } = useToast();

  const handleBookSession = () => {
    if (!selectedTutor) {
      toast({
        title: "Select a tutor",
        description: "Please choose a tutor before booking",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Session booked!",
      description: "You'll receive a confirmation email shortly.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Book Your Next Session</h2>
        <p className="text-muted-foreground">Choose from our verified expert tutors</p>
      </div>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse">Browse Tutors</TabsTrigger>
          <TabsTrigger value="instant">Instant Match</TabsTrigger>
        </TabsList>
        
        <TabsContent value="browse" className="space-y-4">
          <div className="grid gap-4">
            {mockTutors.map((tutor) => (
              <Card 
                key={tutor.id} 
                className={`cursor-pointer transition-all ${
                  selectedTutor === tutor.id 
                    ? "ring-2 ring-primary border-primary" 
                    : "hover:shadow-card"
                }`}
                onClick={() => setSelectedTutor(tutor.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-foreground">{tutor.name}</h3>
                        <Badge variant="secondary">{tutor.rating} ⭐</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{tutor.subject} • {tutor.experience}</p>
                      <p className="text-sm text-muted-foreground mb-3">{tutor.specialty}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${tutor.price}/hour
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {tutor.location}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="instant" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Quick Match
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Get matched with an available tutor in under 5 minutes
              </p>
              <Button className="w-full" size="lg">
                Find Available Tutor Now
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedTutor && (
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Session Type</label>
                <Select value={sessionType} onValueChange={(value: "online" | "in-person") => setSessionType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Online
                      </div>
                    </SelectItem>
                    <SelectItem value="in-person">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        In-person
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Duration</label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Special requests or topics</label>
              <Textarea 
                placeholder="What would you like to focus on in this session?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            
            <Button onClick={handleBookSession} className="w-full" size="lg">
              Book Session - ${mockTutors.find(t => t.id === selectedTutor)?.price * (parseInt(duration) / 60)}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};