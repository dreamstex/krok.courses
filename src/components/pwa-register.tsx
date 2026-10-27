"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("KROK PWA Service Worker registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("KROK PWA Service Worker registration failed:", err);
        });
    }
  }, []);

  return null;
}
