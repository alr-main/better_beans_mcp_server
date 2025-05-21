/**
 * Creates a new SSE response stream
 * @param options - SSE options
 * @returns Response with SSE setup
 */
export function createSseStream(options = {}) {
    // Create a TransformStream for the SSE messages
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    // Set up headers for SSE
    const headers = new Headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
        ...options.headers,
    });
    // Create a response with the stream
    const response = new Response(stream.readable, {
        headers,
    });
    // Set up client disconnect handling
    if (options.onClose) {
        response.body?.pipeTo(new WritableStream({
            abort: options.onClose,
            close: options.onClose,
        })).catch(() => {
            // Handle pipe errors (typically client disconnection)
            options.onClose?.();
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
export function formatSseMessage(data, event, id) {
    let message = '';
    if (id) {
        message += `id: ${id}\n`;
    }
    if (event) {
        message += `event: ${event}\n`;
    }
    // Split data by newlines and format each line
    const dataLines = data.split('\n');
    for (const line of dataLines) {
        message += `data: ${line}\n`;
    }
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
export async function writeJsonRpcSuccessToStream(writer, result, id, isFinal = false) {
    // Create the JSON-RPC response
    const response = {
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
    const message = formatSseMessage(JSON.stringify(streamResponse), isFinal ? 'result' : 'partial_result');
    await writer.write(new TextEncoder().encode(message));
}
/**
 * Writes a JSON-RPC error response to an SSE stream
 * @param writer - The stream writer
 * @param error - The error to send
 * @param id - The request ID
 */
export async function writeJsonRpcErrorToStream(writer, error, id) {
    // Create the JSON-RPC error response
    const response = {
        jsonrpc: '2.0',
        error,
        id,
    };
    // Format and write the message
    const message = formatSseMessage(JSON.stringify(response), 'error');
    await writer.write(new TextEncoder().encode(message));
    await writer.close();
}
/**
 * Closes an SSE stream
 * @param writer - The stream writer
 */
export async function closeSseStream(writer) {
    try {
        await writer.close();
    }
    catch (error) {
        // Handle errors when closing the stream (typically if already closed)
        console.error('Error closing SSE stream:', error);
    }
}
