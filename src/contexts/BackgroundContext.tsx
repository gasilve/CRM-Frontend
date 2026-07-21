import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

export type BackgroundCategoryId =
  | "cities"
  | "nature"
  | "ocean"
  | "sky"
  | "aerial";

export type BackgroundId = "static" | string;

export type BackgroundMeta = {
  id: BackgroundId;
  name: string;
  subtitle: string;
  category: BackgroundCategoryId | "still";
  /** Looping HD clip URL — null for still photo */
  videoSrc: string | null;
  thumb: string;
};

export type BackgroundCategory = {
  id: BackgroundCategoryId;
  name: string;
  blurb: string;
};

/** Vite public still */
const stillThumb = `${import.meta.env.BASE_URL}glass-backdrop.jpg`.replace(
  /([^:]\/)\/+/g,
  "$1",
);

/** Mixkit free 1080p CDN */
const mix = (id: number) =>
  `https://assets.mixkit.co/videos/${id}/${id}-1080.mp4`;

export const BACKGROUND_CATEGORIES: BackgroundCategory[] = [
  { id: "cities", name: "Cities", blurb: "Skylines, towers & top-down urban" },
  { id: "nature", name: "Nature", blurb: "Forests, falls & green" },
  { id: "ocean", name: "Ocean", blurb: "Waves, coast & sea" },
  { id: "sky", name: "Sky", blurb: "Stars, aurora & cosmos" },
  { id: "aerial", name: "Aerial", blurb: "Mountains & wide vistas" },
];

/**
 * Prerecorded HD loops from Mixkit’s free CDN (direct MP4 links — not hosted in-repo).
 * Cities: 20 clips. Other themes: 5 each.
 */
