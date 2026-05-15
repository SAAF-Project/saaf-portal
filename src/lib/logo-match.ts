const LOGOS: Record<string, string> = {
  "abn amro": "abnamro.png",
  "abnamro": "abnamro.png",
  "achmea": "achmea.png",
  "adidas": "adidas.png",
  "adr": "adr.png",
  "afm": "afm.jpeg",
  "ahold": "ahold.png",
  "ahold delhaize": "ahold.png",
  "ai advies": "ai-advies.png",
  "ai-advies": "ai-advies.png",
  "allianz": "allianz.png",
  "anwb": "anwb.png",
  "asml": "asml.svg",
  "asr": "asr.png",
  "auditagent": "auditagent.png",
  "bdo": "bdo.png",
  "bng bank": "bng-bank.png",
  "bng": "bng-bank.png",
  "booking": "booking.png",
  "booking.com": "booking.png",
  "br1ght": "br1ght.jpg",
  "brightlyn": "brightlyn.png",
  "capgemini": "capgemini.svg",
  "cyberup": "cyberup.jpg",
  "cz": "cz.png",
  "de goudse": "de-goudse-verzekeringen.png",
  "de goudse verzekeringen": "de-goudse-verzekeringen.png",
  "deloitte": "deloitte.png",
  "diligius": "diligius.png",
  "dll": "dll-financial.png",
  "dll financial": "dll-financial.png",
  "eminence ways": "eminence-ways.png",
  "euroclear": "euroclear.png",
  "exact": "exact.png",
  "ferocia": "ferocia.png",
  "flowopt": "flowopt.png",
  "forvis mazars": "forvis-mazars.png",
  "mazars": "forvis-mazars.png",
  "frieslandcampina": "frieslandcampina.png",
  "friesland campina": "frieslandcampina.png",
  "gasunie": "gasunie.jpeg",
  "grant thornton": "grant-thornton.png",
  "heineken": "heineken.png",
  "inaudit": "inaudit.svg",
  "ing": "ing.png",
  "joanknecht": "joanknecht.webp",
  "jti": "jti.png",
  "just eat takeaway": "just-eat-takeaway.png",
  "just eat": "just-eat-takeaway.png",
  "klm": "klm.svg",
  "kouters": "kouters.jpeg",
  "kpmg": "kpmg.png",
  "kpn": "kpn.png",
  "kriton": "kriton.png",
  "kutxabank": "kutxabank.webp",
  "mollie": "mollie.png",
  "nationale nederlanden": "nationale-nederlanden.png",
  "nationale-nederlanden": "nationale-nederlanden.png",
  "nn": "nationale-nederlanden.png",
  "nexsure": "nexsure-security.png",
  "nexsure security": "nexsure-security.png",
  "ns": "ns.svg",
  "one risk advisory": "one-risk-advisory.jpg",
  "one risk": "one-risk-advisory.jpg",
  "philips": "philips.png",
  "provincie noord-holland": "provincie-noord-holland.svg",
  "provincie noord holland": "provincie-noord-holland.svg",
  "pwc": "pwc.png",
  "pricewaterhousecoopers": "pwc.png",
  "rekenkamer": "rekenkamer.svg",
  "rvo": "rvo.png",
  "saaf": "saaf-project.png",
  "saaf project": "saaf-project.png",
  "sap": "sap.png",
  "schuberg philis": "schuberg-philis.png",
  "schuberg": "schuberg-philis.png",
  "shv": "shv.png",
  "smartshore": "smartshore-ability.png",
  "smartshore ability": "smartshore-ability.png",
  "stedin": "stedin.jpeg",
  "traton": "traton.jpg",
  "triodos": "triodos-bank.png",
  "triodos bank": "triodos-bank.png",
  "uber": "uber.png",
  "universiteit leiden": "universiteit-leiden.png",
  "leiden university": "universiteit-leiden.png",
  "van lanschot kempen": "van-lanschot-kempen.png",
  "van lanschot": "van-lanschot-kempen.png",
  "veritas": "veritas.png",
  "wolters kluwer": "wolters-kluwer.png",
};

const BASE_URL = "https://saafproject.com/assets/logos/";

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[\s\-,&/().]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
  );
}

export function matchCompanyLogo(organisation: string | null | undefined): string | null {
  if (!organisation) return null;
  const key = organisation.toLowerCase().trim();
  if (!key) return null;

  // 1. Exact match on full key
  if (LOGOS[key]) return `${BASE_URL}${LOGOS[key]}`;

  // 2. Word-boundary match — every word in the logo key must appear as a whole word in the user's input
  const userWords = tokenize(organisation);
  for (const [k, v] of Object.entries(LOGOS)) {
    const logoWords = tokenize(k);
    if (logoWords.size === 0) continue;
    let allMatch = true;
    for (const w of logoWords) {
      if (!userWords.has(w)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return `${BASE_URL}${v}`;
  }
  return null;
}

export interface OrgSuggestion {
  name: string;
  logoUrl: string;
}

export function suggestOrganisations(query: string): OrgSuggestion[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().trim();
  const seen = new Set<string>();
  const results: OrgSuggestion[] = [];

  for (const [key, file] of Object.entries(LOGOS)) {
    if (key.includes(q) || q.includes(key)) {
      const url = `${BASE_URL}${file}`;
      if (!seen.has(url)) {
        seen.add(url);
        const name = key
          .split(/[-\s]/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        results.push({ name, logoUrl: url });
      }
    }
  }

  return results.slice(0, 5);
}
