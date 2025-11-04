import axios from 'axios';
import config from '../config/index.js';

/**
 * 专家管理控制器
 */
class ExpertController {
    async getList(req, res) {
        try {
            const response = await axios.get(`${config.backendUrl}/api/expert/list`);
            res.json(response.data);
        } catch (error) {
            res.status(500).json({
                error: '获取专家列表失败',
                details: error.message
            });
        }
    }

    async getById(req, res) {
        try {
            const { expertId } = req.params;
            const response = await axios.get(`${config.backendUrl}/api/expert/${expertId}`);
            res.json(response.data);
        } catch (error) {
            res.status(error.response?.status || 500).json({
                error: '获取专家信息失败',
                details: error.message
            });
        }
    }

    async create(req, res) {
        try {
            const response = await axios.post(`${config.backendUrl}/api/expert/create`, req.body);
            res.json(response.data);
        } catch (error) {
            res.status(error.response?.status || 500).json({
                error: '创建专家失败',
                details: error.message
            });
        }
    }

    async update(req, res) {
        try {
            const { expertId } = req.params;
            const response = await axios.put(`${config.backendUrl}/api/expert/${expertId}`, req.body);
            res.json(response.data);
        } catch (error) {
            res.status(error.response?.status || 500).json({
                error: '更新专家失败',
                details: error.message
            });
        }
    }

    async delete(req, res) {
        try {
            const { expertId } = req.params;
            const response = await axios.delete(`${config.backendUrl}/api/expert/${expertId}`);
            res.json(response.data);
        } catch (error) {
            res.status(error.response?.status || 500).json({
                error: '删除专家失败',
                details: error.message
            });
        }
    }
}

export default new ExpertController();

