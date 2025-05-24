/**
 * Secure Query Pipeline
 * Provides a secure interface for database operations with role-based access control,
 * input validation, parameterized queries, and audit logging.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../index.js';
import { getSupabaseClient } from './supabaseClient.js';

// Define user roles for access control
export enum UserRole {
  ADMIN = 'ADMIN',       // Full access to all operations
  USER = 'USER',         // Access to create, read, update for owned resources
  ANONYMOUS = 'ANONYMOUS' // Read-only access to public resources
}

// Define operation types for audit logging
export enum OperationType {
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  RAW_QUERY = 'RAW_QUERY'
}

// Define allowed tables and their operations per role
const rolePermissions: Record<UserRole, Record<string, OperationType[]>> = {
  [UserRole.ADMIN]: {
    'coffees': [OperationType.READ, OperationType.CREATE, OperationType.UPDATE, OperationType.DELETE],
    'roasters': [OperationType.READ, OperationType.CREATE, OperationType.UPDATE, OperationType.DELETE],
    'users': [OperationType.READ, OperationType.CREATE, OperationType.UPDATE, OperationType.DELETE],
    // Admin can access all tables
  },
  [UserRole.USER]: {
    'coffees': [OperationType.READ],
    'roasters': [OperationType.READ],
    // Users can only read coffee and roaster data
  },
  [UserRole.ANONYMOUS]: {
    'coffees': [OperationType.READ],
    'roasters': [OperationType.READ],
    // Anonymous users can only read public data
  }
};

// Validate table name to prevent SQL injection
function validateTableName(tableName: string): boolean {
  // Only allow alphanumeric characters and underscores
  const validTableNameRegex = /^[a-zA-Z0-9_]+$/;
  return validTableNameRegex.test(tableName);
}

// Validate column names to prevent SQL injection
function validateColumnNames(columnNames: string[]): boolean {
  const validColumnNameRegex = /^[a-zA-Z0-9_\(\),\s*]+$/;
  return columnNames.every(column => validColumnNameRegex.test(column));
}

// Log database operations for audit purposes
async function logOperation(
  env: Env,
  operation: OperationType,
  table: string,
  userRole: UserRole,
  details: string
): Promise<void> {
  console.log(`[AUDIT] ${operation} on ${table} by ${userRole}: ${details}`);
  
  // In a real implementation, you would store this in a database table
  // await supabase.from('audit_logs').insert({
  //   operation,
  //   table,
  //   user_role: userRole,
  //   details,
  //   timestamp: new Date().toISOString()
  // });
}

// Check if operation is allowed for the given role and table
function isOperationAllowed(
  role: UserRole,
  table: string,
  operation: OperationType
): boolean {
  if (!validateTableName(table)) {
    console.error(`Invalid table name: ${table}`);
    return false;
  }
  
  const allowedOperations = rolePermissions[role]?.[table] || [];
  return allowedOperations.includes(operation);
}

/**
 * Secure database query executor
 * @param env - Environment variables
 * @param role - User role for access control
 * @param table - Table to operate on
 * @param operation - Type of operation
 * @param queryFunction - Function that executes the query
 * @returns Query result
 */
export async function secureQuery<T>(
  env: Env,
  role: UserRole,
  table: string,
  operation: OperationType,
  queryFunction: (client: SupabaseClient<any>) => Promise<T>
): Promise<T> {
  // Validate permissions
  if (!isOperationAllowed(role, table, operation)) {
    throw new Error(`Operation ${operation} on table ${table} not allowed for role ${role}`);
  }
  
  try {
    // Get Supabase client
    const supabase = getSupabaseClient(env);
    
    // Log the operation
    await logOperation(env, operation, table, role, 'Starting operation');
    
    // Execute the query
    const result = await queryFunction(supabase);
    
    // Log successful completion
    await logOperation(env, operation, table, role, 'Operation completed successfully');
    
    return result;
  } catch (error) {
    // Log error
    console.error(`Error in secure query: ${error}`);
    await logOperation(env, operation, table, role, `Error: ${error}`);
    throw error;
  }
}

/**
 * Execute a secure read operation
 * @param env - Environment variables
 * @param role - User role for access control
 * @param table - Table to read from
 * @param columns - Columns to select
 * @param conditions - Optional query conditions
 * @returns Query result
 */
export async function secureRead(
  env: Env,
  role: UserRole,
  table: string,
  columns: string | string[],
  conditions?: Record<string, any>
): Promise<any> {
  const columnList = typeof columns === 'string' ? [columns] : columns;
  const columnsValue = typeof columns === 'string' ? columns : columns.join(',');
  
  if (!validateTableName(table) || !validateColumnNames(columnList)) {
    throw new Error('Invalid table or column names');
  }
  
  return secureQuery(env, role, table, OperationType.READ, async (supabase) => {
    let query = supabase.from(table).select(columnsValue);
    
    // Apply conditions if provided
    if (conditions) {
      Object.entries(conditions).forEach(([key, value]) => {
        // Using type assertion here for simplicity
        (query as any) = (query as any).eq(key, value);
      });
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return data;
  });
}

/**
 * Execute a secure single-record read operation
 * @param env - Environment variables
 * @param role - User role for access control
 * @param table - Table to read from
 * @param columns - Columns to select
 * @param conditions - Query conditions to identify the record
 * @returns Single record or null
 */
export async function secureReadSingle(
  env: Env,
  role: UserRole,
  table: string,
  columns: string | string[],
  conditions: Record<string, any>
): Promise<any> {
  const columnList = typeof columns === 'string' ? [columns] : columns;
  const columnsValue = typeof columns === 'string' ? columns : columns.join(',');
  
  if (!validateTableName(table) || !validateColumnNames(columnList)) {
    throw new Error('Invalid table or column names');
  }
  
  return secureQuery(env, role, table, OperationType.READ, async (supabase) => {
    let query = supabase.from(table).select(columnsValue);
    
    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      // Using type assertion here for simplicity
      (query as any) = (query as any).eq(key, value);
    });
    
    const { data, error } = await query.single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned error
        return null;
      }
      throw error;
    }
    
    return data;
  });
}
