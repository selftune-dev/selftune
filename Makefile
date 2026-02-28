.PHONY: lint test check

lint:
	bunx biome check .
	bun run lint-architecture.ts

test:
	bun test

check: lint test
