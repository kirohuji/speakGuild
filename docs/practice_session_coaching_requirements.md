# Practice Session Coaching Requirements

## Background

The current practice session has moved from single-question scoring to an Ink/VN dialogue flow. This is the right direction for an immersive speaking app: the learner should stay in the scene while practicing, and receive deeper coaching only after the scene is complete.

Per-turn AI feedback is intentionally not shown in the first implementation pass. AI judgement can continue to run in the background for objectives, branches, and chunk usage, but visible coaching should avoid interrupting the user's sense of being in a conversation.

## Goals

1. Keep the practice scene immersive while the user is speaking.
2. Give the user a clear way to finish the session and enter review.
3. Make the review page action-oriented, not just a score report.
4. Support the learning loop: practice -> review -> retell -> save useful expressions -> next practice.

## User Flow

### 1. Prepare

The user sees:

- Topic prompt
- Key vocabulary
- Target chunks
- Sentence patterns
- Short topic explanation

The user can inspect details before starting, but should not be forced through a long lesson.

### 2. Practice

The main screen remains a VN scene.

Visible support during practice:

- Current objective
- A small set of usable chunks
- Progress toward objectives

Hidden/background support:

- AI judges whether the user satisfied the current communicative intent.
- AI detects completed objectives and naturally used chunks.
- Ink receives judgement variables and continues the scripted flow.

Not shown in this phase:

- Full grammar correction
- Score
- Long AI comments
- Expression upgrade report

### 3. End Of Session

When the Ink story ends, the player should show a clear review action instead of only "story ended".

Primary action:

- View review

Secondary actions:

- Practice again
- Return to preparation

For fallback/free practice, the user should be able to manually finish after at least one user response.

### 4. Review

The review page should contain:

- Overall score and short summary
- Objective completion
- Core chunk usage
- Key language corrections
- Strengths
- Improvements
- Next step suggestion

It should also contain action blocks:

- Retell once using the upgraded expression
- Save corrected sentences or useful chunks to the expression library
- Practice again
- Go to expression library

## AI Behavior

### Per-Turn Judgement

Per-turn judgement may return:

- `intent`
- `passed`
- `objectiveCompleted`
- `chunksUsed`
- `inkVariables`
- `feedback`
- `confidence`

In this product stage, `feedback` is stored or ignored, but not surfaced in the VN scene.

### Session Summary

Session summary should analyze the current session only. The backend should read a durable `PracticeSession` with its turns and context snapshots instead of analyzing all historical dialogue records for the topic.

## Implementation Notes

### Current Pass

- Add a visible review CTA when the VN story ends.
- Add a manual finish/review entry during practice after the user has spoken.
- Persist a `PracticeSession` and `PracticeTurn` records before analysis.
- Add retell and save-expression actions to the review panel.
- Keep per-turn AI feedback hidden to protect immersion.

## Session-Based Record Design

The durable implementation should treat every practice attempt as a session.

### PracticeSession

Stores the stable context and final analysis:

- `userId`
- `topicId`
- `sceneId`
- `inkScriptId`
- `status`: `active`, `completed`, `analyzing`, `analyzed`, or `failed`
- `topicSnapshot`
- `sceneSnapshot`
- `objectivesSnapshot`
- `chunksSnapshot`
- `vocabSnapshot`
- `sentencePatternsSnapshot`
- `turnCount`
- `analysisResult`
- `analysisRaw`
- `analysisError`
- timestamps for start, completion, and analysis

Snapshots are important because topic content, chunks, and vocabulary can change after a user finishes a practice.

### PracticeTurn

Stores one user response paired with the NPC line that prompted it:

- `sessionId`
- `round`
- `npcText`
- `userText`
- `inputNodeId`
- `tags`
- `judgement`
- `objectivesCompleted`
- `chunksUsed`

The analysis should evaluate only `userText`; `npcText` is context.

### Analysis Contract

The analysis service should read the session from the backend, not trust the frontend to provide the learning context. The prompt should include:

- scene context
- topic prompt and teaching notes
- objectives
- target chunks with meanings/examples
- scene vocabulary
- sentence patterns
- user turns and per-turn judgement

The result is written back to `PracticeSession.analysisResult`, so the user can leave the practice flow and later view the record in Profile -> Practice Records.

### Later Pass

- Add a real background queue for analysis jobs.
- Persist retell attempts.
- Add a graduated hint ladder.
- Add a compact post-turn signal without text, such as objective progress only.
- Add prompt test cases for judgement and summary quality.
