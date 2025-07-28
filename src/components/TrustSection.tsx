import { Card, CardContent } from "@/components/ui/card";
import { 
  Shield, 
  Award, 
  Users, 
  CheckCircle,
  FileCheck,
  Star
} from "lucide-react";

const TrustSection = () => {
  return (
    <section className="py-20 bg-accent/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Trust & Safety First
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our rigorous verification process ensures that learners connect with qualified, 
            trustworthy tutors who are committed to educational excellence.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-background shadow-card border-0 text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileCheck className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Document Verification</h3>
              <p className="text-muted-foreground">
                All tutors must provide valid ID and academic certificates. 
                We verify Matric certificates and university transcripts.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background shadow-card border-0 text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Background Checks</h3>
              <p className="text-muted-foreground">
                Criminal background verification ensures the safety and security 
                of all learning interactions on our platform.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background shadow-card border-0 text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Quality Ratings</h3>
              <p className="text-muted-foreground">
                Student feedback and ratings help maintain high teaching standards 
                and guide future learners in their tutor selection.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-gradient-card rounded-2xl p-8 md:p-12 shadow-elegant">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="flex items-center justify-center mb-4">
                <CheckCircle className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-2">100%</h3>
              <p className="text-muted-foreground">Verified Tutors</p>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-4">
                <Award className="h-12 w-12 text-secondary" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-2">500+</h3>
              <p className="text-muted-foreground">Qualified Educators</p>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-4">
                <Users className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-2">1000+</h3>
              <p className="text-muted-foreground">Happy Students</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustSection;