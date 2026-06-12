import { Address, PricingSettings, RouteSegment } from '../types.js';
import { calculatePublicTransportRoute, haversineKm } from './hereApi.js';

const airports = [
  { label: 'Schiphol Airport', lat: 52.3105, lng: 4.7683, country: 'Nederland' },
  { label: 'Rotterdam The Hague Airport', lat: 51.9569, lng: 4.4372, country: 'Nederland' },
  { label: 'Munich Airport', lat: 48.3538, lng: 11.7861, country: 'Duitsland' },
  { label: 'Frankfurt Airport', lat: 50.0379, lng: 8.5622, country: 'Duitsland' },
];

const stations = [
  { label: 'Amsterdam Centraal', lat: 52.3791, lng: 4.9, country: 'Nederland' },
  { label: 'Utrecht Centraal', lat: 52.0894, lng: 5.1103, country: 'Nederland' },
  { label: 'München Hbf', lat: 48.1402, lng: 11.5583, country: 'Duitsland' },
  { label: 'Frankfurt Hbf', lat: 50.1071, lng: 8.6638, country: 'Duitsland' },
];

export function findNearestAirport(address: Address): Address {
  return nearest(address, airports);
}

export function findNearestTrainStation(address: Address): Address {
  return nearest(address, stations);
}

export function estimateTaxiLeg(start: Address, end: Address, settings: PricingSettings): RouteSegment {
  const distance = haversineKm(start, end) * 1.18;
  return {
    start,
    end,
    modality: 'taxi',
    durationMinutes: Math.round((distance / 62) * 60),
    distanceKm: Math.round(distance),
    cost: Math.round(settings.taxiStart + distance * settings.taxiPerKm),
    source: 'Taxi fallback adapter',
    confidence: 'laag',
    description: 'Indicatieve taxi-inschatting; later te vervangen door taxiprijs-API.',
    path: [{ lat: start.lat ?? 52, lng: start.lng ?? 5 }, { lat: end.lat ?? 52, lng: end.lng ?? 5 }],
  };
}

export async function calculateTrainOption(start: Address, end: Address, settings: PricingSettings, apiKey?: string): Promise<RouteSegment[]> {
  const originStation = findNearestTrainStation(start);
  const targetStation = findNearestTrainStation(end);
  const firstMile = estimateTaxiLeg(start, originStation, settings);
  firstMile.description = 'First-mile taxi naar treinstation';
  const lastMile = estimateTaxiLeg(targetStation, end, settings);
  lastMile.description = 'Last-mile taxi vanaf treinstation';
  const train = await calculatePublicTransportRoute(originStation, targetStation, settings, apiKey);
  train.modality = 'train';
  train.cost = Math.round(45 + train.distanceKm * 0.16);
  train.source = 'Treinprijs adapter (indicatief)';
  train.description = 'Indicatieve treinreis; TODO: live treinprijzen/API koppelen.';
  return [firstMile, train, lastMile];
}

export function calculateFlightOption(start: Address, end: Address, settings: PricingSettings): RouteSegment[] {
  const originAirport = findNearestAirport(start);
  const targetAirport = findNearestAirport(end);
  const toAirport = estimateTaxiLeg(start, originAirport, settings);
  toAirport.description = 'Taxi/voortransport naar luchthaven';
  const flightDistance = haversineKm(originAirport, targetAirport);
  const flight: RouteSegment = {
    start: originAirport,
    end: targetAirport,
    modality: 'flight',
    durationMinutes: Math.round(settings.airportPreBufferMinutes + settings.airportPostBufferMinutes + 75 + (flightDistance / 780) * 60),
    distanceKm: Math.round(flightDistance),
    cost: Math.round(145 + flightDistance * 0.1),
    source: 'Vluchtprijs adapter (indicatief)',
    confidence: 'laag',
    description: 'Indicatieve vlucht inclusief luchthavenbuffers; TODO: live vluchtprijzen/API koppelen.',
    path: [{ lat: originAirport.lat!, lng: originAirport.lng! }, { lat: targetAirport.lat!, lng: targetAirport.lng! }],
  };
  const fromAirport = estimateTaxiLeg(targetAirport, end, settings);
  fromAirport.description = 'Taxi/natransport vanaf luchthaven';
  return [toAirport, flight, fromAirport];
}

function nearest(address: Address, list: Address[]): Address {
  return [...list].sort((a, b) => haversineKm(address, a) - haversineKm(address, b))[0];
}
