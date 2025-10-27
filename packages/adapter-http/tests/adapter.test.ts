import { HttpAdapter } from '../adapter';

// Mock openapi-fetch
jest.mock('openapi-fetch', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      GET: jest.fn(),
    })),
  };
});

describe('HttpAdapter', () => {
  let adapter: HttpAdapter;
  let mockClient: any;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create a new adapter instance
    adapter = new HttpAdapter({
      baseUrl: 'http://localhost:3000',
    });

    // Get the mocked client
    const createClient = require('openapi-fetch').default;
    mockClient = createClient.mock.results[0].value;
  });

  describe('getVersion', () => {
    it('should get version successfully', async () => {
      const mockVersion = {
        data_version: 'abc123',
      };

      mockClient.GET.mockResolvedValue({
        data: mockVersion,
        error: null,
        response: { status: 200 },
      });

      const result = await adapter.getVersion();

      expect(result).toEqual(mockVersion);
      expect(mockClient.GET).toHaveBeenCalledWith('/api/v1/meta/version');
    });

    it('should throw error when version request fails', async () => {
      mockClient.GET.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
        response: { status: 500 },
      });

      await expect(adapter.getVersion()).rejects.toThrow('Failed to get version');
    });
  });

  describe('checkAvailability', () => {
    it('should return true when version matches', async () => {
      const targetVersion = 'abc123';
      mockClient.GET.mockResolvedValue({
        data: { data_version: targetVersion },
        error: null,
        response: { status: 200 },
      });

      const result = await adapter.checkAvailability(targetVersion);

      expect(result).toBe(true);
    });

    it('should return false when version does not match', async () => {
      mockClient.GET.mockResolvedValue({
        data: { data_version: 'abc123' },
        error: null,
        response: { status: 200 },
      });

      const result = await adapter.checkAvailability('xyz789');

      expect(result).toBe(false);
    });

    it('should return false when request fails', async () => {
      mockClient.GET.mockRejectedValue(new Error('Network error'));

      const result = await adapter.checkAvailability('abc123');

      expect(result).toBe(false);
    });
  });

  describe('getOIer', () => {
    it('should get OIer successfully', async () => {
      const mockOIer = {
        uid: 1,
        oier: {
          uid: 1,
          name: 'Test User',
          lowered_name: 'test user',
          initials: 'tu',
          enroll_middle: 2020,
          gender: 1,
          provinces: ['北京'],
          school_ids: [1],
          contest_ids: [1],
          oierdb_score: 100,
          ccf_level: 1,
          ccf_score: 100,
          rank: 0,
        },
        records: [],
        schools_map: {},
        contests_map: {},
        data_version: 'abc123',
      };

      mockClient.GET.mockResolvedValue({
        data: mockOIer,
        error: null,
        response: { status: 200 },
      });

      const result = await adapter.getOIer(1);

      expect(result).toEqual(mockOIer);
      expect(mockClient.GET).toHaveBeenCalledWith('/api/v1/oier/{uid}', {
        params: {
          path: {
            uid: 1,
          },
        },
      });
    });

    it('should return null when OIer not found', async () => {
      mockClient.GET.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
        response: { status: 404 },
      });

      const result = await adapter.getOIer(999);

      expect(result).toBeNull();
    });

    it('should throw error when request fails', async () => {
      mockClient.GET.mockResolvedValue({
        data: null,
        error: { message: 'Server error' },
        response: { status: 500 },
      });

      await expect(adapter.getOIer(1)).rejects.toThrow('Failed to get OIer');
    });
  });

  describe('listOIers', () => {
    it('should list OIers successfully', async () => {
      const mockResponse = {
        oiers: [],
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
        data_version: 'abc123',
      };

      mockClient.GET.mockResolvedValue({
        data: mockResponse,
        error: null,
        response: { status: 200 },
      });

      const result = await adapter.listOIers({ page: 1, perPage: 20 });

      expect(result).toEqual(mockResponse);
      expect(mockClient.GET).toHaveBeenCalledWith('/api/v1/oier', {
        params: {
          query: {
            name: undefined,
            initials: undefined,
            enroll_middle: undefined,
            gender: undefined,
            province: undefined,
            page: 1,
            perPage: 20,
          },
        },
      });
    });

    it('should handle query parameters correctly', async () => {
      const mockResponse = {
        oiers: [],
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
        data_version: 'abc123',
      };

      mockClient.GET.mockResolvedValue({
        data: mockResponse,
        error: null,
        response: { status: 200 },
      });

      await adapter.listOIers({
        name: '张三',
        province: '北京',
        page: 1,
        perPage: 10,
      });

      expect(mockClient.GET).toHaveBeenCalledWith('/api/v1/oier', {
        params: {
          query: {
            name: '张三',
            initials: undefined,
            enroll_middle: undefined,
            gender: undefined,
            province: '北京',
            page: 1,
            perPage: 10,
          },
        },
      });
    });
  });

  describe('getSchool', () => {
    it('should get school successfully', async () => {
      const mockSchool = {
        id: 1,
        school: {
          id: 1,
          name: 'Test School',
          province: '北京',
          city: '北京',
          score: 100,
          rank: 1,
          member_ids: [],
          award_counts: {},
        },
        members_map: {},
        contests_map: {},
        data_version: 'abc123',
      };

      mockClient.GET.mockResolvedValue({
        data: mockSchool,
        error: null,
        response: { status: 200 },
      });

      const result = await adapter.getSchool(1);

      expect(result).toEqual(mockSchool);
      expect(mockClient.GET).toHaveBeenCalledWith('/api/v1/school/{id}', {
        params: {
          path: {
            id: 1,
          },
        },
      });
    });

    it('should return null when school not found', async () => {
      mockClient.GET.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
        response: { status: 404 },
      });

      const result = await adapter.getSchool(999);

      expect(result).toBeNull();
    });
  });

  describe('listSchools', () => {
    it('should list schools successfully', async () => {
      const mockResponse = {
        schools: [],
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
        data_version: 'abc123',
      };

      mockClient.GET.mockResolvedValue({
        data: mockResponse,
        error: null,
        response: { status: 200 },
      });

      const result = await adapter.listSchools({ page: 1, perPage: 20 });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getContest', () => {
    it('should get contest successfully', async () => {
      const mockContest = {
        id: 1,
        contest: {
          id: 1,
          name: 'NOI2024',
          year: 2024,
          type: 'NOI',
          contestant_ids: [],
          fall_semester: false,
          full_score: 600,
          capacity: 300,
          length: 300,
          level_counts: {},
        },
        records: [],
        schools_map: {},
        oiers_map: {},
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
        data_version: 'abc123',
      };

      mockClient.GET.mockResolvedValue({
        data: mockContest,
        error: null,
        response: { status: 200 },
      });

      const result = await adapter.getContest(1, 1, 20);

      expect(result).toEqual(mockContest);
      expect(mockClient.GET).toHaveBeenCalledWith('/api/v1/contest/{id}', {
        params: {
          path: {
            id: 1,
          },
          query: {
            page: 1,
            perPage: 20,
          },
        },
      });
    });

    it('should return null when contest not found', async () => {
      mockClient.GET.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
        response: { status: 404 },
      });

      const result = await adapter.getContest(999);

      expect(result).toBeNull();
    });
  });

  describe('listContests', () => {
    it('should list contests successfully', async () => {
      const mockResponse = {
        contests: [],
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
        data_version: 'abc123',
      };

      mockClient.GET.mockResolvedValue({
        data: mockResponse,
        error: null,
        response: { status: 200 },
      });

      const result = await adapter.listContests({ page: 1, perPage: 20 });

      expect(result).toEqual(mockResponse);
    });

    it('should handle query parameters correctly', async () => {
      const mockResponse = {
        contests: [],
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
        data_version: 'abc123',
      };

      mockClient.GET.mockResolvedValue({
        data: mockResponse,
        error: null,
        response: { status: 200 },
      });

      await adapter.listContests({
        type: 'NOI',
        year: 2024,
        page: 1,
        perPage: 10,
      });

      expect(mockClient.GET).toHaveBeenCalledWith('/api/v1/contest', {
        params: {
          query: {
            type: 'NOI',
            year: 2024,
            page: 1,
            perPage: 10,
          },
        },
      });
    });
  });
});
