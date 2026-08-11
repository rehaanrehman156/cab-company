export type RideProgressStatus = 'requested' | 'accepted' | 'arriving' | 'on_trip' | 'completed' | 'cancelled';

const progressSteps = [
  'Ride requested',
  'Driver assigned',
  'Driver arriving',
  'Trip started',
  'Trip completed'
] as const;

const statusIndex: Record<RideProgressStatus, number> = {
  requested: 0,
  accepted: 1,
  arriving: 2,
  on_trip: 3,
  completed: 4,
  cancelled: -1
};

export const getRideProgressSteps = (status: RideProgressStatus) => {
  const index = statusIndex[status];
  if (index < 0) {
    return [];
  }

  return progressSteps.slice(0, index + 1);
};

export const getRideStatusLabel = (status: RideProgressStatus) => {
  switch (status) {
    case 'accepted':
      return 'Driver accepted your ride';
    case 'arriving':
      return 'Driver is on the way';
    case 'on_trip':
      return 'Trip in progress';
    case 'completed':
      return 'Trip completed';
    case 'cancelled':
      return 'Ride cancelled';
    default:
      return 'Ride requested';
  }
};
