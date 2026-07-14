import { IAction, ICodeVideoIDEProps, ICodeVideoManifest } from "@fullstackcraftllc/codevideo-types";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { generateAudioItems } from "./generateAudioItems.js";
import {
    ICreateVideoOptions,
    IVideoOptions,
    buildCodeVideoIDEProps,
    buildVideoOptions,
} from "./validateCreateVideoOptions.js";

// videoOptions is not part of ICodeVideoManifest yet (Tier 2). Today's Go worker
// and v3 render page both ignore unknown JSON keys, so carrying it here is inert
// and forward-compatible until the worker learns to read it.
type ManifestWithVideoOptions = ICodeVideoManifest & { videoOptions?: IVideoOptions };

export const generateManifestFile = async (
    dirname: string,
    actions: Array<IAction>,
    userId: string,
    options: ICreateVideoOptions = {}
) => {
    const uuid = uuidv4();

    // generate audio per author-speak action (voiceId / ttsProvider from options;
    // S3 in prod, inline data URI in dev — handled inside generateAudioItems)
    const audioItems = await generateAudioItems(actions, options);

    // create manifest. We write an actions-based manifest (the render path the
    // CLI + example v3 page already consume): a course/lesson payload is
    // flattened to actions upstream in resolveProjectActions. currentLessonIndex
    // is required by the type but inert for an actions stream (the component
    // only uses it to pick a lesson out of a course), so 0 is a safe default.
    const manifest: ManifestWithVideoOptions = {
        environment: process.env.ENVIRONMENT || "production",
        userId,
        uuid,
        actions,
        currentLessonIndex: 0,
        audioItems
    }

    // Tier-1 layout/IDE options the v3 render page merges from the manifest.
    const ideProps = buildCodeVideoIDEProps(options);
    if (Object.keys(ideProps).length > 0) {
        // a partial is safe: the v3 page spreads it over its own complete defaults
        manifest.codeVideoIDEProps = ideProps as ICodeVideoIDEProps;
    }

    // Tier-2 recording dimensions (resolution/orientation), carried for the worker.
    const videoOptions = buildVideoOptions(options);
    if (Object.keys(videoOptions).length > 0) {
        manifest.videoOptions = videoOptions;
    }

    // write the manifest to the tmp/v3/new folder using the uuid as the filename
    fs.writeFileSync(path.join(dirname, "..", "tmp", "v3", "new", `${uuid}.json`), JSON.stringify(manifest));
}