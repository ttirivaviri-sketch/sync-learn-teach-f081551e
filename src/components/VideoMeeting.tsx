import { useState } from "react";
import { Video, VideoOff, Mic, MicOff, Phone, MessageCircle, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface VideoMeetingProps {
  sessionType: "tutor" | "learner";
  partnerName: string;
  subject: string;
  onEndCall: () => void;
}

const VideoMeeting = ({ sessionType, partnerName, subject, onEndCall }: VideoMeetingProps) => {
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { sender: partnerName, message: "Hello! Ready to start our session?", time: "14:30" },
    { sender: "You", message: "Yes, let's begin!", time: "14:31" }
  ]);

  const sendMessage = () => {
    if (chatMessage.trim()) {
      setChatMessages([...chatMessages, {
        sender: "You",
        message: chatMessage,
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
      }]);
      setChatMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{subject} Session</h2>
          <p className="text-sm opacity-90">with {partnerName}</p>
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          Online Lesson
        </Badge>
      </header>

      {/* Video Area */}
      <div className="flex-1 relative bg-muted">
        {/* Main Video */}
        <div className="h-64 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          {isVideoOn ? (
            <div className="text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">{partnerName}'s Video</p>
            </div>
          ) : (
            <div className="text-center">
              <VideoOff className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Video Off</p>
            </div>
          )}
        </div>

        {/* Self Video (Picture in Picture) */}
        <div className="absolute top-4 right-4 w-24 h-32 bg-card rounded-lg border-2 border-border overflow-hidden">
          <div className="h-full flex items-center justify-center">
            {isVideoOn ? (
              <div className="text-center">
                <div className="w-8 h-8 rounded-full bg-primary mx-auto mb-1"></div>
                <p className="text-xs">You</p>
              </div>
            ) : (
              <VideoOff className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Session Timer */}
        <div className="absolute top-4 left-4">
          <Badge variant="outline" className="bg-background">
            Session: 15:30
          </Badge>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <Card className="m-4 h-64">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Chat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col h-48">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`text-sm ${msg.sender === "You" ? "text-right" : "text-left"}`}>
                  <div className={`inline-block p-2 rounded-lg max-w-xs ${
                    msg.sender === "You" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  }`}>
                    <p>{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Message Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1"
              />
              <Button size="sm" onClick={sendMessage}>Send</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="p-4 bg-card border-t">
        <div className="flex items-center justify-center gap-4">
          {/* Video Toggle */}
          <Button
            variant={isVideoOn ? "default" : "destructive"}
            size="icon"
            className="rounded-full"
            onClick={() => setIsVideoOn(!isVideoOn)}
          >
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          {/* Audio Toggle */}
          <Button
            variant={isAudioOn ? "default" : "destructive"}
            size="icon"
            className="rounded-full"
            onClick={() => setIsAudioOn(!isAudioOn)}
          >
            {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          {/* Chat Toggle */}
          <Button
            variant={showChat ? "default" : "outline"}
            size="icon"
            className="rounded-full"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageCircle className="h-5 w-5" />
          </Button>

          {/* Share Screen */}
          <Button variant="outline" size="icon" className="rounded-full">
            <Share2 className="h-5 w-5" />
          </Button>

          {/* End Call */}
          <Button
            variant="destructive"
            size="icon"
            className="rounded-full"
            onClick={onEndCall}
          >
            <Phone className="h-5 w-5" />
          </Button>
        </div>

        {/* Session Info */}
        <div className="text-center mt-3 text-sm text-muted-foreground">
          {sessionType === "tutor" ? "Teaching" : "Learning"} • {subject} • Online Session
        </div>
      </div>
    </div>
  );
};

export default VideoMeeting;