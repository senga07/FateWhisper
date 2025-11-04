/**
 * 应用配置
 */
export default {
    port: process.env.PORT || 3000,
    backendUrl: process.env.BACKEND_URL || 'http://localhost:8080',
    nodeEnv: process.env.NODE_ENV || 'development'
};

