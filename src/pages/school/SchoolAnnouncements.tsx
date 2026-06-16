/**
 * School-wide announcements feed. Admins & teachers can post (audience: school).
 * Members see everything they're allowed to (RLS-scoped).
 */
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pin, Loader2 } from "lucide-react";
import { useAnnouncements, useCreateAnnouncement } from "@/hooks/useSchoolAcademics";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function SchoolAnnouncements() {
  const { school, role } = useOutletContext<{ school: any; role: string }>();
  const list = useAnnouncements({ schoolId: school.id });
  const create = useCreateAnnouncement();
  const canPost = role === "school_admin" || role === "school_teacher";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">Announcements</h1>

      {canPost && (
        <Card className="p-4 space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Important update" />
          <Label>Message</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          <div className="flex justify-end">
            <Button
              disabled={!title.trim() || !body.trim() || create.isPending}
              onClick={async () => {
                await create.mutateAsync({ school_id: school.id, title: title.trim(), body: body.trim(), audience: "school" });
                setTitle(""); setBody(""); toast.success("Posted");
              }}
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Post to whole school
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {list.isLoading && <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</p>}
        {list.data?.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
        {list.data?.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {a.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}{a.title}
                </h3>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })} · {a.audience}</p>
              </div>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{a.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
