"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Crown, Download, Feather, LoaderCircle, MessageSquare, RotateCcw, Send, ShieldCheck, Volume2, VolumeX, X } from "lucide-react";
import { monologue, suggestedQuestions } from "@/content/intro";

type Message = { role: "user" | "assistant"; content: string };
type Screen = "home" | "intro" | "chat";
const storageKey = "ivan-iv-conversation-v1";
const staticPreview = process.env.NEXT_PUBLIC_STATIC_PREVIEW === "true";
const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
const chatApi = process.env.NEXT_PUBLIC_CHAT_API_URL || asset("/api/chat");
const chatAvailable = !staticPreview || Boolean(process.env.NEXT_PUBLIC_CHAT_API_URL);

function Ornament({ small = false }: { small?: boolean }) {
  return <span className={`ornament ${small ? "small" : ""}`} aria-hidden="true"><i />✧<i /></span>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean; materialsApproved: boolean } | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoMissing, setVideoMissing] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [modal, setModal] = useState<"about" | "reset" | null>(null);
  const [saved, setSaved] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const screenTitle = useRef<HTMLHeadingElement>(null);
  const session = useRef("");
  const sending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    session.current = crypto.randomUUID();
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length <= 22 && parsed.length % 2 === 0 && parsed.every((m, i) => m && m.role === (i % 2 === 0 ? "user" : "assistant") && typeof m.content === "string" && m.content.length <= 5000)) setMessages(parsed);
      }
    } catch { setStorageWarning("Браузер не смог восстановить беседу. Скачивай её перед закрытием страницы."); }
    setReady(true);
    if (!chatAvailable) setStatus({ configured: false, materialsApproved: false });
    else fetch(chatApi).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setStatus).catch(() => setStatus({ configured: false, materialsApproved: false }));
    return () => controller.current?.abort();
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); }
    catch { setStorageWarning("Беседа не сохраняется в этом браузере. Используй кнопку «Сохранить беседу»."); }
  }, [messages, ready]);

  useEffect(() => {
    if (root.current?.querySelector("[data-reveal]") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const ctx = gsap.context(() => { gsap.fromTo("[data-reveal]", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .1, ease: "power2.out", clearProps: "all" }); }, root);
      return () => ctx.revert();
    }
  }, [screen]);

  useEffect(() => { if (screen === "chat") end.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [messages, loading, screen]);
  useEffect(() => { if (screen !== "home") screenTitle.current?.focus(); }, [screen]);
  useEffect(() => {
    if (modal) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      previousFocus.current?.focus();
    }
  }, [modal]);

  async function send(value = draft) {
    if (!chatAvailable) { setError("В этой тестовой публикации ИИ-чат ещё не подключён к серверу."); return; }
    const question = value.trim();
    if (!question || question.length > 1000 || sending.current) return;
    if (messages.length >= 20) { setError("Достигнут предел беседы: сохрани её и начни новую."); return; }
    sending.current = true; setLoading(true); setError(""); setDraft(question);
    controller.current = new AbortController();
    const timeout = setTimeout(() => controller.current?.abort(), 30000);
    try {
      const response = await fetch(chatApi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [...messages, { role: "user", content: question }], session: session.current }), signal: controller.current.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось получить ответ.");
      if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("Получен пустой ответ. Попробуй снова.");
      setMessages(previous => [...previous, { role: "user", content: question }, { role: "assistant", content: data.answer }]);
      setDraft("");
    } catch (e) { setError(e instanceof Error && e.name !== "AbortError" ? e.message : "Время ожидания истекло. Вопрос сохранён — попробуй ещё раз."); }
    finally { clearTimeout(timeout); sending.current = false; setLoading(false); input.current?.focus(); }
  }

  function download() {
    const text = ["Исповедь Ивана Грозного", "Учебная ИИ-реконструкция. Ответы требуют проверки по источникам.", new Date().toLocaleString("ru-RU"), "", ...messages.map(m => `${m.role === "user" ? "Ученик" : "Иван IV (ИИ)"}: ${m.content}\n`)].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "Беседа-с-Иваном-IV.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  function goChat() { setScreen("chat"); }

  return <div ref={root} className={`site screen-${screen}`}>
    <a className="skip-link" href="#main">К содержимому</a>
    <header className="header">
      <button className="brand" onClick={() => setScreen("home")} aria-label="На главную"><span className="brand-mark"><Crown size={23} strokeWidth={1.2} /></span><span>ИВАН ВАСИЛЬЕВИЧ<small>БЕСЕДА О РУСИ XVI ВЕКА</small></span></button>
      <nav aria-label="Основная навигация"><span className="lesson-label">ИСТОРИЯ <b>×</b> ИНФОРМАТИКА</span><span className="grade">7 КЛАСС</span><button className="about-button" onClick={() => setModal("about")}><BookOpen size={16} /> Об уроке</button></nav>
    </header>

    <main id="main">
      {screen === "home" && <>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow" data-reveal><span /> МОСКВА · XVI ВЕК</div>
            <h1 data-reveal>Исповедь<br />Ивана <em>Грозного</em></h1>
            <Ornament />
            <p className="lead" data-reveal>Многое о моих делах сказано.<br />Теперь спрашивай сам.</p>
            <p className="hero-description" data-reveal>О Судебнике и опричнине,<br className="desktop-break" /> о войнах и жизни на Руси.</p>
            <div className="hero-actions" data-reveal><button className="primary" onClick={() => { setVideoMissing(false); setScreen("intro"); }}>Войти в палаты <ArrowRight size={19} /></button><button className="text-link" onClick={goChat}>Спросить государя <ChevronRight size={16} /></button></div>
            <div className="hero-note" data-reveal><ShieldCheck size={16} /><span>Учебная ИИ-реконструкция<br /><small>Ответы создаёт нейросеть, а не исторический источник</small></span></div>
          </div>
          <div className="hero-art" data-reveal>
            <span className="art-corner top-left" /><span className="art-corner top-right" /><span className="art-corner bottom-left" /><span className="art-corner bottom-right" />
            {/* The supplied reference is explicitly identified as an illustration. */}
            <img src={asset("/media/ivan-reference.png")}  alt="Иллюстративный портрет Ивана IV в узорчатой одежде и меховой шапке" className="portrait" />
            <div className="portrait-caption"><span>ИВАН IV ВАСИЛЬЕВИЧ</span><small>1533–1584 · годы правления</small></div>
            <span className="art-label">ХУДОЖЕСТВЕННЫЙ ПОРТРЕТ</span>
          </div>
          <span className="vertical-note">МОСКОВСКОЕ ЦАРСТВО</span>
        </section>
        <section className="journey" aria-label="Как проходит разговор">
          <div className="journey-title"><span>ПОРЯДОК<br />БЕСЕДЫ</span><ArrowDown size={20} strokeWidth={1} /></div>
          <div><span className="step-number">01</span><div><h2>Послушай государя</h2><p>Краткое обращение<br />перед началом беседы.</p></div></div>
          <div><span className="step-number">02</span><div><h2>Спроси о делах</h2><p>О законах, походах<br />и царском дворе.</p></div></div>
          <div><span className="step-number">03</span><div><h2>Сверь с источниками</h2><p>Сопоставь ответ с учебником<br />и записями историков.</p></div></div>
        </section>
      </>}

      {screen === "intro" && <section className="intro-page">
        <div className="intro-heading"><div><span className="eyebrow">СЛОВО ПЕРЕД БЕСЕДОЙ</span><h1 tabIndex={-1} ref={screenTitle}>Прежде послушай</h1></div><button className="text-link" onClick={goChat}>Пропустить вступление <ArrowRight size={18} /></button></div>
        <div className="intro-frame">
          {!videoMissing && <video autoPlay playsInline controls muted={muted} poster={asset("/media/ivan-reference.png")}  onError={() => setVideoMissing(true)} onEnded={goChat}>
            <source src={asset("/media/intro.mp4")}  type="video/mp4" onError={() => setVideoMissing(true)} />
            <track kind="captions" src={asset("/media/intro.ru.vtt")}  srcLang="ru" label="Русские" default />
          </video>}
          {videoMissing && <div className="intro-fallback"><span className="eyebrow">АУДИОВЕРСИЯ ВСТУПЛЕНИЯ</span><h2 className="audio-intro-title">Слово Ивана Васильевича</h2><figure className="audio-intro-poster"><img src={asset("/media/ivan-gpt-image-2.6-v1.png")}  alt="Статичный ИИ-кадр: Иван IV сидит за столом в царских палатах" /><figcaption>Художественный образ Ивана IV</figcaption></figure><audio className="intro-audio" controls preload="metadata" aria-label="Аудиоверсия вступления: синтетический голос Ивана IV" onError={() => setAudioUnavailable(true)}><source src={asset("/media/intro-voice-v1.mp3")}  type="audio/mpeg" />Браузер не поддерживает воспроизведение аудио. Текст обращения доступен ниже.</audio>{audioUnavailable && <p role="status">Не удалось загрузить озвучку. Прочитай текст обращения ниже или перейди к вопросам.</p>}<p className="audio-intro-note">Нажми воспроизведение, чтобы послушать. Голос создан нейросетью; изображение неподвижно.</p><Ornament /><blockquote>{monologue}</blockquote><p>Это художественная реконструкция, а не подлинная речь Ивана IV. Текст ожидает проверки учителем истории.</p><button className="primary" onClick={goChat}>Начать разговор <ArrowRight size={18} /></button></div>}
          {!videoMissing && <button className="sound-button" onClick={() => setMuted(!muted)} aria-label={muted ? "Включить звук" : "Выключить звук"}>{muted ? <VolumeX /> : <Volume2 />}</button>}
        </div>
        <p className="intro-disclaimer">Голос персонажа — художественный приём. Исторические выводы делай на основе источников.</p>
      </section>}

      {screen === "chat" && <section className="conversation">
        <aside className="character" data-reveal>
          <button className="back-link" onClick={() => setScreen("home")}><ArrowLeft size={16} /> В начало</button>
          <img src={asset("/media/ivan-reference.png")}  alt="Художественный портрет Ивана IV" />
          <div className="character-info"><Ornament small /><h2>Иван IV</h2><p>Васильевич Грозный</p><span>Великий князь с 1533 года<br />Царь всея Руси с 1547 года</span><small>Художественный портрет · ИИ отвечает текстом</small></div>
        </aside>
        <div className="chat-panel" data-reveal>
          <div className="chat-heading"><div><span className="eyebrow">В ЦАРСКИХ ПАЛАТАХ</span><h1 tabIndex={-1} ref={screenTitle}>Спроси государя</h1></div><Feather className="heading-feather" size={32} strokeWidth={1} /></div>
          <div className="chat-status"><span className={`status-dot ${status?.configured ? "connected" : ""}`} />{status === null ? "Проверяем подключение…" : status.configured ? "Можно начать беседу" : "ИИ пока не подключён"}<span className="status-divider">/</span><span>Ответы письменно</span></div>
          <div className="messages" role="log" aria-label="Переписка с Иваном IV" aria-live="polite" aria-relevant="additions" aria-busy={loading}>
            {messages.length === 0 && <div className="empty-chat"><span className="quill-mark"><Feather size={28} strokeWidth={1.1} /></span><h2>О чём желаешь спросить?</h2><p>О моих законах, походах или царском дворе.<br />Спрашивай; если неясно — уточни.</p><div className="suggestions">{suggestedQuestions.map((q, i) => <button key={q} disabled={loading} onClick={() => { setDraft(q); input.current?.focus(); }}><span>0{i + 1}</span>{q}<ArrowRight size={15} /></button>)}</div></div>}
            {messages.map((message, i) => <article className={`message ${message.role}`} key={i}><span className="message-author">{message.role === "user" ? "ТВОЙ ВОПРОС" : "ИВАН IV · ИИ-РЕКОНСТРУКЦИЯ"}</span><p>{message.content}</p>{message.role === "assistant" && <small>Проверь утверждения по историческим источникам.</small>}</article>)}
            {loading && <div className="pending"><p><span>Твой вопрос</span>{draft}</p><div><LoaderCircle size={17} className="spin" /> Государь готовит ответ…</div></div>}
            <div ref={end} />
          </div>
          <div className="composer-area">
            {error && <div className="error" role="alert"><p>{error}</p><button onClick={() => send()} disabled={loading || !draft.trim()}>Повторить отправку <RotateCcw size={14} /></button></div>}
            {storageWarning && <p className="storage-warning" role="status">{storageWarning}</p>}
            <form onSubmit={event => { event.preventDefault(); void send(); }} className="composer"><label className="sr-only" htmlFor="question">О чём спросишь государя?</label><textarea ref={input} id="question" placeholder="О чём спросишь государя?" value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} disabled={loading} rows={2} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} /><button type="submit" className="send-button" disabled={!chatAvailable || loading || !draft.trim() || !ready} aria-label="Отправить вопрос">{loading ? <LoaderCircle size={20} className="spin" /> : <Send size={20} />}</button></form>
            <div className="composer-hint"><span>Enter — отправить · Shift+Enter — новая строка</span><span>{draft.length} / 1000</span></div>
            <div className="conversation-tools"><button onClick={download} disabled={!messages.length || loading}>{saved ? <Check size={15} /> : <Download size={15} />}{saved ? "Беседа сохранена" : "Сохранить беседу"}</button><button onClick={() => setModal("reset")} disabled={loading || (!messages.length && !draft)}><RotateCcw size={15} /> Начать заново</button><span>{messages.length / 2} / 10 вопросов</span></div>
          </div>
          <div className="ai-notice"><ShieldCheck size={17} /><p>Учебная ИИ-реконструкция. Ответы могут содержать ошибки — проверяй факты по историческим источникам.</p></div>
        </div>
      </section>}
    </main>
    <footer className="footer"><span>СЛОВА ГОСУДАРЯ СВЕРЯЙ С ИСТОРИЧЕСКИМИ ИСТОЧНИКАМИ.</span><span>XVI <span className="footer-star">✧</span> XXI</span></footer>

    <dialog ref={dialog} className="modal" onCancel={event => { event.preventDefault(); setModal(null); }} onClick={event => { if (event.target === dialog.current) setModal(null); }}><div className="modal-content"><button className="modal-close" onClick={() => setModal(null)} aria-label="Закрыть"><X size={21} /></button>{modal === "about" ? <><span className="eyebrow">ИСТОРИЯ × ИНФОРМАТИКА · 7 КЛАСС</span><h2>О сей беседе</h2><p>Перед тобой литературный образ Ивана IV, ответы которого создаёт нейросеть. Он помогает задавать вопросы о прошлом, но не заменяет исторические источники.</p><ol><li>Сформулируй вопрос о правлении Ивана IV.</li><li>Отдели в ответе факты от оценок и предполагаемых мотивов.</li><li>Сравни ответ с учебником и материалами учителя.</li><li>Сохрани беседу и обсуди выводы в группе.</li></ol><p>Не вводи имена, контакты и другие личные данные. Текст вопросов и предыдущих реплик отправляется OpenAI для ответа. Беседа хранится в этом браузере; её можно скачать или удалить кнопкой «Начать заново».</p><p className="modal-note">Во вступлении звучит художественный монолог с синтетической озвучкой. Это современная реконструкция, а не подлинная речь царя.</p><button className="primary" onClick={() => { setModal(null); goChat(); }}>К вопросам <MessageSquare size={17} /></button></> : <><span className="eyebrow">НОВАЯ БЕСЕДА</span><h2>Начать с чистого листа?</h2><p>Текущая переписка и набранный вопрос будут удалены из этого браузера. Сначала можно скачать беседу.</p><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>Продолжить беседу</button><button className="primary" onClick={() => { setMessages([]); setDraft(""); setError(""); setModal(null); input.current?.focus(); }}>Начать заново</button></div></>}</div></dialog>
  </div>;
}
