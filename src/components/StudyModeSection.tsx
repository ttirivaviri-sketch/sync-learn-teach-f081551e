import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const StudyModeSection = () => {
  const navigate = useNavigate();

  return (
    <section id="studymode" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
            See StudySync in action
          </h2>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            Real screenshots from the app -- AI-powered study plans and expert tutor matching, all in one place.
          </p>
        </div>

        {/* Screenshots in phone mockups */}
        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* StudyMode screenshot */}
          <div className="text-center">
            <div className="relative mx-auto w-[260px] sm:w-[280px]">
              {/* Phone frame */}
              <div className="rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 overflow-hidden shadow-2xl">
                <img
                  src="/images/screenshot-studymode.jpeg"
                  alt="StudyMode - AI study plan interface"
                  className="w-full object-cover"
                />
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mt-6">AI StudyMode</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
              Personalised daily tasks, quizzes, and flashcards aligned to your syllabus.
            </p>
          </div>

          {/* Tutor matching screenshot */}
          <div className="text-center">
            <div className="relative mx-auto w-[260px] sm:w-[280px]">
              {/* Phone frame */}
              <div className="rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 overflow-hidden shadow-2xl">
                <img
                  src="/images/screenshot-tutor-matching.jpeg"
                  alt="Tutor Matching - find and book tutors"
                  className="w-full object-cover"
                />
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mt-6">Tutor Matching</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
              Find verified tutors by subject, book sessions, and connect via video call.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <Button
            size="lg"
            className="bg-[hsl(220,80%,50%)] hover:bg-[hsl(220,80%,44%)] text-white font-bold text-base px-10 rounded-full gap-2 group"
            onClick={() => navigate("/learner/auth")}
          >
            Try It Free
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p className="text-xs text-gray-400 mt-3">No credit card required.</p>
        </div>
      </div>
    </section>
  );
};

export default StudyModeSection;
