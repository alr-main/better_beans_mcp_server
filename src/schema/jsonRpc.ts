/**
 * JSON-RPC Schema Definitions
 * Types and interfaces for JSON-RPC 2.0 requests and responses
 */

/**
 * JSON-RPC 2.0 request structure
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, any>;
  id: string | number;
}

/**
 * JSON-RPC 2.0 batch request array
 */
export type JsonRpcBatchRequest = JsonRpcRequest[];

/**
 * JSON-RPC 2.0 success response structure
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result: any;
  id: string | number;
}

/**
 * JSON-RPC 2.0 error object structure
 */
export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: any;
}

/**
 * JSON-RPC 2.0 error response structure
 */
export interface JsonRpcError {
  jsonrpc: '2.0';
  error: JsonRpcErrorObject;
  id: string | number | null;
}

/**
 * Union type for both success and error responses
 */
export type JsonRpcResponseType = JsonRpcResponse | JsonRpcError;

/**
 * JSON-RPC 2.0 batch response array
 */
export type JsonRpcBatchResponse = JsonRpcResponseType[];
