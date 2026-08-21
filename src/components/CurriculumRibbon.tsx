import { useEffect, useRef } from "react";

/**
 * CurriculumRibbon — full-bleed trust strip of exam-board logos that scroll
 * off both edges of the screen. The source clip is a 16:9 white frame whose
 * ribbon occupies only the middle band, so the section crops to that band and
 * scales the video up for a clean, zoomed-in view.
 *
 * Playback notes: MP4/H.264 is listed first for iOS Safari (VP9 WebM is not
 * decodable on older iOS), and the element is muted + playsInline so mobile
 * browsers allow autoplay without a tap. If autoplay is still blocked we retry
 * on the first user interaction and whenever the tab becomes visible again.
 */
const CurriculumRibbon = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tryPlay = () => {
      if (!el.paused) return;
      void el.play().catch(() => undefined);
    };

    tryPlay();
    el.addEventListener("canplay", tryPlay);
    document.addEventListener("visibilitychange", tryPlay);
    window.addEventListener("touchstart", tryPlay, { passive: true });
    window.addEventListener("click", tryPlay);
    window.addEventListener("scroll", tryPlay, { passive: true });

    return () => {
      el.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("touchstart", tryPlay);
      window.removeEventListener("click", tryPlay);
      window.removeEventListener("scroll", tryPlay);
    };
  }, []);

  return (
    <section aria-labelledby="curriculum-ribbon-heading" className="bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2
          id="curriculum-ribbon-heading"
          className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400"
        >
          Built for your curriculum
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-600 sm:text-base">
          ZIMSEC O &amp; A Level, Cambridge IGCSE, O Level &amp; A Level, IEB and CAPS/NSC Grade
          10–12 matric — tutors, past papers and AI StudyMode aligned to the syllabus you write.
        </p>
      </div>

      <div
        className="relative mt-7 h-24 w-full overflow-hidden sm:mt-9 sm:h-32"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        <video
          ref={videoRef}
          className="pointer-events-none absolute left-0 top-1/2 w-full -translate-y-1/2 scale-[3.6] sm:scale-[2.6] lg:scale-[1.9]"
          autoPlay
          muted
          
          loop
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/curriculum-ribbon.mp4" type="video/mp4" />
          <source src="/curriculum-ribbon.webm" type="video/webm" />
        </video>
      </div>
    </section>
  );
};

export default CurriculumRibbon;
