/**
 * MatchExplanation — tells the learner *why* a Library tab is empty,
 * by breaking down which filter (curriculum / grade / subject) eliminated content.
 *
 * Drop-in usage in any Library empty state:
 *   <MatchExplanation
 *     stats={getMatchStatsFor((r) => r.type === "book")}
 *     profile={academicProfile}
 *     resourceLabel="books"
 *     onEditProfile={onShowAcademicSetup}
 *   />
 */
import { AlertCircle, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LibraryMatchStats } from "@/hooks/useLibraryResources";
import type { AcademicProfile } from "@/types/academicProfile";

interface MatchExplanationProps {
  stats: LibraryMatchStats;
  profile: AcademicProfile | null | undefined;
  resourceLabel: string; // e.g. "books", "past papers", "clips"
  onEditProfile?: () => void;
}

export function MatchExplanation({
  stats,
  profile,
  resourceLabel,
  onEditProfile,
}: MatchExplanationProps) {
  if (!profile) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-6 text-center space-y-3">
          <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Set your curriculum, grade and subjects to see {resourceLabel} for your syllabus.
          </p>
          {onEditProfile && (
            <Button size="sm" onClick={onEditProfile}>Set profile</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Build human reasons in priority order. Most actionable first.
  const reasons: { label: string; hint: string }[] = [];

  if (stats.total === 0) {
    reasons.push({
      label: "Library is empty",
      hint: `No ${resourceLabel} have been uploaded yet — tutors are adding more weekly.`,
    });
  } else {
    if (stats.blockedBySubject > 0) {
      const extras = stats.availableSubjects.filter(
        (s) => !(profile.subjects ?? []).some((ps) => ps.toLowerCase() === s.toLowerCase())
      );
      reasons.push({
        label: `${stats.blockedBySubject} subject mismatch${stats.blockedBySubject === 1 ? "" : "es"}`,
        hint: extras.length
          ? `Available for: ${extras.slice(0, 4).join(", ")}${extras.length > 4 ? "…" : ""}. Add one in your profile to unlock these.`
          : "These items are tagged for subjects you haven't picked.",
      });
    }
    if (stats.blockedByGrade > 0) {
      const extras = stats.availableGrades.filter(
        (g) => g.toLowerCase() !== (profile.grade || "").toLowerCase()
      );
      reasons.push({
        label: `${stats.blockedByGrade} grade mismatch${stats.blockedByGrade === 1 ? "" : "es"}`,
        hint: extras.length
          ? `Tagged for: ${extras.slice(0, 4).join(", ")}${extras.length > 4 ? "…" : ""}.`
          : `None match grade "${profile.grade}" yet.`,
      });
    }
    if (stats.blockedByCurriculum > 0) {
      const extras = stats.availableCurricula.filter(
        (c) => c.toLowerCase() !== (profile.curriculum || "").toLowerCase()
      );
      reasons.push({
        label: `${stats.blockedByCurriculum} curriculum mismatch${stats.blockedByCurriculum === 1 ? "" : "es"}`,
        hint: extras.length
          ? `Tagged for: ${extras.slice(0, 3).join(", ")}.`
          : `None tagged for ${profile.curriculum}.`,
      });
    }
    if (reasons.length === 0) {
      reasons.push({
        label: "No exact matches",
        hint: `${stats.total} ${resourceLabel} exist, but none match your full profile (${profile.curriculum} · ${profile.grade} · ${(profile.subjects ?? []).length} subjects).`,
      });
    }
  }

  return (
    <Card className="bg-muted/30 border-dashed">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              No {resourceLabel} match your profile yet
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="secondary" className="text-[10px]">{profile.curriculum}</Badge>
              <Badge variant="secondary" className="text-[10px]">{profile.grade}</Badge>
              {(profile.subjects ?? []).slice(0, 3).map((s) => (
                <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          </div>
        </div>

        <ul className="space-y-2">
          {reasons.map((r, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{r.label}.</span>{" "}
              {r.hint}
            </li>
          ))}
        </ul>

        {/* Tiny breakdown line for transparency */}
        <p className="text-[10px] text-muted-foreground/70 border-t border-border/40 pt-2">
          Scanned {stats.total} · curriculum match {stats.matchedCurriculum} · grade match{" "}
          {stats.matchedGrade} · subject match {stats.matchedSubject}
        </p>

        {onEditProfile && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={onEditProfile}>
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
              Edit profile
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
