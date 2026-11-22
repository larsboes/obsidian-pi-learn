import { describe, expect, test } from 'bun:test';
import { buildLaunch, learnResources } from '../src/launch';

const settings = { piCommand: 'pi', launcher: 'native' as const, wslDistro: '' };
const vault = '/Users/me/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault';

describe('learnResources', () => {
  test('points at the bundled pi folder inside the plugin', () => {
    const r = learnResources(`${vault}/`, '.obsidian/plugins/pi-learn');
    expect(r.extensions).toEqual([
      `${vault}/.obsidian/plugins/pi-learn/pi/extensions/questions.ts`,
      `${vault}/.obsidian/plugins/pi-learn/pi/extensions/sessions.ts`,
    ]);
    expect(r.skills).toEqual([`${vault}/.obsidian/plugins/pi-learn/pi/skills`]);
  });

  test('keeps Windows separators', () => {
    const r = learnResources('C:\\Vault', '.obsidian/plugins/pi-learn');
    expect(r.skills).toEqual(['C:\\Vault\\.obsidian\\plugins\\pi-learn\\pi\\skills']);
  });
});

describe('buildLaunch with resources', () => {
  const resources = learnResources(vault, '.obsidian/plugins/pi-learn');

  test('quotes paths with spaces for the login shell', () => {
    const l = buildLaunch(settings, vault, 'darwin', { SHELL: '/bin/zsh' }, resources);
    expect(l.args[1]).toBe(
      `exec pi --mode rpc -e '${resources.extensions[0]}' -e '${resources.extensions[1]}' --skill '${resources.skills[0]}'`,
    );
  });

  test('double-quotes paths for cmd on Windows', () => {
    const l = buildLaunch(settings, 'C:\\V', 'win32', {}, learnResources('C:\\V', '.obsidian/plugins/pi-learn'));
    expect(l.args).toContain('"C:\\V\\.obsidian\\plugins\\pi-learn\\pi\\skills"');
  });

  test('translates paths with wslpath inside WSL', () => {
    const l = buildLaunch({ ...settings, launcher: 'wsl' }, 'C:\\V', 'win32', {}, learnResources('C:\\V', '.obsidian/plugins/pi-learn'));
    expect(l.args.at(-1)).toContain(`--skill "$(wslpath -u 'C:\\V\\.obsidian\\plugins\\pi-learn\\pi\\skills')"`);
  });

  test('adds nothing without resources', () => {
    const l = buildLaunch(settings, vault, 'linux', { SHELL: '/bin/sh' });
    expect(l.args[1]).toBe('exec pi --mode rpc');
  });
});
