import * as arrow from 'apache-arrow';
import { AnalyzedQuery } from './analyzed_query';
import { DuckDBBindings } from './bindings_interface';
import { CSVInsertOptions, JSONInsertOptions, ArrowInsertOptions } from './insert_options';

/** A thin helper to bind the connection id and talk record batches */
export class DuckDBConnection {
    /** The bindings */
    protected _bindings: DuckDBBindings;
    /** The connection handle */
    protected _conn: number;

    /** Constructor */
    constructor(bindings: DuckDBBindings, conn: number) {
        this._bindings = bindings;
        this._conn = conn;
    }

    /** Close a connection */
    public close(): void {
        this._bindings.disconnect(this._conn);
    }

    /** Brave souls may use this function to consume the underlying connection id */
    public useUnsafe<R>(callback: (bindings: DuckDBBindings, conn: number) => R) {
        return callback(this._bindings, this._conn);
    }

    /** Analyzer a query */
    public analyze(text: string): AnalyzedQuery {
        return this._bindings.analyzeQuery(this._conn, text);
    }

    /** Run a query */
    public query<T extends { [key: string]: arrow.DataType } = any>(text: string): arrow.Table<T> {
        const buffer = this._bindings.runQuery(this._conn, text);
        const reader = arrow.RecordBatchReader.from<T>(buffer);
        console.assert(reader.isSync());
        console.assert(reader.isFile());
        return arrow.Table.from(reader);
    }

    /** Send a query */
    public send<T extends { [key: string]: arrow.DataType } = any>(text: string): arrow.RecordBatchStreamReader<T> {
        const header = this._bindings.sendQuery(this._conn, text);
        const iter = new ResultStreamIterator(this._bindings, this._conn, header);
        const reader = arrow.RecordBatchReader.from<T>(iter);
        console.assert(reader.isSync());
        console.assert(reader.isStream());
        return reader;
    }

    /** Get table names */
    public getTableNames(query: string): string[] {
        return this._bindings.getTableNames(this._conn, query);
    }

    /** Create a prepared statement */
    public prepare<T extends { [key: string]: arrow.DataType } = any>(text: string): PreparedStatement {
        const stmt = this._bindings.createPrepared(this._conn, text);
        return new PreparedStatement<T>(this._bindings, this._conn, stmt);
    }

    /** Insert an arrow table */
    public insertArrowTable(table: arrow.Table, options: ArrowInsertOptions): void {
        const buffer = table.serialize('binary', true);
        this.insertArrowFromIPCStream(buffer, options);
    }
    /** Insert an arrow table from an ipc stream */
    public insertArrowFromIPCStream(buffer: Uint8Array, options: ArrowInsertOptions): void {
        this._bindings.insertArrowFromIPCStream(this._conn, buffer, options);
    }

    /** Inesrt csv file from path */
    public insertCSVFromPath(path: string, options: CSVInsertOptions): void {
        this._bindings.insertCSVFromPath(this._conn, path, options);
    }
    /** Insert json file from path */
    public insertJSONFromPath(path: string, options: JSONInsertOptions): void {
        this._bindings.insertJSONFromPath(this._conn, path, options);
    }
}

/** A result stream iterator */
export class ResultStreamIterator implements Iterable<Uint8Array> {
    /** First chunk? */
    _first: boolean;
    /** Reached end of stream? */
    _depleted: boolean;

    constructor(protected bindings: DuckDBBindings, protected conn: number, protected header: Uint8Array) {
        this._first = true;
        this._depleted = false;
    }

    next(): IteratorResult<Uint8Array> {
        if (this._first) {
            this._first = false;
            return { done: false, value: this.header };
        }
        if (this._depleted) {
            return { done: true, value: null };
        }
        const bufferI8 = this.bindings.fetchQueryResults(this.conn);
        this._depleted = bufferI8.length == 0;
        return {
            done: this._depleted,
            value: bufferI8,
        };
    }

    [Symbol.iterator]() {
        return this;
    }
}

/** A thin helper to bind the prepared statement id*/
export class PreparedStatement<T extends { [key: string]: arrow.DataType } = any> {
    /** The bindings */
    protected readonly bindings: DuckDBBindings;
    /** The connection id */
    protected readonly connectionId: number;
    /** The statement id */
    protected readonly statementId: number;

    /** Constructor */
    constructor(bindings: DuckDBBindings, connectionId: number, statementId: number) {
        this.bindings = bindings;
        this.connectionId = connectionId;
        this.statementId = statementId;
    }

    /** Close a prepared statement */
    public close() {
        this.bindings.closePrepared(this.connectionId, this.statementId);
    }

    /** Run a prepared statement */
    public query(...params: any[]): arrow.Table<T> {
        const buffer = this.bindings.runPrepared(this.connectionId, this.statementId, params);
        const reader = arrow.RecordBatchReader.from<T>(buffer);
        console.assert(reader.isSync());
        console.assert(reader.isFile());
        return arrow.Table.from(reader as arrow.RecordBatchFileReader);
    }

    /** Send a prepared statement */
    public send(...params: any[]): arrow.RecordBatchStreamReader<T> {
        const header = this.bindings.sendPrepared(this.connectionId, this.statementId, params);
        const iter = new ResultStreamIterator(this.bindings, this.connectionId, header);
        const reader = arrow.RecordBatchReader.from<T>(iter);
        console.assert(reader.isSync());
        console.assert(reader.isStream());
        return reader as arrow.RecordBatchStreamReader;
    }
}
