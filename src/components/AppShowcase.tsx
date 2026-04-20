import { CheckCircle } from "lucide-react";

const AppShowcase = () => {
  const checkItems = [
    "Safe online learning",
    "Diverse students",
    "Expert tutors",
    "Structured study",
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left -- photo */}
          <div className="flex-1 flex justify-center">
            <img
              src="/images/girl-phone.png"
              alt="Student using StudySync on phone"
              loading="lazy"
              decoding="async"
              className="w-full max-w-md rounded-3xl object-cover shadow-lg"
            />
          </div>

          {/* Right -- copy */}
          <div className="flex-1">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-5">
              Built for <span className="text-gray-900">real</span> students
            </h2>
            <p className="text-base text-gray-600 leading-relaxed mb-8 max-w-lg">
              Whether you're preparing for school exams, improving your grades, or mastering difficult subjects, StudySync provides the tools and support students need to succeed.
            </p>

            <ul className="space-y-4">
              {checkItems.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                  <span className="text-base text-gray-700 font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppShowcase;
