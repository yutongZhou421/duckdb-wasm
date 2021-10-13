import * as lf from 'lovefield-ts/dist/es6/lf.js';
import * as faker from 'faker';
import * as arrow from 'apache-arrow';
import { SystemBenchmark, SystemBenchmarkMetadata, SystemBenchmarkContext, noop } from './system_benchmark';
import { generate2Int32, generateGroupedInt32, generateInt32, generateUtf8, generateXInt32 } from './data_generator';
import { getTPCHArrowTable } from './tpch_loader';

// Decimals are not properly supported by the arrow javascript library atm.
type DECIMAL_12_2 = arrow.Float64;

export class LovefieldTPCHBenchmark implements SystemBenchmark {
    builder?: lf.Builder | null;
    database?: lf.DatabaseConnection | null;
    scaleFactor: number;
    queryId: number;

    constructor(scaleFactor: number, queryId: number) {
        this.builder = null;
        this.database = null;
        this.scaleFactor = scaleFactor;
        this.queryId = queryId;
    }
    getName(): string {
        return `lovefield_tpch_${this.scaleFactor.toString().replace('.', '')}_q${this.queryId}`;
    }
    getMetadata(): SystemBenchmarkMetadata {
        return {
            benchmark: 'tpch',
            system: 'lovefield',
            tags: [],
            timestamp: +new Date(),
            parameters: [this.scaleFactor, this.queryId],
        };
    }

