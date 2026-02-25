import { collectFromTranscripts, generateSyntheticToolExamples } from './collect-data.js';
import { cleanConversation, filterByQuality, deduplicate } from './clean-data.js';
import { toChatML, toJSONL, trainValSplit, printStats } from './format-data.js';
import { writeFileSync, mkdirSync } from 'fs';

async function main() {
  const logsDir = process.argv[2] || './data/transcripts';
  const outputDir = process.argv[3] || './data/training';

  console.log('📦 Collecting data...');
  let conversations = collectFromTranscripts(logsDir);
  console.log(`   Found ${conversations.length} conversations`);

  // Add synthetic examples
  const synthetic = generateSyntheticToolExamples();
  conversations = [...conversations, ...synthetic];
  console.log(`   + ${synthetic.length} synthetic examples`);

  console.log('🧹 Cleaning...');
  const cleaned = conversations
    .map(cleanConversation)
    .filter((c): c is NonNullable<typeof c> => c !== null);
  console.log(`   ${cleaned.length} after cleaning`);

  console.log('🔍 Filtering...');
  const filtered = filterByQuality(cleaned);
  console.log(`   ${filtered.length} after quality filter`);

  console.log('🔄 Deduplicating...');
  const unique = deduplicate(filtered);
  console.log(`   ${unique.length} after dedup`);

  console.log('📝 Formatting...');
  const examples = toChatML(unique);
  printStats(examples);

  console.log('✂️  Splitting...');
  const { train, val } = trainValSplit(examples);
  console.log(`   Train: ${train.length} | Val: ${val.length}`);

  console.log('💾 Saving...');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(`${outputDir}/train.jsonl`, toJSONL(train));
  writeFileSync(`${outputDir}/val.jsonl`, toJSONL(val));
  writeFileSync(`${outputDir}/full.jsonl`, toJSONL(examples));
  console.log(`   Saved to ${outputDir}/`);

  console.log('\n✅ Pipeline complete!');
}

main().catch(console.error);
