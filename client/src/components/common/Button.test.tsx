import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Button } from './Button';

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('renders as a button element', () => {
      render(<Button>Submit</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('applies primary variant class', () => {
      render(<Button variant="primary">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-primary');
    });

    it('applies secondary variant class', () => {
      render(<Button variant="secondary">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-secondary');
    });

    it('applies ghost variant class', () => {
      render(<Button variant="ghost">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-ghost');
    });

    it('applies danger variant class', () => {
      render(<Button variant="danger">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-danger');
    });

    it('defaults to primary variant', () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-primary');
    });
  });

  describe('Sizes', () => {
    it('applies small size classes', () => {
      render(<Button size="sm">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-2', 'py-1', 'text-xs');
    });

    it('applies medium size classes', () => {
      render(<Button size="md">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-3', 'py-2', 'text-sm');
    });

    it('applies large size classes', () => {
      render(<Button size="lg">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-4', 'py-3', 'text-base');
    });

    it('defaults to medium size', () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-3', 'py-2', 'text-sm');
    });
  });

  describe('States', () => {
    it('disables button when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows loading state', () => {
      render(<Button isLoading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-60', 'cursor-wait');
    });

    it('disables button when isLoading is true', () => {
      render(<Button isLoading>Processing</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows loading spinner when isLoading is true', () => {
      render(<Button isLoading>Processing</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
      // Spinner is present (aria-hidden)
      const spinner = screen.getByRole('button').querySelector('[aria-hidden="true"]');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    it('renders icon on left by default', () => {
      const { container } = render(
        <Button icon={<span data-testid="icon">📎</span>}>
          With Icon
        </Button>
      );
      const iconElement = screen.getByTestId('icon');
      const buttonContent = screen.getByRole('button').querySelector('span span:first-child');
      expect(iconElement.parentElement).toBe(buttonContent);
    });

    it('renders icon on right when iconPosition is right', () => {
      render(
        <Button icon={<span data-testid="icon">📎</span>} iconPosition="right">
          With Icon
        </Button>
      );
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('renders both icon and children', () => {
      render(
        <Button icon={<span data-testid="icon">📎</span>}>
          Click here
        </Button>
      );
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Click here')).toBeInTheDocument();
    });
  });

  describe('Event Handling', () => {
    it('handles click events', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('prevents click when disabled', async () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('prevents click when loading', async () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} isLoading>
          Loading
        </Button>
      );

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Custom Classes', () => {
    it('accepts custom className', () => {
      render(<Button className="custom-class">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('combines variant, size, and custom classes', () => {
      render(
        <Button variant="secondary" size="lg" className="custom-class">
          Button
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-secondary');
      expect(button).toHaveClass('px-4', 'py-3', 'text-base');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('HTML Attributes', () => {
    it('forwards standard HTML button attributes', () => {
      render(
        <Button id="test-button" data-testid="my-button" type="submit">
          Submit
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('id', 'test-button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('supports aria attributes for accessibility', () => {
      render(
        <Button aria-label="Save configuration" aria-pressed="false">
          Save
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Save configuration');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to button element', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Button</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('allows imperative handle usage', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Button</Button>);
      expect(ref.current?.click).toBeDefined();
    });
  });

  describe('Combinations', () => {
    it('renders danger button with loading state', () => {
      render(
        <Button variant="danger" isLoading>
          Deleting...
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-danger');
      expect(button).toHaveClass('opacity-60', 'cursor-wait');
      expect(button).toBeDisabled();
    });

    it('renders small secondary button with icon', () => {
      render(
        <Button variant="secondary" size="sm" icon={<span data-testid="icon">✓</span>}>
          Confirm
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-secondary', 'px-2', 'py-1', 'text-xs');
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('renders large ghost button with right-positioned icon', () => {
      render(
        <Button
          variant="ghost"
          size="lg"
          icon={<span data-testid="icon">→</span>}
          iconPosition="right"
        >
          Next
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-ghost', 'px-4', 'py-3', 'text-base');
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });
  });
});
