import type { CityQuestTemplate } from './questDataTypes';
import { CITY_QUESTS_P1 } from './questDataCityP1';
import { CITY_QUESTS_P2 } from './questDataCityP2';

export const CITY_QUESTS: CityQuestTemplate[] = [
  ...CITY_QUESTS_P1,
  ...CITY_QUESTS_P2,
];
