const getEnvironmentConfig = () => {
    const env = process.env.NODE_ENV || 'dev';
    
    const config = {
        dev: {
            frontendUrl: process.env.DEV_FRONTEND_URL || 'http://localhost:3000',
            backendUrl: process.env.DEV_BACKEND_URL || 'http://localhost:3001'
        },
        staging: {
            frontendUrl: process.env.STAGING_FRONTEND_URL || '',
            backendUrl: process.env.STAGING_BACKEND_URL || ''
        },
        production: {
            frontendUrl: process.env.PROD_FRONTEND_URL || '',
            backendUrl: process.env.PROD_BACKEND_URL || ''
        }
    };
    
    const selectedConfig = config[env] || config.dev;
    
    return {
        environment: env,
        frontendUrl: selectedConfig.frontendUrl,
        backendUrl: selectedConfig.backendUrl
    };
};

module.exports = { getEnvironmentConfig };