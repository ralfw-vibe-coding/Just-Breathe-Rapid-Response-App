import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
// @ts-ignore Runtime-only server module for dev API middleware.
import { generateProtocolSuggestions } from "./server/ai-protocol-assistant.mjs"

function aiAssistantDevApi() {
  return {
    name: "ai-assistant-dev-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/ai-protocol-suggestions", async (req, res, next) => {
        if (req.method !== "POST") {
          return next()
        }

        let body = ""
        req.on("data", (chunk) => {
          body += chunk
        })

        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}")
            const result = await generateProtocolSuggestions(payload)
            res.statusCode = 200
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify(result))
          } catch (error) {
            res.statusCode = 500
            res.setHeader("Content-Type", "application/json")
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown AI assistant error",
              }),
            )
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), aiAssistantDevApi()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
