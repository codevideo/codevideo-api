package types

type CodeVideoManifest struct {
	UserID     string      `json:"userId"`
	UUID       string      `json:"uuid"`
	Actions    []Action    `json:"actions"`
	AudioItems []AudioItem `json:"audioItems"`
	Error      string      `json:"error,omitempty"`
}

type Action struct {
	Name  string `json:"name"`
	Value string `json:"string"`
}

type AudioItem struct {
	Text   string `json:"text"`
	Mp3Url string `json:"mp3Url"`
}

type CodeVideoUserMetadata struct {
	Tokens             int    `json:"tokens"`
	StripeID           string `json:"stripeId"`
	Unlimited          bool   `json:"unlimited"`
	SubscriptionPlan   string `json:"subscriptionPlan"`
	SubscriptionStatus string `json:"subscriptionStatus"`
	TokensPerCycle     int    `json:"tokensPerCycle"`
}
