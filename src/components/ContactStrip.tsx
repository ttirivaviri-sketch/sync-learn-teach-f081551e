import { CalendarCheck, Instagram, Mail, MessageCircle, Phone } from "lucide-react";
import { trackEnquiryClick, type EnquiryChannel } from "@/utils/landingAnalytics";

const contactItems = [
  {
    title: "Book online",
    channel: "booking" as EnquiryChannel,
    value: "Pick a tutor, day & time",
    href: "/book",
    Icon: CalendarCheck,
    accent: "text-primary bg-primary/5 border-primary/20 hover:border-primary/40",
  },
  {
    title: "WhatsApp",
    channel: "whatsapp" as EnquiryChannel,
    value: "+27 68 652 3995",
    href: "https://wa.me/27686523995",
    Icon: MessageCircle,
    accent: "text-emerald-600 bg-emerald-50 border-emerald-100 hover:border-emerald-300",
  },
  {
    title: "Instagram",
    channel: "instagram" as EnquiryChannel,
    value: "@studysyncplatform",
    href: "https://instagram.com/studysyncplatform",
    Icon: Instagram,
    accent: "text-pink-600 bg-pink-50 border-pink-100 hover:border-pink-300",
  },
  {
    title: "Email",
    channel: "email" as EnquiryChannel,
    value: "supportstudysync@gmail.com",
    href: "mailto:supportstudysync@gmail.com",
    Icon: Mail,
    accent: "text-blue-600 bg-blue-50 border-blue-100 hover:border-blue-300",
  },
  {
    title: "Calls (SA)",
    channel: "phone" as EnquiryChannel,
    value: "+27 61 548 3423",
    href: "tel:+27615483423",
    Icon: Phone,
    accent: "text-violet-600 bg-violet-50 border-violet-100 hover:border-violet-300",
  },
  {
    title: "Calls (ZW)",
    channel: "phone" as EnquiryChannel,
    value: "+263 78 067 4090",
    href: "tel:+263780674090",
    Icon: Phone,
    accent: "text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-300",
  },
];

const ContactStrip = () => {
  return (
    <section className="bg-gradient-to-b from-white to-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Talk to StudySync
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Need help choosing the right study support?
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Reach out directly on WhatsApp, Instagram, email or phone — our team is happy to help you find the right tutor, past papers or study plan for your child.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {contactItems.map(({ title, value, href, Icon, accent, channel }) => (
            <a
              key={title}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              onClick={() =>
                trackEnquiryClick({ channel, source: "contact_strip", label: title })
              }
              className={`group rounded-2xl border p-4 transition-all hover:-translate-y-1 hover:shadow-md ${accent}`}
            >
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-1 break-words text-sm text-slate-600">{value}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ContactStrip;
