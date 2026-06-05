import LegalLayout from "@/components/legal/LegalLayout";
import { COMPANY } from "@/lib/legal";

export default function DataCompliance() {
  return (
    <LegalLayout title="Data &amp; Compliance">
      <p>This page summarises how {COMPANY.name} handles the data generated when you use lesson recording, transcription, and AI-generated notes — and the controls available to you. It supplements our <a href="/legal/privacy">Privacy Policy</a> and <a href="/legal/terms">Terms of Service</a>.</p>

      <h2>1. Scope</h2>
      <p>This policy covers: lesson audio recordings, diarised transcripts (Tutor / Learner labelled), AI-generated lesson notes, topic mappings, and reinforcement quizzes / flashcards derived from your lessons. It is designed to meet our obligations under POPIA (South Africa) and GDPR (EU/UK) where applicable.</p>

      <h2>2. Consent</h2>
      <p>Lesson recording, transcription, and AI-note generation are <strong>opt-in for both parties</strong>. Captions and recording will not start in a lesson unless both the tutor and the learner have toggled the relevant consent for that booking in <em>Profile → Data &amp; Compliance</em>. You may withdraw consent at any time; ongoing recording will stop on the next lesson.</p>

      <h2>3. Processors</h2>
      <ul>
        <li><strong>Lovable AI Gateway (Google Gemini)</strong> — speech-to-text, diarisation, note generation, and reinforcement content. Audio is sent only for the duration of processing and is not retained by the processor.</li>
        <li><strong>Supabase</strong> — encrypted storage of audio (private bucket), transcripts, notes, and consent records.</li>
      </ul>

      <h2>4. Retention</h2>
      <p>Default retention for lesson audio and transcripts is <strong>90 days</strong>. You may set this anywhere between 7 and 365 days in <em>Profile → Data &amp; Compliance</em>. By default, AI-generated notes are retained after the audio is purged so StudyMode can keep reinforcing what you learnt; you can disable this behaviour. Account and payment data follow the retention rules in our Privacy Policy.</p>

      <h2>5. Access</h2>
      <ul>
        <li>The learner and tutor of a booking can read each other's consent status (to know whether to start recording) but not each other's private notes.</li>
        <li>Learner notes are visible to the learner only; tutor notes are visible to the tutor only.</li>
        <li>Transcripts are visible to both parties of the booking.</li>
        <li>StudySync staff do not routinely access lesson data; access is logged and limited to incident response.</li>
      </ul>

      <h2>6. Your rights</h2>
      <ul>
        <li><strong>Export</strong> — download a complete JSON bundle of your lesson recordings, transcripts, notes, topic mappings, consent records, and reinforcement sets at any time.</li>
        <li><strong>Delete</strong> — delete an individual recording (audio + transcript + notes + topic mapping) or all of your lesson data in one click.</li>
        <li><strong>Object / restrict processing</strong> — disable transcription or AI-notes consent for any booking without affecting the lesson itself.</li>
        <li><strong>Complain</strong> — to the Information Regulator (South Africa) or your local supervisory authority.</li>
      </ul>

      <h2>7. Security</h2>
      <p>Audio is stored in a private Supabase storage bucket; access is restricted by RLS to the booking's participants and our service role. Data in transit is encrypted with TLS. Transcription requests to the AI processor are authenticated and not used for model training.</p>

      <h2>8. Children</h2>
      <p>Where the learner is under 18, the guardian on file is treated as a co-consenting party for lesson recording. We recommend tutors confirm guardian awareness before enabling recording for any minor.</p>

      <h2>9. Changes</h2>
      <p>We will notify users of material changes by email or in-app at least 14 days before they take effect.</p>

      <h2>10. Contact</h2>
      <p>For privacy or compliance requests email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
    </LegalLayout>
  );
}
