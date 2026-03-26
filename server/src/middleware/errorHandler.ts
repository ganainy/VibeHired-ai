import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AppError, ValidationError } from '../utils/errors/AppError';
import { GoogleGenerativeAIError } from '@google/generative-ai';
import { logBackendError } from '../services/errorLogger';

/**
 * Centralized error handling middleware
 * Catches all errors from routes and middleware, formats them consistently,
 * and sends appropriate HTTP responses
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle Zod validation errors
  if (err instanceof z.ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    details = err.errors.map((error) => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code,
    }));
  }
  // Handle custom AppError instances (including ValidationError from validateRequest)
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    
    // Extract details from ValidationError if available
    if (err instanceof ValidationError && (err as any).details) {
      details = (err as any).details;
    } else if ((err as any).zodError instanceof z.ZodError) {
      // Handle ValidationError that wraps ZodError
      const zodError = (err as any).zodError as z.ZodError;
      details = zodError.errors.map((error) => ({
        field: error.path.join('.'),
        message: error.message,
        code: error.code,
      }));
    }
  }
  // Handle Mongoose ValidationError
  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
  }
  // Handle Mongoose CastError (invalid ObjectId, etc.)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.kind || 'value'} for ${err.path || 'field'}`;
  }
  // Handle JWT errors
  else if (err instanceof jwt.JsonWebTokenError) {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err instanceof jwt.TokenExpiredError) {
    statusCode = 401;
    message = 'Token expired';
  } else if (err instanceof jwt.NotBeforeError) {
    statusCode = 401;
    message = 'Token not active';
  }
  // Handle Google Generative AI errors
  else if (err instanceof GoogleGenerativeAIError) {
    statusCode = 502;
    message = `AI service error: ${err.message}`;
    // Check for content blocking
    if ((err as any).response?.promptFeedback?.blockReason) {
      statusCode = 400;
      message = `Content processing blocked by AI: ${(err as any).response.promptFeedback.blockReason}`;
    }
  }
  // Handle generic Error instances
  else if (err instanceof Error) {
    message = err.message || 'An error occurred';
    
    // Check for common error patterns in message
    if (err.message.includes('Invalid file type')) {
      statusCode = 400;
    } else if (err.message.includes('AI failed') || 
               err.message.includes('AI response did not contain') ||
               err.message.includes('expected JSON structure')) {
      statusCode = 502;
    } else if (err.message.includes('Missing input') ||
               err.message.includes('Missing required')) {
      statusCode = 400;
    } else if (err.message.includes('not found')) {
      statusCode = 404;
    } else if (err.message.includes('Unauthorized') ||
               err.message.includes('Access denied')) {
      statusCode = 403;
    }
  }

  // Log error details
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (statusCode >= 500) {
    // Log server errors with full details
    console.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      statusCode,
      path: req.path,
      method: req.method,
    });

    // Log to ErrorLog collection for persistent storage
    const userId = (req as any).user?._id?.toString();
    const userEmail = (req as any).user?.email;
    
    logBackendError(
      `${req.method} ${req.path} - ${message}`,
      err.stack,
      userId,
      userEmail,
      {
        statusCode,
        method: req.method,
        endpoint: req.path,
        query: req.query,
        body: req.body ? '[FILTERED]' : undefined,
      }
    ).catch((logErr) => {
      console.error('Failed to log error to ErrorLog:', logErr);
    });
  } else {
    // Log client errors with less detail
    console.warn('Client Error:', {
      message: err.message,
      statusCode,
      path: req.path,
      method: req.method,
    });
  }

  // Prepare response
  const response: any = {
    success: false,
    message,
  };

  // Add additional details in development mode
  if (isDevelopment) {
    response.stack = err.stack;
    if (details) {
      response.details = details;
    } else if (err instanceof Error && err.message) {
      response.details = err.message;
    }
  }

  // Send response
  res.status(statusCode).json(response);
};

