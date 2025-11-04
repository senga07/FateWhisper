/**
 * 应用配置
 */
export default {
    port: process.env.PORT || 3001,
    backendUrl: process.env.BACKEND_URL || 'http://localhost:8001',
    nodeEnv: process.env.NODE_ENV || 'development'
};

