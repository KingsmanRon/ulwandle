import { buildRepresentativeMetroWaterData, METROS } from './metros';

describe('representative metro water data', () => {
  it('is deterministic and explicitly illustrative', () => {
    const first = buildRepresentativeMetroWaterData(METROS[0]);
    const second = buildRepresentativeMetroWaterData(METROS[0]);

    expect(first).toEqual(second);
    expect(first.dataStatus).toBe('illustrative');
    expect(first.intake).toBe(METROS[0].baseIntakeMlPerDay);
  });
});
