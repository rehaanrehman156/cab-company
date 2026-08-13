import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders driver dashboard', () => {
  render(<App />);
  expect(screen.getByText(/driver dashboard/i)).toBeInTheDocument();
});
