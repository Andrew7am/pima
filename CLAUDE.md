# Claude Project Instructions

## Project Index

This repository includes a Graphify knowledge graph.

Always use `graph.json` as the primary project index before reading source code.

## Repository Navigation

- Read `graph.json` first.
- Identify only the files related to the current task.
- Read the minimum number of files required.
- Do not scan the entire repository unless explicitly requested.

## Development Rules

- Reuse existing components whenever possible.
- Keep changes localized.
- Preserve project architecture.
- Avoid unnecessary refactoring.
- Do not modify unrelated files.

## Performance

Minimize token usage.

Priority:

1. graph.json
2. Directly related files
3. Neighboring dependencies
4. Repository-wide scan (only if absolutely necessary)

If graph.json appears outdated, ask permission before rebuilding it.