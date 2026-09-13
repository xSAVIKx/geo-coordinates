import { latDifference } from './compare';

export const KM_PER_DEGREE = 111.2;

export function meridianDistanceKm(latA: number, latB: number, kmPerDegree = KM_PER_DEGREE): number {
  return latDifference(latA, latB) * kmPerDegree;
}

export function degreesForDistance(km: number, kmPerDegree = KM_PER_DEGREE): number {
  return km / kmPerDegree;
}
