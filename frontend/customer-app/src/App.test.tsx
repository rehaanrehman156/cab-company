import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { formatLocationLabel } from './Utils/location';

test('renders the booking experience', () => {
  render(<App />);

  expect(screen.getByText(/quick fare estimator/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /book a ride/i })).toBeInTheDocument();
});

test('formats a readable pickup label from reverse geocoding data', () => {
  const label = formatLocationLabel(28.6139, 77.2090, {
    display_name: '12, Connaught Place, New Delhi, Delhi, India'
  });

  expect(label).toBe('12, Connaught Place, New Delhi');
});

test('falls back to coordinate formatting when no address is available', () => {
  const label = formatLocationLabel(28.6139, 77.2090);

  expect(label).toBe('Current location (28.614, 77.209)');
});
