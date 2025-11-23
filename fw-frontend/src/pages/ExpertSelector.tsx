import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { expertApi } from '../services/api';
import type { Expert } from '../types';
import './ExpertSelector.css';

const ExpertSelector: React.FC = () => {
    const [experts, setExperts] = useState<Expert[]>([]);
    const [selectedExperts, setSelectedExperts] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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

    const toggleExpert = (expertId: string) => {
        const newSelected = new Set(selectedExperts);
        if (newSelected.has(expertId)) {
            newSelected.delete(expertId);
        } else {
            newSelected.add(expertId);
        }
        setSelectedExperts(newSelected);
    };

    const startAnalysis = () => {
        if (selectedExperts.size === 0) return;
        const expertIds = Array.from(selectedExperts);
        const expertParams = expertIds.map(id => `expert=${id}`).join('&');
        navigate(`/analysis?${expertParams}`);
    };



    if (loading) {
        return (
            <div className="expert-selector-container">
                <div className="loading">正在加载专家列表...</div>
            </div>
        );
    }

    return (
        <div className="expert-selector-container">
            <div className="header">
                <div className="header-actions">
                    <button 
                        className="btn-admin" 
                        onClick={() => navigate('/expert/manage')}
                    >
                        ⚙️ 专家管理
                    </button>
                    <button 
                        className="btn-admin" 
                        onClick={() => navigate('/chat')}
                    >
                        💬 快速咨询
                    </button>
                </div>
                <div className="header-title-section">
                    <h1>
                        <span className="header-icon">🔮</span>
                        <span className="header-title-text">Fate Whisper</span>
                    </h1>
                    <p>选择一个或多个专家开始您的命理分析之旅</p>
                </div>
            </div>
            
            <div className="main-content">
                {error ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">❌</div>
                        <p>{error}</p>
                    </div>
                ) : experts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <p>暂无专家，请先添加专家</p>
                    </div>
                ) : (
                    <>
                        <div className="expert-grid">
                            {experts.map(expert => {
                                const isSelected = selectedExperts.has(expert.id);
                                return (
                                    <div
                                        key={expert.id}
                                        className={`expert-card ${isSelected ? 'selected' : ''}`}
                                    >
                                        <div
                                            className={`expert-checkbox ${isSelected ? 'checked' : ''}`}
                                            onClick={() => toggleExpert(expert.id)}
                                        />
                                        <div className="expert-icon">{expert.icon || '🔮'}</div>
                                        <div className="expert-name">{expert.name}</div>
                                        <div className="expert-skills">{expert.skills}</div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="footer-actions">
                            <button
                                className="btn-start-analysis"
                                disabled={selectedExperts.size === 0}
                                onClick={startAnalysis}
                            >
                                开始分析
                            </button>
                            <div className="selected-count">
                                已选择 {selectedExperts.size} 位专家
                            </div>
                        </div>
                    </>
                )}
                
                <div className="privacy-notice">
                    <span className="privacy-icon">🔒</span>
                    <span className="privacy-text">我们承诺不会获取或存储您的个人信息，所有数据仅用于本次分析</span>
                </div>
            </div>
        </div>
    );
};

export default ExpertSelector;

