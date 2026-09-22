// Client-only: render a Markdown résumé into a clean print window and trigger the browser's
// "Save as PDF". No dependency — a small Markdown subset is all a résumé needs.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

/** Minimal Markdown → HTML for a résumé: headings, bullets, rules, paragraphs. */
export function resumeMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    closeList();
    if (!line.trim()) continue;
    if (/^#{1,6}\s+/.test(line)) {
      const level = Math.min(3, (line.match(/^#+/)?.[0].length ?? 1));
      out.push(`<h${level}>${inline(line.replace(/^#+\s+/, ""))}</h${level}>`);
    } else if (/^[-—*_]{3,}$/.test(line.trim())) {
      out.push("<hr>");
    } else {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

const PRINT_CSS = `
  @page { margin: 16mm 18mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #14171f; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 2pt; letter-spacing: -0.01em; }
  h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #333; border-bottom: 1px solid #d5d9e0; padding-bottom: 3pt; margin: 16pt 0 6pt; }
  h3 { font-size: 11pt; margin: 10pt 0 2pt; }
  p { margin: 3pt 0; }
  ul { margin: 4pt 0 8pt; padding-left: 16pt; }
  li { margin: 2pt 0; }
  hr { border: 0; border-top: 1px solid #d5d9e0; margin: 10pt 0; }
  code { font-family: ui-monospace, monospace; font-size: 10pt; }
  a { color: inherit; text-decoration: none; }
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
  // Give the iframe a moment to lay out (fonts, wrapping) before printing.
  setTimeout(() => {
    try { win.focus(); win.print(); } catch { /* ignore */ }
    // Fallback removal if onafterprint never fires (some browsers).
    setTimeout(cleanup, 60000);
  }, 250);
}
