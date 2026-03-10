export interface EsocialXsdValidationResult {
  status: 'validated' | 'failed' | 'skipped';
  schemaPath?: string;
  errors: string[];
}
