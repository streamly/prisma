import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "who_knows";

export function generateTestToken(userId = "test-user") {
  const payload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  };

  return jwt.sign(payload, JWT_SECRET);
}

export function verifyAndDecodeToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function generateUserToken(userData) {
  const payload = {
    userId: userData.id,
    firstName: userData.firstName,
    lastName: userData.lastName,
    role: userData.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  };

  return jwt.sign(payload, JWT_SECRET);
}
