// Footer.tsx — Site footer
// Named component — codegen edits by name. Keep name stable.

import { content } from '../content';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const primaryColor = content.colors?.[0] ?? '#2d5016';

  return (
    <footer className="py-12 px-6 border-t border-brand-border">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Business name */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}30` }}
          >
            <span className="font-display font-bold text-sm" style={{ color: primaryColor }}>
              {(content.name || 'B')[0]}
            </span>
          </div>
          <span className="font-display font-semibold text-lg">
            {content.name || 'Business'}
          </span>
        </div>

        {/* Copyright + Powered by */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-brand-text-muted">
          <span>&copy; {currentYear} {content.name || 'Business'}. All rights reserved.</span>
          <span className="hidden sm:inline">&middot;</span>
          <span className="flex items-center gap-1.5">
            Built with
            <span
              className="font-semibold"
              style={{ color: primaryColor }}
            >
              Chasm
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
