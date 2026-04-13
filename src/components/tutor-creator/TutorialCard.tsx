import {
  Eye, Edit, Trash2, CheckCircle2, Clock, Star, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Tutorial {
  id: string;
  title: string;
  subject: string;
  topic: string;
  grade: string;
  curriculum: string;
  status: "draft" | "published" | "archived";
  watchCount: number;
  rating: number;
  reviewCount: number;
  completionRate: number;
  createdAt: string;
}

interface TutorialCardProps {
  tutorial: Tutorial;
  onEdit: (tutorial: Tutorial) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (tutorial: Tutorial) => void;
}

export function TutorialCard({
  tutorial,
  onEdit,
  onDelete,
  onTogglePublish,
}: TutorialCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm truncate">{tutorial.title}</h4>
              <Badge
                variant={
                  tutorial.status === "published"
                    ? "default"
                    : tutorial.status === "draft"
                    ? "secondary"
                    : "outline"
                }
                className={`text-[10px] ${tutorial.status === "published" ? "bg-green-600" : ""}`}
              >
                {tutorial.status === "published" ? (
                  <><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Live</>
                ) : (
                  <><Clock className="h-2.5 w-2.5 mr-0.5" />Draft</>
                )}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[10px]">{tutorial.subject}</Badge>
              <Badge variant="outline" className="text-[10px]">{tutorial.topic}</Badge>
              {tutorial.grade && (
                <Badge variant="outline" className="text-[10px]">{tutorial.grade}</Badge>
              )}
            </div>

            {tutorial.watchCount > 0 && (
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {tutorial.watchCount} views
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {tutorial.rating > 0 ? tutorial.rating : "No ratings"}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {tutorial.completionRate}% completion
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-1.5 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(tutorial)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(tutorial.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onTogglePublish(tutorial)}>
            {tutorial.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export type { Tutorial };
