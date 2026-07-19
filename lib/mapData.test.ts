import { describe, expect, it } from 'vitest';
import { findPoiAtTile, getStaticPOIs } from './mapData';

describe('map POI selection', () => {
  const pois = getStaticPOIs();

  it('resolves the Moonbridge and Quiet Waters Pier overlap by nearest center', () => {
    expect(findPoiAtTile(pois, 40, 28)?.name).toBe('Quiet Waters Pier');
    expect(findPoiAtTile(pois, 40, 31)?.name).toBe('Moonbridge');
  });

  it('returns no POI outside every footprint', () => {
    expect(findPoiAtTile(pois, 83, 47)).toBeUndefined();
  });
});
