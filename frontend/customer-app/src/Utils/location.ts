type ReverseGeocodeResult = {
  display_name?: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

export const formatLocationLabel = (
  latitude: number,
  longitude: number,
  result?: ReverseGeocodeResult | null
) => {
  const fallbackLabel = `Current location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;

  if (!result) {
    return fallbackLabel;
  }

  const rawAddress = result.display_name || '';
  const parts = rawAddress
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts.slice(0, 2).join(', ');
  }

  if (result.address) {
    const { road, suburb, city, state } = result.address;
    const addressParts = [road, suburb, city, state].filter(Boolean) as string[];
    if (addressParts.length > 0) {
      return addressParts.slice(0, 2).join(', ');
    }
  }

  return fallbackLabel;
};
