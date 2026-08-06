"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (email === "test@test.com" && password === "1234") {
        return res.json({ token: "mock-jwt-token" });
    }
    res.status(401).json({ error: "Invalid credentials" });
});
router.post("/signup", (req, res) => {
    const { name, email, password } = req.body;
    return res.json({ message: "Signup successful", token: "mock-jwt-token" });
});
exports.default = router;
