import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LibraryResource, AcademicProfile } from "@/types/academicProfile";
import { logger } from "@/utils/logger";

/** Try to extract a video URL from a text string (description, summary, etc.) */
const extractVideoUrl = (text: string | null | undefined): string | undefined => {
  if (!text) return undefined;
  // Match common video platforms and direct video file URLs.
  // Handles youtube.com/shorts/ID?si=xxx, youtu.be/ID, vimeo.com/ID, etc.
  const match = text.match(
    /https?:\/\/(?:(?:www\.)?youtube\.com\/(?:watch\?[^\s)"']*|shorts\/[^\s)"']*|embed\/[^\s)"']*|live\/[^\s)"']*)|youtu\.be\/[^\s)"']*|(?:www\.)?vimeo\.com\/[^\s)"']*|(?:www\.)?loom\.com\/share\/[^\s)"']*|[^\s)"']*supabase\.co[^\s)"']*\/storage\/[^\s)"']*|[^\s)"']*\.(?:mp4|webm|mov|m4v|ogg)(?:\?[^\s)"']*)?)/i
  );
  return match ? match[0] : undefined;
};

const normalizeText = (value: string | null | undefined) => (value || "").trim().toLowerCase();

const hasGradeOverlap = (resourceGrades: string[] | undefined, learnerGrade: string | null | undefined) => {
  if (!resourceGrades?.length || !learnerGrade) return true;
  const target = normalizeText(learnerGrade);
  return resourceGrades.some((grade) => normalizeText(grade) === target);
};

const matchesSubject = (resource: LibraryResource, subjects: string[] | null | undefined) => {
  if (!subjects?.length) return true;
  const resourceSubject = normalizeText(resource.tags?.subject || resource.category);

  return subjects.some((subject) => {
    const normalized = normalizeText(subject);
    return (
      resourceSubject === normalized ||
      resourceSubject.includes(normalized) ||
      normalized.includes(resourceSubject)
    );
  });
};

// ─── Seed data (used when Supabase table doesn't have items yet) ──────────────
// This mirrors the database structure and allows the UI to work offline/dev mode

