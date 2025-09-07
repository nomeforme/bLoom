const getEnvironmentConfig = () => {
    const env = process.env.REACT_APP_NODE_ENV || 'dev';
    
    const config = {
        dev: {
            backendUrl: process.env.REACT_APP_DEV_BACKEND_URL || 'http://localhost:3001'
        },
        staging: {
            backendUrl: process.env.REACT_APP_STAGING_BACKEND_URL || ''
        },
        production: {
            backendUrl: process.env.REACT_APP_PROD_BACKEND_URL || ''
        }
    };
    
    const selectedConfig = config[env] || config.dev;
    
    return {
        environment: env,
        backendUrl: selectedConfig.backendUrl
    };
};

export { getEnvironmentConfig };