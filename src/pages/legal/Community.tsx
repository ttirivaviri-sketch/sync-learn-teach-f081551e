import LegalLayout from "@/components/legal/LegalLayout";

export default function Community() {
  return (
    <LegalLayout title="Community Guidelines">
      <p>To keep StudySync safe and useful for every student and tutor, all users agree to the following.</p>

      <h2>Respect</h2>
      <ul>
        <li>No harassment, hate speech, discrimination or threats.</li>
        <li>No sharing of personal contact details to circumvent platform protections.</li>
        <li>Tutors must keep sessions professional and age-appropriate.</li>
      </ul>

      <h2>Academic integrity</h2>
      <ul>
        <li>StudySync may not be used to cheat during a live exam.</li>
        <li>AI explanations are study aids, not answers to submit as your own work.</li>
        <li>Plagiarism of textbook content into uploads is not allowed.</li>
      </ul>

      <h2>Content</h2>
      <ul>
        <li>No illegal, sexual, violent or copyright-infringing uploads.</li>
        <li>Study Clips and tutorials must be original or properly attributed.</li>
      </ul>

      <h2>Reporting</h2>
      <p>Report violations through the in-app support form or email supportstudysync@gmail.com. Confirmed breaches lead to warnings, content removal or account termination.</p>
    </LegalLayout>
  );
}
