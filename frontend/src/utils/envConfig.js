const getEnvironmentConfig = () => {
    const env = process.env.REACT_APP_ENVIRONMENT || 'dev';
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

    console.log('Environment Config:');
    console.log('  environment:', env);
    console.log('  backendUrl:', backendUrl);

    return {
        environment: env,
        backendUrl: backendUrl
    };
};

export { getEnvironmentConfig };
