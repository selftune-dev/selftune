.PHONY: lint test check sandbox sandbox-llm sandbox-shell

lint:
	bunx biome check .
	bun run lint-architecture.ts

test:
	@# Run evolve.test.ts separately: its mock.module() pollutes the global module registry
	bun test $$(find tests -name '*.test.ts' ! -name 'evolve.test.ts')
	bun test tests/evolution/evolve.test.ts

sandbox:
	bun run tests/sandbox/run-sandbox.ts

sandbox-llm:
	docker compose -f tests/sandbox/docker/docker-compose.yml up --build

sandbox-shell:
	docker compose -f tests/sandbox/docker/docker-compose.yml run --build --entrypoint bash selftune-sandbox

check: lint test sandbox
