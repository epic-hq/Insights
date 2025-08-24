# Agentic Workflow

using copilotKit + mastra

## User stories


## Storyboard


## Implementation


```js
import React from 'react';
import { CopilotChat } from 'your-copilot-chat-library'; // Adjust the import based on your setup

const App = () => {
  const invokeWorkflow = async (userInput) => {
    try {
      const response = await fetch('https://your-backend-url/run-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userInput }),
      });

      if (!response.ok) {
        throw new Error('Failed to invoke workflow');
      }

      const result = await response.json();
      return result.response; // Return the response to be displayed in the chat
    } catch (error) {
      console.error('Error:', error);
      return 'An error occurred while processing your request.'; // Return an error message
    }
  };

  return (
    <div>
      <h1>Chat with Copilot</h1>
      <CopilotChat onUserInput={invokeWorkflow} />
    </div>
  );
};

export default App;
```