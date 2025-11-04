import axios from 'axios';
import FormData from 'form-data';
import config from '../config/index.js';

/**
 * 命理分析控制器
 */
class FortuneController {
    async analyze(req, res) {
        try {
            const formData = new FormData();

            // 动态添加所有表单字段（不包括 task_id，因为它已经作为查询参数传递）
            if (req.body) {
                Object.keys(req.body).forEach(key => {
                    // 跳过 task_id，因为它是查询参数，不应该在表单数据中
                    if (key !== 'task_id') {
                        formData.append(key, req.body[key]);
                    }
                });
            }

            // 动态添加所有上传的文件，不写死字段名
            // 根据专家配置，字段名可能是 birth_date, left_hand, right_hand, facial 等任意名称
            if (req.files && req.files.length > 0) {
                req.files.forEach(file => {
                    if (file.originalname) {
                        // 使用原始字段名（field_id）传递，保持与前端一致
                        formData.append(file.fieldname, file.buffer, {
                            filename: file.originalname,
                            contentType: file.mimetype
                        });
                    }
                });
            }

            // 从查询参数获取专家ID（支持多个）
            const expertIds = req.query.expert;
            const expertParams = Array.isArray(expertIds) 
                ? expertIds.map(id => `expert=${id}`).join('&')
                : (expertIds ? `expert=${expertIds}` : '');
            
            // 从查询参数获取 task_id（必需参数）
            const taskId = req.query.task_id;
            if (!taskId) {
                return res.status(400).json({
                    error: '缺少必需参数 task_id'
                });
            }
            
            // 构建完整的URL，包含专家ID和task_id查询参数
            const params = [];
            if (expertParams) {
                params.push(expertParams);
            }
            params.push(`task_id=${encodeURIComponent(taskId)}`);
            const url = `${config.backendUrl}/api/fortune/analyze?${params.join('&')}`;
            
            const response = await axios.post(url, formData, {
                headers: {
                    ...formData.getHeaders()
                }
            });

            res.json(response.data);
        } catch (error) {
            res.status(500).json({
                error: 'fortune分析失败',
                details: error.message
            });
        }
    }
}

export default new FortuneController();

