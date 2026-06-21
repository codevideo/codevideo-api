import { IAction, ICourse, ILesson } from "@fullstackcraftllc/codevideo-types";
import { resolveProjectActions } from "./resolveProjectActions.js";

const a = (name: string, value: string): IAction => ({ name, value } as IAction);

const lessonOneActions: IAction[] = [a("author-speak-before", "one"), a("editor-type", "x")];
const lessonTwoActions: IAction[] = [a("author-speak-before", "two")];

const lesson: ILesson = {
  id: "l1",
  name: "Lesson 1",
  description: "",
  actions: lessonOneActions,
};

const course: ICourse = {
  id: "c1",
  name: "Course 1",
  description: "",
  primaryLanguage: "typescript",
  lessons: [lesson, { id: "l2", name: "Lesson 2", description: "", actions: lessonTwoActions }],
};

describe("resolveProjectActions", () => {
  it("accepts the legacy { actions } body", () => {
    expect(resolveProjectActions({ actions: lessonOneActions })).toEqual(lessonOneActions);
  });

  it("accepts { project } as a raw actions array", () => {
    expect(resolveProjectActions({ project: lessonOneActions })).toEqual(lessonOneActions);
  });

  it("accepts { project } as a single lesson", () => {
    expect(resolveProjectActions({ project: lesson })).toEqual(lessonOneActions);
  });

  it("flattens a course across all lessons", () => {
    expect(resolveProjectActions({ project: course })).toEqual([
      ...lessonOneActions,
      ...lessonTwoActions,
    ]);
  });

  it("prefers project over actions when both are present", () => {
    expect(resolveProjectActions({ project: lessonTwoActions, actions: lessonOneActions })).toEqual(
      lessonTwoActions
    );
  });

  it("returns [] for an empty / missing body", () => {
    expect(resolveProjectActions({})).toEqual([]);
    expect(resolveProjectActions({ actions: [] })).toEqual([]);
    expect(resolveProjectActions(undefined)).toEqual([]);
    expect(resolveProjectActions(null)).toEqual([]);
  });
});
