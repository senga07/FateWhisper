import multer from 'multer';

/**
 * 文件上传中间件配置
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

export default upload;

