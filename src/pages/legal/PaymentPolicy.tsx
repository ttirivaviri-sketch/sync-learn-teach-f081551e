import LegalLayout from "@/components/legal/LegalLayout";

export default function PaymentPolicy() {
  return (
    <LegalLayout
      title="Payment Policy"
      description="How tutor payments work on StudySync: R300 per 1-hour session, how the session fee is split between the platform and the tutor, when tutors can request payouts and what happens when a refund is approved."
    >
      <p>This policy explains how payments for tutor sessions work on StudySync — what learners pay, how the fee is split, and when tutors receive their earnings. It forms part of our <a href="/legal/terms">Terms of Service</a> and should be read together with our <a href="/legal/refunds">Refund Policy</a>.</p>

      <h2>What learners pay</h2>
      <p>All tutor sessions are booked in 1-hour blocks at a flat rate of <strong>R300 per session</strong>, which the learner pays up-front when the booking is confirmed. Payments are processed securely by PayFast (PayFast (Pty) Ltd).</p>
      <p>Where sessions are priced in US dollars, the same structure applies at the equivalent figures: a flat hourly rate with the same proportional split described below.</p>

      <h2>How the session fee is split</h2>
      <p>Of every R300 session fee:</p>
      <ul>
        <li><strong>R200 goes to the tutor</strong> as their earnings for the session.</li>
        <li><strong>R100 is retained by StudySync</strong> as the platform fee, covering booking processing, payment processing, support and the tutoring infrastructure.</li>
      </ul>
      <p>For sessions priced in US dollars, the equivalent split applies: the tutor receives two thirds of the session fee and StudySync retains one third.</p>

      <h2>When tutors can request a payout</h2>
      <p>Tutors can request a payout of their available earnings from the Tutor Dashboard at any time, subject to these conditions:</p>
      <ul>
        <li><strong>Lessons must be completed.</strong> Only earnings from sessions that have taken place and been completed become eligible for payout.</li>
        <li><strong>No refund request may be pending or approved.</strong> If a learner has requested a refund for a session, the tutor's earnings for that session are held until the refund request is resolved.</li>
      </ul>

      <h2>Refunds and tutor earnings</h2>
      <p>Tutor earnings are tied directly to the refund outcome for each session:</p>
      <ul>
        <li><strong>No refund requested:</strong> once the session is completed, the tutor's share becomes payable and can be included in a payout request.</li>
        <li><strong>Refund requested:</strong> the tutor's earnings for that session are held while the request is reviewed.</li>
        <li><strong>Refund approved:</strong> the tutor does not get paid for that session. The tutor's share is either never released or is deducted from their available balance, and the learner receives the refund as set out in the <a href="/legal/refunds">Refund Policy</a>.</li>
        <li><strong>Refund declined:</strong> the tutor's earnings for that session become payable as normal.</li>
      </ul>

      <h2>How payouts are made</h2>
      <p>Payouts are transferred to the tutor's verified bank account, on request. Every payout is subject to a routine anti-fraud and account-verification review before funds are released. Tutors are responsible for providing accurate banking details; payouts sent to incorrect details provided by the tutor may not be recoverable.</p>

      <h2>Disputes</h2>
      <p>If a tutor disputes a refund decision or a payout amount, they can contact us at support. We review each case against the session records, the refund request and this policy, and our decision on the split of a session fee is final.</p>
    </LegalLayout>
  );
}
