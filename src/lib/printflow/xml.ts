export function parseXmlDocument(xml: string): Document | null {
	try {
		const doc = new DOMParser().parseFromString(xml, 'text/xml');
		const parserError = doc.querySelector('parsererror');
		if (parserError || doc.documentElement.nodeName === 'parsererror') {
			return null;
		}
		return doc;
	} catch {
		return null;
	}
}
