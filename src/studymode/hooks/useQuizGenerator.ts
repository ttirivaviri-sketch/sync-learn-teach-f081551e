 import { useState, useCallback } from 'react';
 import { supabase } from '../../integrations/supabase/client';
 import { Subject, Topic } from '../types/study';
 
 export interface QuizQuestion {
   id: string;
   question: string;
   marks: number;
   topic: string;
   subject: string;
   modelAnswer?: string;
   keyPoints?: string[];
 }
 
 interface UseQuizGeneratorOptions {
   subject: Subject;
   topic?: Topic;
 }
 
 const QUIZ_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-quiz`;
 
 export function useQuizGenerator({ subject, topic }: UseQuizGeneratorOptions) {
   const [question, setQuestion] = useState<QuizQuestion | null>(null);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
 
   const generateQuestion = useCallback(async () => {
     setIsLoading(true);
     setError(null);
 
     try {
       // Fetch the user's subjects from DB for real curriculum data
       const { data: { session } } = await supabase.auth.getSession();
       if (!session) throw new Error('Not authenticated');
 
       // Get parsed syllabus data if available
       const { data: documents } = await supabase
         .from('documents')
         .select('parsed_content, subject')
         .eq('user_id', session.user.id)
         .eq('is_processed', true)
         .eq('type', 'syllabus');
 
       // Find relevant curriculum content
       let curriculumContext = '';
       if (documents && documents.length > 0) {
         const relevantDoc = documents.find(d => 
           d.subject.toLowerCase().includes(subject.name.toLowerCase())
         );
         if (relevantDoc?.parsed_content) {
           curriculumContext = JSON.stringify(relevantDoc.parsed_content);
         }
       }
 
       // Build topic context from the subject
       const topicContext = topic 
         ? `Topic: ${topic.name}${topic.subtopics.length > 0 ? `, Subtopics: ${topic.subtopics.join(', ')}` : ''}`
         : `Current topic: ${subject.currentTopic.name}`;
 
        const resp = await fetch(QUIZ_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            subject: subject.name,
            topic: topic?.name || subject.currentTopic.name,
            topicContext,
            curriculumContext: curriculumContext ? curriculumContext.substring(0, 3000) : '',
            examWeight: topic?.examWeight || subject.currentTopic.examWeight,
          }),
        });
 
       if (!resp.ok) {
         const errorData = await resp.json().catch(() => ({}));
         throw new Error(errorData.error || 'Failed to generate question');
       }
 
       const data = await resp.json();
       setQuestion({
         id: crypto.randomUUID(),
         question: data.question,
         marks: data.marks,
         topic: topic?.name || subject.currentTopic.name,
         subject: subject.name,
         modelAnswer: data.modelAnswer,
         keyPoints: data.keyPoints,
       });
     } catch (err) {
       console.error('Quiz generation error:', err);
       setError(err instanceof Error ? err.message : 'Failed to generate question');
     } finally {
       setIsLoading(false);
     }
   }, [subject, topic]);
 
   const clearQuestion = useCallback(() => {
     setQuestion(null);
     setError(null);
   }, []);
 
   return {
     question,
     isLoading,
     error,
     generateQuestion,
     clearQuestion,
   };
 }