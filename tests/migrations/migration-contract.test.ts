import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('migration forward and rollback compatibility contract', () => {
  it('keeps the journal and SQL files contiguous and complete', async () => {
    const directory = resolve(process.cwd(), 'db/migrations');
    const journal = JSON.parse(await readFile(resolve(directory, 'meta/_journal.json'), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    const files = (await readdir(directory)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
    expect(journal.entries.map((entry) => entry.idx)).toEqual(journal.entries.map((_, index) => index));
    expect(files.map((file) => file.replace(/\.sql$/, ''))).toEqual(journal.entries.map((entry) => entry.tag));
  });

  it('uses additive migrations so the previous application can run during rollback', async () => {
    const directory = resolve(process.cwd(), 'db/migrations');
    const files = (await readdir(directory)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
    const violations: string[] = [];
    for (const file of files.slice(1)) {
      const sql = await readFile(resolve(directory, file), 'utf8');
      if (/\bDROP\s+(TABLE|COLUMN)\b/i.test(sql)) violations.push(`${file}: destructive table/column removal`);
      if (/\bALTER\s+TYPE\b[\s\S]*\bRENAME\s+VALUE\b/i.test(sql)) violations.push(`${file}: destructive enum rename`);
      if (/\bALTER\s+TABLE\b[\s\S]*\bALTER\s+COLUMN\b[\s\S]*\bSET\s+NOT\s+NULL\b/i.test(sql)) violations.push(`${file}: incompatible not-null tightening`);
    }
    expect(violations).toEqual([]);
  });
});
