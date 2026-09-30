import { useState } from "react";
import { signup } from "../services/api";

function Signup() {
    // states for the form inputs
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    // this runs when the user clicks the button
    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        // check if any field is empty
        if (email === "" || password === "" || confirmPassword === "") {
            setError("Please fill in all fields.");
            return;
        }

        // check if email has @
        if (!email.includes("@")) {
            setError("Please enter a valid email.");
            return;
        }

        // check if passwords are the same
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            // send data to backend
            await signup(email, password);

            // if it works go to login page
            window.location.href = "/login";
        } catch (err) {
            // show the error from backend
            console.log(err);
            setError(err.message);
        }
    }

    return (
        <div>
            <h1>Sign Up</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <label>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div>
                    <label>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div>
                    <label>Confirm Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                </div>

                {/* show error if there is one */}
                {error !== "" && <p>{error}</p>}

                <button type="submit">Create Account</button>
            </form>
        </div>
    );
}

export default Signup;