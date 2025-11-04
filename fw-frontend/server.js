import app from './app.js';
import config from './config/index.js';

const PORT = process.env.PORT || 3000;

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到SIGTERM信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('收到SIGINT信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`前端服务器运行在 http://0.0.0.0:${PORT}`);
});