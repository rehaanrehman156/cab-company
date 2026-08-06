import { useState } from "react";
import { TextField, Button } from "@mui/material";

export default function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div>
      <TextField fullWidth label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField fullWidth type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button variant="contained" color="primary" onClick={() => onLogin(email, password)}>Login</Button>
    </div>
  );
}
