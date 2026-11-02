import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { readJson, writeJson, updateJson, appendJsonl, readJsonl } from '../src/storage/jsonStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, 'tmp_test_data');

async function runTests() {
  console.log('🧪 Starting Zero-SQL Storage Engine Tests...\n');

  try {
    await fs.promises.mkdir(testDir, { recursive: true });
    const jsonTestFile = path.join(testDir, 'counter.json');
    const jsonlTestFile = path.join(testDir, 'events.jsonl');

    // 1. Initial write and read
    console.log('1️⃣ Testing basic JSON write and read...');
    await writeJson(jsonTestFile, { counter: 0, items: [] });
    const initial = await readJson(jsonTestFile);
    if (initial.counter !== 0) throw new Error('Initial read mismatch');
    console.log('   ✅ Passed basic write & read.');

    // 2. Concurrency test: 50 simultaneous updateJson calls
    console.log('2️⃣ Testing concurrent updateJson (50 parallel increments)...');
    const concurrentUpdates = Array.from({ length: 50 }, (_, i) =>
      updateJson(jsonTestFile, (data) => {
        data.counter += 1;
        data.items.push(`item_${i}`);
        return data;
      })
    );
    await Promise.all(concurrentUpdates);

    const finalJson = await readJson(jsonTestFile);
    if (finalJson.counter !== 50 || finalJson.items.length !== 50) {
      throw new Error(`Lost updates detected! Expected counter 50, got ${finalJson.counter}`);
    }
    console.log('   ✅ Passed concurrent updateJson without lost updates.');

    // 3. Concurrency test: 100 simultaneous appendJsonl calls
    console.log('3️⃣ Testing concurrent appendJsonl (100 parallel events)...');
    const concurrentAppends = Array.from({ length: 100 }, (_, i) =>
      appendJsonl(jsonlTestFile, {
        event_id: `EVT-${i + 1}`,
        student_id: `STU-${(i % 5) + 1}`,
        event_type: i % 2 === 0 ? 'TAB_SWITCHED' : 'TAB_RETURNED',
        timestamp: new Date().toISOString()
      })
    );
    await Promise.all(concurrentAppends);

    const lines = await readJsonl(jsonlTestFile);
    if (lines.length !== 100) {
      throw new Error(`Expected 100 JSONL records, found ${lines.length}`);
    }
    console.log('   ✅ Passed 100 concurrent JSONL appends, all lines valid JSON.');

    // Clean up tmp test dir
    await fs.promises.rm(testDir, { recursive: true, force: true });
    console.log('\n🎉 ALL ZERO-SQL STORAGE ENGINE TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (_) {}
    process.exit(1);
  }
}

runTests();

