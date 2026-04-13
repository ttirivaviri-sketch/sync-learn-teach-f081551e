import { CheckCircle2, Clock, BookOpen, Star, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeetingSummaryScreenProps {
  subject: string;
  partnerName: string;
  sessionDuration: number;
  rating: number;
  summaryNotes: string;
  onRate: (n: number) => void;
  onDone: () => void;
}

export function MeetingSummaryScreen({
  subject,
  partnerName,
  sessionDuration,
  rating,
  summaryNotes,
  onRate,
  onDone,
}: MeetingSummaryScreenProps) {
  const durationMins = Math.ceil(sessionDuration / 60);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#1a3fc4] via-[#2d52e0] to-[#3b63f5] flex flex-col items-center justify-center p-6 z-50 overflow-y-auto">
      <div className="w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-400/20 border-2 border-green-400/40 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
          <p className="text-white/70 text-sm mt-1">{subject} with {partnerName}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Duration", value: `${durationMins} min`, icon: Clock },
            { label: "Subject", value: subject, icon: BookOpen },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white/10 backdrop-blur rounded-2xl p-4 text-center border border-white/15">
              <Icon className="h-5 w-5 text-white/60 mx-auto mb-1" />
              <p className="text-white font-bold text-lg leading-tight">{value}</p>
              <p className="text-white/50 text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* Rating */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15">
          <p className="text-white/70 text-sm mb-3 font-medium">How was the session?</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => onRate(n)} className="focus:outline-none transform hover:scale-110 transition-transform">
                <Star className={`h-8 w-8 ${n <= rating ? "text-yellow-400 fill-yellow-400" : "text-white/30"}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        {summaryNotes && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15">
            <div className="flex items-center gap-2 mb-2">
              <BookMarked className="h-4 w-4 text-white/60" />
              <p className="text-white/70 text-sm font-medium">Session Notes</p>
            </div>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{summaryNotes}</p>
          </div>
        )}

        <Button
          className="w-full h-12 rounded-2xl bg-white text-[#1a3fc4] font-bold text-base hover:bg-white/90"
          onClick={onDone}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
