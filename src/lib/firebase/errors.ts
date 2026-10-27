import type { Locale } from "@/lib/i18n";

export function getFirebaseErrorMessage(errorCode: string, locale: Locale): string {
  const isRu = locale === "ru";

  switch (errorCode) {
    case "auth/email-already-in-use":
      return isRu
        ? "Пользователь с такой электронной почтой уже зарегистрирован."
        : "Карыстальнік з такой электроннай поштай ужо зарэгістраваны.";
    case "auth/invalid-email":
      return isRu
        ? "Некорректный адрес электронной почты."
        : "Няслушны адрас электроннай пошты.";
    case "auth/operation-not-allowed":
      return isRu
        ? "Этот метод авторизации не включен в Firebase Console."
        : "Гэты метад аўтарызацыі не ўключаны ў Firebase Console.";
    case "auth/weak-password":
      return isRu
        ? "Пароль слишком простой (требуется не менее 8 символов)."
        : "Пароль занадта просты (патрабуецца не менш за 8 сімвалаў).";
    case "auth/user-disabled":
      return isRu
        ? "Учетная запись заблокирована."
        : "Уліковы запіс заблакаваны.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return isRu
        ? "Неверный адрес электронной почты или пароль."
        : "Няслушны адрас электроннай пошты альбо пароль.";
    case "auth/too-many-requests":
      return isRu
        ? "Слишком много неудачных попыток. Пожалуйста, подождите или сбросьте пароль."
        : "Занадта шмат няўдалых спроб. Калі ласка, пачакайце альбо скіньце пароль.";
    case "auth/popup-closed-by-user":
      return isRu
        ? "Окно авторизации было закрыто."
        : "Акно аўтарызацыі было зачынена.";
    case "auth/popup-blocked":
      return isRu
        ? "Всплывающее окно заблокировано браузером. Разрешите всплывающие окна."
        : "Усплывальнае акно заблакавана браўзерам. Дазвольце ўсплывальныя вокны.";
    case "auth/network-request-failed":
      return isRu
        ? "Ошибка сети. Проверьте подключение к интернету."
        : "Памылка сеткі. Праверце падключэнне да інтэрнэту.";
    default:
      return isRu
        ? "Ошибка авторизации Firebase. Проверьте данные и повторите попытку."
        : "Памылка аўтарызацыі Firebase. Праверце даныя і паспрабуйце зноў.";
  }
}
