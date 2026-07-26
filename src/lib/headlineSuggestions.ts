// Alternative phrasings for a banner headline.
//
// Deliberately rule-based, not AI: it only ever RESHAPES words the admin
// already wrote (trims filler, fronts the number, adds a call to action). It
// never invents a claim — an offer, a discount or a date that isn't in the
// original can't appear in a suggestion.

const FILLER = ['الآن', 'جداً', 'جدا', 'حقاً', 'فعلاً', 'تماماً', 'للغاية'];

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function suggestHeadlines(title: string): string[] {
  const base = clean(title);
  if (base.length < 3) return [];
  const out = new Set<string>();

  // 1) Tighter: drop filler words.
  const tight = clean(base.split(' ').filter((w) => !FILLER.includes(w)).join(' '));
  if (tight && tight !== base) out.add(tight);

  // 2) Front the number the admin already used (٣٠٪ / 20% / ٥ أيام).
  const num = base.match(/[\d٠-٩]+\s*(?:٪|%)?/);
  if (num) {
    const rest = clean(base.replace(num[0], ''));
    if (rest) out.add(clean(`${num[0].trim()} — ${rest}`));
  }

  // 3) Shorter: first half, when the headline is long enough to be trimmed.
  const words = base.split(' ');
  if (words.length >= 5) out.add(clean(words.slice(0, Math.ceil(words.length / 2)).join(' ')));

  // 4) A call to action, only if there isn't one already.
  if (!/احجز|اكتشف|شوف|تعرف|جرّب|ابدأ/.test(base)) out.add(clean(`${base} — احجز الآن`));

  return [...out].filter((s) => s !== base && s.length <= 60).slice(0, 4);
}
