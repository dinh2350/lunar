# ============================================
# Lunar — Development Commands
# ============================================

.PHONY: dev prod stop logs shell build test eval clean

# ---- Development ----

dev:  ## Start development environment
	docker compose -f docker-compose.dev.yml up -d
	@echo "🌙 Dev environment ready!"
	@echo "  Gateway: http://localhost:3100"
	@echo "  Eval:    http://localhost:8000"
	@echo "  Ollama:  http://localhost:11434"
	@echo "  Debug:   chrome://inspect (port 9229)"

dev-logs:  ## Follow development logs
	docker compose -f docker-compose.dev.yml logs -f

dev-stop:  ## Stop development environment
	docker compose -f docker-compose.dev.yml down

# ---- Production ----

prod:  ## Start production environment
	docker compose -f docker-compose.prod.yml up -d

prod-stop:  ## Stop production environment
	docker compose -f docker-compose.prod.yml down

# ---- Build ----

build:  ## Build production image
	docker build -t lunar:latest .
	@docker images lunar:latest --format "Size: {{.Size}}"

# ---- Testing ----

test:  ## Run unit tests
	pnpm test

eval:  ## Run AI evaluation suite
	./scripts/eval.sh

golden-gate:  ## Run golden gate (critical tests only)
	cd services/eval && python golden_gate.py

eval-full:  ## Full eval (all tests + regression + metrics)
	cd services/eval && python runner.py --all
	cd services/eval && python regression.py

deploy: golden-gate  ## Deploy only if golden gate passes
	@echo "Golden gate passed! Deploying..."
	docker compose -f docker-compose.prod.yml up -d --build

# ---- Utilities ----

logs:  ## Follow all logs
	docker compose logs -f

shell-gateway:  ## Shell into gateway container
	docker compose exec gateway /bin/sh

shell-ollama:  ## Shell into ollama container
	docker compose exec ollama /bin/sh

health:  ## Check all service health
	@echo "Gateway:" && curl -s http://localhost:3100/api/health | jq .
	@echo "Eval:" && curl -s http://localhost:8000/health | jq .
	@echo "Ollama:" && curl -s http://localhost:11434/api/version | jq .

# ---- Cleanup ----

clean:  ## Remove containers and images
	docker compose down --rmi local
	docker system prune -f

clean-all:  ## Remove everything including volumes (⚠️ DATA LOSS!)
	docker compose down -v --rmi local
	docker system prune -af

# ---- Help ----

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
