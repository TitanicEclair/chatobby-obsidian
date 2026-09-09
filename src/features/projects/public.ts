/** Full-screen controller used by the Chatobby view to manage Projects and their sessions. */
export { ProjectsScreenController, type ProjectsScreenControllerOptions } from "./application/projects-screen-controller";
/** Native sidebar for global pages, Projects and saved conversations. */
export { ProjectNavigatorView, VIEW_TYPE_CHATOBBY_NAVIGATOR } from "./ui/project-navigator-view";

/** Native folder-launch decisions used by Obsidian's file explorer integration. */
export {
	requestDirectoryProjectDecision,
	requestDirectoryProjectDraft,
} from "./ui/project-directory-session-modal";
/** Folder-launch decision and Project-draft values returned by native modals. */
export type { DirectoryProjectDecision, DirectoryProjectDraft } from "./ui/project-directory-session-modal";

/** Project directory observation lifecycle and bounded transport constants. */
export {
  PROJECT_DIRECTORY_OBSERVATION_MAX_ATTEMPTS,
  PROJECT_DIRECTORY_OBSERVATION_QUEUE_LIMIT,
  PROJECT_DIRECTORY_OBSERVATION_RESULT_TIMEOUT_MS,
  PROJECT_DIRECTORY_OBSERVATION_RETRY_DELAY_MS,
  ProjectDirectoryObservationService,
} from "./application/project-directory-observation-service";

/** Project directory observation transport and service configuration contracts. */
export type {
	ProjectDirectoryObservationServiceOptions,
	ProjectDirectoryObservationTransport,
} from "./application/project-directory-observation-service";
