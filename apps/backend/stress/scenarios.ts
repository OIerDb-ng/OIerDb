/**
 * Stress test scenarios for OIerDb API endpoints
 */

export interface TestScenario {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
}

/**
 * All test scenarios for the API
 */
export const scenarios: TestScenario[] = [
  // Meta endpoints
  {
    name: 'meta-version',
    method: 'GET',
    path: '/api/v1/meta/version',
    description: 'Get database version information',
  },

  // OIer endpoints - List operations
  {
    name: 'oier-list-default',
    method: 'GET',
    path: '/api/v1/oier',
    description: 'List OIers with default pagination',
  },
  {
    name: 'oier-list-paginated',
    method: 'GET',
    path: '/api/v1/oier?page=2&perPage=50',
    description: 'List OIers with custom pagination',
  },
  {
    name: 'oier-list-filtered-province',
    method: 'GET',
    path: '/api/v1/oier?province=浙江',
    description: 'List OIers filtered by province',
  },
  {
    name: 'oier-list-filtered-name',
    method: 'GET',
    path: '/api/v1/oier?name=虞皓翔',
    description: 'List OIers filtered by name',
  },
  {
    name: 'oier-list-filtered-gender',
    method: 'GET',
    path: '/api/v1/oier?gender=1',
    description: 'List OIers filtered by gender',
  },
  {
    name: 'oier-list-max-perpage',
    method: 'GET',
    path: '/api/v1/oier?perPage=100',
    description: 'List OIers with maximum perPage',
  },

  // OIer endpoints - Single item
  {
    name: 'oier-get-by-uid',
    method: 'GET',
    path: '/api/v1/oier/1',
    description: 'Get single OIer by UID',
  },

  // Contest endpoints - List operations
  {
    name: 'contest-list-default',
    method: 'GET',
    path: '/api/v1/contest',
    description: 'List contests with default pagination',
  },
  {
    name: 'contest-list-paginated',
    method: 'GET',
    path: '/api/v1/contest?page=1&perPage=30',
    description: 'List contests with custom pagination',
  },
  {
    name: 'contest-list-filtered-year',
    method: 'GET',
    path: '/api/v1/contest?year=2023',
    description: 'List contests filtered by year',
  },
  {
    name: 'contest-list-filtered-type',
    method: 'GET',
    path: '/api/v1/contest?type=NOI',
    description: 'List contests filtered by type',
  },

  // Contest endpoints - Single item
  {
    name: 'contest-get-by-id',
    method: 'GET',
    path: '/api/v1/contest/1',
    description: 'Get single contest by ID',
  },
  {
    name: 'contest-get-paginated',
    method: 'GET',
    path: '/api/v1/contest/1?page=1&perPage=50',
    description: 'Get contest with paginated participants',
  },

  // School endpoints - List operations
  {
    name: 'school-list-default',
    method: 'GET',
    path: '/api/v1/school',
    description: 'List schools with default pagination',
  },
  {
    name: 'school-list-paginated',
    method: 'GET',
    path: '/api/v1/school?page=2&perPage=40',
    description: 'List schools with custom pagination',
  },
  {
    name: 'school-list-filtered-province',
    method: 'GET',
    path: '/api/v1/school?province=北京',
    description: 'List schools filtered by province',
  },
  {
    name: 'school-list-filtered-name',
    method: 'GET',
    path: '/api/v1/school?name=中学',
    description: 'List schools filtered by name',
  },

  // School endpoints - Single item
  {
    name: 'school-get-by-id',
    method: 'GET',
    path: '/api/v1/school/1',
    description: 'Get single school by ID',
  },
];

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(
  category: 'oier' | 'contest' | 'school' | 'meta',
): TestScenario[] {
  return scenarios.filter((s) => s.name.startsWith(category));
}

/**
 * Get list operation scenarios only
 */
export function getListScenarios(): TestScenario[] {
  return scenarios.filter((s) => s.name.includes('list'));
}

/**
 * Get single item operation scenarios only
 */
export function getSingleItemScenarios(): TestScenario[] {
  return scenarios.filter((s) => s.name.includes('get-by'));
}
