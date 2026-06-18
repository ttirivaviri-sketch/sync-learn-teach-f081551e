/**
 * SchoolLogoUploader — drop-in card for SchoolSettings. Uploads a logo to the
 * shared `profile-photos` public bucket under `schools/{schoolId}/`, derives a
 * brand colour from the image, and persists both `logo_url` + `brand_color`
 * on the school. The picked colour drives the school-portal theme via
 * `applySchoolTheme` in SchoolLayout.
 */
import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUpdateSchool, type School } from "@/hooks/useSchools";
import { extractDominantColor } from "@/lib/schoolBranding";
import { useQueryClient } from "@tanstack/react-query";

const BUCKET = "profile-photos";

export function SchoolLogoUploader({ school }: { school: School }) {
  const update = useUpdateSchool();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(school.logo_url);
  const [brandColor, setBrandColor] = useState<string>(school.brand_color ?? "#3B82F6");

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file (PNG, JPG, SVG)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Logo must be under 4MB");
      return;
    }
    setBusy(true);
    try {
      // 1. Upload to storage
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `schools/${school.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

      // 2. Extract dominant colour from the file (locally — no CORS round trip).
      const color = await extractDominantColor(file).catch(() => brandColor);

      // 3. Persist
      await update.mutateAsync({
        id: school.id,
        patch: { logo_url: publicUrl, brand_color: color } as any,
      });
      qc.invalidateQueries({ queryKey: ["my-school-memberships"] });

      setPreviewUrl(publicUrl);
      setBrandColor(color);
      toast.success("Logo saved", { description: `Theme tuned to ${color}` });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateColor() {
    if (!previewUrl) return;
    setBusy(true);
    try {
      const color = await extractDominantColor(previewUrl);
      await update.mutateAsync({ id: school.id, patch: { brand_color: color } as any });
      qc.invalidateQueries({ queryKey: ["my-school-memberships"] });
      setBrandColor(color);
      toast.success(`Theme retuned to ${color}`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not analyse logo");
    } finally {
      setBusy(false);
    }
  }

  async function removeLogo() {
    setBusy(true);
    try {
      await update.mutateAsync({ id: school.id, patch: { logo_url: null } as any });
      qc.invalidateQueries({ queryKey: ["my-school-memberships"] });
      setPreviewUrl(null);
      toast.success("Logo removed");
    } catch (e: any) {
      toast.error(e.message ?? "Could not remove logo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <header>
        <h2 className="font-medium">Branding</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Upload your school logo. We'll pick the best theme colour from it and apply it across the school workspace.
        </p>
      </header>

      <div className="flex items-center gap-4 flex-wrap">
        <div
          className="h-20 w-20 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0"
          style={{ borderColor: brandColor }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt={`${school.name} logo`} className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">No logo</span>
          )}
        </div>

        <div className="flex-1 min-w-[200px] space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="h-5 w-5 rounded-md border"
              style={{ background: brandColor }}
              aria-label="Detected brand colour"
            />
            <Input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              onBlur={async () => {
                if (!/^#[0-9A-Fa-f]{6}$/.test(brandColor)) return;
                await update.mutateAsync({ id: school.id, patch: { brand_color: brandColor } as any });
                qc.invalidateQueries({ queryKey: ["my-school-memberships"] });
              }}
              className="w-32 font-mono text-sm"
              placeholder="#3B82F6"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Colour is picked automatically from the logo. Edit if you'd like to override.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          {previewUrl ? "Replace logo" : "Upload logo"}
        </Button>
        {previewUrl && (
          <>
            <Button variant="outline" onClick={regenerateColor} disabled={busy}>
              <Sparkles className="h-4 w-4 mr-1" /> Re-pick theme colour
            </Button>
            <Button variant="ghost" onClick={removeLogo} disabled={busy}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
