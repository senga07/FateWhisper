import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import config from './config/index.js';
import upload from './middleware/upload.js';

// 导入路由
import indexRoutes from './routes/index.js';
import apiRoutes from './routes/api.js';

// 在ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 文件上传中间件
app.use(upload.any());

// 静态文件服务
// 生产环境：提供Vite构建的dist目录
// 开发环境：如果有dist目录也提供服务，否则提供public目录
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    app.use(express.static(path.join(__dirname, 'dist')));
} else {
    // 开发环境：优先使用dist（如果已构建），否则使用public
    const distPath = path.join(__dirname, 'dist');
    const publicPath = path.join(__dirname, 'public');
    if (existsSync(distPath)) {
        app.use(express.static(distPath));
    } else if (existsSync(publicPath)) {
        app.use(express.static(publicPath));
    }
}

// 路由
app.use('/', indexRoutes);
app.use('/api', apiRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: '服务器内部错误',
        message: err.message
    });
});

// 404处理
// 生产环境：对于SPA，所有路由返回index.html
// 开发环境：如果有静态文件服务，也提供SPA路由支持
if (isProduction) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
} else {
    // 开发环境：如果提供了静态文件服务，则支持SPA路由
    const distPath = path.join(__dirname, 'dist');
    const publicPath = path.join(__dirname, 'public');
    if (existsSync(distPath)) {
        // 有构建文件，支持SPA路由
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        });
    } else {
        // 只处理API路由，其他路由由Vite开发服务器处理
        app.use('/api/*', (req, res) => {
            res.status(404).json({
                error: 'API路由未找到',
                path: req.path
            });
        });
        // 非API路由提示使用Vite开发服务器
        app.get('*', (req, res) => {
            res.status(404).send(`
                <html>
                    <head><title>开发环境提示</title></head>
                    <body>
                        <h1>开发环境提示</h1>
                        <p>请访问 Vite 开发服务器：<a href="http://localhost:5173">http://localhost:5173</a></p>
                        <p>或者运行 <code>npm run build</code> 构建项目后访问此地址</p>
                    </body>
                </html>
            `);
        });
    }
}

export default app;

