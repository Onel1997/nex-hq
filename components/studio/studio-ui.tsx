import type { ReactNode } from "react";

export function StudioHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="nx-page-header">
      <div>
        <p className="nx-page-header__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}

export function StudioStepper({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol
      className="nx-stepper"
      style={{ "--nx-step-count": steps.length } as React.CSSProperties}
      aria-label="Fortschritt"
    >
      {steps.map((step, index) => (
        <li
          key={step}
          className={`nx-stepper__item${index < current ? " is-complete" : ""}${index === current ? " is-current" : ""}`}
          aria-current={index === current ? "step" : undefined}
        >
          <span>{index < current ? "✓" : String(index + 1).padStart(2, "0")}</span>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}

export function TechnicalDetails({ children }: { children: ReactNode }) {
  return (
    <details className="nx-technical">
      <summary>Technische Details</summary>
      <div className="nx-technical__body">{children}</div>
    </details>
  );
}
