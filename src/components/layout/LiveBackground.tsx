import { useEffect, useRef } from "react";
import { useBackground } from "@/contexts/BackgroundContext";

/** Slow the clip so short Mixkit loops feel a bit longer. */
const PLAYBACK_RATE = 0.8;
/** Crossfade window at the end → start (seconds of media time). */
const CROSSFADE_SEC = 1.4;

/**
 * Full-bleed muted HD clip behind the shell.
 * Dual-buffer + opacity crossfade softens the hard loop cut; playback
 * is slightly slowed so ~10–20s Mixkit stock feels less choppy.
 */
export function LiveBackground() {
  const { backgroundMeta, isVideo } = useBackground();
  const layerA = useRef<HTMLVideoElement>(null);
  const layerB = useRef<HTMLVideoElement>(null);
  const activeIdx = useRef<0 | 1>(0);
  const fading = useRef(false);

  const src = backgroundMeta.videoSrc;

  useEffect(() => {
    if (!isVideo || !src) return;
    const a = layerA.current;
    const b = layerB.current;
    if (!a || !b) return;

    const layers = [a, b] as const;
    activeIdx.current = 0;
    fading.current = false;

    const arm = (el: HTMLVideoElement, on: boolean) => {
      el.defaultMuted = true;
      el.muted = true;
      el.playsInline = true;
      el.loop = false;
      el.playbackRate = PLAYBACK_RATE;
      el.classList.toggle("is-active", on);
    };

    arm(a, true);
    arm(b, false);
    a.currentTime = 0;
    b.currentTime = 0;
    void a.play().catch(() => {});
    b.pause();

    const fadeSecFor = (duration: number) =>
      Math.min(CROSSFADE_SEC, Math.max(0.6, duration * 0.22));

    const beginCrossfade = () => {
      if (fading.current) return;
      const from = layers[activeIdx.current];
      const to = layers[activeIdx.current === 0 ? 1 : 0];
      if (!Number.isFinite(from.duration) || from.duration < 1.5) return;

      const fadeSec = fadeSecFor(from.duration);
      if (from.duration - from.currentTime > fadeSec + 0.05) return;

      fading.current = true;
      to.playbackRate = PLAYBACK_RATE;
      try {
        to.currentTime = 0;
      } catch {
        /* ignore seek race */
      }
      void to.play().catch(() => {});

      // Drive opacity via class; duration set as CSS var for the transition.
      const root = from.parentElement;
      if (root) root.style.setProperty("--live-xfade", `${fadeSec}s`);
      to.classList.add("is-active");
      from.classList.remove("is-active");

      window.setTimeout(() => {
        from.pause();
        try {
          from.currentTime = 0;
        } catch {
          /* ignore */
        }
        activeIdx.current = activeIdx.current === 0 ? 1 : 0;
        fading.current = false;
      }, fadeSec * 1000 + 40);
    };

    const onTimeUpdate = (idx: 0 | 1) => () => {
      if (activeIdx.current !== idx) return;
      beginCrossfade();
    };

    const onEnded = (idx: 0 | 1) => () => {
      // Fallback if timeupdate missed the window (tab throttle, etc.)
      if (activeIdx.current !== idx || fading.current) return;
      fading.current = false;
      const from = layers[idx];
      const to = layers[idx === 0 ? 1 : 0];
      from.classList.remove("is-active");
      to.classList.add("is-active");
      to.playbackRate = PLAYBACK_RATE;
      try {
        to.currentTime = 0;
      } catch {
        /* ignore */
      }
      void to.play().catch(() => {});
      from.pause();
      activeIdx.current = idx === 0 ? 1 : 0;
    };

    const tryPlayActive = () => {
      const el = layers[activeIdx.current];
      el.playbackRate = PLAYBACK_RATE;
      void el.play().catch(() => {});
    };

    const tu0 = onTimeUpdate(0);
    const tu1 = onTimeUpdate(1);
    const en0 = onEnded(0);
    const en1 = onEnded(1);

    a.addEventListener("timeupdate", tu0);
    b.addEventListener("timeupdate", tu1);
    a.addEventListener("ended", en0);
    b.addEventListener("ended", en1);
    a.addEventListener("loadeddata", tryPlayActive);
    a.addEventListener("canplay", tryPlayActive);

    return () => {
      a.removeEventListener("timeupdate", tu0);
      b.removeEventListener("timeupdate", tu1);
      a.removeEventListener("ended", en0);
      b.removeEventListener("ended", en1);
      a.removeEventListener("loadeddata", tryPlayActive);
      a.removeEventListener("canplay", tryPlayActive);
      a.pause();
      b.pause();
    };
  }, [src, isVideo]);

  if (!isVideo || !src) return null;

  return (
    <div className="atmo atmo-live-bg" aria-hidden>
      <video
        ref={layerA}
        key={`a-${src}`}
        className="atmo-live-video is-active"
        src={src}
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={layerB}
        key={`b-${src}`}
        className="atmo-live-video"
        src={src}
        muted
        playsInline
        preload="auto"
      />
      <div className="atmo-live-scrim" />
    </div>
  );
}
