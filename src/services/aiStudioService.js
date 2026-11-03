import axiosClient from '../config/axiosClient';
import { API_ROUTES } from '../config/apiRoutes';

export async function createAIGeneration(data, image) {
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (image) {
        formData.append('image', image);
    }

    return axiosClient.post(API_ROUTES.aiStudio.generations, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
    });
}

export function getAIGenerationHistory() {
    return axiosClient.get(API_ROUTES.aiStudio.generations);
}

export function refreshAIGeneration(id) {
    return axiosClient.post(API_ROUTES.aiStudio.refreshGeneration(id));
}

export async function downloadAIGenerationModel(id, format) {
    const response = await axiosClient.get(API_ROUTES.aiStudio.modelDownload(id, format), {
        responseType: 'blob',
        timeout: 120000,
    });
    const url = URL.createObjectURL(response);
    const link = document.createElement('a');
    link.href = url;
    link.download = `morphia-studio-${id}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function consumeAIGenerationDownload(id) {
    return axiosClient.post(API_ROUTES.aiStudio.consumeDownload(id));
}
