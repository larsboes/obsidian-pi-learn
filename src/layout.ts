import type { App } from 'obsidian';

export const LAYOUT_FILE = 'Resources/Vault Layout.json';
export interface VaultLayout {
  learning: string;
  knowledge: string;
  resources: string;
  log: string;
}
export const DEFAULT_LAYOUT: VaultLayout = {
  learning: 'Learning', knowledge: 'Knowledge', resources: 'Resources', log: 'Learning/Learning Log.md',
};
const layouts = new WeakMap<App, VaultLayout>();

/** Returns the layout loaded for this vault, or the default three-folder layout. */
export function vaultLayout(app: App): VaultLayout { return layouts.get(app) ?? DEFAULT_LAYOUT; }

/** Loads vault-relative paths; invalid or overlapping roots fail without replacing the layout. */
export async function loadLayout(app: App): Promise<VaultLayout> {
  const adapter = app.vault.adapter;
  if (!await adapter.exists(LAYOUT_FILE)) { layouts.set(app, DEFAULT_LAYOUT); return DEFAULT_LAYOUT; }
  const value = JSON.parse(await adapter.read(LAYOUT_FILE));
  const layout = {} as VaultLayout;
  for (const key of ['learning', 'knowledge', 'resources', 'log'] as const) {
    const path = value[key];
    if (typeof path !== 'string' || !path || path.includes('\\') || path.split('/').some((p) => !p || p.startsWith('.')))
      throw new Error(`Invalid ${key} path in ${LAYOUT_FILE}`);
    layout[key] = path;
  }
  const overlap = (a: string, b: string) => a === b || a.startsWith(`${b}/`);
  if (
    overlap(layout.knowledge, layout.resources) ||
    overlap(layout.resources, layout.knowledge) ||
    overlap(layout.learning, layout.resources) ||
    overlap(layout.resources, layout.learning) ||
    (layout.learning !== layout.knowledge && overlap(layout.knowledge, layout.learning))
  ) {
    throw new Error('Vault layout folders must not overlap');
  }
  if (!layout.log.startsWith(`${layout.learning}/`) || !layout.log.endsWith('.md'))
    throw new Error('Learning Log must be a Markdown file inside Learning');
  layouts.set(app, layout);
  return layout;
}
