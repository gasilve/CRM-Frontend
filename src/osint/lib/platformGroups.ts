// @ts-nocheck
export interface PlatformGroup {
  key: string;
  label: string;
  platforms: string[];
  defaultCollapsed?: boolean;   // collapsed in staging by default
  defaultExcluded?: boolean;    // deselected from report by default
}

// ── Todd's ordered groups (B1) ────────────────────────────────────────────────
export const PLATFORM_GROUPS: PlatformGroup[] = [
  {
    key: "reverse_image_search",
    label: "Reverse Image Search",
    platforms: [
      "facecheck", "facecheck.id", "facecheck_thumbnail",
      "yandex", "yandex.com", "yandex_thumbnail",
      "lenso", "lenso.ai", "lenso_thumbnail",
      "reverse_image", "reverse_image_auto",
      "tineye", "tineye.com",
      "google_lens", "google lens",
    ],
    defaultCollapsed: false,
    defaultExcluded: false,
  },
  {
    key: "social_platforms",
    label: "Social Platforms",
    platforms: [
      "facebook", "instagram", "fb",
      "instagram.com", "facebook.com", "www.facebook.com", "www.instagram.com",
      "whatsapp", "snapchat", "snapchat.com",
      "myspace", "myspace.com", "www.myspace.com",
      "flickr", "www.flickr.com", "flickr.com", "flickr groups",
      "mstdn.social",
      "buzzfeed", "buzzfeed.com",
    ],
  },
  {
    key: "social_media",
    label: "Social Media",
    platforms: [
      "twitter", "x", "x.com", "twitter.com",
      "tiktok", "tiktok.com",
      "reddit", "reddit.com",
      "telegram", "t.me",
      "youtube", "youtube.com", "www.youtube.com",
      "messenger",
      "threads", "threads.net", "www.threads.net",
      "bsky.app", "bluesky",
      "mastodon", "framapiaf.org",
      "vk", "vk.com",
      "tumblr", "tumblr.com",
    ],
  },
  {
    key: "professional_licenses",
    label: "Professional Licenses",
    platforms: [
      "dre.ca.gov", "breeze.ca.gov", "license", "brea",
      "contractor_license", "contractor license",
      "real_estate_license", "real estate license",
      "nursing_license", "medical_license",
      "faa", "fcc",
    ],
  },
  {
    key: "real_estate",
    label: "Real Estate Activity",
    platforms: [
      "zillow", "zillow.com", "www.zillow.com",
      "realtor", "realtor.com", "www.realtor.com",
      "remax", "re/max", "coldwellbanker",
      "redfin", "redfin.com",
      "trulia", "trulia.com",
      "loopnet",
    ],
  },
  {
    key: "court_records",
    label: "Court Records",
    platforms: [
      "court_records", "court records",
      "pacer", "unicourt", "justia",
      "casenet", "oscn", "mycase",
    ],
  },
  {
    key: "professional",
    label: "Professional & Records",
    platforms: [
      "linkedin", "linkedin.com", "www.linkedin.com", "ar.linkedin.com",
      "github", "github.com",
      "beenverified", "truepeoplesearch", "fastpeoplesearch", "spokeo",
      "pipl", "whitepages", "people_search", "peoplefinder",
      "intelius", "radaris", "mylife", "instantcheckmate",
      "holehe", "maigret", "phoneinfoga", "whois",
    ],
  },
  {
    key: "obituaries",
    label: "Obituaries & Memorials",
    platforms: [
      "obituary", "obituaries",
      "www.obituaries.com", "legacy.com", "www.legacy.com",
      "findagrave.com", "www.findagrave.com", "find a grave",
      "forevermissed.com", "www.forevermissed.com", "forevermissed",
      "obituary_mention", "obituary mention",
      "dignitymemorial.com", "dignity memorial",
    ],
  },
  {
    key: "resume_employment",
    label: "Resume / Employment",
    platforms: [
      "indeed", "glassdoor", "monster", "careerbuilder",
      "job_search", "jobs",
      "angellist", "wellfound",
    ],
  },
  {
    key: "wayback",
    label: "Archive / Wayback",
    platforms: [
      "wayback", "web.archive.org", "archive.org", "www.archive.org",
      "archive",
    ],
  },
  {
    key: "dating",
    label: "Dating & Activity",
    platforms: [
      "tinder", "tinder.com", "tinder/bumble", "tinder/bumble (indirect)",
      "bumble", "bumble.com",
      "hinge", "grindr", "match", "okcupid",
      "plentyoffish", "pof", "zoosk", "badoo", "meetic",
      "activity_search",
      "strava", "fitbit",
      "geocaching", "www.geocaching.com",
      "duolingo", "www.duolingo.com",
      "race results", "race_results",
      "openstreetmap", "www.openstreetmap.org",
      "tripadvisor", "tripadvisor reviews",
      "couchsurfing",
    ],
  },
  {
    key: "marketplace",
    label: "Marketplace & Commerce",
    platforms: [
      "ebay", "ebay.com", "craigslist", "etsy",
      "mercadolibre", "mercado_libre", "depop",
      "amazon", "amazon.com", "www.amazon.com",
      "offerup", "letgo", "marketplace",
      "tradingview", "www.tradingview.com",
    ],
  },
  {
    key: "payments",
    label: "Payments & Crowdfunding",
    platforms: [
      "paypal", "www.paypal.com", "venmo", "cashapp", "cash.app",
      "gofundme", "gofundme.com", "patreon", "ko-fi", "kofi",
      "buymeacoffee", "www.buymeacoffee.com",
      "zora", "zora.co", "kickstarter", "indiegogo",
    ],
  },
  {
    key: "music",
    label: "Music & Audio",
    defaultCollapsed: true,
    platforms: [
      "soundcloud", "m.soundcloud.com", "soundcloud.com",
      "mixcloud", "www.mixcloud.com", "bandcamp", "spotify",
      "lastfm", "last.fm", "reverbnation", "audiojungle",
      "vimeo", "www.vimeo.com", "vimeo.com",
      "dailymotion", "www.dailymotion.com",
      "freesound", "www.freesound.org", "smule",
      "disqus", "disqus.com",
    ],
  },
  {
    key: "design",
    label: "Design & Creative",
    defaultCollapsed: true,
    platforms: [
      "behance", "dribbble", "deviantart", "500px", "1x.com",
      "canva", "creativemarket", "www.creativemarket.com",
      "unsplash", "eyeem", "artstation", "redbubble",
      "furaffinity", "www.furaffinity.net",
      "picsart", "www.picsart.com", "giphy", "www.giphy.com",
      "picturepush", "www.picturepush.com",
      "themeforest", "www.themeforest.net",
      "imageshack", "imgur", "imgur.com", "istock",
      "flickr", "www.flickr.com",
    ],
  },
  {
    key: "gaming",
    label: "Gaming & Entertainment",
    defaultCollapsed: true,
    platforms: [
      "twitch", "twitch.tv", "twitchtracker.com",
      "kick", "kick.com",
      "steam", "store.steampowered.com", "steam (group)",
      "discord", "chess.com", "www.chess.com",
      "xbox", "playstation", "epicgames", "battlenet", "itch.io",
      "planetminecraft", "www.planetminecraft.com",
      "minecraft", "minecraft.net",
      "roblox", "www.roblox.com",
      "animenetwork",
    ],
  },
  {
    key: "forums",
    label: "Forums & Communities",
    defaultCollapsed: true,
    defaultExcluded: true,
    platforms: [
      "quora",
      "www.goldderby.com", "www.hotukdeals.com",
      "www.mydealz.de", "www.dealabs.com",
      "yelp", "foursquare",
      "googlemaps", "google maps", "maps.google.com",
      "google maps reviews",
    ],
  },
  {
    key: "web_dev",
    label: "Web & Dev",
    defaultCollapsed: true,
    defaultExcluded: true,
    platforms: [
      "wordpress", "profiles.wordpress.org", "wordpress.org",
      "medium", "substack", "stackoverflow", "stack overflow",
      "hackmd.io", "hackaday.io", "www.instructables.com", "instructables",
      "prezi", "codepen", "replit", "dev.to", "dev community",
      "hashnode", "gitlab", "bitbucket",
      "darkweb", "dark web", "dark_web",
      "searxng", "google", "google.com",
      "leak", "leaks",
      "codecademy", "www.codecademy.com",
      "npmpackage", "npm", "npmjs.com", "npm-package",
      "huggingface", "huggingface.co",
      "githubgist", "github gist", "gist.github.com",
      "w3schools", "slashdot", "digitalocean",
      "pastebin", "packagist", "codecanyon",
      "mamot", "mamot.fr", "web", "www",
    ],
  },
  {
    key: "work",
    label: "Work & Productivity",
    defaultCollapsed: true,
    defaultExcluded: true,
    platforms: [
      "trello", "trello.com", "notion", "asana", "slack", "jira",
      "confluence", "office365", "office 365", "microsoft365",
      "microsoftteams", "teams", "freelancer.com",
    ],
  },
  {
    key: "jobs",
    label: "Jobs & Freelance",
    defaultCollapsed: true,
    platforms: [
      "freelancer", "www.freelancer.com",
      "kwork", "kwork.ru", "upwork", "fiverr",
    ],
  },
  {
    key: "news",
    label: "News & Press",
    defaultCollapsed: true,
    defaultExcluded: true,
    platforms: [
      "www.mirror.co.uk", "elgasnoticias.com", "ladygeeksmedia.com",
      "www.mdphoy.com", "www.issuewire.com", "mineriayproyectos.com",
    ],
  },
];

