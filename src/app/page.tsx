import { Unbounded } from "next/font/google";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Footer } from "@/components/footer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChartLine,
  faRotateRight,
  faCompass,
  faBullseye,
} from "@fortawesome/free-solid-svg-icons";

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: "700",
  display: "swap",
  variable: "--font-unbounded",
});

export default async function HomePage() {
  const locale = await getLocale();
  if (await getCurrentUser()) redirect("/dashboard");

  const isRu = locale === "ru";

  return (
    <div className={`landing-page ${unbounded.variable}`}>
      <section className="landing-hero-wrapper">
        <div className="landing-hero">
          <div className="hero-content">
            

            <h1 className="hero-title">
              {isRu ? "Шаг за шагом к своему языку" : "Крок за крокам да сваёй мовы"}
            </h1>

            <p className="hero-lead">
              {isRu
                ? "Крок не заставляет проходить шаблонные уроки для всех подряд. Умная система вычисляет, какие навыки вам нужнее всего прямо сейчас, и ведёт к уверенному владению без зубрёжки."
                : "Крок не прымушае праходзіць шаблонныя ўрокі для ўсіх запар. Разумная сістэма вылічвае, якія навыкі вам найбольш патрэбныя прама зараз, і вядзе да ўпэўненага валодання без завучвання."}
            </p>

            <div className="hero-actions">
              <Link href="/register" className="hero-btn-primary">
              {t(locale, "home.start")}
              </Link>
              <Link href="/login" className="hero-btn-secondary">
                {t(locale, "home.login")}
              </Link>
            </div>

            <div className="hero-trust">
              <div className="hero-trust-item">
                <FontAwesomeIcon icon={faCheck} />
                <span>{isRu ? "Максимум практики" : "Максімум практыкі"}</span>
              </div>
              <div className="hero-trust-item">
                <FontAwesomeIcon icon={faCheck} />
                <span>{isRu ? "Не требует установки" : "Не патрабуе ўстаноўкі"}</span>
              </div>
              <div className="hero-trust-item">
                <FontAwesomeIcon icon={faCheck} />
                <span>{isRu ? "Объяснит всё, что пожелаете" : "Растлумачыць усё, што пажадаеце"}</span>
              </div>
            </div>
          </div>


          <div className="hero-image-wrap">
            <Image
              src="/illustr_glavnaya1.svg"
              alt="Парни дико радуются, что у них есть КРОК − изучение белорусского языка, радуйтесь и вы!!"
              width={500}
              height={500}
              priority
              className="hero-illustr"
            />
          </div>
        </div>
      </section>


      <div className="landing-container">
        <section className="landing-split">
        <div className="split-card-visual">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="tag" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 }}>
              {isRu ? "СЕГОДНЯШНИЙ КРОК" : "СЁННЯШНІ КРОК"}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>~10 {isRu ? "мин" : "хв"}</span>
          </div>

          <h3 style={{ fontSize: 20, margin: "0 0 6px" }}>
            {isRu ? "Грамматика: прошедшее время" : "Граматыка: прошлы час"}
          </h3>
          <p className="muted" style={{ fontSize: 14, margin: "0 0 16px" }}>
            <strong>{isRu ? "Почему это?" : "Чаму гэта?"}</strong>{" "}
            {isRu
              ? "В прошлый раз здесь была ошибка. Стоит закрепить правило."
              : "Ты апошні раз памыліўся ў гэтай тэме. Варта замацаваць правіла."}
          </p>

          <div style={{ padding: 16, background: "var(--bg-subtle)", borderRadius: 12, border: "1px solid var(--line)" }}>
            <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 15 }}>
              Учора я ___ у кіно.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ padding: "8px 12px", background: "var(--card)", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, color: "var(--muted)" }}>
                A. іду
              </div>
              <div style={{ padding: "8px 12px", background: "var(--success-bg)", borderRadius: 8, border: "2px solid var(--success-border)", fontSize: 14, fontWeight: 600, color: "var(--success-text)", display: "flex", justifyContent: "space-between" }}>
                <span>B. хадзіў</span>
                <span>✓ {isRu ? "Верно" : "Правільна"}</span>
              </div>
              <div style={{ padding: "8px 12px", background: "var(--card)", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, color: "var(--muted)" }}>
                C. пайду
              </div>
            </div>
          </div>
        </div>

        <div className="split-copy">
          <span className="section-kicker">
            {isRu ? "ЧТО САМОЕ КЛАССНОЕ?" : "ЧТО САМАЕ ЛЕПШАЕ?"}
          </span>
          <h2>
            {isRu
              ? "Персональная программа вместо тонны сухого текста"
              : "Персанальная праграма замест тоны сухога тэксту"}
          </h2>
          <p>
            {isRu
              ? "Учить язык гораздо проще, когда система не гоняет по темам, которые вы и так знаете. Крок выявляет пробелы, бережно хранит ошибки и вовремя возвращает их на повторение."
              : "Вучыць мову значна прасцей, калі сістэма не прымушае паўтараць тое, што ты і так ведаеш. Крок выяўляе прабелы, беражліва захоўвае памылкі і своечасова вяртае іх на паўтарэнне."}
          </p>

          <ul className="split-checklist">
            <li className="split-check-item">
              <span className="check-icon"><FontAwesomeIcon icon={faCheck} /></span>
              <span>
                <strong>{isRu ? "Диагностика:" : "Дыягностыка:"}</strong>{" "}
                {isRu ? "короткая оценка для старта, чтобы выяыить пробелы в знаниях." : "кароткая ацэнка для старту, каб выявіць прабелы ў ведах."}
              </span>
            </li>
            <li className="split-check-item">
              <span className="check-icon"><FontAwesomeIcon icon={faCheck} /></span>
              <span>
                <strong>{isRu ? "Крок Score:" : "Крок Score:"}</strong>{" "}
                {isRu ? "следующий шаг подбирается по результатам ваших ответов." : "наступны крок падбіраецца па выніках вашых адказаў."}
              </span>
            </li>
            <li className="split-check-item">
              <span className="check-icon"><FontAwesomeIcon icon={faCheck} /></span>
              <span>
                <strong>{isRu ? "Умные повторения:" : "Разумныя паўтарэнні:"}</strong>{" "}
                {isRu ? "правила возвращаются через 1, 3 и 7 дней для закрепления в памяти." : "правілы вяртаюцца праз 1, 3 і 7 дзён для замацавання ў памяці."}
              </span>
            </li>
          </ul>

          <Link href="/register" className="btn">
            {isRu ? "Попробовать бесплатно" : "Паспрабаваць бясплатна"}
          </Link>
        </div>
      </section>
      

      <section className="landing-section">
        <div className="section-head">
          <span className="section-kicker">
            {isRu ? "ВОЗМОЖНОСТИ КРОК" : "МАЖЛЫВАСЦІ КРОК"}
          </span>
          <h2 className="section-title">
            {isRu ? "Тут есть всё для комфортной и живой практики" : "Тут ёсць усё для камфортнай і жывой практыкі"}
          </h2>
          <p className="section-desc">
            {isRu
              ? "С учителями собрали для вас всё, что сделает самостоятельное изучение максимально эффективным. Например:"
              : "Разам з настаўнікамі сабралі ўсё, што зробіць самастойнае вывучэнне максімальна эфектыўным. Напрыклад:"}
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-badge badge-green">
              <Image src="/krokki.svg" alt="Кроккі" width={32} height={32} style={{ width: "32px", height: "32px" }} />
            </div>
            <h3>{isRu ? "AI-помощник «Крокки»" : "AI-памочнік «Кроккі»"}</h3>
            <p>
              {isRu
                ? "Спросите любое правило, перевод или попросите составить мини-тест на интересную тему прямо в чате."
                : "Спытайце любое правіла, пераклад або папрасіце скласці міні-тэст на патрэбную тэму проста ў чаце."}
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-badge badge-purple">
              <Image
                src="/pwaikonka.png"
                alt="PWA"
                width={34}
                height={13}
                className="pwa-icon-light"
                style={{ width: "34px", height: "auto" }}
              />
              <Image
                src="/pwaikonkawht.png"
                alt="PWA"
                width={34}
                height={13}
                className="pwa-icon-dark"
                style={{ width: "34px", height: "auto" }}
              />
            </div>
            <h3>{isRu ? "PWA-приложение" : "PWA-праграма"}</h3>
            <p>
              {isRu
                ? "Не требуется установка на смартфон. Просто добавляете ярлык сайта на главный экран и получаете все преимущества приложений!"
                : "Не патрабуецца ўстаноўка на смартфон. Проста дадайце ярлык сайта на галоўны экран і атрымлівайце ўсе перавагі праграм!"}
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-badge badge-blue">
              <FontAwesomeIcon icon={faChartLine} />
            </div>
            <h3>{isRu ? "Крок Score" : "Крок Score"}</h3>
            <p>
              {isRu
                ? "Умная формула учитывает слабые места, историю ошибок и прошедшее время, чтобы предлагать следующие задания."
                : "Разумная формула ўлічвае слабыя месцы, гісторыю памылак і мінулы час, каб прапанаваць наступныя заданні."}
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-badge badge-amber">
              <FontAwesomeIcon icon={faRotateRight} />
            </div>
            <h3>{isRu ? "Интервальные повторения" : "Інтэрвальныя паўтарэнні"}</h3>
            <p>
              {isRu
                ? "Темы автоматически возвращаются через 1, 3 и 7 дней, чтобы закреплять слова и правила в долговременной памяти."
                : "Тэмы аўтаматычна вяртаюцца праз 1, 3 і 7 дзён, каб замацоўваць словы і правілы ў доўгатэрміновай памяці."}
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-badge badge-rose">
              <FontAwesomeIcon icon={faCompass} />
            </div>
            <h3>{isRu ? "Журнал «Мои ошибки»" : "Журнал «Мае памылкі»"}</h3>
            <p>
              {isRu
                ? "Все неверные ответы сохраняются с пояснением, чтобы вы точно смогли проработать проблемные темы."
                : "Усе памылкі захоўваюцца, каб вы маглі прапрацаваць цяжкія моманты і больш не блытацца."}
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-badge badge-teal">
              <FontAwesomeIcon icon={faBullseye} />
            </div>
            <h3>{isRu ? "Персональные цели" : "Персанальныя мэты"}</h3>
            <p>
              {isRu
                ? "Попросите у Крокки то, что интересно именно вам: от разговоров в магазине и путешествий до названий станций метро."
                : "Папрасіце ў Кроккі тое, што цікава менавіта вам: ад размоваў у краме і падарожжаў да назваў станцый метро."}
            </p>
          </div>
        </div>
      </section>

      <section className="landing-split reversed">
        <div className="split-copy">
          <span className="section-kicker">
            {isRu ? "ЛИЧНЫЙ AI-РЕПЕТИТОР" : "АСАБІСТЫ AI-РЭПЕТЫТАР"}
          </span>
          <h2>
            {isRu ? "Знакомьтесь, Крокки − ваш спутник!" : "Знаёмся, Кроккі − ваш спадарожнік!"}
          </h2>
          <p>
            {isRu
              ? "Клёвый маскот платформы всегда подскажет, когда пишется «ў», а когда «у», разберёт сложные падежи и составит персональный мини-тест по вашему запросу."
              : "Круты маскот платформы заўсёды падкажа, калі пішацца «ў», а калі «у», разбярэ складаныя склоны і складзе персанальны міні-тэст па запыце."}
          </p>

          <ul className="split-checklist">
            <li className="split-check-item">
              <span className="check-icon"><FontAwesomeIcon icon={faCheck} /></span>
              <span>
                {isRu ? "Объяснит любое правило простыми словами" : "Патлумачыць любое правіла простымі словамі"}
              </span>
            </li>
            <li className="split-check-item">
              <span className="check-icon"><FontAwesomeIcon icon={faCheck} /></span>
              <span>
                {isRu ? "Составит любой тест: например, «Крокки, подготовь меня, хочу 5 заданий про еду»" : "Складзе любы тэст: напрыклад, «Крокі, падрыхтуй мяне, хачу 5 заданняў пра ежу»"}
              </span>
            </li>
            <li className="split-check-item">
              <span className="check-icon"><FontAwesomeIcon icon={faCheck} /></span>
              <span>
                {isRu ? "Проверит открытые вопросы и пояснит, если что-то не так" : "Праверыць адкрытыя пытанні і растлумачыць, калі нешта не так"}
              </span>
            </li>
          </ul>

          <Link href="/register" className="btn">
            {isRu ? "Поболтать с Крокки" : "Пагутарыць з Кроккі"}
          </Link>
        </div>

        <div className="split-card-visual" style={{ background: "var(--bg-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Image src="/krokki.svg" alt="Кроккі" width={52} height={52} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Кроккі</div>
              <div className="muted" style={{ fontSize: 13 }}>AI-маскот Крок</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ alignSelf: "flex-end", background: "var(--accent)", color: "#fff", padding: "10px 14px", borderRadius: "14px 14px 2px 14px", fontSize: 14, maxWidth: "85%" }}>
              {isRu ? "Крокки, когда пишется «ў», а когда «у»?" : "Кроккі, калі пішацца «ў», а калі «у»?"}
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "12px 14px", borderRadius: "14px 14px 14px 2px", fontSize: 14, maxWidth: "90%", lineHeight: 1.5 }}>
              {isRu ? (
                <>
                  Буква <strong>«ў»</strong> пишется после гласных: <em>«была ў кіно»</em>, <em>«пайшоў дахаты»</em>. После согласных и в начале предложения всегда пишем <strong>«у»</strong>: <em>«у школе»</em>.
                </>
              ) : (
                <>
                  Літара <strong>«ў»</strong> пішацца пасля галосных: <em>«была ў кіно»</em>, <em>«пайшоў дахаты»</em>. Пасля зычных і на пачатку сказа заўсёды пішам <strong>«у»</strong>: <em>«у школе»</em>.
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="stats-strip">
        <div className="stat-item">
          <span className="stat-item-num">29+</span>
          <span className="stat-item-label">{isRu ? "Языковых навыков" : "Моўных навыкаў"}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-num">3</span>
          <span className="stat-item-label">{isRu ? "Формата заданий" : "Фарматы заданняў"}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-num">5–30</span>
          <span className="stat-item-label">{isRu ? "Минут практики в день" : "Хвілін практыкі ў дзень"}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-num">100%</span>
          <span className="stat-item-label">{isRu ? "Бесплатно и открыто" : "Бясплатна і адкрыта"}</span>
        </div>
      </div>

      <section className="landing-section">
        <div className="section-head">
          <span className="section-kicker">
            {isRu ? "КАК ВСЁ РАБОТАЕТ" : "ЯК УСЁ ПРАЦУЕ"}
          </span>
          <h2 className="section-title">
            {isRu ? "Три простых шага к свободной речи" : "Тры простыя крокі да свабоднай размовы"}
          </h2>
          <p className="section-desc">
            {isRu
              ? "Начать реально легко! А главное бесплатно и интересно."
              : "Пачаць рэальна лёгка! А галоўнае бясплатна і цікава."}
          </p>
        </div>

        <div className="steps-row">
          <div className="step-card">
            <span className="step-number">01</span>
            <h3>{isRu ? "Настройте цель" : "Наладзь мэту"}</h3>
            <p>
              {isRu
                ? "Выберите, сколько минут готовы заниматься, и пройдите вводный тест, чтобы алгоритм нашёл темы, которые стоит подучить."
                : "Выберыце, колькі хвілін гатовы займацца, і прайдзіце ўступны тэст, каб алгарытм знайшоў тэмы, якія варта падвучыць."}
            </p>
          </div>

          <div className="step-card">
            <span className="step-number">02</span>
            <h3>{isRu ? "Делайте свой КРОК" : "Рабіце свой КРОК"}</h3>
            <p>
              {isRu
                ? "Каждый день решайте короткие упражнения, а алгоритм отметит усвоенное и предложит новые темы."
                : "Кожны дзень вырашайце кароткія практыкаванні, а алгарытм адзначыць засвоенае і прапануе новыя тэмы."}
            </p>
          </div>

          <div className="step-card">
            <span className="step-number">03</span>
            <h3>{isRu ? "Следите за ростом" : "Сачыце за ростам"}</h3>
            <p>
              {isRu
                ? "Наблюдайте, как растут показатели освоения тем, прорабатывайте ошибки и продолжайте практиковаться."
                : "Назірайце, як растуць паказчыкі засваення тэм, прапрацоўвайце памылкі і працягвайце практыкавацца."}
            </p>
          </div>
        </div>
      </section>

      <section className="landing-cta-banner">
        <div className="cta-banner-content">
          <h2 className="cta-banner-title">
            {isRu ? "Готовы сделать свой первый шаг?" : "Гатовы зрабіць свой першы крок?"}
          </h2>
          <p className="cta-banner-desc">
            {isRu
              ? "Тогда скорей создайте профиль или войдите в существующий, чтобы попробовать адаптивное обучение уже сейчас."
              : "Тады хутчэй стварыце профіль ці ўвайдзіце ў існуючы, каб паспрабаваць адаптыўнае навучанне ўжо зараз."}
          </p>

          <div className="cta-banner-buttons">
            <Link href="/register" className="btn-white">
              {t(locale, "home.start")}
            </Link>
            <Link href="/login" className="btn-outline-white">
              {t(locale, "home.login")}
            </Link>
          </div>
        </div>
      </section>


      <Footer locale={locale} />
      </div>
    </div>
  );
}
