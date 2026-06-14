import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point the app at a throwaway temp directory BEFORE any module reads config,
// so tests never touch the real ./data/app.db or uploads. Runs once per test
// file (before the file's imports are evaluated).
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'rcv-test-'));
process.env.SESSION_SECRET = 'test-secret-do-not-use';
process.env.ADMIN_PASSWORD = 'test-pass';
