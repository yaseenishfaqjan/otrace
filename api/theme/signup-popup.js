/**
 * Markup for the first-order popup. Omitted entirely when the code is blank
 * or the page is cart, order success, or checkout. The code is not printed
 * here; the browser receives it from POST /api/signup.
 */
import fs from 'node:fs';

import { signupOffer, signupSuppressedPath } from '../signup.js';

const RUNTIME = fs.readFileSync(new URL('./signup-runtime.js', import.meta.url), 'utf8');

export function signupPopupHtml(path) {
  const offer = signupOffer();
  if (!offer.enabled || signupSuppressedPath(path)) return '';
  const percent = offer.percent;
  return `<div id="otrace-signup" class="otrace-signup" hidden>
  <div class="otrace-signup__sheet" role="dialog" aria-modal="true" aria-labelledby="otrace-signup-title" aria-describedby="otrace-signup-sub" tabindex="-1">
    <button type="button" class="otrace-signup__close" data-signup-close aria-label="Close"><span aria-hidden="true">×</span></button>
    <div data-signup-form>
      <p class="otrace-signup__kicker">OTRACE</p>
      <h2 id="otrace-signup-title">Get ${percent}% off your first order</h2>
      <p id="otrace-signup-sub">Join the OTRACE list for drops and restocks.</p>
      <form class="otrace-signup__form" action="/api/signup" method="post">
        <label class="otrace-signup__label" for="otrace-signup-email">Email</label>
        <input id="otrace-signup-email" class="otrace-signup__field" type="email" name="email" autocomplete="email" inputmode="email" enterkeyhint="done" required maxlength="255">
        <input class="otrace-signup__hp" type="text" name="otrace_hp" tabindex="-1" autocomplete="off" aria-hidden="true" value="">
        <button type="submit" class="otrace-signup__submit">Unlock my code</button>
        <p class="otrace-signup__fine">No spam. Unsubscribe anytime.</p>
        <p class="otrace-signup__error" data-signup-error role="alert" hidden></p>
      </form>
    </div>
    <div data-signup-done hidden>
      <p class="otrace-signup__kicker">OTRACE</p>
      <h2 id="otrace-signup-done-title">Your code</h2>
      <p class="otrace-signup__code" data-signup-code></p>
      <div class="otrace-signup__actions">
        <button type="button" class="otrace-signup__submit" data-signup-copy>Copy</button>
        <a class="otrace-signup__shop" href="/shop">Shop now</a>
      </div>
      <p class="otrace-signup__fine">Enter it at checkout.</p>
    </div>
  </div>
</div>
<script>${RUNTIME}</script>`;
}
