import { open, type DB, type Scalar, type Transaction } from '@op-engineering/op-sqlite';

import {
  type Row,
  type RunResult,
  type SqlDriver,
  type SqlExecutor,
  type SqlValue,
} from './SqlDriver';

/**
 * op-sqlite runs every `execute` on its own native thread, so queries never
 * block JS. Blobs come back as ArrayBuffer and are normalised to Uint8Array to
 * match the driver contract.
 */
export function openOpSqliteDriver(name = 'murmur.db'): SqlDriver {
  const db = open({ name });
  db.executeSync('PRAGMA journal_mode = WAL');
  db.executeSync('PRAGMA foreign_keys = ON');
  return wrap(db);
}

function wrap(db: DB): SqlDriver {
  const executor = executorFor((sql, params) => db.execute(sql, params));
  return {
    ...executor,
    async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      let result: T | undefined;
      await db.transaction(async (tx: Transaction) => {
        result = await work(executorFor((sql, params) => tx.execute(sql, params)));
      });
      return result as T;
    },
    close: () => db.close(),
  };
}

type Execute = (
  sql: string,
  params: Scalar[],
) => Promise<{ rows: Record<string, Scalar>[]; rowsAffected: number; insertId?: number }>;

function executorFor(execute: Execute): SqlExecutor {
  return {
    async query<T extends Row = Row>(sql: string, params: readonly SqlValue[] = []) {
      const result = await execute(sql, [...params]);
      return result.rows.map(normaliseRow) as T[];
    },
    async run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
      const result = await execute(sql, [...params]);
      return { rowsAffected: result.rowsAffected, insertId: result.insertId };
    },
  };
}

function normaliseRow(row: Record<string, Scalar>): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof ArrayBuffer) out[key] = new Uint8Array(value);
    else if (ArrayBuffer.isView(value))
      out[key] = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    else if (typeof value === 'boolean') out[key] = value ? 1 : 0;
    else out[key] = value;
  }
  return out;
}
