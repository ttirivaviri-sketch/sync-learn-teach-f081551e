import {
  Video, Book, FileText, Users, Brain, HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopicTutorRack } from "@/components/TopicTutorRack";
import { ContentRack } from "./ContentRack";
import type { LibraryResource } from "@/types/academicProfile";

interface SearchResultsViewProps {
  searchQuery: string;
  searchResults: LibraryResource[];
  myLibraryItems: string[];
  onOpen: (resource: LibraryResource) => void;
  onBookTutor: (tutorId: string, tutorName: string) => void;
  onDownload: (id: string, title: string) => void;
  onAddToLibrary: (id: string, title: string) => void;
  onRemoveFromLibrary: (id: string) => void;
  onNeedHelp?: () => void;
  onEnterStudyMode: () => void;
}

export function SearchResultsView({
  searchQuery,
  searchResults,
  myLibraryItems,
  onOpen,
  onBookTutor,
  onDownload,
  onAddToLibrary,
  onRemoveFromLibrary,
  onNeedHelp,
  onEnterStudyMode,
}: SearchResultsViewProps) {
  if (!searchQuery.trim()) return null;
  const tutorials = searchResults.filter((r) => r.isTutorial);
  const books = searchResults.filter((r) => r.type === "book" || r.type === "guide");
  const papers = searchResults.filter((r) => r.type === "pastpaper");
  const topicTutors = searchResults.filter((r) => r.tutor);

  const rackProps = { myLibraryItems, onOpen, onBookTutor, onDownload, onAddToLibrary, onRemoveFromLibrary };

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
        <ContentRack title="Tutorials" items={tutorials} icon={Video} {...rackProps} />
      )}

      {books.length > 0 && (
        <ContentRack title="Books & Guides" items={books} icon={Book} {...rackProps} />
      )}

      {papers.length > 0 && (
        <ContentRack title="Past Exam Questions" items={papers} icon={FileText} {...rackProps} />
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
            onBookTutor={onBookTutor}
            onWatchTutorial={onOpen}
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
            <Button size="sm" onClick={onEnterStudyMode}>
              <Brain className="h-3 w-3 mr-1" />
              Enter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
