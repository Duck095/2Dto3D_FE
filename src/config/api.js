
import axiosClient from "./axiosClient";
import { API_ROUTES } from "./apiRoutes";

const HTTP_METHODS = {
    GET: "GET",
    POST: "POST",
    PUT: "PUT",
    PATCH: "PATCH",
    DELETE: "DELETE",
};

const apiCall = async (method, endpoint, data = null, config = {}) => {
    try {
        const response = await axiosClient({
            method,
            url: endpoint,
            data,
            ...config,
        });

        return response;
    } catch (error) {
        const message =
            error.response?.data?.message ||
            error.message ||
            "API Call Failed";

        console.error(`[${method}] ${endpoint}`, message);
        throw error;
    }
};

export const authApi = {
    login: (payload) =>
        apiCall(
            HTTP_METHODS.POST,
            API_ROUTES.auth.login,
            payload
        ),

    register: (payload) =>
        apiCall(
            HTTP_METHODS.POST,
            API_ROUTES.auth.register,
            payload
        ),

    ping: () =>
        apiCall(
            HTTP_METHODS.GET,
            API_ROUTES.auth.ping
        ),
};
