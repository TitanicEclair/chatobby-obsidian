# Providers and models

Chatobby supports multiple hosted model providers. The exact models shown in
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

Chatobby also supports user-defined OpenAI-compatible providers through its
provider configuration. Compatibility depends on the endpoint implementing the
streaming, tool-calling, and model behavior required by the selected API mode.

## Finding a model

1. Open Chatobby's provider control below the composer.
2. Select a configured provider.
3. Open the model control. Chatobby shows only models available for that
   provider in your installed version.
4. Choose an effort level when the selected model supports configurable
   reasoning.

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
