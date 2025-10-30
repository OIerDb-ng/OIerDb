import type {
  GetContestResponse,
  GetOIerResponse,
  GetSchoolResponse,
  IAdapter,
  ListContestsQuery,
  ListContestsResponse,
  ListOIersQuery,
  ListOIersResponse,
  ListSchoolsQuery,
  ListSchoolsResponse,
  VersionResponse,
} from '@oierdb/core';
import createClient from 'openapi-fetch';

import type { paths } from './generated/schema';

export interface HttpAdapterOptions {
  /**
   * Backend API base URL (e.g., "http://localhost:3000" or "https://oier.api.baoshuo.dev")
   */
  baseUrl: string;

  /**
   * Optional fetch options to be passed to the fetch client
   */
  fetchOptions?: RequestInit;
}

export class HttpAdapter implements IAdapter {
  private client: ReturnType<typeof createClient<paths>>;

  constructor(options: HttpAdapterOptions) {
    this.client = createClient<paths>({
      baseUrl: options.baseUrl || 'https://oier.api.baoshuo.dev',
      ...options.fetchOptions,
    });
  }

  getType(): string {
    return 'http';
  }

  async checkAvailability(targetVersion: string): Promise<boolean> {
    try {
      const version = await this.getVersion();
      return version.data_version === targetVersion;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<VersionResponse> {
    const { data, error } = await this.client.GET('/api/v1/meta/version');

    if (error) {
      throw new Error(`Failed to get version: ${JSON.stringify(error)}`);
    }

    return data;
  }

  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    const { data, error, response } = await this.client.GET('/api/v1/oier/{uid}', {
      params: {
        path: {
          uid,
        },
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (error) {
      throw new Error(`Failed to get OIer: ${JSON.stringify(error)}`);
    }

    return data as GetOIerResponse | null;
  }

  async listOIers(query: ListOIersQuery): Promise<ListOIersResponse> {
    const { data, error } = await this.client.GET('/api/v1/oier', {
      params: {
        query: {
          name: query.name ?? undefined,
          initials: query.initials ?? undefined,
          enroll_middle: query.enroll_middle ?? undefined,
          gender: query.gender ?? undefined,
          province: query.province ?? undefined,
          page: query.page,
          perPage: query.perPage,
        },
      },
    });

    if (error) {
      throw new Error(`Failed to list OIers: ${JSON.stringify(error)}`);
    }

    return data as ListOIersResponse;
  }

  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    const { data, error, response } = await this.client.GET('/api/v1/school/{id}', {
      params: {
        path: {
          id,
        },
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (error) {
      throw new Error(`Failed to get school: ${JSON.stringify(error)}`);
    }

    return data as GetSchoolResponse | null;
  }

  async listSchools(query: ListSchoolsQuery): Promise<ListSchoolsResponse> {
    const { data, error } = await this.client.GET('/api/v1/school', {
      params: {
        query: {
          name: query.name ?? undefined,
          province: query.province ?? undefined,
          city: query.city ?? undefined,
          page: query.page,
          perPage: query.perPage,
        },
      },
    });

    if (error) {
      throw new Error(`Failed to list schools: ${JSON.stringify(error)}`);
    }

    return data as ListSchoolsResponse;
  }

  async getContest(
    id: number,
    page?: number,
    perPage?: number,
  ): Promise<GetContestResponse | null> {
    const { data, error, response } = await this.client.GET('/api/v1/contest/{id}', {
      params: {
        path: {
          id,
        },
        query: {
          page,
          perPage,
        },
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (error) {
      throw new Error(`Failed to get contest: ${JSON.stringify(error)}`);
    }

    return data as GetContestResponse | null;
  }

  async listContests(query: ListContestsQuery): Promise<ListContestsResponse> {
    const { data, error } = await this.client.GET('/api/v1/contest', {
      params: {
        query: {
          type: query.type ?? undefined,
          year: query.year ?? undefined,
          page: query.page,
          perPage: query.perPage,
        },
      },
    });

    if (error) {
      throw new Error(`Failed to list contests: ${JSON.stringify(error)}`);
    }

    return data as ListContestsResponse;
  }
}
