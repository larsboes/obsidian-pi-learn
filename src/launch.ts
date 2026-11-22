/** The value `questions.ts` (`HOST_PROTOCOL`) expects before it hands widgets to this client. */
export const QUESTIONS_PROTOCOL = 'pi-questions/v1';

export type Launcher = 'native' | 'wsl';

/** Every level pi accepts (`docs/rpc-commands.md`, set_thinking_level). */
export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

export interface LaunchSettings {
  /** The pi executable: a name on PATH or an absolute path. */
  piCommand: string;
  /** Windows only: start pi natively or inside WSL. */
  launcher: Launcher;
  /** Windows only: the WSL distribution, empty for the default one. */
  wslDistro: string;
}

export interface Launch {
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string | undefined>;
  shell?: boolean;
}

/** Files Learn ships for pi: the `questions` and `sessions` extensions and the skill folder. */
export interface PiResources {
  extensions: string[];
  skills: string[];
}

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * The bundled `pi/` folder inside the deployed plugin. `pluginDir` is Obsidian's vault-relative
 * `manifest.dir`. The separator follows the vault path, so Windows paths stay Windows paths.
 */
export function learnResources(vaultPath: string, pluginDir: string): PiResources {
  const sep = vaultPath.includes('\\') ? '\\' : '/';
  const root = [vaultPath.replace(/[\\/]+$/, ''), ...pluginDir.split('/'), 'pi'].join(sep);
  return {
    extensions: ['questions.ts', 'sessions.ts'].map((name) => [root, 'extensions', name].join(sep)),
    skills: [[root, 'skills'].join(sep)],
  };
}

/** `-e` and `--skill` arguments (`pi --help`), each path passed through `path`. */
function resourceArgs(resources: PiResources | undefined, path: (p: string) => string): string[] {
  if (!resources) return [];
  return [
    ...resources.extensions.flatMap((p) => ['-e', path(p)]),
    ...resources.skills.flatMap((p) => ['--skill', path(p)]),
  ];
}

/**
 * How to start `pi --mode rpc` in the vault on this platform.
 *
 * macOS and Linux go through the login shell, because an app started from the Dock or a desktop
 * launcher does not inherit the PATH that holds pi. Windows starts pi natively through cmd, or
 * inside WSL, where `wslpath` turns the Windows vault path into the Linux one. `resources`
 * load Learn's own extensions and skills, so pi's user settings need not list them.
 */
export function buildLaunch(
  settings: LaunchSettings,
  vaultPath: string,
  platform: string,
  env: Record<string, string | undefined>,
  resources?: PiResources,
): Launch {
  const pi = settings.piCommand.trim() || 'pi';
  const args = ['--mode', 'rpc'];

  if (platform === 'win32' && settings.launcher === 'wsl') {
    const script =
      `cd "$(wslpath -u ${quote(vaultPath)})" && ` +
      `PI_QUESTIONS_CLIENT=${QUESTIONS_PROTOCOL} exec ${pi} ` +
      [...args, ...resourceArgs(resources, (p) => `"$(wslpath -u ${quote(p)})"`)].join(' ');
    const distro = settings.wslDistro.trim() ? ['-d', settings.wslDistro.trim()] : [];
    return { command: 'wsl.exe', args: [...distro, '-e', 'bash', '-lc', script], env };
  }

  const childEnv = { ...env, PI_QUESTIONS_CLIENT: QUESTIONS_PROTOCOL };
  if (platform === 'win32') {
    const extra = resourceArgs(resources, (p) => `"${p}"`);
    return { command: pi, args: [...args, ...extra], cwd: vaultPath, env: childEnv, shell: true };
  }
  const shell = env.SHELL || '/bin/sh';
  return {
    command: shell,
    args: ['-lc', `exec ${pi} ${[...args, ...resourceArgs(resources, quote)].join(' ')}`],
    cwd: vaultPath,
    env: childEnv,
  };
}

/** Split `provider/model` for the `set_model` command; null when there is no provider part. */
export function splitModel(spec: string): { provider: string; modelId: string } | null {
  const slash = spec.indexOf('/');
  if (slash <= 0 || slash === spec.length - 1) return null;
  return { provider: spec.slice(0, slash), modelId: spec.slice(slash + 1) };
}
