import { describe, expect, it } from 'vitest';
import { advanceClock, SimulationClock, SystemClock } from './clock';

describe('staging clocks', () => {
  it('keeps simulation time independent from system time', () => {
    const clock = new SimulationClock('2032-04-05T06:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2032-04-05T06:00:00.000Z');
    expect(Math.abs(new SystemClock().now().getTime() - clock.now().getTime())).toBeGreaterThan(86_400_000);
  });

  it('advances without waiting in real time', () => {
    expect(advanceClock('2032-04-05T06:00:00.000Z', 86_400).toISOString())
      .toBe('2032-04-06T06:00:00.000Z');
  });

  it('never permits zero or backward movement', () => {
    expect(() => advanceClock('2032-04-05T06:00:00.000Z', 0)).toThrow(RangeError);
    expect(() => advanceClock('2032-04-05T06:00:00.000Z', -1)).toThrow(RangeError);
  });
});
