# Makefile
.PHONY: dev test protocol-gen demo install fmt

install:
	pnpm install
	uv sync

protocol-gen:
	pnpm --filter @meshshield/protocol gen

dev: protocol-gen
	pnpm exec concurrently -n fusion,agent,console -c blue,green,magenta \
	  "uv run --directory apps/fusion uvicorn fusion.main:app --port 8001 --reload" \
	  "uv run --directory apps/agent  uvicorn agent.main:app  --port 8002 --reload" \
	  "pnpm --filter @meshshield/console dev"

demo: protocol-gen
	SCENARIO=data-center-swarm-attack pnpm exec concurrently -n fusion,agent,console -c blue,green,magenta \
	  "uv run --directory apps/fusion uvicorn fusion.main:app --port 8001" \
	  "uv run --directory apps/agent  uvicorn agent.main:app  --port 8002" \
	  "pnpm --filter @meshshield/console dev"

test:
	uv run pytest -q
	pnpm -r test

fmt:
	uv run ruff format .
	pnpm -r exec prettier --write .
