import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LEGAL_LAST_UPDATED, COMPANY } from "@/lib/legal";
import { Seo } from "@/components/Seo";

interface Props {
  title: string;
  /** Optional page-specific meta description; falls back to a title-derived one. */
  description?: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, description, children }: Props) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${title} — ${COMPANY.name}`}
        description={
          description ??
          `Read the ${title.toLowerCase()} for ${COMPANY.name}, the AI study and tutoring platform for students in South Africa and Zimbabwe.`
        }
        path={pathname}
        type="article"
      />
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to {COMPANY.name}
          </Link>
          <span className="text-xs text-muted-foreground">Last updated: {LEGAL_LAST_UPDATED}</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-6">{title}</h1>
        <article className="prose prose-sm sm:prose-base max-w-none dark:prose-invert space-y-4 text-foreground/90">
          {children}
        </article>
        <footer className="mt-12 pt-6 border-t text-xs text-muted-foreground">
          Questions? Contact <a className="underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        </footer>
      </main>
    </div>
  );
}
