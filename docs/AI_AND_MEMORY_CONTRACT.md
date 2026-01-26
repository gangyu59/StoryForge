# StoryForge — AI & Memory Contract

## 1. Fundamental Rule

AI has no memory.
The system has memory.

AI only receives curated context.

---

## 2. What AI Is Allowed To Do

- Generate scene descriptions
- Generate NPC dialogue
- Explain consequences in narrative form
- Confirm milestones and chapter endings

AI is a narrator and performer, not a judge.

---

## 3. What AI Is Forbidden To Do

- Decide success or failure
- Modify world state
- Invent new mechanics or rules
- Decide milestone completion
- Persist memory

If AI output conflicts with system state, the system wins.

---

## 4. Memory Layers

1. System Memory (Persistent)
   - World state
   - NPC key memories
   - Player identity
   - Milestones

2. AI Context Memory (Ephemeral)
   - Summaries only
   - Valid for one call

---

## 5. NPC Memory Model

NPCs have:

- Fixed traits (never change)
- Relationship metrics (changeable)
- Key memories (few, irreversible)

Example:
- Traits: guarded, idealistic
- Trust: 0.6
- Key memories:
  - player_defended_me
  - player_did_not_force_choice

Only these are passed to AI.

---

## 6. AI Invocation Rule of Thumb

Before calling AI, ask:

"If this were replaced by a template, would the system still work?"

- If yes → do not call AI
- If no → AI is justified

---

## 7. Call Frequency Guideline

- 5–8 AI calls per 10–15 minutes of gameplay
- No real-time or per-frame calls
- Always allow graceful fallback