export const BACKGROUNDS: BackgroundMeta[] = [
  {
    id: "static",
    name: "Still",
    subtitle: "Night city plate",
    category: "still",
    videoSrc: null,
    thumb: stillThumb,
  },

  // ── Cities (20) — skyscrapers, buildings, aerial tops ──
  {
    id: "cities-neon",
    name: "Neon Arteries",
    subtitle: "Night traffic ribbons",
    category: "cities",
    videoSrc: mix(3415),
    thumb: mix(3415),
  },
  {
    id: "cities-harbor",
    name: "Harbor Glow",
    subtitle: "Waterfront skyline",
    category: "cities",
    videoSrc: mix(4450),
    thumb: mix(4450),
  },
  {
    id: "cities-traffic",
    name: "Night Grid",
    subtitle: "Aerial city traffic",
    category: "cities",
    videoSrc: mix(11),
    thumb: mix(11),
  },
  {
    id: "cities-times-sq",
    name: "Times Square",
    subtitle: "Rainy neon night",
    category: "cities",
    videoSrc: mix(4332),
    thumb: mix(4332),
  },
  {
    id: "cities-aerial",
    name: "Skyline Pass",
    subtitle: "Aerial night city",
    category: "cities",
    videoSrc: mix(4308),
    thumb: mix(4308),
  },
  {
    id: "cities-avenue",
    name: "Main Avenue",
    subtitle: "Big-city night flow",
    category: "cities",
    videoSrc: mix(41161),
    thumb: mix(41161),
  },
  {
    id: "cities-glass",
    name: "Glass Towers",
    subtitle: "Corporate aerial tops",
    category: "cities",
    videoSrc: mix(49845),
    thumb: mix(49845),
  },
  {
    id: "cities-metro-night",
    name: "Metropolis",
    subtitle: "Big city from above",
    category: "cities",
    videoSrc: mix(49878),
    thumb: mix(49878),
  },
  {
    id: "cities-panorama",
    name: "Building Pan",
    subtitle: "Aerial building sweep",
    category: "cities",
    videoSrc: mix(41541),
    thumb: mix(41541),
  },
  {
    id: "cities-sweep",
    name: "Night Sweep",
    subtitle: "Aerial night motion",
    category: "cities",
    videoSrc: mix(42343),
    thumb: mix(42343),
  },
  {
    id: "cities-wide",
    name: "Wide Metro",
    subtitle: "Panoramic night city",
    category: "cities",
    videoSrc: mix(49875),
    thumb: mix(49875),
  },
  {
    id: "cities-drift",
    name: "City Drift",
    subtitle: "Slow flyover",
    category: "cities",
    videoSrc: mix(49806),
    thumb: mix(49806),
  },
  {
    id: "cities-manhattan",
    name: "Manhattan",
    subtitle: "Building panorama",
    category: "cities",
    videoSrc: mix(4336),
    thumb: mix(4336),
  },
  {
    id: "cities-nyc-night",
    name: "NYC Night",
    subtitle: "Skyline at night",
    category: "cities",
    videoSrc: mix(4087),
    thumb: mix(4087),
  },
  {
    id: "cities-manhattan-tl",
    name: "Manhattan TL",
    subtitle: "Skyline timelapse",
    category: "cities",
    videoSrc: mix(4341),
    thumb: mix(4341),
  },
  {
    id: "cities-tower-walk",
    name: "Tower Walk",
    subtitle: "Street-level skyscraper",
    category: "cities",
    videoSrc: mix(40701),
    thumb: mix(40701),
  },
  {
    id: "cities-corporate",
    name: "Corporate Row",
    subtitle: "Business towers",
    category: "cities",
    videoSrc: mix(4170),
    thumb: mix(4170),
  },
  {
    id: "cities-dusk-tour",
    name: "Dusk Tour",
    subtitle: "High above at dusk",
    category: "cities",
    videoSrc: mix(41375),
    thumb: mix(41375),
  },
  {
    id: "cities-twin-ave",
    name: "Twin Avenues",
    subtitle: "Night traffic corridors",
    category: "cities",
    videoSrc: mix(34562),
    thumb: mix(34562),
  },
  {
    id: "cities-river",
    name: "River City",
    subtitle: "Aerial waterfront",
    category: "cities",
    videoSrc: mix(49871),
    thumb: mix(49871),
  },

  // ── Nature ──────────────────────────────────────────────
  {
    id: "nature-waterfall",
    name: "Forest Fall",
    subtitle: "Waterfall in woods",
    category: "nature",
    videoSrc: mix(2213),
    thumb: mix(2213),
  },
  {
    id: "nature-canopy",
    name: "Deep Canopy",
    subtitle: "Tranquil forest glide",
    category: "nature",
    videoSrc: mix(50847),
    thumb: mix(50847),
  },
  {
    id: "nature-jungle",
    name: "Jungle Rise",
    subtitle: "Abundant green trees",
    category: "nature",
    videoSrc: mix(5039),
    thumb: mix(5039),
  },
  {
    id: "nature-ridges",
    name: "Green Ridges",
    subtitle: "Tree-covered mountains",
    category: "nature",
    videoSrc: mix(41545),
    thumb: mix(41545),
  },
  {
    id: "nature-creek",
    name: "Rock Creek",
    subtitle: "Creek over stone",
    category: "nature",
    videoSrc: mix(51585),
    thumb: mix(51585),
  },

  // ── Ocean ───────────────────────────────────────────────
  {
    id: "ocean-waves",
    name: "Shore Break",
    subtitle: "Waves on the beach",
    category: "ocean",
    videoSrc: mix(5016),
    thumb: mix(5016),
  },
  {
    id: "ocean-aerial",
    name: "Coastline",
    subtitle: "Aerial beach shore",
    category: "ocean",
    videoSrc: mix(1085),
    thumb: mix(1085),
  },
  {
    id: "ocean-turquoise",
    name: "Turquoise",
    subtitle: "Clear crashing waves",
    category: "ocean",
    videoSrc: mix(51500),
    thumb: mix(51500),
  },
  {
    id: "ocean-rocks",
    name: "Rocky Coast",
    subtitle: "Waves on cliffs",
    category: "ocean",
    videoSrc: mix(51502),
    thumb: mix(51502),
  },
  {
    id: "ocean-fly",
    name: "Low Over Sea",
    subtitle: "Flight above water",
    category: "ocean",
    videoSrc: mix(44392),
    thumb: mix(44392),
  },

  // ── Sky ─────────────────────────────────────────────────
  {
    id: "sky-cosmos",
    name: "Deep Space",
    subtitle: "Star field drift",
    category: "sky",
    videoSrc: mix(1610),
    thumb: mix(1610),
  },
  {
    id: "sky-lake",
    name: "Lake Stars",
    subtitle: "Night sky timelapse",
    category: "sky",
    videoSrc: mix(1704),
    thumb: mix(1704),
  },
  {
    id: "sky-aurora",
    name: "Aurora",
    subtitle: "Borealis at dawn",
    category: "sky",
    videoSrc: mix(4040),
    thumb: mix(4040),
  },
  {
    id: "sky-northern",
    name: "Northern Lights",
    subtitle: "Blue-green curtains",
    category: "sky",
    videoSrc: mix(4038),
    thumb: mix(4038),
  },
  {
    id: "sky-milky",
    name: "Milky Way",
    subtitle: "Galaxy night sky",
    category: "sky",
    videoSrc: mix(4148),
    thumb: mix(4148),
  },

  // ── Aerial ──────────────────────────────────────────────
  {
    id: "aerial-matterhorn",
    name: "Matterhorn",
    subtitle: "Alpine peak view",
    category: "aerial",
    videoSrc: mix(4281),
    thumb: mix(4281),
  },
  {
    id: "aerial-ranges",
    name: "Ranges",
    subtitle: "Mountain landscape",
    category: "aerial",
    videoSrc: mix(4366),
    thumb: mix(4366),
  },
  {
    id: "aerial-dusk",
    name: "Alpine Dusk",
    subtitle: "Mountains at sunset",
    category: "aerial",
    videoSrc: mix(3128),
    thumb: mix(3128),
  },
  {
    id: "aerial-lake",
    name: "Lake Vista",
    subtitle: "Aerial lake sunset",
    category: "aerial",
    videoSrc: mix(4998),
    thumb: mix(4998),
  },
  {
    id: "aerial-bay",
    name: "Bay Glow",
    subtitle: "Sunset over the bay",
    category: "aerial",
    videoSrc: mix(4999),
    thumb: mix(4999),
  },
];

