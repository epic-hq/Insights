import { z } from "zod";

const jsonPointerSchema = z.string().refine((value) => value === "" || value.startsWith("/"), {
	message: "path must be a JSON Pointer",
});

const addOpSchema = z.object({
	op: z.literal("add"),
	path: jsonPointerSchema,
	value: z.unknown(),
});

const removeOpSchema = z.object({
	op: z.literal("remove"),
	path: jsonPointerSchema,
});

const replaceOpSchema = z.object({
	op: z.literal("replace"),
	path: jsonPointerSchema,
	value: z.unknown(),
});

const moveOpSchema = z.object({
	op: z.literal("move"),
	path: jsonPointerSchema,
	from: jsonPointerSchema,
});

const copyOpSchema = z.object({
	op: z.literal("copy"),
	path: jsonPointerSchema,
	from: jsonPointerSchema,
});

const testOpSchema = z.object({
	op: z.literal("test"),
	path: jsonPointerSchema,
	value: z.unknown(),
});

export const jsonPatchOperationSchema = z.union([
	addOpSchema,
	removeOpSchema,
	replaceOpSchema,
	moveOpSchema,
	copyOpSchema,
	testOpSchema,
]);

export const jsonPatchSchema = z.array(jsonPatchOperationSchema);

export type JsonPatchOperation = z.infer<typeof jsonPatchOperationSchema>;
export type JsonPatchError = {
	index: number;
	op: JsonPatchOperation;
	message: string;
};

export type JsonPatchResult<T> = { ok: true; value: T } | { ok: false; errors: JsonPatchError[] };

export const validateJsonPatch = (patch: unknown) => {
	const parsed = jsonPatchSchema.safeParse(patch);
	if (!parsed.success) {
		return { ok: false, errors: parsed.error.issues };
	}
	return { ok: true, value: parsed.data };
};

const parsePointer = (path: string): string[] => {
	if (path === "") return [];
	if (!path.startsWith("/")) {
		throw new Error("Invalid JSON Pointer: must start with '/'");
	}
	return path
		.slice(1)
		.split("/")
		.map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
};

const isObject = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseArrayIndex = (segment: string, length: number, options: { allowEnd: boolean; allowDash: boolean }) => {
	if (segment === "-") {
		if (!options.allowDash) {
			throw new Error("Invalid array index '-' for this operation");
		}
		return length;
	}
	if (!/^(0|[1-9]\d*)$/.test(segment)) {
		throw new Error("Array index must be a non-negative integer");
	}
	const index = Number(segment);
	if (index > length || (!options.allowEnd && index === length)) {
		throw new Error("Array index out of bounds");
	}
	return index;
};

const getParent = (doc: unknown, segments: string[]) => {
	if (segments.length === 0) {
		return { parent: null, key: null };
	}
	let current: unknown = doc;
	for (let i = 0; i < segments.length - 1; i += 1) {
		const segment = segments[i];
		if (Array.isArray(current)) {
			const index = parseArrayIndex(segment, current.length, {
				allowEnd: false,
				allowDash: false,
			});
			current = current[index];
			continue;
		}
		if (isObject(current)) {
			if (!(segment in current)) {
				throw new Error("Path does not exist");
			}
			current = current[segment];
			continue;
		}
		throw new Error("Cannot traverse non-object path");
	}
	return { parent: current, key: segments[segments.length - 1] };
};

const getValue = (doc: unknown, segments: string[]) => {
	let current: unknown = doc;
	for (const segment of segments) {
		if (Array.isArray(current)) {
			const index = parseArrayIndex(segment, current.length, {
				allowEnd: false,
				allowDash: false,
			});
			current = current[index];
			continue;
		}
		if (isObject(current)) {
			if (!(segment in current)) {
				throw new Error("Path does not exist");
			}
			current = current[segment];
			continue;
		}
		throw new Error("Cannot traverse non-object path");
	}
	return current;
};

