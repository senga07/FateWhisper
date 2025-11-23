import axios from 'axios';
import config from '../config/index.js';

/**
 * 聊天控制器
 */
class ChatController {
    async createSession(req, res) {
        try {
            const response = await axios.post(
                `${config.backendUrl}/api/chat/sessions`,
                req.body
            );
            res.json(response.data);
        } catch (error) {
            console.error('创建会话失败:', error);
            res.status(error.response?.status || 500).json({
                error: '创建会话失败',
                details: error.response?.data?.detail || error.message
            });
        }
    }

    async createEvent(req, res) {
        try {
            const { sessionId } = req.params;
            const response = await axios.post(
                `${config.backendUrl}/api/chat/sessions/${sessionId}/events`,
                req.body
            );
            res.json(response.data);
        } catch (error) {
            console.error('创建事件失败:', error);
            res.status(error.response?.status || 500).json({
                error: '创建事件失败',
                details: error.response?.data?.detail || error.message
            });
        }
    }

    async listEvents(req, res) {
        try {
            const { sessionId } = req.params;
            const params = new URLSearchParams();
            
            // 添加查询参数
            if (req.query.agent_id) params.append('agent_id', req.query.agent_id);
            if (req.query.min_offset) params.append('min_offset', req.query.min_offset);
            if (req.query.wait_for_data) params.append('wait_for_data', req.query.wait_for_data);
            if (req.query.kinds) {
                // kinds 可能是数组
                const kinds = Array.isArray(req.query.kinds) ? req.query.kinds : [req.query.kinds];
                kinds.forEach(kind => params.append('kinds', kind));
            }

            const url = `${config.backendUrl}/api/chat/sessions/${sessionId}/events${params.toString() ? '?' + params.toString() : ''}`;
            const response = await axios.get(url);
            res.json(response.data);
        } catch (error) {
            console.error('获取事件列表失败:', error);
            res.status(error.response?.status || 500).json({
                error: '获取事件列表失败',
                details: error.response?.data?.detail || error.message
            });
        }
    }

    async getAgentInfo(req, res) {
        try {
            const response = await axios.get(`${config.backendUrl}/api/chat/agent/info`);
            res.json(response.data);
        } catch (error) {
            console.error('获取Agent信息失败:', error);
            res.status(error.response?.status || 500).json({
                error: '获取Agent信息失败',
                details: error.response?.data?.detail || error.message
            });
        }
    }
}

export default new ChatController();

