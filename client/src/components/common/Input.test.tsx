import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Input } from './Input';

describe('Input Component', () => {
  it('renders input', () => {
    render(<Input placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders helper text when provided', () => {
    render(<Input helperText="Use a work email" />);
    expect(screen.getByText('Use a work email')).toBeInTheDocument();
  });

  it('renders error when provided', () => {
    render(<Input error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('sets aria-invalid when error exists', () => {
    render(<Input error="Required" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('forwards standard input props', async () => {
    const onChange = vi.fn();
    render(<Input placeholder="Type" onChange={onChange} />);

    await userEvent.type(screen.getByPlaceholderText('Type'), 'Hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders icon when provided', () => {
    render(<Input icon={<span data-testid="icon">*</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
