import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('scanner diagnostics preserve long-line trees and incremental edits', () => {
  fs.mkdirSync(path.join(repositoryRoot, '.tmp'), { recursive: true });
  const workspace = fs.mkdtempSync(path.join(repositoryRoot, '.tmp/debug-scanner-'));
  const run = (arguments_: string[]): SpawnSyncReturns<string> => {
    const result = spawnSync('script/tree-sitter', arguments_, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr + result.stdout).toBe(0);
    return result;
  };
  try {
    const debugLibrary = path.join(workspace, 'debug.dylib');
    const optimizedLibrary = path.join(workspace, 'optimized.dylib');
    run(['build', '-0', '-o', debugLibrary]);
    run(['build', '-o', optimizedLibrary]);
    run(['test', '--lib-path', debugLibrary, '--lang-name', 'haskell']);
    for (const length of [64, 256, 512, 2048]) {
      const input = path.join(workspace, 'input.hs');
      const source = `value = "${'x'.repeat(length)}"\nfollowing = 1\n`;
      fs.writeFileSync(input, source);
      const parse = (library: string, edits: string[] = []): SpawnSyncReturns<string> =>
        run(['parse', '--lib-path', library, '--lang-name', 'haskell', input, ...edits]);
      const optimized = parse(optimizedLibrary);
      const debug = parse(debugLibrary);
      expect(debug.stdout).toBe(optimized.stdout);
      expect(debug.stderr).toContain('contexts =');
      expect(debug.stderr).toContain('result:');
      expectBoundedSnapshots(debug.stderr);
      const edited = parse(debugLibrary, ['--edits', '9 0 yy']);
      fs.writeFileSync(input, source.slice(0, 9) + 'yy' + source.slice(9));
      expect(edited.stdout).toBe(parse(optimizedLibrary).stdout);
      fs.writeFileSync(input, `-- ${'x'.repeat(length)}\nfollowing = 1\n`);
      const comment = parse(debugLibrary);
      expect(comment.stdout).toBe(parse(optimizedLibrary).stdout);
      expect(comment.stderr).toContain('characters omitted');
      expectBoundedSnapshots(comment.stderr);
    }
    const input = path.join(workspace, 'deep.hs');
    fs.writeFileSync(input, `(${'Box ('.repeat(512)}deep${')'.repeat(512)}) = value\nfollowing = 1\n`);
    const arguments_ = ['--lang-name', 'haskell', input];
    const optimized = run(['parse', '--lib-path', optimizedLibrary, ...arguments_]);
    const debug = run(['parse', '--lib-path', debugLibrary, ...arguments_]);
    expect(debug.stdout).toBe(optimized.stdout);
    expect(debug.stderr).toContain('contexts omitted');
    expectBoundedSnapshots(debug.stderr);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 300_000);

function expectBoundedSnapshots(output: string): void {
  const snapshots = output
    .split('\n')
    .filter((line) => line.startsWith('  contexts = ') || line.startsWith('lookahead from '));
  expect(snapshots.length).toBeGreaterThan(0);
  for (const snapshot of snapshots) expect(snapshot.length).toBeLessThan(512);
}
