import React, { useState } from 'react';
import { Button } from './Button';

/**
 * Button Component Showcase
 * Demonstrates all variants, sizes, and states of the unified Button component
 */
export function ButtonShowcase() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadingClick = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-white">Button Component</h1>

      {/* Variants */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-white">Variants</h2>
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </div>
      </section>

      {/* Sizes */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-white">Sizes</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      {/* States */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-white">States</h2>
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button>Default</Button>
            <Button disabled>Disabled</Button>
            <Button isLoading={isLoading} onClick={handleLoadingClick}>
              {isLoading ? 'Processing...' : 'Click to Load'}
            </Button>
          </div>
        </div>
      </section>

      {/* Icons */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-white">With Icons</h2>
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button icon={<span>✓</span>}>Confirm</Button>
            <Button icon={<span>←</span>} variant="secondary">
              Back
            </Button>
            <Button icon={<span>→</span>} iconPosition="right" variant="ghost">
              Next
            </Button>
            <Button icon={<span>🗑</span>} variant="danger">
              Delete
            </Button>
          </div>
        </div>
      </section>

      {/* Combinations */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-white">Combinations</h2>
        <div className="space-y-4">
          <div className="bg-gray-900 p-4 rounded">
            <p className="text-gray-300 mb-3">Small Secondary with Icon:</p>
            <Button variant="secondary" size="sm" icon={<span>+</span>}>
              Add New
            </Button>
          </div>
          <div className="bg-gray-900 p-4 rounded">
            <p className="text-gray-300 mb-3">Large Danger with Icon:</p>
            <Button variant="danger" size="lg" icon={<span>⚠</span>}>
              Permanent Delete
            </Button>
          </div>
          <div className="bg-gray-900 p-4 rounded">
            <p className="text-gray-300 mb-3">Ghost with Right Icon:</p>
            <Button variant="ghost" icon={<span>→</span>} iconPosition="right">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Usage Examples */}
      <section className="bg-gray-800 p-6 rounded mb-12">
        <h2 className="text-xl font-semibold mb-4 text-white">Usage Examples</h2>
        <pre className="bg-gray-900 p-4 rounded text-sm text-gray-300 overflow-x-auto">
          {`import { Button } from '@/components/common';

// Primary button
<Button onClick={handleSave}>Save</Button>

// With variant and size
<Button variant="secondary" size="sm">Edit</Button>

// Icon on left (default)
<Button icon={<SaveIcon />}>Save Draft</Button>

// Icon on right
<Button icon={<ArrowIcon />} iconPosition="right">
  Continue
</Button>

// Loading state
<Button isLoading={isSubmitting} onClick={handleSubmit}>
  {isSubmitting ? 'Submitting...' : 'Submit'}
</Button>

// Danger variant
<Button variant="danger" onClick={handleDelete}>
  Delete Forever
</Button>

// All props combined
<Button 
  variant="primary"
  size="lg"
  icon={<CheckIcon />}
  isLoading={isProcessing}
  onClick={handleAction}
  disabled={isDisabled}
>
  Process
</Button>`}
        </pre>
      </section>

      {/* Implementation Notes */}
      <section className="bg-blue-900 bg-opacity-20 border border-blue-500 p-6 rounded">
        <h3 className="text-lg font-semibold text-white mb-2">Implementation Notes</h3>
        <ul className="text-gray-300 space-y-2 list-disc list-inside">
          <li>Supports all standard HTML button attributes (onClick, disabled, etc.)</li>
          <li>Ref forwarding enabled for imperative usage</li>
          <li>Loading state automatically disables button and shows spinner</li>
          <li>Accessibility: ARIA attributes supported, keyboard navigation works</li>
          <li>Responsive: Works on all screen sizes</li>
          <li>Styling: Uses design system CSS classes (.btn-primary, etc.)</li>
        </ul>
      </section>
    </div>
  );
}

export default ButtonShowcase;
