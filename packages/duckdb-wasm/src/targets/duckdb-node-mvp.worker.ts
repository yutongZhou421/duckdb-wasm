import { AsyncDuckDBDispatcher, WorkerResponseVariant, WorkerRequestVariant } from '../parallel/';
import { DuckDBBindings } from '../bindings';
import { DuckDB } from '../bindings/bindings_node_mvp';
import { NODE_RUNTIME } from '../bindings/runtime_node';
import { InstantiationProgress } from '../bindings/progress';

/** The duckdb worker API for node.js workers */
class NodeWorker extends AsyncDuckDBDispatcher {
    /** Post a response back to the main thread */
    protected postMessage(response: WorkerResponseVariant, transfer: ArrayBuffer[]) {
        globalThis.postMessage(response, transfer);
    }

    /** Instantiate the wasm module */
    protected async instantiate(
        mainModulePath: string,
        pthreadWorkerPath: string | null,
        progress: (p: InstantiationProgress) => void,
    ): Promise<DuckDBBindings> {
        const bindings = new DuckDB(this, NODE_RUNTIME, mainModulePath, pthreadWorkerPath);
        return await bindings.instantiate(progress);
    }
}

/** Register the worker */
export function registerWorker(): void {
    const api = new NodeWorker();
    globalThis.onmessage = async (event: MessageEvent<WorkerRequestVariant>) => {
        await api.onMessage(event.data);
    };
}

registerWorker();
