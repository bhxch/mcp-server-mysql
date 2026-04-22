import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config before importing the module under test
vi.mock("./../../src/config/index.js", () => ({
  isMultiDbMode: true,
  mcpConfig: {},
}));

import { extractSchemaFromQuery } from "./../../src/db/utils.js";

describe("extractSchemaFromQuery", () => {
  beforeEach(() => {
    vi.stubEnv("MYSQL_DB", "");
  });

  describe("USE statement", () => {
    it("extracts schema from simple USE statement", () => {
      expect(extractSchemaFromQuery("USE production")).toBe("production");
    });

    it("extracts schema from USE with backticks", () => {
      expect(extractSchemaFromQuery("USE `production`")).toBe("production");
    });

    it("extracts schema from USE statement with trailing semicolon", () => {
      expect(extractSchemaFromQuery("USE production;")).toBe("production");
    });

    it("prevents bypass via SQL comment in USE statement", () => {
      expect(extractSchemaFromQuery("USE/**/production")).toBe("production");
    });

    it("prevents bypass via inline comment in USE statement", () => {
      expect(extractSchemaFromQuery("USE /* comment */ production")).toBe(
        "production"
      );
    });
  });

  describe("database.table notation", () => {
    it("extracts schema from SELECT with qualified table name", () => {
      expect(extractSchemaFromQuery("SELECT * FROM production.users")).toBe(
        "production"
      );
    });

    it("extracts schema from INSERT with qualified table name", () => {
      expect(
        extractSchemaFromQuery("INSERT INTO staging.orders (id) VALUES (1)")
      ).toBe("staging");
    });

    it("extracts schema from UPDATE with qualified table name", () => {
      expect(
        extractSchemaFromQuery("UPDATE production.users SET name = 'x'")
      ).toBe("production");
    });

    it("extracts schema from DELETE with qualified table name", () => {
      expect(
        extractSchemaFromQuery("DELETE FROM production.users WHERE id = 1")
      ).toBe("production");
    });

    it("extracts schema with backtick-quoted identifiers", () => {
      expect(
        extractSchemaFromQuery("SELECT * FROM `production`.`users`")
      ).toBe("production");
    });
  });

  describe("fallback behavior", () => {
    it("returns null when no schema found and no default", () => {
      expect(extractSchemaFromQuery("SELECT 1")).toBeNull();
    });

    it("returns default schema from env when no schema in query", () => {
      vi.stubEnv("MYSQL_DB", "default_db");
      expect(extractSchemaFromQuery("SELECT 1")).toBe("default_db");
    });

    it("handles invalid SQL gracefully by falling back to default", () => {
      expect(extractSchemaFromQuery("NOT VALID SQL !!!")).toBeNull();
    });
  });
});
