import * as check from 'wasm-feature-detect';

export interface DuckDBBundles {
    asyncDefault: {
        mainModule: string;
        mainWorker: string;
    };
    asyncNext?: {
        mainModule: string;
        mainWorker: string;
    };
    asyncNextCOI?: {
        mainModule: string;
        mainWorker: string;
        pthreadWorker: string;
    };
}

export interface DuckDBConfig {
    mainModule: string;
    mainWorker: string | null;
    pthreadWorker: string | null;
}

export interface PlatformFeatures {
    crossOriginIsolated: boolean;
    wasmExceptions: boolean;
    wasmSIMD: boolean;
    wasmBulkMemory: boolean;
    wasmThreads: boolean;
}

let wasmExceptions: boolean | null = null;
let wasmThreads: boolean | null = null;
let wasmSIMD: boolean | null = null;
let wasmBulkMemory: boolean | null = null;

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace globalThis {
    let crossOriginIsolated: boolean;
}

function isNode(): boolean {
    return typeof process !== 'undefined' && process.release.name === 'node';
}

export async function getPlatformFeatures(): Promise<PlatformFeatures> {
    if (wasmExceptions == null) {
        wasmExceptions = await check.exceptions();
    }
    if (wasmThreads == null) {
        wasmThreads = await check.threads();
    }
    if (wasmSIMD == null) {
        wasmSIMD = await check.simd();
    }
    if (wasmBulkMemory == null) {
        wasmBulkMemory = await check.bulkMemory();
    }
    return {
        crossOriginIsolated: isNode() || globalThis.crossOriginIsolated || false,
        wasmExceptions: wasmExceptions!,
        wasmSIMD: wasmSIMD!,
        wasmThreads: wasmThreads!,
        wasmBulkMemory: wasmBulkMemory!,
    };
}

export async function configure(bundles: DuckDBBundles): Promise<DuckDBConfig> {
    const platform = await getPlatformFeatures();
    if (platform.wasmExceptions && platform.wasmSIMD) {
        if (platform.wasmThreads && platform.crossOriginIsolated && bundles.asyncNextCOI) {
            return {
                mainModule: bundles.asyncNextCOI.mainModule,
                mainWorker: bundles.asyncNextCOI.mainWorker,
                pthreadWorker: bundles.asyncNextCOI.pthreadWorker,
            };
        }
        if (bundles.asyncNext) {
            return {
                mainModule: bundles.asyncNext.mainModule,
                mainWorker: bundles.asyncNext.mainWorker,
                pthreadWorker: null,
            };
        }
    }
    return {
        mainModule: bundles.asyncDefault.mainModule,
        mainWorker: bundles.asyncDefault.mainWorker,
        pthreadWorker: null,
    };
}
