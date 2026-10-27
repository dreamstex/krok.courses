"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faBullseye,
  faCircleExclamation,
  faUser,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import type { Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
}

interface TabItem {
  href: string;
  label: string;
  icon?: IconDefinition;
  isKrokki?: boolean;
  isActive: boolean;
}

export function BottomTabBar({ locale }: Props) {
  const pathname = usePathname();
  const isRu = locale === "ru";

  const tabs: TabItem[] = [
    {
      href: "/dashboard",
      label: isRu ? "Главная" : "Галоўная",
      icon: faHouse,
      isActive: pathname === "/dashboard" || pathname === "/",
    },
    {
      href: "/chat",
      label: isRu ? "Крокки" : "Кроккі",
      isKrokki: true,
      isActive: pathname.startsWith("/chat"),
    },
    {
      href: "/goals",
      label: isRu ? "Цели" : "Мэты",
      icon: faBullseye,
      isActive: pathname.startsWith("/goals"),
    },
    {
      href: "/mistakes",
      label: isRu ? "Ошибки" : "Памылкі",
      icon: faCircleExclamation,
      isActive: pathname.startsWith("/mistakes"),
    },
    {
      href: "/profile",
      label: isRu ? "Профиль" : "Профіль",
      icon: faUser,
      isActive: pathname.startsWith("/profile"),
    },
  ];

  return (
    <nav className="bottom-tab-bar" aria-label={isRu ? "Мобильная навигация" : "Мабільная навігацыя"}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`bottom-tab-item ${tab.isActive ? "active" : ""}`}
        >
          <span className="bottom-tab-icon">
            {tab.isKrokki ? (
              <Image
                src="/krokki.svg"
                alt=""
                width={20}
                height={20}
                className="bottom-tab-krokki"
              />
            ) : (
              <FontAwesomeIcon icon={tab.icon!} />
            )}
          </span>
          <span className="bottom-tab-label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
