import React from 'react';
import { Loader2 } from 'lucide-react';

interface SimpleLoaderProps {
    message?: string;
    height?: string | number;
    size?: number;
}

const SimpleLoader: React.FC<SimpleLoaderProps> = ({
    message = 'Loading...',
    height = '200px',
    size = 32
}) => {
    return (
        <div
            className="flex flex-col items-center justify-center w-full gap-3"
            style={{ height }}
        >
            <div className="animate-spin" style={{ color: 'var(--accent)' }}>
                <Loader2 size={size} />
            </div>
            {message && (
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default SimpleLoader;
