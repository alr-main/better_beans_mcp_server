// This script creates a test RPC call with hardcoded chocolate coffee results
// to validate Claude can parse and display them correctly
import fetch from 'node-fetch';

async function sendHardcodedResponse() {
  console.log('\n===== SENDING HARDCODED COFFEE RESPONSE =====');
  
  try {
    // Simulate Claude's exact request format
    const rpcRequest = {
      "jsonrpc": "2.0",
      "method": "call_tool",
      "params": {
        "name": "similarity_search",
        "arguments": {
          "`flavorProfile`": [
            "`chocolate`",
            "`dark chocolate`",
            "`cocoa`"
          ],
          "`maxResults`": 10
        }
      },
      "id": 1
    };
    
    console.log('Making direct JSON-RPC request with hardcoded results');
    
    const response = await fetch('https://better-beans-mcp-server.al-ricotta.workers.dev/debug/hardcoded', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rpcRequest)
    });
    
    console.log(`Response status: ${response.status}`);
    
    // Get the response text first to debug potential JSON parsing issues
    const responseText = await response.text();
    console.log('Raw response text:', responseText);
    
    try {
      // Try to parse the JSON response
      const responseJson = JSON.parse(responseText);
      console.log('Parsed JSON response:', JSON.stringify(responseJson, null, 2));
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
sendHardcodedResponse();
