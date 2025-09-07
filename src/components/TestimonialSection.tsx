import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

const testimonials = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "University Student",
    content: "StudySync helped me find an amazing calculus tutor who completely transformed my understanding. My grades went from C to A!",
    rating: 5,
    subject: "Mathematics"
  },
  {
    id: 2,
    name: "Dr. Michael Rodriguez",
    role: "Professional Tutor",
    content: "As a former university professor, StudySync gives me the perfect platform to continue teaching and helping students succeed.",
    rating: 5,
    subject: "Physics"
  },
  {
    id: 3,
    name: "Emma Thompson",
    role: "High School Student",
    content: "The chemistry tutor I found through StudySync made complex concepts so easy to understand. Highly recommend!",
    rating: 5,
    subject: "Chemistry"
  }
];

export const TestimonialSection = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-accent/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            What Our Community Says
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of successful learners and expert tutors who trust StudySync
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="bg-card border-0 shadow-card hover:shadow-elegant transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 italic">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                  <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {testimonial.subject}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};