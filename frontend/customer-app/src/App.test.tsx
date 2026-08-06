import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the booking experience', () => {
  render(<App />);

  expect(screen.getByText(/quick fare estimator/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /book a ride/i })).toBeInTheDocument();
});
