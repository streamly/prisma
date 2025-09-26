import { VercelRequest, VercelResponse } from '@vercel/node'

// Set CORS headers
export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Handle OPTIONS preflight request
export function handleOptions(req: VercelRequest, res: VercelResponse): boolean | void {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res)
    res.status(200).end()
    return true
  }
  return false
}

// Validate request method
export function validateMethod(req: VercelRequest, allowedMethods: string[]): void {
  if (!req.method || !allowedMethods.includes(req.method)) {
    throw new Error('Method not allowed')
  }
}

// Error response shape
export interface ErrorResponse {
  success: false
  error: string
  details?: object
}

export function errorResponse(
  res: VercelResponse,
  statusCode: number,
  message: string,
  details?: object
): VercelResponse {
  const response: ErrorResponse = { success: false, error: message }
  if (details) {
    response.details = details
  }
  return res.status(statusCode).json(response)
}

// Success response shape
export interface SuccessResponse<T = unknown> {
  success: true
  data?: T
  [key: string]: unknown
}

// Standard success response
export function successResponse<T = Record<string, unknown>>(
  res: VercelResponse,
  data: T = {} as T
): VercelResponse {
  const response: SuccessResponse<T> = { success: true, ...data }
  return res.status(200).json(response)
}