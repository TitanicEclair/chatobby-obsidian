import { setIcon, type App } from "obsidian";
import type { FrontendMcpServerDraft, FrontendMcpServerViewModel } from "../../../../vendor/chatobby-client/frontend-contracts.js";
import { createPageActionRow, createPageSection } from "../../../../ui/shared/page-shell";
import { action, connectionChoice, inputField, selectField, textAreaField } from "../controls/form-fields";
import { secretReferenceField } from "../controls/secret-reference";
import { validateConnectionDraft, type ConnectionFields } from "./connection-draft";

interface ConnectionEditorOptions {
  readonly app: App;
  readonly seed: FrontendMcpServerViewModel | null;
  readonly onBrowseVerified: () => void;
  readonly onCancel: () => void;
  readonly onPreview: (draft: FrontendMcpServerDraft) => void;
  readonly onSave: (draft: FrontendMcpServerDraft) => void;
}

export interface ConnectionEditorPresentation {
  focusedField(): string | undefined;
  /** Recompute derived classes after PageShell restores control values. */
  refreshPresentation(focusKey?: string): void;
}

/** DOM owns transient values; runtime-owned configuration changes only through callbacks. */
export function renderConnectionEditor(parent: HTMLElement, options: ConnectionEditorOptions): ConnectionEditorPresentation {
  const { seed } = options;
  const section = createPageSection(parent, {
    title: seed ? "Review and add connection" : "Add a connection",
    description: seed
      ? "This project suggested a connection. Review its address or command before saving a separate disabled copy in your Chatobby settings."
      : "Connections give Chatobby new tools from services or programs you choose. Nothing is enabled until you review it.",
    surface: "inset",
  });
  const form = section.content.createDiv({ cls: "chatobby-mcp__editor" });
  const introduction = form.createDiv({ cls: "chatobby-mcp__editor-intro" });
  const introductionIcon = introduction.createSpan({
    cls: "chatobby-mcp__editor-intro-icon",
    attr: { "aria-hidden": "true" },
  });
  setIcon(introductionIcon, "plug-zap");
  const introductionCopy = introduction.createDiv();
  introductionCopy.createDiv({
    cls: "chatobby-mcp__editor-intro-title",
    text: seed ? "Project suggestion" : "What would you like to connect?",
  });
  introductionCopy.createDiv({
    cls: "chatobby-mcp__editor-intro-copy",
    text: seed
      ? "The project file remains unchanged and cannot enable this connection or its tools."
      : "Choose a connection type below. If a service is already in Verified, use that guided setup instead.",
  });
  const browse = introduction.createEl("button", {
    text: "Browse Verified",
    attr: { type: "button" },
  });
  browse.addEventListener(
    "click",
    options.onBrowseVerified,
  );

  const transport = selectField(
    form,
    "Connection type",
    "mcp:new:transport",
    [
      ["remote", "Online service"],
      ["local", "Program on this computer"],
    ],
  );
  transport
    .closest<HTMLElement>(".chatobby-mcp__field")
    ?.addClass("chatobby-visually-hidden");
  const choices = form.createDiv({
    cls: "chatobby-mcp__connection-choices",
    attr: { role: "group", "aria-label": "Connection type" },
  });
  const remoteChoice = connectionChoice(
    choices,
    "cloud",
    "Online service",
    "Use a server address supplied by an app or service.",
    () => selectTransport("remote"),
  );
  const localChoice = connectionChoice(
    choices,
    "terminal-square",
    "Program on this computer",
    "Run a trusted command already installed on this device.",
    () => selectTransport("local"),
  );

  const basics = form.createDiv({ cls: "chatobby-mcp__editor-section" });
  basics.createDiv({
    cls: "chatobby-mcp__editor-section-title",
    text: "Connection details",
  });
  const name = inputField(
    basics,
    "Connection name",
    "mcp:new:name",
    "For example: GitHub or My calendar",
    "A short name you will recognize later.",
  );
  basics.createDiv({
    cls: "chatobby-mcp__save-note",
    text: "Saved in your Chatobby settings. Repository files and project instructions cannot register, enable, or change agent tool access.",
  });

  const remoteFields = form.createDiv({
    cls: "chatobby-mcp__editor-section chatobby-mcp__remote-fields",
  });
  remoteFields.createDiv({
    cls: "chatobby-mcp__editor-section-title",
    text: "Online service",
  });
  const url = inputField(
    remoteFields,
    "Server address",
    "mcp:new:url",
    "https://example.com/mcp",
    "Paste the MCP address supplied by the service.",
  );
  const authentication = selectField(
    remoteFields,
    "How do you sign in?",
    "mcp:new:auth",
    [
      ["oauth", "Browser sign-in"],
      ["bearer", "Token stored by Obsidian"],
      ["none", "No sign-in"],
    ],
    "Choose the method documented by the service. Chatobby never stores the token value in its settings.",
  );
  const bearerField = secretReferenceField(
    options.app,
    remoteFields,
    "Saved access token",
    "mcp:new:credential",
    "",
  );

  const localFields = form.createDiv({
    cls: "chatobby-mcp__editor-section chatobby-mcp__local-fields",
  });
  localFields.createDiv({
    cls: "chatobby-mcp__editor-section-title",
    text: "Program on this computer",
  });
  const command = inputField(
    localFields,
    "Program or command",
    "mcp:new:command",
    "For example: npx",
    "Use the command from the server's installation instructions.",
  );
  const argumentsInput = textAreaField(
    localFields,
    "Arguments",
    "mcp:new:arguments",
    "Put each argument on its own line.",
  );
  const workingDirectory = inputField(
    localFields,
    "Working folder",
    "mcp:new:cwd",
    "Optional",
    "Leave blank unless the server requires a particular folder.",
  );

  const advanced = form.createEl("details", {
    cls: "chatobby-mcp__advanced",
  });
  advanced.createEl("summary", { text: "Advanced options" });
  const advancedBody = advanced.createDiv({
    cls: "chatobby-mcp__advanced-body",
  });
  const lifecycle = selectField(
    advancedBody,
    "When should Chatobby start it?",
    "mcp:new:lifecycle",
    [
      ["lazy", "Only when one of its tools is used"],
      ["keep-alive", "Keep it available after first use"],
      ["eager", "When Chatobby starts"],
    ],
  );
  const environment = textAreaField(
    advancedBody,
    "Environment variables",
    "mcp:new:environment",
    "Use NAME=ENV_VARIABLE, one per line. Values come from the existing environment.",
  );
  const headers = textAreaField(
    advancedBody,
    "Request headers",
    "mcp:new:headers",
    "Use HEADER=ENV_VARIABLE, one per line. Values come from the existing environment.",
  );
  const refreshTransport = (): void => {
    const remote = transport.value === "remote";
    remoteFields.toggleClass("is-hidden", !remote);
    localFields.toggleClass("is-hidden", remote);
    bearerField.wrapper.toggleClass(
      "is-hidden",
      !remote || authentication.value !== "bearer",
    );
    headers
      .closest<HTMLElement>(".chatobby-mcp__field")
      ?.toggleClass("is-hidden", !remote);
    environment
      .closest<HTMLElement>(".chatobby-mcp__field")
      ?.toggleClass("is-hidden", remote);
    remoteChoice.setAttr("aria-pressed", String(remote));
    localChoice.setAttr("aria-pressed", String(!remote));
    remoteChoice.toggleClass("is-selected", remote);
    localChoice.toggleClass("is-selected", !remote);
  };
  const selectTransport = (value: "remote" | "local"): void => {
    transport.value = value;
    refreshTransport();
  };
  transport.addEventListener("change", refreshTransport);
  authentication.addEventListener("change", refreshTransport);
  if (seed) {
    name.value = seed.id;
    transport.value = seed.transport;
    command.value = seed.command ?? "";
    argumentsInput.value = seed.arguments.join("\n");
    workingDirectory.value = seed.workingDirectory ?? "";
    url.value = seed.url ?? "";
    authentication.value = seed.authentication;
    lifecycle.value = "lazy";
  }
  refreshTransport();
  form.createDiv({
    cls: "chatobby-mcp__save-note",
    text: "Saving creates a disabled connection with no exposed tools. Check details validates this form only; it does not contact or start the server. Test and select tools after saving.",
  });
  const validation = form.createDiv({
    cls: "chatobby-mcp__form-validation is-hidden",
    attr: { role: "alert", "aria-live": "polite" },
  });
  const controls = { name, transport, command, arguments: argumentsInput,
    workingDirectory, url, authentication, credential: bearerField.select,
    lifecycle, environment, headers };
  const validateDraft = (): FrontendMcpServerDraft | null => {
    for (const control of Object.values(controls)) control.removeAttribute("aria-invalid");
    const values: ConnectionFields = {
      name: name.value, transport: transport.value, command: command.value,
      arguments: argumentsInput.value, workingDirectory: workingDirectory.value,
      url: url.value, authentication: authentication.value,
      credential: bearerField.select.value, lifecycle: lifecycle.value,
      environment: environment.value, headers: headers.value,
    };
    const result = validateConnectionDraft(values);
    for (const error of result.errors) controls[error.field].setAttribute("aria-invalid", "true");
    validation.textContent = result.errors.map((error) => error.message).join(" ");
    validation.toggleClass("is-hidden", result.errors.length === 0);
    const first = result.errors[0];
    if (first) controls[first.field].focus();
    return result.draft;
  };
  const actions = createPageActionRow(form);
  action(actions, "Cancel", options.onCancel);
  const preview = actions.createEl("button", {
    text: "Check details",
    attr: { type: "button" },
  });
  preview.addEventListener(
    "click",
    () => {
      const draft = validateDraft();
      if (!draft) return;
      options.onPreview(draft);
    },
  );
  const save = actions.createEl("button", {
    cls: "mod-cta",
    text: "Save connection",
    attr: { type: "button" },
  });
  save.addEventListener(
    "click",
    () => {
      const draft = validateDraft();
      if (!draft) return;
      options.onSave(draft);
    },
  );

  return {
    focusedField: () => Object.values(controls)
      .find((control) => control.ownerDocument.activeElement === control)?.dataset.pageStateKey,
    refreshPresentation: (focusKey) => {
      refreshTransport();
      // Native focus can fail while a restored local/token field is still hidden.
      // PageShell already restored selection. Retry that field only after showing it,
      // and never take focus back from an overlay or a different control.
      const target = Object.values(controls).find((control) => control.dataset.pageStateKey === focusKey);
      const active = form.ownerDocument.activeElement;
      if (target && form.isConnected && (active === target || active === form.ownerDocument.body))
        target.focus({ preventScroll: true });
    },
  };
}
