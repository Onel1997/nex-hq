"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { useLocale } from "@/lib/i18n";
import { logoutOwner } from "@/app/auth-actions";
import {
  getStudioSidebarSections,
  isSidebarNavItemActive,
} from "@/lib/navigation/hq-navigation";

type BodySnapshot = {
  overflow: string;
  position: string;
  top: string;
  width: string;
  scrollY: number;
};

function lockBody(): BodySnapshot {
  const body = document.body;
  const snapshot = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    scrollY: window.scrollY,
  };
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${snapshot.scrollY}px`;
  body.style.width = "100%";
  return snapshot;
}

function restoreBody(snapshot: BodySnapshot) {
  const body = document.body;
  body.style.overflow = snapshot.overflow;
  body.style.position = snapshot.position;
  body.style.top = snapshot.top;
  body.style.width = snapshot.width;
  window.scrollTo(0, snapshot.scrollY);
}

export function StudioMobileNavigation({
  audience,
}: {
  audience: "OWNER" | "CUSTOMER";
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const locale = useLocale();
  const drawerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const close = useCallback(() => setOpen(false), []);
  const sections = getStudioSidebarSections(locale, audience);
  const brand = "Xeriamo";
  const brandSubtitle = audience === "CUSTOMER" ? "Creator Suite" : "Owner Workspace";

  useEffect(() => {
    if (!open) return;
    const snapshot = lockBody();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onResize = () => {
      if (window.innerWidth > 900) close();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      restoreBody(snapshot);
    };
  }, [close, open]);

  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="studio-mobile-nav-trigger"
        onClick={() => setOpen(true)}
        aria-label="Studio-Menü öffnen"
        aria-expanded={open}
        aria-controls={drawerId}
      >
        <Menu size={20} />
      </button>
      {open ? (
        <div className="studio-mobile-nav-backdrop" onPointerDown={close}>
          <aside
            id={drawerId}
            className={`studio-mobile-nav-drawer is-${audience.toLowerCase()}`}
            data-audience={audience}
            role="dialog"
            aria-modal="true"
            aria-label={`${brand} Navigation`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>{brand}</strong>
                <span>{brandSubtitle}</span>
              </div>
              <button type="button" onClick={close} aria-label="Studio-Menü schließen" autoFocus>
                <X size={19} />
              </button>
            </header>
            <nav aria-label={`${brand} Studios`}>
              {sections.map((section) => (
                <section key={section.id}>
                  <h2>{section.label}</h2>
                  <div>
                    {section.items.map((item) => {
                      const active = isSidebarNavItemActive(pathname, item);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={close}
                          className={active ? "is-active" : ""}
                          aria-current={active ? "page" : undefined}
                          style={{
                            "--studio-mobile-nav-accent": item.accent ?? "#a78bfa",
                          } as CSSProperties}
                        >
                          <span className="studio-mobile-nav-icon" aria-hidden="true">
                            <Icon size={19} />
                          </span>
                          <span className="studio-mobile-nav-label">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </nav>
            {audience === "OWNER" ? (
              <footer className="studio-mobile-nav-footer">
                <form action={logoutOwner}>
                  <button type="submit" className="studio-mobile-nav-signout">
                    <LogOut size={19} aria-hidden="true" />
                    <span>Abmelden</span>
                  </button>
                </form>
              </footer>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
