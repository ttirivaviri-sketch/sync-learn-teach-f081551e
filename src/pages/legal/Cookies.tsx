import LegalLayout from "@/components/legal/LegalLayout";

export default function Cookies() {
  return (
    <LegalLayout title="Cookie Policy">
      <p>StudySync uses a small number of cookies and similar technologies (localStorage, sessionStorage) to keep you signed in, remember your preferences and measure usage.</p>

      <h2>Essential</h2>
      <ul>
        <li><strong>Authentication</strong> — keeps you signed in across visits.</li>
        <li><strong>Preferences</strong> — remembers your country, currency and onboarding progress.</li>
      </ul>

      <h2>Analytics</h2>
      <p>We use anonymised, aggregated analytics to count visits and understand which features are used. We do not use third-party advertising cookies.</p>

      <h2>Opting out</h2>
      <p>You can clear cookies in your browser settings at any time. Disabling essential cookies will sign you out.</p>
    </LegalLayout>
  );
}
