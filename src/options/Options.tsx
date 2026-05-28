import { PRIVACY_URL, TERMS_URL } from '@/lib/links';

export function Options() {
  return (
    <div className="mx-auto max-w-xl p-6 font-sans text-sm text-slate-800">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">
        Routine Check — Settings
      </h1>
      <p className="mb-6 text-slate-600">
        Settings will appear here once the full extension is wired up.
      </p>
      <section className="mb-4 rounded border border-slate-200 bg-slate-50 p-4 text-[12px] leading-snug text-slate-600">
        This extension provides general information about cosmetic ingredients
        and product compatibility based on published cosmetic science. It is
        not medical advice and is not a substitute for consultation with a
        dermatologist or other qualified healthcare professional. We do not
        diagnose, treat, or prevent any skin condition. Individual reactions
        vary; always patch test new products.
      </section>
      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-medium text-slate-700">
        <a
          href={PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-slate-900 hover:underline"
        >
          Privacy Policy
        </a>
        <a
          href={TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-slate-900 hover:underline"
        >
          Terms of Service
        </a>
      </nav>
    </div>
  );
}
