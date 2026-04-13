import { PaymentHistory } from "@/components/PaymentHistory";

interface PaymentHistoryModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export function PaymentHistoryModal({ open, onClose, userId }: PaymentHistoryModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div
        className="bg-background w-full rounded-t-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <h3 className="font-bold text-lg">Full Payment History</h3>
          <button onClick={onClose} className="text-muted-foreground text-sm">&#x2715;</button>
        </div>
        <div className="p-4">
          <PaymentHistory userId={userId} limit={50} showViewAll={false} />
        </div>
      </div>
    </div>
  );
}
