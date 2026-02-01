const getEnvironmentConfig = () => {
    const env = process.env.NODE_ENV || 'dev';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    return {
        environment: env,
        frontendUrl: frontendUrl,
        backendUrl: backendUrl
    };
};

module.exports = { getEnvironmentConfig };
