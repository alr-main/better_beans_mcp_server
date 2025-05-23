// Script to debug Claude's exact request format and see what's happening
import fetch from 'node-fetch';

// Create a function to make a direct RPC call exactly as Claude would
async function testDirectRpc() {
  console.log('\n===== DIRECT JSON-RPC TEST =====');
  console.log('This test exactly mimics Claude\'s JSON-RPC format');
  
  try {
    // This is the exact format Claude seems to be using
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
    
    console.log(`Making direct JSON-RPC request to https://better-beans-mcp-server.al-ricotta.workers.dev/rpc`);
    console.log('Request payload:', JSON.stringify(rpcRequest, null, 2));
    
    const response = await fetch('https://better-beans-mcp-server.al-ricotta.workers.dev/rpc', {
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
      
      // Check if we have results
      if (responseJson.result && 
          responseJson.result.results && 
          Array.isArray(responseJson.result.results)) {
        console.log(`Found ${responseJson.result.results.length} results`);
      } else {
        console.log('No results found in the response');
      }
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
    }
  } catch (error) {
    console.error('Error in direct RPC test:', error);
  }
}

// Also test the MCP initialize call to check if that works properly
async function testMcpInitialize() {
  console.log('\n===== MCP INITIALIZE TEST =====');
  
  try {
    const initRequest = {
      "jsonrpc": "2.0",
      "method": "initialize",
      "params": {
        "protocolVersion": "0.1",
        "authentication": {
          "type": "none"
        }
      },
      "id": 1
    };
    
    console.log('Making MCP initialize request');
    
    const response = await fetch('https://better-beans-mcp-server.al-ricotta.workers.dev/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(initRequest)
    });
    
    console.log(`Response status: ${response.status}`);
    const responseData = await response.json();
    console.log('MCP initialize response:', JSON.stringify(responseData, null, 2));
  } catch (error) {
    console.error('Error in MCP initialize test:', error);
  }
}

// Run both tests
async function runTests() {
  await testMcpInitialize();
  await testDirectRpc();
}

runTests();
