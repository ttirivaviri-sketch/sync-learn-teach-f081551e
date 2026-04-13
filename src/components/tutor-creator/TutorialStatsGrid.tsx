import { CheckCircle2, Eye, Star, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TutorialStatsGridProps {
  published: number;
  totalViews: number;
  avgRating: string;
  totalTutorials: number;
}

export function TutorialStatsGrid({
  published,
  totalViews,
  avgRating,
  totalTutorials,
}: TutorialStatsGridProps) {
  const stats = [
    { label: "Published", value: published, icon: CheckCircle2, color: "text-green-600" },
    { label: "Total Views", value: totalViews.toLocaleString(), icon: Eye, color: "text-blue-600" },
    { label: "Avg Rating", value: avgRating, icon: Star, color: "text-yellow-500" },
    { label: "Tutorials", value: totalTutorials, icon: BookOpen, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-3 text-center">
            <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
            <p className="text-base font-bold">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
