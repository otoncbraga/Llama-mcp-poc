COMPOSE = docker compose -f docker-compose.yml

up:
	$(COMPOSE) up -d --build

prompt:
	$(COMPOSE) run --rm ai-agent --serve

client:
	$(COMPOSE) run --rm client
