"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from "@/lib/firebase/client";
import { getFirebaseErrorMessage } from "@/lib/firebase/errors";
import { t, type Locale } from "@/lib/i18n";

type Mode = "login" | "register";

export function AuthForm({ mode, locale }: { mode: Mode; locale: Locale }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";
  const configured = isFirebaseConfigured();

  async function establishSession(idToken: string, displayName?: string | null) {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, displayName }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error ?? t(locale, "auth.loginError"));
    }

    if (data.isNewUser) {
      router.push("/onboarding");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const displayName = String(form.get("displayName") || "").trim();

    if (isRegister && !form.get("agreePrivacy")) {
      setError(
        locale === "ru"
          ? "Необходимо согласиться с Политикой конфиденциальности."
          : "Неабходна пагадзіцца з Палітыкай прыватнасці.",
      );
      setPending(false);
      return;
    }

    if (isRegister && password.length < 8) {
      setError(
        locale === "ru"
          ? "Пароль должен содержать не менее 8 символов."
          : "Пароль павінен змяшчаць не менш за 8 сімвалаў.",
      );
      setPending(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setError(
        locale === "ru"
          ? "Firebase не настроен. Добавьте параметры NEXT_PUBLIC_FIREBASE_* в .env"
          : "Firebase не наладжаны. Дадайце параметры NEXT_PUBLIC_FIREBASE_* у .env",
      );
      setPending(false);
      return;
    }

    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(userCredential.user, { displayName }).catch(() => undefined);
        }
        const idToken = await userCredential.user.getIdToken();
        await establishSession(idToken, displayName);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await userCredential.user.getIdToken();
        await establishSession(idToken);
      }
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code) {
        setError(getFirebaseErrorMessage(code, locale));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t(locale, "common.noConnection"));
      }
    } finally {
      setPending(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setPending(true);

    const auth = getFirebaseAuth();
    if (!auth) {
      setError(
        locale === "ru"
          ? "Firebase не настроен. Добавьте параметры NEXT_PUBLIC_FIREBASE_* в .env"
          : "Firebase не наладжаны. Дадайце параметры NEXT_PUBLIC_FIREBASE_* у .env",
      );
      setPending(false);
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      await establishSession(idToken, result.user.displayName);
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code && code !== "auth/popup-closed-by-user") {
        setError(getFirebaseErrorMessage(code, locale));
      } else if (code === "auth/popup-closed-by-user") {
      } else if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card" style={{ width: "100%", margin: "0 auto" }}>
      {!configured && (
        <div className="feedback note" style={{ marginBottom: 16 }}>
          <strong>Firebase:</strong>{" "}
          {locale === "ru"
            ? "Укажите ключи Firebase в .env для работы авторизации."
            : "Пакажыце ключы Firebase у .env для працы аўтарызацыі."}
        </div>
      )}

      {configured && (
        <>
          <button
            type="button"
            className="btn-google"
            onClick={handleGoogleSignIn}
            disabled={pending}
            style={{ marginBottom: 16 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
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
            {isRegister
              ? (locale === "ru" ? "Зарегистрироваться через Google" : "Зарэгістравацца праз Google")
              : (locale === "ru" ? "Войти через Google" : "Увайсці праз Google")}
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              margin: "12px 0 16px",
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            <div style={{ flex: 1, height: 1, backgroundColor: "var(--line)" }} />
            <span style={{ padding: "0 10px" }}>{locale === "ru" ? "или по почте" : "ці праз пошту"}</span>
            <div style={{ flex: 1, height: 1, backgroundColor: "var(--line)" }} />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit}>
        {isRegister && (
          <div className="field">
            <label htmlFor="displayName">{t(locale, "auth.name")}</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              maxLength={40}
              autoComplete="given-name"
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{t(locale, "auth.email")}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={120}
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t(locale, "auth.password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={isRegister ? 8 : 6}
            maxLength={100}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
          {isRegister && (
            <span className="muted" style={{ fontSize: 13 }}>
              {t(locale, "auth.passwordHint")}
            </span>
          )}
        </div>
        {isRegister && (
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 13,
              cursor: "pointer",
              margin: "14px 0 16px",
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              name="agreePrivacy"
              required
              style={{
                marginTop: 2,
                cursor: "pointer",
                width: "auto",
                accentColor: "var(--accent)",
              }}
            />
            <span>
              {locale === "ru" ? (
                <>
                  Согласен(на) с{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                  >
                    Политикой конфиденциальности
                  </Link>
                </>
              ) : (
                <>
                  Згодзен(на) з{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                  >
                    Палітыкай прыватнасці
                  </Link>
                </>
              )}
            </span>
          </label>
        )}
        {error && (
          <p className="error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending
            ? t(locale, "auth.wait")
            : isRegister
              ? t(locale, "auth.create")
              : t(locale, "auth.login")}
        </button>
      </form>
    </div>
  );
}
