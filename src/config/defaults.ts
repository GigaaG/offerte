import { PricingSettings, StafflePricing, TripInput } from '../types.js';

export const hereConfig = {
  apiKey: '',
  geocodeEndpoint: 'https://geocode.search.hereapi.com/v1/geocode',
  routingEndpoint: 'https://router.hereapi.com/v8/routes',
  transitEndpoint: 'https://transit.router.hereapi.com/v8/routes',
  mapTileEndpoint: 'https://maps.hereapi.com/v3/base/mc',
};

export const defaultPricing: PricingSettings = {
  hourlyRate: 55,
  hotelNight: 125,
  mealDay: 50,
  taxiPerKm: 2.5,
  taxiStart: 10,
  maxDrivingHoursPerDay: 10,
  maxWorkHoursPerDay: 12,
  transferBufferMinutes: 15,
  airportPreBufferMinutes: 120,
  airportPostBufferMinutes: 30,
  kilometerComponent: 0,
  marginPercent: 0,
  vatPercent: 21,
};

export const domesticStaffles: StafflePricing[] = [
  { label: '0-50 km', minKm: 0, maxKm: 50, price: 125 },
  { label: '51-100 km', minKm: 51, maxKm: 100, price: 195 },
  { label: '101-150 km', minKm: 101, maxKm: 150, price: 275 },
  { label: '151-200 km', minKm: 151, maxKm: 200, price: 355 },
  { label: '201-300 km', minKm: 201, maxKm: 300, price: 495 },
  { label: '300+ km', minKm: 301, price: 650 },
];

function nextMonday(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = ((8 - day) % 7) || 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

export const demoInput: TripInput = {
  homeAddress: 'Hoorn, Nederland',
  pickupAddress: 'Amsterdam, Nederland',
  deliveryAddress: 'München, Duitsland',
  returnAddress: 'Amsterdam, Nederland',
  departureDate: nextMonday(),
  departureTime: '08:00',
  useArrivalTime: false,
  hasReturnVehicle: false,
  isDomestic: false,
  isWaddenIsland: false,
  useDomesticStaffle: true,
  vehicle: { type: 'Personenauto', notes: '' },
  returnVehicle: { type: 'Personenauto', notes: '' },
  pricing: defaultPricing,
  priceSource: 'fallback',
  hereApiKey: hereConfig.apiKey,
};
