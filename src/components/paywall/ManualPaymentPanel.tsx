/**
 * ManualPaymentPanel — temporary manual payment (deposit / EFT / EcoCash) block.
 *
 * Same logic as the Study Mode paywall, but reusable for any plan amount so it
 * can be dropped into Profile → Subscription & Plans while card payments are off.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, CheckCircle2, Copy } from 'lucide-react';
import {
  MANUAL_PAYMENT,
  METHOD_LABELS,
  SUPPORTED_CURRENCIES,
  type ManualPaymentMethod,
  type PaymentCurrency,
} from '@/lib/manualPayment';
import { useFxRate, symbol } from '@/lib/fx';
import { logger } from '@/utils/logger';

function Row({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <button
        type="button"
        className="flex items-center gap-1.5 font-medium text-foreground"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          toast({ title: 'Copied', description: `${label} copied` });
        }}
      >
        {value}
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

interface Props {
  planLabel: string;
  priceZar: number;
  accessDays?: number;
  onSubmitted?: () => void;
}

export function ManualPaymentPanel({ planLabel, priceZar, accessDays = 30, onSubmitted }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [method, setMethod] = useState<ManualPaymentMethod>('eft');
  const [currency, setCurrency] = useState<PaymentCurrency>('ZAR');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usdRate = useFxRate('ZAR', 'USD');
  const rate = currency === 'ZAR' ? 1 : usdRate;
  const rateReady = rate !== null;
  // Round USD up to 2dp so learners never underpay on conversion.
  const dueAmount = rateReady ? Math.ceil(priceZar * (rate as number) * 100) / 100 : null;
  const dueLabel = dueAmount === null
    ? '—'
    : `${symbol(currency)}${dueAmount.toFixed(currency === 'ZAR' ? 0 : 2)}`;

  useEffect(() => {
    if (dueAmount !== null) setAmount(dueAmount.toFixed(currency === 'ZAR' ? 0 : 2));
  }, [dueAmount, currency]);

  const handleSubmit = async () => {
    if (!reference.trim()) {
      toast({ title: 'Reference required', description: 'Enter the reference you used when paying.', variant: 'destructive' });
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter the amount you paid.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You need to be signed in.');

      let proofPath: string | null = null;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error('Proof image must be under 5MB.');
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, file);
        if (upErr) throw upErr;
        proofPath = path;
      }

      const { error } = await (supabase as any).from('manual_payment_requests').insert({
        user_id: user.id,
        method,
        reference: reference.trim().slice(0, 120),
        amount: amt,
        currency,
        proof_path: proofPath,
        access_days: accessDays,
      });
      if (error) throw error;

      toast({ title: 'Proof submitted', description: "We'll confirm your payment shortly." });
      qc.invalidateQueries({ queryKey: ['manual-payment-request'] });
      setReference('');
      setFile(null);
      onSubmitted?.();
    } catch (e) {
      logger.error('manual payment submit failed', e as Error);
      toast({
        title: 'Could not submit',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pay by deposit, EFT or EcoCash</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Pay in</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as PaymentCurrency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === 'ZAR' ? 'South African Rand (ZAR)' : 'US Dollar (USD)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {planLabel} — <span className="font-semibold text-foreground">{dueLabel}</span> for {accessDays} days.
              {currency === 'USD' && usdRate
                ? ` R${priceZar} converted at the live mid-market rate (1 ZAR = $${usdRate.toFixed(4)}).`
                : ''}
            </p>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Bank deposit / EFT</p>
            <Row label="Account name" value={MANUAL_PAYMENT.bank.accountName} />
            <Row label="Bank" value={MANUAL_PAYMENT.bank.bank} />
            <Row label="Account number" value={MANUAL_PAYMENT.bank.accountNumber} />
            <Row label="Branch" value={MANUAL_PAYMENT.bank.branch} />
            <Row label="Branch code" value={MANUAL_PAYMENT.bank.branchCode} />
            {MANUAL_PAYMENT.bank.swiftCode && (
              <Row label="SWIFT code" value={MANUAL_PAYMENT.bank.swiftCode} />
            )}
            <Row label="Reference" value={MANUAL_PAYMENT.bank.reference} />
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">EcoCash</p>
            <Row label="Name" value={MANUAL_PAYMENT.ecocash.name} />
            <Row label="Number" value={MANUAL_PAYMENT.ecocash.number} />
            <Row label="Reference" value={MANUAL_PAYMENT.ecocash.reference} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Send us the proof</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as ManualPaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(METHOD_LABELS) as ManualPaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-mp-ref">Reference used</Label>
            <Input
              id="sub-mp-ref"
              value={reference}
              maxLength={120}
              placeholder="e.g. your email or deposit slip number"
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-mp-amount">Amount paid ({currency})</Label>
            <Input
              id="sub-mp-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Due: {dueLabel} for {planLabel}.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-mp-file">Proof of payment (optional)</Label>
            <Input
              id="sub-mp-file"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" /> {file.name}
              </p>
            )}
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Submit for confirmation
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Confirmed manually by our team, usually within a few hours during business days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ManualPaymentPanel;
