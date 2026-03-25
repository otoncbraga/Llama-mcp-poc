# 🚀 LLM + MCP na prática: executando ações reais a partir de linguagem natural

Esta é uma POC que demonstra como transformar mensagens em linguagem natural em **operações reais no sistema**, usando:

- 🧠 Llama (via Ollama, rodando local)
- 🔌 Model Context Protocol (MCP)
- ⚙️ Node.js + TypeScript
- 🗄️ MongoDB
- 🐳 Docker

---

## 💡 Problema

Muitos sistemas operacionais dependem de mensagens como:

> "nova reserva para o chalé amarelo de 22 a 24"

Tradicionalmente, isso vira:

- regras rígidas
- parsing manual
- fluxos engessados

E quebra facilmente quando o texto varia.

---

## 🎯 Solução

Esta POC implementa o seguinte fluxo:

```

Texto → LLM → JSON estruturado → MCP Tool → Backend → Banco

```

O modelo interpreta a mensagem, mas:

👉 **não executa regras de negócio**

Isso fica totalmente no backend.

---

## 🧪 Exemplo

### Entrada

```

nova reserva para o chalé amarelo, de 22 a 24 de janeiro (18h) - Janaína

````

### Saída estruturada

```json
{
  "chaletId": "chale-amarelo",
  "checkIn": "2026-01-22",
  "checkOut": "2026-01-24",
  "guestName": "Janaína",
  "arrivalTime": "18:00"
}
````

### Resultado

```
✅ Reserva criada
Chalé: Amarelo
Período: 22/01 → 24/01
Hóspede: Janaína
```

---

## 🏗️ Arquitetura

```
Usuário
  ↓
LLM (Llama)
  ↓
MCP (Tool)
  ↓
Backend
  ↓
MongoDB
```

---

## 🔌 Tool implementada

```
reservations.create
```

Responsável por:

* validar dados
* verificar conflitos
* persistir reserva

---

## ⚠️ Regra de conflito

```
checkIn < existingCheckOut
AND
checkOut > existingCheckIn
```

---

## 🐳 Como rodar

### 1. Subir ambiente

```bash
docker compose up -d --build
```

---

### 2. Teste direto da tool

```bash
docker compose run --rm client
```

---

### 3. Teste com linguagem natural (LLM)

```bash
docker compose run --rm ai-agent \
"nova reserva para o chalé amarelo, de 22 a 24 de janeiro (18h) - Janaína"
```

---

### 4. Teste de conflito

```bash
docker compose run --rm ai-agent \
"nova reserva chalé amarelo 22/01 a 24/01 - Janaína"
```

---

## 📦 Estrutura do projeto

```
poc/
 ├─ mcp-server/    → tools MCP
 ├─ ai-agent/      → integração com Llama
 ├─ client/        → teste direto MCP
 ├─ mongo/         → banco
 └─ docker-compose.yml
```

---

## 🧠 Stack

* Node.js + TypeScript
* MongoDB
* MCP SDK
* Ollama
* Llama 3.2 (modelo leve)
* Docker

---

## 🎯 O que essa POC demonstra

* uso de LLM como interface para sistemas
* execução segura via tools
* separação entre interpretação e regra de negócio
* redução de complexidade em parsing manual

---

## 🚀 Próximos passos

* cancelamento de reservas
* estado conversacional (perguntas automáticas)
* integração com WhatsApp
* interface web (calendário)
* logs e auditoria

---

## 💭 Insight

LLMs não são sistemas.

Mas podem ser a melhor interface para interagir com eles.

