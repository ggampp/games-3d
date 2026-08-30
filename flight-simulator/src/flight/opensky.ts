export type OpenSkyState = {
  icao24: string;
  callsign: string;
  originCountry: string;
  lon: number;
  lat: number;
  baroAltM: number | null;
  geoAltM: number | null;
  onGround: boolean;
  velocityMps: number | null;
  heading: number | null;
  verticalRateMps: number | null;
  timestamp: number;
};

function parseState(row: unknown[]): OpenSkyState | null {
  const lon = row[5];
  const lat = row[6];
  if (typeof lon !== 'number' || typeof lat !== 'number') return null;
  return {
    icao24: String(row[0] ?? ''),
    callsign: String(row[1] ?? '').trim(),
    originCountry: String(row[2] ?? ''),
    lon,
    lat,
    baroAltM: typeof row[7] === 'number' ? row[7] : null,
    onGround: Boolean(row[8]),
    velocityMps: typeof row[9] === 'number' ? row[9] : null,
    heading: typeof row[10] === 'number' ? row[10] : null,
    verticalRateMps: typeof row[11] === 'number' ? row[11] : null,
    geoAltM: typeof row[13] === 'number' ? row[13] : null,
    timestamp: typeof row[4] === 'number' ? row[4] * 1000 : Date.now(),
  };
}

async function fetchStates(path: string): Promise<OpenSkyState[]> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`OpenSky ${response.status}`);
  }
  const payload = (await response.json()) as { states?: unknown[][] | null };
  if (!payload.states) return [];
  const out: OpenSkyState[] = [];
  for (const row of payload.states) {
    if (!Array.isArray(row)) continue;
    const parsed = parseState(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

export async function searchLiveCallsign(callsign: string): Promise<OpenSkyState | null> {
  const needle = callsign.trim().toUpperCase().replace(/\s+/g, '');
  if (!needle) return null;
  const states = await fetchStates('/api/opensky/states/all');
  const exact = states.find((state) => state.callsign.replace(/\s+/g, '') === needle);
  if (exact) return exact;
  return (
    states.find((state) => state.callsign.replace(/\s+/g, '').startsWith(needle)) ?? null
  );
}

export async function pollIcao24(icao24: string): Promise<OpenSkyState | null> {
  const states = await fetchStates(`/api/opensky/states/all?icao24=${encodeURIComponent(icao24)}`);
  return states[0] ?? null;
}

export async function listAirborneSample(limit = 24): Promise<OpenSkyState[]> {
  const states = await fetchStates('/api/opensky/states/all');
  return states
    .filter((state) => state.callsign.length >= 3 && !state.onGround && (state.baroAltM ?? 0) > 3000)
    .slice(0, limit);
}
