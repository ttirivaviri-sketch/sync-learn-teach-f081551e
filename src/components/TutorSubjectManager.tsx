import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useTutorData, TutorSubject } from '@/hooks/useTutorData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TutorSubjectManagerProps {
  subjects: TutorSubject[];
  onSubjectAdded?: () => void;
  onSubjectRemoved?: () => void;
}

const SUBJECT_OPTIONS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History',
  'Geography', 'Economics', 'Accounting', 'Life Sciences', 'Computer Science'
];

const LEVEL_OPTIONS = [
  'Grade 1-3', 'Grade 4-6', 'Grade 7-9', 'Grade 10-12', 'University', 'Adult Education'
];

export const TutorSubjectManager: React.FC<TutorSubjectManagerProps> = ({
  subjects,
  onSubjectAdded,
  onSubjectRemoved
}) => {
  const [newSubject, setNewSubject] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [newRate, setNewRate] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const { addTutorSubject, removeTutorSubject } = useTutorData();

  const handleAddSubject = async () => {
    if (!newSubject || !newLevel || !newRate) return;

    try {
      setIsAdding(true);
      await addTutorSubject(newSubject, newLevel, parseFloat(newRate));
      setNewSubject('');
      setNewLevel('');
      setNewRate('');
      onSubjectAdded?.();
    } catch (error) {
      console.error('Error adding subject:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveSubject = async (subjectId: string) => {
    try {
      await removeTutorSubject(subjectId);
      onSubjectRemoved?.();
    } catch (error) {
      console.error('Error removing subject:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Teaching Subjects</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Subjects */}
        <div className="space-y-2">
          {subjects.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No subjects added yet. Add your first subject below.
            </p>
          ) : (
            subjects.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{subject.subject}</Badge>
                  <span className="text-sm text-muted-foreground">{subject.level}</span>
                  <span className="text-sm font-medium">R{subject.hourly_rate}/hour</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSubject(subject.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add New Subject */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium">Add New Subject</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={newSubject} onValueChange={setNewSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECT_OPTIONS.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newLevel} onValueChange={setNewLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_OPTIONS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Hourly rate (R)"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              min="50"
              max="1000"
            />
          </div>

          <Button
            onClick={handleAddSubject}
            disabled={!newSubject || !newLevel || !newRate || isAdding}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isAdding ? 'Adding...' : 'Add Subject'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
