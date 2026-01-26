# StoryForge — Architecture & State Model

## 1. High-Level Architecture

StoryForge is divided into five layers:

1. Core
   - App lifecycle
   - Event bus
   - Global state store (single source of truth)

2. Engine
   - Rules Engine (deterministic)
   - Milestone Engine
   - Reward Engine
   - Ending Engine

3. AI
   - Prompt builder
   - Memory summarizer
   - LLM client (mockable)

4. UI
   - Narrative view
   - Choice panel
   - World / NPC visualization
   - Journal & milestone panels

5. Data
   - Themes
   - Chapters
   - Rules
   - Milestones

No layer mutates another directly.
All state changes go through engines.

---

## 2. Global Game State (Conceptual Schema)

GameState is the only truth.

```
GameState
├─ player
│  ├─ profile
│  ├─ identity
│  └─ stats
├─ world
│  ├─ chapter
│  ├─ tension
│  ├─ hope
│  └─ flags
├─ npcs
│  ├─ traits
│  ├─ relationship metrics
│  └─ key memories
├─ quests / threads
├─ milestones
├─ unlocks
└─ journal
```

---

## 3. Deterministic Rule Flow

```
Player Choice
→ Rules Engine evaluates consequences
→ GameState updates
→ Milestone Engine checks thresholds
→ Reward Engine applies unlocks
→ Ending Engine checks closure
→ AI expresses the result (narration only)
```

AI never alters GameState.

---

## 4. Configuration-Driven Expansion

- New themes = new data
- New chapters = new data
- New rules = new data

Core engines do not change.
This guarantees no refactor cost.

---

## 5. Debug Visibility Principle

Every important system value must be visible in UI during development:
- World tension / hope
- NPC trust and key memories
- Achieved milestones
- Recent rule evaluations

If it cannot be seen, it cannot be trusted.