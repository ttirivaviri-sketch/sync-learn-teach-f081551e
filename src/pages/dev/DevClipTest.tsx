import { StudyClipsFeed } from "@/components/library/StudyClipsFeed";
import type { LibraryResource } from "@/types/academicProfile";

const videos = [
  {
    id: "1",
    title: "Newton's Laws: Crash Course Physics #5",
    type: "video",
    thumbnail: "https://i.ytimg.com/vi/kKKM8Y-u7ds/hqdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=kKKM8Y-u7ds",
    author: "CrashCourse",
    tags: {},
  },
  {
    id: "2",
    title: "Friction: Crash Course Physics #6",
    type: "video",
    thumbnail: "https://i.ytimg.com/vi/fo_pmp5rtzo/hqdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=fo_pmp5rtzo",
    author: "CrashCourse",
    tags: {},
  },
] as unknown as LibraryResource[];

export default function DevClipTest() {
  return (
    <StudyClipsFeed
      videos={videos}
      startIndex={0}
      onClose={() => {}}
      onBookTutor={() => {}}
      onAddToLibrary={() => {}}
      onRemoveFromLibrary={() => {}}
      myLibraryItems={[]}
    />
  );
}
