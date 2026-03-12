import { useState, useCallback } from 'react';
import { Upload, FileText, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '../../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { cn } from '../lib/utils';

interface DocumentUploadProps {
  onUploadComplete?: () => void;
  onClose?: () => void;
}

type DocumentType = 'syllabus' | 'past_paper' | 'mark_scheme';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

export function DocumentUpload({ onUploadComplete, onClose }: DocumentUploadProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>('syllabus');
  const [subject, setSubject] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf' || file.name.endsWith('.pdf')
    );

    if (droppedFiles.length > 0) {
      setFiles(prev => [
        ...prev,
        ...droppedFiles.map(file => ({ file, status: 'pending' as const }))
      ]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      file => file.type === 'application/pdf' || file.name.endsWith('.pdf')
    );

    if (selectedFiles.length > 0) {
      setFiles(prev => [
        ...prev,
        ...selectedFiles.map(file => ({ file, status: 'pending' as const }))
      ]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0 || !subject.trim()) {
      toast({
        title: "Missing information",
        description: "Please select files and enter a subject name.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please sign in to upload documents.",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const uploadedFile = files[i];
      
      // Update status to uploading
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading' } : f
      ));

      try {
        // Upload file to storage
        const filePath = `${user.id}/${Date.now()}-${uploadedFile.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, uploadedFile.file);

        if (uploadError) throw uploadError;

        // Create document record
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            name: uploadedFile.file.name,
            type: documentType,
            subject: subject.trim(),
            file_path: filePath,
            file_size: uploadedFile.file.size,
          })
          .select()
          .single();

        if (docError) throw docError;

        // Update status to processing
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'processing' } : f
        ));

        // Read file content for parsing
        const fileContent = await uploadedFile.file.text();

        // Call AI parse function via local proxy
        try {
          const parseResp = await fetch('/api/ai/parse-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId: docData.id,
              content: fileContent.substring(0, 50000), // Limit content size
              documentType,
              subject: subject.trim(),
            }),
          });

          if (!parseResp.ok) {
            const errData = await parseResp.json().catch(() => ({}));
            console.error('Parse error:', errData.error || parseResp.status);
            // Still continue — document is uploaded even if AI parsing fails
          } else {
            const parseData = await parseResp.json();
            // If syllabus was parsed successfully, update the document record
            if (parseData?.success && parseData?.parsed) {
              await supabase
                .from('documents')
                .update({
                  is_processed: true,
                  parsed_content: parseData.parsed,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', docData.id);
            }
          }
        } catch (parseErr) {
          console.error('Parse request failed:', parseErr);
          // Non-fatal — document is still uploaded
        }

        // Update status to done
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'done' } : f
        ));

      } catch (error) {
        console.error("Upload error:", error);
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', error: 'Upload failed' } : f
        ));
      }
    }

    setIsUploading(false);
    toast({
      title: "Upload complete",
      description: `${files.length} document(s) uploaded and being processed.`,
    });

    onUploadComplete?.();
  };

  const allDone = files.length > 0 && files.every(f => f.status === 'done');

  return (
    <div className="space-y-6">
      {/* Document Type Selection */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="docType">Document Type</Label>
          <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
            <SelectTrigger id="docType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="syllabus">📚 Syllabus</SelectItem>
              <SelectItem value="past_paper">📝 Past Paper</SelectItem>
              <SelectItem value="mark_scheme">✅ Mark Scheme</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            placeholder="e.g., Mathematics, Physics"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-colors cursor-pointer",
          isDragging 
            ? "border-accent bg-accent/10" 
            : "border-border hover:border-accent/50 hover:bg-muted/50"
        )}
      >
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className={cn(
          "h-10 w-10 mb-3 transition-colors",
          isDragging ? "text-accent" : "text-muted-foreground"
        )} />
        <p className="text-sm font-medium text-foreground mb-1">
          Drop PDF files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Supports syllabi, past papers, and mark schemes
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uploadedFile, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
            >
              <FileText className="h-5 w-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {uploadedFile.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(uploadedFile.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              
              {uploadedFile.status === 'pending' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              
              {uploadedFile.status === 'uploading' && (
                <Loader2 className="h-5 w-5 text-accent animate-spin shrink-0" />
              )}
              
              {uploadedFile.status === 'processing' && (
                <div className="flex items-center gap-2 text-warning">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Parsing...</span>
                </div>
              )}
              
              {uploadedFile.status === 'done' && (
                <Check className="h-5 w-5 text-success shrink-0" />
              )}
              
              {uploadedFile.status === 'error' && (
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onClose && (
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          onClick={uploadFiles}
          disabled={files.length === 0 || isUploading || !subject.trim()}
          className={cn(
            "flex-1",
            allDone ? "gradient-success" : "gradient-primary"
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : allDone ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Done
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {files.length > 0 ? `(${files.length})` : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
