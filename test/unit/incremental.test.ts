import { expect } from 'vitest';

import { testCommand } from './run.js';

// The CLI exits zero even when a case fails or no corpus is found, so check its output as well.
testCommand('reparses the corpus consistently after random edits', ['script/fuzz-corpus'], 900_000, {
  check: (output) => {
    const cases = [...output.matchAll(/^ +\d+\. ([\w-]+) - corpus - /gm)].map((match) => match[1]);
    for (const language of ['haskell', 'hsc']) {
      expect(cases.filter((name) => name === language).length, `${language} fuzz cases`).toBeGreaterThan(0);
    }
    expect(output).not.toContain('failed fuzzing');
  },
});
