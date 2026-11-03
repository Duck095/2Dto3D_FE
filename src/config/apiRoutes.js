export const API_ROUTES = Object.freeze({
    auth: Object.freeze({
        login: '/auth/login',
        register: '/auth/register',
        ping: '/auth/ping',
    }),
    aiStudio: Object.freeze({
        generations: '/ai-studio/generations',
        generation: (id) => `/ai-studio/generations/${id}`,
        refreshGeneration: (id) => `/ai-studio/generations/${id}/refresh`,
        inputImage: (id) => `/ai-studio/generations/${id}/input-image`,
        modelAsset: (id, format) => `/ai-studio/generations/${id}/models/model.${format}`,
        modelDownload: (id, format) => `/ai-studio/generations/${id}/models/model.${format}/download`,
        consumeDownload: (id) => `/ai-studio/generations/${id}/downloads`,
    }),
    memberships: Object.freeze({
        plans: '/memberships/plans',
        me: '/memberships/me',
        communityDownload: (modelId) => `/memberships/community-downloads/${encodeURIComponent(modelId)}`,
    }),
});
