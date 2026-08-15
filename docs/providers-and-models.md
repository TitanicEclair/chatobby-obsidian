# Providers and models

Chatobby supports hosted providers and user-configured local model servers. The exact models shown in
Chatobby depend on the installed Chatobby version, the provider, your account,
your region, and the credentials you configure.

The model picker inside Chatobby is the source of truth for the models available
to your installation. Changing provider automatically limits the picker to that
provider's available models.

## Supported provider families

| Provider family                  | Available connections                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAI                           | OpenAI API, Azure OpenAI, and OpenAI Codex account-backed access                                                                     |
| Anthropic                        | Anthropic API                                                                                                                        |
| Google                           | Google Gemini and Google Vertex AI                                                                                                   |
| AWS                              | Amazon Bedrock                                                                                                                       |
| Model hubs and gateways          | OpenRouter, Vercel AI Gateway, Hugging Face, NVIDIA NIM, Fireworks AI, Together AI, Cloudflare Workers AI, and Cloudflare AI Gateway |
| Independent model providers      | DeepSeek, Groq, Cerebras, Mistral, xAI, Z.AI, Xiaomi MiMo, Moonshot AI, MiniMax, and Ant Ling                                        |
| Coding and subscription services | GitHub Copilot, Kimi Coding, Z.AI Coding Plan, Xiaomi Token Plan, OpenCode Zen, and OpenCode Go                                      |
| Local and self-hosted servers    | Ollama, LM Studio, vLLM, llama.cpp, OpenAI-compatible APIs, and Anthropic Messages-compatible APIs                                   |

Chatobby also supports user-defined OpenAI-compatible providers through its
provider configuration. Compatibility depends on the endpoint implementing the
streaming, tool-calling, and model behavior required by the selected API mode.

## Connecting a local model server

Chatobby can connect to a server that you manage yourself. For llama.cpp on the
same computer, it can also own the validated process lifecycle. Open Chatobby,
select the **Settings** gear, then use **Local model connections**. Choose the
closest preset, confirm the server URL and
API format, add one or more exact model IDs, and select **Test connection**
before saving. Model lines use either `model-id` or
`model-id | Friendly name`; for example, `qwen3.5:4b | Qwen 3.5 4B`.

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

### Understand the two local-model records

Chatobby deliberately separates the API connection from process management.
This keeps ordinary local and remote-compatible servers usable without giving
Chatobby responsibility for installing or supervising them.

| Record | Contains | Effect |
| --- | --- | --- |
| Local model connection | Stable provider ID, display name, API format, URL, authentication mode, exact model IDs, context/output limits, and capability declarations | Adds the provider and models to Chatobby's model catalogue and composer. |
| Managed llama.cpp profile | Linked provider ID, executable and GGUF paths, launch policy, context size, GPU layers, cache types, flash attention, optional CPU/batch settings, and startup timeout | Lets Chatobby start and supervise the corresponding llama.cpp process. It does not itself add a model to the composer. |

A managed profile is therefore optional, but its connection is not optional if
you want a chat to use the server. The profile and connection are joined by the
stable provider ID and must use the same loopback port.

### Connection fields

- **Server type** supplies a starting API format and common URL. It does not
  restrict you to that default.
- **Name** is the human-readable server name.
- **Provider ID** is the stable identity used by sessions and managed profiles.
  Treat changing it as creating a different provider.
- **Server URL** is the API base. Most OpenAI-compatible servers use a `/v1`
  base; use the exact URL documented by your server.
- **API format** chooses OpenAI Chat Completions, OpenAI Responses, or Anthropic
  Messages independently of the model family.
- **Authentication** controls whether Chatobby sends no credential, a provider
  API key, or a bearer token.
- **Models** contains one exact server model ID per line. Use `model-id` or
  `model-id | Friendly name`.
- **Context window** is the maximum input Chatobby may prepare for the model. It
  must not exceed what the running server actually allocated.
- **Maximum output tokens**, **Reasoning model**, and **Accepts images** describe
  what the exact endpoint and model can handle. Do not enable a capability only
  because another model from the same family supports it.

If several model IDs share the same server and defaults, list them in one
connection. Create separate connections when they need different API formats,
URLs, authentication, context limits, or capability declarations.

### Let Chatobby run llama.cpp

