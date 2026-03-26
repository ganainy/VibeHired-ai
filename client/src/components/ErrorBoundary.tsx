import React, { Component, ReactNode } from 'react';
import { reportError } from '../services/errorApi';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        const userInfo = this.getStoredUser();
        reportError({
            errorType: 'frontend',
            severity: 'error',
            message: `React Error: ${error.message}`,
            stack: error.stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            userId: userInfo.userId,
            userEmail: userInfo.userEmail,
            metadata: {
                componentStack: errorInfo.componentStack,
            },
        });
    }

    getStoredUser(): { userId?: string; userEmail?: string } {
        try {
            const storedUser = localStorage.getItem('authUser');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                return { userId: user.id, userEmail: user.email };
            }
        } catch {}
        return {};
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                    <div className="text-center p-8">
                        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
                            Something went wrong
                        </h1>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                            An unexpected error occurred. Please try refreshing the page.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
