import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { COUNTRIES, type CountryCode } from "@/lib/legal";

interface CountryStepProps {
  country: CountryCode;
  onSelect: (c: CountryCode) => void;
  onNext: () => void;
}

export function CountryStep({ country, onSelect, onNext }: CountryStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-lg">Where are you studying?</h2>
        <p className="text-sm text-muted-foreground">
          We'll match your curriculum and show prices in your local currency.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {COUNTRIES.map((c) => (
          <Card
            key={c.code}
            className={`cursor-pointer transition-all ${
              country === c.code ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/40"
            }`}
            onClick={() => onSelect(c.code)}
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl" aria-hidden>{c.flag}</span>
                <div>
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.defaultCurriculum} · {c.currency}
                  </div>
                </div>
              </div>
              {country === c.code && <Check className="h-4 w-4 text-primary" />}
            </CardContent>
          </Card>
        ))}
      </div>
      <Button className="w-full mt-2" onClick={onNext}>
        Next: Curriculum <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
