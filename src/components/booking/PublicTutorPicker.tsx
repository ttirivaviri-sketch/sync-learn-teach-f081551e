/**
 * PublicTutorPicker — step 1 of the public booking flow.
 * Lets a visitor search / filter and choose a tutor.
 */
import { useMemo, useState } from "react";
import { Search, Star, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PublicBookableTutor } from "@/hooks/usePublicBookableTutors";

interface PublicTutorPickerProps {
  tutors: PublicBookableTutor[];
  loading: boolean;
  error: string | null;
  selectedTutorId?: string;
  onSelect: (tutor: PublicBookableTutor) => void;
  onRetry: () => void;
}

export function PublicTutorPicker({
  tutors,
  loading,
  error,
  selectedTutorId,
  onSelect,
  onRetry,
}: PublicTutorPickerProps) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string>("all");

  const subjects = useMemo(() => {
    const set = new Set<string>();
    tutors.forEach((t) => t.subjects.forEach((s) => set.add(s.subject)));
    return Array.from(set).sort();
  }, [tutors]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tutors.filter((t) => {
      const subjectOk =
        subject === "all" || t.subjects.some((s) => s.subject === subject);
      if (!subjectOk) return false;
      if (!q) return true;
      return (
        t.full_name.toLowerCase().includes(q) ||
        t.subjects.some((s) => s.subject.toLowerCase().includes(q))
      );
    });
  }, [tutors, query, subject]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border p-4">
            <div className="flex gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by tutor name or subject"
          className="pl-9 h-11 rounded-full"
          aria-label="Search tutors"
        />
      </div>

      {subjects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSubject("all")}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              subject === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-accent"
            }`}
          >
            All subjects
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                subject === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 && (
        <div className="rounded-2xl border border-border p-8 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No tutors match that search</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different subject or clear the search.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((tutor) => {
          const isSelected = tutor.id === selectedTutorId;
          const rate = tutor.subjects[0]?.hourly_rate ?? 0;
          return (
            <button
              key={tutor.id}
              type="button"
              onClick={() => onSelect(tutor)}
              className={`w-full rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border hover:border-primary/40 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={tutor.avatar_url || undefined} alt={tutor.full_name} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {tutor.full_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{tutor.full_name}</span>
                    {tutor.total_reviews > 0 && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Star className="h-3 w-3 fill-current" />
                        {tutor.rating.toFixed(1)} ({tutor.total_reviews})
                      </Badge>
                    )}
                    {tutor.online_status && (
                      <Badge variant="outline" className="text-xs">
                        Online now
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tutor.subjects.slice(0, 4).map((s) => (
                      <Badge key={s.id} variant="outline" className="text-xs">
                        {s.subject} • {s.level}
                      </Badge>
                    ))}
                    {tutor.subjects.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{tutor.subjects.length - 4} more
                      </Badge>
                    )}
                  </div>
                  {tutor.bio && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{tutor.bio}</p>
                  )}
                  <p className="mt-2 text-sm font-medium text-primary">
                    From R{rate} per 1-hour session
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
