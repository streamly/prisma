// Set CORS headers
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Handle OPTIONS preflight request
export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res)
    return res.status(200).end()
  }
  return false
}

// Validate request method
export function validateMethod(req, allowedMethods) {
  if (!allowedMethods.includes(req.method)) {
    throw new Error('Method not allowed')
  }
}

// Standard error response
export function errorResponse(res, statusCode, message, details = null) {
  const response = { success: false, error: message }
  if (details) response.details = details
  return res.status(statusCode).json(response)
}

// Standard success response
export function successResponse(res, data = {}) {
  return res.status(200).json({ success: true, ...data })
}