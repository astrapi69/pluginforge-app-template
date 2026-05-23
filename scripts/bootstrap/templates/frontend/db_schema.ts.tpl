/**
 * IndexedDB schema for ${pascal_name}.
 *
 * Dexie is used as a read-through cache: pages fetch from the API,
 * write the response into Dexie, then ``useLiveQuery`` provides
 * reactivity. The backend is the source of truth; the cache exists
 * so the UI can render instantly (stale-while-revalidate) and so the
 * dashboard stays usable in offline mode.
 *
 * Sync (Dexie -> backend) is deliberately out of scope. Mutations
 * still go through the API; the cache is updated from the response.
 */

import Dexie, {type Table} from "dexie";

import type {${type_import_list}} from "../types/${name}";

class ${pascal_name}DB extends Dexie {
${table_declarations}

    constructor() {
        super("${name}");
        this.version(1).stores({
${table_stores}
        });
    }
}

export const db = new ${pascal_name}DB();

/** Replace the cached collection for a table with a fresh server payload. */
export async function refreshTable<T, K>(
    table: Table<T, K>,
    rows: T[],
): Promise<void> {
    await table.clear();
    if (rows.length > 0) {
        await table.bulkAdd(rows);
    }
}
