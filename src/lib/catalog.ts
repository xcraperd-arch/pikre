// Curated starter URLs shown on Discover. Plain public pages — no claims about them.
export type CatalogItem = { url: string; label: string; topic: string; why: string };

export const TOPICS = [
  "AI",
  "Developer",
  "Shopping",
  "Finance",
  "Security",
  "News",
  "Research",
  "Startups",
] as const;
export type Topic = (typeof TOPICS)[number];

export const CATALOG: CatalogItem[] = [
  { url: "https://openai.com/pricing", label: "OpenAI pricing", topic: "AI", why: "Compare model costs" },
  { url: "https://www.anthropic.com/pricing", label: "Anthropic pricing", topic: "AI", why: "Plan & usage limits" },
  { url: "https://huggingface.co/models", label: "Hugging Face models", topic: "AI", why: "Trending open models" },
  { url: "https://github.com/trending", label: "GitHub trending", topic: "Developer", why: "What devs are starring" },
  { url: "https://vercel.com/pricing", label: "Vercel pricing", topic: "Developer", why: "Hosting cost audit" },
  { url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript", label: "MDN JavaScript", topic: "Developer", why: "Chat with the docs" },
  { url: "https://www.apple.com/iphone/", label: "Apple iPhone", topic: "Shopping", why: "Product lineup extraction" },
  { url: "https://www.ikea.com/us/en/", label: "IKEA", topic: "Shopping", why: "Catalog & pricing" },
  { url: "https://stripe.com/pricing", label: "Stripe pricing", topic: "Finance", why: "Fee transparency check" },
  { url: "https://www.coinbase.com/", label: "Coinbase", topic: "Finance", why: "Trust & risk review" },
  { url: "https://haveibeenpwned.com/", label: "Have I Been Pwned", topic: "Security", why: "Breach intelligence" },
  { url: "https://owasp.org/www-project-top-ten/", label: "OWASP Top 10", topic: "Security", why: "Security baseline" },
  { url: "https://news.ycombinator.com/", label: "Hacker News", topic: "News", why: "Daily tech pulse" },
  { url: "https://www.bbc.com/news", label: "BBC News", topic: "News", why: "Headline summary" },
  { url: "https://arxiv.org/list/cs.AI/recent", label: "arXiv cs.AI", topic: "Research", why: "Latest AI papers" },
  { url: "https://www.nature.com/", label: "Nature", topic: "Research", why: "Science headlines" },
  { url: "https://www.ycombinator.com/companies", label: "YC companies", topic: "Startups", why: "Startup landscape" },
  { url: "https://www.producthunt.com/", label: "Product Hunt", topic: "Startups", why: "New launches today" },
];
