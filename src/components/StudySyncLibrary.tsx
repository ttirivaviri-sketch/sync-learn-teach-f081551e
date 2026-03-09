import { useState, lazy, Suspense } from "react";
import { Search, Download, Star, Filter, Book, FileText, Video, BookOpen, Bookmark, Eye, Archive, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// ── Lazy-load Study Mode only when the toggle is activated ────────────────────
const StudyModeWrapper = lazy(() =>
  import("@/studymode/StudyModeWrapper").then((m) => ({ default: m.StudyModeWrapper }))
);

const StudySyncLibrary = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [myLibraryItems, setMyLibraryItems] = useState<number[]>([]);
  const [studyModeActive, setStudyModeActive] = useState(false);

  const categories = [
    { id: "all", name: "Browse", icon: BookOpen, color: "text-primary" },
    { id: "fiction", name: "Fiction", icon: Book, color: "text-secondary" },
    { id: "nonfiction", name: "Non-Fiction", icon: FileText, color: "text-accent" },
    { id: "video", name: "Video", icon: Video, color: "text-emerald-600" },
    { id: "mylibrary", name: "My Library", icon: Archive, color: "text-purple-600" }
  ];

  const resources = {
    all: [
      {
        id: 1,
        title: "To Kill a Mockingbird",
        author: "Harper Lee",
        type: "text",
        category: "Fiction",
        gradeLevel: "Grade 10-12",
        summary: "A gripping tale of racial injustice and loss of innocence in the American South.",
        rating: 4.8,
        reviews: 1245,
        thumbnail: "/placeholder.svg",
        isOffline: false,
        duration: "45 min read"
      },
      {
        id: 2,
        title: "The History of South Africa",
        author: "Dr. Sarah Johnson",
        type: "text",
        category: "Non-Fiction",
        gradeLevel: "Grade 11-12",
        summary: "Comprehensive overview of South African history from ancient times to present.",
        rating: 4.6,
        reviews: 523,
        thumbnail: "/placeholder.svg",
        isOffline: true,
        duration: "2 hours read"
      },
      {
        id: 3,
        title: "Mathematics Fundamentals",
        author: "Prof. Michael Chen",
        type: "video",
        category: "Education",
        gradeLevel: "Grade 9-12",
        summary: "Essential mathematical concepts explained through visual examples.",
        rating: 4.9,
        reviews: 2156,
        thumbnail: "/placeholder.svg",
        isOffline: false,
        duration: "1h 30m"
      },
      {
        id: 4,
        title: "1984",
        author: "George Orwell",
        type: "text",
        category: "Fiction",
        gradeLevel: "Grade 11-12",
        summary: "Dystopian social science fiction novel about totalitarian control.",
        rating: 4.7,
        reviews: 3421,
        thumbnail: "/placeholder.svg",
        isOffline: true,
        duration: "6 hours read"
      }
    ],
    fiction: [
      {
        id: 1,
        title: "To Kill a Mockingbird",
        author: "Harper Lee",
        type: "text",
        category: "Fiction",
        gradeLevel: "Grade 10-12",
        summary: "A gripping tale of racial injustice and loss of innocence in the American South.",
        rating: 4.8,
        reviews: 1245,
        thumbnail: "/placeholder.svg",
        isOffline: false,
        duration: "45 min read"
      },
      {
        id: 4,
        title: "1984",
        author: "George Orwell",
        type: "text",
        category: "Fiction",
        gradeLevel: "Grade 11-12",
        summary: "Dystopian social science fiction novel about totalitarian control.",
        rating: 4.7,
        reviews: 3421,
        thumbnail: "/placeholder.svg",
        isOffline: true,
        duration: "6 hours read"
      }
    ],
    nonfiction: [
      {
        id: 2,
        title: "The History of South Africa",
        author: "Dr. Sarah Johnson",
        type: "text",
        category: "Non-Fiction",
        gradeLevel: "Grade 11-12",
        summary: "Comprehensive overview of South African history from ancient times to present.",
        rating: 4.6,
        reviews: 523,
        thumbnail: "/placeholder.svg",
        isOffline: true,
        duration: "2 hours read"
      }
    ],
    video: [
      {
        id: 3,
        title: "Mathematics Fundamentals",
        author: "Prof. Michael Chen",
        type: "video",
        category: "Education",
        gradeLevel: "Grade 9-12",
        summary: "Essential mathematical concepts explained through visual examples.",
        rating: 4.9,
        reviews: 2156,
        thumbnail: "/placeholder.svg",
        isOffline: false,
        duration: "1h 30m"
      }
    ],
    mylibrary: []
  };

  const addToLibrary = (resourceId: number, resourceTitle: string) => {
    if (!myLibraryItems.includes(resourceId)) {
      setMyLibraryItems([...myLibraryItems, resourceId]);
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { 
            title: "Added to Library!", 
            description: `${resourceTitle} has been added to your library` 
          } 
        }));
      }
    }
  };

  const downloadResource = (resourceId: number, resourceTitle: string) => {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { 
          title: "Download Started", 
          description: `${resourceTitle} is being downloaded for offline access` 
        } 
      }));
    }
  };

  const openResourceDetail = (resourceId: number, resourceTitle: string) => {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { 
          title: "Opening Resource", 
          description: `Opening ${resourceTitle} in detail view` 
        } 
      }));
    }
  };

  const ResourceCard = ({ resource }: { resource: any }) => {
    const isInLibrary = myLibraryItems.includes(resource.id);
    const TypeIcon = resource.type === "video" ? Video : resource.type === "text" ? Book : FileText;
    
    return (
      <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center relative">
            <TypeIcon className="h-8 w-8 text-muted-foreground" />
            {resource.isOffline && (
              <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <h4 className="font-medium text-sm leading-tight line-clamp-2">{resource.title}</h4>
              {isInLibrary && (
                <Bookmark className="h-4 w-4 text-primary fill-primary flex-shrink-0 ml-1" />
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">{resource.author}</p>
            <p className="text-xs text-accent">{resource.gradeLevel}</p>
            
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-medium">{resource.rating}</span>
              <span className="text-xs text-muted-foreground">({resource.reviews})</span>
            </div>
            
            <p className="text-xs text-muted-foreground line-clamp-2">{resource.summary}</p>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{resource.duration}</span>
              <span>{resource.category}</span>
            </div>
            
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                size="sm"
                onClick={() => openResourceDetail(resource.id, resource.title)}
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => downloadResource(resource.id, resource.title)}
              >
                <Download className="h-3 w-3" />
              </Button>
              {!isInLibrary && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => addToLibrary(resource.id, resource.title)}
                >
                  <Bookmark className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Get resources for My Library tab
  const getMyLibraryResources = () => {
    return resources.all.filter(resource => myLibraryItems.includes(resource.id));
  };

  const getCurrentResources = (categoryId: string) => {
    if (categoryId === "mylibrary") {
      return getMyLibraryResources();
    }
    return resources[categoryId as keyof typeof resources] || [];
  };

  // ── If Study Mode is active, show it full-screen inside the Library pane ──
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
        <StudyModeWrapper onDeactivate={() => setStudyModeActive(false)} />
      </Suspense>
    );
  }

  return (
    <div className="space-y-4">
      {/* Study Mode Banner */}
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

      {/* Search Header */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search books, videos, resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          variant="outline" 
          size="icon"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Badge variant="secondary">Grade 12</Badge>
        <Badge variant="outline">Fiction</Badge>
        <Badge variant="outline">Non-Fiction</Badge>
        <Badge variant="outline">Video</Badge>
        <Badge variant="outline">Downloaded</Badge>
      </div>

      {/* Library Categories */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5 text-xs">
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id} className="text-xs">
              <category.icon className={`h-4 w-4 mr-1 ${category.color}`} />
              <span className="hidden sm:inline">{category.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {category.name}
                {category.id === "mylibrary" && myLibraryItems.length > 0 && (
                  <span className="text-muted-foreground font-normal"> ({myLibraryItems.length})</span>
                )}
              </h3>
              {category.id !== "mylibrary" && (
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Filter
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getCurrentResources(category.id).map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>

            {category.id === "mylibrary" && myLibraryItems.length === 0 && (
              <Card className="bg-muted/30">
                <CardContent className="p-6 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h4 className="font-medium mb-2">Your Library is Empty</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start building your personal collection by bookmarking resources from other tabs.
                  </p>
                  <Button variant="outline" size="sm">
                    Browse Resources
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Featured Banner */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary">StudySync Library</h3>
              <p className="text-sm text-muted-foreground">Access thousands of educational resources</p>
            </div>
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudySyncLibrary;