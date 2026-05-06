import { tool } from "@opencode-ai/plugin"
import { execSync } from "child_process"

export default tool({
  description: "Run NestJS TypeScript compiler check. Use this to validate NestJS backend code before finalizing.",
  args: {
    path: tool.schema.string().optional().describe("Specific file to check."),
  },
  async execute(args) {
    try {
      const cmd = args.path ? `npx tsc --noEmit ${args.path}` : "npx tsc --noEmit"
      execSync(cmd, { cwd: process.cwd(), timeout: 60000, encoding: "utf-8" })
      return "NESTJS COMPILE CHECK: No errors!"
    } catch (err: any) {
      return `NESTJS ERRORS:\n${err.stdout || err.stderr || err.message}`
    }
  },
})
