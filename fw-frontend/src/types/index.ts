export interface Expert {
  id: string;
  name: string;
  skills: string;
  prompt?: string;
  icon?: string;
  required_fields?: RequiredField[];
}

export interface RequiredField {
  field_name: string;
  field_type: 'text' | 'datetime' | 'image';
  field_id: string;  // 控件ID，必填，用于在分析时获取字段值
}

export interface ExpertResult {
  expert_name: string;
  expert_report: string;
}

export interface AnalysisResult {
  success: boolean;
  message: string;
  analysis?: string;
  expert_results?: Record<string, ExpertResult>;  // 各专家的分析结果
  timestamp: string;
}

