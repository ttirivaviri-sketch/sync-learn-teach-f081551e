import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LibraryResource, AcademicProfile } from "@/types/academicProfile";

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
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Merge seed + DB resources
  const allResources: LibraryResource[] = [...SEED_TUTORIALS, ...dbResources];

  // Fetch tutor-uploaded tutorials from Supabase
  useEffect(() => {
    const fetchTutorials = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("tutor_tutorials")
          .select("*, tutor_profile:profiles(id, full_name, avatar_url)")
          .eq("status", "published")
          .order("created_at", { ascending: false });

        if (error) {
          // Table may not exist yet — silently ignore
          console.warn("tutor_tutorials table not yet created:", error.message);
          return;
        }

        if (data) {
          const mapped: LibraryResource[] = data.map((row: any) => ({
            id: row.id,
            title: row.title,
            author: row.tutor_profile?.full_name || "Tutor",
            type: "video" as const,
            category: row.subject,
            gradeLevel: row.grade || "All Grades",
            summary: row.description || "",
            rating: row.rating || 0,
            reviews: row.review_count || 0,
            thumbnail: row.thumbnail_url || "/placeholder.svg",
            isOffline: false,
            duration: row.duration_label || "Video",
            isTutorial: true,
            watchCount: row.watch_count || 0,
            completionRate: row.completion_rate || 0,
            videoUrl: row.video_url || undefined,
            tags: {
              subject: row.subject,
              topic: row.topic,
              subtopic: row.subtopic,
              grade: row.grade,
              curriculum: row.curriculum,
            },
            tutor: {
              id: row.tutor_profile?.id || row.tutor_id,
              name: row.tutor_profile?.full_name || "Tutor",
              avatar_url: row.tutor_profile?.avatar_url,
              rating: row.rating || 0,
              reviews: row.review_count || 0,
            },
          }));
          setDbResources(mapped);
        }
      } catch (err) {
        console.warn("Tutorial fetch error (non-critical):", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTutorials();
  }, []);

  // ── Personalization logic ─────────────────────────────────────────────────

  const personalizedResources = academicProfile
    ? allResources.filter((r) => {
        if (!r.tags) return true;
        const matchSubject = academicProfile.subjects.some((s) =>
          r.tags!.subject.toLowerCase().includes(s.toLowerCase()) ||
          s.toLowerCase().includes(r.tags!.subject.toLowerCase())
        );
        const matchCurriculum =
          !r.tags.curriculum || r.tags.curriculum === academicProfile.curriculum;
        return matchSubject || matchCurriculum;
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
    ? allResources.filter((r) => {
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
