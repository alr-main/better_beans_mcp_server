// Test script for checking the MCP manifest endpoint
import fetch from 'node-fetch';

async function testManifestEndpoint() {
  const BASE_URL = 'https://better-beans-mcp-server.al-ricotta.workers.dev/manifest';
  
  console.log('\n===== TESTING MCP MANIFEST ENDPOINT =====');
  
  try {
    // Make a GET request to the manifest endpoint
    console.log(`Making GET request to ${BASE_URL}...`);
    const response = await fetch(BASE_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const manifestData = await response.json();
    console.log('Manifest response status:', response.status);
    console.log('Manifest response:', JSON.stringify(manifestData, null, 2));
    
    // Check if the manifest has the required fields
    console.log('\nChecking manifest structure:');
    console.log('- Has mcp_version:', manifestData.mcp_version !== undefined);
    console.log('- Has name_for_model:', manifestData.name_for_model !== undefined);
    console.log('- Has api info:', manifestData.api !== undefined);
    console.log('- Has functions array:', Array.isArray(manifestData.functions));
    
    // Check the API configuration
    if (manifestData.api) {
      console.log('\nAPI configuration:');
      console.log('- Type:', manifestData.api.type);
      console.log('- URL:', manifestData.api.url);
      
      // Check if the API URL matches our expected format
      const expectedUrlBase = 'https://better-beans-mcp-server.al-ricotta.workers.dev/rpc';
      if (manifestData.api.url !== expectedUrlBase) {
        console.error(`⚠️ WARNING: API URL ${manifestData.api.url} does not match expected ${expectedUrlBase}`);
      }
    }
    
    // Check functions array for proper parameter structure
    if (Array.isArray(manifestData.functions) && manifestData.functions.length > 0) {
      console.log(`\nFound ${manifestData.functions.length} functions in manifest`);
      
      const firstFunction = manifestData.functions[0];
      console.log('First function structure:');
      console.log('- Name:', firstFunction.name);
      console.log('- Description:', firstFunction.description);
      console.log('- Has parameters:', firstFunction.parameters !== undefined);
      
      // Check function schemas
      if (firstFunction.parameters) {
        console.log('- Parameters type:', firstFunction.parameters.type);
        console.log('- Has properties:', firstFunction.parameters.properties !== undefined);
      }
    }
    
    // Test the RPC URL to make sure it's accessible
    const rpcUrl = manifestData.api?.url || 'https://better-beans-mcp-server.al-ricotta.workers.dev/rpc';
    console.log(`\nTesting RPC endpoint ${rpcUrl}...`);
    
    // Make a simple POST request to verify the RPC endpoint is working
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05'
        },
        id: 1
      })
    });
    
    console.log('RPC response status:', rpcResponse.status);
    if (rpcResponse.ok) {
      const rpcData = await rpcResponse.json();
      console.log('RPC initialize response:', JSON.stringify(rpcData, null, 2));
    } else {
      console.error(`⚠️ ERROR: RPC endpoint returned ${rpcResponse.status} ${rpcResponse.statusText}`);
    }
    
  } catch (error) {
    console.error('Error testing manifest endpoint:', error);
  }
}

// Run the test
testManifestEndpoint();
