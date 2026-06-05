import LegalLayout from "@/components/legal/LegalLayout";
import { COMPANY } from "@/lib/legal";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service">
      <p>These Terms govern your use of {COMPANY.name} ("we", "us", "our") — a web and mobile platform providing AI-assisted study tools, a curriculum-aligned content library and connections between learners and independent tutors. By creating an account you agree to these Terms.</p>

      <h2>1. Eligibility</h2>
      <p>You must be at least 13 years old to use {COMPANY.name} as a learner. Users under 18 must have guardian consent — guardian contact details are collected during onboarding. Tutors must be 18 or older.</p>

      <h2>2. Accounts</h2>
      <p>You are responsible for the information you provide and for activity under your account. You must not impersonate any person or share login credentials. We may suspend accounts that violate these Terms, our Community Guidelines, or applicable law.</p>

      <h2>3. Tutors are independent contractors</h2>
      <p>Tutors offer services through {COMPANY.name} as independent contractors. They are <strong>not employees, agents or partners</strong> of {COMPANY.name}. We facilitate bookings and payments but do not deliver tuition ourselves and do not control how a tutor conducts a session.</p>

      <h2>4. Bookings, payments and refunds</h2>
      <p>Bookings are 30-minute slots that the learner pays for up-front. Payments are processed by PayFast (PayFast (Pty) Ltd). Refunds are governed by our <a href="/legal/refunds">Refund Policy</a>. Tutor earnings are paid out to verified bank accounts on request, subject to anti-fraud review.</p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to use {COMPANY.name} to cheat in active examinations, to harass or defraud other users, to upload illegal or infringing content, or to reverse-engineer the platform. Detailed rules live in our <a href="/legal/community">Community Guidelines</a>.</p>

      <h2>6. AI features — no guarantees</h2>
      <p>{COMPANY.name} uses AI (currently Google Gemini via the Lovable AI Gateway) to generate study material, answers, feedback, lesson transcripts, lesson notes, and reinforcement quizzes and flashcards. AI output may be inaccurate or incomplete. <strong>Always verify with your textbook, syllabus or a qualified teacher.</strong> AI explanations are study aids, not authoritative academic guidance, and we do not guarantee any specific exam outcome. Lesson recording, transcription, and AI notes are opt-in for both parties and governed by our <a href="/legal/data-compliance">Data &amp; Compliance policy</a>.</p>


      <h2>7. Library content</h2>
      <p>The Library aggregates educational resources from public sources for non-commercial student use. We do not sell library content. See the <a href="/legal/library">Library Disclaimer</a> for attribution and takedown procedures.</p>

      <h2>8. Intellectual property</h2>
      <p>The {COMPANY.name} software, brand, logos and original content are owned by {COMPANY.name}. You retain ownership of material you upload but grant us a worldwide, royalty-free licence to host and display it as required to run the service.</p>

      <h2>9. Termination</h2>
      <p>You may close your account at any time by contacting <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. We may suspend or terminate accounts for breach of these Terms with reasonable notice except where immediate action is required to protect users.</p>

      <h2>10. Disclaimers and liability</h2>
      <p>The service is provided "as is". To the maximum extent permitted by law, {COMPANY.name} disclaims all warranties of merchantability, fitness for a particular purpose and non-infringement, and is not liable for indirect, incidental or consequential damages. Nothing in these Terms limits liability that cannot be excluded by law, including under the Consumer Protection Act, 2008 (South Africa).</p>

      <h2>11. Governing law</h2>
      <p>These Terms are governed by the laws of {COMPANY.jurisdiction}. The courts of {COMPANY.courts} have non-exclusive jurisdiction over any dispute.</p>

      <h2>12. Changes</h2>
      <p>We may update these Terms. Material changes will be notified in-app or by email. Continued use after the effective date constitutes acceptance.</p>
    </LegalLayout>
  );
}
