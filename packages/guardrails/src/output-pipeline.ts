import { GuardPipeline } from './index.js';
import { PIIDetectorGuard } from './guards/pii-detector.js';
import { PromptLeakGuard } from './guards/output/prompt-leak.js';
import { OutputContentGuard } from './guards/output/content-safety.js';
import { ResponseQualityGuard } from './guards/output/quality.js';

export function createOutputGuards(systemPromptFragments?: string[]): GuardPipeline {
  const pipeline = new GuardPipeline();
  pipeline.add(new ResponseQualityGuard());
  pipeline.add(new OutputContentGuard());
  pipeline.add(new PIIDetectorGuard());
  
  const leakGuard = new PromptLeakGuard();
  if (systemPromptFragments) leakGuard.setPromptFragments(systemPromptFragments);
  pipeline.add(leakGuard);

  return pipeline;
}
