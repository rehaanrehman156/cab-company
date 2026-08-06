"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const auth_1 = __importDefault(require("./routes/auth"));
const rides_1 = __importDefault(require("./routes/rides"));
const runtimeSecrets_1 = require("./config/runtimeSecrets");
const socket_1 = require("./realtime/socket");
async function bootstrap() {
    const requireRuntimeSecrets = process.env.REQUIRE_RUNTIME_SECRETS === "true";
    try {
        await (0, runtimeSecrets_1.loadRuntimeSecretsFromAws)();
    }
    catch (error) {
        if (requireRuntimeSecrets) {
            console.error("Failed to load runtime secrets from AWS Secrets Manager.", error);
            process.exit(1);
        }
        console.warn("Runtime secrets could not be loaded. Continuing startup because REQUIRE_RUNTIME_SECRETS is not true.");
    }
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });
    app.use("/auth", auth_1.default);
    app.use("/rides", rides_1.default);
    const httpServer = (0, http_1.createServer)(app);
    (0, socket_1.initializeSocketServer)(httpServer);
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
        console.log(`Backend running on port ${PORT}`);
    });
}
void bootstrap();
