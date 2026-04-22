import { isMultiDbMode } from "./../config/index.js";
import { log } from "./../utils/index.js";
import SqlParser, { AST } from "node-sql-parser";

const { Parser } = SqlParser;
const parser = new Parser();

// Extract schema from SQL query using AST parser to prevent regex bypass
// via SQL comments (e.g. USE/**/schema_name)
function extractSchemaFromQuery(sql: string): string | null {
  const defaultSchema = process.env.MYSQL_DB || null;

  if (defaultSchema && !isMultiDbMode) {
    return defaultSchema;
  }

  try {
    const astOrArray: AST | AST[] = parser.astify(sql, { database: "mysql" });
    const statements = Array.isArray(astOrArray) ? astOrArray : [astOrArray];

    for (const stmt of statements) {
      // Case 1: USE database statement
      if (stmt.type === "use" && (stmt as any).db) {
        return (stmt as any).db;
      }

      // Case 2: database.table notation in FROM/INTO/UPDATE etc. clauses
      const tableRefs = (stmt as any).table || (stmt as any).from;
      if (Array.isArray(tableRefs)) {
        for (const t of tableRefs) {
          if (t?.db) return t.db;
        }
      } else if (tableRefs?.db) {
        return tableRefs.db;
      }
    }
  } catch {
    // AST parse failed, fall through to default
  }

  return defaultSchema;
}

async function getQueryTypes(query: string): Promise<string[]> {
  try {
    log("info", "Parsing SQL query: ", query);
    // Parse into AST or array of ASTs - only specify the database type
    const astOrArray: AST | AST[] = parser.astify(query, { database: "mysql" });
    const statements = Array.isArray(astOrArray) ? astOrArray : [astOrArray];

    // Map each statement to its lowercased type (e.g., 'select', 'update', 'insert', 'delete', etc.)
    return statements.map((stmt) => stmt.type?.toLowerCase() ?? "unknown");
  } catch (err: any) {
    log("error", "sqlParser error, query: ", query);
    log("error", "Error parsing SQL query:", err);
    throw new Error(`Parsing failed: ${err.message}`);
  }
}

export { extractSchemaFromQuery, getQueryTypes };
