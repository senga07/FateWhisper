import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { expertApi, fortuneApi } from '../services/api';
import type { Expert, RequiredField } from '../types';
import { marked } from 'marked';
import './Analysis.css';

// 配置 marked 选项以支持更好的 markdown 渲染
marked.setOptions({
    breaks: true,  // 支持换行
    gfm: true,     // 支持 GitHub Flavored Markdown
});

interface FieldValue {
    fieldName: string;
    fieldType: RequiredField['field_type'];
    value: string | File | null;
}

const Analysis: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const expertIds = searchParams.getAll('expert');

    const [experts, setExperts] = useState<Expert[]>([]);
    const [fieldsByExpert, setFieldsByExpert] = useState<Map<string, RequiredField[]>>(new Map());
    const [fieldValues, setFieldValues] = useState<Map<string, FieldValue>>(new Map());
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [expertResults, setExpertResults] = useState<Record<string, { expert_name: string; expert_report: string }>>({});
    const [activeTab, setActiveTab] = useState<string>('summary');
    const [error, setError] = useState<string | null>(null);
    const [previews, setPreviews] = useState<Map<string, string>>(new Map());
    const [analysisStatus, setAnalysisStatus] = useState<string>('');
    const [receivedReports, setReceivedReports] = useState<Set<string>>(new Set());
    const [progress, setProgress] = useState<number>(0);
    
    const resultSectionRef = useRef<HTMLDivElement>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (expertIds.length > 0) {
            loadExpertInfo();
        } else {
            setLoading(false);
        }
    }, [expertIds.join(',')]);

    // 当收到新报告时，滚动到底部并自动选择第一个tab
    useEffect(() => {
        if (Object.keys(expertResults).length > 0) {
            // 如果没有选中tab，自动选择第一个
            if (!activeTab) {
                const firstKey = Object.keys(expertResults)[0];
                setActiveTab(firstKey);
            }
            
            // 滚动到底部
            if (resultSectionRef.current) {
                resultSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [expertResults]);

    // 进度条逻辑：每秒增加1%，到99%时暂停
    useEffect(() => {
        if (analyzing) {
            progressIntervalRef.current = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 99) {
                        // 到达99%时暂停
                        if (progressIntervalRef.current) {
                            clearInterval(progressIntervalRef.current);
                            progressIntervalRef.current = null;
                        }
                        return 99;
                    }
                    return prev + 1;
                });
            }, 1000); // 每秒增加1%
        } else {
            // 分析停止时清除定时器
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
        }

        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
        };
    }, [analyzing]);

    const loadExpertInfo = async () => {
        try {
            const promises = expertIds.map(id => expertApi.getById(id));
            const expertList = await Promise.all(promises);
            setExperts(expertList);

            // 按专家分组字段
            const fieldsMap = new Map<string, RequiredField[]>();
            
            expertList.forEach(expert => {
                if (expert.required_fields && Array.isArray(expert.required_fields)) {
                    fieldsMap.set(expert.id, [...expert.required_fields]);
                } else {
                    fieldsMap.set(expert.id, []);
                }
            });
            
            setFieldsByExpert(fieldsMap);
        } catch (err) {
            setError('加载专家信息失败');
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (field: RequiredField, value: string | File | null) => {
        const newValues = new Map(fieldValues);
        newValues.set(field.field_name, {
            fieldName: field.field_name,
            fieldType: field.field_type,
            value,
        });
        setFieldValues(newValues);
    };

    const handleFileSelect = (field: RequiredField, file: File | null) => {
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('请选择图片文件');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert('文件大小不能超过5MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const newPreviews = new Map(previews);
                newPreviews.set(field.field_name, e.target?.result as string);
                setPreviews(newPreviews);
            };
            reader.readAsDataURL(file);
        }
        handleFieldChange(field, file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const hasAnyValue = Array.from(fieldValues.values()).some(fv => fv.value !== null && fv.value !== '');
        if (!hasAnyValue) {
            alert('请至少填写一项信息');
            return;
        }

        try {
            setAnalyzing(true);
            setError(null);
            setExpertResults({});
            setAnalysisStatus('正在初始化分析...');
            setReceivedReports(new Set());
            setActiveTab(''); // 重置tab，等待第一个报告到达后自动设置
            setProgress(0); // 重置进度条
            
            const formData = new FormData();
            
            // 生成 task_id (UUID) 作为 thread_id
            const newTaskId = generateUUID();

            // 根据专家配置的 field_id 动态发送字段
            experts.forEach(expert => {
                const expertFields = fieldsByExpert.get(expert.id) || [];
                
                expertFields.forEach(field => {
                    const fieldValue = fieldValues.get(field.field_name);
                    
                    if (fieldValue && fieldValue.value !== null && fieldValue.value !== '') {
                        if (field.field_type === 'datetime' && typeof fieldValue.value === 'string') {
                            const dt = fieldValue.value.replace('T', ' ');
                            formData.append(field.field_id, dt);
                        } else if (field.field_type === 'image' && fieldValue.value instanceof File) {
                            formData.append(field.field_id, fieldValue.value);
                        } else if (field.field_type === 'text' && typeof fieldValue.value === 'string') {
                            formData.append(field.field_id, fieldValue.value);
                        }
                    }
                });
            });

            // 处理分析结果的辅助函数
            const processAnalysisResult = (analysisResult: any) => {
                // 保存专家分析结果
                const mappedResults: Record<string, { expert_name: string; expert_report: string }> = {};
                
                if (analysisResult.expert_results) {
                    // 遍历所有专家结果，根据 expert_name 找到对应的专家ID
                    Object.entries(analysisResult.expert_results).forEach(([expertName, expertResult]: [string, any]) => {
                        // 尝试多种匹配方式：精确匹配、包含匹配、部分匹配
                        let matchedExpert = experts.find(e => e.name === expertName);
                        if (!matchedExpert) {
                            // 如果精确匹配失败，尝试包含匹配（专家名称包含或等于expertName）
                            matchedExpert = experts.find(e => 
                                expertName.includes(e.name) || e.name.includes(expertName)
                            );
                        }
                        if (!matchedExpert) {
                            // 如果还是失败，尝试通过ID匹配（如果expertName本身就是ID）
                            matchedExpert = experts.find(e => e.id === expertName);
                        }
                        
                        // 使用专家ID作为key，如果没有匹配到则使用expertName
                        const key = matchedExpert ? matchedExpert.id : expertName;
                        
                        const reportContent = expertResult?.expert_report || expertResult?.content || '';
                        
                        // 如果已有相同key的报告，合并内容（避免覆盖）
                        if (mappedResults[key]) {
                            mappedResults[key].expert_report += '\n\n' + reportContent;
                        } else {
                            mappedResults[key] = {
                                expert_name: expertResult?.expert_name || expertName,
                                expert_report: reportContent,
                            };
                        }
                        
                        // 更新已接收报告列表
                        if (!receivedReports.has(key)) {
                            setReceivedReports(prev => new Set([...prev, key]));
                            const statusText = matchedExpert 
                                ? `已收到 ${matchedExpert.name} 的分析报告`
                                : `已收到 ${expertName} 的分析报告`;
                            setAnalysisStatus(statusText);
                        }
                    });
                }
                
                setExpertResults(prev => {
                    const updated = { ...prev, ...mappedResults };
                    // 如果还没有设置activeTab，设置第一个报告的tab
                    if (!activeTab && Object.keys(updated).length > 0) {
                        const firstKey = Object.keys(updated)[0];
                        setActiveTab(firstKey);
                    }
                    return updated;
                });
                
                // 如果收到综合报告，更新状态
                const hasSummaryReport = Object.values(mappedResults).some(
                    r => r.expert_name && r.expert_name.includes('综合')
                );
                if (hasSummaryReport) {
                    setAnalysisStatus('分析完成，已生成综合报告');
                }
            };
            
            // 调用分析接口，实时接收流式数据
            await fortuneApi.analyze(
                formData,
                expertIds,
                newTaskId,
                (completeResult) => {
                    processAnalysisResult(completeResult);
                    
                    // 如果分析完成，更新状态
                    if (completeResult.message === '分析完成') {
                        setAnalysisStatus('分析完成！');
                        setProgress(100); // 进度条到100%
                        setAnalyzing(false);
                    }
                }
            );
        } catch (err: any) {
            setError(`分析失败: ${err.message}`);
            setAnalysisStatus('');
            setProgress(0);
            setAnalyzing(false);
        }
    };

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const renderField = (field: RequiredField, expertId: string, fieldIndex: number) => {
        const fieldId = `field_${expertId}_${fieldIndex}`;
        const preview = previews.get(field.field_name);
        const fieldValue = fieldValues.get(field.field_name);

        if (field.field_type === 'text') {
            return (
                <div key={fieldId} className="form-field-item">
                    <div className="form-group">
                        <label htmlFor={fieldId}>{field.field_name}</label>
                        <input
                            id={fieldId}
                            type="text"
                            value={(fieldValue?.value as string) || ''}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            placeholder={`请输入${field.field_name}`}
                            className="form-input"
                        />
                    </div>
                </div>
            );
        } else if (field.field_type === 'datetime') {
            return (
                <div key={fieldId} className="form-field-item">
                    <div className="form-group">
                        <label htmlFor={fieldId}>{field.field_name}</label>
                        <input
                            id={fieldId}
                            type="datetime-local"
                            value={(fieldValue?.value as string) || ''}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            className="form-input"
                        />
                    </div>
                </div>
            );
        } else if (field.field_type === 'image') {
            return (
                <div key={fieldId} className="form-field-item">
                    <div className="form-group">
                        <label htmlFor={fieldId}>{field.field_name}</label>
                        <div className="file-upload-wrapper">
                            <div className="file-upload-area" onClick={() => {
                                const input = document.getElementById(`${fieldId}_file`) as HTMLInputElement;
                                input?.click();
                            }}>
                                {!preview ? (
                                    <>
                                        <div className="file-upload-icon">📸</div>
                                        <div className="file-upload-text">点击或拖拽上传{field.field_name}</div>
                                        <div className="file-upload-hint">支持 JPG、PNG 格式</div>
                                    </>
                                ) : (
                                    <>
                                        <img className="preview-image-overlay" src={preview} alt={`${field.field_name}预览`} />
                                        <div className="preview-overlay-mask">
                                            <div className="preview-overlay-text">点击重新上传</div>
                                            <div className="preview-overlay-filename">
                                                {(fieldValue?.value as File)?.name || ''}
                                            </div>
                                        </div>
                                    </>
                                )}
                                <input
                                    id={`${fieldId}_file`}
                                    type="file"
                                    accept="image/*"
                                    className="file-input"
                                    onChange={(e) => handleFileSelect(field, e.target.files?.[0] || null)}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="analysis-container">
                <div className="loading">正在加载专家信息...</div>
            </div>
        );
    }

    return (
        <div className="analysis-container">
            <div className="header">
                <h1>🔮 命理分析</h1>
                <button className="btn-back" onClick={() => navigate('/')}>
                    ← 返回首页
                </button>
            </div>

            {experts.length > 0 && (
                <div className="expert-info">
                    <div className="expert-info-name">
                        已选专家：{experts.map(e => e.name).join('、')}
                    </div>
                </div>
            )}

            <div className="main-content">
                <form id="fortuneForm" onSubmit={handleSubmit}>
                    {experts.map((expert) => {
                        const expertFields = fieldsByExpert.get(expert.id) || [];
                        if (expertFields.length === 0) return null;
                        
                        return (
                            <div key={expert.id} className="expert-fields-section">
                                <h3 className="expert-fields-title">
                                    <span className="expert-icon">{expert.icon || '🔮'}</span>
                                    {expert.name}
                                </h3>
                                <div className="expert-fields-container">
                                    {expertFields.map((field, fieldIndex) => 
                                        renderField(field, expert.id, fieldIndex)
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <div className="submit-section">
                        <button
                            type="submit"
                            className="submit-button"
                            disabled={analyzing}
                        >
                            {analyzing ? '正在分析中...' : '开始分析'}
                        </button>
                        {analyzing && (
                            <div className="loading-indicator">
                                <div className="progress-container">
                                    <div className="progress-bar-wrapper">
                                        <div 
                                            className="progress-bar" 
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="progress-text">
                                        {progress}%
                                    </div>
                                </div>
                                {analysisStatus && (
                                    <div className="analysis-status">
                                        {analysisStatus}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </form>
            </div>

            {error && (
                <div className="result-section">
                    <div className="error-message">❌ {error}</div>
                </div>
            )}

            {Object.keys(expertResults).length > 0 && (
                <div className="result-section" ref={resultSectionRef}>
                    <div className="success-message">
                        ✅ {analyzing ? '正在分析中...' : '分析完成！'}以下是您的命理分析结果：
                    </div>
                    
                    {analysisStatus && (
                        <div className="analysis-status-message">
                            {analysisStatus}
                        </div>
                    )}
                    
                    {/* Tab 切换 - 展示所有报告，包括综合报告 */}
                    <div className="result-tabs">
                        {Object.entries(expertResults).map(([expertId, expertResult]) => {
                            const expert = experts.find(e => e.id === expertId);
                            const isReceived = receivedReports.has(expertId);
                            const isSummary = expertResult.expert_name && expertResult.expert_name.includes('综合');
                            return (
                                <button
                                    key={expertId}
                                    className={`result-tab ${activeTab === expertId ? 'active' : ''}`}
                                    onClick={() => setActiveTab(expertId)}
                                >
                                    {isSummary ? '📋' : (expert?.icon || '🔮')} {expertResult.expert_name || expert?.name || '专家'}
                                    {isReceived && ' ✓'}
                                </button>
                            );
                        })}
                    </div>
                    
                    {/* Tab 内容 - 统一展示所有报告 */}
                    <div className="result-content">
                        {(() => {
                            // 如果没有选中tab，自动选择第一个报告
                            const currentTab = activeTab || Object.keys(expertResults)[0];
                            const currentResult = expertResults[currentTab];
                            
                            if (currentResult) {
                                return (
                                    <div className="markdown-content"
                                        dangerouslySetInnerHTML={{ __html: marked.parse(currentResult.expert_report) }}
                                    />
                                );
                            }
                            
                            // 如果没有任何报告，显示空状态
                            return null;
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Analysis;
