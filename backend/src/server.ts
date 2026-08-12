// Cab Company backend v2
import express from "express";
import cors from "cors";
import { createServer } from "http";
import authRoutes from "./routes/auth";
import rideRoutes from "./routes/rides";
import { loadRuntimeSecretsFromAws } from "./config/runtimeSecrets";
import { initializeSocketServer } from "./realtime/socket";

async function bootstrap(): Promise<void> {
  const requireRuntimeSecrets = process.env.REQUIRE_RUNTIME_SECRETS === "true";

  try {
    await loadRuntimeSecretsFromAws();
  } catch (error) {
    if (requireRuntimeSecrets) {
      console.error("Failed to load runtime secrets from AWS Secrets Manager.", error);
      process.exit(1);
    }

    console.warn("Runtime secrets could not be loaded. Continuing startup because REQUIRE_RUNTIME_SECRETS is not true.");
  }

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/rides", rideRoutes);

  const httpServer = createServer(app);
  initializeSocketServer(httpServer);

  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

void bootstrap();
