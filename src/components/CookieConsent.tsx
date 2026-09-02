import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cookie } from "lucide-react";
import { getConsent, setConsent } from "@/lib/consent";

/**
 * Cookie consent banner (POPIA / GDPR).
 *
 * Choices are stored via `src/lib/consent.ts` and actually enforced:
 * optional tracking (e.g. attaching your email to error reports) only runs
 * after "Accept". "Decline" keeps strictly-necessary cookies only (your
 * sign-in session and saved preferences).
 */
export const CookieConsent = () => {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    if (getConsent() === null) setShowConsent(true);
  }, []);

  const choose = (value: "accepted" | "declined") => {
    setConsent(value);
    setShowConsent(false);
  };

  if (!showConsent) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-sm border-t">
      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-4">
          <div className="flex items-start gap-4 md:items-center">
            <Cookie className="h-6 w-6 text-primary flex-shrink-0 mt-1 md:mt-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold mb-1">We use cookies</h4>
              <p className="text-sm text-muted-foreground mb-3 md:mb-0">
                Strictly-necessary cookies keep you signed in. With your consent we also use
                analytics to improve StudySync. Declining keeps only the essential ones. See our{" "}
                <a href="/legal/cookies" className="underline hover:text-foreground">Cookie Policy</a>.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => choose("declined")}>
                Decline
              </Button>
              <Button size="sm" onClick={() => choose("accepted")}>
                Accept
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
