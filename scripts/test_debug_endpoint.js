// Test script for the debug endpoint
import fetch from 'node-fetch';

// Claude's exact request format
const claudeRequest = {
  flavorProfile: [
    "chocolate",
    "dark chocolate",
    "cocoa"
  ],
  maxResults: 10
};

// Claude's backtick-wrapped format version
const claudeBacktickRequest = {
  flavorProfile: [
    "`chocolate`",
    "`dark chocolate`",
    "`cocoa`"
  ],
  maxResults: 10
};

// The exact JSON you shared
const exactClaudeFormat = {
  "`flavorProfile`": [
    "`chocolate`",
    "`dark chocolate`",
    "`cocoa`"
  ],
  "`maxResults`": 10
};

async function testDebugEndpoint() {
  console.log('Testing debug endpoint with Claude request formats...');
  
  const url = 'https://better-beans-mcp-server.al-ricotta.workers.dev/debug/similarity_search';
  
  // Test all three formats
  const formats = [
    { name: 'Standard Format', data: claudeRequest },
    { name: 'Backtick Values Format', data: claudeBacktickRequest },
    { name: 'Exact Claude Format', data: exactClaudeFormat }
  ];
  
  for (const format of formats) {
    console.log(`\n----- Testing ${format.name} -----`);
    console.log('Request:', JSON.stringify(format.data, null, 2));
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(format.data)
      });
      
      const result = await response.json();
      
      console.log('Response Status:', response.status);
      console.log('Result found:', result.results ? result.results.length : 0, 'coffees');
      
      if (result.results && result.results.length > 0) {
        // Show first 2 results for brevity
        result.results.slice(0, 2).forEach((item, i) => {
          console.log(`\nResult ${i + 1}:`);
          console.log(`- Name: ${item.coffee.name}`);
          console.log(`- Similarity: ${item.similarityScore}`);
          console.log(`- Flavor tags: ${item.coffee.flavorTags.join(', ')}`);
          console.log(`- Product URL: ${item.coffee.productUrl || 'N/A'}`);
        });
      } else {
        console.log('No results found');
      }
    } catch (error) {
      console.error('Error testing endpoint:', error);
    }
  }
}

// Run the test
testDebugEndpoint();
