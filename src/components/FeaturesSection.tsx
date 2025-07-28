import { Card, CardContent } from "@/components/ui/card";
import { 
  Smartphone, 
  Globe, 
  Zap, 
  DollarSign,
  BookOpen,
  Users
} from "lucide-react";

const FeaturesSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Built for Everyone
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            StudySync is designed to work seamlessly on Android devices, 
            supporting multilingual users with data-efficient technology.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="bg-gradient-card shadow-card border-0 group hover:shadow-elegant transition-shadow">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Android Optimized</h3>
              <p className="text-muted-foreground">
                Built specifically for Android devices, optimized for low-end phones and minimal data usage.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0 group hover:shadow-elegant transition-shadow">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-secondary/20 transition-colors">
                <Globe className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Multilingual Support</h3>
              <p className="text-muted-foreground">
                Available in multiple languages to serve diverse communities and educational needs.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0 group hover:shadow-elegant transition-shadow">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Low Data Usage</h3>
              <p className="text-muted-foreground">
                Efficient design ensures the app works well even with limited data connections.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0 group hover:shadow-elegant transition-shadow">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-secondary/20 transition-colors">
                <DollarSign className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Affordable Learning</h3>
              <p className="text-muted-foreground">
                Competitive pricing with flexible payment options including mobile money and cash.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0 group hover:shadow-elegant transition-shadow">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">All Subjects</h3>
              <p className="text-muted-foreground">
                From Grade 8-12 school subjects to university modules across all disciplines.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0 group hover:shadow-elegant transition-shadow">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-secondary/20 transition-colors">
                <Users className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Community Driven</h3>
              <p className="text-muted-foreground">
                Built by students, for students, creating opportunities for educational growth and income.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <div className="bg-gradient-hero rounded-2xl p-8 md:p-12 text-center">
            <h3 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
              Ready to Transform Education?
            </h3>
            <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
              Join thousands of students and tutors who are making quality education accessible for everyone.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 px-8 py-4 rounded-lg font-semibold shadow-elegant transition-colors">
                Download for Students
              </button>
              <button className="border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary px-8 py-4 rounded-lg font-semibold transition-colors">
                Apply as Tutor
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;