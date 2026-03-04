/**
 * Smart Supabase Mock
 *
 * An in-memory mock that behaves like a real Supabase database.
 * Supports filtering, sorting, and basic CRUD operations.
 */

import { vi } from 'vitest';

/**
 * Create a Supabase mock with in-memory data store
 * @param {Object} initialData - Initial table data { tableName: [records] }
 * @returns {Object} Mock Supabase client
 */
export function createSupabaseMock(initialData = {}) {
  const tables = new Map(Object.entries(initialData));
  const rpcHandlers = new Map();

  /**
   * Query builder that mimics Supabase's fluent API
   */
  class QueryBuilder {
    constructor(tableName) {
      this.tableName = tableName;
      this.data = [...(tables.get(tableName) || [])];
      this.filters = [];
      this.selectColumns = '*';
      this.orderByColumn = null;
      this.orderAscending = true;
      this.limitCount = null;
      this.offsetCount = 0;
      this.singleResult = false;
    }

    select(columns = '*') {
      this.selectColumns = columns;
      return this;
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    neq(column, value) {
      this.filters.push((row) => row[column] !== value);
      return this;
    }

    in(column, values) {
      this.filters.push((row) => values.includes(row[column]));
      return this;
    }

    contains(column, values) {
      this.filters.push((row) => {
        const arr = row[column];
        if (!Array.isArray(arr)) return false;
        return values.some((v) => arr.includes(v));
      });
      return this;
    }

    overlaps(column, values) {
      this.filters.push((row) => {
        const arr = row[column];
        if (!Array.isArray(arr)) return false;
        return values.some((v) => arr.includes(v));
      });
      return this;
    }

    cs(column, values) {
      // Contains (array contains all values)
      return this.contains(column, values);
    }

    ilike(column, pattern) {
      const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
      this.filters.push((row) => regex.test(row[column] || ''));
      return this;
    }

    like(column, pattern) {
      const regex = new RegExp(pattern.replace(/%/g, '.*'));
      this.filters.push((row) => regex.test(row[column] || ''));
      return this;
    }

    gte(column, value) {
      this.filters.push((row) => row[column] >= value);
      return this;
    }

    lte(column, value) {
      this.filters.push((row) => row[column] <= value);
      return this;
    }

    gt(column, value) {
      this.filters.push((row) => row[column] > value);
      return this;
    }

    lt(column, value) {
      this.filters.push((row) => row[column] < value);
      return this;
    }

    is(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    not(column, operator, value) {
      if (operator === 'eq') {
        this.filters.push((row) => row[column] !== value);
      } else if (operator === 'is') {
        this.filters.push((row) => row[column] !== value);
      }
      return this;
    }

    or(conditions) {
      // Parse OR conditions like "is_national.eq.true,coverage_state_codes.cs.{CA}"
      const parts = conditions.split(',');
      this.filters.push((row) => {
        return parts.some((part) => {
          const [col, op, val] = part.split('.');
          if (op === 'eq') {
            const parsedVal = val === 'true' ? true : val === 'false' ? false : val;
            return row[col] === parsedVal;
          }
          if (op === 'cs') {
            // Contains set - e.g., coverage_state_codes.cs.{CA,TX}
            const arr = row[col];
            if (!Array.isArray(arr)) return false;
            const values = val.replace(/[{}]/g, '').split(',');
            return values.some((v) => arr.includes(v.trim()));
          }
          return false;
        });
      });
      return this;
    }

    order(column, { ascending = true } = {}) {
      this.orderByColumn = column;
      this.orderAscending = ascending;
      return this;
    }

    limit(count) {
      this.limitCount = count;
      return this;
    }

    range(from, to) {
      this.offsetCount = from;
      this.limitCount = to - from + 1;
      return this;
    }

    single() {
      this.singleResult = true;
      return this;
    }

    maybeSingle() {
      this.singleResult = true;
      return this;
    }

    /**
     * Execute the query and return results
     */
    async then(resolve) {
      let result = this.data;

      // Apply filters
      for (const filter of this.filters) {
        result = result.filter(filter);
      }

      // Apply ordering
      if (this.orderByColumn) {
        result.sort((a, b) => {
          const aVal = a[this.orderByColumn];
          const bVal = b[this.orderByColumn];

          // Handle nulls - push to end
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;

          // Compare values
          if (aVal < bVal) return this.orderAscending ? -1 : 1;
          if (aVal > bVal) return this.orderAscending ? 1 : -1;
          return 0;
        });
      }

      // Apply offset
      if (this.offsetCount > 0) {
        result = result.slice(this.offsetCount);
      }

      // Apply limit
      if (this.limitCount !== null) {
        result = result.slice(0, this.limitCount);
      }

      // Return single result or array
      if (this.singleResult) {
        resolve({
          data: result[0] || null,
          error: null,
          count: result.length,
        });
      } else {
        resolve({
          data: result,
          error: null,
          count: result.length,
        });
      }
    }
  }

  /**
   * Insert builder
   */
  class InsertBuilder {
    constructor(tableName, records) {
      this.tableName = tableName;
      this.records = Array.isArray(records) ? records : [records];
      this.returnData = false;
      this.conflictColumns = null;
    }

    select() {
      this.returnData = true;
      return this;
    }

    onConflict(columns) {
      this.conflictColumns = columns;
      return this;
    }

    async then(resolve) {
      const table = tables.get(this.tableName) || [];

      const insertedRecords = this.records.map((record) => {
        // Generate ID if not provided
        if (!record.id) {
          record.id = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        record.created_at = record.created_at || new Date().toISOString();
        return record;
      });

      table.push(...insertedRecords);
      tables.set(this.tableName, table);

      resolve({
        data: this.returnData ? insertedRecords : null,
        error: null,
      });
    }
  }

  /**
   * Upsert builder
   */
  class UpsertBuilder {
    constructor(tableName, records) {
      this.tableName = tableName;
      this.records = Array.isArray(records) ? records : [records];
      this.returnData = false;
    }

    select() {
      this.returnData = true;
      return this;
    }

    async then(resolve) {
      const table = tables.get(this.tableName) || [];

      const upsertedRecords = this.records.map((record) => {
        const existingIndex = table.findIndex((r) => r.id === record.id);
        if (existingIndex >= 0) {
          // Update existing
          table[existingIndex] = { ...table[existingIndex], ...record };
          return table[existingIndex];
        } else {
          // Insert new
          if (!record.id) {
            record.id = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
          record.created_at = record.created_at || new Date().toISOString();
          table.push(record);
          return record;
        }
      });

      tables.set(this.tableName, table);

      resolve({
        data: this.returnData ? upsertedRecords : null,
        error: null,
      });
    }
  }

  /**
   * Update builder
   */
  class UpdateBuilder {
    constructor(tableName, updates) {
      this.tableName = tableName;
      this.updates = updates;
      this.filters = [];
      this.returnData = false;
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    select() {
      this.returnData = true;
      return this;
    }

    async then(resolve) {
      const table = tables.get(this.tableName) || [];
      const updatedRecords = [];

      for (let i = 0; i < table.length; i++) {
        const matchesAll = this.filters.every((filter) => filter(table[i]));
        if (matchesAll) {
          table[i] = { ...table[i], ...this.updates };
          updatedRecords.push(table[i]);
        }
      }

      tables.set(this.tableName, table);

      resolve({
        data: this.returnData ? updatedRecords : null,
        error: null,
      });
    }
  }

  /**
   * Delete builder
   */
  class DeleteBuilder {
    constructor(tableName) {
      this.tableName = tableName;
      this.filters = [];
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    async then(resolve) {
      const table = tables.get(this.tableName) || [];
      const remaining = table.filter(
        (row) => !this.filters.every((filter) => filter(row))
      );
      tables.set(this.tableName, remaining);

      resolve({
        data: null,
        error: null,
      });
    }
  }

  const mock = {
    from: (tableName) => ({
      select: (columns) => new QueryBuilder(tableName).select(columns),
      insert: (records) => new InsertBuilder(tableName, records),
      upsert: (records) => new UpsertBuilder(tableName, records),
      update: (updates) => new UpdateBuilder(tableName, updates),
      delete: () => new DeleteBuilder(tableName),
    }),

    rpc: async (functionName, params = {}) => {
      const handler = rpcHandlers.get(functionName);
      if (handler) {
        return handler(params);
      }
      return { data: null, error: { message: `RPC function ${functionName} not mocked` } };
    },

    /**
     * Test helpers
     */
    _setTable: (tableName, data) => {
      tables.set(tableName, [...data]);
    },

    _getTable: (tableName) => {
      return [...(tables.get(tableName) || [])];
    },

    _clearTable: (tableName) => {
      tables.set(tableName, []);
    },

    _clearAllTables: () => {
      tables.clear();
    },

    _registerRpc: (name, handler) => {
      rpcHandlers.set(name, handler);
    },

    _clearRpc: () => {
      rpcHandlers.clear();
    },
  };

  return mock;
}

/**
 * Create a mock for @supabase/supabase-js createClient
 */
export function createSupabaseClientMock(initialData = {}) {
  const mock = createSupabaseMock(initialData);
  return vi.fn(() => mock);
}

export default createSupabaseMock;
