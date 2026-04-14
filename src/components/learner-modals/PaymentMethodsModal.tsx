import { CreditCard, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PaymentMethodsModalProps {
  open: boolean;
  onClose: () => void;
}

const METHODS = [
  { name: "DevCard (Test)", desc: "Simulates payment — no real money charged", isTest: true },
  { name: "Credit / Debit Card", desc: "Visa, Mastercard, Amex via PayFast", isTest: false },
  { name: "EFT / Bank Transfer", desc: "Pay via your bank's online portal", isTest: false },
  { name: "Instant EFT", desc: "Secure instant bank payment via Ozow", isTest: false },
  { name: "Mobicred", desc: "Buy now, pay later in instalments", isTest: false },
] as const;

export function PaymentMethodsModal({ open, onClose }: PaymentMethodsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div className="bg-background w-full rounded-t-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Payment Methods</h3>
          <button onClick={onClose} className="text-muted-foreground text-sm">&#x2715;</button>
        </div>
        <div className="space-y-3">
          {METHODS.map((m) => (
            <div
              key={m.name}
              className={`flex items-center gap-3 p-3 border rounded-lg ${
                m.isTest ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : ""
              }`}
            >
              {m.isTest ? (
                <FlaskConical className="h-5 w-5 text-amber-600" />
              ) : (
                <CreditCard className="h-5 w-5 text-primary" />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
              <Badge
                variant={m.isTest ? "outline" : "default"}
                className={m.isTest ? "border-amber-400 text-amber-700" : "bg-green-500"}
              >
                {m.isTest ? "Test" : "Active"}
              </Badge>
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-2">
            All real payments are processed securely by PayFast, South Africa's trusted payment gateway.
          </p>
        </div>
      </div>
    </div>
  );
}
