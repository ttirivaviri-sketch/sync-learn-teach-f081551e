import { Separator } from "@/components/ui/separator";
import { GraduationCap } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-muted/50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">StudySync</span>
            </div>
            <p className="text-muted-foreground">
              Connecting learners with verified, qualified tutors for accessible quality education.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-4">For Students</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>Find Tutors</p>
              <p>Book Sessions</p>
              <p>Track Progress</p>
              <p>Student Support</p>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-4">For Tutors</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>Become a Tutor</p>
              <p>Verification Process</p>
              <p>Earnings</p>
              <p>Tutor Support</p>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-4">Company</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>About Us</p>
              <p>Privacy Policy</p>
              <p>Terms of Service</p>
              <p>Contact</p>
            </div>
          </div>
        </div>
        
        <Separator className="my-8" />
        
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-muted-foreground">
            © 2024 StudySync. All rights reserved.
          </p>
          <p className="text-muted-foreground">
            Made with ❤️ for accessible education
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;