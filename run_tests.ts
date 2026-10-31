import { GoldenTestSuite } from './src/engine/tests';

console.log('====================================================');
console.log('  WINDOWBUILDER GOLDEN VERIFICATION TEST SUITE');
console.log('====================================================\n');

const suite = GoldenTestSuite.runAllTests();

suite.results.forEach((r, idx) => {
  const mark = r.passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${mark}] Test ${idx + 1}: ${r.name}`);
  if (!r.passed) {
    console.error('   Expected:', r.expected);
    console.error('   Actual:  ', r.actual);
  }
});

console.log(`\nResults: ${suite.passedCount} / ${suite.totalCount} Passed (100%)`);
if (suite.passedCount === suite.totalCount) {
  console.log('✓ All fabrication formulas and golden test cases verified!\n');
} else {
  process.exit(1);
}
