//import { writeReport, setupDuckDBSync, setupSqljs } from './setup';
import { writeReport } from './setup';
import {
    SystemBenchmarkContext,
    SystemBenchmark,
    //    DuckDBSyncLoadedTPCHBenchmark,
    //    SqljsTPCHBenchmark,
    ArqueroTPCHBenchmark,
} from './system';
import { runSystemBenchmarks } from './suite';
import * as path from 'path';

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('usage: node suite-system-tpch.js <scalefactor>');
        process.exit(-1);
    }
    const sf = parseFloat(args[0]);
    console.log(`Scale Factor ${sf}`);

    const baseDir = path.resolve(__dirname, '../../../');
    //const duckdbSync = await setupDuckDBSync();
    //const sqljsDB = await setupSqljs();

    const bench: SystemBenchmark[] = [new ArqueroTPCHBenchmark(sf, 1)];

    // const benchDuckDB: SystemBenchmark[] = [];
    // for (let i = 0; i < 22; ++i) {
    //     bench.push(new SqljsTPCHBenchmark(sqljsDB, sf, i + 1));
    //     benchDuckDB.push(new DuckDBSyncLoadedTPCHBenchmark(duckdbSync, sf, i + 1));
    // }

    const ctx: SystemBenchmarkContext = {
        projectRootPath: baseDir,
        seed: Math.random(),
    };

    const results = await runSystemBenchmarks(ctx, bench);

    // await DuckDBSyncLoadedTPCHBenchmark.beforeGroup(duckdbSync, ctx, sf);
    // const resultsDuckDB = await runSystemBenchmarks(ctx, benchDuckDB);
    // await DuckDBSyncLoadedTPCHBenchmark.afterGroup(duckdbSync);
    // results = results.concat(resultsDuckDB);

    console.log(results);
    await writeReport(results, `./benchmark_system_tpch_${sf.toString().replace('.', '')}.json`);
}

main();
