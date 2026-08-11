type ReverseGeocodeResult = {
  display_name?: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
    town?: string;
    village?: string;
    neighbourhood?: string;
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

  const address = result.address || {};

  const placeCandidates = [address.road, address.neighbourhood, address.suburb, address.town, address.village];
  const areaCandidates = [address.suburb, address.neighbourhood, address.town, address.village, address.city, address.state];

  const place = placeCandidates.filter(Boolean).find((candidate) => candidate && candidate !== 'Unnamed Road') || '';
  const area = areaCandidates.filter(Boolean).find((candidate) => candidate && candidate !== place) || '';

  if (place && area && area !== place) {
    return `${place}, ${area}`;
  }

  if (place) {
    return place;
  }

  if (area) {
    return area;
  }

  const rawAddress = result.display_name || '';
  const parts = rawAddress
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts.slice(0, 2).join(', ');
  }

  return fallbackLabel;
};
