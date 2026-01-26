(function (SF) {

    SF.ai = SF.ai || {};

    /**
     * 核心 AI 请求入口
     * choice / world / mission 都必须走这里
     */
    SF.ai.request = function (context, onSuccess, onError) {

        if (!SF.llm || !SF.llm.call) {
            onError && onError('LLM not available');
            return;
        }

        // ===== 1. 组装 Prompt（非常关键）=====
        var prompt = buildPrompt(context);

        // ===== 2. UI：进入 Thinking 状态 =====
        if (SF.ui && SF.ui.showLoading) {
            SF.ui.showLoading();
        }

        // ===== 3. 调用你「已经跑通」的 LLM =====
        SF.llm.call(
            prompt,
            function (text) {
                if (SF.ui && SF.ui.hideLoading) {
                    SF.ui.hideLoading();
                }

                // 解析 AI 输出（结构化兜底）
                var result = parseAIResult(text);

                onSuccess && onSuccess(result);
            },
            function (err) {
                if (SF.ui && SF.ui.hideLoading) {
                    SF.ui.hideLoading();
                }
                onError && onError(err);
            }
        );
    };

    // =================================================
    // Prompt 构建（现在不玩花的，先保证“动起来”）
    // =================================================
    function buildPrompt(context) {

        var memory = (SF.memory && SF.memory.dump)
            ? JSON.stringify(SF.memory.dump())
            : 'No memory';

        return `
你是一个剧情驱动的互动游戏 AI。
请根据【玩家行为】给出【世界的回应】，并提供【下一步可选行动】。

【玩家行为】
${JSON.stringify(context)}

【世界记忆】
${memory}

请用如下格式回答（必须）：
---
RESULT:
世界回应文本
CHOICES:
- 选项一
- 选项二
- 选项三
---
`;
    }

    // =================================================
    // AI 输出解析（防止再次“空转”）
    // =================================================
    function parseAIResult(text) {

        var result = {
            text: '',
            choices: []
        };

        if (!text) {
            result.text = '世界一时沉默，但某种变化正在酝酿。';
            result.choices = [
                { id: 'wait', label: '等待变化' }
            ];
            return result;
        }

        var parts = text.split('CHOICES:');
        result.text = parts[0].replace('RESULT:', '').trim();

        if (parts[1]) {
            parts[1].split('\n').forEach(function (line, i) {
                var label = line.replace(/^-/, '').trim();
                if (label) {
                    result.choices.push({
                        id: 'ai_' + i,
                        label: label
                    });
                }
            });
        }

        // 兜底：AI 没给 choices
        if (!result.choices.length) {
            result.choices.push({
                id: 'continue',
                label: '继续行动'
            });
        }

        return result;
    }

})(StoryForge);