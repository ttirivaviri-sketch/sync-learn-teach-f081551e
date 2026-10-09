import clips from './assets/clips.jpeg.asset.json' with { type: 'json' };
import papers from './assets/papers.jpeg.asset.json' with { type: 'json' };
import diagrams from './assets/diagrams.jpeg.asset.json' with { type: 'json' };
import study from './assets/study-mode.jpeg.asset.json' with { type: 'json' };

const site = 'https://studysync.co.za';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
const link = (tab: string, category?: string) => `${site}/learner?tab=${tab}${category ? `&category=${category}` : ''}&utm_source=reengagement&utm_medium=email`;
const image = (url: string, alt: string) => `<img src="${site}${url}" alt="${alt}" width="480" style="display:block;width:100%;max-width:480px;height:auto;margin:20px auto;border-radius:8px;">`;
const button = (url: string, label: string) => `<p style="margin:24px 0;"><a href="${esc(url)}" style="display:inline-block;background:#2455e6;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:600;">${esc(label)}</a></p>`;
export function reengagementEmail(step: number, name: string, unsubscribeUrl: string, freeSession: boolean) {
  const first = name.trim().split(/\s+/)[0] || 'there';
  const whatsapp = 'https://wa.me/27686523995?text=' + encodeURIComponent("Hi StudySync, please assist me with booking my first lesson today.");
  const invitation = 'talk to admin on WhatsApp, and be assisted booking your first lesson today';
  const features = [
    {
      subject: 'Your free StudySync library is waiting',
      heading: 'A fresh start with your free library',
      text: 'Watch free videos organised by topic and subject, then practise with past papers, inserts and mark schemes — all in one place.',
      body: `<p>Watch free videos organised by topic and subject, then practise with past papers, inserts and mark schemes — all in one place.</p>${image(clips.url, 'StudySync Library — videos by topic and subject')}${button(link('library', 'tutorials'), 'Explore free videos')}<h2 style="font-size:20px;">Past papers and mark schemes</h2><p>Find your curriculum and subject, work through a past paper, and check your answers against the mark scheme.</p>${image(papers.url, 'StudySync Library — past papers and inserts')}${button(link('library', 'papers'), 'Open past papers')}`,
      url: link('library', 'tutorials'),
    },
    {
      subject: 'Ask a diagram a question with StudySync',
      heading: 'Make sense of a tricky diagram',
      text: 'Explore interactive diagrams in the free library. Ask the AI about a label, a process or how the diagram appears in an exam, and learn at your level.',
      body: `<p>Explore interactive diagrams in the free library. Ask the AI about a label, a process or how the diagram appears in an exam, and learn at your level.</p>${image(diagrams.url, 'StudySync interactive diagram with AI questions')}${button(link('library', 'diagrams'), 'Explore diagrams')}`,
      url: link('library', 'diagrams'),
    },
    {
      subject: freeSession ? 'Try your first free Study Mode session' : 'Find your next step with Study Mode',
      heading: freeSession ? 'Your first free Study Mode session' : 'Ready to practise again?',
      text: `${freeSession ? 'Try one free Study Mode session if you have not used your first daily task yet. ' : 'Study Mode access depends on your current plan. '}Practise with flashcards, active recall, concept learning, exam questions, micro-revision, summaries and revision checklists.`,
      body: `<p>${freeSession ? 'Try one free Study Mode session if you have not used your first daily task yet.' : 'Return to Study Mode to see your current access and study plan.'}</p><p>Practise with flashcards, active recall, concept learning, exam questions, micro-revision, summaries and revision checklists.</p>${image(study.url, 'StudySync Study Mode — subjects and AI tutor')}${button(link('study'), freeSession ? 'Try Study Mode' : 'Open Study Mode')}<h2 style="font-size:20px;">Prefer a one-to-one lesson?</h2><p>You can ${invitation}.</p>${button(whatsapp, 'Talk to admin on WhatsApp')}`,
      url: link('study'),
    },
  ];
  const feature = features[step - 1];
  if (!feature) throw new Error('Invalid email step');
  return {
    subject: feature.subject,
    html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f5f7fb;color:#172033;"><div style="max-width:560px;margin:auto;padding:30px 24px;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;"><p style="color:#2455e6;font-weight:bold;font-size:22px;margin:0;">StudySync</p><h1 style="font-size:26px;line-height:1.25;">${feature.heading}</h1><p>Hi ${esc(first)},</p>${feature.body}<p>Ashlie Potera<br>Founder — StudySync &amp; team</p><hr style="border:0;border-top:1px solid #dee3ec;"><p style="font-size:12px;color:#657084;">You received this reminder because you have a StudySync learner account and have been away for more than five days. Reminders stop when you return.<br><a href="${esc(unsubscribeUrl)}">Unsubscribe from these reminders</a></p></div></body></html>`,
    text: `Hi ${first},\n\n${feature.heading}\n\n${feature.text}\n\n${feature.url}\n${step === 3 ? `\nYou can ${invitation}.\n${whatsapp}\n` : ''}\nAshlie Potera\nFounder — StudySync & team\n\nUnsubscribe: ${unsubscribeUrl}`,
  };
}