const SEED_TUTORIALS: LibraryResource[] = [
  {
    id: "t1",
    title: "Solving Quadratic Equations Step by Step",
    author: "Sarah Ndlovu",
    type: "video",
    category: "Mathematics",
    gradeLevel: "Grade 10-12 / Form 3-4",
    summary: "Master the quadratic formula and factoring methods with worked examples from past papers.",
    rating: 4.9,
    reviews: 312,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "22 min",
    isTutorial: true,
    watchCount: 4210,
    completionRate: 87,
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    tags: { subject: "Mathematics", topic: "Algebra", subtopic: "Quadratic Equations", grade: "Form 4", curriculum: "ZIMSEC" },
    tutor: { id: "tutor-1", name: "Sarah Ndlovu", rating: 4.9, topic_rating: 4.9, reviews: 312 },
  },
  {
    id: "t2",
    title: "Trigonometry: Sin, Cos & Tan Explained",
    author: "Michael Chen",
    type: "video",
    category: "Mathematics",
    gradeLevel: "Grade 10-12 / Form 3-4",
    summary: "Visual breakdown of trigonometric ratios, unit circle, and common exam pitfalls.",
    rating: 4.8,
    reviews: 241,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "18 min",
    isTutorial: true,
    watchCount: 3890,
    completionRate: 82,
    videoUrl: "https://vimeo.com/76979871",
    tags: { subject: "Mathematics", topic: "Trigonometry", grade: "Form 4", curriculum: "ZIMSEC" },
    tutor: { id: "tutor-2", name: "Michael Chen", rating: 4.8, topic_rating: 4.8, reviews: 241 },
  },
  {
    id: "t3",
    title: "Newton's Laws of Motion - Exam Ready",
    author: "David Patel",
    type: "video",
    category: "Physics",
    gradeLevel: "Grade 11-12 / Form 4-6",
    summary: "All three Newton's laws with real-world examples and past paper question walkthroughs.",
    rating: 4.7,
    reviews: 198,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "25 min",
    isTutorial: true,
    watchCount: 2940,
    completionRate: 79,
    videoUrl: "https://www.loom.com/share/8f6f6f6f6f6f4a1ea9f1e123456789ab",
    tags: { subject: "Physics", topic: "Mechanics", subtopic: "Newton's Laws", grade: "Form 5", curriculum: "ZIMSEC" },
    tutor: { id: "tutor-3", name: "David Patel", rating: 4.7, topic_rating: 4.7, reviews: 198 },
  },
  {
    id: "t4",
    title: "Organic Chemistry: Functional Groups",
    author: "Amina Hassan",
    type: "video",
    category: "Chemistry",
    gradeLevel: "Grade 12 / Form 5-6",
    summary: "Comprehensive guide to identifying and naming organic functional groups for ZIMSEC & IGCSE.",
    rating: 4.8,
    reviews: 156,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "30 min",
    isTutorial: true,
    watchCount: 2100,
    completionRate: 75,
    tags: { subject: "Chemistry", topic: "Organic Chemistry", subtopic: "Functional Groups", grade: "Form 6", curriculum: "ZIMSEC" },
    tutor: { id: "tutor-4", name: "Amina Hassan", rating: 4.8, topic_rating: 4.8, reviews: 156 },
  },
  {
    id: "t5",
    title: "Photosynthesis & Respiration Compared",
    author: "Grace Moyo",
    type: "video",
    category: "Biology",
    gradeLevel: "Grade 10-12 / Form 3-6",
    summary: "Side-by-side comparison of both processes, diagrams, equations, and exam tips.",
    rating: 4.6,
    reviews: 173,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "20 min",
    isTutorial: true,
    watchCount: 1870,
    completionRate: 80,
    tags: { subject: "Biology", topic: "Cell Biology", subtopic: "Photosynthesis", grade: "Form 4", curriculum: "ZIMSEC" },
    tutor: { id: "tutor-5", name: "Grace Moyo", rating: 4.6, topic_rating: 4.6, reviews: 173 },
  },
  {
    id: "b1",
    title: "ZIMSEC Mathematics Past Papers 2018-2023",
    author: "ZIMSEC Examination Board",
    type: "pastpaper",
    category: "Mathematics",
    gradeLevel: "Form 4",
    summary: "Complete collection of O-Level Mathematics past papers with marking schemes.",
    rating: 4.9,
    reviews: 1820,
    thumbnail: "/placeholder.svg",
    isOffline: true,
    duration: "120+ questions",
    tags: { subject: "Mathematics", topic: "All Topics", grade: "Form 4", curriculum: "ZIMSEC" },
  },
  {
    id: "b2",
    title: "Physics Revision Guide - O Level",
    author: "Dr. Tendai Mutasa",
    type: "book",
    category: "Physics",
    gradeLevel: "Form 3-4",
    summary: "Comprehensive notes, diagrams and practice questions aligned to the ZIMSEC syllabus.",
    rating: 4.7,
    reviews: 634,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "3 hr read",
    tags: { subject: "Physics", topic: "All Topics", grade: "Form 4", curriculum: "ZIMSEC" },
  },
  {
    id: "b3",
    title: "English Language: Essay Techniques",
    author: "Rudo Chigwada",
    type: "guide",
    category: "English",
    gradeLevel: "Form 3-6",
    summary: "Step-by-step essay structures, vocabulary building and marking criteria explained.",
    rating: 4.5,
    reviews: 429,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "1.5 hr read",
    tags: { subject: "English Language", topic: "Writing", subtopic: "Essays", grade: "Form 4", curriculum: "ZIMSEC" },
  },
  {
    id: "b4",
    title: "NSC Mathematics Past Papers 2019-2023",
    author: "Department of Basic Education",
    type: "pastpaper",
    category: "Mathematics",
    gradeLevel: "Grade 12",
    summary: "Full set of Matric Mathematics papers 1 & 2 with memoranda.",
    rating: 4.9,
    reviews: 2310,
    thumbnail: "/placeholder.svg",
    isOffline: true,
    duration: "150+ questions",
    tags: { subject: "Mathematics", topic: "All Topics", grade: "Grade 12", curriculum: "NSC" },
  },
  {
    id: "t6",
    title: "Accounting: Balance Sheet & Income Statement",
    author: "Tafadzwa Mutisi",
    type: "video",
    category: "Accounts",
    gradeLevel: "Form 3-4",
    summary: "Preparing financial statements from trial balance — step-by-step with worked examples.",
    rating: 4.7,
    reviews: 267,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "28 min",
    isTutorial: true,
    watchCount: 3100,
    completionRate: 83,
    tags: { subject: "Accounts", topic: "Financial Statements", grade: "Form 4", curriculum: "ZIMSEC" },
    tutor: { id: "tutor-6", name: "Tafadzwa Mutisi", rating: 4.7, topic_rating: 4.7, reviews: 267 },
  },
];

