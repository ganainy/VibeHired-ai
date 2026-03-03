import { Request, Response, NextFunction, RequestHandler } from 'express';
import { IUser } from '../models/User';

/**
 * Middleware to restrict access to Admins or Owners.
 */
export const isAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IUser | undefined;

    if (!user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    if (user.role !== 'admin' && user.role !== 'owner') {
        res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        return;
    }

    next();
};

/**
 * Middleware to restrict access to the Owner only.
 */
export const isOwner: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IUser | undefined;

    if (!user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    if (user.role !== 'owner') {
        res.status(403).json({ message: 'Access denied. Owner privileges required.' });
        return;
    }

    next();
};
