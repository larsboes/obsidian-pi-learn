import { App, Component, MarkdownRenderer } from 'obsidian';
import { parseActivity, renderActivity } from './activity';

type Part = { kind: 'markdown'; text: string } | { kind: 'fence'; info: string; text: string; closed: boolean };
export function replyParts(source: string): Part[] {
  const parts: Part[] = [];
  let prose: string[] = [];
  let block: { marker: string; info: string; lines: string[] } | undefined;
  const flush = () => {
    if (prose.length) parts.push({ kind: 'markdown', text: prose.join('\n') });
    prose = [];
  };
  for (const line of source.split(/\r?\n/)) {
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (block) {
      if (fence && fence[1][0] === block.marker[0] && fence[1].length >= block.marker.length && !fence[2].trim()) {
        parts.push({ kind: 'fence', info: block.info, text: block.lines.join('\n'), closed: true });
        block = undefined;
      } else block.lines.push(line);
    } else if (fence && (fence[1][0] === '~' || !fence[2].includes('`'))) {
      flush();
      block = { marker: fence[1], info: fence[2].trim(), lines: [] };
    } else prose.push(line);
  }
  flush();
  if (block) parts.push({ kind: 'fence', info: block.info, text: block.lines.join('\n'), closed: false });
  return parts;
}

/** Keep ordinary links and prose, but do not hand HTML, embeds or nested fences to postprocessors. */
export function inertMarkdown(text: string): string {
  return text.replace(/</g, '&lt;')
    .replace(/!\[/g, '&#33;[')
    .replace(/`{3,}|~{3,}/g, (run) => run[0] === '`' ? '&#96;'.repeat(run.length) : '&#126;'.repeat(run.length));
}

const PASSIVE_FENCES = new Set(['text', 'plaintext', 'sh', 'bash', 'shell', 'zsh', 'json', 'yaml', 'toml',
  'js', 'javascript', 'ts', 'typescript', 'py', 'python', 'rs', 'rust', 'sql', 'css', 'html', 'md', 'markdown', 'mermaid']);

/** Skip raw HTML, transclusions and nonstandard fenced renderers on automatic opens. */
export function canFollowNote(text: string): boolean {
  if (/(?:!\[|<\s*\/?\s*[a-z!][^\n>]*>)/i.test(text)) return false;
  return Array.from(text.matchAll(/(?:`{3,}|~{3,})[ \t]*([^ \t\r\n`~]+)/g))
    .every((match) => PASSIVE_FENCES.has(match[1].toLowerCase()));
}

export async function renderReply(
  app: App, text: string, el: HTMLElement, sourcePath: string, component: Component,
  mode: 'plain' | 'stream' | 'final' | 'history',
): Promise<void> {
  const pending: Promise<void>[] = [];
  let activityShown = false;
  for (const part of replyParts(text)) {
    if (part.kind === 'markdown') {
      if (!part.text.trim()) continue;
      const prose = el.createDiv();
      pending.push(MarkdownRenderer.render(app, inertMarkdown(part.text), prose, sourcePath, component)
        .catch(() => { prose.textContent = part.text; }));
    } else if (part.info === 'learn-activity' && mode !== 'plain') {
      if (mode === 'stream') continue;
      const activity = part.closed && !activityShown ? parseActivity(part.text) : null;
      if (activity) {
        renderActivity(el, activity, mode === 'history');
        activityShown = true;
      } else el.createEl('p', { cls: 'pi-learn-experiment-assumptions', text: 'Experiment unavailable. Continue with the written explanation.' });
    } else {
      const pre = el.createEl('pre');
      pre.createEl('code', { text: part.text });
    }
  }
  await Promise.all(pending);
}