interface UseLibraryResourcesReturn {
  allResources: LibraryResource[];
  personalizedResources: LibraryResource[];
  recommendedTutorials: LibraryResource[];
  pastPapers: LibraryResource[];
  topTutors: LibraryResource[];
  searchResults: LibraryResource[];
  loading: boolean;
  search: (query: string) => void;
  getBySubject: (subject: string) => LibraryResource[];
  getByTopic: (topic: string) => LibraryResource[];
}

export function useLibraryResources(
  academicProfile?: AcademicProfile | null
): UseLibraryResourcesReturn {
  const [dbResources, setDbResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dbFetched, setDbFetched] = useState(false);

  // Show only DB resources once fetched; show seed data only as initial loading placeholder
  const allResources: LibraryResource[] = dbFetched
    ? dbResources
    : SEED_TUTORIALS;

  // Fetch tutor-uploaded tutorials AND PDFs from Supabase
  useEffect(() => {
    const fetchLibraryResources = async () => {
      setLoading(true);
      try {
        const [tutorialsResult, systemResourcesResult] = await Promise.all([
          supabase
            .from("tutor_tutorials")
          .select(
            `id, title, subject, topic, subtopic, grade, curriculum,
             description, rating, review_count, thumbnail_url,
             duration_label, video_url, watch_count, completion_rate,
             tutor_id, content_type, pdf_url, resource_category`
          )
          .eq("status", "published")
            .order("created_at", { ascending: false }),
          supabase
            .from("library_system_resources")
            .select(
              `id, title, subject, curriculum, grade_levels, topic,
               kind, description, pages, thumbnail_url, pdf_url, view_count`
            )
            .order("created_at", { ascending: false }),
        ]);

        const { data: directData, error: directError } = tutorialsResult;
        const { data: systemData, error: systemError } = systemResourcesResult;

        if (directError && systemError) {
          logger.warn("tutor_tutorials direct query failed:", directError.message);
          logger.warn("library_system_resources query failed:", systemError.message);
          setDbFetched(true);
          return;
        }

        // Fetch all tutor profiles in one query for author display
        const tutorIds = Array.from(
          new Set((directData as any[] | null)?.map((r) => r.tutor_id).filter(Boolean) ?? [])
        );
        let profilesById: Record<string, { full_name: string | null; avatar_url: string | null; is_official: boolean }> = {};
        if (tutorIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, is_official")
            .in("id", tutorIds);
          (profilesData as any[] | null)?.forEach((p) => {
            profilesById[p.id] = {
              full_name: p.full_name,
              avatar_url: p.avatar_url,
              is_official: p.is_official === true,
            };
          });
        }

        const mappedTutorials: LibraryResource[] = ((directData as any[]) || []).map((row) => {
          const profile = profilesById[row.tutor_id];
          const isOfficial = profile?.is_official === true;
          const displayName = isOfficial
            ? "studysyncofficial"
            : profile?.full_name || "Unknown";
          const isPdf = row.content_type === "pdf";
          const resourceType: LibraryResource["type"] = isPdf
            ? row.resource_category === "past_paper"
              ? "pastpaper"
              : row.resource_category === "notes"
              ? "guide"
              : "book"
            : "video";

          return {
            id: row.id,
            title: row.title,
            author: displayName,
            type: resourceType,
            category: row.subject || "General",
            gradeLevel: row.grade || "All Grades",
            summary: row.description || "",
            rating: row.rating || 0,
            reviews: row.review_count || 0,
            thumbnail: row.thumbnail_url || "/placeholder.svg",
            isOffline: false,
            duration: row.duration_label || (isPdf ? "PDF" : "Video"),
            isTutorial: !isPdf,
            watchCount: row.watch_count || 0,
            completionRate: row.completion_rate || 0,
            videoUrl: isPdf
              ? row.pdf_url || undefined
              : row.video_url ||
                extractVideoUrl(row.description) ||
                extractVideoUrl(row.title) ||
                undefined,
            tags: {
              subject: row.subject,
              topic: row.topic,
              subtopic: row.subtopic,
              grade: row.grade,
              curriculum: row.curriculum,
            },
            tutor: isPdf
              ? undefined
              : {
                  id: row.tutor_id,
                  name: displayName,
                  avatar_url: profile?.avatar_url || undefined,
                  rating: row.rating || 0,
                  reviews: row.review_count || 0,
                },
          };
        });

        const mappedSystemResources: LibraryResource[] = ((systemData as any[]) || []).map((row) => {
          const isPastPaper = row.kind === "past_paper";
          const gradeLevels = Array.isArray(row.grade_levels) ? row.grade_levels : [];

          return {
            id: row.id,
            title: row.title,
            author: row.curriculum,
            type: isPastPaper ? "pastpaper" : "book",
            category: row.subject || "General",
            gradeLevel: gradeLevels.join(" • ") || "All Grades",
            summary: row.description || "",
            rating: 0,
            reviews: row.view_count || 0,
            thumbnail: row.thumbnail_url || "/placeholder.svg",
            isOffline: false,
            duration: row.pages ? `${row.pages} pages` : "PDF",
            isTutorial: false,
            videoUrl: row.pdf_url,
            tags: {
              subject: row.subject || "General",
              topic: row.topic || "All Topics",
              grade: gradeLevels[0] || "All Grades",
              curriculum: row.curriculum,
            },
          };
        });

        const mapped = [...mappedTutorials, ...mappedSystemResources];

        logger.info(
          "[useLibraryResources] Library resources:",
          mapped.length,
          "videos:",
          mapped.filter((r) => r.type === "video").length,
          "documents:",
          mapped.filter((r) => r.type !== "video").length
        );
        setDbResources(mapped);
        setDbFetched(true);
      } catch (err) {
        logger.warn("Tutorial fetch error (non-critical):", err);
        setDbFetched(true);
      } finally {
        setLoading(false);
      }
    };

    fetchLibraryResources();

    const channel = supabase
      .channel("library-tutorials-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tutor_tutorials" },
        () => {
          fetchLibraryResources();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "library_system_resources" },
        () => {
          fetchLibraryResources();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Personalization logic ─────────────────────────────────────────────────

  const personalizedResources = academicProfile
    ? allResources.filter((r) => {
        if (!r.tags) return true;
        const matchCurriculum =
          !r.tags.curriculum || normalizeText(r.tags.curriculum) === normalizeText(academicProfile.curriculum);
        const matchGrade = hasGradeOverlap(
          r.gradeLevel.split("•").map((grade) => grade.trim()).filter(Boolean),
          academicProfile.grade
        );
        const matchSubjects = matchesSubject(r, academicProfile.subjects);

        return matchCurriculum && matchGrade && matchSubjects;
      })
    : allResources;

  const recommendedTutorials = allResources.filter((r) => r.isTutorial);

  const pastPapers = allResources.filter(
    (r) => r.type === "pastpaper" || r.category.toLowerCase().includes("past paper")
  );

  const topTutors = allResources
    .filter((r) => r.isTutorial && r.tutor)
    .sort((a, b) => (b.tutor?.rating || 0) - (a.tutor?.rating || 0));

  // ── Search ────────────────────────────────────────────────────────────────

  const searchResults = searchQuery.trim()
    ? personalizedResources.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.author.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.tags?.subject.toLowerCase().includes(q) ||
          r.tags?.topic?.toLowerCase().includes(q) ||
          r.tags?.subtopic?.toLowerCase().includes(q) ||
          false
        );
      })
    : [];

  const getBySubject = useCallback(
    (subject: string) =>
      allResources.filter(
        (r) =>
          r.category.toLowerCase() === subject.toLowerCase() ||
          r.tags?.subject.toLowerCase() === subject.toLowerCase()
      ),
    [allResources]
  );

  const getByTopic = useCallback(
    (topic: string) =>
      allResources.filter(
        (r) =>
          r.tags?.topic?.toLowerCase().includes(topic.toLowerCase()) ||
          r.title.toLowerCase().includes(topic.toLowerCase())
      ),
    [allResources]
  );

  return {
    allResources,
    personalizedResources,
    recommendedTutorials,
    pastPapers,
    topTutors,
    searchResults,
    loading,
    search: setSearchQuery,
    getBySubject,
    getByTopic,
  };
}
