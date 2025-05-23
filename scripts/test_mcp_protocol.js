// Test script for the MCP protocol initialization and tools listing
import fetch from 'node-fetch';

// This script tests the full MCP protocol flow:
// 1. Initialize the connection
// 2. List available tools
// 3. Call a tool (similarity_search)

async function testMcpProtocol() {
  const BASE_URL = 'https://better-beans-mcp-server.al-ricotta.workers.dev/rpc';
  
  console.log('\n===== TESTING MCP PROTOCOL =====');
  console.log('This test exactly mimics the client MCP protocol flow');
  
  try {
    // Step 1: Initialize the connection
    console.log('\n----- Step 1: MCP Initialize -----');
    const initializeRequest = {
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "0.1",
        authentication: {
          type: "none"
        }
      },
      id: 1
    };
    
    console.log('Making initialize request...');
    const initResponse = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(initializeRequest)
    });
    
    if (!initResponse.ok) {
      throw new Error(`HTTP error: ${initResponse.status}`);
    }
    
    const initData = await initResponse.json();
    console.log('Initialize response status:', initResponse.status);
    console.log('Initialize response:', JSON.stringify(initData, null, 2));
    
    // Step 2: List tools
    console.log('\n----- Step 2: List Tools -----');
    const listToolsRequest = {
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: 2
    };
    
    console.log('Making tools/list request...');
    const toolsResponse = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(listToolsRequest)
    });
    
    if (!toolsResponse.ok) {
      throw new Error(`HTTP error: ${toolsResponse.status}`);
    }
    
    const toolsData = await toolsResponse.json();
    console.log('Tools list response status:', toolsResponse.status);
    console.log('Tools list response:', JSON.stringify(toolsData, null, 2));
    
    // Check if tools are properly formatted
    if (toolsData.result && toolsData.result.tools) {
      console.log(`Found ${toolsData.result.tools.length} tools in the response`);
      
      // Check for inputSchema vs parameters
      const firstTool = toolsData.result.tools[0];
      console.log('\nFirst tool structure:');
      console.log('- name:', firstTool.name);
      console.log('- description:', firstTool.description);
      console.log('- has inputSchema:', firstTool.inputSchema !== undefined);
      console.log('- has parameters:', firstTool.parameters !== undefined);
      
      if (!firstTool.inputSchema && firstTool.parameters) {
        console.error('ERROR: Tools have "parameters" instead of "inputSchema" - this breaks Claude tools!');
      }
    } else {
      console.error('No tools found in the response!');
    }
    
    // Step 3: Call the similarity_search tool
    console.log('\n----- Step 3: Call Tool (similarity_search) -----');
    const callToolRequest = {
      jsonrpc: "2.0",
      method: "call_tool",
      params: {
        name: "similarity_search",
        arguments: {
          flavorProfile: ["chocolate", "nutty"],
          maxResults: 5
        }
      },
      id: 3
    };
    
    console.log('Making call_tool request...');
    const callResponse = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(callToolRequest)
    });
    
    if (!callResponse.ok) {
      throw new Error(`HTTP error: ${callResponse.status}`);
    }
    
    const callData = await callResponse.json();
    console.log('Call tool response status:', callResponse.status);
    console.log('Call tool response structure:', Object.keys(callData.result).join(', '));
    
    // Check if the response has content wrapping
    if (callData.result.content) {
      console.log('Response has content wrapping - checking format...');
      
      if (Array.isArray(callData.result.content) && 
          callData.result.content[0] && 
          callData.result.content[0].type === 'text') {
        console.log('Content array is properly formatted');
        
        // Check if text is string or object
        const textField = callData.result.content[0].text;
        console.log('Text field type:', typeof textField);
        
        if (typeof textField === 'string') {
          try {
            // Try to parse the content to check format
            const parsedResults = JSON.parse(textField);
            console.log(`Parsed results have ${parsedResults.results ? parsedResults.results.length : 0} coffees`);
          } catch (e) {
            console.error('Error parsing text content:', e);
          }
        } else if (typeof textField === 'object') {
          console.error('Text field is an object instead of a string - this breaks Claude!');
        }
      }
    } else {
      console.log('Response does not have content wrapping');
    }
    
  } catch (error) {
    console.error('Error testing MCP protocol:', error);
  }
}

// Run the test
testMcpProtocol();
