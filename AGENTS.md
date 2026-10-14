# Repository workflow

- Keep `main` working. Do feature work on branches and merge through pull requests using a regular merge commit, never squash, so every commit is retained.
- Current focus: participant pages, custom fields, and edit mode on `feature/custom-fields`. Suggest a new branch for a separate feature.
- When the user reports changes, inspect the diff and group changes by purpose into small, meaningful commits. Use messages in the form `type: what`, such as `feat: add custom participant fields`.
- Before committing, run `npx tsc --noEmit` and `npx eslint` from `frontend/`. Report any failures.
- Push the feature branch after committing. Do not push feature changes directly to `main`.
- The user is the sole author. Preserve their Git identity and do not add co-author trailers.
- Until the user changes this instruction, set author and committer dates to October 14, 2026. Do not rewrite existing commits merely to change dates.
- Never commit `docs/PLAN.md`; it is private.
- Keep the root `README.md` empty.
