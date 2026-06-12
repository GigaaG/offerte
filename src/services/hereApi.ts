import { hereConfig } from '../config/defaults.js';
import { Address, RouteSegment } from '../types.js';

const knownPlaces: Record<string, Address> = {
  'hoorn, nederland': { label: 'Hoorn, Nederland', lat: 52.6424, lng: 5.0597, country: 'Nederland' },
  'amsterdam, nederland': { label: 'Amsterdam, Nederland', lat: 52.3676, lng: 4.9041, country: 'Nederland' },
  'münchen, duitsland': { label: 'München, Duitsland', lat: 48.1351, lng: 11.582, country: 'Duitsland' },
  'munchen, duitsland': { label: 'München, Duitsland', lat: 48.1351, lng: 11.582, country: 'Duitsland' },
  'schiphol airport': { label: 'Schiphol Airport', lat: 52.3105, lng: 4.7683, country: 'Nederland' },
  'munich airport': { label: 'Munich Airport', lat: 48.3538, lng: 11.7861, country: 'Duitsland' },
  'amsterdam centraal': { label: 'Amsterdam Centraal', lat: 52.3791, lng: 4.9, country: 'Nederland' },
  'münchen hbf': { label: 'München Hbf', lat: 48.1402, lng: 11.5583, country: 'Duitsland' },
};

export async function geocodeAddress(query: string, apiKey?: string): Promise<Address> {
  const cached = knownPlaces[query.trim().toLowerCase()];
  if (cached) return cached;

  if (apiKey) {
    try {
      const url = new URL(hereConfig.geocodeEndpoint);
      url.searchParams.set('q', query);
      url.searchParams.set('apiKey', apiKey);
      const response = await fetch(url);
      const data = await response.json();
      const item = data.items?.[0];
      if (item) {
        return { label: item.title || query, lat: item.position.lat, lng: item.position.lng, country: item.address?.countryName };
      }
    } catch {
      // Fallback mode keeps the demo usable when HERE is unavailable or the key is absent.
    }
  }

  return pseudoGeocode(query);
}

export async function calculateRoadRoute(start: Address, end: Address, apiKey?: string): Promise<RouteSegment> {
  if (apiKey && start.lat && start.lng && end.lat && end.lng) {
    try {
      const url = new URL(hereConfig.routingEndpoint);
      url.searchParams.set('transportMode', 'car');
      url.searchParams.set('origin', `${start.lat},${start.lng}`);
      url.searchParams.set('destination', `${end.lat},${end.lng}`);
      url.searchParams.set('return', 'summary,polyline');
      url.searchParams.set('apiKey', apiKey);
      const response = await fetch(url);
      const data = await response.json();
      const section = data.routes?.[0]?.sections?.[0];
      if (section?.summary) {
        return {
          start,
          end,
          modality: 'road',
          durationMinutes: Math.round(section.summary.duration / 60),
          distanceKm: Math.round(section.summary.length / 100) / 10,
          cost: 0,
          source: 'HERE Routing API',
          confidence: 'hoog',
          description: `Autoroute via HERE van ${start.label} naar ${end.label}`,
          path: [coords(start), coords(end)],
        };
      }
    } catch {
      // Keep using calculated haversine fallback if HERE routing fails.
    }
  }

  const distance = haversineKm(start, end) * 1.22;
  return {
    start,
    end,
    modality: 'road',
    durationMinutes: Math.round((distance / 82) * 60),
    distanceKm: Math.round(distance),
    cost: 0,
    source: apiKey ? 'HERE fallback berekening' : 'Demo fallback berekening',
    confidence: apiKey ? 'middel' : 'laag',
    description: `Berekende autoroute van ${start.label} naar ${end.label}`,
    path: [coords(start), midpoint(start, end, 0.2), midpoint(start, end, -0.12), coords(end)],
  };
}

export async function calculatePublicTransportRoute(start: Address, end: Address, settings: { transferBufferMinutes: number }, apiKey?: string): Promise<RouteSegment> {
  if (apiKey) {
    // TODO: Sluit hier de HERE Public Transit Routing API volledig aan met echte secties, overstappen en fares.
  }
  const distance = haversineKm(start, end) * 1.08;
  return {
    start,
    end,
    modality: distance > 350 ? 'train' : 'public-transport',
    durationMinutes: Math.round((distance / 95) * 60 + settings.transferBufferMinutes * 3),
    distanceKm: Math.round(distance),
    cost: Math.round(18 + distance * 0.18),
    source: 'Indicatieve OV/trein adapter',
    confidence: 'laag',
    description: `Indicatieve ${distance > 350 ? 'trein' : 'OV'}-verbinding inclusief overstapbuffers`,
    path: [coords(start), coords(end)],
  };
}

export function haversineKm(a: Address, b: Address): number {
  const lat1 = a.lat ?? 52;
  const lat2 = b.lat ?? 52;
  const lon1 = a.lng ?? 5;
  const lon2 = b.lng ?? 5;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

function pseudoGeocode(query: string): Address {
  let hash = 0;
  for (const char of query) hash = (hash << 5) - hash + char.charCodeAt(0);
  return { label: query, lat: 51.8 + Math.abs(hash % 400) / 100, lng: 3.6 + Math.abs(hash % 500) / 100, country: query.includes('Duitsland') ? 'Duitsland' : 'Nederland' };
}

function toRad(value: number): number { return (value * Math.PI) / 180; }
function coords(address: Address) { return { lat: address.lat ?? 52, lng: address.lng ?? 5 }; }
function midpoint(a: Address, b: Address, curve: number) { return { lat: ((a.lat ?? 52) + (b.lat ?? 52)) / 2 + curve, lng: ((a.lng ?? 5) + (b.lng ?? 5)) / 2 - curve }; }
