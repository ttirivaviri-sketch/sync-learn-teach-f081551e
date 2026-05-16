import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Twitter, Github, Linkedin, Instagram, ArrowRight, Mail, Phone, MessageCircle } from "lucide-react";

const footerLinks = {
  "For Students": ["AI Study Tools", "Find Tutors", "StudyMode", "Resource Library", "Track Progress"],
  "For Tutors":   ["Become a Tutor", "Verification Process", "Earnings & Payouts", "Tutor Dashboard"],
  Company:        ["About Us", "Blog", "Careers", "Press Kit"],
  Legal: [
    { label: "Privacy Policy", href: "/legal/privacy" },
    { label: "Terms of Service", href: "/legal/terms" },
    { label: "Cookie Policy", href: "/legal/cookies" },
    { label: "Copyright & Takedown", href: "/legal/copyright" },
    { label: "Library Disclaimer", href: "/legal/library" },
    { label: "Refund Policy", href: "/legal/refunds" },
    { label: "Community Guidelines", href: "/legal/community" },
  ],
};

const socials = [
  { icon: Instagram, label: "Instagram", href: "https://instagram.com/studysyncplatform" },
  { icon: MessageCircle, label: "WhatsApp", href: "https://wa.me/27686523995" },
  { icon: Mail, label: "Email", href: "mailto:supportstudysync@gmail.com" },
  { icon: Linkedin,  label: "LinkedIn",  href: "#" },
  { icon: Github,    label: "GitHub",    href: "#" },
  { icon: Twitter,   label: "Twitter",   href: "#" },
];

const directContacts = [
  { label: "Instagram", value: "@studysyncplatform", href: "https://instagram.com/studysyncplatform", icon: Instagram },
  { label: "WhatsApp", value: "+27 68 652 3995", href: "https://wa.me/27686523995", icon: MessageCircle },
  { label: "Call (SA)", value: "+27 61 548 3423", href: "tel:+27615483423", icon: Phone },
  { label: "Call (ZW)", value: "+263 78 067 4090", href: "tel:+263780674090", icon: Phone },
  { label: "Email", value: "supportstudysync@gmail.com", href: "mailto:supportstudysync@gmail.com", icon: Mail },
];

const Footer = () => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) { setSubscribed(true); setEmail(""); }
  };

  return (
    <footer className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Top section */}
        <div className="pt-16 pb-12 grid md:grid-cols-2 lg:grid-cols-6 gap-10">

          {/* Brand column */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-center gap-2.5">
              <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-12 object-contain brightness-0 invert" />
            </div>

            <p className="text-sm text-background/55 leading-relaxed max-w-xs">
              AI-powered study tools, expert tutors, and a curriculum-aligned resource library
              -- everything students need to ace their exams.
            </p>

            {/* Newsletter */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-background/50 mb-3">
                Get study tips & updates
              </p>
              {subscribed ? (
                <p className="text-sm text-emerald-400 font-medium">You're subscribed!</p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 min-w-0 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-background placeholder:text-background/35 focus:outline-none focus:border-primary"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-white rounded-lg px-3 py-2 transition-colors shrink-0"
                    aria-label="Subscribe"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>

            {/* Socials */}
            <div className="flex gap-3">
            {socials.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-primary flex items-center justify-center transition-colors"
                >
                  <Icon className="h-4 w-4 text-background" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <p className="text-xs font-bold uppercase tracking-widest text-background/45 mb-4">
                {heading}
              </p>
              <ul className="space-y-2.5">
                {(links as Array<string | { label: string; href: string }>).map((link) => {
                  const label = typeof link === "string" ? link : link.label;
                  const href = typeof link === "string" ? "#" : link.href;
                  return (
                    <li key={label}>
                      <a href={href} className="text-sm text-background/60 hover:text-background transition-colors">
                        {label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-background/45 mb-4">
              Contact
            </p>
            <ul className="space-y-3">
              {directContacts.map(({ label, value, href, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="flex items-start gap-2 text-sm text-background/70 hover:text-background transition-colors"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <span className="block text-background/45 text-xs uppercase tracking-wide">{label}</span>
                      <span>{value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="bg-white/10" />

        {/* Bottom bar */}
        <div className="py-6 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-background/40">
          <p>&copy; 2026 StudySync. All rights reserved.</p>
          <div className="flex gap-5">
            {["Privacy Policy", "Terms", "Cookie Policy"].map((l) => (
              <a key={l} href="#" className="hover:text-background/70 transition-colors">{l}</a>
            ))}
          </div>
          <p>Made with care for accessible education</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
