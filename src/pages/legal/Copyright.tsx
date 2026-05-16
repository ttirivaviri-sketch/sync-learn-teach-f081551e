import LegalLayout from "@/components/legal/LegalLayout";
import { COMPANY } from "@/lib/legal";

export default function Copyright() {
  return (
    <LegalLayout title="Copyright & Takedown Policy">
      <p>{COMPANY.name} respects the intellectual property rights of others and expects users to do the same. This page explains how rights holders can report infringing material and how we respond.</p>

      <h2>Reporting infringement</h2>
      <p>If you believe content on {COMPANY.name} infringes your copyright, email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> with:</p>
      <ol>
        <li>Your name, organisation and contact details.</li>
        <li>Identification of the copyrighted work.</li>
        <li>The exact URL or in-app location of the allegedly infringing material.</li>
        <li>A statement that you have a good-faith belief that use is not authorised by the rights holder.</li>
        <li>A statement, under penalty of perjury, that the information is accurate and that you are authorised to act on the rights holder's behalf.</li>
        <li>Your physical or electronic signature.</li>
      </ol>

      <h2>Our response</h2>
      <p>We aim to acknowledge takedown requests within 2 business days and remove or disable verified infringing material within 7 business days. We may notify the user who uploaded the content.</p>

      <h2>Counter-notice</h2>
      <p>If you believe your content was removed in error you may submit a counter-notice to the same address. We will share it with the original complainant; if no court order is presented within 10 business days we may restore the content.</p>

      <h2>Repeat infringers</h2>
      <p>Accounts that repeatedly infringe copyright will be suspended or terminated.</p>
    </LegalLayout>
  );
}
