/**
 * Email service using Resend API
 * https://resend.com/docs/api-reference/emails/send-email
 *
 * This is the main entry point for the email module.
 * It re-exports types, formatters, and templates, and provides send functions.
 */

// Re-export types
export type { BookingEmailData, RescheduleEmailData, EmailTemplate, EmailTemplateType } from './types';

// Re-export formatters
export { createEmailFormatters, replaceSubjectVariables } from './formatters';

// Re-export template generators
export {
	generateBookingEmail,
	generateBookingEmailText,
	generateCancellationEmail,
	generateAdminCancellationEmail,
	generateRescheduleEmail,
	generateAdminRescheduleEmail,
	generateReminderEmail,
	getDefaultReminderSubject,
	generateAdminNotificationEmail
} from './templates';

import type { BookingEmailData, RescheduleEmailData, EmailTemplate, EmailTemplateType } from './types';
import { replaceSubjectVariables } from './formatters';
import {
	generateBookingEmail,
	generateBookingEmailText,
	generateCancellationEmail,
	generateAdminCancellationEmail,
	generateRescheduleEmail,
	generateAdminRescheduleEmail,
	generateReminderEmail,
	getDefaultReminderSubject,
	generateAdminNotificationEmail
} from './templates';

/**
 * Email configuration for sending
 */
interface EmailConfig {
	apiKey: string;
	from: string;
	replyTo?: string;
}

// Zentrale Hilfsfunktion für den Resend-API-Aufruf
async function sendViaResend(
	apiKey: string,
	payload: {
		from: string;
		to: string | string[];
		subject: string;
		html: string;
		text?: string;
		reply_to?: string;
	}
): Promise<void> {
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Resend API error: ${error}`);
	}
}

/**
 * Send booking confirmation email via Resend API
 */
export async function sendBookingEmail(
	data: BookingEmailData,
	config: EmailConfig & { replyTo: string },
	customSubject?: string
): Promise<void> {
	const htmlBody = generateBookingEmail(data);
	const textBody = generateBookingEmailText(data);
	const subject = customSubject
		? replaceSubjectVariables(customSubject, data)
		: `Meeting Confirmed: ${data.eventName} with ${data.hostName}`;

	try {
		await sendViaResend(config.apiKey, {
			from: `${data.hostName} <${config.from}>`,
			to: data.attendeeEmail,
			reply_to: config.replyTo,
			subject,
			text: textBody,
			html: htmlBody
		});
	} catch (error) {
		console.error('Email sending error:', error);
		throw error;
	}
}

/**
 * Send cancellation email
 */
export async function sendCancellationEmail(
	data: BookingEmailData,
	config: EmailConfig & { replyTo: string },
	customSubject?: string
): Promise<void> {
	const htmlBody = generateCancellationEmail(data);
	const subject = customSubject
		? replaceSubjectVariables(customSubject, data)
		: `Meeting Cancelled: ${data.eventName}`;

	try {
		await sendViaResend(config.apiKey, {
			from: `${data.hostName} <${config.from}>`,
			to: data.attendeeEmail,
			reply_to: config.replyTo,
			subject,
			html: htmlBody
		});
	} catch (error) {
		console.error('Cancellation email error:', error);
		throw error;
	}
}

/**
 * Send reschedule email
 */
export async function sendRescheduleEmail(
	data: RescheduleEmailData,
	config: EmailConfig & { replyTo: string },
	customSubject?: string
): Promise<void> {
	const htmlBody = generateRescheduleEmail(data);
	const subject = customSubject
		? replaceSubjectVariables(customSubject, data)
		: `Meeting Rescheduled: ${data.eventName} with ${data.hostName}`;

	try {
		await sendViaResend(config.apiKey, {
			from: `${data.hostName} <${config.from}>`,
			to: data.attendeeEmail,
			reply_to: config.replyTo,
			subject,
			html: htmlBody
		});
	} catch (error) {
		console.error('Reschedule email error:', error);
		throw error;
	}
}

/**
 * Send reminder email
 */
export async function sendReminderEmail(
	data: BookingEmailData,
	reminderType: 'reminder_24h' | 'reminder_1h' | 'reminder_30m',
	config: EmailConfig & { replyTo: string },
	customSubject?: string
): Promise<void> {
	const htmlBody = generateReminderEmail(data, reminderType);
	const subject = customSubject
		? replaceSubjectVariables(customSubject, data)
		: getDefaultReminderSubject(data, reminderType);

	try {
		await sendViaResend(config.apiKey, {
			from: `${data.hostName} <${config.from}>`,
			to: data.attendeeEmail,
			reply_to: config.replyTo,
			subject,
			html: htmlBody
		});
	} catch (error) {
		console.error('Reminder email error:', error);
		throw error;
	}
}

/**
 * Send admin notification email when a booking is made
 */
export async function sendAdminNotificationEmail(
	data: BookingEmailData,
	adminEmail: string,
	config: EmailConfig
): Promise<void> {
	const htmlBody = generateAdminNotificationEmail(data);

	try {
		await sendViaResend(config.apiKey, {
			from: `CloudMeet <${config.from}>`,
			to: adminEmail,
			subject: `New Booking: ${data.eventName} with ${data.attendeeName}`,
			html: htmlBody
		});
	} catch (error) {
		console.error('Admin notification email error:', error);
		throw error;
	}
}

/**
 * Send admin notification for cancellation
 */
export async function sendAdminCancellationNotification(
	data: BookingEmailData,
	adminEmail: string,
	config: EmailConfig
): Promise<void> {
	const htmlBody = generateAdminCancellationEmail(data);

	try {
		await sendViaResend(config.apiKey, {
			from: `CloudMeet <${config.from}>`,
			to: adminEmail,
			subject: `Booking Cancelled: ${data.eventName} with ${data.attendeeName}`,
			html: htmlBody
		});
	} catch (error) {
		console.error('Admin cancellation notification error:', error);
		throw error;
	}
}

/**
 * Send admin notification for reschedule
 */
export async function sendAdminRescheduleNotification(
	data: RescheduleEmailData,
	adminEmail: string,
	config: EmailConfig
): Promise<void> {
	const htmlBody = generateAdminRescheduleEmail(data);

	try {
		await sendViaResend(config.apiKey, {
			from: `CloudMeet <${config.from}>`,
			to: adminEmail,
			subject: `Booking Rescheduled: ${data.eventName} with ${data.attendeeName}`,
			html: htmlBody
		});
	} catch (error) {
		console.error('Admin reschedule notification error:', error);
		throw error;
	}
}

/**
 * Get email templates for a user
 */
export async function getEmailTemplates(
	db: D1Database,
	userId: string
): Promise<Map<EmailTemplateType, EmailTemplate>> {
	const templates = await db
		.prepare(
			'SELECT template_type, is_enabled, subject, custom_message FROM email_templates WHERE user_id = ?'
		)
		.bind(userId)
		.all<{
			template_type: EmailTemplateType;
			is_enabled: number;
			subject: string | null;
			custom_message: string | null;
		}>();

	const map = new Map<EmailTemplateType, EmailTemplate>();
	for (const t of templates.results) {
		map.set(t.template_type, {
			template_type: t.template_type,
			is_enabled: t.is_enabled === 1,
			subject: t.subject,
			custom_message: t.custom_message
		});
	}
	return map;
}

/**
 * Check if a specific email type is enabled
 */
export function isEmailEnabled(
	templates: Map<EmailTemplateType, EmailTemplate>,
	type: EmailTemplateType
): boolean {
	const template = templates.get(type);
	return template ? template.is_enabled : true;
}
