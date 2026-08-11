import { describe, expect, it, vi } from "vitest";
import { ProjectCreationDraftStore } from "../../src/features/projects/application/project-creation-draft";

describe("ProjectCreationDraftStore", () => {
	it("retains accumulated folders across reads and keeps one explicit primary root", () => {
		vi.stubGlobal("crypto", { randomUUID: () => "draft-1" });
		const store = new ProjectCreationDraftStore();
		store.updateDetails({ name: "External workspace", description: "Two real folders" });
		store.addRegisteredRoots([{
			directoryCandidateRef: "candidate-a",
			label: "A",
			localPath: "C:\\External\\A",
		}]);
		store.addRegisteredRoots([{
			directoryCandidateRef: "candidate-b",
			label: "B",
			localPath: "D:\\External\\B\\",
		}, {
			directoryCandidateRef: "duplicate-path",
			label: "B duplicate",
			localPath: "d:\\external\\b",
		}]);
		store.makePrimary("candidate-b");

		expect(store.snapshot()).toMatchObject({
			intentId: "draft-1",
			name: "External workspace",
			description: "Two real folders",
			primaryDirectoryCandidateRef: "candidate-b",
		});
		expect(store.snapshot().roots.map((root) => root.directoryCandidateRef)).toEqual([
			"candidate-a",
			"candidate-b",
		]);
		vi.unstubAllGlobals();
	});

	it("promotes a remaining folder when the primary selection is removed", () => {
		const store = new ProjectCreationDraftStore();
		store.addRegisteredRoots([
			{ directoryCandidateRef: "candidate-a", label: "A", localPath: "/work/a" },
			{ directoryCandidateRef: "candidate-b", label: "B", localPath: "/work/b" },
		]);
		store.removeRoot("candidate-a");

		expect(store.snapshot().primaryDirectoryCandidateRef).toBe("candidate-b");
	});

	it("rebinds renewed candidate references while preserving the primary physical folder", () => {
		const store = new ProjectCreationDraftStore();
		store.addRegisteredRoots([
			{ directoryCandidateRef: "old-a", label: "A", localPath: "C:\\work\\a" },
			{ directoryCandidateRef: "old-b", label: "B", localPath: "D:\\work\\b" },
		]);
		store.makePrimary("old-b");
		store.replaceRegisteredRoots({
			intentId: "retry-intent",
			primaryLocalPath: "D:\\work\\b",
			roots: [
				{ directoryCandidateRef: "new-a", label: "A", localPath: "C:\\work\\a" },
				{ directoryCandidateRef: "new-b", label: "B", localPath: "D:\\work\\b" },
			],
		});

		expect(store.snapshot()).toMatchObject({
			intentId: "retry-intent",
			primaryDirectoryCandidateRef: "new-b",
		});
	});
});
