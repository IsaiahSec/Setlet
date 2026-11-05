
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../services/api";
import "./Auth.css";

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
        <main className="auth-page">
            <section className="auth-aside" aria-label="Setlet study tools">
                <Link className="auth-brand" to="/login">
                    <span className="app-brand-mark" aria-hidden="true">S</span>
                    Setlet
                </Link>
                <div className="auth-aside-copy">
                    <span className="auth-kicker">Build your study rhythm</span>
                    <h2>Learn a little.<br />Remember a lot.</h2>
                    <p>Make a space for the things you want to know.</p>
                </div>
                <div className="auth-note" aria-hidden="true">
                    <span>01</span><i /><span>02</span><i /><span>03</span>
                </div>
            </section>
            <section className="auth-content">
                <div className="auth-card">
                    <span className="auth-kicker">Start learning</span>
                    <h1>Sign Up</h1>
                    <p className="auth-intro">Create an account to organize your next study session.</p>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label htmlFor="signup-email">Email</label>
                            <input
                                id="signup-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>

                        <div className="auth-field">
                            <label htmlFor="signup-password">Password</label>
                            <input
                                id="signup-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="auth-field">
                            <label htmlFor="confirm-password">Confirm Password</label>
                            <input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>

                        {error !== "" && <p className="auth-error" role="alert">{error}</p>}

                        <button className="auth-submit" type="submit">Create Account</button>
                    </form>

                    <p className="auth-switch">
                        Already have an account? <Link to="/login">Login</Link>
                    </p>
                </div>
            </section>
        </main>
    );
}

export default Signup;
