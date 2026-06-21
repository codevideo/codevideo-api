import { IAction, ICourse, ILesson, Project, isCourse, isLesson } from "@fullstackcraftllc/codevideo-types";

/**
 * Resolve the flat action list from a /create-video-v3 request body.
 *
 * Dual-accept: the legacy `{ actions: IAction[] }` body and the newer
 * `{ project: IAction[] | ILesson | ICourse }` union both work, so existing
 * clients (studio before its bump) keep functioning while new clients can send
 * a full project.
 *
 * A course is flattened across all its lessons into a single action stream -
 * one concatenated video, billed over the total action count. Per-lesson course
 * rendering (separate videos) is a future enhancement and intentionally not
 * done here.
 *
 * `project` takes precedence over `actions` when both are present.
 */
export const resolveProjectActions = (body: any): Array<IAction> => {
  const project: Project | undefined = body?.project ?? body?.actions;
  if (!project) {
    return [];
  }
  // raw actions array (legacy shape, or project sent as an array)
  if (Array.isArray(project)) {
    return project;
  }
  // course: concatenate every lesson's actions
  if (isCourse(project)) {
    return (project as ICourse).lessons?.flatMap((lesson) => lesson.actions ?? []) ?? [];
  }
  // single lesson
  if (isLesson(project)) {
    return (project as ILesson).actions ?? [];
  }
  return [];
};
