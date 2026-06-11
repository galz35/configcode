import { tool } from "@opencode-ai/plugin"
import { readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"

export default tool({
  description: "Runs security audit check on project (dependency scan, hardcoded secrets, SQL concatenation detection).",
  args: {
    directory: tool.schema.string().optional().describe("Directory to audit. Defaults to current workspace."),
  },
  async execute(args) {
    const rootDir = args.directory || process.cwd()
    const reports: string[] = []

    // 1. Check package.json for ORMs
    try {
      const pkgPath = join(rootDir, "package.json")
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      
      const forbidden = ["prisma", "@prisma/client", "typeorm", "sequelize", "mongoose", "drizzle-orm", "knex"]
      const found = forbidden.filter(d => deps[d] !== undefined)
      
      if (found.length > 0) {
        reports.push(`[CRITICAL] Forbidden ORMs/Query Builders found in dependencies: ${found.join(", ")}`)
      }
    } catch (e) {
      // No package.json, skip Node check
    }

    // 2. Scan files for SQL concat & secrets
    const secretsRegex = /(password|passwd|api_key|apikey|secret|token|connectionstring)\s*=\s*['"`][a-zA-Z0-9_\-]{16,}['"`]/gi
    const sqlConcatRegex = /query\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/gi // Detect query("...${var}...")

    function scanDir(dir: string) {
      const files = readdirSync(dir)
      for (const file of files) {
        if (["node_modules", ".git", "dist", "build", ".opencode"].includes(file)) continue
        const fullPath = join(dir, file)
        const stat = statSync(fullPath)
        
        if (stat.isDirectory()) {
          scanDir(fullPath)
        } else if (stat.isFile() && /\.(js|ts|dart|sql)$/.test(file)) {
          const content = readFileSync(fullPath, "utf-8")
          
          // Check for hardcoded secrets
          if (secretsRegex.test(content)) {
            reports.push(`[HIGH] Potential hardcoded secret found in: ${fullPath}`)
          }
          
          // Check for SQL string interpolation
          if (sqlConcatRegex.test(content)) {
            reports.push(`[CRITICAL] Potential SQL String Interpolation (Concatenation) found in: ${fullPath}`)
          }
        }
      }
    }

    try {
      scanDir(rootDir)
    } catch (e: any) {
      reports.push(`[ERROR] Scanning directory failed: ${e.message}`)
    }

    // 3. Try to run npm audit
    try {
      const result = execSync("npm audit --json", { cwd: rootDir, encoding: "utf-8" })
      const audit = JSON.parse(result)
      if (audit.metadata && audit.metadata.vulnerabilities) {
        const vulns = audit.metadata.vulnerabilities
        const total = vulns.info + vulns.low + vulns.moderate + vulns.high + vulns.critical
        if (total > 0) {
          reports.push(`[MEDIUM] npm audit: ${total} vulnerabilities found (${vulns.critical} critical, ${vulns.high} high).`)
        }
      }
    } catch (e: any) {
      if (e.stdout) {
        try {
          const audit = JSON.parse(e.stdout.toString())
          const vulns = audit.metadata.vulnerabilities
          const total = vulns.info + vulns.low + vulns.moderate + vulns.high + vulns.critical
          if (total > 0) {
            reports.push(`[MEDIUM] npm audit: ${total} vulnerabilities found (${vulns.critical} critical, ${vulns.high} high).`)
          }
        } catch (_) {}
      }
    }

    if (reports.length === 0) {
      return "SECURITY CHECK: OK. No security issues detected."
    }

    return `SECURITY CHECK RESULTS:\n\n${reports.join("\n")}`
  },
})