export const BACKGROUND_LS_KEY = "accenty.crm.background.v3";
const DEFAULT_BACKGROUND: BackgroundId = "static";

type BackgroundCtx = {
  backgroundId: BackgroundId;
  backgroundMeta: BackgroundMeta;
  setBackground: (id: BackgroundId) => void;
  isVideo: boolean;
};

const defaultMeta =
  BACKGROUNDS.find((b) => b.id === DEFAULT_BACKGROUND) ?? BACKGROUNDS[0];

const BackgroundContext = createContext<BackgroundCtx>({
  backgroundId: DEFAULT_BACKGROUND,
  backgroundMeta: defaultMeta,
  setBackground: () => {},
  isVideo: false,
});

function readStoredBackground(): BackgroundId {
  try {
    const stored = localStorage.getItem(BACKGROUND_LS_KEY);
    if (stored && BACKGROUNDS.some((b) => b.id === stored)) return stored;
    // Migrate earlier keys if the id still exists
    for (const key of ["accenty.crm.background.v2", "accenty.crm.background.v1"]) {
      const legacy = localStorage.getItem(key);
      if (legacy && BACKGROUNDS.some((b) => b.id === legacy)) return legacy;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_BACKGROUND;
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backgroundId, setBackgroundId] =
    useState<BackgroundId>(readStoredBackground);

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-bg", backgroundId);
    try {
      localStorage.setItem(BACKGROUND_LS_KEY, backgroundId);
    } catch {
      /* ignore */
    }
  }, [backgroundId]);

  const backgroundMeta =
    BACKGROUNDS.find((b) => b.id === backgroundId) ?? BACKGROUNDS[0];

  return (
    <BackgroundContext.Provider
      value={{
        backgroundId,
        backgroundMeta,
        setBackground: setBackgroundId,
        isVideo: Boolean(backgroundMeta.videoSrc),
      }}
    >
      {children}
    </BackgroundContext.Provider>
  );
}

export const useBackground = () => useContext(BackgroundContext);
