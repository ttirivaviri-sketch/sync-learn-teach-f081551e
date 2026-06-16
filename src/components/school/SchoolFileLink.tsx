/**
 * Generates a signed URL for a path in the school-content bucket and opens it.
 * Used by both teachers (viewing submissions) and students (downloading own work).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SchoolFileLink({ path, label }: { path: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const display = label ?? path.split("/").pop() ?? "file";
  return (
    <Button
      variant="ghost" size="sm" disabled={loading}
      onClick={async () => {
        setLoading(true);
        const { data, error } = await supabase.storage.from("school-content").createSignedUrl(path, 600);
        setLoading(false);
        if (error || !data) return toast.error(error?.message ?? "Could not open file");
        window.open(data.signedUrl, "_blank");
      }}
    >
      <FileText className="h-3 w-3 mr-1" />
      <span className="truncate max-w-[14rem]">{display}</span>
      <ExternalLink className="h-3 w-3 ml-1" />
    </Button>
  );
}
