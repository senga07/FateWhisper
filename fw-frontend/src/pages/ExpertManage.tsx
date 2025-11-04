import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { expertApi } from '../services/api';
import type { Expert } from '../types';
import './ExpertManage.css';

const ExpertManage: React.FC = () => {
    const [experts, setExperts] = useState<Expert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadExperts();
    }, []);

    const loadExperts = async () => {
        try {
            const data = await expertApi.getList();
            setExperts(data);
        } catch (err) {
            setError('加载专家列表失败，请稍后重试');
            console.error('加载专家失败:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (expertId: string) => {
        if (!confirm('确定要删除此专家吗？此操作不可撤销。')) {
            return;
        }

        try {
            await expertApi.delete(expertId);
            showToast('专家已删除', 'success');
            await loadExperts();
        } catch (err) {
            showToast('删除失败，请稍后重试', 'error');
            console.error('删除失败:', err);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    if (loading) {
        return (
            <div className="expert-manage-container">
                <div className="loading">正在加载专家列表...</div>
            </div>
        );
    }

    return (
        <div className="expert-manage-container">
            <div className="header">
                <h1>⚙️ 专家管理</h1>
                <button className="btn-back" onClick={() => navigate('/')}>
                    ← 返回首页
                </button>
            </div>
            
            <div className="main-content">
                <div className="toolbar">
                    <h2>专家列表</h2>
                    <button 
                        className="btn-add"
                        onClick={() => navigate('/expert/edit')}
                    >
                        ➕ 添加专家
                    </button>
                </div>

                {error ? (
                    <div className="empty-state">
                        <p>{error}</p>
                    </div>
                ) : experts.length === 0 ? (
                    <div className="empty-state">
                        <p>暂无专家，点击"添加专家"按钮创建第一个专家</p>
                    </div>
                ) : (
                    <table className="expert-table">
                        <thead>
                            <tr>
                                <th>专家名称</th>
                                <th>专家技能</th>
                                <th>提示词</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {experts.map(expert => (
                                <tr key={expert.id}>
                                    <td className="expert-name">
                                        <span className="expert-icon">{expert.icon || '🔮'}</span> {expert.name}
                                    </td>
                                    <td className="expert-skills">{expert.skills || ''}</td>
                                    <td className="expert-skills">
                                        {(expert.prompt || '').substring(0, 50)}
                                        {(expert.prompt || '').length > 50 ? '...' : ''}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="btn-edit"
                                                onClick={() => navigate(`/expert/edit?id=${expert.id}`)}
                                            >
                                                编辑
                                            </button>
                                            <button
                                                className="btn-delete"
                                                onClick={() => handleDelete(expert.id)}
                                            >
                                                删除
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {toast && (
                <div className={`toast ${toast.type}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default ExpertManage;

