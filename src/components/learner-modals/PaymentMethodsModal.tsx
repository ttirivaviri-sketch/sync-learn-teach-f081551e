import { CreditCard, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PaymentMethodsModalProps {
  open: boolean;
  onClose: () => void;
  bypassPayments?: boolean;
}

const METHODS = [
  { name: "Credit / Debit Card", desc: "Visa, Mastercard, Amex via PayFast" },
  { name: "EFT / Bank Transfer", desc: "Pay via your bank's online portal" },
  { name: "Instant EFT", desc: "Secure instant bank payment via Ozow" },
  { name: "Mobicred", desc: "Buy now, pay later in instalments" },
] as const;

export function PaymentMethodsModal({ open, onClose, bypassPayments }: PaymentMethodsModalProps) {
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
            <div key={m.name} className="flex items-center gap-3 p-3 border rounded-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
              <Badge variant="default" className="bg-green-500">Active</Badge>
            </div>
          ))}
          {bypassPayments && (
            <div className="flex items-center gap-3 p-3 border border-yellow-300 rounded-lg bg-yellow-50">
              <Zap className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <p className="font-medium text-sm text-yellow-800">Dev Bypass</p>
                <p className="text-xs text-yellow-600">Payments skipped in dev mode</p>
              </div>
              <Badge variant="outline" className="border-yellow-400 text-yellow-700">Dev</Badge>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center pt-2">
            All payments are processed securely by PayFast, South Africa's trusted payment gateway.
          </p>
        </div>
      </div>
    </div>
  );
}
