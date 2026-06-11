import { tool } from "@opencode-ai/plugin"
import { execSync } from "child_process"

export default tool({
  description: "Run cargo check on Rust project. Use this to validate Rust code for compilation errors.",
  args: {},
  async execute() {
    try {
      const result = execSync("cargo check", { cwd: process.cwd(), timeout: 120000, encoding: "utf-8" })
      return `CARGO CHECK: ${result.trim().split('\n').pop() || 'Success'}`
    } catch (err: any) {
      return `CARGO CHECK FAILED:\n${err.stderr || err.stdout || err.message}`
    }
  },
})
