import { Router } from "express";

const router = Router();

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

export default router;
