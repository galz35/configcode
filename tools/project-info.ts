import { tool } from "@opencode-ai/plugin"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

export default tool({
  description: "Detects the project stack, configuration files, dependencies, and whether Memory Bank is present.",
  args: {},
  async execute() {
    const rootDir = process.cwd()
    const info: Record<string, any> = {
      path: rootDir,
      stack: "Unknown",
      configs: [],
      hasMemoryBank: false,
      dependencies: {},
    }

    // Check files in root
    if (existsSync(join(rootDir, "package.json"))) {
      info.stack = "Node.js (TypeScript/JavaScript)"
      info.configs.push("package.json")
      
      try {
        const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"))
        info.dependencies = { ...pkg.dependencies, ...pkg.devDependencies }
        if (info.dependencies["@nestjs/core"]) {
          info.stack = "NestJS Backend"
        } else if (info.dependencies["express"]) {
          info.stack = "Express Backend / Web App"
        }
      } catch (_) {}
    }

    if (existsSync(join(rootDir, "pubspec.yaml"))) {
      info.stack = "Flutter / Dart Mobile App"
      info.configs.push("pubspec.yaml")
    }

    if (existsSync(join(rootDir, "Cargo.toml"))) {
      info.stack = "Rust Application"
      info.configs.push("Cargo.toml")
    }

    // Check Memory Bank
    if (existsSync(join(rootDir, "memory-bank")) || existsSync(join(rootDir, "configcode/memory-bank"))) {
      info.hasMemoryBank = true
    }

    // Check other config files
    const potentialConfigs = [
      "tsconfig.json",
      "vite.config.ts",
      "next.config.js",
      "docker-compose.yml",
      "Dockerfile",
      "ecosystem.config.js",
      ".gitignore",
      "rules/GOLDEN_RULES.md",
    ]

    for (const file of potentialConfigs) {
      if (existsSync(join(rootDir, file))) {
        info.configs.push(file)
      }
    }

    return `PROJECT INFO DETECTION:\n\n` +
      `- **Stack Detectado:** ${info.stack}\n` +
      `- **Archivos de Configuración:** ${info.configs.join(", ")}\n` +
      `- **Memory Bank Presente:** ${info.hasMemoryBank ? "Sí" : "No"}\n` +
      `- **Dependencias Detectadas (${Object.keys(info.dependencies).length} registradas):** ${Object.keys(info.dependencies).slice(0, 15).join(", ")}` + (Object.keys(info.dependencies).length > 15 ? "..." : "")
  },
})
