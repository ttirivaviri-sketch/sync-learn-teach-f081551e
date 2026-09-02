import { useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import {
  Search, Filter, Book, FileText, Video, BookOpen,
  Archive, Brain, Sparkles, X, ChevronRight, Shapes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { TopicTutorRack } from "@/components/TopicTutorRack";
import { useLibraryResources } from "@/hooks/useLibraryResources";
import { useResourceEngagement } from "@/hooks/useResourceEngagement";
import type { AcademicProfile, LibraryResource } from "@/types/academicProfile";

// Sub-components
import { ResourceCard } from "@/components/library/ResourceCard";
import { ContentRack } from "@/components/library/ContentRack";
import { SearchResultsView } from "@/components/library/SearchResultsView";
import { VideoPlayerOverlay } from "@/components/library/VideoPlayerOverlay";
import { StuckPrompt } from "@/components/library/StuckPrompt";
import { StudyClipsFeed } from "@/components/library/StudyClipsFeed";
import { PosterCard } from "@/components/library/PosterCard";
import { DocumentViewerOverlay } from "@/components/library/DocumentViewerOverlay";
import { DiagramViewerOverlay } from "@/components/library/DiagramViewerOverlay";
import { ClipsTopicBrowser } from "@/components/library/ClipsTopicBrowser";
import { MatchExplanation } from "@/components/library/MatchExplanation";

// Study Mode is a top-level nav tab now — no in-Library toggle needed.

interface StudySyncLibraryProps {
  academicProfile?: AcademicProfile | null;
  onBookTutor?: (tutorId: string, tutorName: string) => void;
  onNeedHelp?: () => void;
  onEditProfile?: () => void;
}

const StudySyncLibrary = ({
  academicProfile,
  onBookTutor,
  onNeedHelp,
  onEditProfile,
}: StudySyncLibraryProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    savedIds: myLibraryItems,
    likedIds,
    lastOpened,
    toggleSave,
    toggleLike,
    recordOpen,
    recordWatch,
    watchCounts,
    loaded: engagementLoaded,
  } = useResourceEngagement();
  // Frozen ordering inputs for the Clips feed. The feed derives the current
  // slide from scroll offset, so re-sorting mid-watch (when a watch/like is
  // recorded) yanks the viewer to a different clip. Capture the engagement
  // snapshot once when it first loads; likes/watches still update instantly
  // everywhere else (icons, counts, saved lists).
  const frozenEngagementRef = useRef<{ liked: string[]; watched: Record<string, number> } | null>(null);
  if (frozenEngagementRef.current === null && engagementLoaded) {
    frozenEngagementRef.current = { liked: likedIds, watched: watchCounts };
  }
  const orderLikedIds = frozenEngagementRef.current?.liked ?? [];
  const orderWatchCounts = frozenEngagementRef.current?.watched ?? {};
  // studyModeActive removed — Study Mode is a top-level nav tab now.
  const [activeCategory, setActiveCategory] = useState("all");
  const [previousCategory, setPreviousCategory] = useState("all");
  const [activeVideoResource, setActiveVideoResource] = useState<LibraryResource | null>(null);
  const [activeDocument, setActiveDocument] = useState<{ resource: LibraryResource } | null>(null);
  const [activeDiagram, setActiveDiagram] = useState<LibraryResource | null>(null);
  const [reelsFeedOpen, setReelsFeedOpen] = useState(false);
  const [reelsStartIndex, setReelsStartIndex] = useState(0);
  // Scoped reels: which clip list the feed plays (a topic shelf, the
  // personalized set, or everything). null = default tutorialFeed.
  const [reelsFeedVideos, setReelsFeedVideos] = useState<LibraryResource[] | null>(null);
  const [reelsContextLabel, setReelsContextLabel] = useState<string | undefined>(undefined);
  // Working filters (applied to search results): resource type + subject
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  const {
    allResources,
    personalizedResources,
    pastPapers,
    topTutors,
    searchResults,
    loading,
    search,
    getMatchStatsFor,
  } = useLibraryResources(academicProfile);

  // Defensive: anything that looks like a video URL is never a book
  const VIDEO_URL_RE = /(youtube\.com|youtu\.be|vimeo\.com|loom\.com|\.(mp4|webm|mov|m4v)(\?|$))/i;
  const isClip = (r: LibraryResource) =>
    !!r.isTutorial || r.type === "video" || (!!r.videoUrl && VIDEO_URL_RE.test(r.videoUrl));
  const isBookish = (r: LibraryResource) =>
    !isClip(r) && (r.type === "book" || r.type === "guide");
  const isDiagram = (r: LibraryResource) => r.type === "diagram";

  // Diagrams rack: personalized first, then everything else (deduped)
  const personalizedDiagrams = personalizedResources.filter(isDiagram);
  const personalizedDiagramIds = new Set(personalizedDiagrams.map((r) => r.id));
  const diagramFeed = [
    ...personalizedDiagrams,
    ...allResources.filter((r) => isDiagram(r) && !personalizedDiagramIds.has(r.id)),
  ];

  // Clips feed: personalized clips first, then every other uploaded/seeded clip
  // (deduped) — so new uploads always land in the Clips feed instead of Browse.
  // Watch-history ordering: unwatched clips surface first; liked float up.
  const engagementOrder = (a: LibraryResource, b: LibraryResource) => {
    const wa = orderWatchCounts[String(a.id)] ?? 0;
    const wb = orderWatchCounts[String(b.id)] ?? 0;
    if ((wa === 0) !== (wb === 0)) return wa === 0 ? -1 : 1;
    const la = orderLikedIds.includes(String(a.id)) ? 1 : 0;
    const lb = orderLikedIds.includes(String(b.id)) ? 1 : 0;
    return lb - la;
  };
  const personalizedClips = personalizedResources.filter(isClip).sort(engagementOrder);
  const personalizedClipIds = new Set(personalizedClips.map((r) => r.id));
  const tutorialFeed = [
    ...personalizedClips,
    ...allResources.filter((r) => isClip(r) && !personalizedClipIds.has(r.id)),
  ];

  // Per-tab match diagnostics for empty-state explanations
  const tutorialStats = getMatchStatsFor(isClip);
  const bookStats = getMatchStatsFor(isBookish);
  const paperStats = getMatchStatsFor(
    (r) => r.type === "pastpaper" || (r.category || "").toLowerCase().includes("past paper")
  );


  // Tabs handler: "tutorials" now lands on the topic-first browser
  // (subject → topic shelves) instead of a single ~2,000-clip firehose.
  const handleTabChange = (next: string) => {
    if (next === "tutorials") {
      if (tutorialFeed.length > 0) {
        setPreviousCategory(activeCategory);
        setActiveCategory("tutorials");
      } else {
        // Build a precise reason string from match stats
        let reason = "No clips have been uploaded yet — tutors are adding more weekly.";
        if (academicProfile) {
          if (tutorialStats.blockedBySubject > 0) {
            reason = `${tutorialStats.blockedBySubject} clip${tutorialStats.blockedBySubject === 1 ? "" : "s"} exist for ${academicProfile.curriculum} ${academicProfile.grade}, but in subjects you haven't picked.`;
          } else if (tutorialStats.blockedByGrade > 0) {
            reason = `${tutorialStats.blockedByGrade} clip${tutorialStats.blockedByGrade === 1 ? "" : "s"} match your subjects but not grade "${academicProfile.grade}".`;
          } else if (tutorialStats.blockedByCurriculum > 0) {
            reason = `${tutorialStats.blockedByCurriculum} clip${tutorialStats.blockedByCurriculum === 1 ? "" : "s"} match your subjects but are tagged for a different curriculum.`;
          } else {
            reason = `No ${academicProfile.curriculum} ${academicProfile.grade} clips for your subjects yet.`;
          }
        } else {
          reason = "Set your curriculum, grade and subjects to see clips for your syllabus.";
        }
        dispatchToast("No clips match your profile", reason);
        // Also navigate to "all" so the inline MatchExplanation card is visible
        setPreviousCategory(activeCategory);
        setActiveCategory("all");
      }
      return;
    }
    setPreviousCategory(activeCategory);
    setActiveCategory(next);
  };

  // Content-type switcher — spec p.4: Books / Clips / Papers / Saved pills (+ Browse home)
  const categories = [
    { id: "all", name: "Browse", icon: BookOpen, color: "text-primary" },
    { id: "books", name: "Books", icon: Book, color: "text-secondary" },
    { id: "tutorials", name: "Clips", icon: Video, color: "text-rose-500" },
    { id: "papers", name: "Papers", icon: FileText, color: "text-accent-foreground" },
    { id: "diagrams", name: "Diagrams", icon: Shapes, color: "text-emerald-600" },
    { id: "mylibrary", name: "Saved", icon: Archive, color: "text-purple-600" },
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────

  // Debounce the expensive 6.5k-row filter pass; input stays instant.
  const [debouncedSearch] = useDebouncedCallback((value: string) => search(value), 250);
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const TYPE_FILTERS = [
    { id: "video", label: "Clips" },
    { id: "book", label: "Books" },
    { id: "pastpaper", label: "Past Papers" },
    { id: "diagram", label: "Diagrams" },
  ];

  const subjectOptions = useMemo(() => {
    const subjects = new Set<string>();
    for (const r of allResources) {
      const s = r.tags?.subject || r.category;
      if (s && s !== "General") subjects.add(s);
    }
    return Array.from(subjects).sort();
  }, [allResources]);

  const applyFilters = (items: LibraryResource[]) =>
    items.filter((r) => {
      if (typeFilter && !(typeFilter === "book" ? r.type === "book" || r.type === "guide" : r.type === typeFilter)) return false;
      if (subjectFilter && (r.tags?.subject || r.category) !== subjectFilter) return false;
      return true;
    });

  const activeFilterCount = (typeFilter ? 1 : 0) + (subjectFilter ? 1 : 0);

  const dispatchToast = (title: string, description: string) => {
    window.dispatchEvent(
      new CustomEvent("show-toast", { detail: { title, description } })
    );
  };

  // Source discriminator for the engagement table.
  const sourceOf = (r: LibraryResource): "system" | "tutorial" =>
    r.pdfSource === "tutorial" || r.tutor ? "tutorial" : "system";

  const findResource = (id: string) =>
    allResources.find((r) => String(r.id) === id);

  const addToLibrary = (resourceId: string, resourceTitle: string) => {
    if (!myLibraryItems.includes(resourceId)) {
      const r = findResource(resourceId);
      toggleSave(resourceId, r ? sourceOf(r) : "system");
      dispatchToast("Added to Library!", `${resourceTitle} saved to your library`);
    }
  };

  const removeFromLibrary = (resourceId: string) => {
    if (myLibraryItems.includes(resourceId)) {
      const r = findResource(resourceId);
      toggleSave(resourceId, r ? sourceOf(r) : "system");
    }
  };

  const downloadResource = (id: string, title: string) => {
    // Real download: open the attached file (PDFs) in a new tab / trigger save.
    const r = findResource(id);
    const fileUrl = r?.videoUrl; // for documents videoUrl carries the pdf/file url
    if (r && ["book", "guide", "pastpaper", "pdf"].includes(r.type) && fileUrl) {
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = `${title}.pdf`;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      dispatchToast("Download Started", `${title} is downloading`);
    } else {
      dispatchToast("No file to download", "This resource doesn't have a downloadable file.");
    }
  };

  const openResource = (resource: LibraryResource) => {
    recordOpen(String(resource.id), sourceOf(resource));
    // AI study diagrams open in the diagram viewer with the explain chat.
    if (resource.type === "diagram") {
      setActiveDiagram(resource);
      return;
    }

    // Documents (books, guides, past papers) open in the protected in-app viewer.
    if (["book", "guide", "pastpaper", "pdf"].includes(resource.type)) {
      const extra = resource as unknown as Record<string, unknown>;
      const hasFile =
        !!resource.videoUrl ||
        typeof extra.pdf_url === "string" ||
        typeof extra.url === "string";
      if (hasFile && resource.pdfSource) {
        setActiveDocument({ resource });
        dispatchToast("Opening Resource", `Loading ${resource.title}...`);
      } else {
        dispatchToast("File not available", "This resource doesn't have an attached file yet.");
      }
      return;
    }

    let videoUrl = resource.videoUrl;
    if (!videoUrl && resource.type === "video") {
      const videoUrlRegex =
        /https?:\/\/(?:(?:www\.)?youtube\.com\/(?:watch\?[^\s)"']*|shorts\/[^\s)"']*|embed\/[^\s)"']*|live\/[^\s)"']*)|youtu\.be\/[^\s)"']*|(?:www\.)?vimeo\.com\/[^\s)"']*|(?:www\.)?loom\.com\/share\/[^\s)"']*|[^\s)"']*supabase\.co[^\s)"']*\/storage\/[^\s)"']*|[^\s)"']*\.(?:mp4|webm|mov|m4v|ogg)(?:\?[^\s)"']*)?)/i;
      const extra = resource as unknown as Record<string, unknown>;
      const textsToSearch = [
        resource.summary,
        resource.title,
        typeof extra.description === "string" ? extra.description : null,
        typeof extra.url === "string" ? extra.url : null,
      ].filter(Boolean) as string[];
      for (const text of textsToSearch) {
        const match = text.match(videoUrlRegex);
        if (match) { videoUrl = match[0]; break; }
      }
    }
    if (resource.type === "video" && videoUrl) {
      const idx = tutorialFeed.findIndex((r) => String(r.id) === String(resource.id));
      if (idx >= 0 && tutorialFeed.length > 0) {
        setReelsFeedVideos(null); // full feed, starting at this clip
        setReelsContextLabel(undefined);
        setReelsStartIndex(idx);
        setReelsFeedOpen(true);
      } else {
        setActiveVideoResource({ ...resource, videoUrl });
      }
      return;
    }

    dispatchToast("No Video URL", "This tutorial doesn't have a playable link yet.");
  };

  const handleBookTutor = (tutorId: string, tutorName: string) => {
    if (onBookTutor) {
      onBookTutor(tutorId, tutorName);
    } else {
      dispatchToast("Book Tutor", `Opening ${tutorName}'s profile...`);
    }
  };

  // Shared props for all ResourceCard / ContentRack usage
  const cardActions = {
    onOpen: openResource,
    onBookTutor: handleBookTutor,
    onDownload: downloadResource,
    onAddToLibrary: addToLibrary,
    onRemoveFromLibrary: removeFromLibrary,
  };

  const rackProps = { myLibraryItems, ...cardActions };

  const myLibraryResources = allResources.filter((r) =>
    myLibraryItems.includes(String(r.id))
  );

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">


      {/* ── Search Bar ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search topics, subjects, tutorials..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-3"
              onClick={() => handleSearch("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative" aria-label="Filter resources">
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Type</p>
              <div className="flex flex-wrap gap-1.5">
                {TYPE_FILTERS.map((t) => (
                  <Badge
                    key={t.id}
                    variant={typeFilter === t.id ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setTypeFilter(typeFilter === t.id ? null : t.id)}
                  >
                    {t.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Subject</p>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {subjectOptions.map((s) => (
                  <Badge
                    key={s}
                    variant={subjectFilter === s ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSubjectFilter(subjectFilter === s ? null : s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => { setTypeFilter(null); setSubjectFilter(null); }}
              >
                Clear filters
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Single filter row — spec p.4: curriculum/grade context + subject chips merged into one row ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {academicProfile ? (
          <>
            <Badge variant="default" className="whitespace-nowrap cursor-default shrink-0">
              {academicProfile.curriculum} · {academicProfile.grade}
            </Badge>
            {academicProfile.subjects.map((s) => (
              <Badge key={s} variant="outline" className="whitespace-nowrap cursor-pointer shrink-0" onClick={() => handleSearch(s)}>
                {s}
              </Badge>
            ))}
          </>
        ) : (
          <>
            <Badge variant="secondary">All Grades</Badge>
            <Badge variant="outline">Mathematics</Badge>
            <Badge variant="outline">Physics</Badge>
            <Badge variant="outline">Chemistry</Badge>
            <Badge variant="outline">Past Papers</Badge>
          </>
        )}
      </div>

      {/* ── Search Results — also shown when filters are active without a query ── */}
      {searchQuery.trim() || activeFilterCount > 0 ? (
        <SearchResultsView
          searchQuery={searchQuery.trim() ? searchQuery : "Filtered resources"}
          searchResults={applyFilters(searchQuery.trim() ? searchResults : allResources)}
          myLibraryItems={myLibraryItems}
          onNeedHelp={onNeedHelp}
          onEnterStudyMode={() => dispatchToast("Open the Study tab", "Study Mode now lives in the bottom nav — tap the Study tab.")}
          {...cardActions}
        />
      ) : (
        <>
          {/* ── Library Tabs ── */}
          <Tabs value={activeCategory} onValueChange={handleTabChange} className="w-full">
            <TabsList className="flex w-full justify-start gap-1.5 overflow-x-auto bg-transparent p-0 h-auto scrollbar-none">
              {categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Browse Tab */}
            <TabsContent value="all" className="space-y-6 mt-4">
              {loading && (
                <div className="space-y-5" aria-busy="true" aria-label="Loading library">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <div className="flex gap-3 overflow-hidden">
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-36 w-64 shrink-0 rounded-xl" />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex gap-3 overflow-hidden">
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-52 w-36 shrink-0 rounded-xl" />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Continue Reading — gradient banner (spec p.4) */}
              {(() => {
                // Continue Reading = the book the learner most recently OPENED,
                // falling back to saved/personalized picks.
                const openedBooks = Object.entries(lastOpened)
                  .sort((a, b) => (a[1] < b[1] ? 1 : -1))
                  .map(([id]) => findResource(id))
                  .filter((r): r is LibraryResource => !!r && isBookish(r));
                const continueBook =
                  openedBooks[0] ??
                  myLibraryResources.find(isBookish) ??
                  personalizedResources.find(isBookish);
                if (!continueBook) return null;
                return (
                  <button
                    onClick={() => openResource(continueBook)}
                    className="w-full flex items-center gap-3 rounded-2xl px-4 py-4 text-left shadow-md transition-transform active:scale-[0.99]"
                    style={{ background: 'linear-gradient(135deg, hsl(228 89% 60%), hsl(248 88% 64%))' }}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 shrink-0">
                      <Book className="h-5 w-5 text-white" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-white/70">Continue reading</span>
                      <span className="block text-sm font-semibold text-white truncate">{continueBook.title}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-white/80 shrink-0" />
                  </button>
                );
              })()}

              {academicProfile && (
                <ContentRack title="Recommended for You" items={personalizedResources.filter((r) => !isClip(r)).slice(0, 4)} icon={Sparkles} {...rackProps} />
              )}
              {/* Videos live in the Clips feed, not Browse — teaser opens the reels */}
              {tutorialFeed.length > 0 && (
                <button
                  onClick={() => handleTabChange("tutorials")}
                  className="w-full flex items-center gap-3 rounded-2xl px-4 py-4 text-left shadow-md transition-transform active:scale-[0.99]"
                  style={{ background: 'linear-gradient(135deg, hsl(340 82% 58%), hsl(20 90% 60%))' }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 shrink-0">
                    <Video className="h-5 w-5 text-white" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-white/70">Study Clips</span>
                    <span className="block text-sm font-semibold text-white truncate">
                      {tutorialFeed.length} clip{tutorialFeed.length === 1 ? "" : "s"} — browse by topic
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-white/80 shrink-0" />
                </button>
              )}
              {topTutors.length > 0 && (
                <TopicTutorRack
                  title="Popular Tutors"
                  subtitle="Highest-rated educators on StudySync"
                  tutors={topTutors.slice(0, 3)}
                  onBookTutor={handleBookTutor}
                  onWatchTutorial={openResource}
                />
              )}
              {/* Study Skills rack — visible to everyone regardless of profile */}
              {allResources.filter(
                (r) =>
                  (r.category || "").toLowerCase().includes("study skill") ||
                  (r.tags?.subject || "").toLowerCase().includes("study skill")
              ).length > 0 && (
                <ContentRack
                  title="How to Study"
                  items={allResources.filter(
                    (r) =>
                      (r.category || "").toLowerCase().includes("study skill") ||
                      (r.tags?.subject || "").toLowerCase().includes("study skill")
                  ).slice(0, 6)}
                  icon={Brain}
                  {...rackProps}
                />
              )}
              <ContentRack title="Past Exam Papers" items={pastPapers.slice(0, 4)} icon={FileText} {...rackProps} />
              {diagramFeed.length > 0 && (
                <ContentRack
                  title="Study Diagrams"
                  subtitle="AI-illustrated diagrams you can ask questions about"
                  items={diagramFeed.slice(0, 4)}
                  icon={Shapes}
                  {...rackProps}
                />
              )}
              <ContentRack title="All Resources" items={allResources.filter((r) => !isClip(r) && !isDiagram(r)).slice(0, 4)} icon={BookOpen} {...rackProps} />
              <StuckPrompt onNeedHelp={onNeedHelp} onEnterStudyMode={() => dispatchToast("Open the Study tab", "Study Mode now lives in the bottom nav — tap the Study tab.")} />
            </TabsContent>

            {/* Tutorials Tab — topic-first browser: subject → topic shelves
                that open the reels scoped to just that topic. */}
            <TabsContent value="tutorials" className="mt-4">
              {tutorialFeed.length > 0 ? (
                <ClipsTopicBrowser
                  clips={tutorialFeed}
                  personalizedClips={personalizedClips}
                  academicProfile={academicProfile}
                  onOpenFeed={(videos, startIndex, label) => {
                    setReelsFeedVideos(videos);
                    setReelsContextLabel(label);
                    setReelsStartIndex(startIndex);
                    setReelsFeedOpen(true);
                  }}
                />
              ) : (
                <MatchExplanation
                  stats={tutorialStats}
                  profile={academicProfile}
                  resourceLabel="clips"
                  onEditProfile={onEditProfile}
                />
              )}
            </TabsContent>

            {/* Books Tab — Netflix-style poster racks (strict personalization) */}
            <TabsContent value="books" className="space-y-5 mt-4">
              {(() => {
                const allBooks = personalizedResources.filter(isBookish);


                // Separate study-skills guides from subject-specific books
                const studySkillsBooks = allBooks.filter(
                  (r) =>
                    (r.category || "").toLowerCase().includes("study skill") ||
                    (r.tags?.subject || "").toLowerCase().includes("study skill")
                );
                const subjectBooks = allBooks.filter(
                  (r) =>
                    !(r.category || "").toLowerCase().includes("study skill") &&
                    !(r.tags?.subject || "").toLowerCase().includes("study skill")
                );

                const hasSubjectBooks = subjectBooks.length > 0;
                const hasStudySkills = studySkillsBooks.length > 0;

                if (!academicProfile || (!hasSubjectBooks && !hasStudySkills)) {
                  return (
                    <MatchExplanation
                      stats={bookStats}
                      profile={academicProfile}
                      resourceLabel="books"
                      onEditProfile={onEditProfile}
                    />
                  );
                }

                // Group subject books by subject for Netflix-style racks
                const bySubject = subjectBooks.reduce<Record<string, LibraryResource[]>>(
                  (acc, b) => {
                    const k = b.category || "General";
                    (acc[k] ||= []).push(b);
                    return acc;
                  },
                  {}
                );

                return (
                  <>
                    {/* ── Study Skills rack always shown first ── */}
                    {hasStudySkills && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-500" />
                          <h3 className="font-semibold text-sm">How to Study &amp; Study Skills</h3>
                          <span className="text-xs text-muted-foreground ml-1">
                            — Free for all students
                          </span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                          {studySkillsBooks.map((r) => (
                            <PosterCard
                              key={String(r.id)}
                              resource={r}
                              variant="portrait"
                              onOpen={openResource}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Subject-specific books ── */}
                    {Object.entries(bySubject).map(([subject, items]) => (
                      <div key={subject} className="space-y-2">
                        <h3 className="font-semibold text-sm">{subject}</h3>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                          {items.map((r) => (
                            <PosterCard
                              key={String(r.id)}
                              resource={r}
                              variant="portrait"
                              onOpen={openResource}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </TabsContent>

            {/* Past Papers Tab — Netflix-style poster racks */}
            <TabsContent value="papers" className="space-y-5 mt-4">
              {!academicProfile || pastPapers.length === 0 ? (
                <MatchExplanation
                  stats={paperStats}
                  profile={academicProfile}
                  resourceLabel="past papers"
                  onEditProfile={onEditProfile}
                />
              ) : (
                Object.entries(
                  pastPapers.reduce<Record<string, LibraryResource[]>>((acc, p) => {
                    const k = p.category || "General";
                    (acc[k] ||= []).push(p);
                    return acc;
                  }, {})
                ).map(([subject, items]) => (
                  <div key={subject} className="space-y-2">
                    <h3 className="font-semibold text-sm">{subject}</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                      {items.map((r) => (
                        <PosterCard
                          key={String(r.id)}
                          resource={r}
                          variant="landscape"
                          onOpen={openResource}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Diagrams Tab — subject-grouped poster racks */}
            <TabsContent value="diagrams" className="space-y-5 mt-4">
              {diagramFeed.length === 0 ? (
                <MatchExplanation
                  stats={getMatchStatsFor(isDiagram)}
                  profile={academicProfile}
                  resourceLabel="diagrams"
                  onEditProfile={onEditProfile}
                />
              ) : (
                Object.entries(
                  diagramFeed.reduce<Record<string, LibraryResource[]>>((acc, d) => {
                    const k = d.category || "General";
                    (acc[k] ||= []).push(d);
                    return acc;
                  }, {})
                ).map(([subject, items]) => (
                  <div key={subject} className="space-y-2">
                    <h3 className="font-semibold text-sm">{subject}</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                      {items.map((r) => (
                        <PosterCard
                          key={String(r.id)}
                          resource={r}
                          variant="landscape"
                          onOpen={openResource}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* My Library Tab */}
            <TabsContent value="mylibrary" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  My Library
                  {myLibraryItems.length > 0 && (
                    <span className="text-muted-foreground font-normal"> ({myLibraryItems.length})</span>
                  )}
                </h3>
              </div>
              {myLibraryResources.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myLibraryResources.map((r) => (
                    <ResourceCard
                      key={String(r.id)}
                      resource={r}
                      isInLibrary
                      {...cardActions}
                    />
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/30">
                  <CardContent className="p-6 text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <h4 className="font-medium mb-2">Your Library is Empty</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Bookmark resources from other tabs to build your collection.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setActiveCategory("all")}>
                      Browse Resources
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Video Player Overlay */}
      {activeVideoResource && (
        <VideoPlayerOverlay
          resource={activeVideoResource}
          onClose={() => setActiveVideoResource(null)}
          onBookTutor={handleBookTutor}
        />
      )}

      {activeDocument && (
        <DocumentViewerOverlay
          resource={activeDocument.resource}
          onClose={() => setActiveDocument(null)}
        />
      )}

      {/* Diagram Viewer + Explain chat */}
      {activeDiagram && (
        <DiagramViewerOverlay
          resource={activeDiagram}
          academicProfile={academicProfile}
          onClose={() => setActiveDiagram(null)}
        />
      )}

      {/* Study Clips Feed — plays a scoped list (topic shelf / For You) or the full feed */}
      {reelsFeedOpen && (reelsFeedVideos ?? tutorialFeed).length > 0 && (
        <StudyClipsFeed
          videos={reelsFeedVideos ?? tutorialFeed}
          startIndex={reelsStartIndex}
          onClose={() => { setReelsFeedOpen(false); setReelsFeedVideos(null); setReelsContextLabel(undefined); }}
          onBookTutor={handleBookTutor}
          onAddToLibrary={addToLibrary}
          onRemoveFromLibrary={removeFromLibrary}
          myLibraryItems={myLibraryItems}
          likedItems={likedIds}
          onToggleLike={(id) => {
            const r = findResource(id);
            toggleLike(id, r ? sourceOf(r) : "system");
          }}
          contextLabel={reelsContextLabel}
          onWatch={(id) => {
            const r = findResource(id);
            recordWatch(id, r ? sourceOf(r) : "system");
          }}
        />
      )}

      {/* Featured Banner */}
      {!searchQuery && (
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-primary">StudySync Library</h3>
                <p className="text-sm text-muted-foreground">{allResources.length}+ educational resources</p>
              </div>
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Library Copyright & Disclaimer Footer ──────────────────────────── */}
      <div className="mt-6 rounded-lg border border-border/60 bg-muted/30 px-4 py-4 text-center space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Copyright &amp; Content Policy
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          StudySync does <strong>not</strong> sell, license, or claim ownership of any third-party
          educational material published in this Library. All resources — including past papers,
          syllabi, textbooks and reference guides — remain the intellectual property of their
          respective authors and publishers. This material is made available{" "}
          <strong>free of charge, for educational purposes only</strong>, under fair-dealing
          provisions for private study and research. No subscription fee paid to StudySync
          constitutes payment for any publisher's work.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Rights holders who wish to request a takedown or attribution change may contact{" "}
          <a
            href="mailto:supportstudysync@gmail.com"
            className="text-primary underline hover:text-primary/80"
          >
            supportstudysync@gmail.com
          </a>
          . See our full{" "}
          <a
            href="/legal/library"
            className="text-primary underline hover:text-primary/80"
          >
            Library Disclaimer
          </a>{" "}
          and{" "}
          <a
            href="/legal/copyright"
            className="text-primary underline hover:text-primary/80"
          >
            Copyright &amp; Takedown Policy
          </a>{" "}
          for details.
        </p>
      </div>
    </div>
  );
};

export default StudySyncLibrary;
