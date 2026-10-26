import { Link } from 'wouter';

import { usePageMeta } from '@/lib/use-page-meta';
export default function NotFound() {
  usePageMeta('Page not found', undefined, { noindex: true });
  return (
    <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center">
      <div className="shell py-24">
        <p className="eyebrow text-muted mb-5">404</p>
        <h1 className="display text-cream text-[12vw] md:text-[5rem]">Nothing<br />here</h1>
        <p className="text-cream-dim mt-6 max-w-md leading-relaxed">
          That page has moved or never existed. The collection is still where you left it.
        </p>
        <Link href="/shop" className="btn mt-9">Shop AW2026</Link>
      </div>
    </div>
  );
}
