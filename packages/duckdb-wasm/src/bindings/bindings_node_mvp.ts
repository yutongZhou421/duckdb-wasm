import DuckDBWasm from './duckdb-mvp.js';
import { DuckDBNodeBindings } from './bindings_node_base.js';
import { Logger } from '../log.js';
import { DuckDBModule } from './duckdb_module';
import { DuckDBRuntime } from './runtime';

/** DuckDB bindings for node.js */
export class DuckDB extends DuckDBNodeBindings {
    /** Constructor */
    public constructor(
        logger: Logger,
        runtime: DuckDBRuntime,
        mainModulePath: string,
        pthreadWorkerPath: string | null = null,
    ) {
        super(logger, runtime, mainModulePath, pthreadWorkerPath);
    }

    /** Instantiate the bindings */
    protected instantiateImpl(moduleOverrides: Partial<DuckDBModule>): Promise<DuckDBModule> {
        return DuckDBWasm({
            ...moduleOverrides,
            instantiateWasm: this.instantiateWasm.bind(this),
            locateFile: this.locateFile.bind(this),
        });
    }
}

export default DuckDB;
