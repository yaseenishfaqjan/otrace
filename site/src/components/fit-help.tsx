import { Link } from 'wouter';
import { LeadForm } from '@/components/lead-form';
import { whatsappFitHref } from '@/lib/whatsapp';

/**
 * Size/colour waitlist, the fit-guide email, and WhatsApp.
 * The WhatsApp control is omitted when VITE_WHATSAPP_NUMBER and
 * PUBLIC_WHATSAPP_NUMBER are both unset. Do not invent a number.
 */
export function FitHelp({
  productSlug,
  productName,
  size,
  colour,
}: {
  productSlug?: string;
  productName?: string;
  size?: string | null;
  colour?: string | null;
}) {
  const whatsapp = whatsappFitHref(productName);

  return (
    <div className="mt-8 border border-line p-5 space-y-8 min-w-0">
      {productSlug && (
        <div className="min-w-0">
          <p className="eyebrow text-cream mb-2">Notify me</p>
          <p className="text-cream-dim text-sm leading-relaxed mb-4">
            This size and colour, if it is in a later drop.
          </p>
          <LeadForm
            formId="waitlist"
            source="waitlist"
            productSlug={productSlug}
            size={size}
            colour={colour}
            requireSize
            submitLabel="Notify me"
            variant="stack"
          />
        </div>
      )}

      <div className="min-w-0">
        <p className="eyebrow text-cream mb-2">Email me my size</p>
        <p className="text-cream-dim text-sm leading-relaxed mb-4">
          Measurements stay on the{' '}
          <Link href="/sizing" className="text-cream underline underline-offset-4">size guide</Link>
          . The fit note is in the{' '}
          <Link href="/blog/how-an-oversized-hoodie-should-fit" className="text-cream underline underline-offset-4">journal</Link>
          .
        </p>
        <LeadForm
          formId="email-my-size"
          source="email-my-size"
          productSlug={productSlug}
          size={size}
          colour={colour}
          submitLabel="Email me"
          variant="stack"
        />
      </div>

      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost w-full"
        >
          Ask about fit
        </a>
      )}
    </div>
  );
}
