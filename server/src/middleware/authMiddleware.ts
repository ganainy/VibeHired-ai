// server/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User'; // Import User model
import { AuthenticationError, InternalServerError } from '../utils/errors/AppError';
import { asyncLocalStorage, setUserId, setUserEmail, setRequestPath, clearFallbackContext } from '../services/requestContext';

// Define the structure of the decoded JWT payload
interface JwtPayload {
  userId: string;
  email: string;
}

// Extend the Express Request interface to include the user property
// This tells TypeScript that our authenticated requests will have req.user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Get token from header
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    // 2. Check if token exists
    if (!token) {
      throw new AuthenticationError('Access denied. No token provided.');
    }

    // Check if JWT_SECRET is loaded
    if (!JWT_SECRET) {
      console.error("JWT_SECRET not available in authMiddleware!");
      throw new InternalServerError('Server configuration error.');
    }

    // 3. Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // 4. Find user based on token payload
    const user = await User.findById(decoded.userId).select('-passwordHash'); // Exclude password hash

    if (!user) {
      // If the user associated with the token doesn't exist anymore
      throw new AuthenticationError('Invalid token - user not found.');
    }

    // 5. Attach user to the request object
    req.user = user;

    // 6. Run remaining middleware with user context
    const userId = (user._id as any).toString();
    const userEmail = user.email;
    console.log('[AuthMiddleware] Setting up user context:', userId, userEmail);

    // Set fallback storage for SDK callbacks that lose async context
    const requestPath = (() => {
      const originalPath = (req.originalUrl || '').split('?')[0];
      if (originalPath) return originalPath;
      const basePath = req.baseUrl || '';
      const routePath = req.path || '';
      return `${basePath}${routePath}`;
    })();

    setUserId(userId);
    setUserEmail(userEmail);
    setRequestPath(requestPath);
    console.log('[AuthMiddleware] Fallback storage set:', { userId, userEmail, requestPath });

    asyncLocalStorage.run({ userId, userEmail, requestPath }, () => {
      next();

      // Clear fallback storage after response finishes
      res.on('finish', () => {
        clearFallbackContext();
        console.log('[AuthMiddleware] Fallback storage cleared');
      });
    });
  } catch (error) {
    // Pass error to errorHandler middleware
    next(error);
  }
};

export default authMiddleware;