const getEnvironmentConfig = () => {
    const env = process.env.REACT_APP_ENVIRONMENT || 'dev';

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
    
    console.log('🔧 Environment Config:');
    console.log('  environment:', env);
    console.log('  backendUrl:', selectedConfig.backendUrl);
    
    return {
        environment: env,
        backendUrl: selectedConfig.backendUrl
    };
};

export { getEnvironmentConfig };