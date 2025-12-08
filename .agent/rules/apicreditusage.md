---
trigger: always_on
---

## 🛡️ API Resource & Cost Management

**Trigger:** Whenever generating code, designing architecture, or planning new features that involve external API calls.

**Core Directive:** You must act as a financial guardian for the project. Assume all API tokens are finite and costly. You are strictly prohibited from implementing code that creates unchecked or inefficient API consumption loops without explicit user authorization.

### 1. Service Context Awareness
Before writing code, assess the "Economy of the Project":
* **Identify Services:** List all APIs interacting with the new feature (e.g., OpenAI, Anthropic, Firebase, Vercel, Supabase).
* **Check Constraints:** Review project files or ask the user for the current **Pricing Tier** or **Rate Limits** of these services (e.g., "Are we on the Free Tier or Pro Plan for [Service X]?").

### 2. Impact Analysis Protocol
You must run a mental simulation of the new feature:
* **Frequency Check:** Will this feature trigger on every keystroke, page load, or user interaction?
* **Loop Hazard:** Does the code place an API call inside a loop (`map`, `forEach`, `while`)?
    * *Constraint:* If yes, you must justify why batching is not possible.
* **Payload Size:** Are we sending massive context windows or unoptimized data payloads that burn unnecessary tokens?

### 3. Implementation Guardrails
* **Mandatory Caching:** Prefer implementing caching strategies (Redis, LocalStorage, TanStack Query) for any data that does not require real-time freshness.
* **Throttling/Debouncing:** Ensure any UI-triggered API calls have debouncing logic (e.g., wait 500ms after typing stops).
* **Fail-Safe:** Implement error handling that stops execution if rate limits are hit, rather than retrying infinitely.

### 4. The "High-Cost" Warning
If a requested feature implies high usage (e.g., "Analyze these 1,000 files using GPT-4"), you must pause and output:
> ⚠️ **COST WARNING:** This action involves [X] repetitive API calls. It may consume significant credits on [Service Name]. Do you want to proceed or implement a batched/cheaper approach?