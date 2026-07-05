/**
 * Test factories for common data structures.
 * Use these to quickly create mock objects in tests.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'learner' | 'tutor' | 'instructor' | 'admin';
  createdAt: Date;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: Date;
  completedAt: Date | null;
}

export interface Assessment {
  id: string;
  courseId: string;
  title: string;
  type: 'quiz' | 'assignment' | 'project';
  dueDate: Date;
  createdAt: Date;
}

export interface Session {
  id: string;
  title: string;
  instructorId: string;
  startTime: Date;
  endTime: Date;
  participants: string[];
  recordingUrl?: string;
}

// Factory functions
export function createUser(overrides?: Partial<User>): User {
  return {
    id: 'user-' + Math.random().toString(36).slice(2, 9),
    email: 'test@example.com',
    name: 'Test User',
    role: 'learner',
    createdAt: new Date(),
    ...overrides,
  };
}

export function createCourse(overrides?: Partial<Course>): Course {
  return {
    id: 'course-' + Math.random().toString(36).slice(2, 9),
    title: 'Sample Course',
    description: 'A sample course for testing',
    instructorId: createUser({ role: 'instructor' }).id,
    published: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createEnrollment(overrides?: Partial<Enrollment>): Enrollment {
  return {
    id: 'enrollment-' + Math.random().toString(36).slice(2, 9),
    userId: createUser().id,
    courseId: createCourse().id,
    enrolledAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

export function createAssessment(overrides?: Partial<Assessment>): Assessment {
  return {
    id: 'assessment-' + Math.random().toString(36).slice(2, 9),
    courseId: createCourse().id,
    title: 'Quiz 1',
    type: 'quiz',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
    createdAt: new Date(),
    ...overrides,
  };
}

export function createSession(overrides?: Partial<Session>): Session {
  const now = new Date();
  const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

  return {
    id: 'session-' + Math.random().toString(36).slice(2, 9),
    title: 'Live Session',
    instructorId: createUser({ role: 'instructor' }).id,
    startTime,
    endTime,
    participants: [createUser().id],
    recordingUrl: undefined,
    ...overrides,
  };
}