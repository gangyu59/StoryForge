StoryForge/
│
├── index.html
│
├── css/
│   ├── reset.css           ← 移动端一致性
│   ├── base.css            ← 字体 / 颜色 / 变量
│   ├── layout.css          ← 页面骨架（Header / Panels）
│   ├── components.css      ← 卡片 / 按钮 / 对话框
│   ├── game.css            ← 剧情 / 角色 / 任务视觉
│   └── animations.css      ← 轻动画（沉浸感）
│
├── js/
│   ├── core/               ← ❗不可动摇的引擎层
│   │   ├── namespace.js    ← StoryForge 全局命名空间
│   │   ├── world.js        ← 世界状态（唯一真相）
│   │   ├── memory.js       ← AI 记忆系统
│   │   ├── milestone.js    ← 里程碑 / 成就
│   │   ├── session.js      ← 保存 / 恢复
│   │   ├── event_loop.js   ← 世界节拍（Tick）
│   │   └── ai_engine.js    ← LLM 抽象层（实时性关键）
│   │
│   ├── game/               ← 游戏逻辑（可扩展）
│   │   ├── narrative.js    ← 剧情节拍 & 结构
│   │   ├── choices.js      ← 玩家决策系统
│   │   ├── rewards.js      ← 奖励 / 解锁
│   │   └── hooks.js        ← 悬念 / 回归钩子
│   │
│   ├── ui/                 ← UI 控制逻辑（无业务）
│   │   ├── layout.js       ← UI 外壳
│   │   ├── header.js       ← 顶部状态 / 时间 / 保存
│   │   ├── scene_view.js   ← 当前剧情场景
│   │   ├── choice_view.js  ← 决策按钮
│   │   ├── memory_view.js  ← 世界记忆 / 回顾
│   │   ├── milestone_view.js ← 成就 / 阶段
│   │   └── loading.js      ← AI 生成反馈（实时感）
│   │
│   └── app.js              ← 启动器（非常薄）
│
├── ui/
│   ├── templates/          ← HTML 模板（字符串）
│   │   ├── layout.html
│   │   ├── scene.html
│   │   ├── choice.html
│   │   └── milestone.html
│   │
│   └── icons/
│       ├── ai.svg
│       ├── save.svg
│       └── milestone.svg
│
├── assets/
│   ├── sounds/             ← 轻音效（可选）
│   └── images/
│
└── docs/
    ├── CONCEPT.md          ← 游戏理念（你已有）
    ├── ARCHITECTURE.md     ← 系统架构
    ├── MEMORY_MODEL.md     ← AI 记忆策略
    ├── MILESTONES.md       ← 里程碑设计
    └── UX_GOALS.md         ← 30 分钟沉浸指标