# -*- coding: utf-8 -*-
"""
修复 parlant 库中 JSON 序列化时对中文字符进行 Unicode 转义的问题

问题：parlant 在构建 prompt 时，使用 json.dumps() 默认 ensure_ascii=True，
导致中文字符被转义为 Unicode 转义序列格式，模型可能因此返回错误的 JSON。

解决方案：monkey patch prompt_builder 模块中的 json.dumps，设置 ensure_ascii=False
"""


def fix_parlant_json_encoding():
    """
    修复 parlant 库中的 JSON 编码问题
    
    在导入 parlant 后调用此函数，它会修改 prompt_builder 中的 json.dumps，
    使其默认使用 ensure_ascii=False，这样中文字符就不会被转义。
    """
    try:
        from parlant.core.engines.alpha import prompt_builder
        import json as json_module
        
        # 保存原始的 json.dumps
        original_dumps = json_module.dumps
        
        # 创建修复后的 dumps 函数
        def patched_dumps(obj, **kwargs):
            """修复后的 json.dumps，默认 ensure_ascii=False"""
            # 如果调用者没有明确指定 ensure_ascii，则设置为 False
            if 'ensure_ascii' not in kwargs:
                kwargs['ensure_ascii'] = False
            return original_dumps(obj, **kwargs)
        
        # 替换 prompt_builder 模块中的 json.dumps
        # 因为 prompt_builder 使用 import json，所以 json 是模块级别的引用
        # 我们需要替换 prompt_builder 模块命名空间中的 json.dumps
        prompt_builder.json.dumps = patched_dumps
        
        print("✅ 已修复 parlant JSON 编码问题（ensure_ascii=False）")
        print("   现在中文字符将直接传递，不会被转义为 Unicode 转义序列")
        return True
        
    except ImportError as e:
        print(f"⚠️ 无法导入 parlant 模块: {e}")
        print("   请确保在导入 parlant 后调用此函数")
        return False
    except AttributeError as e:
        print(f"⚠️ 无法访问 prompt_builder.json: {e}")
        print("   尝试使用备用方法...")
        return _fix_using_alternative_method()
    except Exception as e:
        print(f"⚠️ 修复 JSON 编码时出错: {e}")
        import traceback
        traceback.print_exc()
        return False


def _fix_using_alternative_method():
    """备用修复方法：直接修改 json 模块"""
    try:
        import json
        original_dumps = json.dumps
        
        def patched_dumps(obj, **kwargs):
            if 'ensure_ascii' not in kwargs:
                kwargs['ensure_ascii'] = False
            return original_dumps(obj, **kwargs)
        
        # 替换全局 json.dumps（这可能影响其他代码，但作为临时方案）
        json.dumps = patched_dumps
        
        print("✅ 已使用备用方法修复 JSON 编码（全局 json.dumps）")
        print("   ⚠️ 注意：这会影响所有使用 json.dumps 的代码")
        return True
    except Exception as e:
        print(f"⚠️ 备用方法也失败: {e}")
        return False


# 如果直接运行此模块，尝试应用修复
if __name__ == '__main__':
    fix_parlant_json_encoding()

