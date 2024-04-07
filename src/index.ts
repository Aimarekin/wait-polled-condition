/**
 * Represents a condition that can be checked.
 * A condition can be a single function or an array of functions.
 * Each function should return a value or a promise that resolves to a value.
 */
export type Condition = (() => any | Promise<any>) | (() => any | Promise<any>)[];

/**
 * Checks if the given condition is met.
 * @param condition - The condition to check.
 * @returns A Promise that resolves to a boolean indicating whether the condition is met.
 */
export async function isConditionMet(condition: Condition): Promise<boolean> {
	if (Array.isArray(condition)) {
		return (await Promise.all(condition.map((c) => c()))).every(Boolean);
	} else {
		return Boolean(await Promise.resolve(condition()));
	}
}

/**
 * Waits for a condition to be met.
 * The condition is checked immediately and then at regular intervals until it is met or the timeout is exceeded.
 * The condition may be a function that returns a value or a promise that resolves to a value, or an array of such functions.
 *
 * @param condition - The condition to be checked.
 * @param interval - The interval (in milliseconds) at which the condition should be checked. Default is 1000ms.
 * @param timeout - The maximum time (in milliseconds) to wait for the condition to be met. Default is -1 (no timeout).
 * @returns A promise that resolves when the condition is met, or rejects with an error if the timeout is exceeded.
 */
export default function waitPolledCondition(condition: Condition, interval = 1000, timeout = -1, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal) {
			if (signal.aborted) {
				reject(new DOMException("Aborted", "AbortError"));
				return;
			}
			signal.addEventListener("abort", () => {
				reject(new DOMException("Aborted", "AbortError"));
			});
		}

		const startTime = Date.now();

		function checkCondition() {
			isConditionMet(condition)
				.catch((err) => {
					console.error(err);
					return false;
				})
				.then((result) => {
					if (result) {
						resolve();
					}
				})
				.finally(scheduleCheckCondition);
		}

		function scheduleCheckCondition() {
			if (signal?.aborted) {
				return;
			}

			if (timeout === 0 || (timeout > 0 && Date.now() - startTime > timeout)) {
				reject(new Error("Timeout"));
			} else {
				setTimeout(checkCondition, timeout > 0 ? Math.min(interval, timeout - (Date.now() - startTime)) : interval);
			}
		}

		checkCondition();
	});
}
