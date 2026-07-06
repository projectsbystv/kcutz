/**
 * Cron Worker for CloudMeet email reminders
 * Runs every 5 minutes and calls the main app's reminder endpoint
 */

export default {
	async scheduled(event, env) {
		const endpoints = [
			{ name: 'send-reminders', path: '/api/cron/send-reminders' },
			{ name: 'sync-cancelled-events', path: '/api/cron/sync-cancelled-events' }
		];

		for (const endpoint of endpoints) {
			const url = `${env.APP_URL}${endpoint.path}?secret=${env.CRON_SECRET}`;

			try {
				const response = await fetch(url);
				const result = await response.json();
				console.log(`Cron ${endpoint.name} result:`, result);
			} catch (err) {
				console.error(`Cron ${endpoint.name} failed:`, err);
			}
		}
	}
};
