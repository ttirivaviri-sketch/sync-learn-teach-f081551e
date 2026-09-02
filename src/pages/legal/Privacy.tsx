import LegalLayout from "@/components/legal/LegalLayout";
import { COMPANY } from "@/lib/legal";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>This policy explains what personal information {COMPANY.name} collects, why we collect it, and your rights. We aim to comply with the Protection of Personal Information Act, 2013 (POPIA) in South Africa and the EU/UK GDPR for users in those regions.</p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email, phone, country, role (learner/tutor).</li>
        <li><strong>Academic profile:</strong> curriculum, grade, subjects, exam dates, optional guardian email.</li>
        <li><strong>Usage data:</strong> pages visited, study activity, quiz attempts, mastery progress, device and browser metadata.</li>
        <li><strong>Payment metadata:</strong> transaction IDs and amounts from PayFast. We never store full card numbers; PayFast handles card data directly.</li>
        <li><strong>Tutor verification:</strong> ID document, qualification documents, bank account details for payouts.</li>
        <li><strong>Communications:</strong> messages between learners and tutors, support tickets.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To run your account, personalise content and match you with tutors.</li>
        <li>To process bookings and payouts.</li>
        <li>To detect fraud and abuse.</li>
        <li>To improve our AI study tools (no personally-identifying data is sent to AI providers beyond what is needed for the immediate task).</li>
        <li>To send transactional emails and, where you have opted in, weekly progress reports.</li>
      </ul>

      <h2>3. Third parties we share with</h2>
      <ul>
        <li><strong>Supabase</strong> — database, authentication, file storage.</li>
        <li><strong>PayFast</strong> — payment processing.</li>
        <li><strong>Lovable AI Gateway (Google Gemini)</strong> — AI generation for study material.</li>
        <li><strong>Jitsi Meet (8x8)</strong> — video conferencing for tutor sessions.</li>
        <li><strong>Resend</strong> — transactional email delivery.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>4. Recording of sessions, transcription &amp; AI notes</h2>
      <p>Live tutoring sessions are not recorded by default. Recording, transcription, and AI-generated notes are <strong>opt-in for both parties</strong> via <em>Profile → Data &amp; Compliance</em>. When enabled, audio is captured in your browser, stored in a private Supabase bucket, transcribed by Google Gemini (via the Lovable AI Gateway) with speaker diarisation (Tutor / Learner), and used to generate per-audience lesson notes and StudyMode reinforcement content (quizzes and flashcards). Default retention is 90 days; you can set anywhere between 7 and 365 days, export the full data bundle, or delete individual recordings at any time. Detailed terms live in our <a href="/legal/data-compliance">Data &amp; Compliance policy</a>.</p>

      <h2>5. Retention</h2>
      <p>We keep account data for as long as your account is active. Financial records are retained for up to 5 years as required by South African tax law. Verification documents are kept for the duration of your tutor account plus 2 years. Lesson recordings and transcripts follow your personal retention setting (default 90 days).</p>


      <h2>6. Your rights</h2>
      <p>You have the right to access, correct, delete or export your personal data, and to lodge a complaint with the Information Regulator (South Africa) or your local supervisory authority.</p>
      <ul>
        <li><strong>Export:</strong> download your lesson data as JSON any time from <em>Settings → Data &amp; Compliance</em>.</li>
        <li><strong>Delete your account:</strong> use the <em>Danger zone</em> in <em>Settings → Data &amp; Compliance</em> to permanently delete your account and personal data yourself — no email required. De-identified financial records are kept for 5 years as required by tax law; everything else is removed immediately.</li>
        <li><strong>Correct:</strong> update your profile details in the app, or email us for anything you cannot edit yourself.</li>
        <li><strong>Everything else:</strong> email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> and we will respond within 30 days.</li>
      </ul>
      <p>Information Regulator (South Africa): <a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer">inforegulator.org.za</a>.</p>

      <h2>7. Children</h2>
      <p>If you are under 18, a parent or guardian must consent to our processing of your information. Guardians may request access to their child's academic data by emailing us from the guardian email on file.</p>

      <h2>8. Cookies &amp; analytics consent</h2>
      <p>Strictly-necessary cookies (your sign-in session and saved preferences) are always active. Optional analytics — including attaching your email address to error reports so we can help you when something breaks — only runs if you click <em>Accept</em> on the cookie banner. Declining keeps only the essential cookies. Full details in the <a href="/legal/cookies">Cookie Policy</a>.</p>

      <h2>9. Security</h2>
      <p>We use TLS in transit, row-level security in the database, and secrets management for API keys. No system is perfectly secure — please use a strong, unique password.</p>

      <h2>10. Changes</h2>
      <p>We will notify you of material changes by email or in-app.</p>
    </LegalLayout>
  );
}
