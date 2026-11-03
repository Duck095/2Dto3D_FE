import apiClient from '../../../services/api/apiClient';
import { ENDPOINTS } from '../../../services/api/endpoints';

export function getCurrentUser() {
  return apiClient.get(ENDPOINTS.AUTH.ME);
}
