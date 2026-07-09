const DISTANT_PILLARS = [
  { left: "5%", height: "72%", delay: "0s" },
  { left: "14%", height: "58%", delay: "12s" },
  { left: "86%", height: "64%", delay: "8s" },
  { left: "93%", height: "76%", delay: "20s" },
] as const;

export function FacilityArchitecture() {
  return (
    <div className="facility-architecture" aria-hidden>
      {/* Background plane — massive distant forms */}
      <div className="facility-arch-plane facility-arch-far">
        <svg
          className="facility-arch-rings"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <g fill="none" strokeWidth="0.1">
            <ellipse
              cx="48"
              cy="44"
              rx="56"
              ry="38"
              transform="rotate(-18 48 44)"
            />
            <ellipse
              cx="52"
              cy="50"
              rx="62"
              ry="42"
              transform="rotate(14 52 50)"
            />
            <ellipse
              cx="46"
              cy="48"
              rx="48"
              ry="52"
              transform="rotate(-32 46 48)"
            />
            <ellipse
              cx="54"
              cy="42"
              rx="70"
              ry="34"
              transform="rotate(8 54 42)"
            />
          </g>
        </svg>

        <div className="facility-arch-distant">
          {DISTANT_PILLARS.map((pillar) => (
            <span
              key={pillar.left}
              className="facility-arch-pillar"
              style={{
                left: pillar.left,
                height: pillar.height,
                animationDelay: pillar.delay,
              }}
            />
          ))}
          <span className="facility-arch-tower facility-arch-tower-left" />
          <span className="facility-arch-tower facility-arch-tower-right" />
        </div>
      </div>

      {/* Midground plane — floor projection & brain framework */}
      <div className="facility-arch-plane facility-arch-mid">
        <div className="facility-arch-floor" />
        <div className="facility-arch-framework" />
      </div>
    </div>
  );
}
