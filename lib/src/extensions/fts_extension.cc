#include "duckdb/web/extensions/fts_extension.h"

#include "fts-extension.hpp"

extern "C" void duckdb_web_fts_init(duckdb::DuckDB* db) { db->LoadExtension<duckdb::FTSExtension>(); }
