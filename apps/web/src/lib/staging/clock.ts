export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now() {
    return new Date();
  }
}

export class SimulationClock implements Clock {
  constructor(private readonly currentTime: string | Date) {}

  now() {
    return new Date(this.currentTime);
  }
}

export function advanceClock(current: string | Date, seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new RangeError('Simulation time can only move forward.');
  }
  return new Date(new Date(current).getTime() + seconds * 1000);
}
