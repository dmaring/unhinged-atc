# Cleaning Up AI Slop with Spec-Driven Development

Last November, my partner Carly and I entered Joe Reis's [Practical Data Unhinged AI Vibe Coding Hackathon](https://joereis.substack.com/p/announcing-the-practical-data-unhinged). The theme options included "Minimum Viable Chaos" and "The App Nobody Asked For." Award categories included "Best AI Abuse of the Weekend" and "How Is This Even Working?" It was a genius idea that poked fun at vibe coding while embracing the choatic and unhinged fun that only vibe coding

We chose "Minimum Viable Chaos" and built a real-time multiplayer air traffic control game to crowd source air traffic control. This seemed abosolutly in line with the unhingness of the world today. So we went about vibe coding it with Claude Code. In two days. With day drinking.

The game is called [Unhinged ATC](https://github.com/dmaring/unhinged-atc). Multiple players share the same airspace, selecting and directing aircraft on a retro CRT radar screen. React frontend, Node.js backend, WebSocket state sync at 60 frames per second. We vibe-coded the entire thing with Claude, shipping features as fast as we could think of them. New chaos abilities? Sure, add them. Landing system? Why not. Weather cells? Throw it in. The hackathon energy was perfect for this kind of thing. You don't stop to write specs when you're three drinks deep and the demo is in six hours.

We had a blast. The game worked. We deployed it to GCP and real strangers played it.

And then I found a bug that took me two days to track down. The fix was one word.

If you read my last post, ["How to Vibe Code like a Google Engineer,"](LINK_TO_ARTICLE_1) you saw me build a project the *right* way. Spec-driven from day one, constitution file, acceptance criteria before code, 94% test coverage. That was MacroMetric. Unhinged ATC is the other thing. The thing you build when the vibes are flowing and nobody is asking about test coverage and the idea of tech debt doesn't exist except in a parallel universe.

The first article was aspirational. This one is confessional.

---

## What is AI Slop?

You've probably heard the term applied to AI-generated images, those glossy, soulless renders that look technically competent but feel hollow. AI slop in code is the same thing.

It compiles. It passes whatever tests exist. It looks reasonable in a PR review. But it lacks *intent*. The code does what it does, but nobody ever articulated *why* it should behave that way, or thought about what happens when things go wrong.

Here's what it looks like in practice:

- **Subtle bugs** from AI not understanding how systems interact across boundaries
- **Conventions violated** because AI optimizes for "compiles" not "communicates"
- **Happy-path-only implementations** where edge cases were never considered
- **Copy-paste duplication** where AI generated each feature in isolation and never noticed it was writing the same code three times
- **Dead code** that accumulates because AI generates confidently but never prunes

AI slop isn't bad code. It's code without intent.

Unhinged ATC had all five kinds. Let me show you the worst one.

---

## The Poster Child: The Ownership Color Bug

In Unhinged ATC, each player gets assigned a unique color when they join. When you select an aircraft to control, it turns your color on everyone's radar screen. When you select a *different* aircraft, the old one should revert to the default green.

It didn't.

When a player selected a new aircraft, the old one kept their color. Every player in the game saw it. Multiplayer visual state was permanently corrupted.

I stared at this for a while. The selection code looked correct. The rendering code looked correct. The WebSocket sync looked correct. Each piece of the system was, individually, doing exactly what it was supposed to do.

The bug existed in the space *between* the systems.

Here's the pipeline, step by step:

**Step 1: Server releases ownership**

```typescript
// GameRoom.ts, when player selects a new aircraft
Object.values(this.gameState.aircraft).forEach(a => {
  if (a.ownerId === controller.id) {
    a.ownerId = undefined;   // <-- valid JavaScript
    a.ownerColor = undefined; // <-- valid JavaScript
  }
});
```

This is correct JavaScript. Setting a property to `undefined` clears it.

**Step 2: Server serializes the state delta for WebSocket broadcast**

```
JSON.stringify({ ownerId: undefined, ownerColor: undefined })
// Output: "{}"
```

`JSON.stringify` strips keys with `undefined` values. This is correct JSON behavior, defined in the spec. The delta payload goes over the wire with no `ownerId` or `ownerColor` keys at all.

**Step 3: Client merges the delta into local state**

```typescript
// gameStore.ts, Zustand spread-merge
[id]: {
  ...store.gameState.aircraft[id],  // old state (has ownerColor: "#FF5733")
  ...updates,                        // delta (has no ownerColor key)
}
```

The spread operator preserves existing keys when the source doesn't contain them. Since the delta has no `ownerColor` key, the stale `"#FF5733"` survives. The aircraft stays red forever.

Three systems. Three correct behaviors. One bug.

No AI would reason about this without guidance. It requires understanding the full pipeline from server mutation through JSON serialization through WebSocket transport through client-side merge to canvas rendering. Each step is owned by a different layer of the stack, and the bug only shows up when all three interact in sequence.

**The fix:**

```diff
- a.ownerId = undefined;
- a.ownerColor = undefined;
+ a.ownerId = null;
+ a.ownerColor = null;
```

One word, two lines. `null` survives `JSON.stringify`. The delta arrives with `ownerColor: null`, the spread-merge overwrites the stale value, and the rendering code (`if (aircraft.ownerColor)`) already treats `null` as falsy, falling through to default green.

My first instinct was actually to fix this on the client side. When the selected aircraft changes, just clear the old one's color locally. But that would only fix it for the player doing the selecting. Every other player in the game would still see the stuck color. The fix had to happen at the source, on the server, so the corrected state propagates to everyone through the existing WebSocket broadcast.

This is the kind of bug that makes you reconsider your whole process. And life choices.

---

## Enter OpenSpec: Change-Scoped Specs for Brownfield Code

After finding that bug, I had a choice. I could fix it and move on, or I could fix it *and* build a system that prevents the next one.

If you read article 1, you know about the Spec Kit workflow. Constitution, full-feature specs, architecture plans, TDD task breakdowns. That works great when you're starting from zero. But Unhinged ATC is already running in production. I can't stop and write a constitution for a codebase that Carly and I hacked together over mimosas. I can't specify every feature that already works. I can't rewrite architecture docs for code that's deployed.

I needed to specify *the change*, not the world.

This is where [OpenSpec](LINK_TO_OPENSPEC) comes in. It's the another Spec Driven Develpment toolkit that has much better brownfield support (and is is actually being actively maintained). Instead of documenting an entire system upfront, you document each *change* as you make it. The specs accumulate over time from real problems, not from documentation marathons.

OpenSpec ships as a set of [slash commands](https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md) that you run inside Claude Code (or any AI coding assistant that supports custom skills). For this bug, I used the [Exploratory workflow](https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md#exploratory), which is designed for exactly this situation: you know something is wrong, but you need to investigate before committing to a fix.

Here's what that actually looked like in my terminal.

### Step 1: Explore

I started with `/opsx:explore` and described the symptom. OpenSpec's explore command tells Claude to investigate the codebase and present potential approaches before you commit to anything.

```
> /opsx:explore

AI: What would you like to explore?

> Aircraft ownership colors are getting stuck when players switch
  aircraft. The old aircraft keeps the player's color instead of
  reverting to green. All players see it.

AI: Let me investigate...
    [Traces ownership flow through GameRoom.ts, checks StateDelta
     serialization, examines client-side merge in gameStore.ts]

    Found the root cause: JSON.stringify strips `undefined` keys.
    The server sets ownerId to `undefined` on release, but that
    key disappears during serialization. The client spread-merge
    then preserves the stale color.

    Three approaches:
    1. Use `null` instead of `undefined` (preserves key in JSON)
    2. Send a separate WebSocket "release" event
    3. Client-side cleanup when selectedAircraftId changes

    Option 1 is the minimal fix. Options 2 and 3 have trade-offs...
```

You could get a similar investigation by just asking Claude Code to look into the bug. But the difference is what happens to that investigation. In a normal debugging session, the insights live in your chat history and evaporate when you close the terminal. With `/opsx:explore`, the investigation becomes the foundation for the artifacts that follow. The root cause analysis flows into the proposal. The rejected approaches flow into the design document. The behavioral expectations flow into the spec. Nothing gets lost between "I understand the bug" and "here's the permanent record of what we did about it."

### Step 2: Create the change

Once I understood the problem, I created a named change with `/opsx:new`:

```
> /opsx:new fix-aircraft-ownership-color-release

AI: Created openspec/changes/fix-aircraft-ownership-color-release/
    Ready to create: proposal
```

### Step 3: Build artifacts one at a time

The Exploratory workflow uses `/opsx:continue` to create planning artifacts one at a time, so you can review each one before moving on. This is different from `/opsx:ff` (fast-forward), which generates everything at once. For a bug this subtle, I wanted to check each artifact.

```
> /opsx:continue
```

This created the **proposal**, a short document capturing *why* this change exists:

```markdown
## Why

When a player selects a new aircraft, the previously controlled aircraft keeps
the player's color instead of reverting to the default green. This is a JSON
serialization bug: the server sets `ownerId` and `ownerColor` to `undefined`
on release, but `JSON.stringify` strips `undefined` keys from the delta payload.
The client's spread-merge then preserves the stale color values.

## What Changes

- Server uses `null` instead of `undefined` when releasing aircraft ownership
- Shared `Aircraft` type updated to allow `null` for `ownerId` and `ownerColor`
- Client rendering already handles this correctly (`null` is falsy)

## Impact

- `packages/shared/src/types/aircraft.ts`: Type change
- `packages/server/src/game/GameRoom.ts`: null instead of undefined
- Client rendering requires no changes
```

Another `/opsx:continue` created the **design**, which captures decisions and rejected alternatives:

> **Decision:** Use `null` instead of `undefined` for released ownership.
>
> **Rationale:** `JSON.stringify({ ownerColor: null })` produces `{"ownerColor":null}`, preserving the key. The client spread-merge then correctly overwrites the old value.
>
> **Alternative considered:** Sending an explicit "release" event via a separate WebSocket channel. *Rejected* because it adds protocol complexity for a problem solvable with a one-word fix.
>
> **Alternative considered:** Client-side cleanup. *Rejected* because it only fixes it for the selecting player, not for other players who also need to see the release.

This is the gold. Six months from now, when someone (or some AI) wants to refactor the ownership system, this document explains not just what we did but *what we considered and why we didn't do it*. The rejected alternatives are more valuable than the chosen one.

Another `/opsx:continue` created the **delta spec**, behavioral scenarios for *just the capability I touched*:

```markdown
### Requirement: Ownership release survives serialization

#### Scenario: Released ownership is broadcast via StateDelta

- WHEN the server releases ownership of an aircraft
- THEN the StateDelta payload MUST include `ownerId: null` and `ownerColor: null`
- AND the `null` values MUST survive JSON serialization

#### Scenario: Client merges null ownership from delta

- WHEN the client receives a StateDelta with `ownerColor: null`
- THEN the aircraft's ownerColor MUST be overwritten to `null`
- AND the aircraft MUST render in the default radar color
```

These scenarios are precise enough to be testable. They capture the intent that was missing when AI originally wrote the code. And they exist in the repo alongside the code they describe, living documentation that will constrain the next AI that touches this system.

### Step 4: Apply and archive

With the planning artifacts reviewed, `/opsx:apply` implemented the tasks and `/opsx:archive` finalized the change. The delta specs got promoted to the living specs directory. The repo now has permanent behavioral documentation for aircraft ownership that grew from a real bug, not a planning session.

```
openspec/
  specs/
    aircraft-ownership/spec.md     <- living spec (promoted from change)
    numeric-input-parsing/spec.md  <- living spec (promoted from change)
  changes/
    archive/
      2026-01-29-fix-aircraft-ownership-color-release/
        proposal.md
        design.md
        tasks.md
        specs/aircraft-ownership/spec.md
      2026-01-29-add-parseint-radix/
        proposal.md
        design.md
        tasks.md
        specs/numeric-input-parsing/spec.md
```

Two changes. Two living specs. Each one grew from a real problem.

---

## More AI Slop, More Specs

The ownership bug is the poster child, but it wasn't the only slop in the codebase. Here are a few more that show the range.

### The Edge Case AI Never Considered

After fixing the ownership color bug, I looked at the code that handles player disconnects. Here's what `removeController` does when a player leaves:

```typescript
// GameRoom.ts:566
removeController(socketId: string): void {
  const controller = this.gameState.controllers[socketId];
  if (!controller) return;

  delete this.gameState.controllers[socketId];
  this.activePlayerIds.delete(socketId);

  // Add event for controller leaving
  this.addEvent({ /* ... */ });
}
```

Notice what's missing?

When a player disconnects, this method removes them from the controller list. But it never releases the aircraft they were controlling. The `ownerId` and `ownerColor` on their aircraft persist, pointing to a controller that no longer exists.

Every remaining player sees a ghost: an aircraft painted in the color of someone who already left, locked to a controller ID that doesn't resolve to anyone. Nobody can select it. The color never goes away.

The AI built the `select_aircraft` flow with proper ownership release. That's the code I fixed in the first bug. It understood that switching aircraft requires releasing the old one. But it never considered the *disconnect* path, the case where a player doesn't switch aircraft but just vanishes. Same ownership system, different trigger, completely forgotten edge case.

The fix is five lines:

```typescript
// Release ownership of any aircraft controlled by the departing player
Object.values(this.gameState.aircraft).forEach(a => {
  if (a.ownerId === socketId) {
    a.ownerId = null;
    a.ownerColor = null;
  }
});
```

The spec that should have existed:

> **WHEN** a controller disconnects
> **THEN** all aircraft they own MUST have `ownerId` and `ownerColor` set to `null`
> **AND** those aircraft MUST render in the default color for all remaining players

This is the pattern with AI-generated edge cases. The happy path works perfectly. The AI built a complete selection system with mutual exclusivity, ownership transfer, and color assignment. It just never asked "what happens when someone leaves?"

### The Code That Works But Doesn't Communicate

Every `parseInt()` call in the client, eight of them across three files, was missing the radix parameter:

```typescript
// Before
parseInt(heading)
parseInt(altitude)
parseInt(speed)

// After
parseInt(heading, 10)
parseInt(altitude, 10)
parseInt(speed, 10)
```

This isn't a bug. Modern JavaScript engines default to base-10 for `parseInt` unless the string starts with `0x`. The code works identically before and after the change.

But it's a linter violation (ESLint's `radix` rule). It obscures intent, because a reader has to *know* the implicit default to understand the code. It's the kind of thing that signals "this code was generated, not authored." A human JavaScript developer would add the radix out of habit. An AI optimizes for "compiles."

The OpenSpec change for this was intentionally lightweight:

> **Decision:** Use `parseInt(value, 10)` rather than switching to `Number()`.
> Changing the parsing function could subtly alter behavior; radix addition is zero-risk.
>
> **Decision:** Mechanical replacement only. Each call site gets `, 10` added. No surrounding code changes, no refactoring.

Even for a trivial fix, documenting the decision ("we chose radix addition over switching to `Number()`") captures intent. The next AI that touches this code has a spec that says "all parsing MUST use explicit base-10 radix."

### The Same Code, Written Three Times

`GameRoom.ts`, the 1,574-line heart of the game server, contains three methods for resetting the game:

- `reset()` for admin resets, preserves controllers
- `resetGameState()` for full resets, clears controllers
- `resetForNextGame()` for next round, preserves controllers and queue

All three do the same thing. Clear tracking state, increment the game epoch, reinitialize the game state object, initialize chaos abilities, spawn initial aircraft. The only difference between them is whether they preserve the controllers dictionary.

Each method copy-pastes approximately 50 lines of identical initialization code. And `reset()` goes one step further: it re-inlines the *entire airspace definition* (airports, runways, waypoints, bounds, about 80 lines of config) instead of reusing the existing `this.gameState.airspace` reference that the other two methods correctly use.

There's also a method called `hasAircraftChanged`, ten lines of code that compares aircraft state across ticks. It's defined as a private method. It's never called from anywhere. Dead code that AI generated for some purpose it then abandoned.

None of this is a bug. The game works fine. But it's a different kind of AI slop: complexity without intent. The AI generated each reset variant independently, probably in response to three separate prompts, and never noticed it was duplicating itself. Each method was a reasonable response to "add a reset function for X scenario." None of them was written with awareness that two others already existed.

The fix is to extract a shared `resetInternal()` method and have all three variants call it, differing only in which controllers dictionary they pass. The duplicate airspace definition gets deleted entirely. `hasAircraftChanged` gets deleted. Net result: about 150 fewer lines of code doing exactly the same thing.

---

## How to Find AI Slop

These bugs and cleanups didn't find themselves. Here's the process that surfaced them.

**Start with symptoms.** The ownership color bug was a user-visible problem. Players reported seeing stuck colors. That was the entry point. I didn't go looking for AI slop. A real bug made me look at the code carefully for the first time since Carly and I shipped it during the hackathon.

**Follow the fix outward.** After understanding the `undefined`/`null` serialization issue, I asked: "Where else does this pattern appear?" That led me to the disconnect path. Same ownership system, different code path, same class of bug.

**Read the code like a reviewer, not an author.** When you wrote the code (or directed AI to write it), you had context. Reading it cold, as if someone handed you a PR, reveals things the author missed. The three duplicated reset methods are obvious to a reader. They weren't obvious to me when I was vibe-coding each feature one prompt at a time.

**Let the spec-writing process surface gaps.** When I sat down to write behavioral scenarios for aircraft ownership, I naturally thought about edge cases. "What happens when a player disconnects?" That question never came up during implementation because I was focused on the happy path. The discipline of writing WHEN/THEN scenarios forces you to think about the boundaries.

The meta-lesson: **AI slop becomes visible when you shift from "does it work?" to "what should it do?"** The act of specifying intent, even retroactively, reveals the gaps between what exists and what was intended.

---

## Less Infrastructure, More Signal

One more thing. Before adopting OpenSpec for brownfield changes, I had a full Spec Kit installation in this repo. 2,207 lines of templates, bash scripts, constitution files, and directory scaffolding. It was the infrastructure from article 1, transplanted wholesale into a project that didn't need it.

I deleted all of it.

In its place: a single `config.yaml` file and change-scoped artifacts that grow from real work. The living specs directory now has 363 lines of actual behavioral documentation, each line earned by fixing a real problem.

The tools should be lighter than the work they enable.

---

## The Payoff

After four changes through OpenSpec, here's what the repo has that it didn't have before:

- **Behavioral specs** for aircraft ownership and numeric input parsing, with concrete WHEN/THEN scenarios that any future contributor (human or AI) can read
- **Design decisions** with rejected alternatives, so the next person who asks "why don't we just use a separate WebSocket event?" can find the answer instead of learning the hard way
- **A living audit trail** that grows from real bugs and cleanup, not from a documentation sprint nobody wanted to do

Each spec grew from a real problem. Each one captures intent that was missing when AI originally wrote the code. And each one constrains the next AI that touches the system.

In brownfield, documentation is a byproduct of fixing things, not a prerequisite for building things.

---

## What You Can Do Monday Morning

1. **Start with your worst bug.** The one where you said "how did AI write this?" That's your first OpenSpec change.

2. **Write a proposal before touching code.** Even for a one-line fix. Especially for a one-line fix. If you can't articulate *why* the change is needed, you don't understand the bug yet.

3. **Document rejected alternatives.** "We considered X and rejected it because Y" is the most valuable sentence in any design document. Future-you needs to know what you already tried.

4. **Follow the fix outward.** After fixing one bug, ask: "Where else does this pattern appear?" The same class of slop usually shows up in multiple places.

5. **Let specs accumulate.** Don't try to document everything at once. Each change adds a spec. Over time, the most-touched parts of your codebase develop the richest documentation, which is exactly where you need it.

6. **Match your tools to your situation.** Full spec-driven development for greenfield. Lightweight, change-scoped specs for brownfield. The goal is intent capture, not bureaucracy. If the spec is heavier than the fix, you're doing it wrong.

---

## The Thread Between Two Articles

Article 1 was about preventing AI slop. Building with specs from day one so the code has intent baked in from the start.

This article is about cleaning it up. Retrofitting specs onto code that shipped without them, one bug at a time.

Both use the same principle: **intent is the source of truth.** Whether you specify upfront or retrofit after the fact, the discipline is the same. Know what you want before you let AI write it. And when you discover that nobody ever knew what they wanted, write it down now, so the code finally has a reason to exist.

---

*[Unhinged ATC](https://github.com/dmaring/unhinged-atc) is open source. You can see every OpenSpec artifact, every archived change, and every behavioral spec in the repo. [OpenSpec](LINK_TO_OPENSPEC) is the tool I used for brownfield spec management. And if you missed it, [article 1](LINK_TO_ARTICLE_1) covers the greenfield approach.*
