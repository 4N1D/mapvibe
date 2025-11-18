// Lambda function handlers for MapVibe
// Will be populated with actual handlers later

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Placeholder handler
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'MapVibe API',
      success: true,
    }),
  };
};

// Export handlers (will be added later)
// export * from './handlers/restaurant';
// export * from './handlers/review';
// export * from './handlers/search';
