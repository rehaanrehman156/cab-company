import { useState } from "react";
import { TextField, Button } from "@mui/material";

export default function SignupForm({ onSignup }: { onSignup: (name: string, email: string, password: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div>
      <TextField fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <TextField fullWidth label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField fullWidth type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button variant="contained" color="primary" onClick={() => onSignup(name, email, password)}>Signup</Button>
    </div>
  );
}
