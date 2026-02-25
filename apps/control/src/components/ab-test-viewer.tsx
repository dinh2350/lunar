'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ABResult {
  test_id: string;
  test_name: string;
  hypothesis: string;
  variant_a_name: string;
  variant_b_name: string;
  variant_a_score: number;
  variant_b_score: number;
  winner: 'a' | 'b' | 'tie';
  categories: Record<string, {
    variant_a: number;
    variant_b: number;
    delta: number;
    winner: string;
  }>;
  timestamp: string;
}

export function ABTestViewer() {
  const [results, setResults] = useState<ABResult[]>([]);
  const [selected, setSelected] = useState<ABResult | null>(null);

  useEffect(() => {
    fetch('/api/eval/ab-tests')
      .then(r => r.json())
      .then(data => {
        setResults(data.results || []);
        if (data.results?.length) setSelected(data.results[0]);
      });
  }, []);

  if (!selected) return <p>No A/B test results yet. Run one from CLI first.</p>;

  const maxScore = Math.max(selected.variant_a_score, selected.variant_b_score);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">🔬 A/B Test: {selected.test_name}</h3>
      <p className="text-sm text-muted-foreground italic">
        Hypothesis: {selected.hypothesis}
      </p>

      {/* Score Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <Card className={selected.winner === 'a' ? 'border-green-500 border-2' : ''}>
          <CardContent className="pt-4 text-center">
            <p className="text-sm">Variant A: {selected.variant_a_name}</p>
            <p className="text-4xl font-bold">{selected.variant_a_score}%</p>
            {selected.winner === 'a' && <Badge className="bg-green-500 mt-2">WINNER</Badge>}
          </CardContent>
        </Card>
        <Card className={selected.winner === 'b' ? 'border-green-500 border-2' : ''}>
          <CardContent className="pt-4 text-center">
            <p className="text-sm">Variant B: {selected.variant_b_name}</p>
            <p className="text-4xl font-bold">{selected.variant_b_score}%</p>
            {selected.winner === 'b' && <Badge className="bg-green-500 mt-2">WINNER</Badge>}
          </CardContent>
        </Card>
      </div>

      {/* Category Comparison Bars */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(selected.categories).map(([cat, data]) => (
            <div key={cat}>
              <div className="flex justify-between text-sm mb-1">
                <span>{cat}</span>
                <span className={data.delta > 0 ? 'text-green-600' : data.delta < 0 ? 'text-red-600' : ''}>
                  {data.delta > 0 ? '+' : ''}{data.delta}%
                </span>
              </div>
              <div className="flex gap-1 h-6">
                <div
                  className="bg-blue-500 rounded-l flex items-center justify-end pr-1 text-xs text-white"
                  style={{ width: `${(data.variant_a / maxScore) * 50}%` }}
                >
                  {data.variant_a}%
                </div>
                <div
                  className="bg-orange-500 rounded-r flex items-center pl-1 text-xs text-white"
                  style={{ width: `${(data.variant_b / maxScore) * 50}%` }}
                >
                  {data.variant_b}%
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-blue-500 rounded" /> Variant A
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-orange-500 rounded" /> Variant B
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
