import { domesticStaffles } from '../config/defaults.js';
import { CostBreakdown, PricingSettings, RouteSegment } from '../types.js';

export function calculateWorkDays(totalMinutes: number, roadMinutes: number, settings: PricingSettings): { workDays: number; hotelNights: number; warnings: string[] } {
  const byWork = Math.ceil(totalMinutes / (settings.maxWorkHoursPerDay * 60));
  const byDriving = Math.ceil(roadMinutes / (settings.maxDrivingHoursPerDay * 60));
  const workDays = Math.max(1, byWork, byDriving);
  const warnings: string[] = [];
  if (workDays > 1) warnings.push(`Planning overschrijdt één werkdag; verdeeld over ${workDays} dagen.`);
  if (roadMinutes / 60 > settings.maxDrivingHoursPerDay) warnings.push('Totale rijtijd is hoger dan de ingestelde maximale rijtijd per dag.');
  return { workDays, hotelNights: Math.max(0, workDays - 1), warnings };
}

export function calculateHotelAndMealCosts(workDays: number, settings: PricingSettings) {
  const hotelNights = Math.max(0, workDays - 1);
  return { hotelNights, hotelCost: hotelNights * settings.hotelNight, mealDays: workDays, mealCost: workDays * settings.mealDay };
}

export function buildCostBreakdown(segments: RouteSegment[], settings: PricingSettings, domesticStaffle = false): CostBreakdown {
  const totalMinutes = sum(segments.map((segment) => segment.durationMinutes));
  const roadMinutes = sum(segments.filter((segment) => segment.modality === 'road' || segment.modality === 'return-road').map((segment) => segment.durationMinutes));
  const work = calculateWorkDays(totalMinutes, roadMinutes, settings);
  const stay = calculateHotelAndMealCosts(work.workDays, settings);
  const roadDistanceKm = sum(segments.filter((segment) => segment.modality === 'road' || segment.modality === 'return-road').map((segment) => segment.distanceKm));
  const external = {
    publicTransportCost: sum(segments.filter((segment) => segment.modality === 'public-transport').map((segment) => segment.cost)),
    trainCost: sum(segments.filter((segment) => segment.modality === 'train').map((segment) => segment.cost)),
    flightCost: sum(segments.filter((segment) => segment.modality === 'flight').map((segment) => segment.cost)),
    taxiCost: sum(segments.filter((segment) => segment.modality === 'taxi').map((segment) => segment.cost)),
  };
  const driverHours = Math.round((totalMinutes / 60) * 10) / 10;
  const stafflePrice = domesticStaffle ? findStafflePrice(roadDistanceKm) : 0;
  const driverCost = domesticStaffle ? 0 : Math.round(driverHours * settings.hourlyRate);
  const roadCost = stafflePrice + Math.round(roadDistanceKm * settings.kilometerComponent);
  const base = driverCost + roadCost + stay.hotelCost + stay.mealCost + external.publicTransportCost + external.trainCost + external.flightCost + external.taxiCost;
  const margin = Math.round(base * (settings.marginPercent / 100));
  const totalExVat = base + margin;
  const vat = Math.round(totalExVat * (settings.vatPercent / 100));
  return { driverHours, driverCost, roadDistanceKm, roadCost, ...external, ...stay, surcharges: 0, margin, vat, totalExVat, totalIncVat: totalExVat + vat };
}

export function findStafflePrice(distanceKm: number): number {
  const row = domesticStaffles.find((staffle) => distanceKm >= staffle.minKm && (staffle.maxKm === undefined || distanceKm <= staffle.maxKm));
  return row?.price ?? domesticStaffles.at(-1)?.price ?? 0;
}

function sum(values: number[]): number { return values.reduce((total, value) => total + value, 0); }
