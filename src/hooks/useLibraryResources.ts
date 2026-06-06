import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LibraryResource, AcademicProfile } from "@/types/academicProfile";
import { logger } from "@/utils/logger";
import {
  curriculumMatches as curriculumMatchesShared,
  gradeMatches as gradeMatchesShared,
  subjectMatches as subjectMatchesShared,
} from "@/lib/personalization";

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

// Re-exports from shared personalization library so callers within this
// module can keep using the original local names.
const curriculumMatches = curriculumMatchesShared;
const gradeMatches = (resourceGrades: string[] | undefined, learnerGrade: string | null | undefined) =>
  gradeMatchesShared(resourceGrades, learnerGrade);
const subjectMatches = (resource: LibraryResource, subjects: string[] | null | undefined) =>
  subjectMatchesShared(resource.tags?.subject || resource.category, subjects);

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

// ─── Study-skills seed books (always shown regardless of DB migration state) ──
// These are merged into allResources after every DB fetch so the
// "How to Study & Study Skills" rack is always visible to every learner.
// Once the DB migration runs, duplicates are deduplicated by id prefix "ss-".
const SEED_STUDY_SKILLS: LibraryResource[] = [
  {
    id: "ss-1",
    title: "College Success — How to Study, Manage Time & Thrive",
    author: "OpenStax",
    type: "book",
    category: "Study Skills",
    gradeLevel: "Grade 8 • Grade 9 • Grade 10 • Grade 11 • Grade 12 • O-Level • A-Level • IGCSE",
    summary:
      "The definitive open-access guide to studying smarter: time management, memory techniques, note-taking, test prep, goal setting and managing stress. Trusted by millions globally. CC-BY.",
    rating: 4.9,
    reviews: 0,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "PDF",
    isTutorial: false,
    watchCount: 0,
    completionRate: 0,
    videoUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/College_Success_-_WEB.pdf",
    pdfSource: "system",
    tags: { subject: "Study Skills", topic: "Study Techniques & Time Management", grade: "Grade 10", curriculum: undefined },
  },
  {
    id: "ss-2",
    title: "College Success Concise — Essential Study Skills",
    author: "OpenStax",
    type: "book",
    category: "Study Skills",
    gradeLevel: "Grade 8 • Grade 9 • Grade 10 • Grade 11 • Grade 12 • O-Level • A-Level",
    summary:
      "Shorter companion to College Success covering the most essential study strategies, time management and academic habits for high-school and first-year university students. CC-BY.",
    rating: 4.8,
    reviews: 0,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "PDF",
    isTutorial: false,
    watchCount: 0,
    completionRate: 0,
    videoUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/college-success-concise_-_WEB.pdf",
    pdfSource: "system",
    tags: { subject: "Study Skills", topic: "Study Techniques & Time Management", grade: "Grade 10", curriculum: undefined },
  },
  {
    id: "ss-3",
    title: "Writing Guide with Handbook — Academic Writing & Research",
    author: "OpenStax",
    type: "book",
    category: "Study Skills",
    gradeLevel: "Grade 10 • Grade 11 • Grade 12 • O-Level • A-Level • IGCSE • AS Level",
    summary:
      "Comprehensive guide to academic writing: essays, research papers, citations, critical reading and communication skills essential for exam success. CC-BY.",
    rating: 4.7,
    reviews: 0,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "PDF",
    isTutorial: false,
    watchCount: 0,
    completionRate: 0,
    videoUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/writing-guide-with-handbook_-_WEB.pdf",
    pdfSource: "system",
    tags: { subject: "Study Skills", topic: "Academic Writing & Research", grade: "Grade 11", curriculum: undefined },
  },
  {
    id: "ss-4",
    title: "Psychology 2e — Memory, Learning & Motivation",
    author: "OpenStax",
    type: "book",
    category: "Study Skills",
    gradeLevel: "Grade 10 • Grade 11 • Grade 12 • O-Level • A-Level • IGCSE",
    summary:
      "Understand how memory, attention and motivation work — then use that knowledge to study more effectively. Chapters on memory, learning, thinking and intelligence. CC-BY.",
    rating: 4.8,
    reviews: 0,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "PDF",
    isTutorial: false,
    watchCount: 0,
    completionRate: 0,
    videoUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/psychology-2e_-_WEB.pdf",
    pdfSource: "system",
    tags: { subject: "Study Skills", topic: "Memory & Motivation", grade: "Grade 11", curriculum: undefined },
  },
  {
    id: "ss-5",
    title: "Principles of Management — Goal Setting & Planning",
    author: "OpenStax",
    type: "book",
    category: "Study Skills",
    gradeLevel: "Grade 10 • Grade 11 • Grade 12 • A-Level • IGCSE • Form 4 • Form 5 • Form 6",
    summary:
      "Develop planning, goal-setting and self-management skills that translate directly to academic success: prioritisation, productivity frameworks and decision-making under pressure. CC-BY.",
    rating: 4.6,
    reviews: 0,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "PDF",
    isTutorial: false,
    watchCount: 0,
    completionRate: 0,
    videoUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/principles-management_-_WEB.pdf",
    pdfSource: "system",
    tags: { subject: "Study Skills", topic: "Goal Setting & Planning", grade: "Grade 12", curriculum: undefined },
  },
  {
    id: "ss-6",
    title: "Business Ethics — Critical Thinking & Problem Solving",
    author: "OpenStax",
    type: "book",
    category: "Study Skills",
    gradeLevel: "Grade 11 • Grade 12 • A-Level • IGCSE • Form 5 • Form 6",
    summary:
      "Build critical thinking, ethical reasoning and structured problem-solving skills — all transferable to any exam subject. Essential for top marks on analytical questions. CC-BY.",
    rating: 4.5,
    reviews: 0,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "PDF",
    isTutorial: false,
    watchCount: 0,
    completionRate: 0,
    videoUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/business-ethics_-_WEB.pdf",
    pdfSource: "system",
    tags: { subject: "Study Skills", topic: "Critical Thinking & Ethics", grade: "Grade 12", curriculum: undefined },
  },
  {
    id: "ss-7",
    title: "How to Study — A Classic Practical Guide",
    author: "Arthur C. Bragdon",
    type: "book",
    category: "Study Skills",
    gradeLevel: "Grade 8 • Grade 9 • Grade 10 • Grade 11 • Grade 12 • All Grades",
    summary:
      "A timeless, no-nonsense guide to effective studying: how to read actively, take useful notes, prepare for exams, and avoid common study mistakes. Public domain. Free for all.",
    rating: 4.6,
    reviews: 0,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "Web",
    isTutorial: false,
    watchCount: 0,
    completionRate: 0,
    videoUrl: "https://www.gutenberg.org/files/16317/16317-h/16317-h.htm",
    pdfSource: "system",
    tags: { subject: "Study Skills", topic: "Study Techniques", grade: "Grade 10", curriculum: undefined },
  },
  {
    id: "ss-8",
    title: "Introductory Statistics 2e — Logical Thinking with Data",
    author: "OpenStax",
    type: "book",
    category: "Study Skills",
    gradeLevel: "Grade 10 • Grade 11 • Grade 12 • A-Level • IGCSE • Form 5 • Form 6",
    summary:
      "Learn to think logically and analytically using data — a skill that supercharges performance in science, economics, business and maths. CC-BY.",
    rating: 4.6,
    reviews: 0,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "PDF",
    isTutorial: false,
    watchCount: 0,
    completionRate: 0,
    videoUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/introductory-statistics-2e_-_WEB.pdf",
    pdfSource: "system",
    tags: { subject: "Study Skills", topic: "Logical Thinking & Data", grade: "Grade 12", curriculum: undefined },
  },
];

