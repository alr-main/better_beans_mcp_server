/**
 * Manifest endpoint handler
 * Provides information about the available MCP methods
 */
import { Env } from '../index';
import { createCorsResponse } from '../utils/corsUtils';
import { serverManifest } from '../schema/manifest';

/**
 * Handles requests to the /manifest endpoint
 * @param request - The incoming request
 * @param env - Environment variables
 * @returns Response with MCP server manifest
 */
export async function handleManifestRequest(
  request: Request,
  env: Env
): Promise<Response> {
  // Return the server manifest
  return createCorsResponse(
    new Response(JSON.stringify(serverManifest), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  );
}
