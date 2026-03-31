import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card Component', () => {
  it('renders children', () => {
    render(
      <Card>
        <div>Content</div>
      </Card>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('uses default variant class', () => {
    render(<Card>Card</Card>);
    expect(screen.getByText('Card')).toHaveClass('card');
  });

  it('applies elevated variant class', () => {
    render(<Card variant="elevated">Card</Card>);
    expect(screen.getByText('Card')).toHaveClass('card-elevated');
  });

  it('applies nested variant class', () => {
    render(<Card variant="nested">Card</Card>);
    expect(screen.getByText('Card')).toHaveClass('card-nested');
  });

  it('applies padding classes', () => {
    render(<Card padding="lg">Card</Card>);
    expect(screen.getByText('Card')).toHaveClass('p-6');
  });

  it('omits padding classes for nested variant', () => {
    render(
      <Card variant="nested" padding="lg">
        Card
      </Card>
    );
    expect(screen.getByText('Card')).not.toHaveClass('p-6');
  });

  it('adds hover styles when hoverable', () => {
    render(<Card hoverable>Card</Card>);
    expect(screen.getByText('Card')).toHaveClass('transition-shadow');
  });

  it('accepts custom className', () => {
    render(<Card className="custom-class">Card</Card>);
    expect(screen.getByText('Card')).toHaveClass('custom-class');
  });
});
