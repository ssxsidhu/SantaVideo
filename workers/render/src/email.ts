/**
 * "Your video is ready" email. Until Resend is set up (RESEND_API_KEY + verified domain) this only records that
 * the email would be sent: video id only, no address or name in the log.
 * TODO: send with the EN/FR template (messages.email.videoReady), decrypt orders.email_enc only here, set emailed_at.
 */
export async function sendVideoReadyEmail(videoId: string): Promise<void> {
  console.log(`[email] video-ready for video ${videoId}: not sent (Resend not configured yet)`);
}
