import { useState, lazy, Suspense } from "react";
import {
  Search, Download, Star, Filter, Book, FileText, Video, BookOpen,
  Bookmark, Eye, Archive, Brain, Loader2, GraduationCap, Users, TrendingUp,
  X, Play, AlertCircle, ChevronRight, Sparkles, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TopicTutorRack } from "@/components/TopicTutorRack";
import { useLibraryResources } from "@/hooks/useLibraryResources";
import { AcademicProfile, LibraryResource } from "@/types/academicProfile";

// ── Lazy-load Study Mode only when the toggle is activated ────────────────────
const StudyModeWrapper = lazy(() =>
  import("@/studymode/StudyModeWrapper").then((m) => ({ default: m.StudyModeWrapper }))
);

interface StudySyncLibraryProps {
  academicProfile?: AcademicProfile | null;
  onBookTutor?: (tutorId: string, tutorName: string) => void;
  /** Called when StudyMode wants to send user to a tutor */
  onNeedHelp?: () => void;
}

const StudySyncLibrary = ({
  academicProfile,
  onBookTutor,
  onNeedHelp,
}: StudySyncLibraryProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [myLibraryItems, setMyLibraryItems] = useState<string[]>([]);
  const [studyModeActive, setStudyModeActive] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchFocused, setSearchFocused] = useState(false);

  const {
    allResources,
    personalizedResources,
    recommendedTutorials,
    pastPapers,
    topTutors,
    searchResults,
    loading,
    search,
    getBySubject,
    getByTopic,
  } = useLibraryResources(academicProfile);

  const categories = [
    { id: "all", name: "Browse", icon: BookOpen, color: "text-primary" },
    { id: "tutorials", name: "Tutorials", icon: Video, color: "text-emerald-600" },
    { id: "books", name: "Books", icon: Book, color: "text-secondary" },
    { id: "papers", name: "Past Papers", icon: FileText, color: "text-accent" },
    { id: "mylibrary", name: "My Library", icon: Archive, color: "text-purple-600" },
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    search(value);
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
    dispatchToast("Opening Resource", `Opening ${resource.title}`);
  };

  const handleBookTutor = (tutorId: string, tutorName: string) => {
    if (onBookTutor) {
      onBookTutor(tutorId, tutorName);
    } else {
      dispatchToast("Book Tutor", `Opening ${tutorName}'s profile...`);
    }
  };

  const dispatchToast = (title: string, description: string) => {
    window.dispatchEvent(
      new CustomEvent("show-toast", { detail: { title, description } })
    );
  };

  // ── Resource card ─────────────────────────────────────────────────────────────

  const ResourceCard = ({ resource }: { resource: LibraryResource }) => {
    const id = String(resource.id);
    const isInLibrary = myLibraryItems.includes(id);
    const TypeIcon =
      resource.type === "video"
        ? Video
        : resource.type === "pastpaper"
        ? FileText
        : Book;

    return (
      <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
        <CardContent className="p-4">
          {/* Thumbnail */}
          <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
            {resource.type === "video" ? (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                  <Play className="h-5 w-5 text-primary ml-0.5" />
                </div>
              </div>
            ) : (
              <TypeIcon className="h-8 w-8 text-muted-foreground" />
            )}

            {resource.isOffline && (
              <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}

            {resource.isTutorial && (
              <Badge className="absolute top-2 left-2 text-xs bg-emerald-600">
                Tutorial
              </Badge>
            )}

            {resource.type === "pastpaper" && (
              <Badge className="absolute top-2 left-2 text-xs bg-orange-500">
                Past Paper
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            {/* Title + bookmark */}
            <div className="flex items-start justify-between gap-1">
              <h4 className="font-medium text-sm leading-tight line-clamp-2">
                {resource.title}
              </h4>
              {isInLibrary && (
                <Bookmark className="h-4 w-4 text-primary fill-primary flex-shrink-0 ml-1" />
              )}
            </div>

            {/* Author / Tutor */}
            {resource.tutor ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={resource.tutor.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="text-[10px]">
                    {resource.tutor.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate">
                  {resource.tutor.name}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{resource.author}</p>
            )}

            {/* Grade */}
            <p className="text-xs text-accent">{resource.gradeLevel}</p>

            {/* Rating */}
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-medium">{resource.rating}</span>
              <span className="text-xs text-muted-foreground">({resource.reviews})</span>
              {resource.watchCount ? (
                <span className="text-xs text-muted-foreground ml-1">
                  · {resource.watchCount.toLocaleString()} views
                </span>
              ) : null}
            </div>

            {/* Summary */}
            <p className="text-xs text-muted-foreground line-clamp-2">
              {resource.summary}
            </p>

            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{resource.duration}</span>
              <span>{resource.category}</span>
            </div>

            {/* Subject tags */}
            {resource.tags && (
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {resource.tags.subject}
                </Badge>
                {resource.tags.topic && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {resource.tags.topic}
                  </Badge>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                size="sm"
                onClick={() => openResource(resource)}
              >
                <Eye className="h-3 w-3 mr-1" />
                {resource.type === "video" ? "Watch" : "View"}
              </Button>

              {resource.tutor && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleBookTutor(resource.tutor!.id, resource.tutor!.name)}
                >
                  Book Tutor
                </Button>
              )}

              {!resource.tutor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadResource(id, resource.title)}
                >
                  <Download className="h-3 w-3" />
                </Button>
              )}

              {!isInLibrary && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToLibrary(id, resource.title)}
                >
                  <Bookmark className="h-3 w-3" />
                </Button>
              )}
              {isInLibrary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFromLibrary(id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Content rack (horizontal scroll) ─────────────────────────────────────────

  const ContentRack = ({
    title,
    items,
    emptyMessage,
    icon: Icon,
  }: {
    title: string;
    items: LibraryResource[];
    emptyMessage?: string;
    icon?: React.ElementType;
  }) => {
    if (items.length === 0 && !emptyMessage) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.slice(0, 4).map((resource) => (
              <ResourceCard key={String(resource.id)} resource={resource} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Search results view ───────────────────────────────────────────────────────

  const SearchResultsView = () => {
    if (!searchQuery.trim()) return null;
    const tutorials = searchResults.filter((r) => r.isTutorial);
    const books = searchResults.filter((r) => r.type === "book" || r.type === "guide");
    const papers = searchResults.filter((r) => r.type === "pastpaper");
    const topicTutors = searchResults.filter((r) => r.tutor);

    return (
      <div className="space-y-6 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            Results for "{searchQuery}"
          </h3>
          <Badge variant="secondary">{searchResults.length} found</Badge>
        </div>

        {searchResults.length === 0 && (
          <Card className="bg-muted/30">
            <CardContent className="p-6 text-center">
              <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <h4 className="font-medium mb-1">No resources found</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Try a different search term, or book a tutor for personalised help.
              </p>
              {onNeedHelp && (
                <Button onClick={onNeedHelp} size="sm">
                  Find a Tutor
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {tutorials.length > 0 && (
          <ContentRack title="Tutorials" items={tutorials} icon={Video} />
        )}

        {books.length > 0 && (
          <ContentRack title="Books & Guides" items={books} icon={Book} />
        )}

        {papers.length > 0 && (
          <ContentRack title="Past Exam Questions" items={papers} icon={FileText} />
        )}

        {topicTutors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Top Tutors for this Topic</h3>
            </div>
            <TopicTutorRack
              title={`Tutors for "${searchQuery}"`}
              tutors={topicTutors}
              onBookTutor={handleBookTutor}
              onWatchTutorial={openResource}
            />
          </div>
        )}

        {/* Practice link to StudyMode */}
        <Card className="bg-gradient-to-r from-violet-500/10 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-sm">Practice in Study Mode</h4>
                <p className="text-xs text-muted-foreground">
                  Generate exam-style questions on "{searchQuery}"
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setStudyModeActive(true)}
              >
                <Brain className="h-3 w-3 mr-1" />
                Enter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ── Still need help prompt ────────────────────────────────────────────────────

  const StuckPrompt = () => (
    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-300">
              Still need help?
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              A live tutor can explain this topic in minutes.
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700"
                onClick={() => onNeedHelp?.()}
              >
                Book a Tutor
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-300"
                onClick={() => setStudyModeActive(true)}
              >
                Try Study Mode
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ── StudyMode full-screen ─────────────────────────────────────────────────────
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
        />
      </Suspense>
    );
  }

  // ── My Library items ──────────────────────────────────────────────────────────
  const myLibraryResources = allResources.filter((r) =>
    myLibraryItems.includes(String(r.id))
  );

  // ── Main render ───────────────────────────────────────────────────────────────
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
                <Badge variant="secondary" className="text-xs">
                  {academicProfile.curriculum}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {academicProfile.grade}
                </Badge>
                {academicProfile.subjects.slice(0, 3).map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">
                    {s}
                  </Badge>
                ))}
                {academicProfile.subjects.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{academicProfile.subjects.length - 3}
                  </Badge>
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
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            className="pl-10"
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-3"
              onClick={() => handleSearch("")}
            >
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
              <Badge
                key={s}
                variant="outline"
                className="whitespace-nowrap cursor-pointer"
                onClick={() => handleSearch(s)}
              >
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

      {/* ── Search Results (replaces normal view when searching) ── */}
      {searchQuery.trim() ? (
        <SearchResultsView />
      ) : (
        <>
          {/* ── Library Tabs ── */}
          <Tabs
            value={activeCategory}
            onValueChange={setActiveCategory}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5 text-xs">
              {categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="text-xs"
                >
                  <category.icon className={`h-4 w-4 mr-1 ${category.color}`} />
                  <span className="hidden sm:inline">{category.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Browse Tab (Personalised Racks) ── */}
            <TabsContent value="all" className="space-y-6 mt-4">
              {loading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {academicProfile && (
                <ContentRack
                  title={`Recommended for You`}
                  items={personalizedResources.slice(0, 4)}
                  icon={Sparkles}
                />
              )}

              <ContentRack
                title="Top Tutorial Videos"
                items={recommendedTutorials.slice(0, 4)}
                icon={Video}
              />

              {/* Top Tutors rack */}
              {topTutors.length > 0 && (
                <TopicTutorRack
                  title="Popular Tutors"
                  subtitle="Highest-rated educators on StudySync"
                  tutors={topTutors.slice(0, 3)}
                  onBookTutor={handleBookTutor}
                  onWatchTutorial={openResource}
                />
              )}

              <ContentRack
                title="Past Exam Papers"
                items={pastPapers.slice(0, 4)}
                icon={FileText}
              />

              <ContentRack
                title="All Resources"
                items={allResources.slice(0, 4)}
                icon={BookOpen}
              />

              <StuckPrompt />
            </TabsContent>

            {/* ── Tutorials Tab ── */}
            <TabsContent value="tutorials" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Video Tutorials</h3>
                <Badge variant="secondary">{recommendedTutorials.length} available</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommendedTutorials.map((r) => (
                  <ResourceCard key={String(r.id)} resource={r} />
                ))}
              </div>
              {recommendedTutorials.length === 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="p-6 text-center">
                    <Video className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No tutorials yet. Tutors can upload videos from their dashboard.
                    </p>
                  </CardContent>
                </Card>
              )}
              <StuckPrompt />
            </TabsContent>

            {/* ── Books Tab ── */}
            <TabsContent value="books" className="space-y-4 mt-4">
              <h3 className="font-semibold">Books &amp; Study Guides</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allResources
                  .filter((r) => r.type === "book" || r.type === "guide")
                  .map((r) => (
                    <ResourceCard key={String(r.id)} resource={r} />
                  ))}
              </div>
            </TabsContent>

            {/* ── Past Papers Tab ── */}
            <TabsContent value="papers" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Past Exam Papers</h3>
                <Badge variant="secondary">{pastPapers.length} papers</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pastPapers.map((r) => (
                  <ResourceCard key={String(r.id)} resource={r} />
                ))}
              </div>
              {pastPapers.length === 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="p-6 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Past papers will appear here.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── My Library Tab ── */}
            <TabsContent value="mylibrary" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  My Library
                  {myLibraryItems.length > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {" "}({myLibraryItems.length})
                    </span>
                  )}
                </h3>
              </div>

              {myLibraryResources.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myLibraryResources.map((r) => (
                    <ResourceCard key={String(r.id)} resource={r} />
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveCategory("all")}
                    >
                      Browse Resources
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ── Featured Banner ── */}
      {!searchQuery && (
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-primary">StudySync Library</h3>
                <p className="text-sm text-muted-foreground">
                  {allResources.length}+ educational resources
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudySyncLibrary;
