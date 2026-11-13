import './rules.test.js';
import './levels.test.js';
import './input.test.js';
import { run } from './harness.js';
const results = await run((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `\n${result.error}` : ''}`));
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} tests passed`);
if (failed.length) process.exitCode = 1;
