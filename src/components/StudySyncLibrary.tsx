import { useState, lazy, Suspense } from "react";
import {
  Search, Filter, Book, FileText, Video, BookOpen,
  Archive, Brain, Loader2, GraduationCap, Sparkles, X, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TopicTutorRack } from "@/components/TopicTutorRack";
import { useLibraryResources } from "@/hooks/useLibraryResources";
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
import { MatchExplanation } from "@/components/library/MatchExplanation";

// Lazy-load Study Mode only when the toggle is activated
const StudyModeWrapper = lazy(() =>
  import("@/studymode/StudyModeWrapper").then((m) => ({ default: m.StudyModeWrapper }))
);

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
  const [myLibraryItems, setMyLibraryItems] = useState<string[]>([]);
  const [studyModeActive, setStudyModeActive] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [previousCategory, setPreviousCategory] = useState("all");
  const [activeVideoResource, setActiveVideoResource] = useState<LibraryResource | null>(null);
  const [activeDocument, setActiveDocument] = useState<{ resource: LibraryResource } | null>(null);
  const [reelsFeedOpen, setReelsFeedOpen] = useState(false);
  const [reelsStartIndex, setReelsStartIndex] = useState(0);

  const {
    allResources,
    personalizedResources,
    recommendedTutorials,
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

  // Strict personalization: only show content matching learner's syllabus + grade + subjects
  const tutorialFeed = personalizedResources.filter(isClip);

  // Per-tab match diagnostics for empty-state explanations
  const tutorialStats = getMatchStatsFor(isClip);
  const bookStats = getMatchStatsFor(isBookish);
  const paperStats = getMatchStatsFor(
    (r) => r.type === "pastpaper" || (r.category || "").toLowerCase().includes("past paper")
  );


  // Tabs handler: when user picks "tutorials", drop them straight into the carousel
  const handleTabChange = (next: string) => {
    if (next === "tutorials") {
      if (tutorialFeed.length > 0) {
        setReelsStartIndex(0);
        setReelsFeedOpen(true);
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

  const categories = [
    { id: "all", name: "Browse", icon: BookOpen, color: "text-primary" },
    { id: "tutorials", name: "Tutorials", icon: Video, color: "text-emerald-600" },
    { id: "books", name: "Books", icon: Book, color: "text-secondary" },
    { id: "papers", name: "Past Papers", icon: FileText, color: "text-accent" },
    { id: "mylibrary", name: "My Library", icon: Archive, color: "text-purple-600" },
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    search(value);
  };

  const dispatchToast = (title: string, description: string) => {
    window.dispatchEvent(
      new CustomEvent("show-toast", { detail: { title, description } })
    );
  };

  const addToLibrary = (resourceId: string, resourceTitle: string) => {
    if (!myLibraryItems.includes(resourceId)) {
      setMyLibraryItems((prev) => [...prev, resourceId]);
      dispatchToast("Added to Library!", `${resourceTitle} saved to your library`);
    }
  };

  const removeFromLibrary = (resourceId: string) => {
    setMyLibraryItems((prev) => prev.filter((id) => id !== resourceId));
  };

  const downloadResource = (_id: string, title: string) => {
    dispatchToast("Download Started", `${title} is being downloaded for offline access`);
  };

  const openResource = (resource: LibraryResource) => {
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

  // ── StudyMode full-screen ───────────────────────────────────────────────
  if (studyModeActive) {
    return (
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading Study Mode…</p>
          </div>
        }
      >
        <StudyModeWrapper
          onDeactivate={() => setStudyModeActive(false)}
          onNeedHelp={onNeedHelp}
          onBrowseLibrary={() => { setStudyModeActive(false); setActiveCategory("all"); }}
          academicProfile={academicProfile}
        />
      </Suspense>
    );
  }

  const myLibraryResources = allResources.filter((r) =>
    myLibraryItems.includes(String(r.id))
  );

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Study Mode Banner ── */}
      <Card className="bg-gradient-to-r from-violet-500/10 via-primary/10 to-blue-500/10 border-primary/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm leading-tight">Study Mode</h3>
                <p className="text-xs text-muted-foreground leading-tight truncate">
                  AI-powered coaching, tasks &amp; exam prep
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Label htmlFor="study-mode-toggle" className="text-xs font-medium cursor-pointer select-none">
                {studyModeActive ? "On" : "Off"}
              </Label>
              <Switch
                id="study-mode-toggle"
                checked={studyModeActive}
                onCheckedChange={setStudyModeActive}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Academic Profile Badge ── */}
      {academicProfile && (
        <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/10">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex flex-wrap gap-1.5 flex-1">
                <Badge variant="secondary" className="text-xs">{academicProfile.curriculum}</Badge>
                <Badge variant="secondary" className="text-xs">{academicProfile.grade}</Badge>
                {academicProfile.subjects.slice(0, 3).map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                ))}
                {academicProfile.subjects.length > 3 && (
                  <Badge variant="outline" className="text-xs">+{academicProfile.subjects.length - 3}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <button className="absolute right-3 top-3" onClick={() => handleSearch("")}>
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Quick Curriculum Filters ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {academicProfile ? (
          <>
            <Badge variant="default" className="whitespace-nowrap cursor-default">
              {academicProfile.curriculum} · {academicProfile.grade}
            </Badge>
            {academicProfile.subjects.map((s) => (
              <Badge key={s} variant="outline" className="whitespace-nowrap cursor-pointer" onClick={() => handleSearch(s)}>
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

      {/* ── Search Results ── */}
      {searchQuery.trim() ? (
        <SearchResultsView
          searchQuery={searchQuery}
          searchResults={searchResults}
          myLibraryItems={myLibraryItems}
          onNeedHelp={onNeedHelp}
          onEnterStudyMode={() => setStudyModeActive(true)}
          {...cardActions}
        />
      ) : (
        <>
          {/* ── Library Tabs ── */}
          <Tabs value={activeCategory} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-5 text-xs">
              {categories.map((category) => (
                <TabsTrigger key={category.id} value={category.id} className="text-xs">
                  <category.icon className={`h-4 w-4 mr-1 ${category.color}`} />
                  <span className="hidden sm:inline">{category.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Browse Tab */}
            <TabsContent value="all" className="space-y-6 mt-4">
              {loading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              {academicProfile && (
                <ContentRack title="Recommended for You" items={personalizedResources.slice(0, 4)} icon={Sparkles} {...rackProps} />
              )}
              <ContentRack title="Top Tutorial Videos" items={recommendedTutorials.slice(0, 4)} icon={Video} {...rackProps} />
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
                  title="How to Study & Study Skills"
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
              <ContentRack title="All Resources" items={allResources.slice(0, 4)} icon={BookOpen} {...rackProps} />
              <StuckPrompt onNeedHelp={onNeedHelp} onEnterStudyMode={() => setStudyModeActive(true)} />
            </TabsContent>

            {/* Tutorials Tab — handled via handleTabChange (auto-opens carousel).
                If empty, surface the inline match-reason card here too. */}
            <TabsContent value="tutorials" className="mt-4">
              <MatchExplanation
                stats={tutorialStats}
                profile={academicProfile}
                resourceLabel="clips"
                onEditProfile={onEditProfile}
              />
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

      {/* Study Clips Feed */}
      {reelsFeedOpen && tutorialFeed.length > 0 && (
        <StudyClipsFeed
          videos={tutorialFeed}
          startIndex={reelsStartIndex}
          onClose={() => setReelsFeedOpen(false)}
          onBookTutor={handleBookTutor}
          onAddToLibrary={addToLibrary}
          onRemoveFromLibrary={removeFromLibrary}
          myLibraryItems={myLibraryItems}
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
