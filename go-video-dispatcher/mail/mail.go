package mail

import (
	"errors"
	"fmt"
	"os"

	"github.com/mailjet/mailjet-apiv3-go"
)

// SendEmail sends a notification using Mailjet.
func SendEmail(userEmail string, mp4Url string) error {
	// Get Mailjet API keys from environment variables.
	mjPublic := os.Getenv("MJ_APIKEY_PUBLIC")
	mjPrivate := os.Getenv("MJ_APIKEY_PRIVATE")
	if mjPublic == "" || mjPrivate == "" {
		return errors.New("mailjet api keys not set")
	}

	mailjetClient := mailjet.NewMailjetClient(mjPublic, mjPrivate)

	// Build HTML content for the email.
	htmlContent := fmt.Sprintf("<h1>CodeVideo Generated!</h1><p>Your video has been generated and is available for download: </p> <a href=\"%s\" download target=\"_blank\">Download Video</a><br/><br/>If the link doesn't trigger a download, copy and paste this into your browser: %s", mp4Url, mp4Url)

	// TODO: use the clerk userID to get the email address of the user

	// Create the email message.
	message := mailjet.InfoMessagesV31{
		From: &mailjet.RecipientV31{
			Email: "hi@fullstackcraft.com",
			Name:  "Full Stack Craft",
		},
		To: &mailjet.RecipientsV31{
			{
				Email: userEmail,
			},
		},
		Subject:  "CodeVideo Generated!",
		HTMLPart: htmlContent,
	}
	messages := mailjet.MessagesV31{
		Info: []mailjet.InfoMessagesV31{message},
	}

	// Send the email.
	_, err := mailjetClient.SendMailV31(&messages)
	if err != nil {
		return fmt.Errorf("mailjet error: %v", err)
	}
	return nil
}
