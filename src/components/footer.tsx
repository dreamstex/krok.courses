import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/i18n";

interface FooterProps {
  locale: Locale;
  className?: string;
  style?: React.CSSProperties;
}

export function Footer({ locale, className, style }: FooterProps) {
  const isRu = locale === "ru";

  return (
    <footer className={`landing-footer ${className ?? ""}`} style={style}>
      <div className="landing-footer-brand">
        <div className="landing-footer-logo-wrap">
          <Image
            src="/krok_black.svg"
            alt="Крок"
            width={80}
            height={30}
            className="logo-light footer-logo"
            style={{ height: "auto" }}
          />
          <Image
            src="/krok_white.svg"
            alt="Крок"
            width={80}
            height={30}
            className="logo-dark footer-logo"
            style={{ height: "auto" }}
          />
        </div>
        <span className="landing-footer-credit">
          З любоўю,{" "}
          <a
            href="https://github.com/dreamstex"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-footer-author"
          >
            Dreamstex
          </a>{" "}
          (Грышчук Мікалай) &lt;3
        </span>
      </div>

      <div className="landing-footer-links">
        <a
          href="https://github.com/dreamstex/krok.courses"
          target="_blank"
          rel="noopener noreferrer"
          className="landing-footer-github"
          aria-label="GitHub"
          title="GitHub"
        >
          <Image src="/github.svg" alt="GitHub" width={20} height={20} style={{ height: "auto" }} />
        </a>
        <Link href="/privacy">
          {isRu ? "Политика конфиденциальности" : "Палітыка прыватнасці"}
        </Link>
        <a href="mailto:mybit32@gmail.com" className="landing-footer-admin">
          {isRu ? "Связь с админом" : "Сувязь з адмінам"}
        </a>
      </div>
    </footer>
  );
}
