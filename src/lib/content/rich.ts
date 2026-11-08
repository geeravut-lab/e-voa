// Rich text for news, written by staff in a small, safe Markdown-like language. PURE (no server imports): the page, the editor preview and the tests share it.
// Nothing here ever becomes raw HTML: the parser returns plain data and a React component turns it into elements, so a typed "<script>" is just text.
//
//   ## Heading            ### Smaller heading
//   **bold**  *italic*  [link text](https://example.com)
//   - bullet item         1. numbered item          > a quoted note
//   ![what the picture shows](/news-img/<name>)   (the editor's "Add picture" button writes this line)
//   --- on its own line: a divider

export type Inline = { t: "text"; v: string } | { t: "b"; c: Inline[] } | { t: "i"; c: Inline[] } | { t: "a"; href: string; c: Inline[] };
export type Block =
  | { t: "h"; level: 2 | 3; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] }
  | { t: "quote"; c: Inline[] }
  | { t: "img"; name: string; alt: string }
  | { t: "hr" };

/** Pictures uploaded by staff: a random 24-hex name and a modern format. Only this exact shape is ever shown or served. */
export const NEWS_IMG_RE = /^[a-f0-9]{24}\.(webp|jpg|png)$/;
export const NEWS_IMG_PREFIX = "/news-img/";

/** A link target is accepted only if it is a web address, a mail address or a path inside this site. Everything else (javascript:, data:, …) is shown as plain text. */
export function safeHref(raw: string): string | null {
  const h = raw.trim();
  if (!h || h.length > 500 || /[\s<>"'`\u0000-\u001f]/.test(h)) return null;
  if (/^https?:\/\/[^/\s]+/i.test(h) || /^mailto:[^\s@]+@[^\s@]+$/i.test(h)) return h;
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  return null;
}
export const isExternal = (href: string) => /^https?:\/\//i.test(href);

/** Inline marks, no nesting beyond bold/italic inside a link. Unclosed marks stay as the characters the writer typed. */
export function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = []; let buf = "", i = 0;
  const flush = () => { if (buf) { out.push({ t: "text", v: buf }); buf = ""; } };
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length && /[*_\[\]()\\#>!-]/.test(src[i + 1])) { buf += src[i + 1]; i += 2; continue; }
    if (depth < 3) {
      if (src.startsWith("**", i)) { const j = src.indexOf("**", i + 2); if (j > i + 2) { flush(); out.push({ t: "b", c: parseInline(src.slice(i + 2, j), depth + 1) }); i = j + 2; continue; } }
      if (ch === "*" && src[i + 1] !== "*" && src[i + 1] !== " ") { const j = src.indexOf("*", i + 1); if (j > i + 1 && src[j - 1] !== " ") { flush(); out.push({ t: "i", c: parseInline(src.slice(i + 1, j), depth + 1) }); i = j + 1; continue; } }
      if (ch === "[") {
        const close = src.indexOf("](", i + 1);
        if (close > i) { const end = src.indexOf(")", close + 2); if (end > close) { const href = safeHref(src.slice(close + 2, end)); if (href) { flush(); out.push({ t: "a", href, c: parseInline(src.slice(i + 1, close), depth + 1) }); i = end + 1; continue; } } }
      }
    }
    buf += ch; i++;
  }
  flush();
  return out;
}

const IMG_LINE = /^!\[([^\]]{0,200})\]\((\/news-img\/[a-f0-9]{24}\.(?:webp|jpg|png))\)$/;
/** The whole text → blocks. A blank line ends a paragraph or list; line breaks inside a paragraph are kept (as news was plain text before, its line breaks still show). */
export function parseRich(text: string): Block[] {
  const out: Block[] = []; let para: string[] = []; let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  const flushPara = () => { if (para.length) out.push({ t: "p", c: parseInline(para.join("\n")) }); para = []; };
  const flushList = () => { if (list) out.push({ t: list.kind, items: list.items.map((x) => parseInline(x)) }); list = null; };
  for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    if (h) { flushPara(); flushList(); out.push({ t: "h", level: h[1].length === 2 ? 2 : 3, c: parseInline(h[2].trim()) }); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line)) { flushPara(); flushList(); out.push({ t: "hr" }); continue; }
    const im = IMG_LINE.exec(line);
    if (im) { flushPara(); flushList(); out.push({ t: "img", name: im[2].slice(NEWS_IMG_PREFIX.length), alt: im[1].trim() }); continue; }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) { flushPara(); flushList(); out.push({ t: "quote", c: parseInline(q[1]) }); continue; }
    const ul = /^[-*•]\s+(.+)$/.exec(line), ol = /^\d{1,2}[.)]\s+(.+)$/.exec(line);
    if (ul || ol) { flushPara(); const kind = ul ? "ul" : "ol"; if (list && list.kind !== kind) flushList(); (list ??= { kind, items: [] }).items.push((ul ?? ol)![1]); continue; }
    flushList(); para.push(line);
  }
  flushPara(); flushList();
  return out;
}

const inlineText = (c: Inline[]): string => c.map((x) => (x.t === "text" ? x.v : inlineText(x.c))).join("");
/** The text without marks and pictures: for the home banner, the AI assistant and search. */
export function richPlain(text: string): string {
  return parseRich(text).map((b) => (b.t === "p" || b.t === "h" || b.t === "quote" ? inlineText(b.c) : b.t === "ul" || b.t === "ol" ? b.items.map(inlineText).join("; ") : b.t === "img" ? (b.alt ? `[${b.alt}]` : "") : "")).filter(Boolean).join("\n");
}
/** The picture names a text uses (to remove unused files when an item is deleted). */
export const richImages = (text: string): string[] => [...new Set(parseRich(text).flatMap((b) => (b.t === "img" ? [b.name] : [])))];
