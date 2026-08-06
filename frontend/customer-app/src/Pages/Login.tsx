import LoginForm from "../Components/Auth/LoginForm";
import { login } from "../Services/auth";

export default function Login() {
  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await login(email, password);
      // Save token for future requests
      localStorage.setItem("authToken", response.data.token);

      // Redirect or update UI after successful login
      console.log("Login successful:", response.data);
      // Example: navigate to home page later
      // navigate("/home");
    } catch (error: any) {
      console.error("Login failed:", error.response?.data || error.message);
      alert("Login failed. Please check your credentials.");
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <LoginForm onLogin={handleLogin} />
    </div>
  );
}
