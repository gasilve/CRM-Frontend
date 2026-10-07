import { useBackground } from "@/contexts/BackgroundContext";

type FullScreenLoaderProps = {
  /** Short status line under the progress beam. */
  message?: string;
};

function isVideoSrc(src: string): boolean {
  return /\.mp4($|\?)/i.test(src) || src.includes("mixkit.co/videos");
}

export default function FullScreenLoader({ message = "Loading" }: FullScreenLoaderProps) {
  const { backgroundMeta } = useBackground();
  const src = backgroundMeta.videoSrc || backgroundMeta.thumb || "";
  const video = Boolean(backgroundMeta.videoSrc) || (src ? isVideoSrc(src) : false);

  return (
    <div className="boot-screen boot-screen--scene" role="status" aria-live="polite" aria-busy="true">
      {src ? (
        video ? (
          <video
            className="boot-scene-media"
            src={src}
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
            aria-hidden
          />
        ) : (
          <div
            className="boot-scene-media"
            style={{ backgroundImage: `url(${src})` }}
            aria-hidden
          />
        )
      ) : null}
      <div className="boot-atmo boot-atmo-radial" aria-hidden />
      <div className="boot-atmo boot-atmo-vignette" aria-hidden />
      <div className="boot-atmo boot-atmo-scan" aria-hidden />

      <div className="boot-card">
        <p className="boot-eyebrow">True Cognition CRM</p>
        <h1 className="boot-title">True Cognition</h1>
        <div className="boot-progress" aria-hidden>
          <span className="boot-progress__beam" />
        </div>
        <p className="boot-caption">{message}</p>
      </div>
    </div>
  );
}
