import { z } from "zod";
import { askAiJson } from "./deepseek";
import type { Locale } from "@/lib/i18n";
import { SEED_TASKS } from "@/data/seed-tasks";

export interface UserTestContext {
  lastTestTitle?: string;
  totalAttempts?: number;
  correctAttempts?: number;
  scorePercent?: number;
  recentErrors?: Array<{
    prompt: string;
    userAnswer: string;
    correctAnswers: string[];
    explanation?: string;
  }>;
  topicTheoryContext?: {
    title: string;
    theory: string;
  };
}

export const krokkiTaskSchema = z.object({
  type: z.enum(["choice", "fill"]),
  prompt: z.string().min(5).max(300),
  options: z.array(z.string().min(1).max(100)).max(4).default([]),
  answers: z.array(z.string().min(1).max(100)).min(1).max(4),
  explanation: z.string().min(1).max(600),
  explanationRu: z.string().min(1).max(600),
});

export const krokkiGoalSchema = z.object({
  titleBe: z.string().min(2).max(100),
  titleRu: z.string().min(2).max(100),
  descriptionBe: z.string().min(5).max(300),
  theoryBe: z.string().min(10).max(2000).optional(),
  theoryRu: z.string().min(10).max(2000).optional(),
  category: z.enum(["vocabulary", "grammar", "competencies"]),
  tasks: z.array(krokkiTaskSchema).min(1).max(12),
});

export const krokkiChatResponseSchema = z.object({
  reply: z.string().min(1).max(2500),
  goal: krokkiGoalSchema.nullable().optional(),
});

export type KrokkiChatResponse = z.infer<typeof krokkiChatResponseSchema>;

const krokkiChatJsonSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    goal: {
      type: "object",
      properties: {
        titleBe: { type: "string" },
        titleRu: { type: "string" },
        descriptionBe: { type: "string" },
        theoryBe: { type: "string" },
        theoryRu: { type: "string" },
        category: { type: "string", enum: ["vocabulary", "grammar", "competencies"] },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["choice", "fill"] },
              prompt: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              answers: { type: "array", items: { type: "string" } },
              explanation: { type: "string" },
              explanationRu: { type: "string" },
            },
            required: ["type", "prompt", "options", "answers", "explanation", "explanationRu"],
          },
        },
      },
      required: ["titleBe", "titleRu", "descriptionBe", "theoryBe", "theoryRu", "category", "tasks"],
    },
  },
  required: ["reply"],
};

export function parseRequestedTaskCount(message: string): number {
  const match =
    message.match(/\b([1-9]|1[0-2])\s*(?:задан|пытан|вопрос|тэст|test|task)/i) ||
    message.match(/(?:складзі|згенеруй|составь|сделай|дай|хачу|хочу)\s*([1-9]|1[0-2])\b/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      return num;
    }
  }
  return 5;
}