export interface LibraryMatchStats {
  total: number;
  matchedAll: number;
  matchedCurriculum: number;
  matchedGrade: number;
  matchedSubject: number;
  // Counts of resources that match every filter EXCEPT the named one — these are
  // the items the learner is "just missing" because of that single mismatch.
  blockedByCurriculum: number;
  blockedByGrade: number;
  blockedBySubject: number;
  // Distinct values seen on resources that already match curriculum+grade —
  // useful to suggest "we have <subject>, but you didn't pick it".
  availableSubjects: string[];
  availableGrades: string[];
  availableCurricula: string[];
}

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
  /** Per-filter match diagnostics for empty-state explanations. */
  matchStats: LibraryMatchStats;
  /** Same as matchStats, but scoped to a single resource type (book/pastpaper/video). */
  getMatchStatsFor: (predicate: (r: LibraryResource) => boolean) => LibraryMatchStats;
}

export function useLibraryResources(
  academicProfile?: AcademicProfile | null
): UseLibraryResourcesReturn {
  const [dbResources, setDbResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dbFetched, setDbFetched] = useState(false);

  // Show only DB resources once fetched; show seed data only as initial loading placeholder.
  // Study-skills seeds are ALWAYS merged in (deduplicated by id) so the rack is visible
  // even before the DB migration has run on the remote instance.
  const allResources: LibraryResource[] = (() => {
    if (dbFetched) {
      // DB is the source of truth — Study Skills books now seeded in DB with real UUIDs.
      return dbResources;
    }
    // Pre-fetch placeholders only (seeds have non-UUID ids and can't be streamed).
    return [...SEED_TUTORIALS, ...SEED_STUDY_SKILLS];
  })();


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
            pdfSource: isPdf ? "tutorial" : undefined,
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
          const isVideo = row.kind === "video";
          const gradeLevels = Array.isArray(row.grade_levels) ? row.grade_levels : [];

          return {
            id: row.id,
            title: row.title,
            author: row.curriculum,
            type: isVideo ? "video" : isPastPaper ? "pastpaper" : "book",
            category: row.subject || "General",
            gradeLevel: gradeLevels.join(" • ") || "All Grades",
            summary: row.description || "",
            rating: 0,
            reviews: row.view_count || 0,
            thumbnail: row.thumbnail_url || "/placeholder.svg",
            isOffline: false,
            duration: isVideo ? "Video" : row.pages ? `${row.pages} pages` : "PDF",
            isTutorial: isVideo,
            videoUrl: row.pdf_url,
            pdfSource: isVideo ? undefined : "system",
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

  // Study-skills / how-to-study guides are cross-curriculum and cross-subject.
  // They should always appear for any learner regardless of subject selection.
  const isStudySkillsResource = (r: LibraryResource): boolean =>
    (r.category || "").toLowerCase().includes("study skill") ||
    (r.tags?.subject || "").toLowerCase().includes("study skill") ||
    (r.tags?.topic || "").toLowerCase().includes("study technique") ||
    (r.tags?.topic || "").toLowerCase().includes("time management") ||
    (r.tags?.topic || "").toLowerCase().includes("college success");

  // Strict personalization for subject-specific resources.
  // Study-skills guides bypass the subject filter (they're universal).
  const personalizedResources = academicProfile
    ? allResources.filter((r) => {
        if (!r.tags) return false;

        // Study-skills books: only filter by curriculum + grade (not subject)
        if (isStudySkillsResource(r)) {
          const matchCurriculum = curriculumMatches(r.tags.curriculum, academicProfile.curriculum);
          const gradePool = [
            r.tags?.grade,
            ...(r.gradeLevel ? r.gradeLevel.split(/[•·]/) : []),
          ]
            .map((g) => (g || "").trim())
            .filter(Boolean) as string[];
          const matchGrade = gradeMatches(gradePool, academicProfile.grade);
          return matchCurriculum && matchGrade;
        }

        // All other resources: strict curriculum + grade + subject matching
        const matchCurriculum = curriculumMatches(r.tags.curriculum, academicProfile.curriculum);
        const gradePool = [
          r.tags?.grade,
          ...(r.gradeLevel ? r.gradeLevel.split(/[•·]/) : []),
        ]
          .map((g) => (g || "").trim())
          .filter(Boolean) as string[];
        const matchGrade = gradeMatches(gradePool, academicProfile.grade);
        const matchSubject = subjectMatches(r, academicProfile.subjects);
        return matchCurriculum && matchGrade && matchSubject;
      })
    : [];

  const visibleResources = personalizedResources;

  const recommendedTutorials = visibleResources.filter((r) => r.isTutorial);

  const pastPapers = visibleResources.filter(
    (r) =>
      r.type === "pastpaper" ||
      (r.category || "").toLowerCase().includes("past paper")
  );

  const topTutors = visibleResources
    .filter((r) => r.isTutorial && r.tutor)
    .sort((a, b) => (b.tutor?.rating || 0) - (a.tutor?.rating || 0));

  // ── Match diagnostics ─────────────────────────────────────────────────────
  const computeStats = useCallback(
    (predicate?: (r: LibraryResource) => boolean): LibraryMatchStats => {
      const pool = predicate ? allResources.filter(predicate) : allResources;
      const empty: LibraryMatchStats = {
        total: pool.length,
        matchedAll: 0,
        matchedCurriculum: 0,
        matchedGrade: 0,
        matchedSubject: 0,
        blockedByCurriculum: 0,
        blockedByGrade: 0,
        blockedBySubject: 0,
        availableSubjects: [],
        availableGrades: [],
        availableCurricula: [],
      };
      if (!academicProfile) return empty;

      const subjects = new Set<string>();
      const grades = new Set<string>();
      const curricula = new Set<string>();

      for (const r of pool) {
        if (!r.tags) continue;
        const cur = curriculumMatches(r.tags.curriculum, academicProfile.curriculum);
        const gradePool = [
          r.tags?.grade,
          ...(r.gradeLevel ? r.gradeLevel.split(/[•·]/) : []),
        ]
          .map((g) => (g || "").trim())
          .filter(Boolean) as string[];
        const grd = gradeMatches(gradePool, academicProfile.grade);
        const sub = subjectMatches(r, academicProfile.subjects);

        if (cur) empty.matchedCurriculum++;
        if (grd) empty.matchedGrade++;
        if (sub) empty.matchedSubject++;
        if (cur && grd && sub) empty.matchedAll++;
        if (!cur && grd && sub) empty.blockedByCurriculum++;
        if (cur && !grd && sub) empty.blockedByGrade++;
        if (cur && grd && !sub) empty.blockedBySubject++;

        // Collect what's available within learner's curriculum+grade scope
        if (cur && grd) {
          const s = (r.tags?.subject || r.category || "").trim();
          if (s) subjects.add(s);
        }
        if (cur) gradePool.forEach((g) => grades.add(g));
        if (r.tags?.curriculum) curricula.add(r.tags.curriculum);
      }

      empty.availableSubjects = [...subjects].sort();
      empty.availableGrades = [...grades].sort();
      empty.availableCurricula = [...curricula].sort();
      return empty;
    },
    [allResources, academicProfile]
  );

  const matchStats = computeStats();
  const getMatchStatsFor = useCallback(
    (predicate: (r: LibraryResource) => boolean) => computeStats(predicate),
    [computeStats]
  );



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
    matchStats,
    getMatchStatsFor,
  };
}
