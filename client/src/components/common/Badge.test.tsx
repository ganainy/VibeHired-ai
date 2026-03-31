import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('uses default variant class', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('badge-gold');
  });

  it('applies variant classes', () => {
    render(<Badge variant="jade">Success</Badge>);
    expect(screen.getByText('Success')).toHaveClass('badge-jade');
  });

  it('applies size classes', () => {
    render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText('Small')).toHaveClass('text-[0.6875rem]');
  });

  it('renders icon when provided', () => {
    render(
      <Badge icon={<span data-testid="icon">*</span>}>
        Flag
      </Badge>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    render(<Badge className="custom-class">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('custom-class');
  });
});