export const JUNK_PLATFORMS = new Set(["play.google.com"]);

export const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  facebook: "Facebook", "facebook.com": "Facebook", "www.facebook.com": "Facebook",
  instagram: "Instagram", "instagram.com": "Instagram", "www.instagram.com": "Instagram",
  whatsapp: "WhatsApp", snapchat: "Snapchat", "snapchat.com": "Snapchat",
  myspace: "MySpace", flickr: "Flickr", "flickr groups": "Flickr Groups",
  "mstdn.social": "Mastodon (mstdn)", buzzfeed: "BuzzFeed",
  twitter: "Twitter / X", "twitter.com": "Twitter / X", "x.com": "Twitter / X", x: "Twitter / X",
  tiktok: "TikTok", reddit: "Reddit", "reddit.com": "Reddit",
  telegram: "Telegram", "t.me": "Telegram",
  youtube: "YouTube", "youtube.com": "YouTube",
  threads: "Threads", bluesky: "Bluesky", "bsky.app": "Bluesky",
  mastodon: "Mastodon", "framapiaf.org": "Mastodon",
  vk: "VKontakte", tumblr: "Tumblr",
  faa: "FAA Records", fcc: "FCC Records",
  "dre.ca.gov": "CA Real Estate License", "contractor license": "Contractor License",
  zillow: "Zillow", "zillow.com": "Zillow",
  "realtor.com": "Realtor.com", realtor: "Realtor.com",
  redfin: "Redfin", trulia: "Trulia",
  court_records: "Court Records", "court records": "Court Records",
  pacer: "PACER", unicourt: "UniCourt", justia: "Justia",
  linkedin: "LinkedIn", "linkedin.com": "LinkedIn", "ar.linkedin.com": "LinkedIn",
  github: "GitHub", beenverified: "BeenVerified", truepeoplesearch: "TruePeopleSearch",
  fastpeoplesearch: "FastPeopleSearch", spokeo: "Spokeo",
  people_search: "People Search", holehe: "Holehe", maigret: "Maigret",
  phoneinfoga: "PhoneInfoga", whois: "WHOIS",
  obituary: "Obituaries", "legacy.com": "Legacy", "findagrave.com": "Find A Grave",
  forevermissed: "Forever Missed", "obituary_mention": "Obituary Mention",
  "dignitymemorial.com": "Dignity Memorial",
  wayback: "Wayback Machine", "web.archive.org": "Wayback Machine",
  "archive.org": "Archive.org",
  indeed: "Indeed", glassdoor: "Glassdoor", job_search: "Job Search",
  tinder: "Tinder", bumble: "Bumble", hinge: "Hinge", grindr: "Grindr",
  "tinder/bumble": "Tinder/Bumble", "tinder/bumble (indirect)": "Tinder/Bumble (indirect)",
  match: "Match", okcupid: "OkCupid", plentyoffish: "PlentyOfFish",
  geocaching: "Geocaching", strava: "Strava", duolingo: "Duolingo",
  openstreetmap: "OpenStreetMap", tripadvisor: "TripAdvisor", couchsurfing: "Couchsurfing",
  ebay: "eBay", craigslist: "Craigslist", etsy: "Etsy", "amazon.com": "Amazon",
  tradingview: "TradingView",
  paypal: "PayPal", gofundme: "GoFundMe", patreon: "Patreon", kofi: "Ko-fi",
  kickstarter: "Kickstarter", indiegogo: "Indiegogo",
  soundcloud: "SoundCloud", "m.soundcloud.com": "SoundCloud",
  mixcloud: "Mixcloud", bandcamp: "Bandcamp", spotify: "Spotify",
  lastfm: "Last.fm", vimeo: "Vimeo", dailymotion: "Dailymotion",
  freesound: "Freesound", smule: "Smule", disqus: "Disqus",
  behance: "Behance", dribbble: "Dribbble", deviantart: "DeviantArt",
  "500px": "500px", canva: "Canva", unsplash: "Unsplash", artstation: "ArtStation",
  picsart: "PicsArt", giphy: "Giphy", picturepush: "PicturePush",
  themeforest: "ThemeForest", imageshack: "ImageShack", imgur: "Imgur", istock: "iStock",
  twitch: "Twitch", kick: "Kick", steam: "Steam", discord: "Discord",
  "chess.com": "Chess.com", planetminecraft: "Planet Minecraft",
  minecraft: "Minecraft", roblox: "Roblox", animenetwork: "Anime Network",
  quora: "Quora", yelp: "Yelp", "google maps": "Google Maps",
  wordpress: "WordPress", medium: "Medium", substack: "Substack",
  stackoverflow: "Stack Overflow", "hackmd.io": "HackMD",
  instructables: "Instructables", prezi: "Prezi", codepen: "CodePen",
  replit: "Replit", "dev.to": "Dev.to", gitlab: "GitLab",
  facecheck: "FaceCheck",
  yandex_thumbnail: "Yandex", reverse_image: "Reverse Image",
  reverse_image_auto: "Reverse Image", facecheck_thumbnail: "FaceCheck",
  lenso: "Lenso", lenso_thumbnail: "Lenso",
  yandex: "Yandex", darkweb: "Dark Web", searxng: "Web Search",
  google: "Google", archive: "Archive.org", leak: "Leaks",
  npmpackage: "npm", huggingface: "Hugging Face",
  githubgist: "GitHub Gist", w3schools: "W3Schools",
  digitalocean: "DigitalOcean", pastebin: "Pastebin", codecanyon: "CodeCanyon",
  "mamot.fr": "Mastodon (mamot)", web: "Web",
  trello: "Trello", notion: "Notion", asana: "Asana", slack: "Slack",
  office365: "Office 365", microsoftteams: "Microsoft Teams",
  freelancer: "Freelancer", kwork: "Kwork", upwork: "Upwork", fiverr: "Fiverr",
  "www.mirror.co.uk": "The Mirror",
};

