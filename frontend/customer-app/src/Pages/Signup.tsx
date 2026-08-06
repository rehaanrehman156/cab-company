import SignupForm from "../Components/Auth/SignupForm";
import { signup } from "../Services/auth";

export default function Signup() {
  const handleSignup = async (name: string, email: string, password: string) => {
    try {
      const response = await signup(name, email, password);
      console.log("Signup successful:", response.data);

      // Optionally save token if backend returns one
      if (response.data.token) {
        localStorage.setItem("authToken", response.data.token);
      }

      // Redirect or update UI after signup
      // Example: navigate("/home");
    } catch (error: any) {
      console.error("Signup failed:", error.response?.data || error.message);
      alert("Signup failed. Please try again.");
    }
  };

  return (
    <div>
      <h2>Signup</h2>
      <SignupForm onSignup={handleSignup} />
    </div>
  );
}
