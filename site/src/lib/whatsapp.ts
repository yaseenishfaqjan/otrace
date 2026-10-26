import { WHATSAPP_NUMBER } from '@/lib/brand';

/** wa.me link for a fit question. Null when no number is configured. */
export function whatsappFitHref(productName?: string) {
  if (!WHATSAPP_NUMBER) return null;
  const text = productName
    ? `Hi OTRACE — I have a fit question about the ${productName}.`
    : 'Hi OTRACE — I have a fit question.';
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
