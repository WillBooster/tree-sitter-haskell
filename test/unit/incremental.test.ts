import { expect } from 'vitest';

import { testCommand } from './run.js';

// The CLI exits zero even when a case fails or no corpus is found, so check its output as well.
testCommand('reparses the corpus consistently after random edits', ['script/fuzz-corpus'], 900_000, {
  check: (output) => {
    expect(output).toMatch(/^ +\d+\. .+ - corpus - /m);
    expect(output).not.toContain('failed fuzzing');
  },
});
