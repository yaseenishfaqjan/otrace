import type { Faq } from '@/lib/faqs';

/** Visible question headings. The same `faqs` array is what faqLd() serialises. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  if (faqs.length === 0) return null;
  return (
    <div className="mt-12 space-y-8">
      {faqs.map((faq) => (
        <section key={faq.question}>
          <h2 className="text-cream text-base font-medium leading-snug">{faq.question}</h2>
          <p className="text-cream-dim text-sm leading-relaxed mt-2">{faq.answer}</p>
        </section>
      ))}
    </div>
  );
}
