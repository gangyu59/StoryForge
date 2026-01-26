(function (SF) {

    SF.llm.call = function (prompt, onSuccess, onError) {
        var provider = SF.llm.current.provider;
        var cfg = SF.llm.config[provider];

        if (!cfg) {
            onError && onError('Unknown LLM provider');
            return;
        }

        if (provider === 'deepseek' || provider === 'ark' || provider === 'doubao') {
            callArkLike(cfg, prompt, onSuccess, onError);
        } else if (provider === 'claude') {
            callClaude(cfg, prompt, onSuccess, onError);
        } else if (provider === 'gemini') {
            callGemini(cfg, prompt, onSuccess, onError);
        }
    };

    // ===== Ark / DeepSeek / DouBao（OpenAI-like）=====
    function callArkLike(cfg, prompt, ok, err) {
        fetch(cfg.apiUrl || (cfg.baseUrl + '/chat/completions'), {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + cfg.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: cfg.model,
                messages: [
                    { role: 'system', content: 'You are a narrative game AI.' },
                    { role: 'user', content: prompt }
                ]
            })
        })
        .then(r => r.json())
        .then(d => ok && ok(d.choices[0].message.content))
        .catch(e => err && err(e.message));
    }

    // ===== Claude（REST 版，简化）=====
    function callClaude(cfg, prompt, ok, err) {
        fetch(cfg.apiUrl, {
            method: 'POST',
            headers: {
                'x-api-key': cfg.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: cfg.model,
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        })
        .then(r => r.json())
        .then(d => ok && ok(d.content[0].text))
        .catch(e => err && err(e.message));
    }

    // ===== Gemini（API Key 版）=====
    function callGemini(cfg, prompt, ok, err) {
        fetch(cfg.apiUrl + '?key=' + cfg.apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        })
        .then(r => r.json())
        .then(d => ok && ok(d.candidates[0].content.parts[0].text))
        .catch(e => err && err(e.message));
    }

})(StoryForge);