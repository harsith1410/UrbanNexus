import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:4720/api' // Matches the PORT in your server.js
});

// Interceptor to inject the JWT token into every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;