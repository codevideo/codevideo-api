import { ICodeVideoUserMetadata } from "@fullstackcraftllc/codevideo-types";

export const userIsPayAsYouGo = (metadata: ICodeVideoUserMetadata) => {
    // Pay-as-you-go accounts have no active subscription: new sign-ups and
    // token top-ups never set subscriptionStatus, and cancelled subscriptions
    // are set to "canceled" (see studio.codevideo.io/functions). Monthly plans
    // and lifetime members are "active"; lifetime members are also unlimited.
    return metadata.subscriptionStatus !== "active" && !metadata.unlimited
}
