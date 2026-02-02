import { useState } from "react";
import { Plus, Trash2, Clock, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTutorAvailability } from "@/hooks/useTutorAvailability";

interface TutorAvailabilityScheduleProps {
  tutorId: string;
}

const TIME_OPTIONS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00"
];

const formatTime = (time: string) => {
  const [hours] = time.split(':');
  const hour = parseInt(hours);
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  if (hour > 12) return `${hour - 12}:00 PM`;
  return `${hour}:00 AM`;
};

const TutorAvailabilitySchedule = ({ tutorId }: TutorAvailabilityScheduleProps) => {
  const {
    availability,
    loading,
    saving,
    addTimeSlot,
    removeTimeSlot,
    toggleSlotAvailability,
    setDefaultSchedule,
  } = useTutorAvailability(tutorId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const handleAddSlot = async () => {
    const success = await addTimeSlot(selectedDay, startTime + ":00", endTime + ":00");
    if (success) {
      setDialogOpen(false);
    }
  };

  const hasAnySlots = availability.some(day => day.slots.length > 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Availability
            </CardTitle>
            <CardDescription>
              Set your available hours for tutoring sessions
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {!hasAnySlots && (
              <Button
                variant="outline"
                size="sm"
                onClick={setDefaultSchedule}
                disabled={saving}
              >
                Set Default (Mon-Fri 9-5)
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Time Slot
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Available Time Slot</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Day of Week</Label>
                    <Select
                      value={selectedDay.toString()}
                      onValueChange={(v) => setSelectedDay(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Select value={startTime} onValueChange={setStartTime}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time}>
                              {formatTime(time)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Select value={endTime} onValueChange={setEndTime}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.filter(t => t > startTime).map((time) => (
                            <SelectItem key={time} value={time}>
                              {formatTime(time)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleAddSlot}
                    disabled={saving || endTime <= startTime}
                    className="w-full"
                  >
                    {saving ? "Adding..." : "Add Time Slot"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {availability.map((day) => (
            <div
              key={day.dayOfWeek}
              className="flex items-start gap-4 p-3 rounded-lg border bg-card"
            >
              <div className="w-24 font-medium text-sm pt-1">
                {day.dayName}
              </div>
              <div className="flex-1">
                {day.slots.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Not available</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {day.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center gap-2 bg-muted rounded-md px-3 py-1.5"
                      >
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </span>
                        <Switch
                          checked={slot.is_available}
                          onCheckedChange={(checked) =>
                            slot.id && toggleSlotAvailability(slot.id, checked)
                          }
                          disabled={saving}
                          className="scale-75"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => slot.id && removeTimeSlot(slot.id)}
                          disabled={saving}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {hasAnySlots && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
              Available
            </Badge>
            <Badge variant="outline" className="text-xs">
              <div className="w-2 h-2 rounded-full bg-gray-400 mr-1.5" />
              Unavailable
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TutorAvailabilitySchedule;
