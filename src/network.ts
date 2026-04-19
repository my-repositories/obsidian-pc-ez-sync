export function isBrowserOnline(): boolean {
	if (typeof navigator === "undefined") {
		return true;
	}
	return navigator.onLine;
}

export function isLikelyNetworkError(message: string): boolean {
	const m = message.toLowerCase();
	return (
		m.includes("could not resolve host") ||
		m.includes("unable to access") ||
		m.includes("failed to connect") ||
		m.includes("connection refused") ||
		m.includes("connection timed out") ||
		m.includes("connection reset") ||
		m.includes("network is unreachable") ||
		m.includes("getaddrinfo") ||
		m.includes("name or service not known") ||
		m.includes("temporary failure in name resolution") ||
		m.includes("no route to host") ||
		m.includes("timed out") ||
		m.includes("ssl connection") ||
		m.includes("tls connection") ||
		m.includes("broken pipe")
	);
}
