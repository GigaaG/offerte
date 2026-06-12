export type Modality = 'road' | 'return-road' | 'public-transport' | 'train' | 'taxi' | 'flight' | 'walk';
export type ApiDataQuality = 'live' | 'calculated' | 'indicative' | 'fallback';

export interface Address {
  label: string;
  lat?: number;
  lng?: number;
  country?: string;
}

export interface Vehicle {
  type: 'Personenauto' | 'Bestelauto' | 'Bakwagen' | 'Vrachtwagen' | 'Camper' | 'Anders';
  notes: string;
}

export interface RouteSegment {
  start: Address;
  end: Address;
  modality: Modality;
  durationMinutes: number;
  distanceKm: number;
  cost: number;
  source: string;
  confidence: 'hoog' | 'middel' | 'laag';
  description: string;
  path?: Array<{ lat: number; lng: number }>;
}

export interface CostBreakdown {
  driverHours: number;
  driverCost: number;
  roadDistanceKm: number;
  roadCost: number;
  publicTransportCost: number;
  trainCost: number;
  flightCost: number;
  taxiCost: number;
  hotelNights: number;
  hotelCost: number;
  mealDays: number;
  mealCost: number;
  surcharges: number;
  margin: number;
  vat: number;
  totalExVat: number;
  totalIncVat: number;
}

export interface PricingSettings {
  hourlyRate: number;
  hotelNight: number;
  mealDay: number;
  taxiPerKm: number;
  taxiStart: number;
  maxDrivingHoursPerDay: number;
  maxWorkHoursPerDay: number;
  transferBufferMinutes: number;
  airportPreBufferMinutes: number;
  airportPostBufferMinutes: number;
  kilometerComponent: number;
  marginPercent: number;
  vatPercent: number;
}

export interface StafflePricing {
  label: string;
  minKm: number;
  maxKm?: number;
  price: number;
}

export interface TripInput {
  homeAddress: string;
  pickupAddress: string;
  deliveryAddress: string;
  returnAddress: string;
  departureDate: string;
  departureTime: string;
  useArrivalTime: boolean;
  hasReturnVehicle: boolean;
  isDomestic: boolean;
  isWaddenIsland: boolean;
  useDomesticStaffle: boolean;
  vehicle: Vehicle;
  returnVehicle: Vehicle;
  pricing: PricingSettings;
  priceSource: 'live-first' | 'fallback';
  hereApiKey: string;
}

export interface ScenarioResult {
  id: string;
  title: string;
  badge: string;
  tone: 'fast' | 'cheap' | 'alternative';
  recommended: boolean;
  totalDurationMinutes: number;
  workDays: number;
  totalRoadMinutes: number;
  totalExternalMinutes: number;
  totalDistanceKm: number;
  modalities: Modality[];
  dataQuality: ApiDataQuality;
  explanation: string;
  warnings: string[];
  segments: RouteSegment[];
  cost: CostBreakdown;
}