After adding a loopback llama.cpp connection, use **Managed llama.cpp** to link
an existing `llama-server` executable and GGUF model. Chatobby accepts typed
llama.cpp settings rather than an arbitrary command: launch behavior, context
window, GPU layers, K/V cache types, flash attention, optional CPU and batch
settings, and startup timeout.

Managed startup is currently llama.cpp-specific; it is not required for local
model support. Ollama, LM Studio, vLLM, and custom-compatible servers use the
connection form and keep managing their own processes. A quantized llama.cpp V
cache requires flash attention, so the Settings form enables it automatically
and the runtime rejects an invalid combination before launch.

- **On demand** starts the server before a chat first uses that provider.
- **When Chatobby starts** starts it with the vault runtime.
- **Manual** starts it only from the Settings page.

The managed fields describe the process Chatobby will actually launch:

- **llama.cpp executable** and **GGUF model** are absolute paths to files that
  already exist. Chatobby does not download or delete them.
- **Context window** becomes llama.cpp's allocated context. Larger contexts can
  consume substantial system and GPU memory even with a small model.
- **GPU layers** controls how much model work is offloaded. The usable value
  depends on the model, quantization, available VRAM, and other applications.
- **K/V cache types** trade memory use against quality and compatibility.
  Quantized V cache requires flash attention.
- **Threads**, **batch size**, **micro-batch size**, and **parallel requests**
  are optional tuning controls. Leave them at validated defaults unless you
  have a measured reason to change them.
- **Startup timeout** bounds readiness checking; it is not the response timeout
  for later model calls.

The process binds to `127.0.0.1`. Windows, macOS, and Linux use their native
process-group lifecycle, and a second Chatobby runtime observes rather than
relaunches the same owned profile. Removing a profile stops a process Chatobby
owns but never deletes llama.cpp or the GGUF file. Other local-server presets
remain externally managed.

### Stop, remove, or reconnect

Use **Stop** when you want to release the process's RAM and VRAM while keeping
the connection and launch profile ready for later use.

Removing a row under **Local model connections** removes that provider's models
from the composer and removes its stored credential. It does not stop the
server or delete a managed profile linked to that provider ID. A remaining
managed profile may continue running, start with the runtime, or be started
manually, but Chatobby chats cannot select or use it until the connection is
restored. Recreate the connection with the same provider ID and matching port
to reattach it.

Removing a row under **Managed llama.cpp** stops a process owned by the current
runtime and removes the launch profile. It leaves the local model connection,
llama.cpp files, and GGUF file untouched. The connection remains usable if you
start a compatible server at that endpoint yourself.

Recommended cleanup order when removing the whole setup:

1. Stop the managed process.
2. Remove the managed profile.
3. Remove the local model connection.
4. Delete llama.cpp or model files yourself only if you separately decide that
   you no longer need them.

### Common setup paths

#### Connect an already-running server

1. Start Ollama, LM Studio, vLLM, llama.cpp, or your compatible server normally.
2. Add a local model connection using the closest preset.
3. Confirm the URL, API format, authentication, and exact model ID.
4. Set only capabilities the endpoint actually supports.
5. Select **Test connection**, save, then choose the provider and model below
   the composer.

#### Let Chatobby run llama.cpp

1. Obtain a compatible `llama-server` executable and GGUF model from their
   official sources.
2. Add and test a loopback llama.cpp connection.
3. Add a managed llama.cpp profile and link that connection.
4. Choose a launch policy and conservative initial context/GPU/cache settings.
5. Start the profile and confirm it reports Ready.
6. Test the connection again, then select its model in a chat.

If startup succeeds but the connection test fails, compare the connection's
provider ID, port, API format, and model ID with the managed profile and
llama.cpp output. If startup itself fails, check the executable/model paths,
available memory, flash/cache combination, and bounded diagnostic output before
retrying unchanged settings.

### Ask Chatobby to help choose a local model

You can ask Chatobby to recommend a local setup instead of comparing every
model yourself. Describe the work that matters most and whether you prioritize
quality, speed, privacy, long context, image input, or tool use. With your
permission, Chatobby can inspect relevant device capabilities such as the
operating system, memory, and available GPU memory, consult current server and
model documentation, and suggest a small number of realistic options with
tradeoffs.

Chatobby does not silently install a model server or model file. Follow the
chosen server's official installation instructions. You can start an external
server yourself, or configure the managed llama.cpp lifecycle described above,
then use the endpoint test and model selector. Hardware estimates remain
estimates until the model is loaded and tested on your device.

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
