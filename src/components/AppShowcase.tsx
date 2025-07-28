import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  GraduationCap, 
  Search, 
  Calendar, 
  CreditCard,
  Shield,
  Upload,
  CheckCircle,
  Star
} from "lucide-react";
import learnerAppImage from "@/assets/learner-app-mockup.jpg";
import tutorAppImage from "@/assets/tutor-app-mockup.jpg";

const AppShowcase = () => {
  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Two Apps, One Mission
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            StudySync provides separate, optimized experiences for learners and tutors, 
            built specifically for Android devices.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Learner App */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary rounded-xl">
                <GraduationCap className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-foreground">StudySync Learner</h3>
                <p className="text-muted-foreground">For students who need help</p>
              </div>
            </div>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-8">
                <h4 className="text-xl font-semibold mb-6 text-foreground">Key Features:</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Search className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Smart Tutor Search</p>
                      <p className="text-sm text-muted-foreground">Find tutors by subject, level, or specific modules</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Star className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Verified Profiles</p>
                      <p className="text-sm text-muted-foreground">View qualifications, ratings, and reviews</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Easy Booking</p>
                      <p className="text-sm text-muted-foreground">Choose dates, times, and get confirmations</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Flexible Payment</p>
                      <p className="text-sm text-muted-foreground">Mobile money or cash options</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 flex flex-wrap gap-2">
                  <Badge variant="secondary">Grade 8-12</Badge>
                  <Badge variant="secondary">University</Badge>
                  <Badge variant="secondary">All Subjects</Badge>
                </div>
              </CardContent>
            </Card>

            <Button 
              className="w-full bg-primary hover:bg-primary/90 shadow-elegant"
              onClick={() => window.location.href = '/learner'}
            >
              Try Learner App
            </Button>
          </div>

          {/* App Mockup */}
          <div className="flex justify-center">
            <div className="relative">
              <img 
                src={learnerAppImage} 
                alt="StudySync Learner App Interface"
                className="w-80 h-auto rounded-3xl shadow-elegant"
              />
              <div className="absolute -top-4 -right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                For Students
              </div>
            </div>
          </div>
        </div>

        {/* Tutor App */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mt-24">
          {/* App Mockup */}
          <div className="flex justify-center lg:order-1">
            <div className="relative">
              <img 
                src={tutorAppImage} 
                alt="StudySync Tutor App Interface"
                className="w-80 h-auto rounded-3xl shadow-elegant"
              />
              <div className="absolute -top-4 -right-4 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-medium">
                For Tutors
              </div>
            </div>
          </div>

          <div className="space-y-8 lg:order-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-secondary rounded-xl">
                <Shield className="h-8 w-8 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-foreground">StudySync Tutor</h3>
                <p className="text-muted-foreground">For people who want to teach</p>
              </div>
            </div>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-8">
                <h4 className="text-xl font-semibold mb-6 text-foreground">Key Features:</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Upload className="h-5 w-5 text-secondary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Document Verification</p>
                      <p className="text-sm text-muted-foreground">Upload ID and academic certificates</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-secondary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Background Checks</p>
                      <p className="text-sm text-muted-foreground">Criminal record verification for safety</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <GraduationCap className="h-5 w-5 text-secondary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Subject Selection</p>
                      <p className="text-sm text-muted-foreground">Choose what you want to teach</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-5 w-5 text-secondary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Earnings Tracking</p>
                      <p className="text-sm text-muted-foreground">Monitor income and request payouts</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-secondary text-secondary">Verified</Badge>
                  <Badge variant="outline" className="border-secondary text-secondary">Trusted</Badge>
                  <Badge variant="outline" className="border-secondary text-secondary">Qualified</Badge>
                </div>
              </CardContent>
            </Card>

            <Button 
              className="w-full bg-secondary hover:bg-secondary/90 shadow-elegant"
              onClick={() => window.location.href = '/tutor'}
            >
              Try Tutor App
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppShowcase;