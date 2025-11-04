import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { expertApi } from '../services/api';
import type { Expert, RequiredField } from '../types';
import './ExpertEdit.css';

const ExpertEdit: React.FC = () => {
    const [searchParams] = useSearchParams();
    const expertId = searchParams.get('id');
    const isEditMode = !!expertId;
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [skills, setSkills] = useState('');
    const [prompt, setPrompt] = useState('');
    const [icon, setIcon] = useState('🔮');
    const [requiredFields, setRequiredFields] = useState<RequiredField[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isEditMode && expertId) {
            loadExpert();
        }
    }, [expertId, isEditMode]);

    const loadExpert = async () => {
        try {
            setLoading(true);
            const expert = await expertApi.getById(expertId!);
            setName(expert.name);
            setSkills(expert.skills);
            setPrompt(expert.prompt || '');
            setIcon(expert.icon || '🔮');
            setRequiredFields(expert.required_fields || []);
        } catch (error) {
            console.error('加载专家失败:', error);
            alert('加载专家信息失败');
        } finally {
            setLoading(false);
        }
    };

    const addField = () => {
        setRequiredFields([...requiredFields, { field_name: '', field_type: 'text', field_id: '' }]);
    };

    const removeField = (index: number) => {
        setRequiredFields(requiredFields.filter((_, i) => i !== index));
    };

    const updateField = (index: number, updates: Partial<RequiredField>) => {
        const newFields = [...requiredFields];
        newFields[index] = { ...newFields[index], ...updates };
        setRequiredFields(newFields);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim() || !skills.trim()) {
            alert('请填写专家名称和技能');
            return;
        }

        // 验证字段配置
        const validFields = requiredFields.filter(
            field => field.field_name.trim() && field.field_type && field.field_id?.trim()
        ).map(field => ({
            ...field,
            field_id: field.field_id.trim()
        }));
        
        if (validFields.length < requiredFields.length) {
            alert('请确保所有字段都填写了字段名称、字段类型和控件ID');
            return;
        }

        try {
            setSaving(true);
            const expertData: Omit<Expert, 'id'> = {
                name: name.trim(),
                skills: skills.trim(),
                prompt: prompt.trim(),
                icon: icon.trim() || '🔮',
                required_fields: validFields,
            };

            if (isEditMode && expertId) {
                await expertApi.update(expertId, expertData);
            } else {
                await expertApi.create(expertData);
            }

            navigate('/expert/manage');
        } catch (error) {
            console.error('保存失败:', error);
            alert('保存失败，请稍后重试');
        } finally {
            setSaving(false);
        }
    };

    const availableFieldTypes = [
        { value: 'text', label: '文本' },
        { value: 'datetime', label: '时间' },
        { value: 'image', label: '图片' },
    ];

    if (loading) {
        return (
            <div className="expert-edit-container">
                <div className="loading">正在加载专家信息...</div>
            </div>
        );
    }

    return (
        <div className="expert-edit-container">
            <div className="header">
                <h1>{isEditMode ? '编辑专家' : '添加专家'}</h1>
                <button className="btn-back" onClick={() => navigate('/expert/manage')}>
                    ← 返回列表
                </button>
            </div>

            <div className="main-content">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="expertName">专家名称 *</label>
                        <input
                            id="expertName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="例如：八字专家"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="expertSkills">专家技能 *</label>
                        <textarea
                            id="expertSkills"
                            value={skills}
                            onChange={(e) => setSkills(e.target.value)}
                            required
                            placeholder="描述专家的技能和专长"
                        />
                        <div className="hint">简要描述专家的专业技能和专长领域</div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="expertIcon">专家图标（Emoji）</label>
                        <input
                            id="expertIcon"
                            type="text"
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder="例如：🔮 📅 ✋ 👤"
                        />
                        <div className="hint">输入一个 emoji 图标，用于在专家列表中显示（建议输入单个 emoji）</div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="expertPrompt">专家提示词</label>
                        <textarea
                            id="expertPrompt"
                            className="prompt-textarea"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="输入专家的系统提示词，用于指导AI专家的行为和分析方式"
                        />
                        <div className="hint">提示词用于定义专家的分析风格、专业领域和回答方式</div>
                    </div>

                    <div className="form-group">
                        <label>所需字段配置</label>
                        <div className="fields-container">
                            {requiredFields.map((field, index) => (
                                <div key={index} className="field-item">
                                    <div className="field-item-header">
                                        <span className="field-item-title">字段配置</span>
                                        <button
                                            type="button"
                                            className="btn-remove-field"
                                            onClick={() => removeField(index)}
                                        >
                                            删除
                                        </button>
                                    </div>
                                    <div className="field-item-body">
                                        <div>
                                            <label>字段名称 *</label>
                                            <input
                                                type="text"
                                                className="field-name"
                                                value={field.field_name}
                                                onChange={(e) => updateField(index, { field_name: e.target.value })}
                                                placeholder="例如：出生日期"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label>字段类型 *</label>
                                            <select
                                                className="field-type"
                                                value={field.field_type}
                                                onChange={(e) => updateField(index, { field_type: e.target.value as RequiredField['field_type'] })}
                                                required
                                            >
                                                {availableFieldTypes.map(ft => (
                                                    <option key={ft.value} value={ft.value}>
                                                        {ft.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label>控件ID *</label>
                                            <input
                                                type="text"
                                                className="field-id"
                                                value={field.field_id || ''}
                                                onChange={(e) => updateField(index, { field_id: e.target.value })}
                                                placeholder=""
                                                required
                                            />
                                            <div className="hint" style={{fontSize: '12px', color: '#666', marginTop: '4px'}}>
                                                用于在分析时根据控件ID获取字段值，必填
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="btn-add-field"
                            onClick={addField}
                        >
                            ➕ 添加字段
                        </button>
                        <div className="hint">配置专家分析所需的输入字段，如出生日期、照片等</div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => navigate('/expert/manage')}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={saving}
                        >
                            {saving ? '保存中...' : '保存'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExpertEdit;

