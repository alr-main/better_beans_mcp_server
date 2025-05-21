import { createCorsResponse } from '../utils/corsUtils';
import { validateApiKey } from '../auth/apiKeyValidation';
import { methodRouter } from '../services/methodRouter';
import { createSseStream, writeJsonRpcSuccessToStream, writeJsonRpcErrorToStream, closeSseStream } from '../utils/sseUtils';
// Standard JSON-RPC error codes
const ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    UNAUTHORIZED: -32001,
    RATE_LIMIT_EXCEEDED: -32002,
    STREAMING_NOT_SUPPORTED: -32003,
};
/**
 * Handles requests to the /rpc endpoint
 * Supports both standard and streaming responses
 * @param request - The incoming request
 * @param env - Environment variables
 * @param ctx - Execution context
 * @returns Response with the result of the RPC call
 */
export async function handleRpcRequest(request, env, ctx) {
    // Only allow POST requests
    if (request.method !== 'POST') {
        return createCorsResponse(new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: {
                code: ERROR_CODES.INVALID_REQUEST,
                message: 'Method not allowed. Only POST requests are supported.',
            },
            id: null,
        }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                'Allow': 'POST',
            },
        }));
    }
    // Check if client wants streaming response
    const acceptHeader = request.headers.get('Accept') || '';
    const isStreamingRequested = acceptHeader.includes('text/event-stream');
    // Parse the request body
    let rpcRequest;
    try {
        rpcRequest = await request.json();
    }
    catch (error) {
        return createJsonRpcErrorResponse({
            code: ERROR_CODES.PARSE_ERROR,
            message: 'Invalid JSON in request body',
            id: null,
        });
    }
    // Validate JSON-RPC structure
    if (!isValidJsonRpcRequest(rpcRequest)) {
        return createJsonRpcErrorResponse({
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Invalid JSON-RPC request format',
            id: rpcRequest && 'id' in rpcRequest ? rpcRequest.id : null,
        });
    }
    // Get the API key from the request headers
    const apiKey = request.headers.get('X-Api-Key') || '';
    // Validate the API key (skip in development mode)
    if (env.WORKER_ENV !== 'development') {
        const { valid, error } = await validateApiKey(apiKey, env);
        if (!valid) {
            return createJsonRpcErrorResponse({
                code: ERROR_CODES.UNAUTHORIZED,
                message: error || 'Unauthorized: Invalid API key',
                id: rpcRequest.id,
            });
        }
    }
    // Process the method call
    try {
        // Set up for streaming if requested
        if (isStreamingRequested) {
            return await handleStreamingRequest(rpcRequest, env, ctx);
        }
        else {
            // Standard non-streaming response
            const result = await methodRouter(rpcRequest.method, rpcRequest.params, env);
            // Return the successful response
            return createJsonRpcSuccessResponse({
                result,
                id: rpcRequest.id,
            });
        }
    }
    catch (error) {
        console.error(`Error processing method ${rpcRequest.method}:`, error);
        // Handle specific error types
        if (error instanceof Error) {
            if (error.code === 'INVALID_PARAMS') {
                return createJsonRpcErrorResponse({
                    code: ERROR_CODES.INVALID_PARAMS,
                    message: error.message,
                    id: rpcRequest.id,
                });
            }
            else if (error.code === 'METHOD_NOT_FOUND') {
                return createJsonRpcErrorResponse({
                    code: ERROR_CODES.METHOD_NOT_FOUND,
                    message: `Method '${rpcRequest.method}' not found`,
                    id: rpcRequest.id,
                });
            }
            else if (error.code === 'STREAMING_NOT_SUPPORTED') {
                return createJsonRpcErrorResponse({
                    code: ERROR_CODES.STREAMING_NOT_SUPPORTED,
                    message: `Streaming is not supported for method '${rpcRequest.method}'`,
                    id: rpcRequest.id,
                });
            }
        }
        // Default to internal error
        return createJsonRpcErrorResponse({
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Internal server error',
            id: rpcRequest.id,
        });
    }
}
/**
 * Creates a JSON-RPC success response
 * @param response - The success response data
 * @returns Response object with proper formatting
 */
