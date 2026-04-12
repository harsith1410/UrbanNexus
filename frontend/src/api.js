import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:4720/api', // Pointing to your Express server!
});

// Automatically attach the JWT token if it exists
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;