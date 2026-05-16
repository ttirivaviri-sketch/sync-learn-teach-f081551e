import LegalLayout from "@/components/legal/LegalLayout";
import { COMPANY } from "@/lib/legal";

const PUBLISHERS = [
  { name: "ZIMSEC", full: "Zimbabwe School Examinations Council" },
  { name: "Cambridge Assessment International Education", full: "CAIE / CIE" },
  { name: "Department of Basic Education (RSA)", full: "NSC past papers" },
  { name: "IEB", full: "Independent Examinations Board (South Africa)" },
  { name: "Individual textbook authors and publishers", full: "as credited per resource" },
];

export default function LibraryDisclaimer() {
  return (
    <LegalLayout title="Library Content Disclaimer">
      <p className="text-base font-medium">
        {COMPANY.name} does not sell, license, or claim ownership of any third-party educational material in the Library.
      </p>

      <p>
        All past papers, syllabi, textbooks and reference materials made available through the Library remain the property of their respective publishers and authors. Materials are aggregated from publicly available sources and made available to registered students <strong>for educational, non-commercial use</strong> under fair-dealing / fair-use provisions for the purposes of research and private study.
      </p>

      <p>
        Access to Library content is provided as a convenience to students. No subscription fee paid to {COMPANY.name} is allocated to, or constitutes payment for, third-party content. Our paid plans cover AI tooling, tutoring infrastructure, and personalised study features — not the publishers' works themselves.
      </p>

      <h2>Credited publishers</h2>
      <ul>
        {PUBLISHERS.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.full}</li>
        ))}
      </ul>
      <p>Individual resources also carry inline attribution where the publisher is known.</p>

      <h2>Rights holders — takedown</h2>
      <p>
        If you are a rights holder and would like material removed or credited differently, please email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> with the resource URL and proof of ownership. We will respond within 7 business days. See our <a href="/legal/copyright">Copyright & Takedown Policy</a> for full details.
      </p>

      <h2>Students</h2>
      <p>
        You may download Library materials for personal study only. Redistribution, resale, or use in commercial training data is prohibited.
      </p>
    </LegalLayout>
  );
}
