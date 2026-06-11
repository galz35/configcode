import { tool } from "@opencode-ai/plugin"
import { execSync } from "child_process"
import { readFileSync } from "fs"

export default tool({
  description: "Run NestJS TypeScript compiler check. Use this to validate NestJS backend code before finalizing.",
  args: {
    path: tool.schema.string().optional().describe("Specific file to check."),
  },
  async execute(args) {
    try {
      // Check for forbidden imports
      if (args.path) {
        const content = readFileSync(args.path, "utf-8")
        const forbidden = ["@prisma/client", "typeorm", "sequelize", "mongoose", "drizzle-orm", "knex"]
        for (const item of forbidden) {
          if (content.includes(item)) {
            return `NESTJS CHECK FAILED: File contains forbidden ORM/Query Builder import: '${item}'. Remember, NO ORMs are allowed!`
          }
        }
      }

      const cmd = args.path ? `npx tsc --noEmit ${args.path}` : "npx tsc --noEmit"
      execSync(cmd, { cwd: process.cwd(), timeout: 60000, encoding: "utf-8" })
      return "NESTJS COMPILE CHECK: No errors!"
    } catch (err: any) {
      return `NESTJS ERRORS:\n${err.stdout || err.stderr || err.message}`
    }
  },
})