const applyAdd = (doc: unknown, segments: string[], value: unknown) => {
	if (segments.length === 0) {
		return value;
	}
	const { parent, key } = getParent(doc, segments);
	if (Array.isArray(parent)) {
		const index = parseArrayIndex(String(key), parent.length, {
			allowEnd: true,
			allowDash: true,
		});
		parent.splice(index, 0, value);
		return doc;
	}
	if (isObject(parent)) {
		parent[String(key)] = value;
		return doc;
	}
	throw new Error("Cannot add to non-container path");
};

const applyReplace = (doc: unknown, segments: string[], value: unknown) => {
	if (segments.length === 0) {
		return value;
	}
	const { parent, key } = getParent(doc, segments);
	if (Array.isArray(parent)) {
		const index = parseArrayIndex(String(key), parent.length, {
			allowEnd: false,
			allowDash: false,
		});
		parent[index] = value;
		return doc;
	}
	if (isObject(parent)) {
		if (!(String(key) in parent)) {
			throw new Error("Path does not exist");
		}
		parent[String(key)] = value;
		return doc;
	}
	throw new Error("Cannot replace at non-container path");
};

const applyRemove = (doc: unknown, segments: string[]) => {
	if (segments.length === 0) {
		throw new Error("Cannot remove the document root");
	}
	const { parent, key } = getParent(doc, segments);
	if (Array.isArray(parent)) {
		const index = parseArrayIndex(String(key), parent.length, {
			allowEnd: false,
			allowDash: false,
		});
		parent.splice(index, 1);
		return doc;
	}
	if (isObject(parent)) {
		if (!(String(key) in parent)) {
			throw new Error("Path does not exist");
		}
		delete parent[String(key)];
		return doc;
	}
	throw new Error("Cannot remove from non-container path");
};

const deepEqual = (a: unknown, b: unknown): boolean => {
	if (Object.is(a, b)) return true;
	if (typeof a !== typeof b) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, index) => deepEqual(item, b[index]));
	}
	if (isObject(a) && isObject(b)) {
		const aKeys = Object.keys(a);
		const bKeys = Object.keys(b);
		if (aKeys.length !== bKeys.length) return false;
		return aKeys.every((key) => deepEqual(a[key], b[key]));
	}
	return false;
};

export const applyJsonPatch = <T>(state: T, patch: JsonPatchOperation[]): JsonPatchResult<T> => {
	let working = structuredClone(state) as T;
	const errors: JsonPatchError[] = [];

	for (let index = 0; index < patch.length; index += 1) {
		const op = patch[index];
		try {
			switch (op.op) {
				case "add": {
					const segments = parsePointer(op.path);
					const next = applyAdd(working, segments, op.value);
					if (segments.length === 0) {
						working = next as T;
					}
					break;
				}
				case "remove": {
					const segments = parsePointer(op.path);
					applyRemove(working, segments);
					break;
				}
				case "replace": {
					const segments = parsePointer(op.path);
					const next = applyReplace(working, segments, op.value);
					if (segments.length === 0) {
						working = next as T;
					}
					break;
				}
				case "move": {
					const fromSegments = parsePointer(op.from);
					const value = getValue(working, fromSegments);
					applyRemove(working, fromSegments);
					applyAdd(working, parsePointer(op.path), value);
					break;
				}
				case "copy": {
					const fromSegments = parsePointer(op.from);
					const value = getValue(working, fromSegments);
					applyAdd(working, parsePointer(op.path), structuredClone(value));
					break;
				}
				case "test": {
					const value = getValue(working, parsePointer(op.path));
					if (!deepEqual(value, op.value)) {
						throw new Error("Test operation failed");
					}
					break;
				}
				default: {
					const neverOp: never = op;
					throw new Error(`Unsupported op ${(neverOp as JsonPatchOperation).op}`);
				}
			}
		} catch (error) {
			errors.push({
				index,
				op,
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}
	return { ok: true, value: working };
};
