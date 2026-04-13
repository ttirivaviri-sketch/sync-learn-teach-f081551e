import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProfileImportBannerProps {
  subjects: string[];
  saving: boolean;
  onImport: () => void;
}

export function ProfileImportBanner({
  subjects,
  saving,
  onImport,
}: ProfileImportBannerProps) {
  if (subjects.length === 0) return null;

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-primary flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          Import from Academic Profile
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onImport}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Import All"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {subjects.map((s) => (
          <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
        ))}
      </div>
    </div>
  );
}
