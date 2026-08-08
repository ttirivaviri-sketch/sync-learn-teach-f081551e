import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Clock, Upload, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { MANUAL_PAYMENT, METHOD_LABELS, type ManualPaymentMethod } from '@/lib/manualPayment';
import { useStudyAccess } from '@/hooks/useStudyAccess';
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

export function StudyPaywall() {
  const { state, latestRequest, refetch } = useStudyAccess();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [method, setMethod] = useState<ManualPaymentMethod>('eft');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(String(MANUAL_PAYMENT.priceZar));
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state === 'pending_review') {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <Clock className="h-7 w-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold">We're confirming your payment</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Our team checks deposits during business hours. As soon as it's confirmed, Study Mode unlocks
          automatically and you'll get a notification.
        </p>
        {latestRequest && (
          <Card className="mt-6 text-left">
            <CardContent className="pt-6">
              <Row label="Method" value={METHOD_LABELS[latestRequest.method]} />
              <Row label="Reference" value={latestRequest.reference} />
              <Row label="Amount" value={`${latestRequest.currency} ${Number(latestRequest.amount).toFixed(2)}`} />
            </CardContent>
          </Card>
        )}
        <Button variant="outline" className="mt-6" onClick={refetch}>
          Check status
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          Need help?{' '}
          <a
            className="underline"
            href={`https://wa.me/${MANUAL_PAYMENT.whatsapp}?text=Hi%20StudySync%2C%20I%20submitted%20a%20payment%20proof`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp us
          </a>
        </p>
      </div>
    );
  }

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
        currency: 'ZAR',
        proof_path: proofPath,
        access_days: MANUAL_PAYMENT.accessDays,
      });
      if (error) throw error;

      toast({ title: 'Proof submitted', description: "We'll confirm your payment shortly." });
      qc.invalidateQueries({ queryKey: ['manual-payment-request'] });
      refetch();
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
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Your free task is done</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Unlock unlimited Study Mode — daily tasks, quizzes, flashcards, Photo Solve and the AI tutor — for{' '}
          <span className="font-semibold text-foreground">R{MANUAL_PAYMENT.priceZar}</span> /{' '}
          {MANUAL_PAYMENT.accessDays} days.
        </p>
        {latestRequest?.status === 'rejected' && (
          <Badge variant="destructive" className="mt-3">
            Last submission: {latestRequest.review_note || 'not confirmed — please resubmit'}
          </Badge>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. Pay by deposit, EFT or EcoCash</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Bank deposit / EFT</p>
            <Row label="Account name" value={MANUAL_PAYMENT.bank.accountName} />
            <Row label="Bank" value={MANUAL_PAYMENT.bank.bank} />
            <Row label="Account number" value={MANUAL_PAYMENT.bank.accountNumber} />
            <Row label="Branch code" value={MANUAL_PAYMENT.bank.branchCode} />
            <Row label="Reference" value={MANUAL_PAYMENT.bank.reference} />
          </div>
          <div className="mt-3 rounded-lg border border-border p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">EcoCash</p>
            <Row label="Name" value={MANUAL_PAYMENT.ecocash.name} />
            <Row label="Number" value={MANUAL_PAYMENT.ecocash.number} />
            <Row label="Reference" value={MANUAL_PAYMENT.ecocash.reference} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">2. Send us the proof</CardTitle>
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
            <Label htmlFor="mp-ref">Reference used</Label>
            <Input
              id="mp-ref"
              value={reference}
              maxLength={120}
              placeholder="e.g. your email or deposit slip number"
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-amount">Amount paid (ZAR)</Label>
            <Input
              id="mp-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-file">Proof of payment (optional)</Label>
            <Input
              id="mp-file"
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

export default StudyPaywall;
