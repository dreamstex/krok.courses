export function AmbientBackground() {
  return (
    <div className="krok-landscape-bg" aria-hidden="true">
      <div className="krok-landscape-layer krok-landscape-light">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bg_landscape_light.jpg"
          alt=""
          className="krok-landscape-img"
        />
        <div className="krok-landscape-mist krok-mist-light" />
        <div className="krok-landscape-sunbeam" />
      </div>

      <div className="krok-landscape-layer krok-landscape-dark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bg_landscape_dark.jpg"
          alt=""
          className="krok-landscape-img"
        />
        <div className="krok-landscape-mist krok-mist-dark" />
        <div className="krok-landscape-moonbeam" />
      </div>

      <div className="krok-landscape-vignette" />
    </div>
  );
}
