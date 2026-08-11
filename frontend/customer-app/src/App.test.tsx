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
    display_name: '12, Connaught Place, New Delhi, Delhi, India',
    address: {
      road: 'Connaught Place',
      city: 'New Delhi',
      state: 'Delhi'
    }
  });

  expect(label).toBe('Connaught Place, New Delhi');
});

test('keeps a clear area and place label for a local landmark', () => {
  const label = formatLocationLabel(12.9716, 77.5946, {
    display_name: 'MG Road, Bengaluru, Karnataka, India',
    address: {
      road: 'MG Road',
      city: 'Bengaluru',
      state: 'Karnataka'
    }
  });

  expect(label).toBe('MG Road, Bengaluru');
});

test('falls back to coordinate formatting when no address is available', () => {
  const label = formatLocationLabel(28.6139, 77.2090);

  expect(label).toBe('Current location (28.614, 77.209)');
});
