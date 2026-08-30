import type { CatalogFlight } from './types';

const GRU = {
  icao: 'SBGR',
  iata: 'GRU',
  name: 'Guarulhos',
  city: 'São Paulo',
  lat: -23.435555,
  lon: -46.473056,
  altM: 750,
};

const LHR = {
  icao: 'EGLL',
  iata: 'LHR',
  name: 'Heathrow',
  city: 'Londres',
  lat: 51.47002,
  lon: -0.454295,
  altM: 25,
};

const JFK = {
  icao: 'KJFK',
  iata: 'JFK',
  name: 'John F. Kennedy',
  city: 'Nova York',
  lat: 40.6413,
  lon: -73.7781,
  altM: 4,
};

const DXB = {
  icao: 'OMDB',
  iata: 'DXB',
  name: 'Dubai Intl',
  city: 'Dubai',
  lat: 25.2532,
  lon: 55.3657,
  altM: 19,
};

export const CATALOG: CatalogFlight[] = [
  {
    id: 'baw246',
    callsign: 'BAW246',
    flightNumber: 'BA246',
    airline: 'British Airways',
    aircraft: 'Airbus A350-1000',
    origin: GRU,
    destination: LHR,
    cruiseAltM: 12_500,
    durationSec: 11 * 3600 + 20 * 60,
    scheduledDepartureLocal: '15:30 BRT',
  },
  {
    id: 'baw247',
    callsign: 'BAW247',
    flightNumber: 'BA247',
    airline: 'British Airways',
    aircraft: 'Airbus A350-1000',
    origin: LHR,
    destination: GRU,
    cruiseAltM: 11_900,
    durationSec: 11 * 3600 + 35 * 60,
    scheduledDepartureLocal: '21:15 BST',
  },
  {
    id: 'baw117',
    callsign: 'BAW117',
    flightNumber: 'BA117',
    airline: 'British Airways',
    aircraft: 'Airbus A350-1000',
    origin: LHR,
    destination: JFK,
    cruiseAltM: 12_200,
    durationSec: 7 * 3600 + 50 * 60,
    scheduledDepartureLocal: '16:25 BST',
  },
  {
    id: 'uae001',
    callsign: 'UAE1',
    flightNumber: 'EK1',
    airline: 'Emirates',
    aircraft: 'Airbus A380-800',
    origin: DXB,
    destination: LHR,
    cruiseAltM: 11_900,
    durationSec: 7 * 3600 + 15 * 60,
    scheduledDepartureLocal: '09:40 GST',
  },
];

export function findCatalogFlight(query: string): CatalogFlight | undefined {
  const needle = query.trim().toUpperCase().replace(/\s+/g, '');
  if (!needle) return undefined;
  return CATALOG.find((flight) => {
    const call = flight.callsign.replace(/\s+/g, '');
    const num = flight.flightNumber.replace(/\s+/g, '');
    return call === needle || num === needle || call.startsWith(needle) || num.startsWith(needle);
  });
}
