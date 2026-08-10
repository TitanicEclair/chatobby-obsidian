# Providers and models

Chatobby supports hosted providers and user-configured local model servers. The exact models shown in
Chatobby depend on the installed Chatobby version, the provider, your account,
your region, and the credentials you configure.

The model picker inside Chatobby is the source of truth for the models available
to your installation. Changing provider automatically limits the picker to that
provider's available models.

## Supported provider families

| Provider family | Available connections |
| --- | --- |
| OpenAI | OpenAI API, Azure OpenAI, and OpenAI Codex account-backed access |
| Anthropic | Anthropic API |
| Google | Google Gemini and Google Vertex AI |
| AWS | Amazon Bedrock |
| Model hubs and gateways | OpenRouter, Vercel AI Gateway, Hugging Face, NVIDIA NIM, Fireworks AI, Together AI, Cloudflare Workers AI, and Cloudflare AI Gateway |
| Independent model providers | DeepSeek, Groq, Cerebras, Mistral, xAI, Z.AI, Xiaomi MiMo, Moonshot AI, MiniMax, and Ant Ling |
| Coding and subscription services | GitHub Copilot, Kimi Coding, Z.AI Coding Plan, Xiaomi Token Plan, OpenCode Zen, and OpenCode Go |
| Local and self-hosted servers | Ollama, LM Studio, vLLM, llama.cpp, OpenAI-compatible APIs, and Anthropic Messages-compatible APIs |

Chatobby also supports user-defined OpenAI-compatible providers through its
provider configuration. Compatibility depends on the endpoint implementing the
streaming, tool-calling, and model behavior required by the selected API mode.

## Connecting a local model server

Chatobby connects to a server that you start and manage; it does not install or
run the model server itself. Open Chatobby, select the **Settings** gear, then
use **Local model servers**. Choose the closest preset, confirm the server URL,
add one or more exact model IDs, and select **Test connection** before saving.

- Ollama normally uses `http://127.0.0.1:11434/v1`.
- LM Studio normally uses `http://127.0.0.1:1234/v1`.
- vLLM and llama.cpp commonly expose an OpenAI-compatible `/v1` endpoint.
- A custom endpoint can use Chat Completions, Responses, or Anthropic Messages.
- Choose **Provider API key** for an Anthropic-style `x-api-key`, **Bearer
  token** for an `Authorization: Bearer` credential, or **None** when the local
  server does not require authentication.

Connection testing performs a small real model request, not only a port check.
A successful test proves that the endpoint and configured model can answer the
selected API format; it does not prove that the model supports tools, images,
large contexts, or every Chatobby workflow. Keep externally exposed servers
behind authentication and a trusted network boundary.

### Ask Chatobby to help choose a local model

You can ask Chatobby to recommend a local setup instead of comparing every
model yourself. Describe the work that matters most and whether you prioritize
quality, speed, privacy, long context, image input, or tool use. With your
permission, Chatobby can inspect relevant device capabilities such as the
operating system, memory, and available GPU memory, consult current server and
model documentation, and suggest a small number of realistic options with
tradeoffs.

Chatobby does not silently install or start the model server. Follow the chosen
server's official installation instructions, start it, then let Chatobby guide
you through **Settings -> Local model servers**, the endpoint test, and model
selection. Hardware estimates remain estimates until the model is loaded and
tested on your device.

Example:

> Recommend a local model for coding and Obsidian work on this computer. Check
> the device capabilities you are permitted to inspect, compare two suitable
> options, and link the current official setup guide. Do not install anything.

## Finding a model

1. Open Chatobby's provider control below the composer.
2. Select a configured provider.
3. Open the model control. Chatobby shows only models available for that
   provider in your installed version.
4. Choose an effort level when the selected model supports configurable
   reasoning.

## Web research is configured separately

Model-provider credentials do not configure search. Basic public-web search
works without an account. To enable stronger freshness, language, region, and
date filtering, open Chatobby **Settings -> Web research** and connect an
optional Brave Search API key. Chatobby keeps the key in Obsidian's secret
storage and reports the search mode used in every result.

If enhanced search is not connected, basic search is the expected mode; it
does not mean that another provider failed. If a connected enhanced provider
does fail, Chatobby may use basic search as a fallback and reports that fact.

If a model is absent, first update Chatobby and refresh the provider catalogue.
The model may also be unavailable for your account, provider region, or current
provider plan.

## About model availability

- A provider being supported does not mean every model offered by that provider
  supports Chatobby's tool use.
- Chatobby's built-in catalogue favors models with the capabilities required for
  agent work and may omit deprecated or incompatible models.
- Image input, reasoning controls, context limits, and pricing vary by model.
- Provider-side model names and availability can change independently of a
  Chatobby release.
- API usage and subscription charges are billed by the provider, not Chatobby.

This page is maintained with the public plugin documentation. When provider or
model support changes, update this page in the same release as the runtime
catalogue.

For setup help, see the [installation guide](installation.md). For a provider or
model that appears incorrectly, use the
[issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues).
