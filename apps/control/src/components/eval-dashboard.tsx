'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EvalRun {
  id: string;
  runNumber: number;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  score: number;
  categories: CategoryResult[];
  failures: FailedTest[];
}

interface CategoryResult {
  name: string;
  passed: number;
  failed: number;
  score: number;
  trend: 'up' | 'down' | 'same';
  trendDelta: number;
}

interface FailedTest {
  testId: string;
  input: string;
  expected: string;
  actual: string;
  category: string;
  judgeScore: number;
  judgeReason: string;
}

export function EvalDashboard() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [selected, setSelected] = useState<EvalRun | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    const res = await fetch('/api/eval?limit=20');
    const data = await res.json();
    setRuns(data.runs || []);
    if (data.runs?.length) setSelected(data.runs[0]);
  };

  const startEval = async () => {
    setRunning(true);
    try {
      await fetch('/api/eval', { method: 'POST', body: '{}' });
      // Poll for completion
      const poll = setInterval(async () => {
        const res = await fetch('/api/eval?limit=1');
        const data = await res.json();
        if (data.runs?.[0]?.id !== selected?.id) {
          clearInterval(poll);
          setRunning(false);
          loadRuns();
        }
      }, 3000);
    } catch {
      setRunning(false);
    }
  };

  const trendIcon = (trend: string) => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  const trendColor = (trend: string) => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-muted-foreground';
  };

  const scoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">📊 Evaluation Dashboard</h2>
        <Button onClick={startEval} disabled={running}>
          {running ? '⏳ Running...' : '▶️ Run Eval'}
        </Button>
      </div>

      {selected && (
        <>
          {/* Summary Bar */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Run</p>
                <p className="text-2xl font-bold">#{selected.runNumber}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-2xl font-bold">{selected.score}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Passed</p>
                <p className="text-2xl font-bold text-green-600">{selected.passed}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{selected.failed}</p>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Category</th>
                    <th className="text-center">Pass</th>
                    <th className="text-center">Fail</th>
                    <th className="text-center">Score</th>
                    <th className="text-center">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.categories.map((cat) => (
                    <tr key={cat.name} className="border-b">
                      <td className="py-2 font-medium">{cat.name}</td>
                      <td className="text-center text-green-600">{cat.passed}</td>
                      <td className="text-center text-red-600">{cat.failed}</td>
                      <td className="text-center">
                        <Badge className={scoreColor(cat.score)}>
                          {cat.score}%
                        </Badge>
                      </td>
                      <td className={`text-center ${trendColor(cat.trend)}`}>
                        {trendIcon(cat.trend)} {cat.trendDelta > 0 ? '+' : ''}{cat.trendDelta}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Failed Tests */}
          {selected.failures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>❌ Failed Tests ({selected.failures.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {selected.failures.map((test) => (
                      <Card key={test.testId} className="p-3 border-red-200">
                        <div className="flex justify-between mb-2">
                          <Badge variant="outline">{test.category}</Badge>
                          <Badge className="bg-red-100 text-red-800">
                            Judge: {test.judgeScore}/5
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p><strong>Input:</strong> {test.input}</p>
                          <p className="text-green-700"><strong>Expected:</strong> {test.expected}</p>
                          <p className="text-red-700"><strong>Got:</strong> {test.actual}</p>
                          <p className="text-muted-foreground italic">
                            {test.judgeReason}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Run History */}
          <Card>
            <CardHeader>
              <CardTitle>📈 Run History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 items-end h-32">
                {runs.slice(0, 20).reverse().map((run) => (
                  <div
                    key={run.id}
                    onClick={() => setSelected(run)}
                    className={`flex-1 cursor-pointer rounded-t transition-colors ${
                      selected?.id === run.id ? 'bg-primary' : 'bg-muted hover:bg-muted/80'
                    }`}
                    style={{ height: `${run.score}%` }}
                    title={`Run #${run.runNumber}: ${run.score}%`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Oldest</span>
                <span>Latest</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
