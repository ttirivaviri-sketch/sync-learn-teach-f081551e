import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import { useSubjects } from '../hooks/useSubjects';
import type { Subject } from '../types/study';

interface TopicPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  curriculum: string;
  onPick: (args: { subject: string; topic: string; subtopic?: string; subjectId?: string }) => void;
}

export function TopicPicker({ open, onOpenChange, curriculum, onPick }: TopicPickerProps) {
  const { data: subjects = [] } = useSubjects();
  const [search, setSearch] = useState('');
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const [customSubject, setCustomSubject] = useState<string>('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s: Subject) =>
      s.name.toLowerCase().includes(q) ||
      s.topics?.some(t => t.name.toLowerCase().includes(q))
    );
  }, [subjects, search]);

  const handlePick = (subject: Subject, topicName: string, subtopic?: string) => {
    onPick({
      subject: subject.name,
      topic: topicName,
      subtopic,
      subjectId: subject.id,
    });
    onOpenChange(false);
  };

  const handleCustom = () => {
    const subj = customSubject || subjects[0]?.name;
    if (!subj || !customTopic.trim()) return;
    onPick({ subject: subj, topic: customTopic.trim() });
    setCustomTopic('');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Start by Topic
            <Badge variant="secondary" className="ml-2 text-[10px]">{curriculum}</Badge>
          </SheetTitle>
          <Input
            placeholder="Search subjects or topics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mt-2"
          />
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No subjects yet. Add subjects in Setup or use a custom topic below.
            </p>
          )}

          {filtered.map((subject: Subject) => {
            const isOpen = openSubject === subject.id;
            return (
              <Collapsible key={subject.id} open={isOpen} onOpenChange={() => setOpenSubject(isOpen ? null : subject.id)}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-card hover:bg-accent/5 border border-border/40 text-left">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span>{subject.icon || '📚'}</span>
                      {subject.name}
                    </span>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 pr-1 pt-1.5 space-y-1">
                  {(subject.topics || []).map(topic => {
                    const tKey = `${subject.id}-${topic.id}`;
                    const isTopicOpen = openTopic === tKey;
                    const hasSubs = (topic.subtopics || []).length > 0;
                    return (
                      <div key={topic.id}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handlePick(subject, topic.name)}
                            className="flex-1 text-left px-3 py-2 text-sm rounded-md hover:bg-primary/10 text-foreground"
                          >
                            <BookOpen className="h-3.5 w-3.5 inline mr-2 text-muted-foreground" />
                            {topic.name}
                          </button>
                          {hasSubs && (
                            <button
                              onClick={() => setOpenTopic(isTopicOpen ? null : tKey)}
                              className="p-2 rounded-md hover:bg-muted"
                              aria-label="Show subtopics"
                            >
                              {isTopicOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                        {hasSubs && isTopicOpen && (
                          <div className="pl-6 space-y-0.5 mt-1">
                            {topic.subtopics.map((sub, i) => (
                              <button
                                key={i}
                                onClick={() => handlePick(subject, topic.name, sub)}
                                className="block w-full text-left px-3 py-1.5 text-xs rounded-md hover:bg-accent/10 text-muted-foreground hover:text-foreground"
                              >
                                · {sub}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(!subject.topics || subject.topics.length === 0) && (
                    <p className="text-xs text-muted-foreground px-3 py-1.5">No topics for this subject yet.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        <div className="border-t px-4 py-3 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-2">Or jump into a custom topic</p>
          <div className="flex gap-2">
            <select
              value={customSubject}
              onChange={e => setCustomSubject(e.target.value)}
              className="text-sm px-2 py-1.5 rounded-md border border-border bg-background min-w-[110px]"
            >
              <option value="">Subject…</option>
              {subjects.map((s: Subject) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <Input
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              placeholder="e.g. Inventory valuation"
              className="flex-1"
            />
            <Button onClick={handleCustom} disabled={!customTopic.trim() || !customSubject} size="sm">
              Start
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
