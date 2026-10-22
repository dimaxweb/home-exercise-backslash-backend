import { MatchMode } from '@backslash/api-contract';
import { fireEvent, render, screen } from '@testing-library/react';
import { FilterBar } from './filter-bar';

const filters = [
  { name: 'starts-public', description: 'Route starts at a publicly exposed service' },
  { name: 'ends-in-sink', description: 'Route ends at a sink (rds)' },
];

describe('FilterBar', () => {
  it('runs the query with the checked filters and match mode', () => {
    const onRun = jest.fn();
    render(<FilterBar filters={filters} onRun={onRun} onReset={jest.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /starts-public/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /ends-in-sink/ }));
    fireEvent.click(screen.getByRole('radio', { name: /any/i }));
    fireEvent.click(screen.getByRole('button', { name: /show routes/i }));
    expect(onRun).toHaveBeenCalledWith(['starts-public', 'ends-in-sink'], MatchMode.Any);
  });

  it('defaults to match=all and resets to the overview', () => {
    const onRun = jest.fn();
    const onReset = jest.fn();
    render(<FilterBar filters={filters} onRun={onRun} onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: /show routes/i }));
    expect(onRun).toHaveBeenCalledWith([], MatchMode.All);
    fireEvent.click(screen.getByRole('button', { name: /overview/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
