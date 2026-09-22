// Client-only: render a Markdown résumé into a clean print window and trigger the browser's
// "Save as PDF". No dependency — a small, résumé-shaped Markdown renderer plus print styles.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) =>
  esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>') // [text](url)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

/**
 * Markdown → HTML shaped for a résumé: a centered name + contact header, section rules, entry
 * headers with the role/dates on one line, bullets, links, and paragraphs. Tolerant of messy input.
 */
export function resumeMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let inList = false, named = false, wantContact = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };

  for (const raw of lines) {
    const line = raw.trim();

    // First non-empty line (with or without leading #) is the name.
    if (!named) {
      if (!line) continue;
      out.push(`<h1 class="name">${inline(line.replace(/^#{1,6}\s+/, ""))}</h1>`);
      named = true; wantContact = true;
      continue;
    }

    // The line right after the name, if it isn't a section/bullet, is the contact line.
    if (wantContact) {
      if (!line) continue;
      if (!/^#{1,6}\s+/.test(line) && !/^[-*]\s+/.test(line)) {
        const items = line.split(/\s*[|•·]\s*/).filter(Boolean).map(inline);
        out.push(`<p class="contact">${items.join(' <span class="sep">·</span> ')}</p>`);
        wantContact = false;
        continue;
      }
      wantContact = false; // fall through to normal handling
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    closeList();
    if (!line) continue;

    if (/^#{1,6}\s+/.test(line)) {
      out.push(`<h2>${inline(line.replace(/^#{1,6}\s+/, ""))}</h2>`);
      continue;
    }
    if (/^[-—*_]{3,}$/.test(line)) { out.push("<hr>"); continue; }

    // An entry header: a bold title optionally trailed by short meta (dates / location / a link).
    const m = line.match(/^\*\*(.+?)\*\*[\s—–-]*(.*)$/);
    if (m && m[2].length <= 55) {
      const meta = m[2].replace(/^\(([\s\S]*)\)$/, "$1").trim();
      out.push(`<div class="entry"><span class="t">${inline(m[1])}</span>${meta ? `<span class="d">${inline(meta)}</span>` : ""}</div>`);
      continue;
    }

    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

const PRINT_CSS = `
  @page { margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.42 "Helvetica Neue", Arial, "Segoe UI", Roboto, sans-serif; color: #1f2633; margin: 0; }
  .name { font-size: 22pt; font-weight: 700; text-align: center; letter-spacing: -0.01em; color: #0f172a; margin: 0 0 3pt; }
  .contact { text-align: center; font-size: 9pt; color: #475569; margin: 0 0 6pt; }
  .contact a { color: #2447d6; text-decoration: none; }
  .contact .sep { color: #cbd2dd; margin: 0 3pt; }
  h2 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: #0f172a;
       border-bottom: 1.2px solid #0f172a; padding-bottom: 2.5pt; margin: 13pt 0 6pt; }
  .entry { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; margin: 8pt 0 2pt; }
  .entry .t { font-weight: 700; color: #111827; }
  .entry .d { font-size: 9pt; color: #64748b; white-space: nowrap; }
  p { margin: 3pt 0; }
  a { color: #2447d6; text-decoration: none; }
  ul { margin: 3pt 0 6pt; padding-left: 15pt; }
  li { margin: 1.5pt 0; }
  li::marker { color: #94a3b8; }
  strong { color: #0f172a; font-weight: 700; }
  code { font-family: ui-monospace, "SFMono-Regular", monospace; font-size: 9.5pt; background: #f1f5f9; padding: 0 2px; border-radius: 2px; }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 8pt 0; }
`;

/**
 * Render the résumé into a hidden iframe and open the browser's print / Save-as-PDF dialog.
 * An iframe (not window.open) avoids pop-up blockers, and we call print() directly rather than
 * relying on the child's load event — which for a written-in document has usually already fired.
 */
export function resumePdfToPrintWindow(md: string) {
  const html = resumeMarkdownToHtml(md);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", opacity: "0" });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) { iframe.remove(); return; }

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Résumé</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`);
  doc.close();

  let cleaned = false;
  const cleanup = () => { if (!cleaned) { cleaned = true; setTimeout(() => iframe.remove(), 500); } };
  win.onafterprint = cleanup;
  setTimeout(() => {
    try { win.focus(); win.print(); } catch { /* ignore */ }
    setTimeout(cleanup, 60000);
  }, 250);
}
