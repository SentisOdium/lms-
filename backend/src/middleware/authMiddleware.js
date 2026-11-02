import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * JWT Authentication Middleware for Instructors
 */
export function requireInstructorAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: No authentication token provided.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (!decoded.instructor_id) {
      return res.status(403).json({
        success: false,
        message: 'Invalid token role: Instructor privileges required.'
      });
    }

    req.instructor = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Session token expired or invalid. Please log in again.'
    });
  }
}

