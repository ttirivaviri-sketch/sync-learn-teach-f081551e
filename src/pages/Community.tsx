/**
 * /community — public page for the StudySync WhatsApp study community.
 *
 * Students fill in a short form (name, email, curriculum, grade) which is
 * stored in `public.community_signups`; the WhatsApp invite link is only
 * revealed after a successful submission. Linked from the welcome email.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { MessageCircle, Users, Sparkles, LifeBuoy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";
import { WHATSAPP_COMMUNITY_URL } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";
import { analytics } from "@/utils/analytics";
import { useToast } from "@/hooks/use-toast";

const JOINED_KEY = "studysync.community.joined";

const CURRICULA = ["ZIMSEC", "Cambridge", "CAPS / NSC", "IEB", "Other"] as const;

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100, "Name is too long"),
  email: z.string().trim().email("Please enter a valid email address").max(255),
  curriculum: z.string().trim().min(1, "Please choose your curriculum").max(50),
  grade_level: z.string().trim().min(1, "Please enter your grade or level").max(50),
});

const FAQS: LandingFaq[] = [
  {
    question: "What is the StudySync WhatsApp study community?",
    answer:
      "It's a WhatsApp group for students preparing for their final exams — a place to share notes, study plans and ideas, ask questions and encourage each other through the exam season.",
  },
  {
    question: "Does it cost anything to join?",
    answer:
      "No. The community is completely free and open to every student, whether or not you have a paid StudySync plan.",
  },
  {
    question: "Can I talk to the StudySync team there?",
    answer:
      "Yes. The team is in the group, so you can report glitches in real time and ask for features you'd like added or improved as we build StudySync into the best study platform for students.",
  },
  {
    question: "Which curriculums are welcome?",
    answer:
      "All of them — ZIMSEC O & A Level, Cambridge IGCSE / O Level / A Level, CAPS/NSC Grade 10–12 matric and IEB.",
  },
  {
    question: "What are the rules of the group?",
    answer:
      "The same StudySync Community Guidelines apply: be respectful, keep it academic, no cheating during live exams, and no illegal or copyright-infringing material.",
  },
];

const BENEFITS = [
  {
    icon: Users,
    title: "Study with people writing the same exams",
    detail:
      "Share notes, study plans and past-paper questions with students preparing for the same finals as you.",
  },
  {
    icon: Sparkles,
    title: "Tips that actually move marks",
    detail:
      "Topic breakdowns, revision timetables and exam technique shared by students and the StudySync team.",
  },
  {
    icon: LifeBuoy,
    title: "Talk to the team directly",
    detail:
      "Report a glitch or ask for a feature and get a reply from the people building the app — in real time.",
  },
];

export default function Community() {
  const [params] = useSearchParams();
  const source = params.get("src") || "landing";
  const { toast } = useToast();

  const [joined, setJoined] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", email: "", curriculum: "", grade_level: "" });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    analytics.pageView("community_whatsapp");
    try {
      if (localStorage.getItem(JOINED_KEY) === "1") setJoined(true);
    } catch {
      /* private browsing */
    }
  }, []);

  // Pre-fill for signed-in students.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || cancelled) return;
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setForm((f) => ({
        ...f,
        name: f.name || (profile?.full_name ?? ""),
        email: f.email || (user.email ?? ""),
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v?.[0]) fieldErrors[k] = v[0];
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from("community_signups")
      .upsert(
        { ...parsed.data, email: parsed.data.email.toLowerCase(), user_id: userId, source },
        { onConflict: "email" },
      );
    setSubmitting(false);

    if (error) {
      toast({
        title: "Couldn't save your details",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      return;
    }

    analytics.track?.("community_signup", { source });
    try {
      localStorage.setItem(JOINED_KEY, "1");
    } catch {
      /* ignore */
    }
    setJoined(true);
  };

  const firstName = useMemo(() => form.name.trim().split(" ")[0], [form.name]);

  return (
    <LandingPageLayout
      title="Join the StudySync WhatsApp Study Community"
      description="Join the free StudySync WhatsApp community for students writing finals — share notes and study plans, get exam tips and talk directly to the StudySync team."
      path="/community"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "WhatsApp community", path: "/community" },
      ]}
    >
      {/* Hero + signup */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-emerald-600">
              <MessageCircle className="h-4 w-4" aria-hidden /> Free WhatsApp community
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
              Study for your finals together
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              We're building a WhatsApp community for students preparing for their exams — a place to
              share ideas, notes and study plans, and to encourage each other while studying towards
              finals, as we build StudySync into the best study platform for all students.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              You'll also be able to talk directly to the StudySync team, report glitches in real time
              and tell us which features you'd like added or improved.
            </p>
            <p className="mt-6 text-sm text-gray-500">
              — Ashlie Potera, Founder &amp; the StudySync team
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            {joined ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" aria-hidden />
                <h2 className="text-xl font-bold text-gray-900">
                  You're in{firstName ? `, ${firstName}` : ""}!
                </h2>
                <p className="mt-2 text-gray-600">
                  Tap below to open the group on WhatsApp and say hello.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="mt-6 w-full bg-[#25D366] text-white hover:bg-[#1eb955]"
                >
                  <a href={WHATSAPP_COMMUNITY_URL} target="_blank" rel="noopener noreferrer">
                    Open WhatsApp community
                  </a>
                </Button>
                <p className="mt-4 break-all text-xs text-gray-400">{WHATSAPP_COMMUNITY_URL}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <h2 className="text-xl font-bold text-gray-900">Join the community</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Fill this in and the WhatsApp link appears right away.
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="community-name">Your name</Label>
                    <Input
                      id="community-name"
                      value={form.name}
                      onChange={(e) => set("name")(e.target.value)}
                      maxLength={100}
                      autoComplete="name"
                      className="mt-1.5"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                  </div>

                  <div>
                    <Label htmlFor="community-email">Email</Label>
                    <Input
                      id="community-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email")(e.target.value)}
                      maxLength={255}
                      autoComplete="email"
                      className="mt-1.5"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="community-curriculum">Curriculum</Label>
                    <Select value={form.curriculum} onValueChange={set("curriculum")}>
                      <SelectTrigger id="community-curriculum" className="mt-1.5">
                        <SelectValue placeholder="Choose your curriculum" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRICULA.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.curriculum && (
                      <p className="mt-1 text-sm text-red-600">{errors.curriculum}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="community-grade">Grade / level</Label>
                    <Input
                      id="community-grade"
                      value={form.grade_level}
                      onChange={(e) => set("grade_level")(e.target.value)}
                      placeholder="e.g. Grade 12, Form 4, A Level"
                      maxLength={50}
                      className="mt-1.5"
                    />
                    {errors.grade_level && (
                      <p className="mt-1 text-sm text-red-600">{errors.grade_level}</p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="mt-6 w-full bg-[#25D366] text-white hover:bg-[#1eb955]"
                >
                  {submitting ? "Joining…" : "Get the WhatsApp link"}
                </Button>
                <p className="mt-3 text-center text-xs text-gray-400">
                  We'll only use your details to run the community and send study updates.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            What happens inside the group
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="rounded-2xl border border-gray-200 bg-white p-6">
                <Icon className="mb-3 h-6 w-6 text-emerald-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-gray-500">
            Group conduct follows our{" "}
            <Link to="/legal/community" className="text-blue-600 underline">
              Community Guidelines
            </Link>
            .
          </p>
        </div>
      </section>
    </LandingPageLayout>
  );
}
