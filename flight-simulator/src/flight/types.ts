export type FlightSource = 'replay' | 'live';

export type AirportFix = {
  icao: string;
  iata: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  altM: number;
};

export type CatalogFlight = {
  id: string;
  callsign: string;
  flightNumber: string;
  airline: string;
  aircraft: string;
  icao24?: string;
  origin: AirportFix;
  destination: AirportFix;
  cruiseAltM: number;
  durationSec: number;
  scheduledDepartureLocal: string;
};

export type FlightSample = {
  lat: number;
  lon: number;
  altM: number;
  heading: number;
  speedMps: number;
  verticalRateMps: number;
  onGround: boolean;
  timestamp: number;
};

export type ActiveFlight = {
  callsign: string;
  flightNumber: string;
  airline: string;
  aircraft: string;
  origin: AirportFix | null;
  destination: AirportFix | null;
  source: FlightSource;
  icao24?: string;
  durationSec: number;
  cruiseAltM: number;
};
