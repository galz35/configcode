import { tool } from "@opencode-ai/plugin"
import { execSync } from "child_process"

export default tool({
  description: "Run TypeScript compiler check on the project. Use this to validate React/TypeScript code before finalizing changes.",
  args: {
    path: tool.schema.string().optional().describe("Specific file to check. Omit for full project."),
  },
  async execute(args) {
    try {
      const cmd = args.path ? `npx tsc --noEmit ${args.path}` : "npx tsc --noEmit"
      execSync(cmd, { cwd: process.cwd(), timeout: 60000, encoding: "utf-8" })
      return "TYPESCRIPT CHECK: No errors! Code compiles correctly."
    } catch (err: any) {
      const output = err.stdout || err.stderr || err.message
      return `TYPESCRIPT ERRORS:\n${output}\n\nFIX these compilation errors.`
    }
  },
})
