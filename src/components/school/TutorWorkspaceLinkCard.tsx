/**
 * TutorWorkspaceLinkCard — surfaces a shortcut to the teacher workspace for
 * users who hold a school_teacher or school_admin membership. Renders null
 * for users without a workspace tie so it is safe to mount anywhere.
 * Adapted from the iScanner manual-edit bundle to the existing schools schema.
 */
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, GraduationCap } from "lucide-react";
import { useMySchoolMemberships } from "@/hooks/useSchools";

export function TutorWorkspaceLinkCard() {
  const { data, isLoading } = useMySchoolMemberships();
  if (isLoading) return null;
  const rows = (data ?? []).filter(
    (r) => r.membership.role === "school_teacher" || r.membership.role === "school_admin",
  );
  if (rows.length === 0) return null;

  const primary = rows[0];
  const isAdmin = primary.membership.role === "school_admin";
  const to = isAdmin
    ? `/school/${primary.school.id}`
    : `/school/${primary.school.id}/teach`;

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/8 to-primary/[0.02]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate">{primary.school.name}</p>
            <Badge variant="secondary" className="text-[10px]">
              {isAdmin ? "Admin" : "Teacher"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {isAdmin ? "Open school dashboard" : "Open classes, homework & analytics"}
            {rows.length > 1 && ` · ${rows.length - 1} more`}
          </p>
        </div>
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link to={to} aria-label="Open workspace">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
