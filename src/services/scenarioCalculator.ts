import { ScenarioResult, TripInput, RouteSegment } from '../types.js';
import { calculateRoadRoute, calculatePublicTransportRoute, geocodeAddress } from './hereApi.js';
import { calculateFlightOption, calculateTrainOption, estimateTaxiLeg } from './travelAdapters.js';
import { buildCostBreakdown, calculateWorkDays } from './pricing.js';

export async function calculateScenarioFastest(input: TripInput): Promise<ScenarioResult> {
  const base = await buildCoreRoadTrip(input, 'fastest');
  const warnings = base.warnings;
  return toScenario('fastest', 'Zo snel mogelijk', 'Snelste route', 'fast', true, base.segments, input, 'Optimaliseert op totale doorlooptijd; kosten zijn secundair.', warnings);
}

export async function calculateScenarioCheapest(input: TripInput): Promise<ScenarioResult> {
  const variants = await Promise.all(['fallback', 'train'].map((mode) => buildCoreRoadTrip(input, mode as 'fallback' | 'train')));
  const scenarios = variants.map((variant) => toScenario('cheapest', 'Zo goedkoop mogelijk over de week', 'Goedkoop', 'cheap', false, variant.segments, input, 'Laagste totaalkosten inclusief chauffeur, hotel, maaltijden en externe reiskosten.', variant.warnings));
  return scenarios.sort((a, b) => a.cost.totalIncVat - b.cost.totalIncVat)[0];
}

export async function calculateAlternativeModality(input: TripInput): Promise<ScenarioResult | null> {
  if (input.isDomestic) return null;
  const alt = await buildCoreRoadTrip(input, 'flight');
  const hasFlight = alt.segments.some((segment) => segment.modality === 'flight');
  const hasTrain = alt.segments.some((segment) => segment.modality === 'train');
  if (!hasFlight && !hasTrain) return null;
  return toScenario('alternative', 'Alternatieve modaliteit', hasFlight ? 'Vluchtalternatief' : 'Treinalternatief', 'alternative', false, alt.segments, input, 'Toont een realistisch alternatief wanneer trein en vliegtuig beide logisch kunnen zijn.', alt.warnings);
}

export async function buildQuoteSummary(input: TripInput, scenario: ScenarioResult): Promise<string> {
  const lines = [
    'Indicatieve offerte Autoreset rit',
    `Berekening: ${new Date().toLocaleString('nl-NL')}`,
    `Adressen: ${input.homeAddress} → ${input.pickupAddress} → ${input.deliveryAddress} → ${input.hasReturnVehicle ? input.returnAddress : input.homeAddress}`,
    `Voertuig: ${input.vehicle.type}${input.vehicle.notes ? ` (${input.vehicle.notes})` : ''}`,
    `Scenario: ${scenario.title}`,
    ...scenario.segments.map((segment, index) => `${index + 1}. ${segment.description}: ${segment.durationMinutes} min, ${segment.distanceKm} km, €${segment.cost}`),
    `Totaal excl. btw: €${scenario.cost.totalExVat}`,
    `Totaal incl. btw: €${scenario.cost.totalIncVat}`,
    `Datakwaliteit: ${scenario.dataQuality}`,
    'Prijzen zijn onder voorbehoud van beschikbaarheid en actuele reiskosten.',
  ];
  return lines.join('\n');
}

