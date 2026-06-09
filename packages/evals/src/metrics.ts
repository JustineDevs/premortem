export interface EvalMetric {
  name: 'precision' | 'merge_quality' | 'duplicate_suppression' | 'false_positive_rate';
  value: number;
}
