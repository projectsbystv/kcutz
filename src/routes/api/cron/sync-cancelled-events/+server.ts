/**
 * Cron endpoint that detects bookings whose Google Calendar event was deleted
 * directly in Google Calendar (outside the app). Since events are created with
 * sendUpdates=none, Google sends no cancellation email itself — so this job
 * marks such bookings as canceled and sends our own cancellation email.
 *
 * Called every 5 minutes by the cron worker, secured via CRON_SECRET.
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getCalendarEvent, getValidAccessToken } from '$lib/server/google-calendar';
import { sendCancellationEmail, getEmailTemplates, isEmailEnabled } from '$lib/server/email';

interface BookingRow {
	id: string;
	user_id: string;
	google_event_id: string;
	start_time: string;
	end_time: string;
	attendee_name: string;
	attendee_email: string;
	event_name: string;
	event_slug: string;
	event_description: string | null;
	host_name: string;
	host_email: string;
	contact_email: string | null;
	settings: string | null;
	brand_color: string | null;
}

export const GET = async ({ url, platform }: RequestEvent) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const cronSecret = url.searchParams.get('secret');
	if (env.CRON_SECRET && cronSecret !== env.CRON_SECRET) {
		throw error(401, 'Unauthorized');
	}

	const db = env.DB;
	const now = new Date();

	try {
		// Upcoming confirmed bookings that have a Google Calendar event
		const bookings = await db
			.prepare(`
				SELECT b.id, b.user_id, b.google_event_id, b.start_time, b.end_time,
					b.attendee_name, b.attendee_email,
					e.name as event_name, e.slug as event_slug, e.description as event_description,
					u.name as host_name, u.email as host_email, u.contact_email, u.settings, u.brand_color
				FROM bookings b
				JOIN event_types e ON b.event_type_id = e.id
				JOIN users u ON b.user_id = u.id
				WHERE b.status = 'confirmed'
				AND b.google_event_id IS NOT NULL
				AND b.start_time > ?
				ORDER BY b.start_time ASC
				LIMIT 50
			`)
			.bind(now.toISOString())
			.all<BookingRow>();

		const results = {
			checked: 0,
			cancelled: 0,
			emailsSent: 0,
			errors: [] as string[]
		};

		// Refresh the access token once per user, not once per booking
		const tokenCache = new Map<string, string | null>();

		for (const booking of bookings.results) {
			try {
				let accessToken = tokenCache.get(booking.user_id);
				if (accessToken === undefined) {
					try {
						accessToken = await getValidAccessToken(
							db,
							booking.user_id,
							env.GOOGLE_CLIENT_ID,
							env.GOOGLE_CLIENT_SECRET
						);
					} catch (tokenErr: any) {
						console.error(`Token refresh failed for user ${booking.user_id}:`, tokenErr);
						accessToken = null;
					}
					tokenCache.set(booking.user_id, accessToken);
				}
				if (!accessToken) continue;

				results.checked++;

				const event = await getCalendarEvent(accessToken, booking.google_event_id);

				// Event still exists and is not cancelled — nothing to do
				if (event && event.status !== 'cancelled') continue;

				// Event was deleted in Google Calendar → cancel the booking
				await db
					.prepare(
						`UPDATE bookings SET status = ?, canceled_at = CURRENT_TIMESTAMP, canceled_by = ?, cancellation_reason = ? WHERE id = ? AND status = 'confirmed'`
					)
					.bind('canceled', 'host', 'Event deleted in Google Calendar', booking.id)
					.run();

				await db
					.prepare(`UPDATE scheduled_emails SET status = 'cancelled' WHERE booking_id = ? AND status = 'pending'`)
					.bind(booking.id)
					.run();

				results.cancelled++;

				if (env.RESEND_API_KEY) {
					try {
						let timeFormat: '12h' | '24h' = '12h';
						try {
							const settings = booking.settings ? JSON.parse(booking.settings) : {};
							timeFormat = settings.timeFormat === '24h' ? '24h' : '12h';
						} catch {
							// Keep default
						}

						const templates = await getEmailTemplates(db, booking.user_id);
						if (isEmailEnabled(templates, 'cancellation')) {
							const template = templates.get('cancellation');
							await sendCancellationEmail(
								{
									attendeeName: booking.attendee_name,
									attendeeEmail: booking.attendee_email,
									eventName: booking.event_name,
									eventSlug: booking.event_slug,
									eventDescription: booking.event_description || '',
									startTime: new Date(booking.start_time),
									endTime: new Date(booking.end_time),
									meetingUrl: null,
									bookingId: booking.id,
									hostName: booking.host_name,
									hostEmail: booking.host_email,
									hostContactEmail: booking.contact_email || undefined,
									appUrl: env.APP_URL || '',
									customMessage: template?.custom_message || null,
									timeFormat,
									timezone: 'Europe/Berlin',
									brandColor: booking.brand_color || undefined
								},
								{
									apiKey: env.RESEND_API_KEY,
									from: env.EMAIL_FROM || booking.host_email,
									replyTo: booking.contact_email || booking.host_email
								},
								template?.subject || undefined
							);
							results.emailsSent++;
						}
					} catch (emailErr: any) {
						console.error(`Cancellation email failed for booking ${booking.id}:`, emailErr);
						results.errors.push(`Email for booking ${booking.id}: ${emailErr.message}`);
					}
				}
			} catch (err: any) {
				console.error(`Sync check failed for booking ${booking.id}:`, err);
				results.errors.push(`Booking ${booking.id}: ${err.message}`);
			}
		}

		return json({
			success: true,
			timestamp: now.toISOString(),
			...results
		});
	} catch (err: any) {
		console.error('Cron sync-cancelled-events error:', err);
		throw error(500, 'Failed to sync cancelled events');
	}
};
