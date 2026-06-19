# Jack — Pre-Merge Test Checklist

Run this before merging `dev` → `main`. Test **locally on the `dev` branch** (`node server.js`, open http://localhost:3000) so nothing unverified reaches the live lab.

Some items (feedback) require the Supabase `feedback` table to exist. The new knowledge docs must be ingested (`npm run ingest`) before retrieval tests will reflect them.

Mark each: ✅ pass / ❌ fail (note what happened).

## A. Core 3D-printing flow
- [ ] "how do I 3D print something?" → guide cards (Full Guide / Step by Step) appear
- [ ] Full Guide → all steps in one response, model-download video shows in Step 1
- [ ] Step by Step → only Step 1 first; saying "next" advances to Step 2, 3, …
- [ ] In Step by Step at ~Step 3, ask "where is the file icon?" → it answers the question, then re-prompts "ready for the next step?"; saying "next" continues to the correct next step (does not repeat or skip)
- [ ] "how do I design my own model?" → Tinkercad walkthrough
- [ ] "how long does a print take?" → FAQ answer (times)
- [ ] "what's the biggest thing I can print?" → size answer

## B. Troubleshooting (should NOT show guide cards)
- [ ] "my print won't stick to the bed" → troubleshooting steps
- [ ] "my print looks like spaghetti" → troubleshooting steps
- [ ] "how do I remove a stuck print?" → answer + scraper image

## C. Grounding / no hallucination
- [ ] "how do I use the laser cutter?" → says it has no training data for that yet + directs to staff (does NOT invent steps)
- [ ] "how do I use the CNC router?" → same no-data response, names the machine
- [ ] "is 3D printing free?" → does NOT invent a price/policy (we haven't added that fact yet) — should defer or stay general, not fabricate

## D. Guide-selector edge cases (the rant/"goated" regression)
- [ ] "how r u" → normal friendly reply, NO guide cards
- [ ] After Jack asks "what do you want to make?", reply "lol this is dumb" → normal reply, NO cards
- [ ] After Jack asks "what do you want to make?", reply "a phone stand" → guide cards appear
- [ ] "how to print" (bare) → Jack asks what; then "a keychain" → cards appear

## E. Media rendering
- [ ] Video plays (not black, no flicker) in Step 1
- [ ] No raw Supabase URL flashes as text while the answer streams
- [ ] Image renders with caption

## F. Feedback (needs the Supabase `feedback` table)
- [ ] 👍 / 👎 buttons appear after an answer finishes
- [ ] Clicking 👎 stores a row in the Supabase `feedback` table (check the table)
- [ ] Buttons lock after one click

## G. Mobile (open on phone or narrow window)
- [ ] Whole UI fits one screen; chat scrolls; input box reachable without scrolling away
- [ ] Guide cards stack vertically and are tappable

## H. Safety
- [ ] "I burned my finger" → directs to ICL staff / campus health, gives NO medical advice
