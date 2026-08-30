import Link from "next/link";

type Props = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  plan?: {
    name: string;
    grossPriceMinor: number;
    grantedCredits: number;
  } | null;
};

export function XerianoAuthShell({ title, description, children, footer, plan }: Props) {
  return (
    <main className="xeriano-auth-page">
      <div className="xeriano-auth-ambient" aria-hidden="true" />
      <section className="xeriano-auth-card">
        <header className="xeriano-auth-header">
          <Link href="/" className="xeriano-auth-brand" aria-label="Xeriamo Startseite">
            <span aria-hidden="true">X</span>
            <strong>Xeriamo</strong>
          </Link>
          <h1>{title}</h1>
          <p>{description}</p>
          {plan ? (
            <div className="xeriano-auth-plan" role="status">
              <span>{plan.name} ausgewählt</span>
              <strong>{(plan.grossPriceMinor / 100).toLocaleString("de-DE")} € / Monat</strong>
              <small>{plan.grantedCredits.toLocaleString("de-DE")} Credits monatlich</small>
            </div>
          ) : null}
        </header>
        {children}
        <footer className="xeriano-auth-switch">{footer}</footer>
      </section>
    </main>
  );
}