export async function askKrokki(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  locale: Locale,
  userContext?: UserTestContext,
): Promise<KrokkiChatResponse> {
  const language = locale === "ru" ? "русском" : "белорусском";
  const targetCount = parseRequestedTaskCount(message);

  const testPerfText =
    userContext && userContext.totalAttempts && userContext.totalAttempts > 0
      ? `
RECENT TEST PERFORMANCE OF USER:
Апошні тэст: "${userContext.lastTestTitle ?? "Практыка"}"
Вынік: ${userContext.correctAttempts ?? 0} з ${userContext.totalAttempts} (${userContext.scorePercent ?? 0}%)
${
  userContext.recentErrors && userContext.recentErrors.length > 0
    ? `Памылкі вучня:\n${userContext.recentErrors
        .map(
          (e, idx) =>
            `${idx + 1}. Пытанне: "${e.prompt}" | Адказ вучня: "${e.userAnswer}" | Правільны адказ: "${e.correctAnswers.join(" / ")}" | Тлумачэнне: "${e.explanation ?? ""}"`,
        )
        .join("\n")}`
    : "Вучань не зрабіў ніводнай памылкі (100% правільных адказаў)!"
}
`
      : "";

  const theoryBlock = userContext?.topicTheoryContext
    ? `
TOPIC THEORY BASE PASSED FROM THE MODULE/TEST:
Тэма: "${userContext.topicTheoryContext.title}"
Тэкст тэорыі па тэме:
${userContext.topicTheoryContext.theory}
`
    : "";

  const prompt = `ROLE
Ты – Кроккі, вясёлы, разумны і спагадлівы маскот і рэпетытар платформы KROK для вывучэння беларускай мовы.
Ты размаўляеш па-сяброўску, з цеплынёй і падтрымкай. Не выкарыстоўвай эмодзі ў тэксце.
Ты можаш карыстацца інструментамі web_search і web_fetch, калі трэба праверыць дакладныя факты, правілы альбо лексіку.

${testPerfText}
${theoryBlock}

TASK
1. Адкажы на паведамленне карыстальніка на ${language} мове.
2. Калі перададзены блок TOPIC THEORY BASE PASSED FROM THE MODULE/TEST і карыстальнік хоча абмеркаваць гэтую тэму:
   - НЕ стварай новы тэст (пакінь "goal": null), калі карыстальнік пра гэта яўна не папрасіў.
   - Дай зразумелы, жывы разбор гэтай тэорыі, прывядзі яшчэ 2-3 яркія прыклады і прапануй задаць любое пытанне перад вяртаннем да тэсту.
3. Калі карыстальнік пытаецца, як ён здаў тэст, якія ў яго вынікі, просіць разабраць свае памылкі:
   - НЕ стварай новы тэст (пакінь "goal": null).
   - Выкарыстоўвай звесткі з блока RECENT TEST PERFORMANCE OF USER.
   - Пахвалі за поспехі, падрабязна і зразумела растлумач кожную памылку, чаму правільны адказ менавіта такі.
4. Калі карыстальнік просіць скласці заданні, тэст, практыкаванне альбо праверыць веды па нейкай тэме (напрыклад: пра ежу, адзенне, горад, падарожжы, прыроду, граматыку ці інш.):
   - Ствары РОЎНА ${targetCount} якасных заданняў па-беларуску і змясці іх у аб'ект "goal".
   - АБАВЯЗКОВА падрыхтуй у палях "theoryBe" (па-беларуску) і "theoryRu" (па-руску) кароткую, структураваную тэорыю па гэтай тэме (3–5 пунктаў з правіламі, ключавымі словамі і прыкладамі), якая будзе паказана вучню першай карткай перад пачаткам тэсту!
   - УСЕ заданні ў tasks ПАВІННЫ быць СТРОГА па тэме, якую запытаў карыстальнік!
5. Калі карыстальнік проста пытаецца пра правіла, пераклад ці размаўляе — дай зразумелы адказ, а поле "goal" пакінь null.

INPUT
Паведамленне: "${message}"
Гісторыя гутаркі: ${JSON.stringify(history.slice(-6))}

RULES
- Калі ствараеш goal:
  - titleBe і titleRu — тэматычная назва мэты.
  - theoryBe і theoryRu — кароткая тэорыя па тэме (правілы, слоўнік і прыклады), якая адкрываецца першай карткай перад тэстам.
  - category: "vocabulary", "grammar" альбо "competencies".
  - tasks: роўна ${targetCount} заданняў choice альбо fill, строга адпаведных запытанай тэме.
  - У choice правільны адказ абавязкова павінен уваходзіць у options.
  - Тэкст саміх заданняў і варыянтаў пішы па-беларуску.
  - Тлумачэнні explanation пішы па-беларуску, explanationRu — па-руску.

OUTPUT
Вярні JSON з палямі reply і goal (аб'ект ці null).`;

  try {
    const result = await askAiJson(prompt, krokkiChatJsonSchema, krokkiChatResponseSchema, {
      enableWebTools: true,
    });
    if (result.ok) {
      return result.data;
    }
  } catch (err) {
    console.warn("Krokki DeepSeek call failed, applying fallback:", err);
  }

  // если дипсик отвалился или нет ключа то отдаем заготовленные ответы чтоб чат не падал
  if (userContext?.topicTheoryContext) {
    const { title, theory } = userContext.topicTheoryContext;
    return {
      reply:
        locale === "ru"
          ? `Давай разберём тему «${title}»!\n\nВот ключевые моменты из подготовленной теории:\n${theory}\n\nЗадавай любой вопрос по правилам или примерам — я с радостью объясню проще. А когда будешь готов, нажми кнопку «Вернуться к тесту» сверху!`
          : `Давай разбяром тэму «${title}»!\n\nВось ключавыя моманты з падрыхтаванай тэорыі:\n${theory}\n\nЗадавай любое пытанне па правілах альбо прыкладах — я з радасцю растлумачу прасцей. А калі будзеш гатовы, націсні кнопку «Вярнуцца да тэсту» зверху!`,
      goal: null,
    };
  }

  const isAskingAboutResults =
    /(як я здаў|як я напісаў|як тэст|як мае вынікі|якія памылкі|разбяры памылкі|как я сдал|как я написал|как тест|как мои результаты|какие ошибки|разбери ошибки|что не так|мой результат|мои результаты)/i.test(
      message,
    );

  if (isAskingAboutResults) {
    if (userContext && userContext.totalAttempts && userContext.totalAttempts > 0) {
      const {
        lastTestTitle,
        correctAttempts = 0,
        totalAttempts,
        scorePercent = 0,
        recentErrors = [],
      } = userContext;

      if (recentErrors.length === 0) {
        return {
          reply:
            locale === "ru"
              ? `Отличная работа! В тесте «${lastTestTitle ?? "Практика"}» ты ответил верно на все ${totalAttempts} из ${totalAttempts} заданий (${scorePercent}%)! Ни одной ошибки. Так держать!`
              : `Выдатная праца! У тэсце «${lastTestTitle ?? "Практыка"}» ты адказаў дакладна на ўсе ${totalAttempts} з ${totalAttempts} заданняў (${scorePercent}%)! Ніводнай памылкі. Так трымаць!`,
          goal: null,
        };
      }

      const errorsList = recentErrors
        .map((err, i) =>
          locale === "ru"
            ? `${i + 1}. В задании «${err.prompt}» твой ответ был: «${err.userAnswer}», а правильный: «${err.correctAnswers.join(" / ")}». ${err.explanation ? `Пояснение: ${err.explanation}` : ""}`
            : `${i + 1}. У заданні «${err.prompt}» твой адказ быў: «${err.userAnswer}», а правільны: «${err.correctAnswers.join(" / ")}». ${err.explanation ? `Тлумачэнне: ${err.explanation}` : ""}`,
        )
        .join("\n\n");

      return {
        reply:
          locale === "ru"
            ? `Ты завершил тест «${lastTestTitle ?? "Практика"}» с результатом ${correctAttempts} из ${totalAttempts} (${scorePercent}%).\n\nДавай разберем твои ошибки:\n\n${errorsList}\n\nНе переживай, разбор ошибок — лучший способ учиться! Готов разобрать что-то подробнее?`
            : `Ты завяршыў тэст «${lastTestTitle ?? "Практыка"}» з вынікам ${correctAttempts} з ${totalAttempts} (${scorePercent}%).\n\nДавай разбяром твае памылкі:\n\n${errorsList}\n\nНе хвалюйся, разбор памылак — найлепшы спосаб вучыцца! Ці хочаш разабраць нешта падрабязней?`,
        goal: null,
      };
    }

    return {
      reply:
        locale === "ru"
          ? "Пока я не вижу недавно пройденных тестов в твоем профиле. Открой вкладку «Цели» или попроси меня: «Крокки, составь мне 5 заданий на падежи», и давай проверим твои знания!"
          : "Пакуль я не бачу нядаўна пройдзеных тэстаў у тваім профілі. Адкрый укладку «Мэты» альбо папрасі мяне: «Кроккі, складзі мне 5 заданняў на склоны», і давай праверым твае веды!",
      goal: null,
    };
  }

  const wantsTasks =
    /(тэст|заданн|тэсты|тэсцік|практык|складзі|згенеруй|тест|задани|составь|сделай|потрениру)/i.test(message);

  if (wantsTasks) {
    const count = Math.min(targetCount, 10);
    const pool = SEED_TASKS.filter((t) => !t.isDiagnostic && (t.type === "choice" || t.type === "fill"));
    const sampleTasks = [];
    for (let i = 0; i < count; i++) {
      const task = pool[i % pool.length];
      sampleTasks.push({
        type: (task.type === "fill" ? "fill" : "choice") as "choice" | "fill",
        prompt: task.prompt,
        options: task.options ?? ["Варыянт 1", "Варыянт 2", "Варыянт 3"],
        answers: task.answers ?? [],
        explanation: task.explanation ?? "Правільны адказ з нашай базы.",
        explanationRu: task.explanationRu ?? "Правильный ответ из базового банка заданий.",
      });
    }

    return {
      reply:
        locale === "ru"
          ? `Я подготовил для тебя краткую теорию и тренировочный тест из ${count} заданий! Нажми «Перейти к тесту» — первой карточкой откроется краткая памятка по теме.`
          : `Я падрыхтаваў для цябе кароткую тэорыю і трэніровачны тэст з ${count} заданняў! Націсні «Перайсці да тэсту» — першай карткай адкрыецца кароткая памятка па тэме.`,
      goal: {
        titleBe: `Трэніровачны тэст ад Кроккі (${count} заданняў)`,
        titleRu: `Тренировочный тест от Крокки (${count} заданий)`,
        descriptionBe: "Кароткая тэорыя і практычныя заданні для замацавання тэмы.",
        theoryBe:
          "Кароткая тэорыя перад тэстам:\n• Уважліва чытайце ўмову сказа і звяртайце ўвагу на час дзеяслова (учора — мінулы час з суфіксам -ў/-лі, заўтра — будучы час).\n• Пасля слова «няма» назоўнікі ставяцца ў родным склоне (каго? чаго?).\n• Часціца «не» з дзеясловамі пішацца асобна.",
        theoryRu:
          "Краткая теория перед тестом:\n• Внимательно читайте контекст предложения и обращайте внимание на время глагола («учора» — прошедшее время с суффиксом -ў/-лі, «заўтра» — будущее время).\n• После слова «няма» (нет) существительные ставятся в родительном падеже (каго? чаго?).\n• Частица «не» с глаголами пишется раздельно.",
        category: "grammar",
        tasks: sampleTasks,
      },
    };
  }

  return {
    reply:
      locale === "ru"
        ? "Привет! Я Крокки. Я всегда готов помочь тебе с белорусским языком! Ты можешь спросить у меня любое правило, обсудить теорию из урока или попросить составить тест на любую тему (например: «Крокки, составь 5 заданий про еду»)."
        : "Прывітанне! Я Кроккі. Я заўсёды гатовы дапамагчы табе з беларускай мовай! Ты можаш спытаць у мяне любое правіла, абмеркаваць тэорыю з урока альбо папрасіць скласці тэст на любую тэму (напрыклад: «Кроккі, складзі 5 заданняў пра ежу»).",
    goal: null,
  };
}
