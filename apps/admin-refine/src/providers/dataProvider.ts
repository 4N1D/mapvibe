import type { DataProvider } from '@refinedev/core';
import { apiClient } from '../lib/api-client';

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, sorters }) => {
    const { current = 1, pageSize = 10 } = pagination ?? {};
    const offset = (current - 1) * pageSize;

    const params: any = {
      limit: pageSize,
      offset,
    };

    // Add filters
    if (filters) {
      filters.forEach((filter) => {
        if ('field' in filter) {
          params[filter.field] = filter.value;
        }
      });
    }

    // Add sorters
    if (sorters && sorters.length > 0) {
      const sorter = sorters[0];
      params.sort_by = sorter.field;
      params.order = sorter.order;
    }

    const url = `/admin/${resource}`;
    const { data } = await apiClient.get(url, { params });

    return {
      data: data[resource] || data.data || [],
      total: data.pagination?.total || data.total || 0,
    };
  },

  getOne: async ({ resource, id }) => {
    const url = `/admin/${resource}/${id}`;
    const { data } = await apiClient.get(url);
    return {
      data: data[resource.slice(0, -1)] || data.data || data,
    };
  },

  create: async ({ resource, variables }) => {
    const url = `/admin/${resource}`;
    const { data } = await apiClient.post(url, variables);
    return {
      data: data[resource.slice(0, -1)] || data.data || data,
    };
  },

  update: async ({ resource, id, variables }) => {
    const url = `/admin/${resource}/${id}`;
    const { data } = await apiClient.patch(url, variables);
    return {
      data: data[resource.slice(0, -1)] || data.data || data,
    };
  },

  deleteOne: async ({ resource, id }) => {
    const url = `/admin/${resource}/${id}`;
    const { data } = await apiClient.delete(url);
    return {
      data: data[resource.slice(0, -1)] || data.data || data,
    };
  },

  getApiUrl: () => import.meta.env.VITE_API_URL as string,

  // Custom method for admin stats and other endpoints
  custom: async ({ url, method, payload }) => {
    const { data } = await apiClient.request({
      url,
      method,
      data: payload,
    });
    return { data };
  },
};
