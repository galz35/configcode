import { tool } from "@opencode-ai/plugin"
import { execSync } from "child_process"

export default tool({
  description: "Run flutter analyze on the project and return errors/warnings. Use this to validate Flutter code before considering it done.",
  args: {
    path: tool.schema.string().optional().describe("Specific file or directory to analyze. Omit to analyze entire project."),
  },
  async execute(args) {
    try {
      const target = args.path || "lib/"
      
      // Run dart format check first
      try {
        execSync(`dart format --set-exit-if-changed ${target}`, { cwd: process.cwd(), timeout: 30000 })
      } catch (formatErr: any) {
        return `FLUTTER CHECK FAILED (Formatting): Some files are not formatted correctly. Run 'dart format ${target}' to fix them.`
      }

      const result = execSync(`flutter analyze ${target}`, {
        cwd: process.cwd(),
        timeout: 120000,
        encoding: "utf-8",
      })
      const output = result.trim()
      if (output.includes("No issues found")) {
        return "FLUTTER ANALYZE: No issues found! Code is clean."
      }
      return `FLUTTER ANALYZE RESULTS:\n${output}\n\nFix these issues before finalizing.`
    } catch (err: any) {
      return `FLUTTER ANALYZE FAILED:\n${err.stdout || err.stderr || err.message}\n\nFIX these issues.`
    }
  },
})