    async beforeAll(ctx: SystemBenchmarkContext): Promise<void> {
        this.builder = lf.schema.create(`${this.getName()}_schema`, 1);

        const lineitemBuilder = this.builder!.createTable(`lineitem`);
        lineitemBuilder.addColumn('l_orderkey', lf.Type.INTEGER);
        lineitemBuilder.addColumn('l_partkey', lf.Type.INTEGER);
        lineitemBuilder.addColumn('l_suppkey', lf.Type.INTEGER);
        lineitemBuilder.addColumn('l_linenumber', lf.Type.INTEGER);
        lineitemBuilder.addColumn('l_quantity', lf.Type.NUMBER);
        lineitemBuilder.addColumn('l_extendedprice', lf.Type.NUMBER);
        lineitemBuilder.addColumn('l_discount', lf.Type.NUMBER);
        lineitemBuilder.addColumn('l_tax', lf.Type.NUMBER);
        lineitemBuilder.addColumn('l_returnflag', lf.Type.STRING);
        lineitemBuilder.addColumn('l_linestatus', lf.Type.STRING);
        lineitemBuilder.addColumn('l_shipdate', lf.Type.STRING);
        lineitemBuilder.addColumn('l_commitdate', lf.Type.STRING);
        lineitemBuilder.addColumn('l_receiptdate', lf.Type.STRING);
        lineitemBuilder.addColumn('l_shipinstruct', lf.Type.STRING);
        lineitemBuilder.addColumn('l_shipmode', lf.Type.STRING);
        lineitemBuilder.addColumn('l_comment', lf.Type.STRING);
        lineitemBuilder.addPrimaryKey(['l_orderkey', 'l_linenumber']);

        this.database = await this.builder!.connect({ storeType: lf.DataStoreType.MEMORY });
        const lineitemTable = this.database!.getSchema().table('lineitem');
        const lineitemRows = [];
        for (const row of (await getTPCHArrowTable(
            ctx.projectRootPath,
            this.scaleFactor,
            'lineitem.arrow',
        )) as arrow.Table<{
            l_orderkey: arrow.Int32;
            l_partkey: arrow.Int32;
            l_suppkey: arrow.Int32;
            l_linenumber: arrow.Int32;
            l_quantity: DECIMAL_12_2;
            l_extendedprice: DECIMAL_12_2;
            l_discount: DECIMAL_12_2;
            l_tax: DECIMAL_12_2;
            l_returnflag: arrow.Utf8;
            l_linestatus: arrow.Utf8;
            l_shipdate: arrow.DateDay;
            l_commitdate: arrow.DateDay;
            l_receiptdate: arrow.DateDay;
            l_shipinstruct: arrow.DateDay;
            l_shipmode: arrow.Utf8;
            l_comment: arrow.Utf8;
        }>) {
            lineitemRows.push(
                lineitemTable.createRow({
                    l_orderkey: row.l_orderkey,
                    l_partkey: row.l_partkey,
                    l_suppkey: row.l_suppkey,
                    l_linenumber: row.l_linenumber,
                    l_quantity: row.l_quantity,
                    l_extendedprice: row.l_extendedprice,
                    l_discount: row.l_extendedprice,
                    l_tax: row.l_tax,
                    l_returnflag: row.l_returnflag,
                    l_linestatus: row.l_linestatus,
                    l_shipdate: row.l_shipdate,
                    l_commitdate: row.l_commitdate,
                    l_receiptdate: row.l_receiptdate,
                    l_shipinstruct: row.l_shipinstruct,
                    l_shipmode: row.l_shipmode,
                    l_comment: row.l_comment,
                }),
            );
        }
        await this.database!.insert().into(lineitemTable).values(lineitemRows).exec();

        // const orders = await getTPCHArrowTable(ctx.projectRootPath, this.scaleFactor, 'orders.arrow');
        // const customer = await getTPCHArrowTable(ctx.projectRootPath, this.scaleFactor, 'customer.arrow');
        // const supplier = await getTPCHArrowTable(ctx.projectRootPath, this.scaleFactor, 'supplier.arrow');
        // const region = await getTPCHArrowTable(ctx.projectRootPath, this.scaleFactor, 'region.arrow');
        // const nation = await getTPCHArrowTable(ctx.projectRootPath, this.scaleFactor, 'nation.arrow');
        // const partsupp = await getTPCHArrowTable(ctx.projectRootPath, this.scaleFactor, 'partsupp.arrow');
        // const part = await getTPCHArrowTable(ctx.projectRootPath, this.scaleFactor, 'part.arrow');
    }
    async beforeEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async run(_ctx: SystemBenchmarkContext): Promise<void> {
        // XXX
        // Lovefield docs contains
        // * / % + -	User shall use JavaScript for arithmetic operations.
        //
        // Does that mean Lovefield cannot to to arithmetic within the query plan?
        // We "bypass" that limitation by splitting up the aggregates, s.t. the required work stays almost the same.
        switch (this.queryId) {
            case 1: {
                const lineitem = this.database!.getSchema().table('lineitem');
                const query = (await this.database!.select(
                    lineitem.col('l_returnflag'),
                    lineitem.col('l_linestatus'),
                    lf.fn.sum(lineitem.col('l_quantity')).as('sum_qty'),
                    lf.fn.sum(lineitem.col('l_extendedprice')).as('sum_base_price'),
                    lf.fn.sum(lineitem.col('l_discount')).as('sum_discount'),
                    lf.fn.sum(lineitem.col('l_tax')).as('sum_tax'),
                    lf.fn.avg(lineitem.col('l_quantity')).as('avg_qty'),
                    lf.fn.avg(lineitem.col('l_extendedprice')).as('avg_price'),
                    lf.fn.avg(lineitem.col('l_discount')).as('avg_disc'),
                    lf.fn.count().as('count_order'),
                )
                    .from(lineitem)
                    .where(lineitem.col('l_shipdate').lt(new Date(1998, 9, 2)))
                    .groupBy(lineitem.col('l_returnflag'), lineitem.col('l_linestatus'))
                    .orderBy(lineitem.col('l_returnflag'))
                    .orderBy(lineitem.col('l_linestatus'))
                    .exec()) as Iterable<{
                    l_returnflag: number;
                    l_linestatus: string;
                    sum_qty: number;
                    sum_base_price: number;
                    sum_discount: number;
                    sum_tax: number;
                    avg_qty: number;
                    avg_price: number;
                    avg_disc: number;
                    count_order: number;
                }>;
                for (const row of query) {
                    noop(row);
                }
                break;
            }
        }
    }

