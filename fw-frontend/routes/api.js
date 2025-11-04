import express from 'express';
import expertController from '../controllers/expertController.js';
import fortuneController from '../controllers/fortuneController.js';
import healthController from '../controllers/healthController.js';

const router = express.Router();

// 健康检查
router.get('/health', healthController.check);

// 专家管理API
router.get('/expert/list', expertController.getList);
router.get('/expert/:expertId', expertController.getById);
router.post('/expert/create', expertController.create);
router.put('/expert/:expertId', expertController.update);
router.delete('/expert/:expertId', expertController.delete);

// 分析API
router.post('/fortune/analyze', fortuneController.analyze);

export default router;