async function buildCoreRoadTrip(input: TripInput, optimization: 'fastest' | 'fallback' | 'train' | 'flight') {
  const apiKey = input.priceSource === 'live-first' ? input.hereApiKey : '';
  const home = await geocodeAddress(input.homeAddress, apiKey);
  const pickup = await geocodeAddress(input.pickupAddress, apiKey);
  const delivery = await geocodeAddress(input.deliveryAddress, apiKey);
  const returnAddress = await geocodeAddress(input.returnAddress || input.pickupAddress, apiKey);
  const warnings: string[] = [];
  if (!apiKey) warnings.push('Geen HERE API-key actief: demo/fallbackdata gebruikt voor kaart en routes.');
  if (input.isWaddenIsland) warnings.push('Waddeneiland geselecteerd: ferry-, wachttijd- en eilandtoeslagen zijn als uitbreidingsmodule gemarkeerd.');
  if (input.priceSource === 'fallback') warnings.push('Trein-, vlucht- en taxiprijzen zijn indicatief en niet live opgehaald.');

  const outboundAccess = await chooseAccessLeg(home, pickup, input, optimization);
  const vehicleRoad = await calculateRoadRoute(pickup, delivery, apiKey);
  vehicleRoad.description = `Voertuigrit (${input.vehicle.type}) van ophaaladres naar afleveradres`;

  let segments: RouteSegment[] = [...outboundAccess, vehicleRoad];
  if (input.hasReturnVehicle) {
    const returnRoad = await calculateRoadRoute(delivery, returnAddress, apiKey);
    returnRoad.modality = 'return-road';
    returnRoad.description = `Retourvoertuigrit (${input.returnVehicle.type}) naar retouradres`;
    const homeLeg = await chooseAccessLeg(returnAddress, home, input, optimization === 'flight' ? 'train' : optimization);
    segments = [...segments, returnRoad, ...homeLeg];
  } else {
    const returnLeg = await chooseAccessLeg(delivery, home, input, optimization);
    segments = [...segments, ...returnLeg];
  }

  return { segments, warnings };
}

async function chooseAccessLeg(start: Awaited<ReturnType<typeof geocodeAddress>>, end: Awaited<ReturnType<typeof geocodeAddress>>, input: TripInput, optimization: string): Promise<RouteSegment[]> {
  const apiKey = input.priceSource === 'live-first' ? input.hereApiKey : '';
  const pt = await calculatePublicTransportRoute(start, end, input.pricing, apiKey);
  const taxi = estimateTaxiLeg(start, end, input.pricing);
  const train = await calculateTrainOption(start, end, input.pricing, apiKey);
  const flight = calculateFlightOption(start, end, input.pricing);
  const score = (segments: RouteSegment[], key: 'duration' | 'cost') => segments.reduce((total, segment) => total + (key === 'duration' ? segment.durationMinutes : segment.cost), 0);

  if (optimization === 'flight') return flight;
  if (optimization === 'train') return train;
  if (optimization === 'fastest') {
    const options = [[pt], [taxi], train, flight].filter((option) => score(option, 'duration') < 720 || option.some((s) => s.modality === 'flight'));
    return options.sort((a, b) => score(a, 'duration') - score(b, 'duration'))[0];
  }
  return [[pt], [taxi], train].sort((a, b) => score(a, 'cost') - score(b, 'cost'))[0];
}

function toScenario(id: string, title: string, badge: string, tone: ScenarioResult['tone'], recommended: boolean, segments: RouteSegment[], input: TripInput, explanation: string, warnings: string[]): ScenarioResult {
  const roadMinutes = segments.filter((segment) => segment.modality === 'road' || segment.modality === 'return-road').reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const totalDurationMinutes = segments.reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const work = calculateWorkDays(totalDurationMinutes, roadMinutes, input.pricing);
  const domesticStaffle = input.isDomestic && input.useDomesticStaffle && !input.isWaddenIsland;
  const cost = buildCostBreakdown(segments, input.pricing, domesticStaffle);
  const qualities = segments.map((segment) => segment.source.includes('HERE') && !segment.source.includes('fallback') ? 'live' : segment.source.includes('adapter') || segment.source.includes('indicatief') ? 'indicative' : 'fallback');
  const dataQuality = qualities.includes('live') && !qualities.includes('fallback') ? 'live' : qualities.includes('indicative') ? 'indicative' : 'fallback';
  return {
    id,
    title,
    badge,
    tone,
    recommended,
    totalDurationMinutes,
    workDays: work.workDays,
    totalRoadMinutes: roadMinutes,
    totalExternalMinutes: totalDurationMinutes - roadMinutes,
    totalDistanceKm: Math.round(segments.reduce((sum, segment) => sum + segment.distanceKm, 0)),
    modalities: Array.from(new Set(segments.map((segment) => segment.modality))),
    dataQuality,
    explanation: domesticStaffle ? `${explanation} Binnenlandse voorbeeldstaffel toegepast; vervang door echte Autoreset-tarieven.` : explanation,
    warnings: [...warnings, ...work.warnings],
    segments,
    cost,
  };
}
