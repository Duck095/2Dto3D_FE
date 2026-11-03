import apiClient from '../../../services/api/apiClient';
import { ENDPOINTS } from '../../../services/api/endpoints';

export const listStaff = (params, { signal } = {}) =>
  apiClient.get(ENDPOINTS.STAFF.LIST, { params, signal });

export const createStaff = payload =>
  apiClient.post(ENDPOINTS.STAFF.CREATE, payload);

export const getStaff = (id, { signal } = {}) =>
  apiClient.get(ENDPOINTS.STAFF.DETAIL(id), { signal });

export const updateStaff = (id, payload) =>
  apiClient.patch(ENDPOINTS.STAFF.UPDATE(id), payload);

export const changeStaffStatus = (id, payload) =>
  apiClient.patch(ENDPOINTS.STAFF.STATUS(id), payload);