function createJsonRpcSuccessResponse(response) {
    const jsonRpcResponse = {
        jsonrpc: '2.0',
        result: response.result,
        id: response.id,
    };
    return createCorsResponse(new Response(JSON.stringify(jsonRpcResponse), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
    }));
}
/**
 * Creates a JSON-RPC error response
 * @param error - The error response data
 * @returns Response object with proper formatting
 */
function createJsonRpcErrorResponse(error) {
    const jsonRpcError = {
        jsonrpc: '2.0',
        error: {
            code: error.code,
            message: error.message,
        },
        id: error.id,
    };
    return createCorsResponse(new Response(JSON.stringify(jsonRpcError), {
        status: 200, // JSON-RPC uses 200 OK even for errors
        headers: {
            'Content-Type': 'application/json',
        },
    }));
}
/**
 * Handles a streaming RPC request using Server-Sent Events
 * @param rpcRequest - The JSON-RPC request
 * @param env - Environment variables
 * @param ctx - Execution context
 * @returns Streaming response
 */
async function handleStreamingRequest(rpcRequest, env, ctx) {
    // Create an SSE stream
    const [response, writer] = createSseStream({
        onClose: () => console.log(`Stream closed for request ${rpcRequest.id}`),
    });
    // Execute the method in a non-blocking way
    ctx.waitUntil((async () => {
        try {
            // Check if the method supports streaming
            const streamResult = await methodRouter(rpcRequest.method, rpcRequest.params, env, {
                streaming: true,
                onPartialResult: async (partialResult) => {
                    try {
                        await writeJsonRpcSuccessToStream(writer, partialResult, rpcRequest.id, false // Not final
                        );
                    }
                    catch (error) {
                        console.error(`Error writing partial result to stream:`, error);
                    }
                }
            });
            // Write the final result
            await writeJsonRpcSuccessToStream(writer, streamResult, rpcRequest.id, true // Final result
            );
        }
        catch (error) {
            console.error(`Error in streaming request:`, error);
            // Determine the error code and message
            let errorCode = ERROR_CODES.INTERNAL_ERROR;
            let errorMessage = 'Internal server error';
            if (error instanceof Error) {
                if (error.code === 'INVALID_PARAMS') {
                    errorCode = ERROR_CODES.INVALID_PARAMS;
                    errorMessage = error.message;
                }
                else if (error.code === 'METHOD_NOT_FOUND') {
                    errorCode = ERROR_CODES.METHOD_NOT_FOUND;
                    errorMessage = `Method '${rpcRequest.method}' not found`;
                }
                else if (error.code === 'STREAMING_NOT_SUPPORTED') {
                    errorCode = ERROR_CODES.STREAMING_NOT_SUPPORTED;
                    errorMessage = `Streaming is not supported for method '${rpcRequest.method}'`;
                }
                else {
                    errorMessage = error.message || errorMessage;
                }
            }
            // Write the error to the stream
            await writeJsonRpcErrorToStream(writer, {
                code: errorCode,
                message: errorMessage,
            }, rpcRequest.id);
        }
        finally {
            // Always close the stream at the end
            await closeSseStream(writer);
        }
    })());
    return response;
}
/**
 * Validates that a request follows the JSON-RPC 2.0 format
 * @param request - The request to validate
 * @returns Whether the request is valid
 */
function isValidJsonRpcRequest(request) {
    return (request &&
        request.jsonrpc === '2.0' &&
        typeof request.method === 'string' &&
        (request.id === undefined || typeof request.id === 'string' || typeof request.id === 'number') &&
        (request.params === undefined || typeof request.params === 'object'));
}
