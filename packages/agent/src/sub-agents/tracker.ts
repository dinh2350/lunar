import type { AgentMessage, AgentResult } from './protocol.js';

interface TraceStep {
  message: AgentMessage;
  result?: AgentResult;
  startTime: Date;
  endTime?: Date;
  children: TraceStep[];
}

export class ExecutionTracker {
  private traces = new Map<string, TraceStep[]>();

  /**
   * Record that a message was sent
   */
  startStep(message: AgentMessage): void {
    const steps = this.traces.get(message.traceId) || [];
    steps.push({
      message,
      startTime: new Date(),
      children: [],
    });
    this.traces.set(message.traceId, steps);
  }

  /**
   * Record that a result was received
   */
  completeStep(result: AgentResult): void {
    const steps = this.traces.get(result.traceId);
    if (!steps) return;

    const step = steps.find(s => s.message.id === result.messageId);
    if (step) {
      step.result = result;
      step.endTime = new Date();
    }
  }

  /**
   * Get full trace for a workflow
   */
  getTrace(traceId: string): TraceStep[] {
    return this.traces.get(traceId) || [];
  }

  /**
   * Get summary statistics for a trace
   */
  getTraceSummary(traceId: string): {
    totalSteps: number;
    completedSteps: number;
    totalTokens: number;
    totalDurationMs: number;
    agentsUsed: string[];
    toolsUsed: string[];
    status: 'running' | 'completed' | 'error';
  } {
    const steps = this.traces.get(traceId) || [];
    
    const completed = steps.filter(s => s.result);
    const totalTokens = completed.reduce((sum, s) => sum + (s.result?.tokensUsed || 0), 0);
    const totalDuration = completed.reduce((sum, s) => sum + (s.result?.durationMs || 0), 0);
    const agents = [...new Set(steps.map(s => s.message.to))];
    const tools = [...new Set(completed.flatMap(s => s.result?.toolsUsed.map(t => t.name) || []))];
    const hasError = completed.some(s => s.result?.status === 'error');

    return {
      totalSteps: steps.length,
      completedSteps: completed.length,
      totalTokens,
      totalDurationMs: totalDuration,
      agentsUsed: agents,
      toolsUsed: tools,
      status: hasError ? 'error' : completed.length === steps.length ? 'completed' : 'running',
    };
  }

  /**
   * Format trace as readable text (for debugging / UI)
   */
  formatTrace(traceId: string): string {
    const steps = this.traces.get(traceId) || [];
    const lines: string[] = [`Trace: ${traceId}`];

    for (const step of steps) {
      const duration = step.result?.durationMs || 0;
      const status = step.result?.status || 'running';
      const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : '⏳';

      lines.push(
        `  ${icon} ${step.message.from} → ${step.message.to} (${duration}ms)`,
        `     Task: ${(step.message.payload as any).instruction?.slice(0, 60)}...`,
      );

      if (step.result) {
        lines.push(
          `     Tokens: ${step.result.tokensUsed} | Tools: ${step.result.toolsUsed.map(t => t.name).join(', ') || 'none'}`,
          `     Output: ${step.result.output.slice(0, 80)}...`,
        );
      }
    }

    const summary = this.getTraceSummary(traceId);
    lines.push(
      `\n  Summary: ${summary.completedSteps}/${summary.totalSteps} steps | ${summary.totalTokens} tokens | ${summary.totalDurationMs}ms`,
    );

    return lines.join('\n');
  }
}
