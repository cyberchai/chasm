// Contact.tsx — Contact information section
// Named component — codegen edits by name. Keep name stable.

import { content } from '../content';

function ContactItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;

  return (
    <div className="flex items-start gap-4 group">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl glass flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div>
        <span className="text-sm font-medium text-brand-text-muted uppercase tracking-wider">
          {label}
        </span>
        <p className="text-lg mt-1">{value}</p>
      </div>
    </div>
  );
}

export default function Contact() {
  const { contact, name } = content;
  const primaryColor = content.colors?.[0] ?? '#2d5016';

  const hasContact = contact?.phone || contact?.address || contact?.hours;

  if (!hasContact) {
    return (
      <section id="contact" className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-brand-text-muted">Contact info coming soon...</p>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="reveal">
          <span className="text-sm font-medium tracking-wider uppercase text-brand-text-muted">
            Visit Us
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-bold mt-3 mb-12">
            Come Say Hello
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact details */}
          <div className="space-y-8 reveal">
            <ContactItem
              label="Phone"
              value={contact.phone}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              }
            />
            <ContactItem
              label="Address"
              value={contact.address}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              }
            />
            <ContactItem
              label="Hours"
              value={contact.hours}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>

          {/* Decorative card */}
          <div className="reveal glass rounded-2xl p-8 flex items-center justify-center">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </div>
              <p className="font-display text-xl font-semibold mb-2">
                {name || 'Our Shop'}
              </p>
              <p className="text-brand-text-muted text-sm">
                We would love to hear from you
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
