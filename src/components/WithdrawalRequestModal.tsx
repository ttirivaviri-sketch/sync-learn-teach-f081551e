/**
 * WithdrawalRequestModal — Tutor-facing form to request a wallet payout.
 *
 * - Validates against current wallet balance and R50 minimum.
 * - Pre-fills bank details from localStorage for convenience.
 */
import { useState, useEffect } from "react";
import { Loader2, Banknote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useWithdrawals } from "@/hooks/useWithdrawals";

const STORAGE_KEY = "studysync.withdrawal.bank";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tutorId: string;
  availableBalance: number;
}

export function WithdrawalRequestModal({ open, onOpenChange, tutorId, availableBalance }: Props) {
  const { requestWithdrawal, submitting } = useWithdrawals(tutorId);
  const { toast } = useToast();

  const [amount, setAmount] = useState<string>("");
  const [holder, setHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchCode, setBranchCode] = useState("");

  useEffect(() => {
    if (!open) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      setHolder(saved.holder || "");
      setBankName(saved.bankName || "");
      setAccountNumber(saved.accountNumber || "");
      setBranchCode(saved.branchCode || "");
    } catch {
      /* ignore */
    }
    setAmount(availableBalance >= 50 ? availableBalance.toFixed(2) : "");
  }, [open, availableBalance]);

  const numericAmount = Number(amount);
  const amountValid = numericAmount >= 50 && numericAmount <= availableBalance;
  const formValid =
    amountValid && holder.trim() && bankName.trim() && accountNumber.trim();

  const handleSubmit = async () => {
    if (!formValid) return;
    const result = await requestWithdrawal({
      amount: numericAmount,
      bank_account_holder: holder.trim(),
      bank_name: bankName.trim(),
      bank_account_number: accountNumber.trim(),
      bank_branch_code: branchCode.trim() || undefined,
    });
    if (result.ok) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ holder, bankName, accountNumber, branchCode })
        );
      } catch {
        /* ignore */
      }
      toast({
        title: "Withdrawal requested",
        description: `R${numericAmount.toFixed(2)} is pending review. You'll be notified when it's processed.`,
      });
      onOpenChange(false);
    } else {
      toast({
        title: "Could not submit",
        description: result.error || "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Withdraw to bank account
          </DialogTitle>
          <DialogDescription>
            Available balance: <strong>R{availableBalance.toFixed(2)}</strong> · Minimum R50. Funds
            are released after admin approval and EFT is processed within 1–3 working days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="w-amount">Amount (ZAR)</Label>
            <Input
              id="w-amount"
              type="number"
              min={50}
              max={availableBalance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {amount && !amountValid && (
              <p className="text-xs text-destructive mt-1">
                {numericAmount < 50
                  ? "Minimum withdrawal is R50."
                  : "Amount exceeds available balance."}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="w-holder">Account holder name</Label>
            <Input
              id="w-holder"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="As it appears on your bank account"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="w-bank">Bank name</Label>
              <Input
                id="w-bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. FNB"
              />
            </div>
            <div>
              <Label htmlFor="w-branch">Branch code</Label>
              <Input
                id="w-branch"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                placeholder="e.g. 250655"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="w-acct">Account number</Label>
            <Input
              id="w-acct"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Bank account number"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!formValid || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Request withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
