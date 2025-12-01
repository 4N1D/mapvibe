const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

function success(data, statusCode = 200) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

function error(message, statusCode = 500) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}

function notFound(message = 'Not found') {
  return error(message, 404);
}

function badRequest(message = 'Bad request') {
  return error(message, 400);
}

function unauthorized(message = 'Unauthorized') {
  return error(message, 401);
}

module.exports = { success, error, notFound, badRequest, unauthorized, corsHeaders };
