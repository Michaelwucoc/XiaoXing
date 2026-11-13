export const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }
export function assert(value, message = '断言失败') { if (!value) throw new Error(message); }
export function equal(actual, expected, message = '值不相等') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}\n实际: ${JSON.stringify(actual)}\n预期: ${JSON.stringify(expected)}`);
}
export async function run(report = () => {}) {
  const results = [];
  for (const { name, fn } of tests) {
    try { await fn(); results.push({ name, ok: true }); }
    catch (error) { results.push({ name, ok: false, error: error.message }); }
    report(results.at(-1));
  }
  return results;
}
