/**
 * Server-Sent Events (SSE) Utilities
 * Provides functionality for streaming responses using SSE
 */
import { JsonRpcResponse, JsonRpcError } from '../schema/jsonRpc.js';
import { createCorsResponse } from './corsUtils.js';

/**
 * Options for SSE streaming
 */
export interface SseOptions {
  /**
   * Headers to include in the response
   */
  headers?: Record<string, string>;
  
  /**
   * Function to call when a client disconnects
   */
  onClose?: () => void;
}

/**
 * Creates a new SSE response stream
 * @param options - SSE options
 * @returns Response with SSE setup
 */
export function createSseStream(options: SseOptions = {}): [Response, WritableStreamDefaultWriter<Uint8Array>] {
  // Create a TransformStream for the SSE messages
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Set up headers for SSE
  // IMPORTANT: These headers are critical for proper SSE functionality
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
    'Transfer-Encoding': 'chunked',
    ...options.headers,
  });
  
  // Create a response with the stream
  let response = new Response(stream.readable, {
    headers,
    status: 200,
  });
  
  // When dealing with CORS and streams, we need to carefully manage the body
  // Use tee to create two identical readable streams
  if (response.body) {
    const [body1, body2] = response.body.tee();
    
    // One stream for CORS processing
    const corsResponse = createCorsResponse(new Response(body1, response));
    
    // Create the final response with the other stream
    response = new Response(body2, {
      headers: corsResponse.headers,
      status: corsResponse.status,
    });
    
    // Ensure SSE-specific headers aren't overwritten by CORS headers
    response.headers.set('Content-Type', 'text/event-stream');
    response.headers.set('Cache-Control', 'no-cache, no-transform');
    response.headers.set('Connection', 'keep-alive');
  } else {
    // Fallback for when there's no body
    response = createCorsResponse(response);
    response.headers.set('Content-Type', 'text/event-stream');
    response.headers.set('Cache-Control', 'no-cache, no-transform');
    response.headers.set('Connection', 'keep-alive');
  }
  
  // Set up client disconnect handling with appropriate error handling
  if (options.onClose && response.body) {
    // Create a clone of the body for disconnect handling
    const [body1, body2] = response.body.tee();
    response = new Response(body1, response);
    
    // Use the second stream for close detection
    body2.pipeTo(new WritableStream({
      close: options.onClose,
    })).catch(() => {
      // Client disconnected
      if (options.onClose) {
        options.onClose();
      }
    });
  }
  
  return [response, writer];
}

/**
 * Formats a message for SSE
 * @param data - The data to send
 * @param event - Optional event name
 * @param id - Optional event ID
 * @returns Formatted SSE message
 */
export function formatSseMessage(data: string, event?: string, id?: string): string {
  let message = '';
  
  if (id) {
    message += `id: ${id}\n`;
  }
  
  if (event) {
    message += `event: ${event}\n`;
  }
  
  // Split data by newlines and format each line
  // This is important for SSE protocol compliance
  const dataLines = data.split('\n');
  for (const line of dataLines) {
    message += `data: ${line}\n`;
  }
  
  // The SSE protocol requires a blank line to terminate each message
  message += '\n';
  
  return message;
}

/**
 * Writes a JSON-RPC success response to an SSE stream
 * @param writer - The stream writer
 * @param result - The result to send
 * @param id - The request ID
 * @param isFinal - Whether this is the final message
 */
export async function writeJsonRpcSuccessToStream(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  result: any,
  id: string | number,
  isFinal: boolean = false
): Promise<void> {
  // Create the JSON-RPC response
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    result,
    id,
  };
  
  // Add streaming metadata
  const streamResponse = {
    ...response,
    meta: {
      isFinal,
    },
  };
  
  // Format and write the message
  const message = formatSseMessage(
    JSON.stringify(streamResponse),
    isFinal ? 'result' : 'partial_result'
  );
  
  await writer.write(new TextEncoder().encode(message));
}

/**
 * Writes a JSON-RPC error response to an SSE stream
 * @param writer - The stream writer
 * @param error - The error to send
 * @param id - The request ID
 */
export async function writeJsonRpcErrorToStream(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  error: { code: number; message: string; data?: any },
  id: string | number | null
): Promise<void> {
  // Create the JSON-RPC error response
  const response: JsonRpcError = {
    jsonrpc: '2.0',
    error,
    id,
  };
  
  // Format and write the message
  const message = formatSseMessage(
    JSON.stringify(response),
    'error'
  );
  
  await writer.write(new TextEncoder().encode(message));
  await writer.close();
}

/**
 * Closes an SSE stream
 * @param writer - The stream writer
 */
export async function closeSseStream(writer: WritableStreamDefaultWriter<Uint8Array>): Promise<void> {
  try {
    await writer.close();
  } catch (error) {
    // Handle errors when closing the stream (typically if already closed)
    console.error('Error closing SSE stream:', error);
  }
}
