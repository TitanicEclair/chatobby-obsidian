# Providers and models

Chatobby supports hosted providers and model servers that you run or obtain
separately. The model picker is the source of truth for the models currently
available to your installation, account, region, and credentials.

When the runtime accepts a signed catalogue update, open model controls and the
Chatobby Settings provider list refresh without reloading Obsidian or installing
another connector. If an update retires the model used by an active turn, that
turn may finish with its captured model identity. Afterward the picker keeps the
retired identity visible as unavailable and requires an explicit replacement.

## Supported provider families

| Provider family                  | Available connections                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAI                           | OpenAI API, Azure OpenAI, and ChatGPT subscription access                                                                     |
| Anthropic                        | Anthropic API                                                                                                                        |
| Google                           | Google Gemini and Google Vertex AI                                                                                                   |
| AWS                              | Amazon Bedrock                                                                                                                       |
| Model hubs and gateways          | OpenRouter, Vercel AI Gateway, Hugging Face, NVIDIA NIM, Fireworks AI, Together AI, Cloudflare Workers AI, and Cloudflare AI Gateway |
| Independent model providers      | DeepSeek, Groq, Cerebras, Mistral, xAI, Z.AI, Xiaomi MiMo, Moonshot AI, MiniMax, and Ant Ling                                        |
| Coding and subscription services | GitHub Copilot, Kimi Coding, Z.AI Coding Plan, Xiaomi Token Plan, OpenCode Zen, and OpenCode Go                                      |
| Local and self-hosted servers    | Ollama, LM Studio, vLLM, llama.cpp, OpenAI-compatible APIs, and Anthropic Messages-compatible APIs                                   |

User-defined compatible providers must implement the streaming, tool-calling,
and model behavior required by their selected API format.

## Use a subscription

Open **Chatobby Settings → Providers** and select **Sign in** beside ChatGPT,
GitHub Copilot, or xAI. ChatGPT offers browser sign-in and a device code; Copilot
and xAI use device authorization. Open the displayed sign-in page, authorize your
account, and keep the Chatobby dialog open until it says connected. For a regular
GitHub account, leave Copilot's enterprise domain blank.

These connections use Chatobby's agent, tools, memory and subagents. They do not
launch the Codex, Claude or another external agent harness. Available models and
usage follow the provider's account access: a subscription does not unlock every
API model. xAI subscription access supports eligible SuperGrok / X Premium
accounts. API-key setup remains available separately where supported.

Closing the dialog cancels unfinished sign-in. A successful connection is stored
by the local runtime and refreshes its tokens when needed. Credentials stay in Chatobby’s protected runtime credential store and are not copied to plugin settings or notes. Reconnecting replaces the selected
provider's credential only after successful authorization and storage.

Anthropic uses an API key; Chatobby does not offer Claude Pro/Max login. Existing
API and token-plan connections, including Xiaomi Singapore, remain available.

## Connect a model server

Start your server in Ollama, LM Studio, vLLM, llama.cpp or another compatible
application. In Chatobby **Settings → Local model connections**, choose
**Connect server**, check **Server**, **Address** and **Authentication**, then
choose **Find models**. Select the models you want, use **Test** on a model and
**Save connection**. Pick the saved connection and model in the composer.

The preset supplies a common address; use the address configured in your server
when it differs. Discovery uses exact exposed model IDs and reads supported
metadata, including configured context for loaded models. Keep **Automatic**
context and **Use server settings** for compatible output limits. Expand a model
only to set a custom limit, display name, reasoning or image input.

If context is not reported, enter the context configured in the server. Do not
use the model's training maximum in place of its loaded configuration.
Messages-compatible servers require a custom output limit.

**Add a model by ID** is available when discovery is not. **Advanced** contains
connection naming, API format and connection kind. Each model has its own
settings; you do not need duplicate connections for different context limits.
Leave a saved token blank to preserve it.

Removing a connection removes its models and Chatobby credential. It does not
stop the external server or delete model files. Use the server application to
start, stop, download or update models.

[Local model setup and troubleshooting](local-model-connections.md)

### Ask Chatobby to connect it

> Connect my running LM Studio server at http://127.0.0.1:1234/v1. Find the models,
> add the one I choose and test it with the server defaults.

With the Obsidian CLI connection and required access, Chatobby can operate the
visible settings form and verify the saved values. See
[Obsidian automation](obsidian-automation.md). A short Test checks one model
response; tool use, images and long context need representative checks.

For model recommendations, state your priorities—quality, speed, privacy, context
or images—and ask it to inspect permitted device facts and compare current options.

## Finding a model

1. Open Chatobby's provider control below the composer.
2. Select a configured provider.
3. Open the model control. Chatobby shows only models available for that
   provider.
4. Choose an effort level when the selected model supports configurable
   reasoning.

The composer follows the active session's provider and model, including changes
made through another view or restored session preferences. Browsing a provider
picker does not change the model until a selection is applied.

## Web research is configured separately

Model-provider credentials do not configure search. Basic public-web search
works without an account. To enable stronger freshness, language, region, and
date filtering, open Chatobby **Settings -> Web research** and connect an
optional Brave Search API key. Chatobby keeps the key in Obsidian's secret
storage and reports the search mode used in every result.

If enhanced search is not connected, basic search is the expected mode; it does
not mean that another provider failed. If a connected enhanced provider fails,
Chatobby may use basic search as a fallback and reports that fact.

## About model availability

- Provider support does not mean every model supports Chatobby's tool use.
- The built-in catalogue may omit deprecated or incompatible models.
- Image input, reasoning controls, context limits, pricing, and provider-side
  availability can change by model.
- API usage and subscription charges are billed by the provider, not Chatobby.

The signed runtime catalogue may add compatible models between connector
releases. New authentication, protocol, SDK, or tool semantics still require
reviewed runtime and connector compatibility work.

For setup help, see the [installation guide](installation.md). For a provider or
model that appears incorrectly, use the
[issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues).
