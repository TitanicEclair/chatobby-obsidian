import type {
  FrontendChoiceOption,
  FrontendIntent,
  FrontendMemoryCategoryFilter,
  FrontendMemoryCollectionFilter,
  FrontendMemoryScreenViewModel,
  FrontendMemorySort,
  FrontendMemoryStatusFilter,
} from "../../vendor/chatobby-client/frontend-contracts.js";

export type MemorySetViewPayload = Extract<FrontendIntent, { readonly type: "memory.set-view" }>["payload"];

export function memoryViewPayload(
  model: FrontendMemoryScreenViewModel,
  overrides: Partial<MemorySetViewPayload>,
): MemorySetViewPayload {
  return {
    browseProjectId: model.browseProjectId,
    scopeFilter: "available",
    collection: model.collection,
    status: model.status,
    query: model.query,
    lessonCategory: model.lessonCategory,
    sort: model.sort,
    ...overrides,
  };
}

export function renderMemoryFilterControls(
  toolbar: HTMLElement,
  model: FrontendMemoryScreenViewModel,
  busy: boolean,
  onChange: (overrides: Partial<MemorySetViewPayload>) => void,
): void {
  createSelect(toolbar, "Memory type", model.collection, model.collectionOptions, busy, "chatobby-memory__collection-select", (value) => {
    if (isCollection(value)) onChange({ collection: value });
  });
  createSelect(toolbar, "Memory status", model.status, model.statusOptions, busy, "chatobby-memory__status-select", (value) => {
    if (isStatus(value)) onChange({ status: value });
  });
  if (model.collection === "lessons") {
    createSelect(toolbar, "Lesson type", model.lessonCategory, model.lessonCategoryOptions, busy, "chatobby-memory__lesson-select", (value) => {
      if (isCategory(value)) onChange({ lessonCategory: value });
    });
  }
  createSelect(toolbar, "Sort memories", model.sort, model.sortOptions, busy, "chatobby-memory__sort-select", (value) => {
    if (isSort(value)) onChange({ sort: value });
  });
}

function createSelect(
  parent: HTMLElement,
  label: string,
  value: string,
  options: readonly FrontendChoiceOption[],
  disabled: boolean,
  className: string,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const select = parent.createEl("select", { cls: `chatobby-memory__view-select ${className}`, attr: { "aria-label": label } });
  for (const option of options) {
    const element = select.createEl("option", { value: option.value, text: option.label });
    element.disabled = Boolean(option.disabledReason);
  }
  select.value = value;
  select.disabled = disabled;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function isCategory(value: string): value is FrontendMemoryCategoryFilter {
  return ["all", "uncategorized", "failure", "correction", "insight", "preference", "convention", "tool-quirk"].includes(value);
}

function isCollection(value: string): value is FrontendMemoryCollectionFilter {
  return ["all", "profile", "knowledge", "lessons"].includes(value);
}

function isStatus(value: string): value is FrontendMemoryStatusFilter {
  return ["active", "archived", "all"].includes(value);
}

function isSort(value: string): value is FrontendMemorySort {
  return ["updated-desc", "last-used-desc", "created-desc", "created-asc"].includes(value);
}
