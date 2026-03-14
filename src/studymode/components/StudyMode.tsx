import { useState } from 'react';
import { Header } from './Header';
import { ReadinessCheck } from './ReadinessCheck';
import { Dashboard } from './Dashboard';
import { DocumentUpload } from './DocumentUpload';
import { ChatPanel } from './ChatPanel';
import { StreakCelebration } from './StreakCelebration';
import { ReadinessCheck as ReadinessCheckType } from '../types/study';
import { MessageCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

export default function StudyMode({
  onNeedHelp,
  onBrowseLibrary,
}: {
  onNeedHelp?: () => void;
  onBrowseLibrary?: () => void;
}) {
  const [readiness, setReadiness] = useState<ReadinessCheckType | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatContext, setChatContext] = useState<{ subject?: string; topic?: string }>({});

  const handleReadinessComplete = (data: ReadinessCheckType) => {
    setReadiness(data);
  };

  const handleUploadClick = () => {
    setShowUploadDialog(true);
  };

  const handleOpenChat = (subject: string, topic: string) => {
    setChatContext({ subject, topic });
    setShowChatPanel(true);
  };

  const handleToggleChat = () => {
    if (showChatPanel) {
      setChatContext({});
    }
    setShowChatPanel(!showChatPanel);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <StreakCelebration />
      <Header />

      {!readiness && (
        <ReadinessCheck onComplete={handleReadinessComplete} />
      )}

      {readiness && (
        <main className="pb-20">
          <Dashboard
            readiness={readiness}
            onUploadClick={handleUploadClick}
            onOpenChat={handleOpenChat}
            onNeedHelp={onNeedHelp}
            onBrowseLibrary={onBrowseLibrary}
          />
        </main>
      )}

      {/* Document Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
          </DialogHeader>
          <DocumentUpload
            onUploadComplete={() => setShowUploadDialog(false)}
            onClose={() => setShowUploadDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Floating Chat Button */}
      <Button
        onClick={handleToggleChat}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 gradient-primary"
        size="icon"
      >
        {showChatPanel ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {/* Chat Panel */}
      {showChatPanel && (
        <div className="fixed bottom-24 right-6 w-[380px] h-[500px] bg-background border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <ChatPanel subject={chatContext.subject} topic={chatContext.topic} />
        </div>
      )}
    </div>
  );
}
