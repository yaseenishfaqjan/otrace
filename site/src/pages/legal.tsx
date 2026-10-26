import { type ReactNode } from 'react';

import { usePageMeta } from '@/lib/use-page-meta';
import { RETURNS_FAQS } from '@/lib/faqs';
import { faqLd } from '@/lib/structured-data';
function Legal({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="pt-16 md:pt-20">
      <div className="shell py-12 md:py-16 max-w-3xl">
        <p className="eyebrow text-muted mb-4">{eyebrow}</p>
        <h1 className="display text-cream text-[9.5vw] md:text-[3.5rem]">{title}</h1>
        <div className="mt-10 space-y-8 text-cream-dim leading-relaxed [&_h2]:eyebrow [&_h2]:text-cream [&_h2]:mb-3 [&_p]:text-sm [&_li]:text-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Shipping() {
  usePageMeta(
    'Shipping & Returns',
    'Free US delivery on every OTRACE order. In-stock AW2026 pieces ship in 3–5 business days, and unworn items can be returned within 30 days of delivery.',
    { jsonLd: faqLd(RETURNS_FAQS) },
  );
  const returns = RETURNS_FAQS[0];
  return (
    <Legal eyebrow="Help" title="Shipping & returns">
      <section>
        <h2>Dispatch</h2>
        <p>
          AW2026 is in stock. Delivery is free on every order, and orders ship
          within 3–5 business days. We email tracking the moment a parcel leaves us.
        </p>
      </section>
      <section>
        <h2>Where we ship</h2>
        <p>United States only for AW2026. International is planned for the next drop.</p>
      </section>
      <section>
        <h2>{returns.question}</h2>
        <p>{returns.answer}</p>
      </section>
      <section>
        <h2>Something wrong</h2>
        <p>
          If a piece arrives faulty or is not what you ordered, tell us within
          30 days and we make it right at our cost — no return shipping charge.
        </p>
      </section>
    </Legal>
  );
}

export function Terms() {
  usePageMeta('Terms', 'Terms of sale for OTRACE orders: payment, delivery, returns and what happens if something goes wrong.');
  return (
    <Legal eyebrow="Legal" title="Terms of service">
      <section>
        <h2>Orders</h2>
        <p>
          An order is an offer to buy. We confirm by email once payment has been
          taken. If we cannot fulfil an order we refund it in full.
        </p>
      </section>
      <section>
        <h2>Dispatch</h2>
        <p>
          Payment is taken when the order is placed. In-stock pieces ship within
          3–5 business days. We email tracking when the parcel leaves us.
        </p>
      </section>
      <section>
        <h2>Pricing</h2>
        <p>
          Prices are in US dollars and shown before tax. Tax is calculated at
          checkout based on your delivery address. Prices can change, but never
          for an order already placed.
        </p>
      </section>
      <section>
        <h2>Payment</h2>
        <p>
          Payments are processed by Stripe. We never see or store your card
          details.
        </p>
      </section>
      <section>
        <h2>Colour and imagery</h2>
        <p>
          We photograph our pieces as accurately as we can, but screens vary and
          garment dyeing means small variation between pieces is normal — it is
          the process, not a fault.
        </p>
      </section>
    </Legal>
  );
}

export function Privacy() {
  usePageMeta('Privacy', 'How OTRACE collects, uses and protects the information you share when you order or sign up.');
  return (
    <Legal eyebrow="Legal" title="Privacy">
      <section>
        <h2>What we collect</h2>
        <p>
          When you order: your name, email, delivery address and phone number,
          so we can ship to you and reach you about the order. When you join the
          list: your email, the page you joined from, and any size, colour or
          phone number you choose to add. SMS and WhatsApp stay off unless you
          tick them separately.
        </p>
      </section>
      <section>
        <h2>What we never hold</h2>
        <p>
          Card details. Payment happens on Stripe&rsquo;s systems and we only
          ever receive a confirmation that it succeeded.
        </p>
      </section>
      <section>
        <h2>Who else sees it</h2>
        <p>
          Stripe for payment, our carrier for delivery, and our email provider
          for order confirmations. When the list is connected to an email
          platform, that platform receives the same signup so it can send what
          you asked for. We do not sell data.
        </p>
      </section>
      <section>
        <h2>Removing your data</h2>
        <p>
          Email us and we delete your details, other than the order records we
          are required to keep for tax purposes. Every marketing email carries a
          one-click unsubscribe.
        </p>
      </section>
    </Legal>
  );
}
