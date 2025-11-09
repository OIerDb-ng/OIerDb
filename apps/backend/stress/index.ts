#!/usr/bin/env node
/**
 * Stress testing tool for OIerDb Backend API
 * Uses autocannon for HTTP benchmarking
 */

import autocannon from 'autocannon';
import {
  getListScenarios,
  getScenariosByCategory,
  getSingleItemScenarios,
  scenarios,
  type TestScenario,
} from './scenarios';

interface StressTestConfig {
  url: string;
  duration?: number;
  connections?: number;
  pipelining?: number;
  workers?: number;
}

interface TestMode {
  name: string;
  duration: number;
  connections: number;
  pipelining: number;
}

const TEST_MODES: Record<string, TestMode> = {
  quick: {
    name: 'Quick Test',
    duration: 10,
    connections: 10,
    pipelining: 1,
  },
  standard: {
    name: 'Standard Test',
    duration: 30,
    connections: 50,
    pipelining: 1,
  },
  heavy: {
    name: 'Heavy Load Test',
    duration: 60,
    connections: 100,
    pipelining: 10,
  },
};

/**
 * Run stress test for a single scenario
 */
async function runStressTest(
  scenario: TestScenario,
  config: StressTestConfig,
): Promise<autocannon.Result> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  console.log(`Path: ${scenario.method} ${scenario.path}`);
  console.log(`${'='.repeat(80)}\n`);

  const result = await autocannon({
    url: `${config.url}${scenario.path}`,
    method: scenario.method,
    duration: config.duration || 10,
    connections: config.connections || 10,
    pipelining: config.pipelining || 1,
    workers: config.workers,
  });

  // Print results
  console.log('\n--- Results ---');
  console.log(`Total Requests: ${result.requests.total}`);
  console.log(`Requests/sec: ${result.requests.average}`);
  console.log(`Latency (avg): ${result.latency.mean.toFixed(2)} ms`);
  console.log(`Latency (p50): ${result.latency.p50} ms`);
  console.log(`Latency (p75): ${result.latency.p75} ms`);
  console.log(`Latency (p90): ${result.latency.p90} ms`);
  console.log(`Latency (p99): ${result.latency.p99} ms`);
  console.log(`Latency (max): ${result.latency.max} ms`);
  console.log(`Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/sec`);
  console.log(`Errors: ${result.errors}`);
  console.log(`Timeouts: ${result.timeouts}`);
  console.log(`Non-2xx responses: ${result.non2xx}`);

  if (result.errors > 0 || result.non2xx > 0) {
    console.log('\n⚠️  WARNING: Test completed with errors or non-2xx responses');
  } else {
    console.log('\n✅ Test completed successfully');
  }

  return result;
}

/**
 * Run multiple stress tests sequentially
 */
async function runMultipleTests(
  testScenarios: TestScenario[],
  config: StressTestConfig,
): Promise<void> {
  const results: Array<{ scenario: string; rps: number; latency: number; errors: number }> = [];

  for (const scenario of testScenarios) {
    try {
      const result = await runStressTest(scenario, config);
      results.push({
        scenario: scenario.name,
        rps: result.requests.average,
        latency: result.latency.mean,
        errors: result.errors + result.non2xx,
      });
    } catch (error) {
      console.error(`\n❌ Error testing ${scenario.name}:`, error);
      results.push({
        scenario: scenario.name,
        rps: 0,
        latency: 0,
        errors: 1,
      });
    }
  }

  // Print summary
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('SUMMARY OF ALL TESTS');
  console.log('='.repeat(80));
  console.log('\n');
  console.log('Scenario'.padEnd(35), 'RPS'.padEnd(12), 'Latency (ms)'.padEnd(15), 'Errors');
  console.log('-'.repeat(80));

  for (const result of results) {
    const statusIcon = result.errors > 0 ? '❌' : '✅';
    console.log(
      `${statusIcon} ${result.scenario.padEnd(33)}`,
      result.rps.toFixed(2).padEnd(12),
      result.latency.toFixed(2).padEnd(15),
      result.errors.toString(),
    );
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
  const avgRps = results.reduce((sum, r) => sum + r.rps, 0) / results.length;
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

  console.log('-'.repeat(80));
  console.log(`Average RPS: ${avgRps.toFixed(2)}`);
  console.log(`Average Latency: ${avgLatency.toFixed(2)} ms`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log('\n');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'quick';
  const filter = args[1];
  const baseUrl = process.env.API_URL || 'http://localhost:32002';

  // Select test mode
  const testMode = TEST_MODES[mode] || TEST_MODES.quick;
  console.log(
    '\n╔═══════════════════════════════════════════════════════════════════════════════╗',
  );
  console.log('║                    OIerDb Backend Stress Testing Tool                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nMode: ${testMode.name}`);
  console.log(`Duration: ${testMode.duration}s per test`);
  console.log(`Connections: ${testMode.connections}`);
  console.log(`Pipelining: ${testMode.pipelining}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Cache: ${process.env.NODE_ENV === 'production' ? 'ENABLED ⚠️' : 'DISABLED ✓'}`);

  // Select scenarios
  let selectedScenarios: TestScenario[];

  if (filter) {
    if (filter === 'oier' || filter === 'contest' || filter === 'school' || filter === 'meta') {
      selectedScenarios = getScenariosByCategory(filter);
      console.log(`Filter: ${filter} endpoints`);
    } else if (filter === 'list') {
      selectedScenarios = getListScenarios();
      console.log(`Filter: List operations only`);
    } else if (filter === 'single') {
      selectedScenarios = getSingleItemScenarios();
      console.log(`Filter: Single item operations only`);
    } else {
      selectedScenarios = scenarios.filter((s) => s.name.includes(filter));
      console.log(`Filter: Scenarios matching "${filter}"`);
    }
  } else {
    selectedScenarios = scenarios;
    console.log(`Filter: All scenarios`);
  }

  console.log(`\nTotal scenarios to test: ${selectedScenarios.length}`);
  console.log(`Estimated total time: ${selectedScenarios.length * testMode.duration} seconds\n`);

  if (selectedScenarios.length === 0) {
    console.error('❌ No scenarios found matching the filter');
    process.exit(1);
  }

  // Confirm before starting
  console.log('Press Ctrl+C to cancel...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Run tests
  const config: StressTestConfig = {
    url: baseUrl,
    duration: testMode.duration,
    connections: testMode.connections,
    pipelining: testMode.pipelining,
  };

  await runMultipleTests(selectedScenarios, config);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runMultipleTests, runStressTest, TEST_MODES };
