import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface BlogComment {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
}

const MAX_LENGTH = 2000;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const BlogComments = ({ postSlug }: { postSlug: string }) => {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authorName, setAuthorName] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: BlogComment[] | null; error: unknown }>)("get_blog_comments", {
      _post_slug: postSlug,
    });
    if (!error && data) setComments(data);
    setLoading(false);
  }, [postSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) {
      setAuthorName("");
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      const fallback = session?.user?.email?.split("@")[0] ?? "";
      setAuthorName((data?.full_name || fallback).trim());
    })();
    return () => {
      active = false;
    };
  }, [userId, session?.user?.email]);

  const remaining = MAX_LENGTH - body.length;
  const canSubmit = useMemo(() => body.trim().length > 0 && remaining >= 0 && !submitting, [body, remaining, submitting]);

  const handleSubmit = async () => {
    if (!userId || !canSubmit) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("blog_comments")
      .insert({
        post_slug: postSlug,
        user_id: userId,
        author_name: authorName || "StudySync reader",
        body: body.trim(),
      })
      .select("id, user_id, author_name, body, created_at")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("Could not post your comment", { description: "Please try again in a moment." });
      return;
    }
    setComments((prev) => [data as BlogComment, ...prev]);
    setBody("");
    toast.success("Comment posted");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("blog_comments").delete().eq("id", id);
    if (error) {
      toast.error("Could not remove that comment");
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <section aria-labelledby="comments-heading" className="mt-14 border-t border-border pt-10">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" aria-hidden />
        <h2 id="comments-heading" className="pt-0 text-2xl font-extrabold text-foreground">
          Join the conversation{comments.length > 0 ? ` (${comments.length})` : ""}
        </h2>
      </div>

      {userId ? (
        <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 sm:p-5">
          <label htmlFor="blog-comment" className="text-sm font-semibold text-foreground">
            Share your thoughts
          </label>
          <Textarea
            id="blog-comment"
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, MAX_LENGTH + 1))}
            placeholder="What stood out for you in this article?"
            rows={4}
            className="mt-3 bg-background"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className={`text-xs ${remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {remaining < 0 ? `${Math.abs(remaining)} characters too many` : `${remaining} characters left`}
            </p>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="rounded-full">
              {submitting ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Sign in to share your thoughts on this article.</p>
          <Button asChild className="rounded-full">
            <Link to="/learner/auth">Sign in to comment</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {loading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet — be the first to share your thoughts.</p>
        )}
        {comments.map((comment) => (
          <article key={comment.id} className="flex gap-4">
            <div
              aria-hidden
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
            >
              {initialsOf(comment.author_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <strong className="text-foreground">{comment.author_name}</strong>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <time dateTime={comment.created_at} className="text-muted-foreground">
                  {formatDate(comment.created_at)}
                </time>
                {comment.user_id === userId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-[0.975rem] leading-7 text-foreground/85">{comment.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default BlogComments;
