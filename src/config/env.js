const ENV = {
    BASE_URL: import.meta.env.VITE_BASE_URL || 'http://localhost:8080/api',
    API_TIMEOUT: import.meta.env.VITE_API_TIMEOUT,
};

export default ENV;
