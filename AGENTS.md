# AGENTS.md

## Repository role

`PartyBeam.UI.Playground` is the experimental UI/UX playground for PartyBeam.

Use this repository to prototype, test, compare, and refine visual design, interaction patterns, focus behavior, layouts, responsive behavior, and other UI ideas before they are adopted by production PartyBeam applications. Experimental changes are expected here, provided the repository remains runnable and validated.

## Working and merge policy

Work through focused branches and pull requests rather than treating `main` as a scratch branch.

A pull request may be merged **without asking the user for an additional merge confirmation** when all of the following are true:

1. The PR contains the complete intended package of commits for the current task.
2. The implementation is not knowingly incomplete and there are no unresolved blockers for that task.
3. Required CI / GitHub Actions checks for the PR's current HEAD have completed successfully.
4. The PR is mergeable and has no known unresolved review finding that should block the merge.

When these conditions are met, finish the task by merging the PR instead of stopping to ask whether it should be merged.

Do not merge automatically when CI is pending or failing, the PR is still partial/draft work, a blocking problem is known, or the user explicitly asked to review before merge.
