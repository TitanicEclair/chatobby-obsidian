# Local model connections

In Chatobby Settings, choose **Connect server**, select your server and check its
address. Add a token if needed, then choose **Find models**. Select the models you
want and save. Use **Test** on a model to check its response.

Chatobby reads the configured context from supported servers. **Automatic** uses
that value; **Use server settings** leaves the response limit to compatible servers.
Expand a model's settings for custom limits, display name, reasoning or image input.
If context is not reported, enter the context length configured in your server.
Messages-compatible servers require an output limit.

**Add a model by ID** works when discovery is unavailable. **Advanced** contains
connection naming, API format and connection kind. Editing preserves each model's
settings; leaving the token blank keeps the saved credential. Servers remain
managed by their existing application.

## Common server addresses

| Server | Default address |
| --- | --- |
| Ollama | `http://127.0.0.1:11434/v1` |
| LM Studio | `http://127.0.0.1:1234/v1` |
| vLLM | `http://127.0.0.1:8000/v1` |
| llama.cpp | `http://127.0.0.1:8080/v1` |

Use your configured address if you changed the listener, port or proxy prefix.
Discovery does not load a model. A listed model may still need loading in its
server application before it can answer.

## When a connection fails

| Result | Check |
| --- | --- |
| Connection refused or timed out | Server running, listener address and port |
| HTTP 401 or 403 | Authentication mode and credential |
| HTTP 404 | Server preset, API format and address path |
| No models found | Models available through that server's API; try its exact ID if needed |
| Context not reported | The context configured in the server; enter it under the model |
| Test fails after discovery | Model loaded, exact ID, API compatibility and server's error |

Keep the draft open while correcting an error. Saving is separate from testing;
after saving, select the model in a chat and check the capabilities you need.

[Ask Chatobby to perform setup](obsidian-automation.md#local-model-setup) ·
[Hosted providers and subscriptions](providers-and-models.md)
