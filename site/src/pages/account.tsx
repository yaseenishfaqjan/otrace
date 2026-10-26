import { Link } from 'wouter';

import { usePageMeta } from '@/lib/use-page-meta';
/**
 * Placeholder until customer accounts are wired to the API. It deliberately
 * does NOT show a sign-in form that cannot work yet — a dead form loses more
 * trust than an honest "coming soon".
 */
export default function Account() {
  usePageMeta('Account', undefined, { noindex: true });
  return (
    <div className="pt-16 md:pt-20 min-h-[60vh] flex items-center">
      <div className="shell py-24 max-w-xl">
        <p className="eyebrow text-muted mb-4">Account</p>
        <h1 className="display text-cream text-[9.5vw] md:text-[3.25rem]">Order<br />lookup</h1>
        <p className="text-cream-dim leading-relaxed mt-6">
          Every order confirmation email carries your order number and a receipt.
          Reply to that email with any change and we will handle it before it
          ships.
        </p>
        <p className="text-cream-dim leading-relaxed mt-4">
          Accounts with saved addresses and order history are coming with the
          next drop.
        </p>
        <Link href="/contact" className="btn mt-9">Contact us</Link>
      </div>
    </div>
  );
}
