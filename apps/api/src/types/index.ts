// API Gateway Event types
export interface APIGatewayEvent {
  httpMethod: string;
  path: string;
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
  headers?: Record<string, string> | null;
  body?: string | null;
}

export interface APIGatewayResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

// Handler type
export interface Handler {
  handle: (event: APIGatewayEvent) => Promise<APIGatewayResponse>;
}

// Route definition
export interface Route {
  method: string;
  path: string;
  handler: Handler;
}

// Database types (from your schema)
export interface Place {
  id: string;
  name_vi: string;
  slug?: string;
  address: string;
  district?: string;
  ward?: string;
  geo_lat?: number;
  geo_lng?: number;
  cuisine_types?: string[];
  price_min?: number;
  price_max?: number;
  rating_overall?: number;
  rating_count?: number;
  review_count?: number;
  status?: string;
  created_at?: Date;
}

export interface Review {
  id: string;
  restaurant_id: string;
  author_id: string;
  rating_overall: number;
  text: string;
  created_at?: Date;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar?: string;
  created_at?: Date;
}
