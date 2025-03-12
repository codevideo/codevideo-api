import { ICodeVideoUserMetadata } from "@fullstackcraftllc/codevideo-types";

export const userIsPayAsYouGo = (metadata: ICodeVideoUserMetadata) => {
    // only monthly subscribers / lifetime members have a subscription status
    return metadata.subscriptionStatus === "active"
}