export function normalizePlatform(raw: string | null | undefined): string {
  if (!raw) return "other";
  return raw.toLowerCase().trim();
}

export function getPlatformDisplayName(raw: string | null | undefined): string {
  const key = normalizePlatform(raw);
  return PLATFORM_DISPLAY_NAMES[key] || raw || "Other";
}

export function getPlatformGroupKey(raw: string | null | undefined): string {
  const key = normalizePlatform(raw);
  for (const group of PLATFORM_GROUPS) {
    if (group.platforms.includes(key)) return group.key;
  }
  return "other";
}

/** Priority rank — lower = more important (used for dedup: keep highest priority) */
export function getGroupPriority(groupKey: string): number {
  const idx = PLATFORM_GROUPS.findIndex(g => g.key === groupKey);
  return idx === -1 ? 999 : idx;
}

export interface GroupedItems<T> {
  groupKey: string;
  groupLabel: string;
  defaultCollapsed: boolean;
  defaultExcluded: boolean;
  platforms: { platformKey: string; platformLabel: string; items: T[] }[];
}

export function groupByPlatform<T>(
  items: T[],
  getPlatform: (item: T) => string | null | undefined,
  customOrder?: string[],
): GroupedItems<T>[] {
  const byPlatform = new Map<string, T[]>();
  for (const item of items) {
    const key = normalizePlatform(getPlatform(item));
    if (!byPlatform.has(key)) byPlatform.set(key, []);
    byPlatform.get(key)!.push(item);
  }

  const groupMap = new Map<string, Map<string, T[]>>();
  for (const g of PLATFORM_GROUPS) groupMap.set(g.key, new Map());
  groupMap.set("other", new Map());

  for (const [platKey, platItems] of byPlatform) {
    const groupKey = getPlatformGroupKey(platKey);
    if (!groupMap.has(groupKey)) groupMap.set(groupKey, new Map());
    const gMap = groupMap.get(groupKey)!;
    if (!gMap.has(platKey)) gMap.set(platKey, []);
    for (const item of platItems) gMap.get(platKey)!.push(item);
  }

  const allGroups = [
    ...PLATFORM_GROUPS,
    { key: "other", label: "Other", platforms: [], defaultCollapsed: true, defaultExcluded: false },
  ];

  // Apply custom order if provided
  const orderedGroups = customOrder
    ? [...allGroups].sort((a, b) => {
        const ai = customOrder.indexOf(a.key);
        const bi = customOrder.indexOf(b.key);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
    : allGroups;

  const result: GroupedItems<T>[] = [];
  for (const group of orderedGroups) {
    const gMap = groupMap.get(group.key);
    if (!gMap || gMap.size === 0) continue;
    const platformEntries = [...gMap.entries()]
      .filter(([, its]) => its.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
    result.push({
      groupKey: group.key,
      groupLabel: group.label,
      defaultCollapsed: (group as PlatformGroup).defaultCollapsed ?? false,
      defaultExcluded: (group as PlatformGroup).defaultExcluded ?? false,
      platforms: platformEntries.map(([platKey, platItems]) => ({
        platformKey: platKey,
        platformLabel: getPlatformDisplayName(platKey),
        items: platItems,
      })),
    });
  }
  return result;
}
