import "server-only";

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  signInProvider?: string | null;
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch (e) {
    console.error("JWT payload parse error:", e);
    return null;
  }
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  const apiKey = (
    process.env.FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    ""
  ).replace(/"/g, "").trim();

  if (apiKey) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const user = data.users?.[0];
        if (user && user.localId) {
          const email = (user.email || `${user.localId}@firebase.local`).toLowerCase();
          const providerIds = (user.providerUserInfo || []).map((p: { providerId?: string }) => p.providerId);
          const signInProvider = providerIds.includes("google.com")
            ? "google.com"
            : providerIds.includes("password")
              ? "password"
              : null;
          return {
            uid: user.localId,
            email,
            displayName: user.displayName || null,
            avatarUrl: user.photoUrl || null,
            signInProvider,
          };
        }
      } else {
        const errorText = await response.text();
        console.warn(`Identity Toolkit lookup failed (${response.status}):`, errorText);
      }
    } catch (err) {
      console.warn("Identity Toolkit network error, falling back to token payload check:", err);
    }
  }


  // фолбэк если гугл апи не ответил, просто декодим jwt руками
  const payload = parseJwtPayload(idToken);
  if (!payload) return null;

  const uid =
    (typeof payload.user_id === "string" ? payload.user_id : null) ||
    (typeof payload.sub === "string" ? payload.sub : null);

  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  const now = Math.floor(Date.now() / 1000);

  if (!uid || exp < now) {
    console.warn("Firebase token expired or missing uid:", { uid, exp, now });
    return null;
  }

  const rawEmail = typeof payload.email === "string" ? payload.email : null;
  const email = (rawEmail || `${uid}@firebase.local`).toLowerCase();

  const rawProjectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").replace(/"/g, "").trim();
  if (rawProjectId) {
    const aud = payload.aud;
    const iss = payload.iss;
    const expectedIss = `https://securetoken.google.com/${rawProjectId}`;
    if (aud !== rawProjectId && iss !== expectedIss) {
      console.warn("Firebase token project mismatch (warning):", { aud, iss, expected: rawProjectId });
      if (typeof aud === "string" && !aud.includes(rawProjectId)) {
        return null;
      }
    }
  }

  const firebaseClaim =
    payload.firebase && typeof payload.firebase === "object"
      ? (payload.firebase as Record<string, unknown>)
      : null;
  const signInProvider =
    typeof firebaseClaim?.sign_in_provider === "string"
      ? firebaseClaim.sign_in_provider
      : null;

  return {
    uid,
    email,
    displayName:
      (typeof payload.name === "string" ? payload.name : null) ||
      (typeof payload.display_name === "string" ? payload.display_name : null),
    avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
    signInProvider,
  };
}

export async function updateFirebasePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const apiKey = (
    process.env.FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    ""
  ).replace(/"/g, "").trim();

  if (!apiKey) {
    return { success: false, error: "Firebase API key is not configured" };
  }

  try {
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: currentPassword,
          returnSecureToken: true,
        }),
      },
    );

    if (!signInRes.ok) {
      const errData = (await signInRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      const message = errData.error?.message || "";
      if (
        message === "INVALID_PASSWORD" ||
        message === "INVALID_LOGIN_CREDENTIALS" ||
        message.includes("INVALID")
      ) {
        return { success: false, errorCode: "auth/wrong-password", error: "INVALID_PASSWORD" };
      }
      return { success: false, errorCode: message, error: message };
    }

    const signInData = (await signInRes.json()) as { idToken?: string };
    const idToken = signInData.idToken;
    if (!idToken) {
      return { success: false, error: "Failed to get token for password update" };
    }

    const updateRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          password: newPassword,
          returnSecureToken: true,
        }),
      },
    );

    if (!updateRes.ok) {
      const updateErr = (await updateRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      return {
        success: false,
        errorCode: updateErr.error?.message,
        error: updateErr.error?.message || "UPDATE_FAILED",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Firebase update password error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}
