 import { useState } from "react";
 import { Calendar, Clock, CreditCard, Video, User, AlertCircle } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Avatar, AvatarFallback } from "@/components/ui/avatar";
 import { PayFastPayment } from "@/components/PayFastPayment";
 import { BookingRequest } from "@/hooks/useRealtimeBookings";
 import { format } from "date-fns";
 
 interface PendingPaymentCardProps {
   booking: BookingRequest;
   onPaymentComplete?: () => void;
 }
 
 export const PendingPaymentCard = ({ booking, onPaymentComplete }: PendingPaymentCardProps) => {
   const [showPayment, setShowPayment] = useState(false);
   
   const scheduledTime = new Date(booking.scheduled_at);
   const itemName = `${booking.tutor_subjects?.subject} - ${booking.duration_minutes}min session`;
 
   if (showPayment) {
     return (
       <div className="space-y-4">
         <Button 
           variant="ghost" 
           size="sm" 
           onClick={() => setShowPayment(false)}
           className="mb-2"
         >
           ← Back to booking details
         </Button>
         <PayFastPayment
           bookingId={booking.id}
           amount={Number(booking.price)}
           itemName={itemName}
           onSuccess={() => {
             setShowPayment(false);
             onPaymentComplete?.();
           }}
           onCancel={() => setShowPayment(false)}
         />
       </div>
     );
   }
 
   return (
     <Card className="ring-2 ring-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20">
       <CardHeader className="pb-2">
         <div className="flex items-center justify-between">
           <CardTitle className="text-base flex items-center gap-2">
             <AlertCircle className="h-4 w-4 text-orange-500" />
             Payment Required
           </CardTitle>
           <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
             Awaiting Payment
           </Badge>
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Tutor Info */}
         <div className="flex items-center gap-3">
           <Avatar className="h-10 w-10">
             <AvatarFallback className="bg-primary/10 text-primary">
               <User className="h-4 w-4" />
             </AvatarFallback>
           </Avatar>
           <div>
             <h4 className="font-medium">
               {booking.tutor_profile?.full_name || 'Tutor'}
             </h4>
             <p className="text-sm text-muted-foreground">
               {booking.tutor_subjects?.subject} • {booking.tutor_subjects?.level}
             </p>
           </div>
         </div>
 
         {/* Session Details */}
         <div className="grid grid-cols-2 gap-3 text-sm">
           <div className="flex items-center gap-2">
             <Calendar className="h-4 w-4 text-muted-foreground" />
             <span>{format(scheduledTime, "EEE, MMM d")}</span>
           </div>
           <div className="flex items-center gap-2">
             <Clock className="h-4 w-4 text-muted-foreground" />
             <span>{format(scheduledTime, "h:mm a")}</span>
           </div>
           <div className="flex items-center gap-2">
             <Video className="h-4 w-4 text-muted-foreground" />
             <span>{booking.duration_minutes} minutes</span>
           </div>
           <div className="flex items-center gap-2 font-semibold text-primary">
             <CreditCard className="h-4 w-4" />
             <span>R{booking.price}</span>
           </div>
         </div>
 
         <p className="text-sm text-muted-foreground">
           The tutor has confirmed your booking. Complete payment to secure your session.
         </p>
 
         <Button 
           className="w-full" 
           onClick={() => setShowPayment(true)}
         >
           <CreditCard className="h-4 w-4 mr-2" />
           Pay R{booking.price} Now
         </Button>
       </CardContent>
     </Card>
   );
 };