    async afterEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async afterAll(_ctx: SystemBenchmarkContext): Promise<void> {
        const drop = async (name: string) => {
            const table = this.database!.getSchema().table(name);
            await this.database!.delete().from(table).exec();
        };
        await drop('lineitem');
        //await drop('orders');
        //await drop('customers');
        //await drop('supplier');
        //await drop('part');
        //await drop('partsupp');
        //await drop('region');
        //await drop('nation');
        this.database!.close();
    }
    async onError(ctx: SystemBenchmarkContext): Promise<void> {
        this.afterAll(ctx);
    }
}

export class LovefieldRegexScanBenchmark implements SystemBenchmark {
    builder?: lf.Builder | null;
    database?: lf.DatabaseConnection | null;
    tuples: number;
    chars: number;

    constructor(tuples: number, chars: number) {
        this.builder = null;
        this.database = null;
        this.tuples = tuples;
        this.chars = chars;
    }
    getName(): string {
        return `lovefield_regex_${this.tuples}`;
    }
    getMetadata(): SystemBenchmarkMetadata {
        return {
            benchmark: 'regex',
            system: 'lovefield',
            tags: [],
            timestamp: +new Date(),
            parameters: [this.tuples, this.chars],
        };
    }
    async beforeAll(ctx: SystemBenchmarkContext): Promise<void> {
        faker.seed(ctx.seed);

        // Create table
        this.builder = lf.schema.create(`${this.getName()}_schema`, 1);
        const tableBuilder = this.builder!.createTable(this.getName());
        tableBuilder.addColumn('v0', lf.Type.STRING);

        // Get table
        this.database = await this.builder!.connect({ storeType: lf.DataStoreType.MEMORY });
        const table = this.database!.getSchema().table(this.getName());
        const rows = [];
        for (const value of generateUtf8(this.tuples, this.chars)) {
            rows.push(table.createRow({ v0: value }));
        }

        // Insert values
        await this.database!.insert().into(table).values(rows).exec();
    }
    async beforeEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async run(_ctx: SystemBenchmarkContext): Promise<void> {
        const table = this.database!.getSchema().table(this.getName());
        const rows = (await this.database!.select()
            .from(table)
            .where(table.col('v0').match(/^.#.*/))
            .exec()) as Iterable<{
            v0: number;
        }>;
        let n = 0;
        for (const row of rows) {
            noop(row);
            n += 1;
        }
        if (n !== 10) {
            throw Error(`invalid tuple count. expected 10, received ${n}`);
        }
    }
    async afterEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async afterAll(_ctx: SystemBenchmarkContext): Promise<void> {
        const table = this.database!.getSchema().table(this.getName());
        await this.database!.delete().from(table).exec();
        this.database!.close();
    }
    async onError(ctx: SystemBenchmarkContext): Promise<void> {
        await this.afterAll(ctx);
    }
}

export class LovefieldIntegerSumBenchmark implements SystemBenchmark {
    builder?: lf.Builder | null;
    database?: lf.DatabaseConnection | null;
    tuples: number;
    groupSize: number;

    constructor(tuples: number, groupSize: number) {
        this.builder = null;
        this.database = null;
        this.tuples = tuples;
        this.groupSize = groupSize;
    }
    getName(): string {
        return `lovefield_integer_sum_${this.tuples}`;
    }
    getMetadata(): SystemBenchmarkMetadata {
        return {
            benchmark: 'integer_sum',
            system: 'lovefield',
            tags: [],
            timestamp: +new Date(),
            parameters: [this.tuples, this.groupSize],
        };
    }
    async beforeAll(ctx: SystemBenchmarkContext): Promise<void> {
        faker.seed(ctx.seed);
        this.builder = lf.schema.create(`${this.getName()}_schema`, 1);
        const tableBuilder = this.builder!.createTable(this.getName());
        tableBuilder.addColumn('v0', lf.Type.INTEGER);
        tableBuilder.addColumn('v1', lf.Type.INTEGER);

        this.database = await this.builder!.connect({ storeType: lf.DataStoreType.MEMORY });
        const table = this.database!.getSchema().table(this.getName());
        const rows = [];
        const [values0, values1] = generateGroupedInt32(this.tuples, this.groupSize);
        for (let i = 0; i < values0.length; ++i) {
            rows.push(table.createRow({ v0: values0[i], v1: values1[i] }));
        }
        await this.database!.insert().into(table).values(rows).exec();
    }
    async beforeEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async run(_ctx: SystemBenchmarkContext): Promise<void> {
        const table = this.database!.getSchema().table(this.getName());
        const rows = (await this.database!.select(table.col('v0'), lf.fn.sum(table.col('v1')))
            .from(table)
            .groupBy(table.col('v0'))
            .exec()) as Iterable<{
            v0: number;
        }>;
        let n = 0;
        for (const row of rows) {
            noop(row);
            n += 1;
        }
        const expectedGroups = this.tuples / this.groupSize;
        if (n !== expectedGroups) {
            throw Error(`invalid tuple count. expected ${expectedGroups}, received ${n}`);
        }
    }
    async afterEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async afterAll(_ctx: SystemBenchmarkContext): Promise<void> {
        const table = this.database!.getSchema().table(this.getName());
        await this.database!.delete().from(table).exec();
        this.database!.close();
    }
    async onError(ctx: SystemBenchmarkContext): Promise<void> {
        await this.afterAll(ctx);
    }
}

export class LovefieldIntegerSortBenchmark implements SystemBenchmark {
    builder?: lf.Builder | null;
    database?: lf.DatabaseConnection | null;
    tuples: number;
    columnCount: number;
    orderBy: string[];

    constructor(tuples: number, columnCount: number, orderCriteria: number) {
        this.builder = null;
        this.database = null;
        this.tuples = tuples;
        this.columnCount = columnCount;
        this.orderBy = [];
        for (let i = 0; i < orderCriteria; ++i) {
            this.orderBy.push(`v${i}`);
        }
    }
    getName(): string {
        return `lovefield_integer_sort_${this.tuples}_${this.columnCount}_${this.orderBy.length}`;
    }
    getMetadata(): SystemBenchmarkMetadata {
        return {
            benchmark: 'integer_sort',
            system: 'lovefield',
            tags: [],
            timestamp: +new Date(),
            parameters: [this.tuples, this.columnCount, this.orderBy.length],
        };
    }
    async beforeAll(ctx: SystemBenchmarkContext): Promise<void> {
        faker.seed(ctx.seed);

        this.builder = lf.schema.create(`${this.getName()}_schema`, 1);
        const tableBuilder = this.builder!.createTable(this.getName());
        const columns = generateXInt32(this.tuples, this.columnCount);
        for (let i = 0; i < columns.length; ++i) {
            tableBuilder.addColumn(`v${i}`, lf.Type.INTEGER);
        }

        this.database = await this.builder!.connect({ storeType: lf.DataStoreType.MEMORY });
        const table = this.database!.getSchema().table(this.getName());
        const rows = [];
        for (let i = 0; i < columns[0].length; ++i) {
            const row: any = {};
            for (let j = 0; j < columns.length; ++j) {
                row[`v${j}`] = columns[j][i];
            }
            rows.push(table.createRow(row));
        }
        await this.database!.insert().into(table).values(rows).exec();
    }
    async beforeEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async run(_ctx: SystemBenchmarkContext): Promise<void> {
        const table = this.database!.getSchema().table(this.getName());
        let query = this.database!.select().from(table);
        for (let i = 0; i < this.columnCount; ++i) {
            query = query.orderBy(table.col(`v${i}`));
        }
        const rows = (await query.exec()) as Iterable<{
            v0: number;
        }>;
        let n = 0;
        for (const row of rows) {
            noop(row);
            n += 1;
        }
        if (this.tuples !== n) {
            throw Error(`invalid tuple count. expected ${this.tuples}, received ${n}`);
        }
    }
    async afterEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async afterAll(_ctx: SystemBenchmarkContext): Promise<void> {
        const table = this.database!.getSchema().table(this.getName());
        await this.database!.delete().from(table).exec();
        this.database!.close();
    }
    async onError(ctx: SystemBenchmarkContext): Promise<void> {
        await this.afterAll(ctx);
    }
}

export class LovefieldIntegerTopKBenchmark implements SystemBenchmark {
    builder?: lf.Builder | null;
    database?: lf.DatabaseConnection | null;
    tuples: number;
    columnCount: number;
    orderBy: string[];
    k: number;

    constructor(tuples: number, columnCount: number, orderCriteria: number, k: number) {
        this.builder = null;
        this.database = null;
        this.tuples = tuples;
        this.columnCount = columnCount;
        this.orderBy = [];
        this.k = k;
        for (let i = 0; i < orderCriteria; ++i) {
            this.orderBy.push(`v${i}`);
        }
    }
    getName(): string {
        return `lovefield_integer_sort_${this.tuples}_${this.columnCount}_${this.orderBy.length}`;
    }
    getMetadata(): SystemBenchmarkMetadata {
        return {
            benchmark: 'integer_topk',
            system: 'lovefield',
            tags: [],
            timestamp: +new Date(),
            parameters: [this.tuples, this.columnCount, this.orderBy.length, this.k],
        };
    }
    async beforeAll(ctx: SystemBenchmarkContext): Promise<void> {
        faker.seed(ctx.seed);

        this.builder = lf.schema.create(`${this.getName()}_schema`, 1);
        const tableBuilder = this.builder!.createTable(this.getName());
        const columns = generateXInt32(this.tuples, this.columnCount);
        for (let i = 0; i < columns.length; ++i) {
            tableBuilder.addColumn(`v${i}`, lf.Type.INTEGER);
        }

        this.database = await this.builder!.connect({ storeType: lf.DataStoreType.MEMORY });
        const table = this.database!.getSchema().table(this.getName());
        const rows = [];
        for (let i = 0; i < columns[0].length; ++i) {
            const row: any = {};
            for (let j = 0; j < columns.length; ++j) {
                row[`v${j}`] = columns[j][i];
            }
            rows.push(table.createRow(row));
        }
        await this.database!.insert().into(table).values(rows).exec();
    }
    async beforeEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async run(_ctx: SystemBenchmarkContext): Promise<void> {
        const table = this.database!.getSchema().table(this.getName());
        let query = this.database!.select().from(table);
        for (let i = 0; i < this.columnCount; ++i) {
            query = query.orderBy(table.col(`v${i}`));
        }
        const rows = (await query.limit(this.k).exec()) as Iterable<{
            v0: number;
        }>;
        let n = 0;
        for (const row of rows) {
            noop(row);
            n += 1;
        }
        if (n !== this.k) {
            throw Error(`invalid tuple count. expected ${this.k}, received ${n}`);
        }
    }
    async afterEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async afterAll(_ctx: SystemBenchmarkContext): Promise<void> {
        const table = this.database!.getSchema().table(this.getName());
        await this.database!.delete().from(table).exec();
        this.database!.close();
    }
    async onError(ctx: SystemBenchmarkContext): Promise<void> {
        await this.afterAll(ctx);
    }
}

export class LovefieldIntegerJoin2Benchmark implements SystemBenchmark {
    builder?: lf.Builder | null;
    database?: lf.DatabaseConnection | null;
    tuplesA: number;
    tuplesB: number;
    filterA: number;
    stepAB: number;

    constructor(a: number, b: number, filterA: number, stepAB: number) {
        this.builder = null;
        this.database = null;
        this.tuplesA = a;
        this.tuplesB = b;
        this.filterA = filterA;
        this.stepAB = stepAB;
    }
    getName(): string {
        return `lovefield_integer_join2_${this.tuplesA}_${this.tuplesB}_${this.filterA}_${this.stepAB}`;
    }
    getMetadata(): SystemBenchmarkMetadata {
        return {
            benchmark: 'integer_join2',
            system: 'lovefield',
            tags: [],
            timestamp: +new Date(),
            parameters: [this.tuplesA, this.tuplesB, this.stepAB, this.filterA],
        };
    }
    async beforeAll(ctx: SystemBenchmarkContext): Promise<void> {
        faker.seed(ctx.seed);
        const valuesA = generateInt32(this.tuplesA);
        const [valuesB0, valuesB1] = generate2Int32(this.tuplesB, this.stepAB);

        this.builder = lf.schema.create(`${this.getName()}_schema`, 1);
        const tableABuilder = this.builder!.createTable(`${this.getName()}_a`);
        tableABuilder.addColumn('v0', lf.Type.INTEGER);
        const tableBBuilder = this.builder!.createTable(`${this.getName()}_b`);
        tableBBuilder.addColumn('v0', lf.Type.INTEGER);
        tableBBuilder.addColumn('v1', lf.Type.INTEGER);

        this.database = await this.builder!.connect({ storeType: lf.DataStoreType.MEMORY });
        const tableA = this.database!.getSchema().table(`${this.getName()}_a`);
        const rowsA = valuesA.map(v0 => tableA.createRow({ v0 }));
        await this.database!.insert().into(tableA).values(rowsA).exec();

        const tableB = this.database!.getSchema().table(`${this.getName()}_b`);
        const rowsB = [];
        for (let i = 0; i < valuesB0.length; ++i) {
            rowsB.push(
                tableB.createRow({
                    v0: valuesB0[i],
                    v1: valuesB1[i],
                }),
            );
        }
        await this.database!.insert().into(tableB).values(rowsB).exec();
    }
    async beforeEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async run(_ctx: SystemBenchmarkContext): Promise<void> {
        const tableA = this.database!.getSchema().table(`${this.getName()}_a`);
        const tableB = this.database!.getSchema().table(`${this.getName()}_b`);
        const query = (await this.database!.select()
            .from(tableA)
            .innerJoin(tableB, tableA.col('v0').eq(tableB.col('v1')))
            .where(tableA.col('v0').lt(this.filterA))
            .exec()) as Iterable<{
            v0: number;
            v1: number;
        }>;
        let n = 0;
        for (const row of query) {
            noop(row);
            n += 1;
        }
        const expected = this.filterA * this.stepAB;
        if (n !== expected) {
            throw Error(`invalid tuple count. expected ${expected}, received ${n}`);
        }
    }
    async afterEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async afterAll(_ctx: SystemBenchmarkContext): Promise<void> {
        const tableA = this.database!.getSchema().table(`${this.getName()}_a`);
        const tableB = this.database!.getSchema().table(`${this.getName()}_b`);
        await this.database!.delete().from(tableA).exec();
        await this.database!.delete().from(tableB).exec();
        this.database!.close();
    }
    async onError(ctx: SystemBenchmarkContext): Promise<void> {
        await this.afterAll(ctx);
    }
}

export class LovefieldIntegerJoin3Benchmark implements SystemBenchmark {
    builder?: lf.Builder | null;
    database?: lf.DatabaseConnection | null;
    tuplesA: number;
    tuplesB: number;
    tuplesC: number;
    filterA: number;
    stepAB: number;
    stepBC: number;

    constructor(a: number, b: number, c: number, filterA: number, stepAB: number, stepBC: number) {
        this.builder = null;
        this.database = null;
        this.tuplesA = a;
        this.tuplesB = b;
        this.tuplesC = c;
        this.filterA = filterA;
        this.stepAB = stepAB;
        this.stepBC = stepBC;
    }
    getName(): string {
        return `lovefield_integer_join3_${this.tuplesA}_${this.tuplesB}_${this.tuplesC}_${this.filterA}_${this.stepAB}_${this.stepBC}`;
    }
    getMetadata(): SystemBenchmarkMetadata {
        return {
            benchmark: 'integer_join3',
            system: 'lovefield',
            tags: [],
            timestamp: +new Date(),
            parameters: [this.tuplesA, this.tuplesB, this.tuplesC, this.stepAB, this.stepBC, this.filterA],
        };
    }
    async beforeAll(ctx: SystemBenchmarkContext): Promise<void> {
        faker.seed(ctx.seed);
        const valuesA = generateInt32(this.tuplesA);
        const [valuesB0, valuesB1] = generate2Int32(this.tuplesB, this.stepAB);
        const [valuesC0, valuesC1] = generate2Int32(this.tuplesC, this.stepBC);

        this.builder = lf.schema.create(`${this.getName()}_schema`, 1);
        const tableABuilder = this.builder!.createTable(`${this.getName()}_a`);
        tableABuilder.addColumn('v0', lf.Type.INTEGER);
        const tableBBuilder = this.builder!.createTable(`${this.getName()}_b`);
        tableBBuilder.addColumn('v0', lf.Type.INTEGER);
        tableBBuilder.addColumn('v1', lf.Type.INTEGER);
        const tableCBuilder = this.builder!.createTable(`${this.getName()}_c`);
        tableCBuilder.addColumn('v0', lf.Type.INTEGER);
        tableCBuilder.addColumn('v1', lf.Type.INTEGER);

        this.database = await this.builder!.connect({ storeType: lf.DataStoreType.MEMORY });
        const tableA = this.database!.getSchema().table(`${this.getName()}_a`);
        const rowsA = valuesA.map(v0 => tableA.createRow({ v0 }));
        await this.database!.insert().into(tableA).values(rowsA).exec();

        const tableB = this.database!.getSchema().table(`${this.getName()}_b`);
        const rowsB = [];
        for (let i = 0; i < valuesB0.length; ++i) {
            rowsB.push(
                tableB.createRow({
                    v0: valuesB0[i],
                    v1: valuesB1[i],
                }),
            );
        }
        await this.database!.insert().into(tableB).values(rowsB).exec();

        const tableC = this.database!.getSchema().table(`${this.getName()}_c`);
        const rowsC = [];
        for (let i = 0; i < valuesC0.length; ++i) {
            rowsC.push(
                tableC.createRow({
                    v0: valuesC0[i],
                    v1: valuesC1[i],
                }),
            );
        }
        await this.database!.insert().into(tableC).values(rowsC).exec();
    }
    async beforeEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async run(_ctx: SystemBenchmarkContext): Promise<void> {
        const tableA = this.database!.getSchema().table(`${this.getName()}_a`);
        const tableB = this.database!.getSchema().table(`${this.getName()}_b`);
        const tableC = this.database!.getSchema().table(`${this.getName()}_c`);
        const query = (await this.database!.select()
            .from(tableA)
            .innerJoin(tableB, tableA.col('v0').eq(tableB.col('v1')))
            .innerJoin(tableC, tableB.col('v0').eq(tableC.col('v1')))
            .where(tableA.col('v0').lt(this.filterA))
            .exec()) as Iterable<{
            v0: number;
            v1: number;
        }>;
        let n = 0;
        for (const row of query) {
            noop(row);
            n += 1;
        }
        const expected = this.filterA * this.stepAB * this.stepBC;
        if (n !== expected) {
            throw Error(`invalid tuple count. expected ${expected}, received ${n}`);
        }
    }
    async afterEach(_ctx: SystemBenchmarkContext): Promise<void> {}
    async afterAll(_ctx: SystemBenchmarkContext): Promise<void> {
        const tableA = this.database!.getSchema().table(`${this.getName()}_a`);
        const tableB = this.database!.getSchema().table(`${this.getName()}_b`);
        const tableC = this.database!.getSchema().table(`${this.getName()}_c`);
        await this.database!.delete().from(tableA).exec();
        await this.database!.delete().from(tableB).exec();
        await this.database!.delete().from(tableC).exec();
        this.database!.close();
    }
    async onError(ctx: SystemBenchmarkContext): Promise<void> {
        await this.afterAll(ctx);
    }
}
