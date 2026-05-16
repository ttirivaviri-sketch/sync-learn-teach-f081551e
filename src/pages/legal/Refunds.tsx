import LegalLayout from "@/components/legal/LegalLayout";

export default function Refunds() {
  return (
    <LegalLayout title="Refund Policy">
      <p>This policy explains when you can request a refund for tutor bookings on StudySync.</p>

      <h2>Cancellations by the learner</h2>
      <ul>
        <li><strong>More than 24 hours before the session:</strong> full refund.</li>
        <li><strong>Within 24 hours of the session:</strong> 50% refund.</li>
        <li><strong>After the scheduled start time:</strong> no refund.</li>
      </ul>

      <h2>Cancellations by the tutor</h2>
      <p>If a tutor cancels for any reason, you receive a full refund automatically.</p>

      <h2>No-shows</h2>
      <p>If the tutor does not join within 10 minutes of the scheduled start time, you may request a full refund through the in-app support form.</p>

      <h2>Technical failures</h2>
      <p>If a verified technical failure on our side prevents the session from happening, we will refund in full or reschedule, at your choice.</p>

      <h2>How to request</h2>
      <p>Open the booking in your Activity tab and tap <em>Request refund</em>, or email supportstudysync@gmail.com. Refunds are returned to the original payment method via PayFast within 5-10 business days.</p>

      <h2>Subscriptions</h2>
      <p>Monthly subscriptions can be cancelled at any time and remain active until the end of the current billing period. We do not offer pro-rata refunds for unused subscription time.</p>
    </LegalLayout>
  );
}
