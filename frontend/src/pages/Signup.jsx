
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../services/api";

function Signup() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    // runs when the user submits the form
    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        // check empty fields
        if (email === "" || password === "" || confirmPassword === "") {
            setError("Please fill in all fields.");
            return;
        }

        // check email
        if (!email.includes("@")) {
            setError("Please enter a valid email.");
            return;
        }

        // check passwords match
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            // send signup information to backend
            await signup(email, password);

            // go to login after successful signup
            navigate("/login", { replace: true });
        } catch (err) {
            console.log(err);
            setError(err.message);
        }
    }

    return (
        <div>
            <h1>Sign Up</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="signup-email">Email</label>
                    <input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="signup-password">Password</label>
                    <input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="confirm-password">Confirm Password</label>
                    <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                </div>

                {error !== "" && <p>{error}</p>}

                <button type="submit">Create Account</button>
            </form>

            <p>
                Already have an account? <Link to="/login">Login</Link>
            </p>
        </div>
    );
}

export default Signup;
