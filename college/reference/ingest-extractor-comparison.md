# Ingest extractor comparison (Step 7)

Compared the **old heuristic** (`heuristicSuggestions`) against the **new model extractor** (`extractTodosFromText`) on three fixtures.

Local agent VM has no `AI_GATEWAY_API_KEY`, so the new path correctly returns a configuration error here. On Vercel Production (kyle-college) the AI Gateway runs **Gemini 2.5 Flash** by default (free-tier). Claude Sonnet needs paid AI Gateway credits; if a preferred model is blocked, the app falls back to `poolside/laguna-s-2.1-free`.

## Fixtures

| Id | Kind | File |
| --- | --- | --- |
| pdf-webinar | PDF text extract | `lib/fixtures/webinar-sample.pdf` |
| word-handout | Word-style text (Word upload not in ingest; text path only) | `lib/fixtures/ingest-word-counselor-handout.txt` |
| paste-ap-email | Pasted email | `lib/fixtures/ingest-paste-ap-email.txt` |

## Old heuristic results (this run)

### paste-ap-email
- Both steps must be finished by October 31st without a late fee.
- Please register for AP exams on College Board by October 31.
- Kyle should complete Total Registration once it opens September 25.

Still pulls obligation sentences that are not always clean parent to-dos (first line).

### word-handout
- For juniors planning to apply Early Decision or Early Action next fall:
- Request teacher recommendations by May 1 so writers have time before senior year.
- This handout is for current juniors. Transfer applicants should see the separate transfer packet.

Includes audience narration and incomplete lines — the failure mode Jason saw.

### pdf-webinar
- Kyle should practice SAT reading every weeknight
- Kat can schedule the campus visit for October
- Follow up with counselor about transcript requests

## New model (local)
`ERROR: AI extraction is not configured` — expected without a gateway key in this environment.

## What the new path does in production
1. Reads the whole document with the brief’s system prompt (word-for-word).
2. Validates JSON with zod; retries once; errors to the UI instead of dumping lines.
3. Drops candidates without evidence in the source, confidence &lt; 0.5, or unmatched schools.
4. Review UI shows document summary, evidence quotes, confidence sort, and “Updates existing”.

Re-run with a key:
```bash
cd college && AI_GATEWAY_API_KEY=… npx tsx lib/scripts/compare-ingest-extractors.ts
```
