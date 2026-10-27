"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

type Props = {
  locale: Locale;
  name: string;
  email: string;
  avatarData: string | null;
  isGoogleUser?: boolean;
};

function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("file"));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("image"));
      image.onload = () => {
        const size = 512;
        const scale = Math.min(1, size / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileSettings({ locale, name, email, avatarData, isGoogleUser }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(name);
  const [avatar, setAvatar] = useState(avatarData);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isGoogle, setIsGoogle] = useState(Boolean(isGoogleUser));

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((fbUser) => {
      if (fbUser) {
        const hasGoogle = fbUser.providerData.some((p) => p.providerId === "google.com");
        if (hasGoogle) {
          setIsGoogle(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t(locale, "profile.avatarInvalid"));
      return;
    }
    try {
      setAvatar(await shrinkImage(file));
      setError("");
      setMessage("");
    } catch {
      setError(t(locale, "profile.avatarInvalid"));
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const hasCur = Boolean(currentPassword.trim());
    const hasNew = Boolean(newPassword.trim());

    if (hasCur && !hasNew) {
      setError(locale === "ru" ? "Введите новый пароль." : "Увядзіце новы пароль.");
      setBusy(false);
      return;
    }

    if (!hasCur && hasNew) {
      setError(locale === "ru" ? "Введите текущий пароль." : "Увядзіце бягучы пароль.");
      setBusy(false);
      return;
    }

    if (hasNew && newPassword.length < 8) {
      setError(t(locale, "profile.passwordShort"));
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, avatarData: avatar, currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t(locale, "profile.saveError"));
      setCurrentPassword("");
      setNewPassword("");
      setMessage(t(locale, "profile.saved"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t(locale, "profile.saveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="profile-settings">
      <section className="card">
        <h2>{t(locale, "profile.personalTitle")}</h2>
        <div className="profile-edit-avatar">
          <div className="profile-avatar">
            {avatar ? <Image src={avatar} alt={t(locale, "profile.avatarAlt")} width={88} height={88} unoptimized /> : <span>{displayName.trim().charAt(0).toUpperCase()}</span>}
          </div>
          <div>
            <input ref={fileInput} className="visually-hidden" type="file" accept="image/*" onChange={chooseAvatar} />
            <div className="profile-avatar-actions">
              <button className="btn secondary" type="button" onClick={() => fileInput.current?.click()}>{t(locale, "profile.chooseAvatar")}</button>
              {avatar && <button className="text-button" type="button" onClick={() => setAvatar(null)}>{t(locale, "profile.removeAvatar")}</button>}
            </div>
            <p className="muted profile-hint">{t(locale, "profile.avatarHint")}</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="displayName">{t(locale, "profile.name")}</label>
          <input id="displayName" type="text" maxLength={40} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="profileEmail">{t(locale, "profile.email")}</label>
          <input
            id="profileEmail"
            type="email"
            value={email}
            disabled
            readOnly
            style={{ backgroundColor: "var(--accent-soft)", opacity: 0.75, cursor: "not-allowed" }}
          />
        </div>
      </section>

      <section className="card">
        <h2>{t(locale, "profile.passwordTitle")}</h2>
        {isGoogle ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px",
              borderRadius: "var(--radius)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--line)",
              marginTop: 10,
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                {t(locale, "profile.googleAccountTitle")}
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
                {t(locale, "profile.googleAccountDesc", { email })}
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="muted">{t(locale, "profile.passwordHint")}</p>
            <div className="field">
              <label htmlFor="currentPassword">{t(locale, "profile.currentPassword")}</label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">{t(locale, "profile.newPassword")}</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={100}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
          </>
        )}
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="feedback good" role="status">{message}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? t(locale, "auth.wait") : t(locale, "profile.save")}</button>
    </form>
  );
}
