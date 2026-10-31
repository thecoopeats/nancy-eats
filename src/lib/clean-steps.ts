/**
 * Recipe sites mix blog and ad text into their instructions, and Spoonacular passes it through.
 * Keep only real cooking steps.
 */

// Text that is never a cooking step.
const JUNK = [
  /https?:\/\/|www\.|\.com\b|\.net\b|\.org\b/i,
  /\b(subscribe|newsletter|sign up|signup|unsubscribe)\b/i,
  /\b(instagram|pinterest|facebook|twitter|tiktok|youtube|social media)\b/i,
  /\b(follow (me|us)|tag (me|us)|share (this|it with)|pin (this|it))\b/i,
  /\bclick (here|the link|below|above)\b|\bjump to\b|\bprint (this )?recipe\b|\brecipe card\b/i,
  /\b(rate|review) (this|the) recipe\b|\bleave a (comment|review|rating)\b|\bstar rating\b/i,
  /\b(affiliate|sponsored|advertisement|commission|amazon)\b/i,
  /\b(this|my|our) (blog|post|website|site|channel|cookbook)\b/i,
  /\b(watch|see) (the|my|our) video\b/i,
  /\bnutrition(al)? (facts|information|info|data)\b|\bcalories\s*:|\bper serving\s*:/i,
  /\b(adapted|reprinted|excerpted) (from|with permission)\b|\brecipe (by|from|courtesy)\b|\bphoto(s|graphy)? (by|credit)\b/i,
  /©|\bcopyright\b|\ball rights reserved\b|\bdisclaimer\b|\bprivacy policy\b/i,
  /\b(you might|you may|you'll) also (like|love|enjoy)\b|\bmore recipes\b|\bcheck out (my|our|these)\b/i,
  /\b(spoonacular|allrecipes|foodnetwork|food network)\b/i,
];

// Words that show a short line is still a real step ("Serve.", "Enjoy warm with rice.").
const COOKING = /\b(add|bake|beat|blend|boil|braise|broil|brown|chill|chop|combine|cook|cool|cover|cut|dice|drain|drizzle|fold|fry|garnish|grate|grill|heat|knead|marinate|mash|melt|microwave|mince|mix|peel|place|pour|preheat|reduce|refrigerate|rinse|roast|roll|saut[eé]|season|serve|set aside|shred|simmer|slice|spread|sprinkle|steam|stir|strain|toast|top|toss|transfer|whisk|enjoy)\b/i;

function decode(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCookingStep(raw: string): boolean {
  const step = decode(raw);
  if (!step) return false;
  if (JUNK.some((re) => re.test(step))) return false;
  // Bare labels like "Step 1", "Instructions", "Directions:", "Notes"
  if (/^(step\s*\d+|instructions?|directions?|method|notes?|tips?|ingredients?|enjoy!*|bon app[eé]tit!*)\s*[:.!]?$/i.test(step)) {
    return false;
  }
  const words = step.split(" ").length;
  // Very short lines are kept only when they say to do something in the kitchen.
  if (words < 4 && !COOKING.test(step)) return false;
  // Long rambling paragraphs without any cooking action are blog text.
  if (words > 25 && !COOKING.test(step)) return false;
  return true;
}

/** Clean, de-duplicate and filter a list of steps. */
export function cleanSteps(steps: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of steps) {
    if (!isCookingStep(raw)) continue;
    const step = decode(raw);
    const key = step.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(step);
  }
  return out;
}
