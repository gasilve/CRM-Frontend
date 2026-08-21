type FullScreenLoaderProps = {
  /** Short status line under the progress beam. */
  message?: string;
};

export default function FullScreenLoader({ message = "Loading" }: FullScreenLoaderProps) {
  return (
    <div className="boot-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="boot-atmo boot-atmo-radial" aria-hidden />
      <div className="boot-atmo boot-atmo-vignette" aria-hidden />
      <div className="boot-atmo boot-atmo-scan" aria-hidden />

      <div className="boot-card">
        <p className="boot-eyebrow">Accenty CRM</p>
        <h1 className="boot-title">Accenty</h1>
        <div className="boot-progress" aria-hidden>
          <span className="boot-progress__beam" />
        </div>
        <p className="boot-caption">{message}</p>
      </div>
    </div>
  );
}
