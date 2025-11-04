import axios from 'axios';
import config from '../config/index.js';

/**
 * 健康检查控制器
 */
class HealthController {
    async check(req, res) {
        try {
            const response = await axios.get(`${config.backendUrl}/health`);
            res.json({
                frontend: 'healthy',
                backend: response.data
            });
        } catch (error) {
            res.status(500).json({
                frontend: 'healthy',
                backend: 'unhealthy',
                error: error.message
            });
        }
    }
}

export default new HealthController();

